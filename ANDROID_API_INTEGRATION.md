# Android Integration — Conbun Call ↔ Conbun CRM Backend

> **⚠️ Correction (2026-08-10).** Everything below the "What was inspected"
> heading describes the state on 2026-08-08 and is **out of date in two
> important ways**. It is left in place as the historical record (this
> project appends corrections rather than rewriting history — `CLAUDE.md`
> §4); read the new **"Current contract (verified 2026-08-10)"** section
> immediately below first, which was written by reading the actual Kotlin
> source in `ConbunCall_V4`, not this document.
>
> The two stale claims: (1) "no on-device run performed yet" — the CRM →
> Android call flow has since been exercised on a real device, and the
> database still holds the rows it produced; (2) "`BackendRepository`/
> `BackendApiService` don't have call-request methods yet" — they do, and
> `CallRequestPoller` drives them.

## What changed on the CRM side on 2026-08-22, later pass (read this first)

One behaviour change, and it removes an Android-side requirement rather than
adding one.

**The CRM now works out which agent a call belongs to when the phone doesn't
say.** `agentId` on `POST /api/calls` is resolved in this order: what the
client sent → the linked call request's `agentId` → the reporting device's
assigned agent → `null`. `PATCH /api/calls/{id}` fills the agent in the same
way when its `deviceId` fills in a call that had none. Nothing Android sends
changes meaning: **a value Conbun Call sends is never overridden**, and a call
that reaches the CRM with no agent, no call request and no known device still
records `agentId: null` rather than a guess.

Why it exists, from the real data: three calls placed from the test handset on
2026-08-22 (real recordings, one with a transcript and summary, one of them
fulfilling a CRM call request routed to Rahul) all arrived with `agentId:
null`, because `settings.agentId` on that phone is blank. They counted for
nobody in agent reporting. `CallSessionTracker` sends
`settings.agentId.ifBlank { null }` on both `POST /api/calls` call sites, which
is correct behaviour and should stay — filling that field in by hand on every
handset is exactly what the CRM can now do for itself from configuration it
already holds.

**No Android change is required.** Setting `settings.agentId` still works and
still wins.

Two related observations from the same data, neither of which is an Android
defect and neither of which was changed on the phone:

- The 03:55 CRM-initiated call produced **two** `calls` rows: the dial-time
  registration (from `registerWithCrm`) and a second one from the outcome path.
  Both `clientCallId` and the `callRequestId` recovery lookup that would have
  prevented this are in the *undeployed* CRM code, and `client_call_id` was
  null on both rows. This is the deployment gap, not a contract disagreement —
  see the section below.
- No `Device` row exists yet, so every call still records `deviceId: null`.
  Same cause.

## What changed on the CRM side on 2026-08-22 (read this first)

Devices, call-request routing and call idempotency. Written after reading the
actual Kotlin in `ConbunCall_V4` — including that project's own 2026-08-22
CHANGELOG entry, which describes the matching Android work — not from a plan.

**Nothing Conbun Call sends today needs to change, and nothing it already
sends stops working.** Verified by explicit test, not by inspection: a
`POST /api/calls` carrying only `{customerId, phoneNumber, direction}`, a
`PATCH /api/calls/{id}` carrying only `{status, endedAt, durationSeconds}`,
and a `GET /api/call-requests?status=PENDING` with no `deviceId` all behave
exactly as before.

### The two sides agree. What was missing was a deployment, not a contract.

`ConbunCall_V4`'s 2026-08-22 entry established this from the Android side by
probing the live deployment (`GET /api/devices` → 404; a malformed `deviceId`
→ 200 where this code answers 400) and concluded, correctly, that the CRM's
routing work existed only in this repo's working tree. That is still the
situation: **this work is not deployed to Vercel yet.** Until it is, Android's
new fields are accepted and dropped by the deployed backend, exactly as that
entry predicted, and start working the moment the CRM ships — with no Android
release in between.

