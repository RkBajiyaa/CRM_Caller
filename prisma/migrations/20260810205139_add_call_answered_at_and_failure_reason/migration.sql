-- Two additive, nullable columns on `calls` so the CRM can persist the whole
-- call result Android reports at call-end without waiting on (or coupling to)
-- recording discovery, transcription or summarization.
--
-- Purely additive by design: no column is renamed, dropped or made stricter,
-- nothing is backfilled, and every existing row stays valid as-is. A client
-- that never sends either field behaves exactly as it does today -- which is
-- the case for ConbunCall_V4's current `FinishCallRequest`, which sends only
-- status/endedAt/durationSeconds.
--
--   answered_at    -- when the call was actually picked up (NULL = never
--                     answered, or the reporting client doesn't know). Not
--                     derivable from the existing columns: duration_seconds
--                     tells you a call connected, never when.
--   failure_reason -- free-text detail behind a MISSED/REJECTED/FAILED
--                     outcome. The CallStatus enum stays the field code
--                     branches on; this is only ever extra detail for a human.
ALTER TABLE "calls" ADD COLUMN     "answered_at" TIMESTAMP(3),
ADD COLUMN     "failure_reason" TEXT;
