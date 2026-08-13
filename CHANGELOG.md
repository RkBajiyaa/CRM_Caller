# CHANGELOG.md — Conbun CRM Phase Development Record

Chronological record of work on the CRM phase of Conbun Call. Newest entries
at the bottom. Every entry follows this template:

```
## YYYY-MM-DD — <task/feature>
**Files created:**
**Files modified:**
**Files deleted:**
**Decisions made:**
**Tests/builds performed:**
**Actual results:**
**Incomplete / still requiring verification:**
```

> This changelog covers the **CRM planning/implementation phase only**. The
> underlying app's own development history (call log, recording,
> transcription, AI pipeline) is recorded separately in
> `ConbunCall_V4/CHANGELOG.md` and is not duplicated here.

---

## 2026-08-08 — CRM phase kickoff: architecture inspection and planning

**Files created:**
- `CLAUDE.md` (this folder) — standing rules for the CRM phase.
- `CHANGELOG.md` (this folder) — this file.
- `CRM_ARCHITECTURE.md` (this folder) — full architecture plan: customer
  data model, repository responsibilities, API contract, call/recording/
  transcript/AI-summary linkage design, Add New User flow, and phased
  implementation plan.

**Files modified:**
- None. No application source code was touched. `ConbunCall_V4` (the real
  app) was read-only inspected, not modified.

**Files deleted:**
- None.

**Decisions made:**
- **Project location clarified:** this folder (`Conbun CRM `) was found
  empty at session start; the actual Conbun Call app lives at
  `/home/rkbajiyaa/Project/ConbunCall_V4`. User confirmed this folder
  should be used as the dedicated CRM planning/documentation workspace.
  Working assumption (flagged as open, see `CRM_ARCHITECTURE.md`): actual
  CRM code, once approved, will be implemented inside `ConbunCall_V4`
  itself, reusing its existing architecture — not built as a separate
  app/module in this folder.
- **CRM customer identity model established:** `customerId` is a stable,
  system-generated identifier, never the phone number and never manually
  entered. Phone number is a lookup/matching key only.
- **Two agent concepts kept distinct:** `assignedAgent` (customer profile,
  who currently owns the relationship) vs. the actual calling agent on an
  individual call record. Not to be merged.
- **Two date concepts kept distinct:** `accountCreatedAt` (application/
  account creation) vs. `crmEntryCreatedAt` (when the customer was first
  created in the CRM — explicitly not "last login").
- **Existing `CallMetadata.customerId` / `customerName` fields** (currently
  unused, reserved) identified as the intended future integration point
  linking a call to a CRM customer — planned to be populated in a later
  phase, not modified now.
- **Existing `data/crm/` package** (login, get-next-lead, start/finish call,
  metadata/transcript/summary upload — architecture-only, not wired to any
  UI) identified as a *related but distinct* concern: it models this device
  syncing to/from an external lead-assignment/auto-dialer backend, not the
  in-app customer database being planned now. Decision: keep them as
  separate layers for now, reconcile later around a shared `customerId`
  once a real backend exists — not merged in this phase.
- **Reuse-first architecture chosen:** new CRM persistence will follow the
  existing DataStore-Preferences + JSON-blob pattern
  (`CallMetadataRepository`, `RecordingIndexStore`, `SettingsRepository`),
  the existing manual `AppContainer` DI pattern, the existing Retrofit/
  OkHttp client-factory + `NetworkResult` pattern (`CrmApiClient`/
  `CrmRepository`), and the existing WorkManager scheduler pattern
  (`TranscriptionWorkScheduler`/`CrmSyncScheduler`) for any future sync
  worker — no new dependencies proposed for Phase 1.
- **ID-generation convention identified for reuse:** `SettingsRepository.
  ensureDeviceIdGenerated()` already generates a stable local ID
  (`CONBUN-<8 hex chars>` via `UUID`) the first time one is needed. The
  same convention is proposed for locally-generated `customerId`s until a
  real backend exists to issue them server-side.
- Full architecture plan, data model, API contract, repository
  responsibilities, and 5-phase implementation plan written up in
  `CRM_ARCHITECTURE.md`. **No implementation code written this session —
  planning/documentation only, per explicit instruction.**

**Tests/builds performed:**
- None (documentation-only session). Inspection method: read
  `ConbunCall_V4/CLAUDE.md`, `ConbunCall_V4/CHANGELOG.md`,
  `ConbunCall_V4/README.md`, `app/build.gradle.kts`,
  `AndroidManifest.xml`, and the full source tree under
  `app/src/main/java/com/conbun/call/` (`di/`, `data/model/`,
  `data/repository/`, `data/crm/`, `data/api/`, `navigation/`) to source
  this plan accurately from the real codebase rather than guessing.

**Actual results:**
- `CLAUDE.md`, `CHANGELOG.md`, and `CRM_ARCHITECTURE.md` created in this
  folder. No other files changed anywhere.

**Incomplete / still requiring verification:**
- Open decision on physical code location for implementation (this folder
  vs. `ConbunCall_V4`) not yet confirmed by the user — see
  `CRM_ARCHITECTURE.md` §Open Decisions.
- Customer `status` vocabulary undefined (needs a product decision).
- Navigation placement of the new CRM screens (new bottom-nav tab vs. entry
  point elsewhere) undefined.
- Everything in `CRM_ARCHITECTURE.md` is a proposal awaiting approval —
  Phase 1 implementation has not started.

---

## 2026-08-08 — Architecture correction: CRM is an independent web app + backend, not part of the Android app

**Correction to the prior entry above:** the 2026-08-08 kickoff entry's
working assumption — "CRM code, once approved, will be implemented inside
`ConbunCall_V4`" — was **incorrect** and is superseded by this entry. Not
edited in place, per the project's own append-only changelog rule; flagged
here instead.

**Files created:**
- None.

**Files modified:**
- `CLAUDE.md` (this folder) — rewritten to describe the corrected
  architecture: this folder is an independent CRM **web application +
  backend/API** project (to be pushed to GitHub, deployed via Vercel),
  communicating with a central Postgres database and, eventually, with the
  Android app — all over HTTPS APIs, never via direct database access from
  either client.
- `CRM_ARCHITECTURE.md` (this folder) — rewritten from an "Android CRM
  screens" proposal to a web-app + backend/API + Postgres architecture:
  frontend architecture, backend/API architecture, database architecture,
  customer data model, call/customer relationship, authentication (Android
  <-> CRM <-> backend), API contract, deployment (GitHub + Vercel +
  managed Postgres), Android integration point (reference only, not
  modified), and revised implementation phases.

**Files deleted:**
- None.

**Decisions made:**
- **Three-project boundary locked in:**
  1. `ConbunCall_V4` — existing Android app, unchanged, agent-side only.
  2. This folder (`Conbun CRM `) — independent CRM web app + backend/API,
     own GitHub repo, deployed on Vercel.
  3. A central backend/API + Postgres database, owned by this project,
     which both the CRM web app and (eventually) the Android app talk to
     over HTTPS — neither client touches the database directly.
- **`ConbunCall_V4` is reference-only for this project.** It is inspected
  to understand what its existing (currently unwired) `data/crm/`
  scaffolding already expects from a backend (Bearer-token auth, DTO
  shapes for leads/call-start/call-finish/metadata-upload), so this
  project's API contract can be designed compatibly — but no Android
  source file is modified as part of this correction or any CRM work
  unless a separate, explicitly-scoped Android-integration task is
  approved later.
- **`customerId` and `crmEntryCreatedAt` generation moves to the
  backend/database**, not the Android app's local DataStore as previously
  proposed. Android local storage remains valid for on-device
  caching/offline operation only, never as the permanent CRM record.
- Full revised architecture — technology stack, frontend, backend/API,
  database, data model, auth, API contract, deployment, phases — written
  up in the rewritten `CRM_ARCHITECTURE.md`. **No implementation code
  written this session — planning/documentation only.**

**Tests/builds performed:**
- None (documentation-only session).

**Actual results:**
- `CLAUDE.md` and `CRM_ARCHITECTURE.md` rewritten in this folder; this
  changelog entry added. No other files changed anywhere. `ConbunCall_V4`
  not modified.

**Incomplete / still requiring verification:**
- Managed Postgres provider not yet chosen (see `CRM_ARCHITECTURE.md`
  §Open Decisions).
- ORM/query-layer choice not yet confirmed.
- Whether the backend/API lives in the same codebase as the frontend
  (single Next.js project on Vercel) or as a separate service is proposed
  but not yet confirmed.
- Customer `status` vocabulary still undefined.
- Everything in the rewritten `CRM_ARCHITECTURE.md` is a proposal awaiting
  approval — no implementation has started.

---

## 2026-08-08 — Phase 1: project scaffold (Next.js + Prisma config, no business tables, no UI)

Locks the open decisions from the prior entry per explicit user direction,
then implements Phase 1 only (`CRM_ARCHITECTURE.md` §15): repo scaffold,
frontend/backend folder boundaries, env-var conventions, Prisma config with
no models, basic docs, local run verified, build verified. **No customer
tables, no CRM UI, no auth, no Android changes.**

**Decisions locked (superseding the "open decisions" in the prior entry):**
- Frontend: Next.js (App Router) + TypeScript.
- Backend: Next.js Route Handlers, same repo, for V1; service logic to live
  in `lib/` (kept out of route handlers) so it can be extracted later.
- Database: PostgreSQL.
- Postgres provider: **Neon**.
- ORM: **Prisma** (7.9.1, current stable `latest` on npm as of this
  session — not a prerelease).
- Auth: backend-issued JWT, isolated auth module, shared by CRM web and
  Android (not implemented yet — Phase 3).
- Phone numbers: one per customer for V1; data model must not foreclose
  multiple numbers later (see `CRM_ARCHITECTURE.md` §6 note).
- Agent model: `assignedAgent`/`callingAgent` stay separate; `assignedAgent`
  free text for V1, no agent directory yet.
- Customer status vocabulary: `ACTIVE`, `INACTIVE`, `FOLLOW_UP`, `CLOSED`
  (kept extensible, not hardcoded into query logic anywhere yet since no
  `status` field exists in a table yet).
- Dates: `accountCreatedAt` / `crmEntryCreatedAt` stay separate fields.
- Project separation: this repo only; `ConbunCall_V4` untouched.
- Deployment: GitHub → Vercel, Neon → Postgres, secrets via env vars only.
- No fake/mock data presented as production data; seed data (when it
  exists, Phase 2+) must be clearly labeled as development data.
- `CRM_ARCHITECTURE.md` §2, §14 updated in place to reflect these as locked
  rather than open.

**Files created:**
- Next.js app scaffold (via `create-next-app`, App Router, TypeScript,
  ESLint, no Tailwind — not needed yet, no styling decisions made):
  `app/layout.tsx`, `app/page.tsx`, `app/globals.css`, `app/favicon.ico`,
  `next.config.ts`, `next-env.d.ts`, `tsconfig.json`, `eslint.config.mjs`,
  `package.json`, `package-lock.json`.
- `app/api/health/route.ts` — `GET /api/health` liveness endpoint,
  deliberately has no database dependency, establishes the `app/api/*`
  backend boundary.
- `prisma/schema.prisma` — datasource (`postgresql`) + generator only, **no
  models**, per explicit instruction not to create business tables yet.
- `prisma.config.ts` — Prisma CLI config (schema path, migrations path,
  `DATABASE_URL` from env via `dotenv/config`) — generated by `prisma init`,
  reviewed, kept as-is.
- `lib/db/prisma.ts` — shared Prisma Client singleton using the
  `@prisma/adapter-neon` driver adapter (see Decisions below). Not imported
  by any route yet; establishes the access point for Phase 2+.
- `.env.example` — committed template documenting `DATABASE_URL` (Neon
  connection-string shape, placeholder value) and a note that auth-related
  vars will be added when Phase 3 introduces them.
- `.env` — local file (gitignored), same placeholder `DATABASE_URL` as
  `.env.example`, clearly commented as a placeholder — **no real Neon
  database has been provisioned; this project has no live database
  connection yet.**
- `README.md` — project-level onboarding doc: stack, folder structure,
  running locally, env-var conventions, Prisma status, deployment notes.
- Git repository initialized locally (`git init`, initial commit staged).
  **Not pushed to any GitHub remote** — no remote configured, nothing
  published anywhere.

**Files modified:**
- `.gitignore` — added `!.env.example` exception (so the template is
  trackable while `.env*` stays ignored), added `/lib/generated/prisma`
  (Prisma-generated client, not authored code), added
  `.claude/settings.local.json` (machine-local Claude Code permissions
  cache, not project config).
- `CLAUDE.md` — added §6 (verified build/run commands) and §7 (explains the
  Next.js-managed `<!-- BEGIN:nextjs-agent-rules -->` block that `next dev`
  itself appended to the bottom of this file on first local run — see
  Bugs/quirks below).
- `CRM_ARCHITECTURE.md` — §2 stack table and §14 open-decisions list
  updated to show the now-locked decisions instead of open questions; ORM
  row updated to name the Neon driver-adapter requirement discovered during
  this pass.

**Files deleted:**
- None from the final state. (Along the way: an initial `prisma init` run
  without `--no-skills` scaffolded unrequested `.claude/skills/`,
  `.agents/skills/`, `.windsurf/skills/`, and `skills-lock.json` — Prisma
  7's new "agent skills" auto-install feature. Recognized as unrequested
  surface area beyond this task's scope (and writing into our own
  `.claude/` directory specifically), deleted, and `prisma init` re-run
  with `--no-skills`.)

**Decisions made (implementation-level, within the locked architecture):**
- **Prisma 7 requires an explicit driver adapter** — `new PrismaClient()`
  with zero arguments is a compile error in this version; the old
  implicit-engine connection model is gone. Added `@prisma/adapter-neon` +
  `@neondatabase/serverless` (both new dependencies, justified: Prisma 7
  cannot connect to Postgres at all without *some* adapter, and the Neon
  adapter specifically fits the Vercel-serverless deployment target better
  than the generic `@prisma/adapter-pg` would — see `CRM_ARCHITECTURE.md`
  §2 ORM row).
- Prisma Client is generated into `lib/generated/prisma` (not the
  `app/generated/prisma` default, not `node_modules`), to keep `app/`
  scoped to routes/pages only, matching the folder boundary in
  `CRM_ARCHITECTURE.md` §3-4. Gitignored — regenerated via
  `npm run db:generate`.
- `.env` used (not `.env.local`) as the single local-secrets file, since
  Prisma's CLI (`prisma.config.ts`) loads `.env` via `dotenv/config` and
  Next.js loads it too — one file for both tools instead of two different
  conventions.
- Removed the default `create-next-app` marketing template (Next.js/Vercel
  logos, template copy, unused SVGs) from `app/page.tsx` and `public/`;
  replaced with a one-paragraph placeholder status page. Not CRM UI —
  states plainly that no CRM UI exists yet and links to
  `CRM_ARCHITECTURE.md`.
- Added `"engines": { "node": ">=20" }` to `package.json` for
  reproducibility; **flag:** `npm install` warns that the optional
  `@prisma/streams-local` package wants Node ≥22 — not something this
  project uses, so left as a non-blocking warning rather than bumping the
  minimum Node version speculatively. Revisit if it ever becomes a real
  build error rather than a warning.
- Did **not** initialize with Tailwind or any UI/component library — no
  styling decisions have been made and Phase 1 has no UI to style
  (`CRM_ARCHITECTURE.md` §2 already lists this as deferred).

**Configuration/dependency changes:**
- Added: `next`, `react`, `react-dom` (App scaffold); `typescript`,
  `eslint`, `eslint-config-next`, `@types/node`, `@types/react`,
  `@types/react-dom` (dev, scaffold defaults); `prisma`, `dotenv` (dev);
  `@prisma/client`, `@prisma/adapter-neon`, `@neondatabase/serverless`
  (runtime). No other dependencies added.

**Bugs / quirks found (not app bugs — tooling behavior worth recording):**
- `prisma init` without `--no-skills` writes agent-skill docs into
  `.claude/`, `.agents/`, `.windsurf/` unprompted — avoid on any future
  re-init; always pass `--no-skills`.
