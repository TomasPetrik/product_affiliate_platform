import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  // Pin the workspace root explicitly. Without this, Turbopack's root
  // inference can walk up past this repo and pick up an unrelated
  // package.json/lockfile higher in the filesystem tree (e.g. in the
  // user's home directory), which otherwise only surfaces as a warning.
  turbopack: {
    root: __dirname,
  },
  // Keep the IP city database on disk; do not pack it into the app bundle.
  serverExternalPackages: ["geoip-lite"],
  experimental: {
    // Static generation spawns several worker processes, each opening its
    // own Postgres connection pool (see `src/lib/prisma.ts`). Against a
    // connection-capped database — the local `prisma dev` server used in
    // development caps at 10 total connections, and many managed
    // Postgres free/hobby tiers are similarly limited — parallel workers
    // can exhaust the connection limit mid-build. Building with a single
    // worker keeps total connections bounded; with a small catalog this
    // has no meaningful effect on build time.
    cpus: 1,
    serverActions: {
      // Hero uploads allow up to 5MB images plus multipart overhead.
      bodySizeLimit: "6mb",
    },
  },
  async headers() {
    // Baseline security headers. A full Content-Security-Policy is
    // intentionally deferred to the hardening phase (Phase 7), where it can
    // be tuned against real third-party script/image needs.
    return [
      {
        source: "/:path*",
        headers: [
          { key: "X-Content-Type-Options", value: "nosniff" },
          { key: "X-Frame-Options", value: "DENY" },
          { key: "Referrer-Policy", value: "strict-origin-when-cross-origin" },
          { key: "Permissions-Policy", value: "camera=(), microphone=(), geolocation=()" },
        ],
      },
    ];
  },
};

export default nextConfig;
