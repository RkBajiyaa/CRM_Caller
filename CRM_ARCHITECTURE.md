# Conbun CRM — Architecture Plan (Web App + Backend/API)

Status: **V1 implemented and tested against the real Neon database.** This
document is kept as the architectural record; the sections below (system
overview, tech stack, data model, auth, deployment) describe what was
actually built, verified by real requests against real data — not a
forward-looking proposal anymore. For the exact tested API contract, see
`API_DOCUMENTATION.md`; for what changed and how it was verified in each
pass, see `CHANGELOG.md`. §14 (Open Decisions) below is updated to mark
what's now resolved vs. still genuinely open.

> **Supersedes an earlier version of this document** that proposed building
> CRM screens inside the Android app (`ConbunCall_V4`). That approach was
> incorrect and has been replaced. See `CHANGELOG.md` for the correction
> record.

See `CLAUDE.md` (this folder) for the standing rules this plan follows.

---

## 1. System overview

Three separate projects, connected only through HTTPS APIs:

```
Android Agent App  --HTTPS API-->  Backend API  <-->  Central Database (Postgres)
   (ConbunCall_V4,                       ^
    unchanged, agent-side)               | HTTPS API
                                          |
                                   CRM Web Application
                                   (this project)
```

1. **`ConbunCall_V4`** — existing Android app. Calling, recording,
   transcription, AI pipeline, agent-side workflow. **Not modified as part
   of this work.** Inspected only as a reference (§10).
2. **Conbun CRM (this project)** — a web application, plus (initially) the
   backend/API layer in the same repo if that proves the right shape (§3).
   Pushed to GitHub, deployed via Vercel.
3. **Central backend/API + database** — the only thing that talks to
   Postgres. Owned by this project. Both the CRM frontend and, eventually,
   the Android app authenticate to it and exchange data through it —
   neither client ever accesses the database directly.

This document does not build any of the three yet; it defines how they fit
together so Phase 1 has a stable target instead of shifting requirements.

---

## 2. Recommended technology architecture