| Contract item | CRM (this repo) | Android | State |
|---|---|---|---|
| `agentId` on `POST /api/calls` | accepts, stores; **falls back to the call request's or the device's agent when absent** | sends (blank on the test handset) | **agreed** |
| `deviceId` on `POST /api/calls` | accepts, stores, auto-registers | sends | **agreed** |
| `deviceId`/`agentId` on call requests | resolved server-side, returned | `targetingOf` filters on them | **agreed** |
| `?deviceId=` on the poll | filters, registers, refreshes `lastSeenAt` | sends (guarded) | **agreed** |
| `clientCallId` idempotency | unique index; returns the existing call with 200 | sends on the recovery `POST` | **agreed** |
| `deviceId` on `PATCH /api/calls/{id}` | accepts, fill-in only | not sent | CRM-ready, Android optional |
| `deviceId` on `PATCH /api/call-requests/{id}` | accepts, claims unrouted only | not sent | CRM-ready, Android optional |
| `POST /api/devices` | exists | not called | not needed — the poll registers the device |

Neither of the two "not sent" rows is a defect. Android's device id already
reaches the CRM on `POST /api/calls`, which is where attribution is actually
established; sending it on the PATCHes would only add belt-and-braces.

### One real mismatch was found, and fixed on the CRM side

`CallSessionTracker` sends **the raw, user-editable Settings device id** on
`POST /api/calls` (line 410 and line 980) and builds `clientCallId` from it.
Only `CallRequestPoller` guards its value, through `crmSafeDeviceId`.

This repo's new code validated `deviceId` with the same strict schema on
*every* endpoint. So a stray space typed into that Settings field would have
returned **400 from `POST /api/calls`** — and the call, its outcome, its
recording, its transcript and its summary would all have been lost, to protect
an attribution column. The same failure could reach `clientCallId`, which is
built from that unbounded id and capped at 200 characters.

Fixed here, not there, because the CRM is the side that chose to reject:

- `POST /api/calls`, `PATCH /api/calls/{id}` and `PATCH /api/call-requests/{id}`
  now **drop** an unusable `deviceId` (and an over-long `clientCallId`) instead
  of rejecting the request. An id that can't be used is treated as an id that
  wasn't sent, which the devices design already handles honestly.
- `GET /api/call-requests?deviceId=` and `POST /api/call-requests` stay
  **strict**. Silently dropping the routing filter would hand one phone another
  phone's queue — the exact outcome the parameter exists to prevent — and
  Android already guards that call site itself.

No Android change is required for this, and `crmSafeDeviceId` should stay
exactly as it is: it is still the right guard for the endpoint that routes.

### What Android gets for free once the CRM deploys

1. **Routing.** `POST /api/call-requests` resolves the target from the
   customer's assigned agent and that agent's most-recently-seen active device,
   with no change at the CRM's call site. Requests it cannot route stay
   **unrouted** (`deviceId: null`) and are still offered to every device, so
   `targetingOf`'s `UNADDRESSED` branch remains the common case for
   unassigned customers rather than a legacy path.
2. **Device registration and `lastSeenAt`.** The poll's `deviceId` registers
   the handset on first contact and refreshes its last-seen time, at no extra
   round trip. An unknown device id is never an error.
3. **Idempotency.** `clientCallId` has a unique index; a repeat report returns
   the existing call **untouched** with `200` instead of creating a second row.
   `callRequestId` does the same for every CRM-initiated call — which means the
   whole CRM-originated path became retry-safe with no Android change at all.

### Still true, and still Android's call to make

`BackendRepository.execute` treats a successful empty body as a failure
(`ApiError(code, "Empty response body")`). If any CRM endpoint ever answered
**204**, the app would mark that stage `FAILED` and retry forever despite the
CRM having accepted it. Re-confirmed unreachable from this side on 2026-08-22:
no route in `app/api/` returns 204 or a bodiless response, and the two
idempotent paths added this pass return **200 with the full `{data}` body**,
never 204. Flagged so it stays flagged, not because it fires.

## What changed on the CRM side on 2026-08-11

**Nothing Conbun Call sends today needs to change.** Every endpoint keeps its
URL, its method, its existing request fields and its existing response fields.
`FinishCallRequest(status, endedAt, durationSeconds)`,
`StartCallRequest(...)`, `SubmitTranscriptRequest(text, language)`,
`RegisterRecordingRequest(...)`, `UpdateCallRequestStatusRequest(status,
callId)` and the `?status=PENDING` poll all work unchanged — verified against
a real server, with the legacy `FinishCallRequest` shape tested explicitly.

