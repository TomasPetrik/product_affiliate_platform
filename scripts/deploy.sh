#!/usr/bin/env bash
# Deploy this repo to the radarcut.com VPS.
#
# Usage (from the repo root):
#   npm run deploy
#   ./scripts/deploy.sh
#   ./scripts/deploy.sh --skip-install   # reuse remote node_modules (source-only changes)
#   ./scripts/deploy.sh --skip-checks    # skip local typecheck
#   ./scripts/deploy.sh --dry-run        # show rsync plan, do not change the server
#
# Requires SSH key access to DEPLOY_HOST. Does not copy .env or uploaded product images;
# those stay on the server.

set -euo pipefail

ROOT="$(cd "$(dirname "$0")/.." && pwd)"
cd "$ROOT"

DEPLOY_HOST="${DEPLOY_HOST:-root@72.61.158.103}"
DEPLOY_APP_DIR="${DEPLOY_APP_DIR:-/var/www/radarcut.com/app}"
DEPLOY_APP_USER="${DEPLOY_APP_USER:-radarcut}"
DEPLOY_SERVICE="${DEPLOY_SERVICE:-radarcut.service}"
DEPLOY_HEALTH_URL="${DEPLOY_HEALTH_URL:-https://radarcut.com}"

SKIP_INSTALL=0
SKIP_CHECKS=0
DRY_RUN=0

usage() {
  cat <<'EOF'
Deploy RadarCut to the production VPS.

  npm run deploy
  ./scripts/deploy.sh [options]

Options:
  --skip-install  Skip remote npm ci (faster when dependencies did not change)
  --skip-checks   Skip the local TypeScript check
  --dry-run       Print the rsync plan and exit
  -h, --help      Show this help

Environment overrides:
  DEPLOY_HOST         SSH target (default: root@72.61.158.103)
  DEPLOY_APP_DIR      Remote app directory
  DEPLOY_APP_USER     Remote user that owns the app and runs the build
  DEPLOY_SERVICE      systemd unit to restart
  DEPLOY_HEALTH_URL   Origin to health-check after restart
EOF
}

while [[ $# -gt 0 ]]; do
  case "$1" in
    --skip-install) SKIP_INSTALL=1 ;;
    --skip-checks) SKIP_CHECKS=1 ;;
    --dry-run) DRY_RUN=1 ;;
    -h|--help) usage; exit 0 ;;
    *)
      echo "Unknown option: $1" >&2
      usage >&2
      exit 1
      ;;
  esac
  shift
done

if [[ ! -f package.json ]] || ! grep -q '"name": "product_affiliate_platform"' package.json; then
  echo "Run this script from the product_affiliate_platform repo root." >&2
  exit 1
fi

SSH=(ssh -o BatchMode=yes -o ConnectTimeout=15 "$DEPLOY_HOST")
RSYNC_SSH="ssh -o BatchMode=yes -o ConnectTimeout=15"

RSYNC_EXCLUDES=(
  --exclude '.git/'
  --exclude 'node_modules/'
  --exclude '.next/'
  --exclude 'src/generated/'
  --exclude '.env'
  --exclude '.env.local'
  --exclude '.DS_Store'
  --exclude '.cursor/'
  --exclude 'coverage/'
  --exclude '*.tsbuildinfo'
  --include 'public/uploads/products/.gitkeep'
  --exclude 'public/uploads/products/*'
  --include 'storage/uploads/products/.gitkeep'
  --exclude 'storage/uploads/products/*'
)

log() {
  printf '\n==> %s\n' "$*"
}

if [[ "$SKIP_CHECKS" -eq 0 ]]; then
  log "Typecheck"
  npm run typecheck
fi

log "Sync source to $DEPLOY_HOST:$DEPLOY_APP_DIR"
if [[ "$DRY_RUN" -eq 1 ]]; then
  rsync -azn --delete --itemize-changes -e "$RSYNC_SSH" "${RSYNC_EXCLUDES[@]}" "$ROOT/" "$DEPLOY_HOST:$DEPLOY_APP_DIR/"
  echo "Dry run only. No remote build or restart."
  exit 0
fi

rsync -az --delete -e "$RSYNC_SSH" "${RSYNC_EXCLUDES[@]}" "$ROOT/" "$DEPLOY_HOST:$DEPLOY_APP_DIR/"

log "Fix ownership and keep server .env private"
"${SSH[@]}" "set -euo pipefail
  test -f '$DEPLOY_APP_DIR/.env'
  mkdir -p '$DEPLOY_APP_DIR/storage/uploads/products'
  mkdir -p '$DEPLOY_APP_DIR/public/uploads/products'
  # One-time move of legacy public uploads into durable storage (runtime-safe).
  if compgen -G '$DEPLOY_APP_DIR/public/uploads/products/*' > /dev/null; then
    find '$DEPLOY_APP_DIR/public/uploads/products' -maxdepth 1 -type f ! -name '.gitkeep' -exec mv -n {} '$DEPLOY_APP_DIR/storage/uploads/products/' \;
  fi
  chown -R '$DEPLOY_APP_USER:$DEPLOY_APP_USER' '$DEPLOY_APP_DIR'
  chmod 600 '$DEPLOY_APP_DIR/.env'
"

REMOTE_STEPS="cd '$DEPLOY_APP_DIR'"
if [[ "$SKIP_INSTALL" -eq 0 ]]; then
  REMOTE_STEPS+=" && echo '==> npm ci' && npm ci"
else
  REMOTE_STEPS+=" && echo '==> skip npm ci'"
fi
REMOTE_STEPS+=" && echo '==> prisma generate + migrate' && npx prisma generate && npx prisma migrate deploy"
REMOTE_STEPS+=" && echo '==> next build' && npm run build"

log "Install, migrate, and build on the VPS"
"${SSH[@]}" "sudo -u '$DEPLOY_APP_USER' bash -lc \"$REMOTE_STEPS\""

log "Restart $DEPLOY_SERVICE"
"${SSH[@]}" "systemctl restart '$DEPLOY_SERVICE' && sleep 2 && systemctl is-active '$DEPLOY_SERVICE'"

log "Health check $DEPLOY_HEALTH_URL"
ok=0
for _ in 1 2 3 4 5 6; do
  code="$(curl -sS -o /dev/null -w '%{http_code}' -A 'RadarCut-deploy' --max-time 20 "$DEPLOY_HEALTH_URL/" || true)"
  if [[ "$code" == "200" ]]; then
    ok=1
    break
  fi
  sleep 2
done

if [[ "$ok" -ne 1 ]]; then
  echo "Deploy finished but $DEPLOY_HEALTH_URL did not return 200." >&2
  "${SSH[@]}" "systemctl --no-pager --lines=40 status '$DEPLOY_SERVICE' || true" >&2
  exit 1
fi

for path in / /products /privacy /disclosure; do
  curl -sS -o /dev/null -w "%{http_code} ${path}\n" -A 'RadarCut-deploy' --max-time 20 "${DEPLOY_HEALTH_URL}${path}"
done

echo
echo "Deployed: $DEPLOY_HEALTH_URL"