| Layer | Decision (locked 2026-08-08) | Why |
|---|---|---|
| Frontend | **Next.js (React + TypeScript), App Router** | Deploys natively to Vercel with zero extra config; the same framework can also host the backend (§3), avoiding a second deployment target for V1. |
| Backend/API | **Next.js Route Handlers (`app/api/.../route.ts`) in the same repo, for V1** — service logic kept in a separate `lib/` layer, never inlined in route handlers, so it can be extracted into a standalone backend service later without a rewrite. | For a CRM at this stage (one team, one deploy target, Vercel-hosted), a monorepo with API routes avoids a second service, second deploy pipeline, and second set of infra to run/monitor, while staying cleanly splittable later (see §3). |
| Database | **PostgreSQL on Neon** | Explicitly requested provider. Serverless-connection-friendly (important for Vercel's serverless functions), branch/preview databases pair naturally with Vercel preview deployments. |
| ORM / query layer | **Prisma 7**, with the **`@prisma/adapter-neon`** driver adapter | Type-safe schema + migrations + query builder, keeps the schema itself as reviewable version-controlled code (`schema.prisma`) rather than hand-written SQL scattered across route handlers. Prisma 7 requires an explicit driver adapter (discovered during Phase 1 scaffolding — the old implicit-engine connection is gone); `@prisma/adapter-neon` talks to Neon over HTTP/WebSocket instead of a long-lived TCP connection, which fits Vercel's serverless functions far better than a pooled TCP driver would. |
| Auth | **Custom JWT bearer-token auth**, issued by this backend, in an isolated auth module | Needs to serve two different client types (a browser CRM session and a headless Android device) with one consistent mechanism. The Android app's existing (unwired) `data/crm/CrmApiClient` **already sends `Authorization: Bearer <token>`** — a heavier web-only solution (e.g. a cookie-session auth library) would need a second, different mechanism for Android anyway. One JWT-issuing endpoint, verified by backend middleware, isolated from the rest of the backend so both the CRM web app and (later) Android can use it unchanged. Details in §8. |
| Styling/UI kit | Deferred — not needed until Phase 4 (UI). No component library chosen yet; avoid picking one before the pages that need it are scoped. |

All of the above are **locked decisions** per the user's 2026-08-08
direction — see §14 for the (small) set of details intentionally left for
implementation time rather than architecture time.

---

## 3. Frontend architecture

- **Framework:** Next.js, App Router, TypeScript.
- **Structure (proposed, not yet created):**
  ```
  app/
    (crm)/
      customers/            -- CRM Users page (list)
      customers/[id]/       -- Customer Detail page
      customers/new/        -- Add New User
    api/                    -- backend route handlers, see §4
  lib/
    api-client/              -- typed fetch wrappers calling our own /api/*
    db/                       -- Prisma client + schema (backend-only, not imported by client components)
  ```
- **Data fetching:** server components / route handlers call the backend
  logic directly (same process in V1); no client-side code ever imports the
  database layer directly — everything goes through `/api/*`, keeping the
  frontend/backend seam real even though they currently share a repo. This
  is what makes the "split into a separate backend service later" path
  (§3 footnote below) mechanical rather than a rewrite.
- **Routes matching the spec:**
  - `/customers` — main CRM Users page, one row per customer (§11).
  - `/customers/[customerId]` — Customer Detail page (§12).
  - `/customers/new` — Add New User flow (§13 in the original spec /
    Add New User section below).
- **If the backend later needs to split out** (e.g. to run scheduled jobs,
  or scale independently of the frontend): because route handlers only
  ever call an internal `lib/` service layer (never raw Prisma calls
  scattered through pages), that service layer can be lifted into a
  standalone Node/Express/Nest service with the frontend's `api-client`
  simply pointed at a new base URL — no data-model or contract change.
  Not needed for V1; noted so the V1 shape doesn't foreclose it.

---

## 4. Backend/API architecture

- **V1 shape:** Next.js Route Handlers, same repo as the frontend,
  deployed together on Vercel as serverless functions. See §3 for the
  later split-out path if the team outgrows this.
- **Responsibilities:**
  - Own all reads/writes to Postgres (via Prisma or equivalent — §2).
  - Own `customerId`/`crmEntryCreatedAt` generation (§9) — no client ever
    sends these.
  - Authenticate every request (§7) — both CRM-web sessions and Android
    device tokens.
  - Expose the REST contract in §8 to both clients.
- **Not the same thing as `ConbunCall_V4`'s existing `data/crm/` package.**
  That Android-side code is a *client* for a CRM-style backend that never
  existed yet; this project is that backend, finally being built. The
  contract in §8 is designed with an eye toward compatibility with what
  `data/crm/CrmDtos.kt` already expects (Bearer auth, similar
  request/response shapes) so a future Android-integration task is a
  matter of pointing the existing scaffolding at a real URL, not
  rewriting it — but reconciling the two exactly is deferred to that
  future task, not decided here (§14).
- **Validation:** request bodies validated at the API boundary (e.g. Zod)
  before touching the database — required fields (name, phone number on
  create) enforced server-side, not just in the frontend form.

---

## 5. Database architecture

**PostgreSQL**, accessed only from backend code (never from the frontend's
client bundle, never from Android). No tables are created in this phase —
this is the conceptual model that Phase 2 (§15) will turn into actual
migrations.

Proposed top-level entities (conceptual, not final column-level design):

```
customers        -- profile data (§6)
agents            -- V1: may just be a free-text name on customers/calls
                     rather than a real table (§7 in the original spec /
                     Agent Model, and §14 open decision)
calls              -- one row per call, linked to a customer by customerId
recordings        -- linked to a call
transcripts       -- linked to a call
ai_summaries      -- linked to a call
notes              -- linked to a customer (future phase)
follow_ups        -- linked to a customer (future phase)
```

- **`customers` is the identity anchor.** Every other entity links back to
  `customers.customer_id` (or to a `call_id` that itself links to a
  `customer_id`) — never keyed by phone number.
- **`calls` is where phone number appears operationally** (the number that
  was dialed/received), used to *match* a call to a customer at write
  time (§6), but the stored relationship after that is the foreign key,
  not the number.
- This project's database is the **only** permanent CRM store.
  `ConbunCall_V4`'s DataStore/local-JSON repositories remain valid for
  on-device caching/offline operation but are never the system of record
  for CRM data — matching the corrected architecture in §0/§1.

---

## 6. Customer data model

```
Customer
  -> customerId          (stable, backend-generated, permanent identity)
  -> profile              (name, phoneNumber, location, dates, assignedAgent, status)
  -> calls                (linked by customerId)
      -> recordings
      -> transcripts
      -> AI summaries
  -> notes                 (future)
  -> actions/follow-ups    (future)
```

Proposed conceptual shape (not a schema, no table created yet):

```
Customer {
  customerId          string   // backend-generated (e.g. UUID or prefixed sequence), permanent, never edited
  name                 string   // required
  phoneNumber          string   // required; lookup/matching key -- NOT the identity
  location              string?  // optional
  assignedAgent         string?  // free text for V1 (no agent directory yet) -- see §7 in original spec
  accountCreatedAt      timestamp?  // application/account creation date; optional
  crmEntryCreatedAt      timestamp   // backend-generated at creation time; NOT last login
  status                 string?  // vocabulary undefined -- open decision (§14)
  createdAt / updatedAt    timestamp  // standard audit columns
}
```

- `phoneNumber` is indexed for lookup (finding/matching a customer by
  number) but is **not** the primary key and is not assumed unique across
  all time (a customer could change numbers in the future without losing
  identity) — though V1 assumes one current phone number per customer,
  matching the Add New User spec's single required field (open assumption,
  §14).