- `next dev` (Next.js 16), on first run in a repo with a `CLAUDE.md` but no
  `AGENTS.md`, appends its own `<!-- BEGIN:nextjs-agent-rules -->` block to
  the bottom of `CLAUDE.md` automatically. Confirmed non-destructive
  (append-only, clearly marked, matches Next.js's own documented behavior).
  Left in place; explained in `CLAUDE.md` §7 so it isn't mistaken for a
  manual edit or a project rule.
- Prisma-generated client has no root `index.ts` — import from
  `.../prisma/client`, not the bare output folder path.

**Tests/builds performed (all actually run, not manual review):**
- `npx prisma validate` — schema valid (zero models).
- `npm run db:generate` (`prisma generate`) — succeeded, generated client
  to `lib/generated/prisma`.
- `npm run build` (`next build`, production build) — **succeeded**,
  compiled + type-checked clean, both routes (`/`, `/api/health`) built
  (`/` static, `/api/health` dynamic/server-rendered).
- `npm run lint` (ESLint) — **clean, zero errors/warnings.**
- `npm run dev` — started successfully (`Ready in 1010ms`); confirmed
  `GET /` returns HTTP 200 and `GET /api/health` returns
  `{"status":"ok","service":"conbun-crm-backend","timestamp":"..."}` via
  live `curl` requests against `localhost:3000`; server stopped afterward
  (`pkill -f "next dev"`, confirmed nothing left listening on port 3000).
- `npm run db:migrate` (`prisma migrate dev`) — **not run.** No real
  `DATABASE_URL` and no models exist yet; correctly out of scope for
  Phase 1.

**Actual results:**
- The project installs, builds, lints clean, and runs locally, serving both
  a placeholder page and a working health-check API route — verified by
  actually running each command and, for the dev server, actually curling
  the running server, not by static/manual review.
- Deployment-readiness: `next build` (what Vercel runs) succeeds locally.
  **Not yet actually deployed** — no GitHub remote configured, no Vercel
  project connected, no Neon database provisioned. Those are the concrete
  next actions, not done in this pass (scope was local scaffold only).

**Incomplete / still requiring verification:**
- **No GitHub remote configured, nothing pushed.** This repo exists only
  locally (`git init` + local commit).
- **No Vercel project created/connected.**
- **No Neon project/database provisioned.** `DATABASE_URL` is a placeholder
  in both `.env` and `.env.example`; `prisma migrate dev` has not been run
  and cannot succeed until a real connection string exists.
- No models/tables exist yet — correct for Phase 1, but means Phase 2 has
  nothing to build on except this scaffold.
- No auth, no customer data model, no CRM UI — all explicitly out of scope
  for Phase 1, per instruction.
- Node engine mismatch warning (`@prisma/streams-local` wants Node ≥22,
  this environment has 20.20.2) noted above — not blocking, not yet
  resolved either way.

---

## 2026-08-08 — Phase 1 clean final verification (no code changes needed)

Requested re-verification of everything from the Phase 1 scaffold pass,
from a fully clean state rather than trusting prior in-memory results.
**Result: everything already passed cleanly; no fixes were required.**

**Files created:**
- None.

**Files modified:**
- None. No issues were found that required a change.

**Files deleted:**
- None (temporary local build artifacts regenerated during verification —
  `node_modules/`, `.next/`, `lib/generated/` — were already gitignored and
  not part of the commit either before or after).

**Verification performed (each item below actually run, not reviewed by
eye):**

1. **`package.json` duplicate/conflicting entries** — parsed with `python3
   json.loads`; confirmed a single occurrence of each top-level key, zero
   overlap between `dependencies` and `devDependencies`. `npm ci` (strict
   lockfile-vs-manifest install, fails on mismatch) succeeded, which is a
   stronger check than `npm install` alone. **Clean.**
2. **`app/layout.tsx` valid, no duplicate JSX** — read in full: single
   `<html>`/`<body>`, no duplication. Compiles clean under `next build`'s
   TypeScript pass. **Clean.**
3. **`app/page.tsx` valid** — read in full: single `<main>`, no
   duplication, compiles clean. **Clean.**
4. **`GET /api/health`** — verified live twice: once against `next start`
   (the actual production server build, not just `next dev`) after a fully
   clean `rm -rf node_modules .next lib/generated && npm ci` — returned
   `{"status":"ok","service":"conbun-crm-backend","timestamp":"..."}` via
   real `curl` against `localhost:3000`. **Clean.**
5. **Prisma configuration valid** — `npx prisma validate` →
   `The schema at prisma/schema.prisma is valid`. **Clean.**
6. **Prisma client generation succeeds** — `npm run db:generate` →
   `Generated Prisma Client (7.9.1) to ./lib/generated/prisma`, from a
   clean state (directory deleted first). **Clean.**
7. **Environment files correctly configured** — `.env` (gitignored,
   placeholder `DATABASE_URL`) and `.env.example` (committed, same
   placeholder shape, documented) both read back and confirmed consistent;
   `.gitignore` confirmed to exclude `.env*` while explicitly re-including
   `.env.example`. **Clean.**
8. **No real secrets committed** — `git ls-files` confirmed `.env` is not
   tracked (only `.env.example` is); `git grep` across all tracked files
   for `DATABASE_URL=` found no occurrence outside the documented
   placeholder files. **Clean.**
9. **`npm run lint`** — clean, zero errors/warnings, run fresh after a
   clean reinstall. **Clean.**
10. **`npm run build`** — clean production build from a fully clean
    `node_modules`/`.next`, compiled + type-checked with no errors, both
    routes built (`/` static, `/api/health` dynamic). **Clean.**

**Incidental finding, not a bug:** grepping `CLAUDE.md` for the Next.js
agent-rules marker initially returned 2 matches; inspected and confirmed
one is the literal marker text quoted inside this project's own §7
explanation of the block, and the other is the single real managed block
at the end of the file — **not a duplicate block.** No action needed.

**Tests/builds performed:**
- `rm -rf node_modules .next lib/generated`
- `npm ci` — clean install from lockfile, succeeded
- `npx prisma validate` — passed
- `npm run db:generate` — passed
- `npm run lint` — passed, clean
- `npm run build` — passed, clean
- `npm run start` (production server, not dev) — started; `GET /` → HTTP
  200; `GET /api/health` → valid JSON; server stopped afterward and port
  3000 confirmed free (had to `kill` the `next-server` PID directly the
  first time, since `pkill -f "next start"` doesn't match the actual
  `next-server (v16.3.0)` process name — noted for future sessions stopping
  a `next start` server in this repo).

**Actual results:**
- All 10 requested verification items pass with zero issues found. No code
  changes were made this pass because none were needed.

**Incomplete / still requiring verification:**
- Unchanged from the prior entry: no Neon database provisioned, no GitHub
  remote, no Vercel project, no models/tables, no auth, no CRM UI. All
  correctly out of scope for Phase 1.
- Phase 1 is now verification-complete. Awaiting approval before Phase 2.

---

## 2026-08-08 — Phase A (database foundation, blocked on missing credential) + Phase B (first real CRM UI + minimal customers API)

User authorized moving fast: lock remaining open decisions, stop writing
architecture-only docs, and build the real Customer schema/migration plus a
working CRM UI immediately. This entry covers both.

### Phase A — Database foundation

**DATABASE_URL was checked first, per explicit instruction, without ever
printing its value.** Result: still the Phase 1 placeholder (`.env` and
`.env.example` both contain `postgresql://<user>:<password>@<neon-
project>.neon.tech/<database>?sslmode=require`, unchanged). The user's Neon
*project* exists, but `npx neonctl init` timed out during browser auth in
this environment and no real connection string was retrieved. Per explicit
instruction, this is reported rather than worked around -- **no live
database connection exists, and none of the DB-connection-requiring steps
below were attempted.**

**What was done anyway (does not require a live connection):**

**Files created:**
- `prisma/migrations/20260808131939_init_customers/migration.sql` -- the
  initial migration SQL. Generated **offline** with `npx prisma migrate
  diff --from-empty --to-schema prisma/schema.prisma --script`, which
  (unlike `prisma migrate dev`) computes its diff from the schema file
  alone and needs no database connection. Reviewed by hand: creates the
  `CustomerStatus` enum and `customers` table exactly matching the schema
  below. **Not applied to any database.**
- `prisma/migrations/migration_lock.toml` -- `provider = "postgresql"`,
  matching Prisma's own convention for this file.

**Files modified:**
- `prisma/schema.prisma` -- added the first business model:
  ```
  enum CustomerStatus { ACTIVE INACTIVE FOLLOW_UP CLOSED }
  model Customer {
    id                String   @id @default(uuid()) @map("customer_id")
    name              String
    phoneNumber       String   @unique @map("phone_number")
    location          String?
    assignedAgent     String?  @map("assigned_agent")
    accountCreatedAt  DateTime? @map("account_created_at")
    crmEntryCreatedAt DateTime @default(now()) @map("crm_entry_created_at")
    status            CustomerStatus @default(ACTIVE)
    notes             String?
    createdAt         DateTime @default(now()) @map("created_at")
    updatedAt         DateTime @updatedAt @map("updated_at")
    @@map("customers")
  }
  ```
  Matches `CRM_ARCHITECTURE.md` §6 field-for-field. `phoneNumber` is
  `@unique` (locks in "one phone number per customer for V1" at the schema
  level) with a comment explaining how a future multi-number model would
  be added additively instead of replacing this column. `id` is
  backend-generated (`@default(uuid())`), never client-supplied.
  **Caught and fixed during authoring, before validating:** first draft
  had `createdAt`/`updatedAt`'s `@default(now())`/`@updatedAt` attributes
  and `@map()` targets accidentally swapped; corrected before running
  anything.
- `.env`, `.env.example` -- comments updated to reflect Phase 2 status and
  the exact next steps once a real connection string exists (`prisma
  migrate deploy` to apply the already-generated migration above, not
  `migrate dev`, since the diff is already computed and reviewed).

**Database/schema changes:**
- None applied. Designed and validated only (see Tests/builds below).

**Tests/builds performed:**
- `npx prisma validate` -- passed, with the new model.
- `npm run db:generate` -- passed, produced a typed `Customer` client.
- `npx prisma migrate diff --from-empty --to-schema ... --script` -- ran
  successfully offline, output reviewed by hand.
- `prisma migrate dev` / `prisma migrate deploy` / any connection-verifying
  command -- **NOT run.** Needs a real `DATABASE_URL`.

**Incomplete / still requiring the user:**
- **The single missing piece: `DATABASE_URL` in `.env` needs a real Neon
  connection string.** Get it from the Neon project dashboard (Connection
  Details -> "Prisma" or "pooled connection" string) and paste it directly
  into `.env` (not into chat/this conversation). Once set: `npx prisma
  migrate deploy` applies the migration already sitting in
  `prisma/migrations/`; no further schema work is needed for it to apply
  cleanly.
- `lib/customers/service.ts` still points at the mock store (Phase B,
  below) -- swapping it to Prisma-backed queries is the next step after
  the migration is applied, not done automatically by applying it.

### Phase B — First real CRM UI + minimal customers API

**Files created (data/domain layer):**
- `lib/customers/types.ts` -- shared `Customer`/`CreateCustomerInput`/
  `UpdateCustomerInput` shapes, used by both API routes and UI.
- `lib/customers/validation.ts` -- Zod schemas (`createCustomerSchema`,
  `updateCustomerSchema`), shared by the API routes (authoritative) and the
  Add New User form (client-side, for immediate feedback only).
- `lib/customers/mock-store.ts` -- in-memory seed data (6 sample
  customers spanning every status), explicitly and repeatedly labeled as
  mock/not-production in its own header comment. See Bugs fixed below for
  why this ended up `globalThis`-backed rather than a plain module array.
- `lib/customers/service.ts` -- the single seam between "where customer
  data comes from" and every caller (API routes, Server Components).
  Backed by `mock-store.ts` today; swapping to Prisma later is a one-file
  change (see Phase A "Incomplete" above).
- `lib/mock-data/calls.ts` -- mock call history/stats, deterministically
  generated per customer (seeded PRNG keyed by customer id, not `Math.
  random()`, so a given customer's mock call history is stable across
  requests within a process). Explicitly documented as having **no
  database table at all** yet (not even a mock stand-in for one -- there is
  no `Call` model in `prisma/schema.prisma`), per instruction not to create
  unnecessary future tables. Every `aiSummary` field is hard-coded `null`.
- `lib/api-client/customers.ts` -- browser-side `fetch` wrapper
  (`createCustomerRequest`) used only by Client Components; Server
  Components call `lib/customers/service.ts` directly instead (no
  self-HTTP round trip for the initial page render).
- `lib/format.ts` -- small formatting helpers (dates, duration, initials,
  short id) shared by every component below.

**Files created (API routes):**
- `app/api/customers/route.ts` -- `GET` (list, optional `?q=` search),
  `POST` (create; validates with Zod; 409 on duplicate phone; `id`/
  `crmEntryCreatedAt` are never read from the request body).
- `app/api/customers/[id]/route.ts` -- `GET` (one, 404 if missing),
  `PATCH` (partial update, validates with Zod, `id`/`crmEntryCreatedAt`
  excluded from the schema entirely so they cannot be edited).

**Files created (UI components, `components/ui/` -- generic primitives):**
- `Button.tsx`/`.module.css` (+ `LinkButton`), `Field.tsx`/`.module.css`
  (`TextField`/`SelectField`/`TextAreaField`), `Card.tsx`/`.module.css`
  (+ `CardHeader`), `Badge.tsx`/`.module.css`.

**Files created (UI components, `components/crm/` -- CRM-specific):**
- `Sidebar.tsx`/`.module.css` -- static nav; only "Customers" is a real
  link, "Calls"/"Reports"/"Settings" render disabled with a "Soon" tag
  instead of linking to pages that don't exist.
- `PageHeader.tsx`/`.module.css` -- title/subtitle/actions/back-link row,
  used by the Add New User and Customer Detail pages.
- `CustomersExplorer.tsx`/`.module.css` -- Client Component: owns search
  state, renders the title/search/"+ Add New User" row and the customer
  table together (search box and table must share one parent to share
  filter state -- see design note in the file).
- `Avatar.tsx`/`.module.css` -- initials-based default profile picture
  placeholder (no image upload exists), one component at every size.
- `StatusBadge.tsx` -- maps `CustomerStatus` to a colored `Badge`.
- `DemoDataBadge.tsx` -- the explicit, visible "this is not real backend
  data" marker (two variants: customers vs. calls), so mock data is never
  presented as if it were live -- shown on both the Customers list and the
  Customer Detail page's call-activity section.
- `StatCard.tsx`/`.module.css` -- call-stat tiles (total/answered/missed/
  incoming/outgoing/talk time/last contacted).
- `CallHistoryTable.tsx`/`.module.css` -- date/time, agent, direction,
  answered/missed, duration, recording availability, transcript, AI
  summary (always "Not available yet"), follow-up.
- `StateMessage.tsx`/`.module.css` -- shared empty/error message shell.
- `TableSkeleton.tsx`/`.module.css` -- loading placeholder for the
  customers table (one subtle CSS pulse, no JS animation library).
- `CustomerForm.tsx`/`.module.css` -- the Add New User form: name/phone
  (required), location/assigned agent/account creation date/status/notes
  (optional), client-side checks for immediate feedback + authoritative
  server-side validation via the API, inline field errors, disabled submit
  while saving, redirects to the new customer's detail page on success.

**Files created (pages):**
- `app/customers/page.tsx` -- CRM Users page (Server Component, fetches via
  `lib/customers/service.ts` + `lib/mock-data/calls.ts`).
- `app/customers/loading.tsx`, `app/customers/error.tsx` -- Next.js
  loading/error-boundary conventions.
- `app/customers/new/page.tsx` -- Add New User (a dedicated page, not a
  modal -- simpler, works with the browser back button and direct links,
  no modal-state management to build; noted as a deliberate choice, not an
  oversight, since the instructions offered either).
- `app/customers/[id]/page.tsx`/`page.module.css` -- Customer Detail:
  profile, call-activity stats, call history. `generateMetadata` sets the
  page title to the customer's name (or "Customer not found").
- `app/customers/[id]/loading.tsx`, `error.tsx`, `not-found.tsx` -- Next.js
  conventions for this segment.

**Files modified:**
- `app/page.tsx` -- now `redirect("/customers")` instead of the Phase 1
  placeholder text.
- `app/layout.tsx`, new `app/shell.module.css` -- root layout now renders
  the sidebar + content shell around every page.
- `app/globals.css` -- replaced the `create-next-app` defaults with actual
  design tokens (colors incl. the Conbun Call Android app's accent orange
  `#EF812C` for brand consistency, spacing scale, radii, shadows, system
  font stack -- no `next/font/google`, no new font dependency).
- `package.json` / `package-lock.json` -- added `zod` (request validation),
  `@prisma/adapter-neon` + `@neondatabase/serverless` (Prisma 7's mandatory
  driver adapter, Neon-specific for the serverless-friendly HTTP/WebSocket
  transport), `dotenv` (already covered in the Phase 1 entry, unchanged
  here).
- `.gitignore` -- added `.neon` (local `neonctl` CLI state file found in
  the working tree, not created by this session, not project config,
  never inspected beyond its key names -- see Bugs found below).

**Bugs found and fixed (all caught during this session's own manual
verification, before reporting anything as done):**
- **Server Component page returned "static" instead of dynamic** --
  `next build` initially marked `/customers` as `○ (Static)`, meaning
  production would serve one build-time snapshot forever, so a newly
  created customer would never appear without a full rebuild. Fixed by
  adding `export const dynamic = "force-dynamic"` to both
  `app/customers/page.tsx` and `app/customers/[id]/page.tsx`. Confirmed
  fixed: both now build as `ƒ (Dynamic)`.
- **In-memory mock store not actually shared across routes** -- confirmed
  via live testing: an id returned by `GET /api/customers` produced
  "Customer not found" when opened at `/customers/{id}`. Root cause:
  Next.js/Turbopack can compile a route's module graph separately per
  route even within one `next dev`/`next start` process, so a plain
  module-level `const customers: Customer[] = [...]` in `mock-store.ts`
  was not guaranteed to be the same array instance for
  `app/api/customers/*` and `app/customers/[id]/page.tsx`. Fixed by storing
  the array on `globalThis` (same pattern already used for the Prisma
  client singleton in `lib/db/prisma.ts`), which is one process-wide object
  every module graph resolves identically. Verified fixed by re-running the
  full create -> list -> detail-page flow end to end (see Tests below).
- **`next dev`'s own auto-generated `CLAUDE.md` block collided with this
  file's own prose** -- `CLAUDE.md` §7 (added in the Phase 1 pass)
  explained Next.js's auto-appended agent-rules block by quoting its exact
  `<!-- BEGIN:nextjs-agent-rules -->`/`<!-- END:nextjs-agent-rules -->`
  marker text. `next dev`'s upsert logic does a plain whole-file substring
  search for those markers (not scoped to its own appended block), so it
  found the quoted opening marker inside §7's prose as "the" block start
  and merged/garbled everything between that sentence and the real
  block's end marker near the end of the file. **Fixed:** rewrote §7 to
  describe the block by its heading text ("This is NOT the Next.js you
  know") instead of quoting the literal marker syntax anywhere, and added
  an explicit warning against reintroducing the literal marker text in
  this file. Verified fixed by restarting `next dev` after the edit and
  confirming the file stayed clean (no duplicate/garbled content).
- **`.neon` file found in the working tree** -- not created by this
  session (predates it, likely left by the user's earlier `neonctl init`
  attempt mentioned in their instructions). Inspected structurally only
  (key names/types, e.g. confirmed it's a small `{"_init": {"features":
  [...]}}` JSON blob) -- **never printed its values**, per instruction.
  Added to `.gitignore` rather than committed, treated the same as
  `.claude/settings.local.json` (local tool state, not project config).

**Known, verified, not-yet-fixed issue:**
- `GET /customers/{nonexistentId}` renders the correct "Customer not
  found" page (content verified correct) but returns HTTP 200, not 404 --
  confirmed under both `next dev` and a real production `next build && next
  start`, and confirmed **not** fixed by removing the route's
  `loading.tsx` (tried; no change; `loading.tsx` was restored since
  removing it cost the loading skeleton for no benefit). This is a known
  Next.js App Router characteristic: the initial response status is
  committed before the async Server Component's `notFound()` call
  resolves. The equivalent API route, `GET /api/customers/{nonexistentId}`,
  **does** return a correct 404 (verified) -- this only affects the page
  route's HTTP status, not its content, and not the API. Documented in
  `README.md`; not chased further this pass given diminishing returns for
  an internal tool with no SEO/crawling requirement.

**Tests/builds performed (all actually run, this session, not reviewed by
eye):**
- `npm run lint` -- clean, zero errors/warnings (two `eslint-disable`
  comments were flagged as unused and removed -- this project's
  `eslint-config-next` has no `no-console` rule, so they were never doing
  anything).
- `npm run build` -- clean production build, all 8 routes compiled
  (`/`, `/_not-found`, `/api/customers`, `/api/customers/[id]`,
  `/api/health`, `/customers`, `/customers/[id]`, `/customers/new`).
- `npm run dev` and `npm run start` (production) both started
  successfully and were exercised live with real HTTP requests (not just
  "it compiled"):
  - `GET /` -> 307 redirect to `/customers`, confirmed.
  - `GET /customers` -> 200, HTML confirmed to contain real seeded
    customer names, "Add New User", table column headers, and the
    "Seed data" badge text.
  - `GET /customers/new` -> 200, HTML confirmed to contain all form
    fields and "Save customer".
  - `GET /customers/{realId}` -> 200, HTML confirmed to contain Customer
    ID, Phone number, Call activity, Call history, Total calls, and "Not
    available yet" (the AI-summary placeholder).
  - `POST /api/customers` with a valid body -> 201, response body
    inspected: server-generated `id` and `crmEntryCreatedAt` present and
    correct shape.
  - `POST /api/customers` with an empty body -> 400 with field-level
    validation errors for `name`/`phoneNumber`.
  - `POST /api/customers` with a client-supplied `id`/`crmEntryCreatedAt`
    -> 201, and the response's actual `id`/`crmEntryCreatedAt` were
    confirmed to be server-generated values, **not** the client-supplied
    ones (the injection attempt was silently ignored, as intended, since
    those fields aren't in the Zod schema at all).
  - `POST /api/customers` with a phone number already in use -> 409,
    with the existing customer's id in the response body.
  - The newly created customer was confirmed to appear on `/customers`
    (HTML re-fetched and grepped) and to render correctly at its own
    `/customers/{id}` detail page -- this is the end-to-end confirmation
    that the `globalThis` mock-store fix (above) actually works, not just
    that it compiles.
  - `PATCH /api/customers/{id}` with `{status, notes}` -> 200, response
    confirmed the fields changed and `id` stayed the same.
  - `PATCH /api/customers/{nonexistentId}` -> 404.
  - `GET /api/customers/{nonexistentId}` -> 404.
  - Server stopped after each test round; port 3000 confirmed free before
    the next round.
- **Not performed:** interactive/visual verification in an actual browser
  (search-as-you-type, form inline-error rendering, hover states). No
  browser automation was available/attempted this pass -- everything above
  was verified via server-rendered HTML content and direct API calls, which
  confirms the server-side logic and initial render are correct, but not
  client-side interactivity itself. Flagged honestly rather than implied.

**Actual results:**
- A real, working CRM UI exists and was exercised end-to-end against its
  own API, all backed by clearly-labeled mock data, exactly as instructed.
  The database itself is designed and migration-ready but not connected --
  blocked on the one missing `DATABASE_URL`, reported above rather than
  worked around.

**Incomplete / still requiring the next phase:**
- `DATABASE_URL` still needed (Phase A) -- see above.
- Swap `lib/customers/service.ts` from mock-store to Prisma once the
  migration is applied.
- No inline edit UI for an existing customer yet (the `PATCH` API exists
  and is tested; no "Edit" button/form was built this pass -- not
  explicitly requested for the UI, only the endpoint).
- Search is client-side only over the already-fetched list; the API's
  `?q=` server-side search parameter exists and works (usable once list
  size makes client-side filtering impractical) but isn't wired to the UI
  yet, since client-side is sufficient at demo scale.
- `GET /customers/{badId}` 200-vs-404 status code (see "Known, verified,
  not-yet-fixed issue" above).
- No authentication anywhere yet (Phase 3, per `CRM_ARCHITECTURE.md`).
- No Android integration (explicitly out of scope this pass).
- Not pushed to GitHub, no Vercel project connected yet.

---

## 2026-08-08 — Connected to the real Neon database + full UI redesign

User confirmed the Neon connection string was placed in `.env` and the
initial migration applied, then asked to (1) move the customers API off
the mock store onto Prisma/Neon and (2) redesign the CRM UI for a more
professional, denser, less-scrolly look -- in one implementation pass, no
separate planning turn.

### 1. Real database connection

**`DATABASE_URL` was checked first (structurally only -- never printed) to
confirm it held a real value before touching anything.** It did. **Its
value has not been printed, logged, or committed anywhere in this session.**

**Files created:**
- `lib/customers/prisma-store.ts` -- the real persistence layer. Implements
  the same five functions the mock store did (`dbListCustomers`,
  `dbGetCustomerById`, `dbFindCustomerByPhoneNumber`, `dbCreateCustomer`,
  `dbUpdateCustomer`), backed by `prisma.customer.*` via the existing
  `lib/db/prisma.ts` singleton. A `toDomain()` mapper converts Prisma's
  `Date` fields to the ISO strings `lib/customers/types.ts` expects.
  `dbCreateCustomer` never sets `id`/`crmEntryCreatedAt` -- the schema's
  `@default(uuid())`/`@default(now())` generate them, same rule as before,
  now enforced at the database level instead of just in application code.
  `dbUpdateCustomer` catches Prisma's `P2025` ("record not found") and
  returns `null`, matching the existing "not found" contract instead of
  leaking a Prisma-specific error type to callers.

**Files modified:**
- `lib/customers/service.ts` -- now imports from `prisma-store.ts` instead
  of `mock-store.ts`. This was the one-file swap `CRM_ARCHITECTURE.md`
  always described; no API route or page needed to change.
- `lib/mock-data/calls.ts` -- its only import was `mockListCustomers` from
  the now-deleted mock store (used to pre-build a per-customer call-count
  map). Rewritten to generate call history for any customer id on demand
  (same deterministic per-id PRNG, just no longer needs a customer list
  up front) -- decouples mock call data from customer data entirely, which
  is also just more correct: it no longer needs to enumerate every
  customer to compute one customer's stats.
- `app/api/customers/route.ts` -- doc comment updated (no longer describes
  itself as mock-backed).

**Files deleted:**
- `lib/customers/mock-store.ts` -- removed from the codebase entirely, not
  just unwired, per instruction not to keep fake customer data around
  pretending to be production data.

**Tests/builds performed (all actually run against the live database):**
- `npx prisma validate` -- passed.
- `npm run build` -- clean.
- **Full persistence test, exactly as requested, against the real Neon
  database:**
  1. `POST /api/customers` -- created "Persistence Test Customer" -> 201,
     server-generated `id`/`crmEntryCreatedAt` confirmed present.
  2. Confirmed it appeared in `GET /api/customers` and on the rendered
     `/customers` page HTML.
  3. **Restarted the dev server completely** (killed the process, `ss
     -ltnp` confirmed port 3000 free, started fresh).
  4. `GET /api/customers/{id}` after restart -> 200, identical record --
     **this is the real proof of persistence**, not just that the API
     compiles: an in-memory store would have reset to empty on this
     restart, and it didn't.
  5. `PATCH /api/customers/{id}` -- changed `status`/`notes`.
  6. Re-fetched -- confirmed the change persisted, `updatedAt` advanced
     past `createdAt` (Prisma's `@updatedAt` working correctly), `id`
     unchanged.
  7. **Removed the temporary test record** via `prisma db execute --stdin`
     (a one-off `DELETE FROM customers WHERE customer_id = '...'`) rather
     than adding a permanent `DELETE` API route -- not requested, and
     customer deletion (soft vs. hard delete, who's allowed) is a real
     product decision better made deliberately later, not smuggled in as
     a side effect of test cleanup. Confirmed removed (404 afterward,
     `GET /api/customers` back to `{"data":[]}`).
- Repeated the same create -> restart -> update -> cleanup sequence again
  after the UI redesign (below), against the redesigned pages this time,
  to confirm the new UI reads/writes the same real data -- see that
  section's Tests for the exact record.

**Actual results:**
- The CRM Users page, Add New User, Customer Detail, and all four
  `/api/customers*` endpoints now read and write the real `customers`
  table on Neon Postgres. No mock customer data exists anywhere in the
  running app. Verified by surviving a full process restart, not assumed.

### 2. UI redesign

Scope: visual/layout redesign only, no architecture changes, per
instruction. Same pages, same API, same data layer -- different
components/CSS.

**Files modified:**
- `components/crm/CustomersExplorer.tsx`/`.module.css` -- column set cut
  from 10 columns to 7 (**Customer, Phone, Agent, Calls, Last contact,
  Status, Actions**), matching the requested priority list exactly.
  `Customer ID` moved into a small monospace secondary line under the name
  (plus a `title` tooltip with the full id); `location`/`CRM entry date`
  moved to the detail page only (still searchable via the search box,
  just not shown as columns). Search box got a leading icon. Table switched
  from `min-width: 960px` (which forced horizontal scroll on normal
  screens) to `table-layout: fixed` with percentage column widths, so it
  fits the content width and never needs horizontal scroll on a normal
  desktop viewport -- this was the specific complaint, verified fixed (see
  Tests). Added an explicit "Actions" column (a "View" link) since it was
  requested as a column even though name/phone already link to the detail
  page.
- `components/crm/CallHistoryTable.tsx`/`.module.css` -- per instruction
  not to invent recordings/transcripts/AI summaries, the Recording/
  Transcript/AI-summary columns now show **availability badges**
  ("Available" / "None" / "Not available yet") instead of the previous
  version's fabricated transcript sentence displayed as if it were real
  call content. AI summary is always "Not available yet" (unchanged --
  that feature still doesn't exist). Also switched to `table-layout:
  fixed` with percentage widths, same horizontal-scroll fix as above.
- `app/customers/[id]/page.tsx`/`page.module.css` -- profile header
  redesigned (avatar + name + click-to-call phone number + status badge,
  left-aligned instead of centered); profile fields moved from a single
  stacked list into a denser 2-column grid; call-activity stats grid
  changed from 7 cards to the requested 6 (**Total calls, Answered,
  Missed, Outgoing, Total talk time, Last contacted** -- dropped
  "Incoming", not in the requested list); the "mock data" indicator moved
  from a "Seed data" badge on the whole page (customers are real now) to a
  single "Sample data" badge scoped to just the Call history card, since
  that's the only remaining mock data on this page.
- `components/crm/CustomerForm.tsx`/`.module.css` -- cut from 7 fields to
  the requested 5 (**Name, Phone number, Location, Assigned agent,
  Status**); "Account/application creation date" and "Notes" removed from
  this form (the underlying data model/API still support both, for a
  future edit screen -- they just aren't part of *this* fast add-a-
  customer flow). Location/Assigned agent now sit side-by-side in a
  2-column row instead of stacking full-width.
- `app/customers/new/page.tsx` + new `page.module.css` -- form card capped
  at 560px wide instead of stretching the full content width, which reads
  much more like a focused, professional "add record" form.
- `app/customers/page.tsx` -- stale comment fixed (no longer describes
  itself as mock-backed).

**Files deleted:**
- `components/crm/DemoDataBadge.tsx` -- its only two use sites were
  removed above (customers are real, and the one remaining mock-data
  badge is now an inline `<Badge tone="accent">Sample data</Badge>`, not
  worth a dedicated component for a single remaining call site).

**Design decisions (not asked to justify individually, noted for the
record):** kept the plain-CSS-Modules approach from Phase B rather than
adding a component library, per "do not redesign the entire architecture"
and "no unnecessary dependencies" (still standing rules); accent orange
usage reduced to genuinely interactive/status moments (active nav item,
links on hover, primary button, badges) rather than decorative use, per
"use the accent intelligently"; no new animations added beyond the
existing table-skeleton pulse from Phase B.

**Tests/builds performed:**
- `npm run lint` -- clean.
- `npm run build` -- clean, all 7 routes, same shape as before (redesign
  didn't change routing). One build run was slow (~5 min) because a stray
  `next dev` process from the earlier persistence test was still running
  and contending with `next build` over the `.next/` directory -- not a
  code issue; killed the stray process and reran, back to ~1s compile /
  ~6s typecheck.
- `npx prisma validate` -- clean.
- **Live re-verification against the real database, against the
  redesigned pages specifically:** created "Redesign QA Customer" via
  `POST /api/customers`, confirmed it rendered on the redesigned
  `/customers` table (new column headers confirmed present: Customer,
  Phone, Agent, Calls, Last contact, Status) and the redesigned
  `/customers/{id}` detail page (profile fields, exactly 6 stat-card
  labels confirmed by grepping the actual rendered `StatCard` label
  markup -- not just eyeballing "Incoming" appearing anywhere on the page,
  since it also legitimately appears as a per-call Direction value in the
  history table), `PATCH`'d its status, confirmed the change, then removed
  it the same way as the Phase-A test record (`prisma db execute`).
- Confirmed the Add New User page's rendered HTML no longer contains
  `id="notes"` or `id="accountCreatedAt"` form fields.
- Confirmed the empty state ("No customers yet") renders correctly once
  the test record was cleaned up -- **one transient miss noted and
  investigated**: the very first fetch immediately after the `prisma db
  execute` DELETE returned a response without the empty-state text (RSC
  streaming payload only, page content not yet resolved in that
  particular response); three immediate repeat fetches afterward were all
  byte-identical and correct. Treated as a one-off timing artifact of
  hitting the app right as a separate short-lived Prisma connection (the
  CLI's) released, not a reproducible bug -- flagged here rather than
  silently ignored, but not chased further given it didn't reproduce.

**Actual results:**
- Both parts done and verified live, not just built: real Neon persistence
  survives a restart, and the redesigned Customers/Detail/Add-New-User
  pages render the new layout against real data with the new column set,
  no forced horizontal scroll, and no fabricated call content.

**Incomplete / still requiring the next phase:**
- `?q=` server-side search still unused by the UI (client-side search is
  sufficient at current scale) -- unchanged from the prior entry.
- `GET /customers/{badId}` 200-vs-404 status code -- unchanged, still not
  fixed (see prior entry's explanation; nothing about the redesign
  affected this).
- No authentication, no Android integration, no AI summaries -- all still
  explicitly out of scope, unchanged.
- No edit-customer UI (the `PATCH` endpoint is tested and works; no "Edit"
  button exists in the redesigned detail page -- not requested this pass).
- Call history / recordings / transcripts / AI summaries are still 100%
  mock (`lib/mock-data/calls.ts`), clearly labeled via the "Sample data"
  badge on the Customer Detail page -- no `Call` table exists, per
  instruction not to create unnecessary future tables.
- Not pushed to GitHub, no Vercel project connected yet.

---

## 2026-08-08 — V1 backend: auth, agents, calls, recordings, transcripts, AI summaries, follow-ups + Android integration prep

User authorized working autonomously through all remaining phases without
stopping for approval between them. This single entry covers the full
pass: database, backend API, CRM UI wiring, documentation, and Android
integration prep -- in that order, each verified before moving to the
next.

### Database (Prisma migrations, applied to the real Neon database)

**Two new migrations**, both additive/non-destructive, both applied via
`prisma migrate dev` (not hand-authored SQL this time -- a real connection
now exists) and confirmed with `prisma migrate status`:

- `20260808153513_add_agents_calls_recordings_transcripts_summaries_actions`
  -- adds `Agent`, `Call`, `Recording`, `Transcript`, `AiSummary`, `Action`
  tables, plus a new nullable `assigned_agent_id` FK column on the
  existing `customers` table. **Existing `customers` rows/columns
  untouched** -- confirmed by reading the generated migration SQL before
  running anything: it's all `CREATE TYPE`/`CREATE TABLE`/one `ALTER TABLE
  ... ADD COLUMN` (nullable)/`CREATE INDEX`/`ADD CONSTRAINT`, no `DROP` or
  destructive `ALTER` anywhere.
- `20260808155147_calls_status_nullable_until_finish` -- changed
  `Call.status` from required to nullable *before* any `Call` row existed
  (caught during schema authoring, fixed before running `migrate dev`),
  so the outcome (answered/missed/etc.) can be unknown between "start
  call" and "finish call" -- matches the two-step lifecycle the API
  exposes.

A real customer row created by the user directly through the CRM UI
(`name: "dff"`) was present in the database throughout this entire pass
and was **never touched, queried destructively, or deleted** -- confirmed
present at both the start and the end of this session's testing.

**`prisma/seed.ts`** -- new. Creates exactly one dev-only admin `Agent`
account, idempotent (`findUnique` + conditional `create`, not `upsert()` --
see the WebSocket finding below). Credentials are documented in the file
itself (clearly labeled dev-only, not a real secret) and were never
printed to any log/output in this session -- only referenced by "see the
file."

**Schema summary (all six new models):** `Agent` (auth identity + role +
active flag), `Call` (belongs to `Customer` via `customerId`, optionally
to `Agent` via `agentId`, `status` nullable until finished), `Recording`
(1:1 with `Call`, metadata only -- see Storage below), `Transcript` (1:1
with `Call`), `AiSummary` (1:1 with `Call`, structure only -- see AI
Summaries below), `Action` (follow-ups, belongs to `Customer`, optionally
to `Call` and an `Agent`). Indexes added on every foreign key plus
`customers.status`, `calls.started_at`, `actions.status` (see
`prisma/schema.prisma` for the full field list -- not repeated here,
`API_DOCUMENTATION.md` documents the API shape these back).

### A real, environment-specific bug found and fixed: Prisma + WebSocket on Node 20

**`prisma/seed.ts` failed** with "All attempts to open a WebSocket to
connect to the database failed" on its very first run -- even for a plain
`findUnique`, not just a transaction. Root cause, confirmed not assumed:
`@neondatabase/serverless`'s `Pool` (which `@prisma/adapter-neon` uses
internally) needs a WebSocket implementation, and Node.js only ships a
*global* `WebSocket` starting at v22 -- this project targets Node 20
(`package.json` "engines"). It had been silently working inside `next
dev`/`next start` because Next's bundler polyfills this for code it
bundles; a plain `tsx prisma/seed.ts` process outside that bundler has no
such polyfill. **Fixed for real, not just for the seed script:**
`neonConfig.webSocketConstructor = <ws package>` added to both
`prisma/seed.ts` and, more importantly, `lib/db/prisma.ts` itself (the
app's actual Prisma client) -- the app was working by accident of the
bundler, this makes it work by explicit, correct configuration instead,
which matters for anything that ever runs this code outside `next dev`/
`next start` (e.g. a future standalone script or a different deploy
target). Added the `ws` package (+ `@types/ws`) as a dependency --
justified: it's the fix for a confirmed real bug, not speculative.

**Separately confirmed:** this environment's Neon connection cannot open
the WebSocket session Prisma's *interactive transactions* need either
(`upsert()`, `$transaction([...])` both fail the same way, confirmed by
testing `upsert()` first before switching to `findUnique`+`create`).
Every new service (`lib/customers/prisma-store.ts` already did this;
`lib/calls/service.ts`, `lib/recordings/service.ts`,
`lib/transcripts/service.ts`, `lib/ai-summaries/service.ts`) uses plain
sequential queries instead of `upsert()`, documented inline everywhere it
matters. Now a standing rule -- `CLAUDE.md` §3.11.

### Authentication (Phase 1)

**Files created:** `lib/auth/password.ts` (bcryptjs, cost factor 12),
`lib/auth/jwt.ts` (HS256 via `jose`, not `jsonwebtoken` -- `jose` runs on
Web Crypto and works in both the Node API-route runtime and the Edge
`proxy.ts` runtime with the same code; `jsonwebtoken` needs Node's
`crypto`, unavailable in Edge middleware), `lib/auth/session.ts`
(`requireAuth`/`requireRole` helpers, reads either the `crm_session`
httpOnly cookie or an `Authorization: Bearer` header -- one mechanism for
both the CRM web app and Android, per `CRM_ARCHITECTURE.md` §8),
`lib/auth/validation.ts`, `lib/agents/types.ts` + `service.ts` (agent
CRUD, `authenticateAgent()` -- generic "invalid email or password" error,
deliberately doesn't distinguish wrong-email/wrong-password/inactive-
account), `app/api/auth/login/route.ts` (issues the JWT, sets it as an
httpOnly cookie *and* returns it in the JSON body for bearer clients),
`app/api/auth/logout/route.ts`, `app/api/auth/me/route.ts`,
`app/api/agents/route.ts` + `[id]/route.ts` (admin-only create/update,
`GET` open to any authenticated agent for the "assigned agent" picker),
`proxy.ts` (see rename note below) protecting every CRM page,
`app/login/page.tsx` + `components/crm/LoginForm.tsx`, a new `(app)`
route group (`app/(app)/layout.tsx` renders the Sidebar shell; `/login`
sits outside it and is chrome-free), `components/crm/LogoutButton.tsx`.

**`JWT_SECRET` generated locally** (48 random bytes, base64) and written
directly into `.env` via a script that never printed the value to this
session's output -- confirmed by re-reading the transcript-equivalent
command output, only a success message was shown.

**Files created (seed):** `prisma/seed.ts`, registered via
`migrations.seed` in `prisma.config.ts`.

**`middleware.ts` renamed to `proxy.ts`, function renamed `middleware` →
`proxy`** -- Next.js 16 deprecated the old convention (`next build` warned
about it); found and applied the exact codemod's transform (`file → proxy.ts`,
function → `proxy`) manually since the codemod itself refused to run
against uncommitted changes and `--force`-running an unreviewed canary
codemod over this much uncommitted work wasn't worth the risk. Verified
by re-running `next build` and confirming the deprecation warning is
gone.

### Customers (Phase 2 — extended)

**Files modified:** `lib/customers/types.ts` (added `assignedAgentId`,
`ListCustomersParams`/`ListCustomersResult` for pagination),
`lib/customers/prisma-store.ts` (real search via Postgres `ILIKE`
(`contains`, `mode: "insensitive"`) across name/phone/location/agent,
status filter, pagination with a real `count()`, and
`resolveAgentName()` -- denormalizes the assigned agent's current name
into `Customer.assignedAgent` on every write that touches
`assignedAgentId`, so existing display code didn't need to change),
`lib/customers/validation.ts` (`assignedAgent` free-text field replaced
with `assignedAgentId`), `app/api/customers/route.ts` +
`[id]/route.ts` (added `requireAuth`, `GET` now takes `q`/`status`/
`assignedAgentId`/`page`/`pageSize`), new `app/api/customers/lookup/route.ts`
(phone-number lookup -- Android's "identify the customer" step).

### Agents (Phase 3)

Covered above under Authentication (the `Agent` model and its CRUD API are
one and the same as the auth identity, per the architecture's original
design -- "one identity, not two").

### Calls (Phase 4)

**Files created:** `lib/calls/types.ts`, `lib/calls/validation.ts`,
`lib/calls/service.ts` (`startCall`/`updateCall`/`getCallById`/
`listCallsForCustomer`/`getCallStatsForCustomer`, joins `agent`/
`recording`/`transcript`/`aiSummary` for the UI's benefit),
`app/api/calls/route.ts` (`POST` -- start), `app/api/calls/[id]/route.ts`
(`GET`, `PATCH` -- finish), `app/api/customers/[id]/calls/route.ts`
(history + stats together). Two-step lifecycle confirmed working exactly
as designed in live testing (see Testing below): `POST` returns `status:
null`, `PATCH` sets the real outcome.

**A Prisma-7 API-compatibility bug found and fixed:** `Prisma.validator`
(used in the first draft of `lib/calls/service.ts` and
`lib/actions/service.ts` to type a reusable `include` shape) doesn't
exist in Prisma 7's generated client -- caught by `next build`'s
TypeScript pass, not silently ignored. Fixed with the modern equivalent:
`{ include: {...} } satisfies CallDefaultArgs` + `CallGetPayload<typeof
...>`, both types imported directly from the generated client's
`models` barrel.

### Recordings (Phase 5 — metadata only, explicitly marked pending)

**Files created:** `lib/storage/index.ts` -- the object-storage
abstraction interface, explicitly returning `{ name: "pending", configured:
false }`. No cloud storage credentials exist; this is stated plainly, not
implied to work. `lib/recordings/types.ts` + `service.ts`,
`app/api/calls/[id]/recording/route.ts` (`GET`/`POST`, registers metadata
only -- `storageKey`/`mimeType`/`sizeBytes`/`durationSeconds` -- never
receives or stores audio bytes).

### Transcripts (Phase 6)

**Files created:** `lib/transcripts/types.ts` + `service.ts`,
`app/api/calls/[id]/transcript/route.ts`. Submitting non-empty `text`
with no explicit `processingStatus` implies `DONE`.

### AI summaries (Phase 7 — structure only, nothing fabricated)

**Files created:** `lib/ai-summaries/types.ts` + `service.ts`,
`app/api/calls/[id]/summary/route.ts`. `GET` on a call with nothing
submitted returns `{ "data": null, "processingStatus": "PENDING" }` --
verified live (see Testing) that this is genuinely what comes back before
anything is submitted, not a fabricated-looking placeholder.

### Follow-up / actions (Phase 8)

**Files created:** `lib/actions/types.ts` + `validation.ts` + `service.ts`
(deliberately flat, no workflow engine -- `type` ∈ `FOLLOW_UP`/
`REACH_OUT`/`CALLBACK`/`OTHER`, `status` ∈ `PENDING`/`IN_PROGRESS`/
`COMPLETED`/`CANCELLED`, `COMPLETED` auto-stamps `completedAt`),
`app/api/customers/[id]/actions/route.ts`, `app/api/actions/[id]/route.ts`.

### CRM UI (Phase 9 — wired to the real backend, mock removed)

**Files deleted:** `lib/mock-data/calls.ts` -- the entire module, per
explicit instruction to remove the fake call-history implementation now
that real Call APIs exist. `components/crm/DemoDataBadge.tsx` -- its only
call sites were the now-real customers list/detail sections; deleted
rather than left as dead code.

**Files rewritten:** `app/(app)/customers/page.tsx` (now reads real
`page`/`q`/`status` from the URL's search params and calls
`listCustomers()` with them -- search/filter/pagination are real,
server-side, not client-side filtering over one page's data, which would
silently miss matches on other pages), `components/crm/CustomersExplorer.tsx`
(debounced URL-driven search, a status-filter `<select>`, Previous/Next
pagination controls), `app/(app)/customers/[id]/page.tsx` (calls
`lib/calls/service.ts` + `lib/actions/service.ts` instead of the deleted
mock module), `components/crm/CallHistoryTable.tsx` (recording/
transcript/AI-summary columns now show real `processingStatus`-derived
badges, never the previous mock version's fabricated transcript sentence
displayed as if it were real call content), `components/crm/CustomerForm.tsx`
(`assignedAgent` free-text field replaced with a real `<select>` over
actual `Agent` records).

**Files created:** `components/crm/FollowUpList.tsx` (+ `.module.css`,
`lib/api-client/actions.ts`) -- add/complete follow-ups from the Customer
Detail page, `app/(app)/agents/page.tsx` (admin-only -- checks
`role === "ADMIN"` itself via the session cookie and redirects otherwise,
since `proxy.ts` only checks "authenticated," not role) +
`components/crm/AgentsTable.tsx` (+ `.module.css`, `lib/api-client/agents.ts`)
-- list agents, add one, toggle active/inactive. `components/crm/Sidebar.tsx`
rewritten as a Client Component (`usePathname()`) so "Agents" (admin-only,
conditionally rendered) and "Customers" highlight correctly as two real
nav items instead of one permanently-styled-active link.

### Documentation

**Files created:** `API_DOCUMENTATION.md` (every endpoint, real
request/response examples, error format, auth model -- all copied from
what was actually tested below, not planned), `ANDROID_API_INTEGRATION.md`
(see Android section).

**Files modified:** `CLAUDE.md` (added a "Current status" section, three
new standing rules -- never print secrets, the WebSocket/transaction
limitation, every API route self-protects), `CRM_ARCHITECTURE.md` (status
line updated from "proposal" to "implemented and tested," §14 open
decisions marked resolved where they now are).

### Testing (all against the real Neon database, via live HTTP requests)

- `npm run lint` -- clean at every checkpoint.
- `npm run build` -- clean at every checkpoint; final route list: 23
  routes (`/login`, `/customers`, `/customers/new`, `/customers/[id]`,
  `/agents`, plus every `/api/*` endpoint above), all correctly `ƒ`
  (dynamic) except the static shell pages.
- `npx prisma validate` / `npx prisma migrate status` -- clean at every
  checkpoint.
- **Full authenticated end-to-end lifecycle**, exercised via `curl` with a
  real bearer token (i.e. exactly what Android would send), against the
  live database:
  1. Unauthenticated `/customers` → 307 to `/login`; unauthenticated
     `/api/customers` → 401. Wrong password → 401.
  2. Login as the seeded dev admin → 200, real JWT returned. Confirmed
     the *same* token works via both the cookie (`GET /api/auth/me`
     with `-b`) and the `Authorization: Bearer` header (`-H`) --
     identical response both ways.
  3. `GET /api/customers/lookup?phoneNumber=...` → 404 (customer doesn't
     exist yet) → `POST /api/customers` (create) → `GET .../lookup` again
     → 200, same id. This is Android's real "identify or create" flow,
     run for real.
  4. `POST /api/calls` (start) → `status: null` confirmed. `PATCH
     /api/calls/{id}` (finish, `status: "ANSWERED"`, `durationSeconds:
     142`) → confirmed persisted.
  5. `POST /api/calls/{id}/recording` (metadata) → 201.
  6. `POST /api/calls/{id}/transcript` → 201, `processingStatus: "DONE"`.
  7. `GET /api/calls/{id}/summary` **before** submitting anything →
     `{ "data": null, "processingStatus": "PENDING" }` -- confirmed the
     "never fabricate" rule holds at the API level, not just in
     intent.
  8. `POST /api/calls/{id}/summary` → 201, real fields stored.
  9. `GET /customers/{id}` (the actual CRM page, with the session cookie)
     → confirmed the rendered HTML contains the real call ("Answered",
     "Outgoing", "2:22" -- 142 seconds correctly formatted), and the AI
     Summary column shows "Available" (not "Not available yet") now that
     one exists.
  10. Created a follow-up `Action` tied to that call, marked it
      `COMPLETED`, confirmed `completedAt` was stamped.
  11. **Killed the dev server completely** (`kill`, confirmed port 3000
      free), **started it fresh**, and re-fetched the customer, the call
      (status/recording/transcript/summary flags), the summary's actual
      text, and the action's status via the *same* bearer token from
      before the restart -- **everything matched exactly.** This is the
      real proof of persistence (an in-memory implementation would have
      reset to empty on this restart; it didn't) and that the JWT itself
      remains valid across a restart (expected for stateless tokens, but
      confirmed rather than assumed).
  12. Cleaned up: deleted the test customer via `prisma db execute`
      (cascade deletes removed the call/recording/transcript/summary/
      action with it, confirmed via 404s afterward), confirmed the
      database was back to exactly its real baseline (the user's own
      `"dff"` customer, count 1) -- no test data left behind.
  - Search/filter/pagination were additionally exercised directly against
    the running server (`?q=`, `?status=`, `?page=`) beyond the single
    "E2E Test Customer" created for the lifecycle test above.
- **Not run:** interactive/visual browser testing (clicking through the
  Agents page's add-agent form, the FollowUpList's add form) -- verified
  via rendered HTML content and the underlying APIs those forms call, same
  honest limitation noted in the prior UI-redesign entry.

### Android integration (Phase 11-12)

See `ANDROID_API_INTEGRATION.md` for the full record. Summary: inspected
`ConbunCall_V4` read-only, added a new `data/backend/` package (DTOs,
Retrofit service, client, repository) matching this backend's real,
tested contract -- deliberately not merged into the existing `data/crm/`
package, which models a different, never-built backend. Wired into
`AppContainer` (one line) and a new "Sign in to CRM backend" button in
Settings (the only UI call site added -- reuses the existing "API Base
URL"/"CRM Auth Token" fields rather than adding parallel ones). **Verified
with a real compile**, not just review: `JAVA_HOME=/snap/android-studio/236/jbr
./gradlew :app:compileDebugKotlin --offline` → **BUILD SUCCESSFUL**, zero
new warnings.

**Blocker, identified precisely, not worked around:** this environment has
the Android SDK and `adb` installed, but `adb devices` returns empty and
no AVD is configured -- there is no device or emulator to run the app on.
The exact next action is documented in `ANDROID_API_INTEGRATION.md`
("Exact next action to run a real device test"): get a device/AVD, point
Settings → API Base URL at this backend's LAN-reachable address (or a
future Vercel URL), use the new Sign In fields with the seeded dev admin
credentials.

### What is real vs. mocked (end of this pass)

**Real, backed by the live database, verified end-to-end:** authentication,
agents, customers (including search/filter/pagination), calls (full
start/finish lifecycle), recording metadata, transcripts, AI-summary
structure, follow-up actions.

**Explicitly not real, and never presented as real:** recording *audio
bytes* (no object storage provider configured -- `lib/storage/index.ts`
says so plainly), AI-generated summary *content* (this backend generates
none; `POST .../summary` only stores what it's given, by a future real AI
pipeline), any Android-side call to any endpoint beyond login (implemented
and backend-verified, but not exercised from an actual device).

### Incomplete / still requiring the next phase

- No on-device/emulator test of the new Android code (see Android section
  above) -- the single largest outstanding item.
- `lookupCustomerByPhone`/`startCall`/`finishCall`/`registerRecording`/
  `submitTranscript`/`submitAiSummary` have no Android UI call site beyond
  the new Sign In button -- wiring them into the real call-completion flow
  is a separate, smaller follow-up task.
- No object storage provider configured -- recording metadata works,
  audio bytes have nowhere to go.
- No real AI provider configured in this backend -- structure only, per
  instruction.
- Not pushed to GitHub, no Vercel project connected -- Android can only
  reach this backend on the same LAN as the dev machine right now.
- `GET /customers/{badId}` 200-vs-404 status code (documented Next.js
  streaming characteristic, carried over from the prior entry, unchanged).
- `Customer.status`/`Action`/`AiSummary` full field set exists in the API
  but the Customer Detail page's UI only shows availability badges, not
  every individual AI-summary field (`keyPoints`, `sentiment`, etc.) --
  flagged in `CRM_ARCHITECTURE.md` §14 item 9.

---

## 2026-08-09 — Call-request queue: CRM "Call" button → Android pending-request flow + test customers

Narrow, explicitly-scoped pass: **only** the call-request flow (CRM button
→ `PENDING` row in Neon → Android polls/accepts/fulfills) plus test data.
No UI redesign, no auth changes, no unrelated features -- per explicit
instruction. The existing Customer/Call/Transcript architecture was not
touched except the one additive field noted below.

**A transient interruption happened mid-task** (background `prisma
migrate dev` failed with `P1017`/ENOTIMP -- a real network drop, not a
code issue). Recovered correctly: re-checked `git status` and
`prisma/migrations/` before doing anything else, confirmed no partial
migration had been written and `prisma/schema.prisma`'s edits (already
made pre-interruption) were exactly as left, then retried
`prisma migrate dev` once connectivity was confirmed restored via
`prisma migrate status`. Nothing was redone or reverted.

**Also noted, not acted on:** `ConbunCall_V4/di/AppContainer.kt` now
contains `CallStateObserver`/`CallSessionTracker` imports this session
didn't add -- someone else is evidently already working on the Android
side. Left completely untouched, per this pass's explicit CRM-only scope;
flagged here so it isn't mistaken for something this session did.

### Database

**One migration**, purely additive, applied to the real Neon database
(confirmed by reading the generated SQL before trusting it -- one
`CREATE TYPE`, one `CREATE TABLE`, indexes, two `ADD CONSTRAINT`, no
`DROP`/destructive `ALTER` anywhere):
`20260808190653_add_call_requests` -- new `CallRequestStatus` enum
(`PENDING`/`ACCEPTED`/`COMPLETED`/`CANCELLED`/`FAILED`) and `CallRequest`
model: `id`, `customerId` (FK, required -- never phone number, CLAUDE.md
rule #1), `phoneNumber`/`customerName` (snapshotted at request time),
`status` (default `PENDING`), `callId` (nullable, `@unique` FK to `Call`
-- set once Android reports the real call), `requestedAt`, `updatedAt`.
Also added a reverse `callRequest CallRequest?` relation field on `Call`
and `callRequests CallRequest[]` on `Customer` -- both relation-only,
zero new columns on those tables' own data.

**Note:** `prisma migrate status`/`migrate dev` briefly returned `P1001`
("can't reach database server") on the very first attempt this session,
before any of the interruption above -- resolved by simply retrying a few
seconds later. This is Neon's normal free-tier compute
auto-suspend/auto-wake behavior (the direct-TCP connection Prisma's CLI
uses is what triggers the wake, unlike the app's own HTTP/WebSocket
adapter which appears to wake it transparently) -- not a bug, not
investigated further, just noted for future sessions so it isn't mistaken
for a real outage.

**Existing data:** the real customer created directly through the CRM UI
was present before this pass and confirmed still present, unmodified,
after it (verified via the API, by name, post-seeding).

### Backend

**Files created:** `lib/call-requests/types.ts`, `validation.ts`,
`service.ts` (`createCallRequest` -- snapshots `phoneNumber`/`name` from
the real customer row, 404s if `customerId` doesn't resolve;
`listCallRequests(status?)`; `getCallRequestById`; `updateCallRequest` --
find-then-update, not `upsert()`, same established reason as every other
service in this codebase), `app/api/call-requests/route.ts` (`POST`
create, `GET` list with optional `?status=`), `app/api/call-requests/[id]/route.ts`
(`GET` one, `PATCH` update), `lib/api-client/call-requests.ts` (browser
fetch wrapper for the CRM button), `components/crm/CallRequestButton.tsx`
+ `.module.css`.

**Files modified (additive only):** `lib/calls/types.ts` (`StartCallInput`
gained an optional `callRequestId`), `lib/calls/service.ts` (`startCall`
now does a second, separate, best-effort write linking
`CallRequest.callId` to the new call when `callRequestId` is passed --
not wrapped in a `$transaction`, per this environment's already-documented
Neon/WebSocket limitation, and deliberately non-fatal if the id doesn't
resolve, since the call itself must still be created either way),
`lib/calls/validation.ts` (schema gained the same optional field).
`app/api/calls/route.ts` needed **no changes** -- it already passes
`parsed.data` straight through. Every existing required field, response
shape, and status code for `POST`/`PATCH /api/calls` is unchanged; a
caller that never sends `callRequestId` sees no difference at all.
`app/api/calls/[id]/transcript/route.ts` -- **not touched.** Re-verified
live (see Testing) that `POST /api/calls/{id}/transcript` still works
exactly as before.

**All new/modified routes call `requireAuth()`** (existing auth
middleware/helper, not a new mechanism -- per instruction not to add
authentication, this reuses what already existed).

### CRM UI (minimal, additive)

**Files modified:** `components/crm/CustomersExplorer.tsx` -- added
`<CallRequestButton customerId={row.id} />` next to the existing "View"
link in the Actions column. **"View" was not removed.** Column widths
(`CustomersExplorer.module.css`) nudged slightly (Agent 17%→14%, Last
contact 14%→12%, Actions 8%→14%) so both controls fit without wrapping;
no other layout/visual change. `CallRequestButton` posts to
`/api/call-requests` and locks to a disabled "Requested" label on success
(a fresh page load resets it) so an accidental double-click can't queue
duplicate `PENDING` requests for the same customer -- the only UI/UX
decision made in this pass beyond "add the button."

**Nothing else in the UI was touched.** Customer Detail page, Add New
User, Agents page, login, sidebar -- all exactly as they were.

### Test data (development/test only, clearly marked three independent ways)

**File created:** `prisma/seed-test-customers.ts` (+ `npm run
db:seed-test-customers`, `dotenv/config` imported explicitly since this
script runs standalone via `tsx`, not through the Prisma CLI which would
have loaded it via `prisma.config.ts`). Idempotent (find-by-phone-number
before creating, safe to re-run -- confirmed by actually running it
twice, see Testing).

**Creates 28 obviously-fictional customers**, each marked as test data
three independent ways: name prefixed `"(Test) "` (visible in every
list/table), phone number in a reserved sequential `+91 90000 000XX`
block (no real customer would have a sequentially-numbered phone number),
and `notes` explicitly stating `"Development/test customer -- safe to
delete. Not a real customer."` Varied across all 4 `CustomerStatus`
values, 10 Rajasthan cities, and assignment across 2 new test `Agent`
accounts (`Test Agent - Neha Verma`, `Test Agent - Amit Rathore` --
dev-only credentials, documented the same non-secret way as the existing
`admin@conbun.dev` seed) plus the real dev admin plus unassigned, so
"assigned agent" has real variety to test/filter/search against. **No
fake call history was created** -- these are customer records only; any
call history they accumulate going forward (e.g. from the CALL-button
test below) is real, created through the real API, not fabricated.

### Testing (all actually run, against the real Neon database)

- `npm run lint` / `npm run build` -- clean, both checked twice (once
  right after the button/API code, once again after seeding + the full
  live flow test below). New routes confirmed in the build's route list:
  `/api/call-requests`, `/api/call-requests/[id]`.
- `npx prisma validate` / `npx prisma migrate status` -- clean.
- `npm run db:seed-test-customers` run **twice**: first run -- "Created:
  28, already present (skipped): 0"; second run -- "Created: 0, already
  present (skipped): 28" -- confirmed idempotent, not just assumed.
- `GET /api/customers?pageSize=100` (authenticated) -- confirmed `total:
  29` (1 real + 28 test), confirmed by name that the real `"dff"`
  customer is still present, confirmed 28 `(Test)`-prefixed rows exist.
- `GET /customers` (the actual CRM page, real session cookie) -- confirmed
  the rendered HTML contains real test customer names, the real customer,
  and both "Call" and "View" in the same row.
- **Full call-request lifecycle, exactly the 8 numbered checks requested,
  all via real HTTP requests against the live database:**
  1. Opened `/customers` (rendered, confirmed above).
  2. Confirmed test customers visible (confirmed above).
  3. `POST /api/call-requests` (the "Call" button's actual request) for a
     real test customer -- `201`.
  4. Response body inspected: real `id`, correct `customerId`/
     `phoneNumber`/`customerName` snapshot.
  5. `status: "PENDING"` confirmed in that same response.
  6. `GET /api/call-requests?status=PENDING` -- confirmed the new request
     appears in the list.
  7. `PATCH /api/call-requests/{id}` `{"status":"ACCEPTED"}` -- confirmed
     `200`, status changed, and the request no longer appears under
     `?status=PENDING` afterward (re-queried to confirm, not assumed).
  8. `POST /api/calls` with `callRequestId` set -- confirmed `201`, then
     `GET /api/call-requests/{id}` confirmed `callId` was auto-linked and
     matches the real call's id exactly.
  - Continued past the 8 requested checks to close the loop for real:
    `PATCH /api/calls/{id}` (finish, `ANSWERED`, 95s) -- `200`; `PATCH
    /api/call-requests/{id}` `{"status":"COMPLETED"}` -- `200`, final
    state inspected (`status: "COMPLETED"`, `callId` still correctly
    linked).
  - `POST /api/calls/{id}/transcript` on that same call, immediately
    after -- `201`, `processingStatus: "DONE"` -- confirms the existing
    transcript endpoint is genuinely unaffected by any of the above.
- Server stopped after testing (`kill`, confirmed port 3000 free); the
  completed test call/request/transcript above were left in place (tied
  to an already-clearly-marked test customer) as a real, inspectable
  example in the CRM rather than deleted -- not presented as real data,
  since the customer it belongs to is unambiguously marked as test data
  by all three markers above.

### Incomplete / still requiring the next phase

- No Android Kotlin code was added for the call-request queue itself
  (polling/accept/fulfill) -- backend-only this pass, per scope. See
  `ANDROID_API_INTEGRATION.md`'s new "Call request queue" section for the
  exact intended flow and contract, ready to implement against.
- Someone appears to be independently adding `CallStateObserver`/
  `CallSessionTracker` to `ConbunCall_V4` -- noted, not investigated, not
  touched.
- Everything else noted as incomplete in the prior entry (object storage,
  AI provider, GitHub/Vercel deployment, `GET /customers/{badId}`
  200-vs-404) is unchanged.

---

## 2026-08-09 — Remove authentication: straight to the CRM, no login

Explicit instruction: no login/sign-up screen, every page and API route
open, straight to the CRM. This entry records a full, real removal (files
deleted, not just disabled) of everything built in the "V1 backend" entry's
Authentication (Phase 1) section, plus the resulting cleanup across every
route/page/component that referenced it.

**Also noted, not acted on:** `ConbunCall_V4`'s `data/backend/` package
(`BackendRepository`, `BackendDtos`, `BackendApiService`) now has real
`getPendingCallRequests`/`updateCallRequestStatus` methods and DTOs this
session didn't add -- someone is actively building the Android-side
call-request polling in parallel, matching exactly what
`ANDROID_API_INTEGRATION.md`'s "Call request queue" section described as
the next Android task. Left completely untouched. Its login-related code
(`BackendRepository.login()`, the Settings "Sign in" button) now calls a
`404` since this entry deletes that backend endpoint -- flagged clearly in
`ANDROID_API_INTEGRATION.md`'s new warning banner so whoever is working on
that side isn't confused by it silently failing; not fixed here, since
touching `ConbunCall_V4` is outside this pass's explicit CRM-only scope.

### Files deleted

- `proxy.ts` (the page-level auth-redirect middleware, Next.js 16's
  renamed `middleware.ts`) -- no page protection at all now.
- `app/login/page.tsx`, `app/login/page.module.css`
- `app/api/auth/` (entire directory: `login/route.ts`, `logout/route.ts`,
  `me/route.ts`)
- `components/crm/LoginForm.tsx`, `LoginForm.module.css`
- `components/crm/LogoutButton.tsx`, `LogoutButton.module.css`
- `lib/auth/jwt.ts`, `lib/auth/session.ts`
- `jose` npm dependency (`npm uninstall jose`) -- it existed solely for
  JWT signing/verification; confirmed nothing else imported it before
  removing.

### Files modified

- **Every API route that called `requireAuth()`/`requireRole()`** (15
  files: `customers`, `customers/[id]`, `customers/lookup`,
  `customers/[id]/calls`, `customers/[id]/actions`, `calls`, `calls/[id]`,
  `calls/[id]/recording`, `calls/[id]/transcript`, `calls/[id]/summary`,
  `actions/[id]`, `agents`, `agents/[id]`, `call-requests`,
  `call-requests/[id]`) -- the auth-check block and its import removed
  from each handler. Applied mechanically (a script matched the exact
  recurring 2-line pattern across all 15 files at once, verified by
  re-running `npm run lint`/`build` immediately after -- 2 files
  (`agents/route.ts`, `agents/[id]/route.ts`, which also had
  `requireRole` immediately after `requireAuth` with no blank line
  between them) didn't match the script's regex cleanly and were fixed by
  hand afterward, caught by the resulting build errors, not missed
  silently).
- `components/crm/Sidebar.tsx` -- no longer takes `agentName`/`agentRole`
  props (there's no session to read them from); "Agents" nav item shown
  unconditionally instead of role-gated; user-row/avatar/logout footer UI
  removed, back to the static "Conbun Call CRM" footer text.
- `components/crm/Sidebar.module.css` -- removed the now-unused
  `.userRow`/`.userAvatar`/`.userText`/`.userName`/`.userRole` rules.
- `app/(app)/layout.tsx` -- no longer reads the session cookie/verifies a
  JWT; renders `<Sidebar />` directly.
- `app/(app)/agents/page.tsx` -- removed the
  "redirect to `/customers` if not admin" check; renders for anyone.
  Subtitle text updated (no longer claims agents "sign into the CRM").
- `lib/agents/service.ts` -- removed `authenticateAgent()` (only caller
  was the deleted login route); `verifyPassword` import dropped
  accordingly (still exported from `lib/auth/password.ts`, just unused
  now).
- `lib/auth/password.ts` -- kept (still needed: `Agent.passwordHash` is a
  required, non-null schema column, so `createAgent` still hashes
  *something* into it), header comment rewritten to explain why a file in
  `lib/auth/` survives a pass that removed authentication.
- `lib/auth/validation.ts` -- removed `loginSchema` (only caller was the
  deleted login route); `createAgentSchema`/`updateAgentSchema` kept
  (still used by the agents API).
- `app/api/agents/route.ts` -- doc comments updated ("admin only" →
  accurate description of what the endpoint actually does now).
- `app/layout.tsx` -- stale comment about the `/login` page fixed.
- `.env.example` -- "Auth" section rewritten to say `JWT_SECRET` is no
  longer read by anything, instead of documenting how to generate one.
  (The real `.env`'s `JWT_SECRET` value was left alone -- harmless unused
  local variable, not worth touching a secrets file for a cosmetic
  cleanup.)
- `API_DOCUMENTATION.md` -- "Authentication" section rewritten to state
  plainly that there is none; removed 401/403 from the error-status table;
  removed "Admin only" labels from the agents endpoints.
- `ANDROID_API_INTEGRATION.md` -- added a prominent warning banner at the
  top (see "Also noted" above) and updated the device-test walkthrough to
  skip the now-broken Sign In step.
- `CLAUDE.md` -- "Current status" section updated; rule §3.12 rewritten
  from "every route calls requireAuth()" to "there is no authentication,
  don't add it back without being asked"; the architecture-summary line
  claiming "both clients authenticate with tokens" corrected.
- `CRM_ARCHITECTURE.md` -- added a status note at the top of §8
  Authentication marking it removed, without rewriting the section itself
  (kept as the historical design record, same append-don't-rewrite
  convention this file already follows for corrections).

### Database

**No migration.** `Agent.passwordHash` remains a required schema column
(making it nullable, or dropping password/email/role entirely, was not
requested and would be a larger, riskier change than "remove
enforcement") -- `createAgent` still hashes a password into it, it's just
never checked against anything on read anymore.

### Testing (all actually run)

- `npm run lint` / `npm run build` -- clean, re-checked at each stage of
  the removal (immediately after the scripted route edits, again after
  fixing the two hand-missed files, again after the Sidebar/layout/agents
  page rewrites, and a final pass at the end). Route list confirmed via
  the build output: no `/login`, no `/api/auth/*`, no `Proxy (Middleware)`
  line at all (confirming `proxy.ts`'s removal actually took effect, not
  just that the file is gone).
- `npx prisma validate` / `npx prisma migrate status` -- clean (no schema
  change this pass).
- **Live verification, real server, zero credentials presented:**
  - `GET /` → `307` straight to `/customers` (not `/login` -- there is no
    `/login`).
  - `GET /customers` with **no cookie, no `Authorization` header at
    all** → `200`, real seeded test customers and the real customer
    rendered in the HTML.
  - `GET /agents` (previously admin-gated) → `200`, agent list rendered,
    no redirect.
  - `GET /api/customers` with no auth header → `200` with real data
    (previously would have been `401`).
  - `POST /api/call-requests` (the CRM "Call" button's actual request)
    with no auth header → `201`, `status: "PENDING"` -- confirms the
    feature built in the previous pass still works end-to-end with no
    auth in front of it.
  - `POST /api/customers` (Add New User) with no auth header → `201`.
  - The ad hoc customer created by the last check above (not marked as
    test data -- an oversight caught immediately) was deleted right away
    via `prisma db execute`, along with its associated call request;
    re-queried `GET /api/customers` afterward and confirmed the count
    was back to exactly 29 (1 real + 28 clearly-marked test), by name,
    not just by count.
- Server stopped after testing (`kill`, confirmed port 3000 free).

### Incomplete / still requiring the next phase

- If authentication is ever wanted back: `CRM_ARCHITECTURE.md` §8 still
  has the full original design; the deleted files' content is recoverable
  from git history (this repo's own commits) if reconstructing from
  scratch isn't preferred.
- `ConbunCall_V4`'s Settings "Sign in to CRM backend" button now fails
  (404) -- flagged in `ANDROID_API_INTEGRATION.md`, not fixed (Android
  changes are out of scope for a CRM-only pass, and someone else appears
  to be actively working in that codebase right now).
- Everything else noted as incomplete in the prior entry is unchanged.

---

## 2026-08-09 — Fix Vercel production build failure: missing generated Prisma client

**Files created:**
- None.

**Files modified:**
- `package.json` — added `"postinstall": "prisma generate"`.
- `package-lock.json` — regenerated by `npm install`; npm recorded
  `"hasInstallScript": true` for the root package as a result of the new
  `postinstall` script. No dependency versions changed.

**Files deleted:**
- None.

**Decisions made:**
- Root cause: `lib/generated/prisma` (the Prisma Client output configured
  in `prisma/schema.prisma`'s `generator client { output = ... }`) is
  correctly gitignored per the "Prisma-generated client -- generated
  code, not authored" comment in `.gitignore`, and was only ever present
  locally because `prisma generate` had been run manually at some point.
  Vercel's build (`npm install` then `npm run build` == `next build`)
  never ran `prisma generate` on a fresh checkout, so `next build` failed
  resolving `@/lib/generated/prisma/client`.
- Fix: added a `postinstall` script (`prisma generate`) so Prisma Client
  is regenerated automatically as part of every `npm install`, on Vercel
  and locally, immediately before `next build` runs. This is the
  standard, documented approach for Prisma + Vercel and requires no
  schema, architecture, or generated-output-path changes -- `prisma`
  (the CLI) was already a devDependency, and `prisma.config.ts` /
  `prisma/schema.prisma` were untouched.
- Deliberately did not commit `lib/generated/prisma` to git (would
  contradict the existing gitignore comment's intent and the user's
  explicit preference for the standard `prisma generate`-during-install
  approach over committing generated output).

**Tests/builds performed:**
- `rm -rf lib/generated/prisma && npm run db:generate` (clean
  `prisma generate` invocation) -- succeeded, regenerated
  `lib/generated/prisma/client.ts` from `prisma.config.ts` +
  `prisma/schema.prisma`.
- `rm -rf lib/generated/prisma && npm install` -- confirmed the new
  `postinstall` hook fires automatically during `npm install` (the exact
  lifecycle step Vercel's install phase runs) and regenerates the client
  without any extra command.
- `npm run lint` -- passed clean, no output/errors.
- `rm -rf .next && npm run build` -- passed clean: `next build` compiled
  successfully, ran TypeScript with no errors, and generated all 21
  routes (static + dynamic) with no missing-module errors.
- Verified `lib/generated/prisma/client.ts` exists at the path the app
  imports (`@/lib/generated/prisma/client`, resolved via the `@/*` ->
  `./*` path alias in `tsconfig.json`) after the clean regeneration.
- Verified no secret is committed: `.env` is untracked (only
  `.env.example`, containing a placeholder connection string, is
  tracked); `lib/generated/` remains gitignored
  (`git check-ignore -v` confirmed); `git ls-files | grep -i env` shows
  only `.env.example`; `git grep DATABASE_URL` over tracked files shows
  only `process.env` lookups and the placeholder in `.env.example`, no
  real connection string.
- `git diff` reviewed before commit: touches only `package.json` (one
  added line) and `package-lock.json`'s auto-generated
  `hasInstallScript` metadata -- no schema, API, UI, auth, call-request,
  or Android-integration changes.

**Actual results:**
- Local production build (`npm run build`) passes clean from a fully
  clean state (`lib/generated/prisma` removed, `.next` removed, then
  regenerated via the normal `npm install` -> `next build` sequence),
  which is what Vercel's build pipeline runs. This gives high confidence
  the same failure will no longer occur on Vercel.

**Incomplete / still requiring verification:**
- The actual Vercel deployment was not triggered or observed in this
  pass (no Vercel access from this environment). The fix is verified to
  work end-to-end locally under Vercel's exact lifecycle sequence
  (`npm install` -> `npm run build`), and the mechanism (a `postinstall`
  script) is the standard Vercel-recommended fix for this exact class of
  failure, but a live Vercel build should still be watched on the next
  deploy to confirm.

---

## 2026-08-10 — Audit pass: kill the customers-list N+1, normalized phone matching, call-lifecycle display, transcript display

Scope: audit the existing, working CRM and improve it **without** redesigning
it. No architecture was replaced, no endpoint was renamed or removed, and the
CRM → Android call-request mechanism is untouched. Every change below is
additive or a strictly-narrower rewrite of one function.

**Files created:**
- `lib/customers/phone.ts` — `phoneDigits()` / `phoneKey()`. Normalization
  for *lookup only*; `Customer.phoneNumber` remains the source of truth and
  is never rewritten.
- `lib/call-requests/lifecycle.ts` — pure functions deriving one display
  state (`QUEUED`/`DIALING`/`IN_PROGRESS`/`CONNECTED`/`NOT_ANSWERED`/
  `FAILED`/`CANCELLED`/`UNKNOWN`/`NONE`) from the `CallRequest` + `Call` that
  already exist. Nothing is stored; no second call system.
- `prisma/migrations/20260809211453_add_phone_key_and_query_indexes/` —
  hand-edited after `--create-only` to add the backfill and to create the
  replacement indexes *before* dropping the ones they supersede.

**Files modified:**
- `prisma/schema.prisma` — added `Customer.phoneKey` (nullable, indexed);
  added `@@index([crmEntryCreatedAt])` on Customer; replaced
  `Call @@index([customerId])` with `@@index([customerId, startedAt])` and
  `CallRequest @@index([status])` with `@@index([status, requestedAt])`
  (each old index is a strict prefix of its replacement).
- `lib/customers/prisma-store.ts` — maintain `phoneKey` on create/update;
  exact-then-normalized lookup; all-digit search also matches `phoneKey`.
- `lib/calls/service.ts` — new `getCallSummariesForCustomers()` (one raw
  `DISTINCT ON` + partition-`COUNT` query per page); `getCallStatsForCustomer`
  now accepts already-fetched calls; call payload additionally carries
  recording duration/status, transcript text/language, and the linked call
  request.
- `lib/calls/types.ts` — the new fields above, plus `CustomerCallSummary`.
- `lib/call-requests/service.ts` — `createCallRequest` de-duplicates while
  `PENDING`; `listCallRequests` bounded (`limit`, default 200/max 500);
  added `getOpenCallRequestsForCustomers()` and
  `listCallRequestsForCustomer()`.
- `lib/agents/service.ts` — renaming an agent now refreshes the denormalized
  `Customer.assignedAgent` for that agent's customers.
- `app/(app)/customers/page.tsx` — the N+1 removal (see below).
- `app/(app)/customers/[id]/page.tsx` — stats from already-fetched calls;
  `cache()` around the customer fetch shared with `generateMetadata`; Call
  button in the header; "Call request" state card.
- `app/api/call-requests/route.ts`, `app/api/customers/route.ts`,
  `app/api/customers/lookup/route.ts`, `app/api/customers/[id]/calls/route.ts`.
- `components/crm/CustomersExplorer.tsx` (+ CSS) — columns are now
  Customer (name + agent) / Phone / Location / CRM entry / Calls / Last call /
  Status / Actions; no `agents` prop; live call state on the row.
- `components/crm/CallRequestButton.tsx` (+ CSS) — shows the server's view
  ("Queued"/"Dialing"/"In progress"), stays clickable in every state,
  `router.refresh()` after a request.
- `components/crm/CallHistoryTable.tsx` (+ CSS) — transcript text shown in a
  collapsed disclosure row; duration falls back to the recording's own
  duration; "Outcome" wording.
- `API_DOCUMENTATION.md`, `ANDROID_API_INTEGRATION.md` — see "contract" below.

**Files deleted:**
- None.

**Decisions made:**
- **The customers list was doing 2 + N queries.** It called
  `getCallStatsForCustomer` once per row — each one a *full* call-history
  query with four joins — to render two numbers per row. Measured directly
  against the live Neon database: 25 of those took **6.1 s**, out of a
  ~11 s page. Replaced with a single aggregate query for the whole page.
- **`Promise.all` is not the fix here, and was measured to be actively
  worse.** Four trivial queries: ~1.0 s sequential, ~2.6 s wrapped in
  `Promise.all` — this project's Neon adapter effectively serializes
  concurrent queries and pays connection setup per one. So the only lever
  that works is *fewer queries*, and the page is now a fixed four
  (customers, count, call summaries, open call requests) regardless of page
  size. The pre-existing sequential `[await a, await b]` idiom was left
  sequential deliberately, not "fixed" into `Promise.all`.
- **Phone matching was a live defect, not a theoretical one.** Android
  normalizes a number before `GET /api/customers/lookup`; the CRM matched
  exactly. A customer stored as `"+91 90000 00001"` was therefore never
  found for `"+919000000001"`, so no `Call` row was created and the call
  vanished from the CRM. The database showed exactly this: every call request
  for a spaced-number customer was stranded at `ACCEPTED` with `callId:
  null`, while the one customer stored already-normalized
  (`+919335274362`) was the only one with linked calls. Fixed **on the CRM
  side only** — Android is unchanged and sends exactly what it always sent.
- **A stored `phoneKey` column, not an expression index.** Prisma cannot
  represent expression indexes in `schema.prisma`, so a hand-written one
  would show up as drift and a later `migrate dev` would generate a `DROP`.
  A plain indexed column keeps the schema the single source of truth.
  Deliberately **not** unique: existing data can already collide on the last
  10 digits, and a failed migration would be worse than a deterministic
  tie-break (oldest CRM entry wins).
- **`CallRequest.status = COMPLETED` means "dialed", not "call finished".**
  Verified in `ConbunCall_V4`'s `CallSessionTracker.onCallInitiated`: Android
  PATCHes `COMPLETED` the instant `POST /api/calls` returns. Rather than
  change either side, the CRM derives what it displays by combining the
  request's status with the linked `Call.status`. Documented in both API
  docs so the two projects share one reading of the contract.
- **Did NOT change:** the call-request endpoints' paths, methods, request
  bodies, or status vocabulary; `POST /api/calls`'s `callRequestId`
  behaviour; `PATCH /api/calls/{id}`; the transcript/recording endpoints;
  the storage abstraction; authentication (still none, by instruction); the
  Neon/Prisma adapter setup and its no-interactive-transactions constraint.
- **Deliberately not attempted:** switching the Neon adapter to HTTP mode to
  cut cold-start latency (that is an architecture change to a working
  connection layer), and rewriting `dbListCustomers` in raw SQL to fold its
  `count` into the page query (invasive, small payoff).

**API changes (all backward compatible):**
- `GET /api/customers/lookup` — exact match first, then last-10-digits
  fallback. Still 404s for unknown numbers; still never creates a customer.
- `POST /api/customers` — the `409` duplicate check is now normalized, so
  the same number in a different format is rejected instead of creating an
  ambiguous second row. Response shape unchanged.
- `POST /api/call-requests` — idempotent while `PENDING`: returns the
  existing request with `200` instead of queueing a duplicate with `201`.
  Body identical. Android never POSTs here.
- `GET /api/call-requests` — new optional `limit` (default 200, max 500),
  oldest-first as before.
- `GET /api/customers/{id}/calls` and `GET /api/calls/{id}` — added
  `recordingDurationSeconds`, `recordingStatus`, `transcriptText`,
  `transcriptLanguage`, `callRequestId`, `callRequestStatus`. Nothing
  renamed or removed.
- `GET /api/customers` — an all-digits `q` of 4+ digits also matches the
  normalized phone key.

**Database/schema changes:**
- `customers.phone_key TEXT NULL`, backfilled for all 30 existing rows with
  `NULLIF(RIGHT(REGEXP_REPLACE(phone_number,'[^0-9]','','g'),10),'')`.
- New indexes: `customers(phone_key)`, `customers(crm_entry_created_at)`,
  `calls(customer_id, started_at)`, `call_requests(status, requested_at)`.
- Dropped as superseded (prefix-covered by the composites above):
  `calls_customer_id_idx`, `call_requests_status_idx`.

**Tests/builds performed:**
- `npx prisma migrate dev --create-only` → hand-edited SQL → `npx prisma
  migrate dev` → applied to the real Neon database. `npx prisma generate`.
- `npx tsc --noEmit` → exit 0. `npm run lint` → clean. `npm run build` →
  succeeded twice (before and after the last round of changes); all 22
  routes present, every API route dynamic (`ƒ`).
- **Full CRM → Android call-request lifecycle, twice, by `curl` against the
  live Neon database** — once on `next dev`, then again on the production
  build (`npm run start`) after the final build: `POST /api/call-requests` →
  `GET ?status=PENDING` (own request present) → `PATCH ACCEPTED` → `POST
  /api/calls` with `callRequestId` → `PATCH COMPLETED` + `callId` → `PATCH
  /api/calls/{id}` finish → `POST /recording` → `POST /transcript` → `GET
  /api/calls/{id}` showing the whole linked record.
- `PATCH /api/calls/{id}` accepted all three `Instant.toString()` shapes
  Java can emit (`...Z`, `...123Z`, `...123456789Z`) — 200 each.
- Phone matching: `+91 98765 43299` stored, then looked up as
  `+919876543299`, `9876543299`, `09876543299`, and the exact string — all
  resolved to the same customer; an unrelated number still returned 404 and
  created nothing; a duplicate `POST /api/customers` in another format
  returned 409 naming the existing customer.
- Rendered-HTML checks: transcript text present on the detail page; "Call
  request" card and "Connected" state present; "Queued" appears on both list
  and detail while a request is `PENDING`; "Dialing" appears for the real
  pre-existing stranded `ACCEPTED` rows; digit-only search finds a
  spaced-number customer.
- Timings, production build, same machine/database. `/customers`: **~11 s →
  1.3–1.8 s** warm. `/customers/{id}`: ~1.8–2.0 s. `/customers/new`:
  ~0.3–0.4 s. `GET /api/call-requests?status=PENDING`: ~0.3 s.
  `GET /api/customers/lookup`: ~0.6–0.7 s (two round trips when the exact
  match misses and the normalized fallback runs).
- Test data cleaned up: the one audit customer was deleted with
  `npx prisma db execute` (id + phone number both matched in the `WHERE`),
  and cascade removal of its call/request/transcript was verified by 404s.
  Customer count back to the pre-audit 30.

**Actual results:**
- The protected CRM → Android flow behaves identically at every step; the
  only behavioural difference is that a second click while a request is
  still `PENDING` no longer queues a duplicate.
- The stranded-`ACCEPTED` rows already in the database now render as
  "Dialing" in the CRM instead of being invisible — the pre-existing data
  problem is visible rather than silently fixed.

**Incomplete / still requiring verification:**
- **No real Android device test was performed in this pass. No call was
  placed on a phone.** Everything above is `curl` + rendered-HTML
  verification against the real database. The phone-matching fix in
  particular should be confirmed on-device: place a CRM call to a customer
  whose number is stored with spaces (e.g. `+91 90000 00001`) and confirm a
  `Call` row now appears in that customer's history, which is exactly what
  used to fail.
- The new indexes are **created and verified present**, but `EXPLAIN` still
  shows sequential scans — at 30 rows Postgres correctly prefers them. Their
  value is for the "many customers" requirement and is unproven at this data
  size.
- Neon cold start (~2.5–9 s after the compute auto-suspends) is unchanged
  and is not a code problem; it dominates the first request after an idle
  period.
- Not deployed to Vercel in this pass; production configuration was reviewed
  (no `localhost`/LAN IP/dev-only env var/filesystem dependency anywhere in
  `app/`, `lib/`, `components/`; only `DATABASE_URL` and `NODE_ENV` are read)
  but the live deployment was not exercised.

---

## 2026-08-11 — Call-result contract, call-detail UI, and the `include` fan-out

Incremental improvement pass on the working CRM. Nothing was redesigned, no
working functionality was removed, and the Android calling flow was preserved
end to end — `ConbunCall_V4` was read as reference only and **not modified**
(CLAUDE.md §1/§3.9).

**Files created:**
- `SUMMARY_CONTRACT.md` — what a call summary must contain, how it must be
  grounded in the transcript, and the English-only output rule for
  Hindi/English calls. Specification for whoever *generates* summaries (today
  Conbun Call's own OpenAI provider); the CRM stores and displays without
  validating, and still fabricates nothing.
- `prisma/migrations/20260810205139_add_call_answered_at_and_failure_reason/`
  — two nullable columns on `calls`, nothing else.

**Files modified:**
- `prisma/schema.prisma` — `Call.answeredAt`, `Call.failureReason`.
- `lib/calls/service.ts` — rewritten around hand-written joined SQL; new
  `callExists`, `getCustomerCallOverview`, `getCustomerCallOverviews`.
- `lib/calls/types.ts`, `lib/calls/validation.ts` — new optional fields.
- `lib/call-requests/service.ts` — single-statement conditional create;
  `getOpenCallRequestsForCustomers` folded into `getCustomerCallOverviews`.
- `lib/actions/service.ts` — `listActionsForCustomer` joins instead of
  `include`.
- `lib/transcripts/service.ts`, `lib/ai-summaries/service.ts` — retry
  semantics fix (see below).
- `app/api/calls/route.ts`, `app/api/calls/[id]/{transcript,summary,recording}/route.ts`,
  `app/api/customers/[id]/calls/route.ts`.
- `app/(app)/customers/page.tsx`, `app/(app)/customers/[id]/page.tsx` (+ its
  CSS module), `components/crm/CallHistoryTable.tsx` (+ CSS),
  `components/crm/StatCard.tsx` (+ CSS, new `compact` variant).
- `API_DOCUMENTATION.md`, `ANDROID_API_INTEGRATION.md`.

**Files deleted:**
- None.

**Decisions made:**

1. **The real bottleneck was Prisma's `include`, not query count in the
   abstract.** Prisma does not join `include`d relations — it issues one extra
   SQL statement per relation. With the five relations a call needs that is
   six serialized round trips for one logical read, and this project's Neon
   adapter serializes statements (the same property that makes `Promise.all`
   *slower* here — 2026-08-10 entry). Measured with query logging against the
   live database before changing anything:

   ```
   call.findMany (no include)     386 ms   1 SQL
   call.findMany (5 includes)    2766 ms   6 SQL
   action.findMany (1 include)    630 ms   2 SQL
   ```

   Every call read is now one hand-written `LEFT JOIN` query. Safe by
   construction: all five relations are to-one (`@unique` on `call_id`, or a
   plain FK), so a join cannot duplicate a call row. Enum columns are cast to
   `text` for the same adapter reason `getCallSummariesForCustomers` already
   documented.

2. **`answeredAt` and `failureReason` added rather than reused.** Neither is
   derivable from what exists: `durationSeconds > 0` says a call connected but
   never when, and `CallStatus` says *what* happened but carries no detail.
   Both nullable, both optional everywhere, never inferred — the CRM will not
   guess an answer time from a duration. `ConbunCall_V4` sends neither today
   and is unaffected.

3. **Deliberately did NOT add a "CRM sync state" column.** The requested
   `SYNCED / PENDING / FAILED` vocabulary describes whether *Android* has
   pushed a stage to the CRM — a fact only the phone can know, and one it
   already tracks (`CrmCallActivityRepository`, `BackendSyncScheduler`'s retry
   queue). From the CRM's side, the row existing *is* the synced state; a
   column here could only ever be a second, always-`SYNCED` copy — exactly the
   duplicate source of truth the rules forbid.

4. **Deliberately did NOT add a partial unique index** on
   `call_requests (customer_id) WHERE status = 'PENDING'`. It would close the
   duplicate-request race completely, but Prisma cannot express a partial
   unique index in `schema.prisma`, so schema and database would permanently
   disagree about an index Prisma can't see — a bad trade for a project whose
   CLAUDE.md tells every session to run `prisma migrate dev`. Instead the
   pending check moved *inside* the `INSERT` (`INSERT ... SELECT ... WHERE NOT
   EXISTS`), shrinking the race window from a full network round trip (~350 ms)
   to the statement itself, and dropping the new-request path from three
   statements to one. Reported as a residual risk rather than claimed as a
   guarantee.

5. **Status vocabulary unchanged.** No existing status was renamed. The
   requested QUEUED/DIALING/RINGING/CONNECTED/... vocabulary is still *derived*
   by `lib/call-requests/lifecycle.ts` from the two records that already
   describe it. RINGING is still not represented, honestly: nothing on either
   side reports it — Android marks a request `COMPLETED` at dial time and the
   OS `CallLog` has no ring event — so inventing the state would mean
   displaying something no one measured.

6. **Call-detail UI: same visual language, different proportions.** The
   customer profile moved from a 300px sticky sidebar (a quarter of the width,
   the full height of the page) into a compact band across the top; the
   separate "Call request" card folded into that band as one line of state.
   The freed width went to call history, which gained a per-row expander
   showing that call's timings, call request, recording metadata, transcript,
   summary and follow-up in place. Same `Card`/`Badge`/`Avatar` primitives,
   same tokens, same 13px table density — no redesign.

7. **Bounded the call history, kept the stats unbounded.** The detail page and
   `GET /api/customers/{id}/calls` used to load every call a customer ever had,
   transcript text included, and then count six numbers from it in JavaScript.
   The list is now the latest 25 (`?limit=`, max 200) while the aggregates are
   computed in Postgres over *all* calls, in the same statement. A `truncated`
   flag says when the list is a subset.

8. **Retry semantics fixed for transcripts and summaries** (a real bug this
   pass's tests found, not a refactor): submitting real text with no explicit
   `processingStatus` now clears an earlier `FAILED` on the *update* path, as
   it already did on create. Before, a transcript or summary that failed once
   and then succeeded kept `FAILED` forever while holding the finished text.
   The opposite direction was already correct and stays correct — a
   `{"processingStatus":"FAILED"}` submission carries no text and so never
   erases a stage that had worked.

**Tests/builds performed:**
- `npx tsc --noEmit`, `npm run lint`, `npm run build` — all clean.
- `npx prisma migrate dev` — applied to the real Neon database.
- Service-layer equivalence harness against the live database: created a real
  call + transcript + summary + recording, compared the new joined loader
  field-by-field against the old Prisma `include` result, then deleted the
  fixtures. ~60 assertions, all passing — including `text[]` (`keyPoints`)
  round-tripping through `$queryRaw` with commas and quotes intact, stats
  matching a plain count, bounded reads keeping full-history stats, and
  batched open-call-request lookups matching the previous implementation
  customer by customer.
- HTTP lifecycle suite against `npm run start`, walking the Android flow in
  order: lookup (four number formats) → Call button → poll → accept → start →
  finish → recording → transcript → summary → pages. **62 of 63 checks pass.**
- Statement-count measurement with Prisma query logging, before vs after.
- Before/after page latency measured over HTTP by stashing this pass's changes,
  rebuilding at `HEAD`, and measuring the same routes.

**Actual results:**

SQL statements per request (the metric that matters — the adapter serializes
them, and wall-clock from this machine swings ±300 ms per round trip):

| | before | after |
|---|---|---|
| customer detail page | 10 | 4 |
| customers list page (25 rows) | 4 | 3 |
| `GET /api/customers/{id}/calls` | 7 | 2 |
| `PATCH /api/calls/{id}` — the call result | 6 | 2 |
| `POST /api/calls` — call start | 7 | 3 |
| `POST /api/calls/{id}/transcript` | 8 | 3 |
| `POST /api/calls/{id}/recording` | 8 | 3 |
| `POST /api/calls/{id}/summary` | 8 | 3 |
| `POST /api/call-requests` — Call button, new request | 3 | 1 |

Wall clock over HTTP, mean of 5, same machine and same data, `HEAD` vs this
pass:

| route | before | after |
|---|---|---|
| `GET /customers` | 1463 ms | 1221 ms |
| `GET /customers/{id}` | 2463 ms | 1705 ms |
| `GET /api/customers/{id}/calls` | 1874 ms | 1470 ms |
| `GET /api/call-requests?status=PENDING` | 305 ms | 377 ms |

The Android poll is untouched code and the difference is noise (the framework
floor, `/api/health`, measured 7 ms before and 6 ms after). Wall-clock gains
are smaller than the statement counts suggest because this dev machine is far
from the Neon region and per-statement latency varies from 265 ms to 967 ms
between identical trivial queries; the statement counts are the durable
result, and they should show up larger on Vercel where the round trip is
short and consistent.

Idempotency, verified live: five simultaneous `POST /api/call-requests` for
one customer → exactly one `PENDING` row; three concurrent service-level
calls → one request id. Sequential repeat presses still return `200` with the
existing request, as before.

Independence, verified live: with a call `ANSWERED` (137 s) plus a registered
recording and a stored transcript, marking the summary `FAILED` left the call,
its duration, the recording and the transcript intact and flagged only the
summary; marking the transcript `FAILED` did not erase its text; a later
successful summary submission cleared the `FAILED`.

The database was left exactly as it was found (32 customers, 3 agents, 4
calls, 18 call requests, 1 transcript, 0 recordings, 0 summaries, 0 pending
requests) — every fixture created during testing was deleted.

**Incomplete / still requiring verification:**

- **No real-device test was performed this pass.** No Android code was
  changed and no phone was involved; the CRM↔Android contract was exercised
  over HTTP against a real server with exactly the payloads
  `ConbunCall_V4` sends, which is not the same thing as a device run.
- **One known failing check, pre-existing and unrelated:**
  `GET /customers/<unknown-id>` renders the correct "Customer not found" page
  but with HTTP `200` instead of `404`. Confirmed identical on `HEAD` by
  rebuilding the pre-change code and measuring it — Next.js has already begun
  streaming the response by the time `notFound()` is reached. Not introduced
  here and deliberately not chased, since it is a framework/streaming
  behaviour rather than an application bug.
- **The duplicate-request race is narrowed, not eliminated** — see decision 4.
- **14 `ACCEPTED` call requests with no linked call** still sit in the
  production database, stranded from before the 2026-08-10 phone-lookup fix.
  Left untouched: they are historical evidence, they are not `PENDING` so
  Android will not redial them, and deleting production rows was not in scope.
- `answeredAt` has no producer yet. It is stored and displayed correctly when
  sent (verified), but nothing sends it until the Android side can observe a
  real off-hook moment.

---

## 2026-08-12 — Client navigation cache, intent-based prefetch, and the self-updating active call

Second half of the improvement sprint begun on 2026-08-11. The 08-11 entry
made each page *cost* less (fewer SQL statements per request); this pass makes
navigation *avoid* the server where it safely can, and makes the one workflow
where data arrives on its own — a live call — update the page without anyone
touching the browser's refresh button.

Nothing was redesigned, no working functionality was removed, no existing API
changed, and `ConbunCall_V4` was **not modified** (CLAUDE.md §1/§3.9). The
code below was written in an earlier session that ended before it could be
verified or written up; this entry records the verification, which was run in
full against the real Neon database, plus the documentation and cleanup that
were still outstanding.

**Files created:**
- `lib/calls/pulse.ts` — pure functions (no database, no React) answering two
  questions: has anything about this customer's calling changed (`version`),
  and is anything still expected to arrive (`active`).
- `app/api/customers/[id]/call-status/route.ts` — the CRM-only probe that
  serves those two answers.
- `components/crm/CallActivityRefresher.tsx` — customer-detail watcher.
- `components/crm/CallQueueRefresher.tsx` — customers-list watcher.
- `components/crm/HoverPrefetchLink.tsx` — prefetch on intent.

**Files modified:**
- `next.config.ts` — `experimental.staleTimes`.
- `components/crm/CallRequestButton.tsx` — optimistic Call button.
- `components/crm/CustomerForm.tsx` — cache invalidation on create.
- `app/(app)/customers/[id]/page.tsx`, `components/crm/CustomersExplorer.tsx`
  — mount the watchers, use the prefetching link.
- `components/crm/CallActivityRefresher.tsx` + the detail page's use of it —
  first-poll baseline changed from `lifecycle` to `version` (bug fix, see
  decision 10).
- `API_DOCUMENTATION.md`, `ANDROID_API_INTEGRATION.md` — document the new
  route and state plainly that Android must not call it.

**Files deleted:**
- None.

**Decisions made:**

1. **The browser cache is Next.js's own Client Cache, switched on — not a new
   library.** Both CRM pages are `force-dynamic`, and since Next.js 15 the
   client-cache TTL for dynamic pages defaults to **0 seconds**, i.e. off. So
   every "back to the list", every "open the customer I was just looking at",
   was a full server render and a fresh set of round trips no matter how cheap
   the queries had been made — precisely the navigation loop the sprint is
   about. `staleTimes: { dynamic: 30, static: 180 }` fixes that with a config
   key rather than a dependency (CLAUDE.md rule #6). Confirmed valid in the
   installed Next.js 16.3.0, not a stale option: `node_modules/next/dist/
   server/config-shared.d.ts` still lists `staleTimes` under `experimental`,
   and Next's bundled docs confirm the `dynamic` default of 0.

2. **30 seconds, not longer, and every mutation clears it.** 30s is the
   ceiling on how stale anything can look while nothing is happening; while a
   call *is* in flight staleness is handled by the watcher below rather than
   by a timer. All five client mutation paths call `router.refresh()`, which
   drops the cached payloads immediately: `CustomerForm` (create),
   `CallRequestButton` (call), `AgentsTable` (×2), `FollowUpList` (×2). The
   create path needed the addition — an agent who had just been on
   `/customers` would otherwise land back on a cached list predating the
   customer they had only just created, the one case where "instant" would be
   plainly wrong.

3. **Prefetch on intent, never on viewport.** Next.js only prefetches a
   dynamic route down to its `loading.tsx` boundary, so a plain `<Link>`
   prefetched the skeleton and clicking still waited on the server;
   `prefetch={true}` prefetches dynamic routes in full. But `<Link>` prefetches
   on entering the viewport, so `prefetch={true}` on a 25-row list would render
   25 full customer detail pages server-side — call history, stats and all — to
   serve one click. That is exactly the "prefetch huge call histories for every
   customer" the sprint forbids. `HoverPrefetchLink` arms on hover/focus/touch
   instead, so the database only does the work for a customer the agent has
   actually pointed at. Intent is sticky, so sweeping the cursor back over a
   row doesn't re-request it. **Prefetching is production-only in Next.js** —
   this does nothing under `next dev`, by the framework's design.

4. **The active-call watcher polls a fingerprint, not the page.** A poll that
   finds nothing new costs ~80 bytes and repaints nothing; the expensive part
   (`router.refresh()`, which re-runs the page's four queries) happens only
   when the fingerprint actually changed. The alternative — refreshing the page
   on a timer — would have re-rendered the whole customer detail page every few
   seconds whether or not anything moved.

5. **The server decides when polling stops, and the honest stop condition is
   a deadline.** `active: false` ends the loop and the client obeys it. A
   quiet customer returns `active: false`, so an idle CRM makes **zero**
   requests — the common case. A call that connected is watched only while a
   recording, transcript or summary could still land, and for at most 15
   minutes after it last changed: a call that simply never produced a recording
   (most calls — audio never leaves the phone unless Android finds and reports
   a file) is indistinguishable from one whose recording is still coming, so a
   deadline is the only truthful way to stop. Past it the data still appears on
   the next navigation; only the automatic watching ends.

6. **An unanswered call is not watched at all.** A `MISSED`/`REJECTED`/
   `FAILED` call has no conversation to record, transcribe or summarize, so
   waiting a quarter of an hour on its pipeline would mean polling on every
   unanswered call — a great many of them — for something that can never
   arrive. Verified: a missed call returns `active: false` immediately.

7. **The Call button is optimistic, and says so honestly.** It now shows
   "Queued" on the click itself rather than after the round trip (~324 ms
   measured). Creating a request is a single `INSERT` that either works or
   404s, and the agent is waiting on the *request* being queued, never on the
   phone call. On failure the button says "Retry call"; it never claims the
   call connected.

8. **The list watcher refreshes directly; the detail watcher does not.** A
   list-wide fingerprint would need its own batch endpoint, and the window the
   list actually waits on is the handful of seconds between clicking Call and
   Android's 4-second poller picking the request up. Refreshing outright is the
   simpler reliable thing there — which is why its cadence is slower (6s→24s
   versus 3s→20s) and its ceiling is 5 minutes.

9. **Deliberately did NOT add websockets, SSE, or a polling library.** The
   only thing that changes on its own is one customer's call, watched by one
   tab, for minutes at a time. Both watchers back off, pause in a hidden tab,
   check immediately on return, and stop; that covers the requirement without
   a persistent connection per open tab or a dependency (CLAUDE.md rule #6,
   and §24's "choose the safer incremental solution").

10. **Bug fixed in the watcher's first poll — a real hole in exactly the
    behaviour this pass exists to provide.** The refresher compared its first
    poll against the *lifecycle* the page rendered with, on the reasoning that
    it should catch a call that finished between render and mount. But a
    recording, transcript or summary landing in that same window does **not**
    change the lifecycle — `CONNECTED` stays `CONNECTED` — so the comparison
    saw no change; and because the fingerprint then stayed constant from that
    point on, no later poll could detect it either. The stage would have stayed
    invisible until the agent navigated away and back: precisely the manual
    refresh the sprint is meant to remove, in the narrow-but-real window when
    stages are actually arriving. The page now passes its own
    `callActivityPulse(...).version` and the first poll compares against that.

    Safe to compare because both sides compute the fingerprint over identical
    row sets — the page reads 25 calls (`CALL_HISTORY_PAGE_SIZE`) and 5
    requests (`listCallRequestsForCustomer`'s default), and the endpoint's
    `UNION ALL` uses the same two limits. Had they differed, every page load
    with an active call would have fired one spurious refresh; verified
    they don't, then verified live that a transcript arriving moves the version
    while the lifecycle stays `CONNECTED`.

**Tests/builds performed** — all actually run this pass, not reviewed:
- `npx tsc --noEmit`, `npm run lint`, `npm run build` — all clean.
- `npx prisma migrate status` — 6 migrations, "Database schema is up to
  date". (The first attempt returned `P1001`; the Neon compute was asleep and
  answered on the retry. DNS and TCP:5432 were confirmed reachable first.)
- **End-to-end HTTP suite against `npm run start` and the real Neon database:
  69 checks, 69 passed, 0 failed.** It walks the Android flow in order —
  create customer → lookup (4 number formats) → Call button → concurrent-press
  burst → Android poll → accept → `POST /api/calls` → call result → recording →
  transcript → summary → pages — asserting the pulse at every stage.
- Latency measured over 8 runs per route after warm-up.
- **Re-run after the decision-10 fix: rebuilt, restarted, 13 further checks,
  13 passed, 0 failed** — the same lifecycle walk plus an explicit assertion
  of the case the fix addresses (a transcript arriving must move `version`
  while `lifecycle` stays `CONNECTED`), and that the page then renders the
  transcript and summary.

**Actual results:**

The pulse, which is the new thing and therefore the thing that had to be
proven:

| stage | `lifecycle` | `active` |
|---|---|---|
| customer with no calls | `NONE` | **false** (idle CRM polls nothing) |
| Call clicked | `QUEUED` | true |
| Android accepted | `DIALING` | true |
| `POST /api/calls` | `IN_PROGRESS` | true |
| result `ANSWERED` | `CONNECTED` | true (stages may still arrive) |
| recording + transcript + summary all done | `CONNECTED` | **false** (stops) |
| result `MISSED` | `NOT_ANSWERED` | **false** (stops immediately) |

`version` changed at every real transition and was **stable across repeated
polls when nothing changed** — the property that stops a refresh loop.

Latency, medians over 8 runs from this dev machine (far from the Neon region;
per-statement latency here is 265–400 ms, so these are round-trip counts more
than they are wall-clock verdicts):

| route | median | min | max |
|---|---|---|---|
| `/api/health` (framework floor) | 13 ms | 9 | 170 |
| `/api/customers/{id}/call-status` | **384 ms** | 264 | 2009 |
| `/api/call-requests?status=PENDING` | 366 ms | 269 | 414 |
| `/api/customers/{id}/calls` | 613 ms | 518 | 830 |
| `/customers` (page) | 1040 ms | 1002 | 3907 |
| `/customers/{id}` (page) | 1622 ms | 1426 | 1695 |

The probe costs one round trip, as designed. First-hit outliers (2009 ms,
3907 ms) are cold route compilation plus connection warm-up, not steady state.

Data integrity, verified live: 5 simultaneous Call presses → exactly one
`PENDING` request id (repeats return `200`, not a duplicate `201`); repeat
transcript, summary and recording deliveries each returned the same row id
rather than creating a second row; `keyPoints` round-tripped through
`$queryRaw` with embedded commas and quotes intact; a `FAILED` summary left
the call, its 137 s duration, the recording and the transcript untouched, and
a later successful submission cleared the `FAILED`; a 0-second `MISSED` call
stored 0 s and rendered as "Not answered", never as an answered call.

**Database left as found — and cleaner.** The verification runs created three
clearly-marked `ZZ VERIFY … (auto-delete)` customers and deleted them all. They
also removed four `ZZ TEST … (delete me)` customers (with their 4 calls, 4
transcripts, 4 recordings, 3 summaries and 4 requests) that the interrupted
session had left stranded in the live database. Census after: **35 customers,
3 agents, 4 calls, 34 call requests, 1 transcript, 0 recordings, 0 summaries,
0 actions, 0 pending requests.** Every real customer was left untouched —
including the three added since the 08-11 entry (Kewalya, Saurabh,
dharmendra) and the seeded `(Test) …` development block, which is deliberately
kept.

**Incomplete / still requiring verification:**

- **No real-device test was performed this pass**, again. The contract was
  exercised over HTTP with exactly the payloads `ConbunCall_V4` sends, which
  is not the same as a phone placing a real call. The auto-refresh in
  particular has been proven at the API level (the pulse transitions above)
  but not yet watched on a screen while a real call runs.
- **The browser cache was verified by configuration and framework
  documentation, not by driving a browser.** `staleTimes` is confirmed a valid
  Next.js 16.3.0 option and the invalidation calls are all in place, but no
  automated test measures a real back-navigation being served from the client
  cache. That needs a browser session, and is the most valuable thing to check
  on the deployed CRM.
- **Hover prefetch does nothing in `next dev`** — prefetching is production-
  only in Next.js. Judge it on Vercel, not locally.
- The duplicate-request race is still narrowed rather than eliminated (see
  the 08-11 entry, decision 4) — unchanged this pass.
- `GET /customers/<unknown-id>` still returns HTTP `200` with the correct
  "Customer not found" page. Pre-existing, framework streaming behaviour,
  deliberately not chased.
- 14 `ACCEPTED` call requests with no linked call remain in the production
  database from before the 08-10 phone-lookup fix. Still deliberately
  untouched: they are historical evidence and are not `PENDING`, so Android
  will not redial them.
- `answeredAt` still has no producer; it is stored and displayed when sent.

---

## 2026-08-12 — Call History: "View" for stored transcript/summary, and "Not available" instead of "Failed"

**Files created:**
- None.

**Files modified:**
- `components/crm/CallHistoryTable.tsx` — Transcript and Summary columns now
  offer a **View** button when content is actually stored; the badge is kept
  only for the cases where there is nothing to open. Replaced `pipelineBadge()`
  with `contentBadge()` for these two columns.
- `components/crm/CallHistoryTable.module.css` — added `.viewButton` and
  `.panelFocused`.

**Files deleted:**
- None.

**Decisions made:**
- **Scope was display only.** No API, schema, migration, call-lifecycle,
  recording/transcription/summary-processing or Android change. Nothing is
  fetched or generated by a View click: the transcript and summary strings are
  already on the `Call` objects the page hands this component (one joined
  query, `CALL_COLUMNS` in `lib/calls/service.ts`), so View is pure local
  state.
- **The existing expandable detail row is the viewer**, per the "same Call
  Detail experience" requirement — no modal, no second page, no new route.
  View opens that row and scrolls to the Transcript or AI summary panel, which
  gets a temporary outline so the eye lands in the right place in a row that
  has six panels. The chevron still toggles the row exactly as before.
- **"Failed" no longer appears for a transcript or summary that has no
  content** — it now reads "Not available". The old behaviour showed the
  pipeline's `FAILED` status in the column, which reads as "something broke,
  go chase it" for what is usually just a call with nothing to show (a missed
  call, most often). `PENDING`/`PROCESSING` still say "Waiting"/"Working",
  because there genuinely is something to wait for. The two panels' empty-state
  prose was reworded to match.
- **Recording deliberately untouched**, including its "Failed" badge — out of
  scope for this pass by explicit instruction.
- No new dependency (CLAUDE.md rule #6). Notably, no headless browser or test
  runner was added just to click a button — see the verification gap below.

**Tests/builds performed:**
- Read-only DB inspection of the 8 most recent calls (throwaway script, deleted
  after; reported lengths and presence only, never content).
- `npx tsc --noEmit` — clean.
- `npm run lint` — clean.
- `npm run build` — succeeded, all 23 routes.
- `npm run start` + `curl` of the real customer detail page for the call at
  **2026-08-12 04:04:44 IST** (`2f0e3555`, customer `eef0e5a1`), plus
  `GET /api/customers/{id}/calls`.

**Actual results:**
- Both are genuinely stored for that call: transcript `DONE`, 2679 chars;
  summary `DONE`, 348 chars + 4 key points, `generated_at` 22:44:20Z.
- The CRM was already reading both and already handing both to the UI —
  `/api/customers/{id}/calls` returns 2679/348 chars, and the server-rendered
  page delivers the full transcript to the browser (React Flight sends it as a
  referenced text row, `$1e9` → a 6127-byte Text row; the short `$`-prefixed
  value in the payload is the reference token, not a truncated transcript).
  So this was a **discoverability** fix, not a broken data path.
- The rendered page now shows 4 View buttons (2 calls × transcript+summary),
  2 "Not available" badges on the 03:38 IST missed call (`455b6a49`, whose
  transcript and summary rows are both `FAILED` with no text) — where it
  previously showed "Failed" — and 1 remaining "Failed", which is that call's
  recording badge, intentionally left alone.

**Incomplete / still requiring verification:**
- **The click itself was not exercised in a real browser.** The project has no
  test runner and no headless browser, and adding one for this was out of
  scope. Verified: the buttons render, with the right count, on the right rows,
  and the content they open is present in the client payload. Not verified by
  execution: that clicking View expands the row and smooth-scrolls to the
  panel. Worth one manual click on `/customers/eef0e5a1-c67e-4ab0-863d-1491643cd208`.
- Unchanged and still true from 2026-08-10: `answeredAt` has no producer, and
  the 14 stale `ACCEPTED` call requests remain untouched.
