# Android Integration — Conbun Call ↔ Conbun CRM Backend

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
