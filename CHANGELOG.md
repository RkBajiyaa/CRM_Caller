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
