# Conbun CRM

Customer-relationship web application + backend/API for Conbun Call. See
[`CRM_ARCHITECTURE.md`](./CRM_ARCHITECTURE.md) for the full architecture and
[`CLAUDE.md`](./CLAUDE.md) for the working rules governing this repo.

**Status: Phase 1 (project scaffold).** No customer data model, no
authentication, no CRM UI exist yet. This is intentionally just a running,
deployable Next.js shell with Prisma wired up but no business tables. See
`CHANGELOG.md` for what's actually been built so far.

This is **not** the Android app. The existing Conbun Call Android app
(`ConbunCall_V4`) is a separate, unmodified project — see `CLAUDE.md` §1.

## Stack

- **Frontend:** Next.js 16 (App Router) + React + TypeScript
- **Backend:** Next.js Route Handlers (`app/api/*`), same repo as the
  frontend for V1 (service logic kept in `lib/`, not inlined in route
  handlers, so it can be extracted into a standalone service later)
- **Database:** PostgreSQL, hosted on [Neon](https://neon.tech)
- **ORM:** [Prisma](https://www.prisma.io) 7, with the
  [`@prisma/adapter-neon`](https://www.npmjs.com/package/@prisma/adapter-neon)
  driver adapter (Prisma 7 requires an explicit adapter; the Neon adapter
  talks over HTTP/WebSocket rather than a long-lived TCP connection, which
  fits Vercel's serverless functions much better than a traditional
  connection-pooled driver)
- **Deployment:** GitHub → Vercel

## Project structure

```
app/
  page.tsx          -- placeholder home page (Phase 1 status only, not CRM UI)
  layout.tsx
  api/
    health/route.ts  -- GET /api/health liveness check, no DB dependency
lib/
  db/
    prisma.ts         -- shared Prisma client singleton (not imported anywhere yet)
  generated/
    prisma/            -- Prisma Client output, gitignored, regenerate with `npm run db:generate`
prisma/
  schema.prisma        -- datasource + generator only, no models yet (Phase 2+)
prisma.config.ts        -- Prisma CLI config (schema path, migrations path, DATABASE_URL)
```

`app/` is scoped to routes/pages (frontend pages + API route handlers) only.
`lib/` holds shared backend logic (starting with the DB client). This
boundary is deliberate -- see `CRM_ARCHITECTURE.md` §3-4 -- so the backend
can be extracted into its own service later without restructuring.

## Running locally

```bash
npm install
npm run dev       # http://localhost:3000
```

Verified working as of the Phase 1 scaffold: `npm run build` (production
build) and `npm run dev` both succeed; `GET /` and `GET /api/health` both
respond. See `CHANGELOG.md` for the exact verification record.

## Environment variables

Convention: `.env.example` is the committed template (placeholder values
only); copy it to `.env` for real local values, which is gitignored and
must never be committed. In deployment, the same variables are set in
Vercel's project Environment Variables (scoped per environment), never
hardcoded.

| Variable | Used by | Status |
|---|---|---|
| `DATABASE_URL` | Prisma CLI (`prisma.config.ts`) and `lib/db/prisma.ts` at runtime | Placeholder only -- no Neon project has been provisioned yet (nothing to connect to in Phase 1). Real value needed starting Phase 2. |

More variables (e.g. a JWT signing secret for auth) will be added to both
this table and `.env.example` when the code that needs them is introduced
(Phase 3) -- not added speculatively ahead of that.

## Database / Prisma

No tables exist yet (`prisma/schema.prisma` has a datasource + generator
block only, no models -- intentional, see `CRM_ARCHITECTURE.md` §15 Phase
1/2). What *is* already wired up and verified:

```bash
npm run db:generate   # prisma generate -- regenerates lib/generated/prisma
npm run db:migrate     # prisma migrate dev -- not usable yet, no DATABASE_URL / no models
```

`npm run db:generate` succeeds today even with zero models. `db:migrate`
needs a real Neon connection string and at least one model before it does
anything meaningful -- that's Phase 2.

## Deployment

GitHub → Vercel, same build for frontend and API routes (Next.js). Database
migrations are run explicitly (`prisma migrate deploy`), not automatically
on every deploy. See `CRM_ARCHITECTURE.md` §10 for the full deployment
architecture. Not yet pushed to GitHub or connected to a Vercel project as
of Phase 1 -- see `CHANGELOG.md` for what's outstanding.