Four things are worth knowing on the Android side:

1. **`PATCH /api/calls/{id}` now accepts two optional extras**, `answeredAt`
   (ISO-8601) and `failureReason` (free text, ≤500 chars). Both default to
   `null` and are never inferred — the CRM will not derive an answer time from
   the duration. `CallSessionTracker.describeUnsuccessfulOutcome` already
   computes exactly the string `failureReason` wants for its on-device
   activity log; sending it costs one field. `answeredAt` genuinely isn't
   available from the OS `CallLog`, so omitting it stays correct — send it
   only if a future telephony-state path can observe the actual off-hook
   moment.

2. **Call responses carry more fields.** `answeredAt`, `failureReason`,
   `recordingStorageKey`/`recordingMimeType`/`recordingSizeBytes`, the
   `aiSummary*` content fields, and `callRequestRequestedAt` were added to the
   call shape. Gson ignores unknown fields, so `CallDto` needs no change; add
   them only if something on the phone wants to read them back.

3. **`POST /api/call-requests` is now near-atomic** against concurrent
   presses (five simultaneous presses produce one `PENDING` row). Android
   never `POST`s here, so this changes nothing for the app — but it does mean
   the poller should see materially fewer duplicate requests for the same
   customer than the current production data shows.

4. **`GET /api/customers/{id}/calls` is now bounded** (`?limit=`, default 25,
   max 200) and returns a `truncated` flag; `stats` still covers every call.
   No Android call site uses this endpoint (verified by grep of
   `BackendApiService.kt`), so it is informational.

**Added 2026-08-12 — and explicitly not for Android:** the CRM now has one new
route, `GET /api/customers/{id}/call-status`. It is a fingerprint the CRM's own
browser tab polls so an agent watching a call in progress doesn't have to hit
refresh; it returns `{version, lifecycle, active}` and no call data. **Android
must not call it and needs no change for it.** It reads the same `calls` and
`call_requests` rows Android already writes, invents no status, stores nothing,
and does not alter any endpoint Android uses. The one thing worth knowing on the
phone side is that the CRM now surfaces each stage *as it arrives* — so a
recording registered minutes after the call, or a transcript that lands later,
shows up on the agent's screen on its own rather than at the next page load.

Nothing about phone-number matching changed. The rule is still: exact match on
the stored `phoneNumber` first, then the **last 10 digits with non-digits
stripped** — the same rule `PhoneNumberUtils.looseMatch`/`crmLookupDigits`
already use. Re-verified this pass against a live server for
`"+91 99999 00042"`, `"+919999900042"`, `"9999900042"` and `"09999900042"`,
all resolving to one customer.

Summary *content* now has a written contract:
[`SUMMARY_CONTRACT.md`](SUMMARY_CONTRACT.md) — grounding rules, section
structure, and the English-only output rule for Hindi/English calls. It binds
whoever generates summaries (today, Conbun Call's own OpenAI provider), not
the CRM, which stores and displays without validating.

## Current contract (verified 2026-08-10)

Verified by reading `ConbunCall_V4`'s source (read-only — no Android file
was modified) and by exercising every endpoint against the live Neon
database from the CRM side. Nothing in this section is assumed.

### What Android actually implements today

| Android file | What it does |
|---|---|
| `data/backend/BackendApiService.kt` | Retrofit contract: customer lookup/create, call requests (list + PATCH), call start/finish, recording metadata, transcript, AI summary. No `login()` — the backend has no auth. |
| `data/repository/CallRequestPoller.kt` | Polls `GET /api/call-requests?status=PENDING` **every 4 seconds** while the app is foregrounded, accepts one at a time, dials via `CallManager`. |
| `data/repository/CallSessionTracker.kt` | On every call placed: normalizes the number, `GET /api/customers/lookup`, and if it matches, `POST /api/calls`. On call end: `PATCH /api/calls/{id}` with the CallLog-derived outcome + duration, then registers recording metadata and schedules transcription. |
| `work/TranscriptionWorker.kt` | Uploads the finished Whisper transcript via `POST /api/calls/{id}/transcript`. |