- `assignedAgent` and the calling agent on a `call` row are **different
  fields on different entities** — never collapsed (per the Agent Model
  rule).

---

## 7. Call ↔ customer relationship

```
Android App                                CRM Web App
    |                                            |
    | POST /api/calls  (customerId if known,     |  GET /api/customers
    |   phoneNumber, direction, duration,         |  GET /api/customers/{id}
    |   status, callingAgent, timestamps)         |
    v                                            v
              Backend API  <------------------------>  Database
                    |
                    v
     calls row, linked to customers.customer_id
     (matched by customerId if the Android app already
      knows it, else looked up/created by phoneNumber)
```

- When the Android app makes/receives a call, it will eventually call the
  backend (a future, separately-approved Android-integration task — not
  built now) with whatever it knows: `phoneNumber` always, `customerId` if
  the call was placed from a known-customer context, plus
  direction/status/duration/timestamps and, once available, the calling
  agent, recording reference, transcript, and AI summary.
- **The backend, not the Android app, resolves `customerId`** when it
  isn't already provided — matching by `phoneNumber` against `customers`,
  same "lookup key, not identity" principle as the local-only version of
  this design had, just enforced server-side now instead of on-device.
- Recordings/transcripts/AI summaries are linked to a `call` row (not
  directly to a customer), the same one-hop-removed relationship the
  Android app's own `CallMetadata` already models locally (`callKey` →
  transcript/summary) — this project's schema mirrors that shape rather
  than inventing a new one.
- The Customer Detail page's Call History section (§12) is simply
  `calls` rows joined to their `recordings`/`transcripts`/`ai_summaries`,
  filtered by `customerId` — a straightforward read, no special-casing.

---

## 8. Authentication

> **Status update (2026-08-09): removed.** Everything below this line was
> designed and then actually built (JWT via `jose`, bcrypt password
> hashing, httpOnly cookie + Bearer header, `/api/auth/*` routes, the
> login page, `proxy.ts` gating every page) -- then removed in full by
> explicit instruction: no login, every page/route open, straight to the
> CRM. See `CHANGELOG.md`'s "remove authentication" entry for exactly what
> was deleted. Left here, unedited, as the historical design record rather
> than rewritten -- if auth needs to come back, this is the design that
> was already validated and built once.

Two distinct client types, one issuing authority (this backend):

