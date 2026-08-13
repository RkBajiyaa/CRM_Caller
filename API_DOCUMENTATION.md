# Conbun CRM — API Documentation

Documents actual, tested behavior of the backend as of this writing (see
`CHANGELOG.md` for the exact entry this was verified against). Not a
planning document — everything below has been exercised with real requests
against the live Neon database.

## Base URL

- **Local development:** `http://localhost:3000`
- **Production:** deployed on Vercel. Android's `AppSettings.apiBaseUrl`
  (user-editable in Settings) points at whichever of these is in use; its
  compiled-in default is the Vercel deployment, so a device with default
  settings talks to production, not to a LAN address.

All endpoints are under `/api/...`. All request/response bodies are JSON.

## Authentication

**There is none.** By explicit instruction, JWT auth, the login page, and
the page-level auth gate were all removed (see `CHANGELOG.md`). Every
endpoint below is open — no cookie, no `Authorization` header, no
`POST /api/auth/login` (that endpoint no longer exists). Visiting the CRM
goes straight to `/customers`, no sign-in step.

This is a deliberate product decision for the current phase, not an
oversight — flagged here so it isn't mistaken for a bug, and so it's easy
to find if/when auth needs to come back (`lib/auth/password.ts` still
exists and still hashes `Agent.passwordHash` on creation; `lib/auth/jwt.ts`,
`session.ts`, and every `/api/auth/*` route were deleted outright, not
just disabled, and would need to be re-added).

`Agent` records (name/email/role/active-state) still exist and are still
manageable via `/agents` and `POST`/`PATCH /api/agents*` below — they're
just no longer a login identity, only a thing `Customer.assignedAgentId`/
`Call.agentId` can reference.

## Error format