### Contract mismatch found — and how it was resolved

**Phone-number matching. This was a live defect, not a theoretical one.**

Android normalizes a number (`PhoneNumberUtils.normalize`: keep digits and a
leading `+`) *before* calling `GET /api/customers/lookup`. The CRM matched
that string **exactly** against the stored `phoneNumber`. So a customer the
CRM stored as `"+91 90000 00001"` was never found when Android asked for
`"+919000000001"` — the lookup 404'd, `CallSessionTracker` logged "not a
known CRM customer", and no `Call` row was ever created.

The evidence was sitting in the production database: of all the CRM call
requests, only the ones for the single customer whose number was stored
already-normalized (`+919335274362`) had a linked `callId`. Every request for
a `"+91 90000 000XX"` customer was stranded at `ACCEPTED` with `callId:
null` — dialed, but invisible to the CRM afterwards.

**Fixed on the CRM side only** (no Android change): the backend now matches
exactly first, then falls back to comparing the **last 10 digits** with
non-digits stripped — the same rule Android's own `looseMatch` already uses.
See `API_DOCUMENTATION.md` § `GET /api/customers/lookup`. Android needs no
change and gets no new field; it keeps sending exactly what it always sent.

### `CallRequest.status` = `COMPLETED` means "dialed", not "call finished"

`CallSessionTracker.onCallInitiated` PATCHes the request to `COMPLETED` the
moment `POST /api/calls` returns — at the *start* of the call. The call's
real outcome arrives later on `PATCH /api/calls/{id}`.

Neither side was changed for this. The CRM instead derives what it displays
by combining the two records (`lib/call-requests/lifecycle.ts`), so it can
distinguish Queued / Dialing / In progress / Connected / Not answered /
Failed / Cancelled without a second status column and without asking Android
to report anything new. Full table in `API_DOCUMENTATION.md` § "What
`COMPLETED` actually means here".

### Android → CRM direction (a normal call, not a CRM-initiated one)

Already implemented on the Android side and now working on the CRM side:

```
Android places any call -> CallSessionTracker.onCallInitiated
  -> GET /api/customers/lookup?phoneNumber=<normalized>
       match    -> POST /api/calls (customerId), and the whole
                   finish/recording/transcript pipeline follows
       no match -> nothing happens. No customer is created, nothing is
                   imported, and nothing on the phone is touched.
```

The backend does the number matching precisely so the phone never needs a
copy of the customer list. `POST /api/customers` exists but **no Android call
site calls it** (verified by grep) — an unknown number stays unknown.

The "CRM Connectivity ON/OFF" switch is an Android-side setting and is not
represented in this API; today the equivalent is a blank
`AppSettings.apiBaseUrl`, which makes `CallSessionTracker` skip CRM
registration entirely. Nothing on the CRM side needs to change when that
switch is added.

### Two smaller CRM-side changes worth knowing about

- `POST /api/call-requests` is now idempotent while a request is `PENDING`
  (returns the existing one with `200`). Android never POSTs here, so it is
  unaffected — this stops the CRM from queueing duplicate dials.
- `GET /api/call-requests` is now bounded (`limit`, default 200, oldest
  first). Android's `status=PENDING` poll is unaffected in practice.

---

_Everything below is the 2026-08-08 record, preserved as written._

Status as of this writing: **backend-side complete and tested; Android-side
code added and compiled; no on-device run performed yet.** This document
records what was actually done, not a plan.

> **⚠️ Backend change since the "Sign in to CRM backend" button below was
> added: the backend no longer has any authentication.** `POST
> /api/auth/login`, `POST /api/auth/logout`, `GET /api/auth/me`, the JWT
> issuing/verification code, and the CRM's own login page were all
> **deleted** (explicit instruction — see `CHANGELOG.md`). Every endpoint
> in `API_DOCUMENTATION.md` is now open, no token needed at all.
>
> **Practical effect on the Kotlin code described below:** `BackendRepository
> .login()` / `BackendApiService.login()` now call a URL that returns
> `404` — that specific method is dead until/unless auth is re-added.
> Every *other* method (`lookupCustomerByPhone`, `createCustomer`,
> `startCall`, `finishCall`, `registerRecording`, `submitTranscript`,
> `submitAiSummary`, and whatever call-request methods exist) still works
> exactly as documented, just without needing an `authToken` — passing one
> (or an empty string) is harmless, it's simply not checked anymore. The
> Settings "Sign in to CRM backend" button will now fail; it can be
> ignored/left as dead UI, or removed, but this document doesn't do either
> since that's an Android-side change outside this pass's CRM-only scope.