| Client | Auth flow | Token use |
|---|---|---|
| **CRM web app (human agent/admin, browser)** | Login form → `POST /api/auth/login` (email/password or equivalent) → backend verifies, issues a JWT | JWT stored in an httpOnly cookie (V1 default) or returned to be attached as a Bearer header, depending on how strictly session-vs-API separation ends up mattering — decided at implementation time, not blocking this doc |
| **Android app (device/agent)** | Existing (currently unwired) `data/crm/CrmApiClient` already builds requests with `Authorization: Bearer <token>` and already has a `LoginRequest(deviceId, agentName, password)` / `LoginResponse(authToken, expiresAt)` shape drafted. This backend's `/api/auth/login` is designed to satisfy that same shape. | Same JWT scheme, sent as `Authorization: Bearer <token>` on every request — this is the actual reason a custom JWT approach was chosen over a web-only session library (§2): one issuing/verification path serves both clients without reconciling two different auth systems later. |

- All `/api/*` routes (other than `/api/auth/login`) require a valid
  Bearer JWT, verified in backend middleware before any handler runs.
- Tokens carry a subject (agent/user id) and are short-lived with refresh
  handled at implementation time (exact TTL/refresh strategy: open
  decision, §14 — not needed to lock the architecture).
- **No production database access from either client** — this is enforced
  structurally: neither the CRM frontend's client bundle nor the Android
  app ever holds a database credential, only an API bearer token scoped
  to the backend's own endpoints.

---

## 9. API contract (proposed)

REST, JSON, versionless for V1 (add `/api/v1/...` prefix later only if a
breaking change is needed — not pre-optimizing for that now).

```
POST   /api/auth/login              -- returns { authToken, expiresAt }

GET    /api/customers                -- list, powers the CRM Users page (§11)
POST   /api/customers                -- create; backend generates customerId + crmEntryCreatedAt (§13)
GET    /api/customers/{customerId}    -- profile + summary, powers Customer Detail (§12)
PATCH  /api/customers/{customerId}    -- edit profile fields only (never customerId/crmEntryCreatedAt)

GET    /api/customers/{customerId}/calls   -- call history for a customer (§12)
POST   /api/calls                            -- Android app reports a call (future, unwired until Android-integration task)

GET    /api/customers/{customerId}/calls/{callId}/recording     -- future
GET    /api/customers/{customerId}/calls/{callId}/transcript    -- future
GET    /api/customers/{customerId}/calls/{callId}/summary       -- future
```

- `POST /api/customers` request body: `{ name, phoneNumber, location?,
  assignedAgent?, accountCreatedAt?, notes? }` — no `customerId`, no
  `crmEntryCreatedAt` accepted; the backend stamps both and returns the
  full record.
- Every response includes `customerId` as the canonical identifier;
  `phoneNumber` is present but never used as a path/lookup key in the
  contract above (`{customerId}`, not `{phoneNumber}`, appears in every
  URL) — enforcing the identity rule at the contract level, not just by
  convention.
- Errors: standard HTTP status codes + `{ error: string }` body,
  mirroring the clarity (if not the exact shape) of the Android app's
  existing `NetworkResult` split (`Success` / `ApiError` / `AuthError` /
  `NetworkError`) so a future Android integration maps onto familiar
  handling.

---

## 10. Deployment architecture

```
GitHub repo (this project)
     |  push / PR
     v
Vercel  --  builds + deploys frontend AND API routes (same build)
     |
     |  preview deployments per PR, production deployment on main
     v
Managed Postgres (Neon / Supabase / Vercel Postgres -- §14)
     |
     |  connection string via Vercel environment variables (per environment: preview/production)
     v
Database
```

- **GitHub → Vercel** — standard Vercel Git integration; every PR gets a
  preview deployment (frontend + API together, since they're one Next.js
  app in V1), `main` deploys to production.
- **Secrets/config** (database connection string, JWT signing secret) live
  in Vercel Environment Variables, scoped per environment — never
  committed to the repo.
- **Database migrations** run as an explicit step (e.g. `prisma migrate
  deploy`) in the deploy pipeline or manually before a release — not
  automatically applied by the app at request time.
