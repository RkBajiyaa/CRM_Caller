# Android Integration — Conbun Call ↔ Conbun CRM Backend

Status as of this writing: **backend-side complete and tested; Android-side
code added and compiled; no on-device run performed yet.** This document
records what was actually done, not a plan.

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

## Data mapping

| Android concept | Backend concept |
|---|---|
| `AppSettings.apiBaseUrl` | This backend's base URL |
| `AppSettings.crmAuthToken` | The JWT returned by `POST /api/auth/login`, now fetched via the new Sign In button instead of only manual paste |
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
   URL, enter the seeded dev admin's email/password (see
   `prisma/seed.ts` — not repeated here) in the new **Agent email**/
   **Agent password** fields, tap **Sign in to CRM backend**.
4. **Confirm** the result text shows "Signed in as Dev Admin (ADMIN)..."
   and that the CRM Auth Token field above it is now populated.
5. That completes the login leg of Phase 12's test procedure from a real
   device. The remaining legs (start call → finish call → recording →
   transcript → summary) are implemented and backend-verified but need a
   UI call site wired up before they're reachable the same way — see
   "What was deliberately NOT done" above for that follow-up task.

Nothing above is faked or assumed complete — this is the literal, precise
handoff point.
