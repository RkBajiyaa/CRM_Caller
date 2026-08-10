-- Adds customers.phone_key (normalized phone lookup key) plus the indexes the
-- app's actual query patterns need. Hand-edited after `prisma migrate dev
-- --create-only` to (a) backfill phone_key for existing rows and (b) create the
-- replacement indexes BEFORE dropping the ones they supersede, so there is no
-- window where a query loses index coverage.

-- ---------------------------------------------------------------------------
-- customers.phone_key -- last 10 digits of phone_number, non-digits stripped.
-- Same normalization lib/customers/phone.ts applies on every write; this
-- statement is the one-time backfill for rows written before the column
-- existed. NULL (not '') for anything with no digits at all, so the lookup
-- fallback can't match "no key" against "no key".
-- ---------------------------------------------------------------------------
ALTER TABLE "customers" ADD COLUMN     "phone_key" TEXT;

UPDATE "customers"
SET "phone_key" = NULLIF(RIGHT(REGEXP_REPLACE("phone_number", '[^0-9]', '', 'g'), 10), '');

-- CreateIndex
CREATE INDEX "customers_phone_key_idx" ON "customers"("phone_key");

-- CreateIndex
CREATE INDEX "customers_crm_entry_created_at_idx" ON "customers"("crm_entry_created_at");

-- CreateIndex
CREATE INDEX "call_requests_status_requested_at_idx" ON "call_requests"("status", "requested_at");

-- CreateIndex
CREATE INDEX "calls_customer_id_started_at_idx" ON "calls"("customer_id", "started_at");

-- DropIndex -- superseded by call_requests_status_requested_at_idx above
-- ("status" is that index's leading column, so it serves every query this did).
DROP INDEX "call_requests_status_idx";

-- DropIndex -- superseded by calls_customer_id_started_at_idx above, same reason.
DROP INDEX "calls_customer_id_idx";