- If the backend is later split out from the frontend (§3 footnote), it
  would get its own Vercel project (or a different host if it needs
  long-running processes Vercel's serverless model doesn't fit), still
  reading from the same database.

---

## 11. Android app ↔ backend (future integration, not built now)

This section documents the *intended* future connection so the API
contract above doesn't need to change shape when that work happens — it
does not authorize or perform any Android-side change now.

- `ConbunCall_V4`'s `data/crm/` package (`CrmApiService`, `CrmApiClient`,
  `CrmRepository`, `NetworkResult`, DTOs) already exists, already compiles,
  and is already **not wired to any UI** — it was built as forward-looking
  scaffolding for exactly this kind of backend. Reference only:
  - `CrmApiClient.create(baseUrl, authToken)` already builds a
    Bearer-token-authenticated Retrofit client — matches §8's auth model.
  - `LoginRequest`/`LoginResponse` already match a `deviceId + agentName +
    password → authToken` shape — matches `POST /api/auth/login` above.
  - `CallMetadataUploadRequest`/`TranscriptUploadRequest`/
    `AiSummaryUploadRequest` already exist, keyed by a `serverCallId` —
    this project's `calls`/`recordings`/`transcripts`/`ai_summaries`
    design (§5, §7) is shaped to be a plausible receiving end for those,
    without guaranteeing an exact 1:1 field match yet.
- **When this integration is actually approved as its own task**, it will
  involve: pointing `AppSettings.apiBaseUrl`/`crmAuthToken` (already
  present in Android Settings) at this project's real URL, wiring
  `CrmRepository`'s already-written methods to real UI call sites, and
  reconciling any DTO field differences discovered once both sides are
  live. **None of that happens in this task.**

---

## 12. CRM main page (`/customers`) — target shape

One row per customer, sourced from `GET /api/customers`:

- Customer ID, Name, Phone number, Location, Assigned agent,
  Account/application creation date, CRM entry date, Last call, Last call
  status, Total calls, Follow-up/action status.
- Name and phone number are clickable → `/customers/{customerId}`.
- "Add New User" action → `/customers/new`.

Not built in this phase (no UI yet) — documented so the API contract in
§9 is shaped to actually serve it (e.g. `GET /api/customers` needs to
return enough aggregate data — last call, total calls — to avoid an N+1
query per row; exact aggregation strategy is a Phase-4 implementation
detail, not decided here).

---

## 13. Customer detail page (`/customers/{customerId}`) — target shape

- **Profile:** blank/default avatar, customer ID, name, phone number,
  location, account/application creation date, CRM entry date, assigned
  agent, status.
- **Call activity:** total/answered/missed/incoming/outgoing calls, total
  conversation time, last contacted, calling agents involved.
- **Call history:** per call — date/time, calling agent, direction,
  status, duration, recording, transcript, AI summary.
- **Future (not built now):** notes, follow-up date, next action, action
  status, AI-generated summary/intent surfaced more prominently.

Sourced from `GET /api/customers/{customerId}` (profile + activity
summary) and `GET /api/customers/{customerId}/calls` (history) per §9.

---

## 14. Open decisions / assumptions

Resolved during the V1 backend pass (kept here for the record, not
re-litigated):

1. ~~Managed Postgres provider~~ — **Neon**, connected and migrated.
2. ~~ORM choice~~ — **Prisma 7**, with the `@prisma/adapter-neon` driver
   adapter (mandatory in Prisma 7) — see `CHANGELOG.md` for the
   Node-20-WebSocket fix this required.
3. ~~Backend split timing~~ — Next.js API routes, same repo, confirmed for
   V1; service logic stays in `lib/`, not inlined in route handlers, so
   splitting later is still mechanical if it's ever needed.
4. **Auth token lifetime/refresh strategy** — resolved as: 7-day HS256 JWT,
   stateless, no server-side revocation list. Logout only clears the CRM
   web cookie; a captured bearer token remains valid until it expires.
   Documented limitation, not revisited this pass.
