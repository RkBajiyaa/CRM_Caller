# Conbun CRM

Customer-relationship web application + backend/API for Conbun Call. See
[`CRM_ARCHITECTURE.md`](./CRM_ARCHITECTURE.md) for the full architecture and
[`CLAUDE.md`](./CLAUDE.md) for the working rules governing this repo.

**Status: Phase 2 (database foundation + first CRM UI).** A real `Customer`
table is designed and migration-ready (not yet applied -- no live database
connection configured, see below). The Customers list, Add New User form,
and Customer Detail pages are built and working, backed by clearly-labeled
in-memory seed data everywhere the real database/call pipeline doesn't
exist yet. See `CHANGELOG.md` for the exact, tested record.

This is **not** the Android app. The existing Conbun Call Android app
(`ConbunCall_V4`) is a separate, unmodified project — see `CLAUDE.md` §1.

## Stack

- **Frontend:** Next.js 16 (App Router) + React + TypeScript, plain CSS
  Modules (no UI framework -- see `CRM_ARCHITECTURE.md` §2)
- **Backend:** Next.js Route Handlers (`app/api/*`), same repo as the
  frontend for V1 (service logic kept in `lib/`, not inlined in route
  handlers, so it can be extracted into a standalone service later)
- **Validation:** [Zod](https://zod.dev) at the API boundary
- **Database:** PostgreSQL, hosted on [Neon](https://neon.tech) --
  schema designed, **not yet connected** (see "Database / Prisma" below)
- **ORM:** [Prisma](https://www.prisma.io) 7, with the
  [`@prisma/adapter-neon`](https://www.npmjs.com/package/@prisma/adapter-neon)
  driver adapter
- **Deployment:** GitHub → Vercel (not yet pushed/connected -- see
  `CHANGELOG.md`)

## Project structure

```
app/
  page.tsx                    -- redirects to /customers
  layout.tsx                  -- sidebar + content shell
  customers/
    page.tsx                   -- CRM Users page (Server Component)
    new/page.tsx                -- Add New User
    [id]/page.tsx                 -- Customer Detail
  api/
    health/route.ts             -- GET /api/health, no DB dependency
    customers/route.ts           -- GET (list), POST (create)
    customers/[id]/route.ts       -- GET (one), PATCH (update)
components/
  ui/                            -- generic primitives (Button, Field, Card, Badge)
  crm/                            -- CRM-specific (Sidebar, CustomersExplorer, CallHistoryTable, ...)
lib/
  customers/
    types.ts                      -- shared Customer shape (API + UI)
    validation.ts                  -- zod schemas, shared by API + form
    service.ts                      -- the ONE swap point: mock store today, Prisma later
    mock-store.ts                    -- in-memory seed data, see file header
  mock-data/calls.ts                -- mock call history/stats, no DB table yet
  api-client/customers.ts            -- browser-side fetch wrappers for Client Components
  db/prisma.ts                        -- Prisma client singleton (not queried yet -- no live DB)
  generated/prisma/                    -- Prisma Client output, gitignored
prisma/
  schema.prisma                        -- Customer model + CustomerStatus enum
  migrations/..._init_customers/        -- first migration, generated offline, NOT applied
prisma.config.ts
```

`app/` is scoped to routes/pages only. `lib/` holds shared logic (data
access, validation, formatting). Server Components (`customers/page.tsx`,
`customers/[id]/page.tsx`) call `lib/customers/service.ts` directly; Client
Components (the Add New User form) call the `/api/*` routes via
`lib/api-client/`. This boundary is deliberate -- see `CRM_ARCHITECTURE.md`
§3-4 -- so the backend can be extracted into its own service later without
restructuring, and so the mock data layer disappears by changing one file
(`lib/customers/service.ts`), not by touching any page or component.

## Running locally

```bash
npm install
npm run dev       # http://localhost:3000, redirects to /customers
```

Verified working (see `CHANGELOG.md` for the full record): `npm run lint`,
`npm run build`, `npm run dev`, and `npm run start` (production server) all
succeed; the Customers list, Add New User, and Customer Detail pages all
render real seeded data; `POST`/`PATCH /api/customers` were exercised live
with `curl` (create, validation errors, duplicate-phone conflict, update,
404s) -- not just reviewed.

**Known issue, verified and documented, not yet fixed:** `GET
/customers/{badId}` for a nonexistent customer correctly renders the "not
found" page but returns HTTP 200 instead of 404 -- a documented Next.js App
Router streaming characteristic (the initial response status is sent before
the async `notFound()` call resolves), not a data bug. The equivalent API
route (`GET /api/customers/{badId}`) returns a correct 404. Revisit if this
route ever needs to be crawled/indexed; not a problem for an internal tool.

## Environment variables

Convention: `.env.example` is the committed template (placeholder values
only); copy it to `.env` for real local values, which is gitignored and
must never be committed. In deployment, the same variables are set in
Vercel's project Environment Variables (scoped per environment), never
hardcoded.

| Variable | Used by | Status |
|---|---|---|
| `DATABASE_URL` | Prisma CLI (`prisma.config.ts`) and `lib/db/prisma.ts` at runtime | **Still a placeholder.** The Neon project exists (per the user) but no real connection string has been retrieved into this environment -- `npx neonctl init` could not complete browser authentication here. See "Database / Prisma" below for exactly what's needed. |

More variables (e.g. a JWT signing secret for auth) will be added to both
this table and `.env.example` when the code that needs them is introduced
(Phase 3) -- not added speculatively ahead of that.

## Database / Prisma

**Schema designed, migration generated, neither applied to a real database
yet** -- `DATABASE_URL` is still a placeholder (see above), so this is as
far as this could go without it, per explicit instruction to stop and
report rather than work around a missing credential.

- `prisma/schema.prisma` -- one model, `Customer` (+ `CustomerStatus`
  enum), matching `CRM_ARCHITECTURE.md` §6 field-for-field. `npx prisma
  validate` passes.
- `prisma/migrations/<timestamp>_init_customers/migration.sql` -- the
  initial migration SQL, generated **offline** via `prisma migrate diff
  --from-empty --to-schema prisma/schema.prisma --script` (this diff mode
  needs no live database connection, unlike `prisma migrate dev`). Reviewed
  by hand; not yet applied anywhere.
- `npm run db:generate` (`prisma generate`) succeeds today and produces a
  working, typed `Customer` client in `lib/generated/prisma` -- verified.
- `npm run db:migrate` (`prisma migrate dev`) has **not** been run and will
  fail until `DATABASE_URL` is real.

**To finish Phase A once a real Neon connection string is available:**
1. Put the real connection string in `.env` (`DATABASE_URL=...`).
2. `npx prisma migrate deploy` -- applies the already-generated migration
   above (does not try to compute a new diff, just runs the reviewed SQL).
3. `lib/customers/service.ts` gets a `prisma-store.ts` sibling implementing
   the same five functions against `prisma.customer.*`, swapped in for the
   current mock-store import -- no other file changes.

## Mock / seed data (explicit, not hidden)

Two layers of mock data exist right now, each labeled in its own file and
visible in the UI via a "Seed data" / "Sample call data" badge:

- **Customers** (`lib/customers/mock-store.ts`) -- stand in for the real
  `Customer` table above until a live database connection exists. In
  memory only, resets on server restart. Full CRUD (list/get/create/update)
  works against this store today, through the same `lib/customers/
  service.ts` interface the Prisma-backed version will use.
- **Call history / stats** (`lib/mock-data/calls.ts`) -- there is no calls
  table at all yet (deliberately -- see `CRM_ARCHITECTURE.md` §15 Phase 5).
  Purely illustrative data for the Customer Detail page's call-activity and
  call-history sections. AI summaries are hard-coded `null` everywhere and
  render as "Not available yet" -- no AI summary functionality was added.

## Deployment

GitHub → Vercel, same build for frontend and API routes (Next.js). Database
migrations are run explicitly (`prisma migrate deploy`), not automatically
on every deploy. See `CRM_ARCHITECTURE.md` §10 for the full deployment
architecture. **Not yet pushed to GitHub or connected to a Vercel project**
-- see `CHANGELOG.md` for what's outstanding.