Every error response is `{ "error": "<human-readable message>" }`, with an
optional `details` field (zod's validation-error tree) on `400` responses.
Internal errors (unexpected exceptions) are never turned into a response
that leaks a stack trace or Prisma error internals — they surface as a
generic `500` from Next.js's own error handling.

| Status | Meaning |
|---|---|
| 400 | Validation failed (see `details`) or malformed JSON body |
| 404 | Resource (customer/call/agent/action) not found |
| 409 | Conflict — e.g. phone number or agent email already in use |

(401/403 are not used anywhere in this build — there's no authentication or role check to fail. See "Authentication" above.)

## Customers

`Customer.id` (`customerId`) is backend-generated (UUID), never accepted
from a client. `phoneNumber` is a lookup key, never the identity — every
endpoint below is keyed by `id`, never by phone number.

### `GET /api/customers?q=&status=&assignedAgentId=&page=&pageSize=`

All query params optional. `q` matches name/phone/location/assigned-agent
substrings, case-insensitive; an all-digits `q` of 4+ digits additionally
matches the normalized phone key, so `?q=9876543299` finds a customer stored
as `"+91 98765 43299"`. `status` is one of `ACTIVE`/`INACTIVE`/`FOLLOW_UP`/
`CLOSED`. `pageSize` defaults to 25, capped at 100.

```json
{
  "data": [ { "id": "...", "name": "...", "phoneNumber": "...", "location": null,
              "assignedAgent": "...", "assignedAgentId": "...", "accountCreatedAt": null,
              "crmEntryCreatedAt": "...", "status": "ACTIVE", "notes": null,
              "createdAt": "...", "updatedAt": "..." } ],
  "page": 1, "pageSize": 25, "total": 1, "totalPages": 1
}
```

### `POST /api/customers`

```json
// Request -- only name and phoneNumber are required
{ "name": "Priya Sharma", "phoneNumber": "+91 98765 43210", "location": null,
  "assignedAgentId": null, "accountCreatedAt": null, "status": "ACTIVE", "notes": null }
```

`id` and `crmEntryCreatedAt` are always generated server-side — sending
them does nothing (they aren't in the request schema at all). `201` with
the created customer, or `409` if the phone number is already in use
(response includes `customerId` of the existing match).

The `409` check is **normalized**, not a string comparison: posting
`"9876543299"` when `"+91 98765 43299"` already exists is a conflict, and the
message names the existing customer. This is deliberate — two customers whose
numbers agree on the last 10 digits would make
`GET /api/customers/lookup` ambiguous, so a call reported by Android could
land on the wrong customer.

### `GET /api/customers/{id}` / `PATCH /api/customers/{id}`

`GET` returns one customer or `404`. `PATCH` accepts any subset of the
`POST` body's fields (never `id`/`crmEntryCreatedAt`) and returns the
updated record, or `404`.

### `GET /api/customers/lookup?phoneNumber=...`

Phone-number lookup — this is Android's "identify the customer" step, and
the only place a phone number is turned into a `customerId`. Returns the
matching customer or `404`. **Never creates anything**: a number that
matches no customer is simply not a CRM customer, and nothing about that
call is imported.

**Matching is normalized, backend-side** (added 2026-08-10). The backend
tries an exact match on the stored `phoneNumber` first, then falls back to
comparing the **last 10 digits** with all non-digits stripped. So every one
of these resolves to the customer stored as `"+91 98765 43299"`:

```
+919876543299      (what Android sends after PhoneNumberUtils.normalize)
+91 98765 43299
09876543299
9876543299
```

This is the same rule Android already uses locally in
`PhoneNumberUtils.looseMatch`, so both sides agree on when two numbers are
the same number. It is done here, on the backend, specifically so Android
never needs a copy of the customer list to do the matching itself.

If two customers collide on the last 10 digits, the oldest CRM entry wins,
deterministically — but `POST /api/customers` now rejects creating such a
collision in the first place.

### `GET /api/customers/{id}/calls?limit=`

Call history + aggregate stats for one customer, returned together (the UI
always needs both):

```json
{
  "data": [ { "id": "...", "customerId": "...", "agentId": "...", "agentName": "...",
              "phoneNumber": "...", "direction": "OUTGOING", "status": "ANSWERED",
              "startedAt": "...", "answeredAt": null, "endedAt": "...", "durationSeconds": 142,
              "failureReason": null,
              "hasRecording": true, "recordingDurationSeconds": 145, "recordingStatus": "PENDING",
              "recordingStorageKey": null, "recordingMimeType": null, "recordingSizeBytes": null,
              "transcriptStatus": "DONE", "transcriptText": "...", "transcriptLanguage": null,
              "aiSummaryStatus": "DONE", "aiSummaryText": "...", "aiSummaryKeyPoints": ["..."],
              "aiSummaryCustomerIntent": null, "aiSummarySentiment": null,
              "aiSummaryRecommendedAction": null, "aiSummaryFollowUpRequired": false,
              "aiSummaryGeneratedAt": null,
              "callRequestId": "...", "callRequestStatus": "COMPLETED",
              "callRequestRequestedAt": "...",
              "createdAt": "...", "updatedAt": "..." } ],
  "stats": { "totalCalls": 1, "answeredCalls": 1, "missedCalls": 0, "incomingCalls": 0,
             "outgoingCalls": 1, "totalConversationSeconds": 142,
             "lastContactedAt": "...", "lastContactedByAgent": "..." },
  "truncated": false
}
```

`recordingDurationSeconds`/`recordingStatus`/`transcriptText`/
`transcriptLanguage`/`callRequestId`/`callRequestStatus` were **added**
2026-08-10 (additive only — nothing was renamed or removed, and any client
that ignores unknown fields is unaffected). They exist so the CRM can show
the transcript itself rather than only whether one exists, and so a call can
be traced back to the CRM request that started it.

**Added 2026-08-11, also additive only:** `answeredAt`, `failureReason`,
`recordingStorageKey`/`recordingMimeType`/`recordingSizeBytes`, the
`aiSummary*` content fields, `callRequestRequestedAt`, the `limit` query
parameter, and the `truncated` response flag. Nothing was renamed or removed.

Two behaviours worth knowing:

- **`limit` bounds `data`, never `stats`.** Default `25`, max `200`. The
  aggregates are computed in Postgres across *every* call the customer has,
  so a bounded page and a full history report the same numbers; `truncated`
  says whether `data` is a subset. Before this the route returned every call
  a customer had ever had, transcript text included, on every request.
- The whole response is now **one** SQL statement plus the customer lookup
  (it was seven). Prisma issues an extra statement per `include`d relation
  and this project's Neon adapter serializes them — see
  `lib/calls/service.ts` for the measurement and the rewrite.

### `GET /api/customers/{id}/call-status`

**CRM-only, added 2026-08-12. Android neither calls this nor needs to know
it exists** — it is additive and changes nothing about the existing contract.

The liveness probe behind the customer detail page's auto-refresh
(`components/crm/CallActivityRefresher.tsx`), which is what removes the manual
browser refresh from the active-call workflow. It returns a *fingerprint*, not
the call data:

```json
{ "data": { "version": "1a2b3c", "lifecycle": "IN_PROGRESS", "active": true } }
```

- **`version`** changes when anything the detail page displays about this
  customer's calls changes — call outcome, recording, transcript, summary, or
  request status. The browser re-renders the page (one `router.refresh()`)
  only when this differs from the value it last saw, so a poll that finds
  nothing new transfers ~80 bytes and repaints nothing. It is stable across
  repeated polls when nothing has changed (verified), which is what stops a
  refresh loop.
- **`lifecycle`** is the existing derived vocabulary from
  `lib/call-requests/lifecycle.ts` (`NONE`/`QUEUED`/`DIALING`/`IN_PROGRESS`/
  `CONNECTED`/`NOT_ANSWERED`/`FAILED`/`CANCELLED`/`UNKNOWN`). **No new status
  is invented or stored** — it is computed from the `CallRequest` and `Call`
  rows that already exist.
- **`active`** is the CRM's own "keep watching?" answer, and the client obeys
  it. `false` means stop polling. This is what makes the watching terminate
  instead of running forever:
  - a customer with nothing in flight returns `active: false`, so an idle CRM
    makes **zero** polling requests;
  - a call that connected stays `active` only while its recording, transcript
    or summary could still legitimately arrive, and for at most 15 minutes
    after that call last changed;
  - a `MISSED`/`REJECTED`/`FAILED` call returns `active: false` immediately —
    an unanswered call has no conversation to record, transcribe or
    summarize, so there is nothing to wait for.

Never a `404`: an unknown customer id simply has no calls and no requests, so
the honest answer is "nothing is happening, stop polling" — which is exactly
what a client whose customer was deleted mid-watch should be told.

**One** SQL statement, deliberately (a `UNION ALL` over the calls and the
requests rather than the obvious two queries — this project's Neon adapter
serializes statements, so a second query would double the latency of a path
that repeats). It selects booleans rather than transcript/summary text, so a
poll's cost stays flat however long the transcript is. Measured against the
live database from a dev machine: **median 384 ms**, i.e. a single round trip.

## Call requests — CRM "Call" button → Android pending-request queue

A request is created when an agent clicks **Call** on a customer row in
the CRM. It always starts as `PENDING`, is keyed by `customerId` (never
phone number), and carries a snapshot of `phoneNumber`/`customerName` so
Android doesn't need a second lookup to dial. Android polls for pending
requests, accepts one, places the real call (`POST /api/calls`, see
below — pass `callRequestId` there to link the two), then updates the
request's status.

```
CRM:      [Call button] -> POST /api/call-requests -> Neon, status PENDING
Android:  GET /api/call-requests?status=PENDING -> PATCH .../{id} {"status":"ACCEPTED"}
          -> place the real call -> POST /api/calls {..., "callRequestId": "..."}
          -> PATCH /api/call-requests/{id} {"status":"COMPLETED"}
```

### What `COMPLETED` actually means here — read this before using it

Verified against the shipping Android implementation
(`ConbunCall_V4`'s `CallSessionTracker.onCallInitiated`): Android sends
`{"status":"COMPLETED"}` **as soon as the `Call` row is created**, i.e. at
the *start* of the phone call, not when the call ends. The call's own
outcome is reported separately and later, via
`PATCH /api/calls/{id}`.

So, on a call request:

| `CallRequest.status` | What it means |
|---|---|
| `PENDING` | Queued in the CRM, Android hasn't picked it up |
| `ACCEPTED` | Android has it and is placing the call |
| `COMPLETED` | Android dialed and created the `Call` — **not** "the call is over" |
| `FAILED` | Android could not place the call at all |
| `CANCELLED` | Cancelled before it became a call |

**Both sides are correct as-is and neither was changed.** The CRM derives
the state it displays ("Queued" / "Dialing" / "In progress" / "Connected" /
"Not answered" / "Failed") by combining the request's status with the linked
`Call.status` — see `lib/call-requests/lifecycle.ts`. Nothing new is stored;
`Call` wins wherever the two could disagree, since it is the record of what
actually happened on the phone.

### `POST /api/call-requests`

```json
// Request -- only customerId, from the CRM's Call button
{ "customerId": "..." }

// 201 response
{
  "data": {
    "id": "...", "customerId": "...", "phoneNumber": "+91 98765 43210",
    "customerName": "Priya Sharma", "status": "PENDING", "callId": null,
    "requestedAt": "...", "updatedAt": "..."
  }
}
```

`404` if `customerId` doesn't match a real customer.

**Idempotent while queued** (added 2026-08-10): if this customer already has
a `PENDING` request Android hasn't picked up, that same request is returned
with **`200`** instead of a duplicate being created with `201`. The body is
identical either way, so a client that only checks for success is
unaffected. Only `PENDING` de-duplicates — an `ACCEPTED` request that never
progressed (e.g. the Android app was killed mid-dial) must not block trying
again, which is exactly when re-calling matters most.

Why: Android's poller treats every `PENDING` row as a separate call to
place (it de-duplicates by request id, not by customer), so a double-click —
or one click per page load, since the button's state didn't survive a
refresh — meant the same customer got dialed twice. The live database still
contains several such duplicates from before this change.

**Hardened 2026-08-11 — concurrent presses.** The de-duplication above was a
`SELECT` followed by an `INSERT`, with a full network round trip (~350 ms
against Neon) between them: two presses landing inside that window both saw
"nothing queued" and both inserted. The check is now part of the `INSERT`
itself (`INSERT ... SELECT ... WHERE NOT EXISTS`), shrinking the window from a
round trip to the statement. Verified against the live database: five
simultaneous `POST`s for one customer produce exactly one `PENDING` row, and
three concurrent service-level calls return one and the same request id.

This is not an absolute guarantee — under `READ COMMITTED` two statements can
still both pass `NOT EXISTS` before either commits — but it needs
sub-millisecond timing rather than being routinely hit. A partial unique index
(`UNIQUE (customer_id) WHERE status = 'PENDING'`) would close it completely;
it was deliberately **not** added, because Prisma cannot express one in
`schema.prisma`, so the schema and the database would permanently disagree
about an index Prisma can't see — a bad trade in a project whose `CLAUDE.md`
tells every session to run `prisma migrate dev`.

The same rewrite made the new-request path **one** SQL statement instead of
three (customer lookup, pending check, insert), since the customer row is
joined into the `INSERT`. The "already queued" and "no such customer" paths
pay a second statement to tell those two cases apart — the right way round,
since only one of the three is the path an agent waits on.

### `GET /api/call-requests?status=PENDING&limit=`

This is Android's polling endpoint. `status` optional — one of
`PENDING`/`ACCEPTED`/`COMPLETED`/`CANCELLED`/`FAILED`; omit to list all.
Oldest request first. Response shape: `{ "data": [ <request>, ... ] }`
(same shape as the `POST` response's `data`).

`limit` is optional, defaults to **200**, capped at 500 (added 2026-08-10).
This table only grows — one row per Call button press, kept forever — and
unfiltered this endpoint used to return every row ever created, on a
four-second poll. Because the order is oldest-first, the requests Android
should act on first are always the ones it sees; a pending queue deep enough
to be truncated is already far deeper than a phone dialing one call at a
time can work through. Existing callers that don't send `limit` need no
change.

### `GET /api/call-requests/{id}`

Returns one request, or `404`.

### `PATCH /api/call-requests/{id}`

```json
// Accept:
{ "status": "ACCEPTED" }

// Finish (callId is set automatically by POST /api/calls if you passed
// callRequestId there -- setting it here directly is also supported,
// e.g. for correcting a link):
{ "status": "COMPLETED", "callId": "..." }
```

`status` ∈ `PENDING`/`ACCEPTED`/`COMPLETED`/`CANCELLED`/`FAILED`
(`PENDING` is only ever set by the backend at creation — sending it here
is accepted but pointless, there's no "un-accept"). `404` if the request
doesn't exist.

## Calls

A call always belongs to a customer via `customerId` — never resolved from
`phoneNumber` server-side. Two-step lifecycle: **start**, then **finish**.

### `POST /api/calls` — start a call

```json
// Request
{ "customerId": "...", "phoneNumber": "+91 98765 43210", "direction": "OUTGOING", "agentId": null, "startedAt": null, "callRequestId": null }
```

`customerId` must already exist (`404` otherwise — resolve/create the
customer first, e.g. via `GET /api/customers/lookup` then `POST
/api/customers`). `direction` is `INCOMING` or `OUTGOING`. Returns `201`
with the call; `status` is `null` (not yet known — see schema comment on
`Call.status`).

`callRequestId` is **optional** — when the call fulfills a CRM-created
call request, pass its id here and the backend links
`CallRequest.callId` to the new call as a side effect (best-effort: an
unknown `callRequestId` doesn't fail call creation, it's just not
linked). Omit it entirely for calls that didn't originate from a request
— nothing else about this endpoint changes.

### `PATCH /api/calls/{id}` — the call result

```json
// What ConbunCall_V4 sends today. Unchanged, still correct, still complete.
{ "status": "ANSWERED", "endedAt": "2026-08-08T16:00:00Z", "durationSeconds": 142 }
```

```json
// Everything this endpoint will accept. Every field is optional.
{
  "status": "REJECTED",
  "answeredAt": "2026-08-08T15:57:38Z",
  "endedAt": "2026-08-08T16:00:00Z",
  "durationSeconds": 142,
  "failureReason": "Call rejected by the other side",
  "agentId": null
}
```

`status` is one of `ANSWERED`/`MISSED`/`REJECTED`/`FAILED`. Also accepts
`agentId` to (re)assign the call. `404` if the call doesn't exist.

This is the endpoint that carries the **call result**. There is no separate
"call result" endpoint and none is needed — verified 2026-08-10 that
Android's `FinishCallRequest` already maps onto `status`/`endedAt`/
`durationSeconds`, including its `Instant.toString()` timestamps in all three
shapes Java can emit (`...Z`, `...123Z`, `...123456789Z`).

**`answeredAt` and `failureReason` are new (2026-08-11) and optional.** A
client that sends neither behaves exactly as it does today, and both stay
`null` — they are never inferred:

- `answeredAt` — when the call was actually picked up. Not derivable from
  anything already stored: `durationSeconds > 0` says a call connected, never
  when, and `startedAt` is when dialling began. The CRM will not guess it from
  the duration, so a client that cannot report it should simply omit it.
  (ConbunCall_V4 derives its outcome from the OS `CallLog`, which has no
  answer timestamp, so it omits it today — that is correct, not a gap.)
- `failureReason` — free text (≤500 chars) behind a `MISSED`/`REJECTED`/
  `FAILED` outcome, e.g. `"Call rejected by the other side"`. `status` stays
  the closed vocabulary anything programmatic branches on; this is only ever
  extra detail a person reads. ConbunCall_V4 already computes exactly this
  string in `CallSessionTracker.describeUnsuccessfulOutcome` for its own
  on-device activity log — sending it here needs no new logic on that side.

**This endpoint does not wait for anything.** It writes what happened on the
phone and returns — it does not look for a recording, does not transcribe, and
does not summarize. Those arrive later through their own endpoints and cannot
delay or fail the call result. As of 2026-08-11 it costs two SQL statements
(the update, then one joined read to return the call); it used to cost six.

A call whose `status` is still `null` is one that was started and never
finished — a live call, or one whose finish never arrived. The CRM shows
that as "In progress" rather than inventing an outcome.

### `GET /api/calls/{id}`

Returns one call (same shape as the list above).

## Recordings — metadata only, no audio bytes

**No object storage provider is configured** (`lib/storage/index.ts`
reports `{ name: "pending", configured: false }`). These endpoints record
*metadata about* a recording; they never receive, store, or serve audio.

### `GET /api/calls/{id}/recording`

```json
{ "data": null, "storageProvider": { "name": "pending", "configured": false } }
```

`data` is `null` until something is registered.

### `POST /api/calls/{id}/recording`

```json
{ "storageKey": "local://device/recordings/call_20260808.m4a", "durationSeconds": 142, "mimeType": "audio/m4a", "sizeBytes": 2281440 }
```

All fields optional. Registers (or updates, if called again) the metadata
row. `storageKey` is stored as-is for whenever a real object-storage
provider exists to resolve it — this backend does not validate that it
points anywhere real yet.

Calling this again for the same call updates the existing row rather than
creating a second one, so Android re-reporting a recording it discovered
later (its recording discovery is being made persistent separately) is safe
and needs no new endpoint. What is registered here surfaces on the customer's
call history as the recording's availability and duration
(`hasRecording`/`recordingDurationSeconds`); the CRM stores no audio and
keeps no second copy of anything — the file stays on the device.

## Transcripts

Android's existing Whisper pipeline produces the text; this backend never
transcribes anything itself.

### `GET /api/calls/{id}/transcript`

`{ "data": null }` if nothing submitted yet, else the transcript row.

### `POST /api/calls/{id}/transcript`

```json
{ "text": "...", "language": "en" }
```

Submitting non-empty `text` with no explicit `processingStatus` implies
`DONE`. Registers or updates.

**Retry semantics (fixed 2026-08-11).** These rules are what make a failure at
one stage survivable:

- A submission carrying **no text** never overwrites text already stored. So
  `{"processingStatus": "FAILED"}` records a failed attempt *without*
  destroying a transcript that had already succeeded.
- A submission carrying **real text and no explicit status** sets `DONE`, even
  if the row was previously `FAILED`. Before this fix a transcript that failed
  once and was then re-uploaded successfully kept `processingStatus: "FAILED"`
  forever while holding the finished text — the status column and the text
  column disagreed. The same fix applies to `POST /api/calls/{id}/summary`.

Once submitted, the text is **displayed** in the CRM: opening the call's row
in the customer's call history shows the full transcript alongside that call's
timings, recording metadata, summary and follow-up (`GET
/api/customers/{id}/calls` returns `transcriptText`/`transcriptLanguage`
alongside the existing `transcriptStatus`). Nothing is shown until real text
arrives — the badge says `Waiting`, never a placeholder transcript.

## AI summaries — structure only, nothing fabricated

**No AI provider is configured in this backend.** `GET` on a call with no
submitted summary returns `{ "data": null, "processingStatus": "PENDING" }`
— never a generated-looking placeholder.

### `GET /api/calls/{id}/summary`

### `POST /api/calls/{id}/summary`

```json
{
  "summaryText": "...", "keyPoints": ["..."], "customerIntent": "...",
  "sentiment": null, "recommendedAction": "...", "followUpRequired": true,
  "modelProvider": "openai", "modelName": "gpt-4o"
}
```

Intended caller: whatever real AI pipeline eventually exists (e.g.
Android's own `OpenAiSummaryProvider`), not this backend.

Same retry semantics as transcripts (see above, fixed 2026-08-11): a
`{"processingStatus": "FAILED"}` submission never erases a summary that had
already succeeded, and a later submission carrying real `summaryText` clears
the `FAILED` state instead of leaving the row permanently contradicting
itself. **A summary failure can never damage the transcript, the recording, or
the call** — they are separate rows and nothing on this endpoint touches them.

**What a summary should contain** — structure, grounding, and the
English-output rule — is specified in [`SUMMARY_CONTRACT.md`](SUMMARY_CONTRACT.md).
The CRM stores and displays whatever it is given and validates none of it, so
that contract is binding on the pipeline that *produces* summaries, not on
this endpoint.

## Follow-ups / actions

### `GET /api/customers/{id}/actions` / `POST /api/customers/{id}/actions`

```json
// POST request -- customerId comes from the URL, not the body
{ "callId": null, "assignedAgentId": null, "type": "REACH_OUT", "notes": "...", "dueDate": null }
```

`type` ∈ `FOLLOW_UP`/`REACH_OUT`/`CALLBACK`/`OTHER`.

### `PATCH /api/actions/{id}`

```json
{ "status": "COMPLETED" }
```

`status` ∈ `PENDING`/`IN_PROGRESS`/`COMPLETED`/`CANCELLED`. Setting
`COMPLETED` stamps `completedAt` automatically.

## Agents

### `GET /api/agents`

Used for the "Assigned agent" picker.

### `POST /api/agents`

```json
{ "name": "...", "email": "...", "password": "...", "role": "AGENT" }
```

`password` min 8 characters, hashed with bcrypt before storage — never
stored or returned in plaintext, but also no longer checked against
anything (no login exists to use it). `409` if the email is already in
use. `role` is still stored (`ADMIN`/`AGENT`) but doesn't currently gate
anything.

### `PATCH /api/agents/{id}`

```json
{ "name": "...", "role": "ADMIN", "isActive": false }
```

## Health check

### `GET /api/health`

No auth required, no database dependency. `{ "status": "ok", "service": "conbun-crm-backend", "timestamp": "..." }`.

## Android integration requirements

See `ANDROID_API_INTEGRATION.md` for the full mapping from Conbun Call's
existing architecture to this API, current integration status, and the
exact next step to run a real device test.