5. **One phone number per customer** — still the V1 assumption
   (`phoneNumber` is `@unique` at the schema level now, enforcing it
   structurally). Flag if multi-number support becomes a real need.
6. ~~`Customer.status` vocabulary~~ — resolved: `ACTIVE` / `INACTIVE` /
   `FOLLOW_UP` / `CLOSED` (already an enum in the schema).
7. ~~Agent model for V1~~ — resolved: a real `Agent` table exists (name,
   email, password hash, role, active flag). `Customer.assignedAgentId` is
   a real FK now; `Customer.assignedAgent` (text) stays denormalized from
   it for display/backward-compatibility, not a second identity.
8. **Exact Android DTO reconciliation** — done for the endpoints Phase 11
   scoped (login, customer lookup/create, call start/finish, recording/
   transcript/summary metadata) — see `ANDROID_API_INTEGRATION.md`. Not
   done: wiring those into Android's actual call-completion flow (only
   login has a real UI call site so far), and an on-device test (no
   AVD/device was available in this environment — see that doc's "Exact
   next action").
9. **Notes / follow-up / action-status** — resolved: a real `Action` model
   exists (Phase 8), deliberately flat (no workflow engine). Structured
   AI-summary *display* beyond the availability badge in Call History is
   still not built — `AiSummary`'s full fields (`keyPoints`,
   `customerIntent`, `sentiment`, `recommendedAction`) are stored and
   returned by the API but the Customer Detail page only shows an
   availability badge, not those fields individually. Flag if that's
   wanted next.
10. **Object storage provider** — genuinely still open. `lib/storage/`
    (Android side would call `lib/db`'s equivalent... i.e. the CRM
    backend's `lib/storage/index.ts`) reports `{ name: "pending",
    configured: false }`; no S3/R2/Blob credentials exist. Recording
    *metadata* works end-to-end; actual audio bytes have nowhere to go
    yet.
11. **GitHub/Vercel deployment** — still not done. Needed before Android
    can reach this backend from anywhere other than the same LAN as the
    dev machine.

---

## 15. Implementation phases

Each phase is its own small, isolated, separately-verifiable change with
its own `CHANGELOG.md` entry. **No phase below modifies `ConbunCall_V4`.**

| Phase | Scope | New DB tables? | Touches Android? |
|---|---|---|---|
| **0** (this doc) | Architecture correction + this document | No | No (reference-read only) |
| **1** | Repo scaffold: Next.js + TypeScript project, lint/format config, Vercel project connected to GitHub, empty deploy verified live. No pages, no API routes, no database connection yet. | No | No |
| **2** | Database: pick provider (§14), connect Prisma (or chosen alternative), write the `customers` schema/migration from §5–§6. Still no API routes, no UI. | Yes — `customers` (and stub tables for `calls` etc. if useful to define relations early) | No |
| **3** | Backend API: `POST/GET /api/customers`, `GET /api/customers/{id}`, auth (`POST /api/auth/login`, JWT middleware) per §8–§9. No frontend UI yet — testable via HTTP client. | No new tables (uses Phase 2's) | No |
| **4** | CRM frontend: `/customers` list page + `/customers/new` Add New User form, calling the Phase-3 API. | No | No |
| **5** | `/customers/{customerId}` detail page: profile + call-activity + call-history sections. Requires `calls`/`recordings`/`transcripts`/`ai_summaries` tables and endpoints (§5, §9) — call data will be seeded/mocked in this phase since the Android integration (Phase 7) doesn't exist yet. | Yes — `calls`, `recordings`, `transcripts`, `ai_summaries` | No |
| **6** (future, not scheduled) | Notes/follow-up/action-status, richer `status`/agent-directory model, once product decisions in §14 are made. | Yes — `notes`, `follow_ups` | No |
| **7** (future, separately-approved task) | Android integration: wire `ConbunCall_V4`'s existing `data/crm/` scaffolding to this backend's real URL, reconcile DTOs (§11). | No | **Yes — the only phase that touches the Android app, and only when explicitly approved as its own task.** |

Stop-and-confirm gate: **do not start Phase 1** until the user reviews
this document and the open decisions in §14.
