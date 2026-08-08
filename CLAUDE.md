# CLAUDE.md — Working Instructions for the Conbun CRM Project

This file contains **permanent, standing instructions** for any Claude Code
session working in this folder. It applies to every session, every task,
until the user changes it.

> **Correction (2026-08-08):** an earlier version of this file assumed CRM
> would be built as screens inside the Android app (`ConbunCall_V4`). That
> assumption was **wrong** and has been superseded — see §0 below and
> `CHANGELOG.md` for the correction record. Everything past this point
> reflects the corrected architecture.

## Current status (2026-08-09)

**V1 backend + CRM UI are implemented and tested against the real Neon
database** — not a plan. Agents, Customers, Calls, Call requests
(CRM "Call" button → Android pending-request queue), Recordings (metadata
only), Transcripts, AI summaries (structure only, nothing fabricated), and
Follow-up Actions all have real tables, real API routes, and a real UI.
See `API_DOCUMENTATION.md` for the tested contract, `CHANGELOG.md` for
exactly what was verified and how, and `ANDROID_API_INTEGRATION.md` for
the Android side. Postgres provider is **Neon** (locked, not TBD); ORM is
**Prisma**. Not yet pushed to GitHub or deployed to Vercel.

**No authentication.** By explicit instruction, JWT auth, the login page,
and the page-level auth gate were removed after initially being built —
every page and API route is open, no sign-in step (see `CHANGELOG.md`'s
"remove authentication" entry). `Agent` records still exist (still needed
for `assignedAgentId`/`agentId` references), just no longer as a login
identity.

## 0. What this folder is

This folder (`Conbun CRM `) is **its own independent project**: the future
**Conbun CRM web application and backend/API**. It is not part of, and does
not live inside, the Android app.

- **This project is a web app + API**, built with its own frontend and
  (initially) its own backend/API layer in the same codebase if that proves
  the right shape (see `CRM_ARCHITECTURE.md`). It is **not** an Android
  app, has no Kotlin/Compose code, and is not built with Gradle.
- **It will be pushed to GitHub and deployed via Vercel.** Treat it as a
  normal web repo from the start (package manager lockfile, `.gitignore`,
  environment variables via Vercel project settings / `.env.local`, not
  hardcoded secrets).
- **Its data lives in a server-side Postgres database (Neon, connected)**,
  reached only through this project's own backend/API via Prisma. Neither
  the CRM frontend nor the Android app talk to the database directly.
- See `CRM_ARCHITECTURE.md` in this folder for the full architecture:
  frontend, backend/API, database, customer data model, auth, API contract,
  deployment, and implementation phases.

## 1. The Android app is a separate project — hard boundary

- **`/home/rkbajiyaa/Project/ConbunCall_V4`** is the existing Android call/
  recording/transcription/AI app. It is a **separate project** with its
  own `CLAUDE.md`/`CHANGELOG.md` and its own working rules.
- **Do not build CRM screens inside `ConbunCall_V4`.** Do not copy it into
  this folder. Do not treat this folder and that project as one codebase.
- **Do not modify `ConbunCall_V4`** while working in this folder, unless
  the user explicitly asks for an Android-side API-integration change in a
  separate, clearly-scoped task. Read it **only as a reference** — e.g. to
  see what its existing `data/crm/` scaffolding (DTOs, Bearer-token
  pattern) already expects from a backend, so this project's API contract
  can be compatible with it later.
- Two older Android copies exist alongside it (`ConbunCall_v3`,
  `ConbunCall-updated`) — not current, not relevant to this project.

## 2. The intended system architecture

```
Android Agent App  --HTTPS API-->  Backend API  <-->  Central Database
                                        ^
                                        | HTTPS API
                                        |
                                  CRM Web Application
```

- The backend/API is the **only** thing that talks to the database.
- The Android app never writes directly to the production database; it
  keeps using its own existing local repositories/cache for on-device
  operation, and will eventually sync through the backend API (a future,
  separately-approved integration task).
- The CRM web frontend never talks to the database directly either — it
  calls this project's own backend/API, same as the Android app would.
- Neither client authenticates to the backend — there is no
  authentication in this build (§3 rule 12 below; `CRM_ARCHITECTURE.md`
  §Authentication describes the JWT design that was built, then removed).

## 3. Non-negotiable rules for this project

1. **Customer identity:** `customerId` is stable and backend/system
   generated. Phone number is a lookup/matching field, **never** the
   permanent identity of a customer.
2. **Customer profile data is separate from call-history data** in the
   data model, even though both eventually live in the same database.
3. **`assignedAgent` (who currently owns the customer) and the calling
   agent on an individual call (`Call.agentId`) are separate concepts** —
   never the same field. A real `Agent` directory exists now
   (`assignedAgentId`); `Customer.assignedAgent` (text) stays denormalized
   from it for backward-compatible display, not a second source of truth.
4. **`accountCreatedAt` (application/account creation) and
   `crmEntryCreatedAt` (first created in the CRM) are separate fields.**
   `crmEntryCreatedAt` is never "last login."
5. **`customerId` and `crmEntryCreatedAt` are always backend-generated**,
   never accepted as input from the Add New User form or any client.
6. **No unnecessary dependencies.** Every framework/library choice in
   `CRM_ARCHITECTURE.md` must have a stated reason; flag anything not yet
   confirmed rather than assuming it.
