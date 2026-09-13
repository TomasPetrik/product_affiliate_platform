# FindIt — Affiliate Product Discovery Platform

A production-track Next.js app that curates products from marketplaces (Amazon, eBay, …) and
sends visitors to the marketplace to buy. This app does **not** process payments or sell products
itself. See `docs/architecture.md`-style discussion in the original planning conversation for the
full approved architecture — this README covers local setup for what's implemented so far.

## Status: Phase 1 (foundation)

Implemented: Next.js/TypeScript/Tailwind/shadcn scaffold, Prisma schema for the core catalog
(products, categories, marketplaces, affiliate links, admin users, audit log), public site shell
(homepage, listing, PDP, categories, disclosure), and the admin dashboard shell (sidebar, layout,
read-only catalog views, placeholders for future sections).

**Not implemented yet** (by design, later phases): admin authentication/authorization, real
database-backed CRUD (pages currently render from `src/lib/placeholder-data.ts`), Amazon/eBay
import, analytics event tracking, revenue reconciliation, audit log population.

## Getting started

```bash
npm install
cp .env.example .env   # then fill in a real DATABASE_URL
npm run dev
```

Open [http://localhost:3000](http://localhost:3000) for the public site and
[http://localhost:3000/admin](http://localhost:3000/admin) for the admin shell.

## Database

This project uses Prisma 7 with the PostgreSQL driver adapter (`@prisma/adapter-pg`).

```bash
npm run db:generate   # regenerate the Prisma client after schema changes
npm run db:migrate     # create/apply a migration against DATABASE_URL (needs a running Postgres)
npm run db:studio      # open Prisma Studio
```

The Prisma client is generated into `src/generated/prisma` (gitignored) and consumed via the
singleton in `src/lib/prisma.ts`. No page currently queries the database — see "Remaining work"
in the project notes.

## Scripts

| Script             | Purpose                              |
| ------------------- | ------------------------------------- |
| `npm run dev`       | Start the dev server                  |
| `npm run build`     | Production build                      |
| `npm run start`     | Run the production build              |
| `npm run lint`      | ESLint                                |
| `npm run typecheck` | `tsc --noEmit`                        |
| `npm run db:*`      | Prisma generate/migrate/studio        |

## Project structure

```
src/
  app/
    (public)/     # homepage, /products, /categories, /disclosure — public layout
    admin/        # /admin dashboard shell — separate layout, no route group needed
    api/          # reserved for future route handlers (events, cron, imports)
  components/
    ui/           # shadcn/ui primitives
    public/       # public site components (nav, cards, CTA, disclosure banner…)
    admin/        # admin shell components (sidebar, topbar, stat cards…)
  lib/            # env validation, Prisma client, formatting helpers, placeholder data
  server/         # reserved for Server Actions / services (Phase 2+)
  types/          # shared domain types
prisma/
  schema.prisma   # catalog + admin + audit models
```

## Environment variables

See `.env.example`. All environment variable access should go through `src/lib/env.ts` rather
than reading `process.env` directly, so missing/invalid config fails fast with a clear message.
