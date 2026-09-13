# FindIt — Affiliate Product Discovery Platform

A production-track Next.js app that curates products from marketplaces (Amazon, eBay, …) and
sends visitors to the marketplace to buy. This app does **not** process payments or sell products
itself. See the original planning conversation for the full approved architecture — this README
covers local setup for what's implemented so far.

## Status: Phase 2 (admin auth + real CRUD)

Implemented:

- Next.js/TypeScript/Tailwind/shadcn scaffold, Prisma schema for the core catalog (products,
  categories, marketplaces, affiliate links, admin users, audit log).
- Public site — homepage, listing, PDP, categories, disclosure — now reads live from Postgres via
  `src/server/services/catalog.service.ts` (published content only).
- Admin authentication: email/password login (`/admin/login`), signed HTTP-only session cookies,
  route protection via `src/proxy.ts` (Next.js 16's `middleware.ts` replacement).
- Real Category and Product CRUD (create/edit/delete, publish/unpublish, featured/trending
  toggles, per-marketplace affiliate link management), backed by Server Actions + Prisma.
- Audit log: every admin mutation is recorded with actor, action, before/after state, and shown
  at `/admin/audit-log`.

**Not implemented yet** (by design, later phases): Amazon/eBay import automation, analytics event
tracking (page views, CTR, traffic sources), revenue reconciliation.

**Architecture note:** the original plan named NextAuth/Auth.js for admin auth. At implementation
time, Auth.js v5 (the version with first-class App Router support) was still beta-tagged on npm.
Since this app only needs first-party email/password auth, a small, fully-owned session layer
(`src/lib/session.ts` + `src/lib/auth.ts`, using `jose` for JWTs and Node's built-in `crypto.scrypt`
for password hashing) was used instead, avoiding a pre-release dependency. Swapping to Auth.js
later remains straightforward.

## Getting started

```bash
npm install
cp .env.example .env   # fill in DATABASE_URL and AUTH_SECRET (see below)
npm run db:migrate      # create the schema
npm run db:seed         # seed an admin user + sample catalog
npm run dev
```

Open [http://localhost:3000](http://localhost:3000) for the public site and
[http://localhost:3000/admin](http://localhost:3000/admin) for the admin dashboard. Sign in with
the `SEED_ADMIN_EMAIL` / `SEED_ADMIN_PASSWORD` you set before seeding (defaults:
`admin@findit.local` / `ChangeMe123!` — **change these before using anything but a local
throwaway database**).

### Local database without Docker/Postgres installed

If you don't have Postgres running locally, Prisma can run one for you (a real Postgres engine
compiled to WASM, no Docker required):

```bash
npx prisma dev -d --db-port 51214
```

It prints a `postgres://...` connection string — copy the `TCP` one into `DATABASE_URL` in `.env`.
This is a local dev convenience only; point `DATABASE_URL` at a real Postgres instance (system
install, Docker, Neon, Supabase, RDS, etc.) for anything beyond local development.

## Database

This project uses Prisma 7 with the PostgreSQL driver adapter (`@prisma/adapter-pg`).

```bash
npm run db:generate   # regenerate the Prisma client after schema changes
npm run db:migrate    # create/apply a migration against DATABASE_URL
npm run db:seed       # (re-)run prisma/seed.ts — safe to re-run, upserts by natural key
npm run db:studio     # open Prisma Studio
```

The Prisma client is generated into `src/generated/prisma` (gitignored) and consumed via the
singleton in `src/lib/prisma.ts`, capped at a small connection pool size (see comments there) to
stay within typical managed-Postgres connection limits.

## Admin auth & authorization

- `src/lib/password.ts` — password hashing via Node's built-in `crypto.scrypt` (no external
  dependency).
- `src/lib/session.ts` — signs/verifies a JWT session token (`jose`); has no dependency on
  `next/headers`, so it's safe to use from `src/proxy.ts`.
- `src/lib/auth.ts` — cookie-aware wrappers (`createAdminSession`, `getAdminSession`,
  `requireAdminSession`, `requireAdminRole`) for use in Server Actions/Components.
- `src/proxy.ts` — redirects unauthenticated requests to `/admin/*` (except `/admin/login`) to the
  login page. Every mutating Server Action *also* calls `requireAdminSession()` itself — Proxy
  alone is not relied on for authorization, per Next.js's own guidance.
- Roles: `ADMIN` and `EDITOR` (see `AdminRole` in `prisma/schema.prisma`); `requireAdminRole()` is
  available for actions that should be `ADMIN`-only (not yet applied anywhere — all current admin
  actions accept either role).

## Scripts

| Script             | Purpose                              |
| ------------------- | ------------------------------------- |
| `npm run dev`       | Start the dev server                  |
| `npm run build`     | Production build                      |
| `npm run start`     | Run the production build              |
| `npm run lint`      | ESLint                                |
| `npm run typecheck` | `tsc --noEmit`                        |
| `npm run db:*`      | Prisma generate/migrate/seed/studio   |

## Project structure

```
src/
  app/
    (public)/            # homepage, /products, /categories, /disclosure — public layout
    admin/
      login/             # public login page (outside the protected shell)
      (dashboard)/        # everything else under /admin — sidebar + topbar layout, session-gated
    api/                 # reserved for future route handlers (events, cron, imports)
  components/
    ui/                  # shadcn/ui primitives
    public/               # public site components (nav, cards, CTA, disclosure banner…)
    admin/                # admin shell + form components (sidebar, topbar, forms, delete dialog…)
  lib/                   # env validation, Prisma client, auth/session/password, formatting
  server/
    actions/             # "use server" Server Actions (auth, category, product)
    services/            # Prisma-backed business logic (catalog, category, product, audit)
    validations/         # Zod schemas for admin forms
  types/                 # shared public-facing domain types
prisma/
  schema.prisma          # catalog + admin + audit models
  seed.ts                # local dev seed data (idempotent upserts)
```

## Environment variables

See `.env.example`. All environment variable access should go through `src/lib/env.ts` rather
than reading `process.env` directly, so missing/invalid config fails fast with a clear message.