## What was inspected in ConbunCall_V4 (read-only)

- `data/crm/` — existing (unwired) client for a *different*, never-built
  backend: an external lead-assignment/auto-dialer server, `leadId`-based,
  not `customerId`-based. Left completely untouched.
- `data/model/CallMetadata.kt` — has reserved `customerId`/`customerName`
  fields, still unused by any write path. Not touched.
- `di/AppContainer.kt` — manual DI container; one line added.
- `ui/settings/` — existing "API Base URL" and "CRM Auth Token" fields,
  already present and user-editable, reused as the new backend's
  connection details instead of adding parallel settings.
- `logger/AppLogger.kt`, `data/crm/NetworkResult.kt` — reused directly for
  the new integration, per that project's own existing conventions.

## What was added (ConbunCall_V4)

A new, separate `data/backend/` package — **not** merged into `data/crm/`,
since that package models a different backend entirely (see its files'
header comments for the full reasoning):

- `BackendDtos.kt` — request/response shapes matching `API_DOCUMENTATION.md`.
- `BackendApiService.kt` — Retrofit interface: login, customer lookup/create,
  call start/finish, recording-metadata/transcript/AI-summary submission.
- `BackendApiClient.kt` — Bearer-token Retrofit client factory (same shape
  as the existing `CrmApiClient`).
- `BackendRepository.kt` — wraps every call in the existing `NetworkResult`
  sealed class, logs via the existing `AppLogger`.
- `di/AppContainer.kt` — one new line, `backendRepository`.
- `ui/settings/SettingsViewModel.kt` + `SettingsScreen.kt` — a "Sign in to
  CRM backend" button (email + password fields), the only UI call site
  added this pass. On success it saves the returned token into the
  existing CRM Auth Token setting.

**Verified:** `JAVA_HOME=/snap/android-studio/236/jbr ./gradlew
:app:compileDebugKotlin --offline` → **BUILD SUCCESSFUL**, real compile,
zero new warnings. See `ConbunCall_V4/CHANGELOG.md`'s 2026-08-08 entry for
the full record.

## What was deliberately NOT done

- **No on-device/emulator test.** This environment has the Android SDK and
  `adb` but `adb devices` returns empty and no AVD is configured — a real
  blocker, not worked around. See "Exact next step" below.
- **No automatic wiring into the real call flow.** `startCall`/
  `finishCall`/`registerRecording`/`submitTranscript`/`submitAiSummary`
  are implemented and compiled, but nothing in `CallDetailScreen` or
  `RecentsViewModel` calls them yet — only `login` is reachable (via the
  new Settings button). Wiring the rest into the actual call-completion
  flow is a separate, smaller follow-up task, kept out of this pass per
  "do not rewrite existing systems" / "preserve existing recording and
  transcription behavior."
- **No changes to recording/transcription/AI-summary logic.** Conbun
  Call's own Whisper transcription pipeline and OpenAI summary provider
  are untouched and remain the source of the text this backend's
  `/transcript` and `/summary` endpoints are designed to receive.

## Call request queue (CRM "Call" button)

New this pass, backend-only (no Android code changed for this specific
part — `BackendRepository`/`BackendApiService` don't have call-request
methods yet, since nothing on the Android side consumes them today). The
CRM's Customers page now has a **Call** button per row; clicking it
creates a `PENDING` call request in Neon via `POST /api/call-requests`.
The intended Android-side flow, not yet implemented in Kotlin:

```
GET /api/call-requests?status=PENDING   -- poll
PATCH /api/call-requests/{id}            {"status":"ACCEPTED"}
  -- place the real call --
POST /api/calls                           {..., "callRequestId": "<id>"}
PATCH /api/calls/{id}                      -- finish, as before
PATCH /api/call-requests/{id}            {"status":"COMPLETED"}
```

