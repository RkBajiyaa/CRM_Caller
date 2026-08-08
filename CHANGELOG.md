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