7. **No production database access from either client app.** All reads/
   writes go through the backend/API.
8. **Small, isolated, verifiable changes**, one implementation phase at a
   time (see `CRM_ARCHITECTURE.md` §Implementation Phases), each with its
   own `CHANGELOG.md` entry.
9. **Do not modify `ConbunCall_V4`** except in an explicitly-scoped,
   separately-approved Android-integration task.
10. **Never print, log, or commit `DATABASE_URL`, `JWT_SECRET`, or any
    agent password/token** — check them structurally (e.g. `grep -q
    "<placeholder>"`) when verifying config, never `cat`/echo the value.
11. **This environment's Neon adapter cannot open the WebSocket session
    Prisma's interactive transactions need** (`upsert()`, `$transaction([...])`)
    — confirmed via `prisma/seed.ts` failing until rewritten around it. Use
    plain sequential `findUnique` + `create`/`update` instead; see
    `lib/customers/prisma-store.ts`'s comment for the exact pattern. Revisit
    if this environment's networking ever changes, but don't assume it has.
12. **There is no authentication.** `lib/auth/jwt.ts`, `lib/auth/session.ts`,
    every `/api/auth/*` route, `proxy.ts`, and the login page were all
    deleted (explicit instruction) — every page and API route is open by
    design, not by omission. Don't add a `requireAuth()`-style check back
    into a route "for consistency" without being asked; that's exactly
    what was removed. `lib/auth/password.ts` (bcrypt hashing) survives
    only because `Agent.passwordHash` is still a required schema column.

## 4. Documentation workflow

- Every planning or implementation pass gets a dated entry in
  `CHANGELOG.md` in this folder, following the template at the top of that
  file. Append; don't rewrite past entries — correct a factual error with
  a visible correction note (as done at the top of this file) rather than
  silently editing history.
- Keep this file stable. Fold new standing rules in here only when the
  user explicitly asks; task-specific notes belong in `CHANGELOG.md` or
  `CRM_ARCHITECTURE.md`.

## 5. Session start checklist

1. Read this file.
2. Read `CHANGELOG.md` (this folder) for what's already been decided/done.
3. Read `CRM_ARCHITECTURE.md` (this folder) for the current architecture
   and open decisions.
4. If a task genuinely requires looking at the Android app (reference only,
   per §1): read `ConbunCall_V4/CLAUDE.md` first and follow its own rules
   while there — but do not edit it as part of CRM work.

## 6. Build & run (verified as of the V1 backend pass — see `CHANGELOG.md`)

- `npm install` — install dependencies.
- `npm run dev` / `npm run start` — dev / production server, `http://localhost:3000`.
- `npm run build` — production build (what Vercel runs).
- `npm run lint` — ESLint.
- `npm run db:generate` — regenerate the Prisma client (`prisma generate`).
- `npm run db:migrate` — `prisma migrate dev` (needs `DATABASE_URL`; connected now).
- `npx prisma migrate status` — check pending/applied migrations before creating a new one.
- `npx prisma db seed` — creates the one dev-only admin agent (`prisma/seed.ts`); idempotent.
- `npx prisma db execute --stdin` — for one-off SQL (e.g. deleting a test
  row) — prefer this over `upsert()`/`$transaction()` in application code,
  see rule §3.11.
- All of the above were actually run and passed against the real Neon
  database, not just reviewed — see `CHANGELOG.md` for the exact record of
  every pass, including full create → restart → confirm-persisted →
  update → cleanup cycles. Don't claim something builds/runs/lints/persists
  clean without actually running it, same standard `ConbunCall_V4/CLAUDE.md`
  holds itself to.

## 7. About the Next.js-managed block at the bottom of this file

Next.js 16's `next dev` (not us) appends its own managed section titled
"This is NOT the Next.js you know" to the very end of this file the first
time it detects it's running under an AI coding agent in a repo that has
this file but no separate agent-instructions file. It is additive and safe
by design, and intentionally left in place per Next.js's own guidance.

**Caution for future edits to this section:** do not spell out that
block's opening/closing HTML-comment marker verbatim anywhere in this
file's prose (not even inside backticks) -- `next dev`'s own upsert logic
does a plain substring search for those exact markers across the *whole*
file, not a scoped one, so an example/quote of the marker text earlier in
this document gets treated as the start of "the" block and everything
between it and the real marker near the end gets mangled together. (This
happened once already during the Phase 2 UI pass -- see `CHANGELOG.md` for
the incident and fix.) Refer to the block by its heading text instead, as
this section does.

Everything above this line is this project's own authored governance; if a
"This is NOT the Next.js you know" section appears below, that part is
Next.js's, not ours -- don't hand-edit it, and don't confuse it for a
standing project rule.

<!-- BEGIN:nextjs-agent-rules -->

# This is NOT the Next.js you know

This version has breaking changes — APIs, conventions, and file structure may all differ from your training data. Read the relevant guide in `node_modules/next/dist/docs/` (resolved from this file's directory; in monorepos the `next` package may not be visible from the repo root) before writing any code. Heed deprecation notices.

This block is written and re-added by `next dev` — verify at `node_modules/next/dist/server/lib/generate-agent-files.js`. Removing it from a diff only re-creates the uncommitted change; committing it with your work keeps the tree clean.

<!-- END:nextjs-agent-rules -->