Full contract, request/response examples, and status vocabulary:
`API_DOCUMENTATION.md` § "Call requests". **Verified backend-side only**
this pass (`curl`, against the real database, full lifecycle including
the `callRequestId` link — see `CHANGELOG.md`) — adding
`lookupPendingCallRequests`/`acceptCallRequest`/etc. to
`BackendRepository` and a polling call site (e.g. a periodic `WorkManager`
job, matching the existing `TranscriptionWorkScheduler`/`CrmSyncScheduler`
pattern) is the natural next Android-side task, not done here per this
pass's explicit CRM-only scope.

## Data mapping

| Android concept | Backend concept |
|---|---|
| `AppSettings.apiBaseUrl` | This backend's base URL |
| `AppSettings.crmAuthToken` | No longer meaningful -- the backend has no authentication (see the warning at the top of this document). Can stay blank. |
| `AppSettings.agentName` (device-local, free text) | An `Agent` row's `name` in the backend — **not yet reconciled**: today's Settings `agentName` is just a display label, while the backend's identity is `email`+`password`→JWT. The Sign In flow above establishes the real identity; `agentName` in Settings could later be derived from the logged-in agent's name instead of typed separately, but that's a UI polish item, not done here. |
| `CallLogEntry` (from Android's own `CallLog.Calls`) | Maps to a backend `Call` row's `phoneNumber`/`direction`/`startedAt`/`durationSeconds` once a real call site calls `startCall`/`finishCall` |
| `CallMetadata.transcript` (Whisper output) | `POST /api/calls/{id}/transcript`'s `text` |
| Future AI summary (OpenAI, Android-side) | `POST /api/calls/{id}/summary` |
| Recording file (SAF `Uri`, matched by `RecordingsRepository`) | `POST /api/calls/{id}/recording`'s metadata (`storageKey`/`mimeType`/`sizeBytes`/`durationSeconds`) — **not the audio file itself**; no object storage exists yet (see `API_DOCUMENTATION.md` "Recordings") |

`customerId` is never derived from phone number on the Android side either
— the intended flow is `GET /api/customers/lookup?phoneNumber=...` first,
`POST /api/customers` only if that 404s, then use the returned `id` for
every subsequent call. `BackendRepository.lookupCustomerByPhone`/
`createCustomer` implement exactly this, ready to be called from wherever
the eventual call-reporting call site ends up.

## Exact next action to run a real device test

1. **Get a device or emulator.** Either:
   - Connect a real Android phone via USB/`adb`, or
   - Create an AVD (`$ANDROID_HOME/cmdline-tools/latest/bin/avdmanager` or
     Android Studio's Device Manager) and boot it.
   `adb devices` must show a device before continuing.
2. **Make the backend reachable from that device.** The dev server binds
   to the machine's LAN IP already (seen in `next dev`'s own output, e.g.
   `http://10.x.x.x:3000`) — a phone on the same Wi-Fi network can reach
   that directly. An emulator on the same machine can usually reach the
   host via `10.0.2.2:3000` instead. (A public Vercel deployment removes
   this step entirely once the project is pushed and deployed — not done
   yet, see `CHANGELOG.md`.)
3. **Run the app**, open Settings, set **API Base URL** to that reachable
   URL. **Skip the "Sign in to CRM backend" button** — it now calls a
   deleted endpoint and will fail (see the warning at the top of this
   document); the CRM Auth Token field can stay blank, nothing checks it
   anymore.
4. Exercise any of the still-working `BackendRepository` methods directly
   (`lookupCustomerByPhone`, `createCustomer`, `startCall`, `finishCall`,
   `registerRecording`, `submitTranscript`, `submitAiSummary`) — none of
   them need a real token now, an empty string works.
5. Start/finish call, recording/transcript/summary submission, and the
   call-request queue are all implemented and backend-verified but need a
   real UI call site wired up before they're reachable from the running
   app the same way login used to be — see "What was deliberately NOT
   done" above for that follow-up task.

Nothing above is faked or assumed complete — this is the literal, precise
handoff point.
