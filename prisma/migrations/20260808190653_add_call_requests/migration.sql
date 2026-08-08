-- CreateEnum
CREATE TYPE "CallRequestStatus" AS ENUM ('PENDING', 'ACCEPTED', 'COMPLETED', 'CANCELLED', 'FAILED');

-- CreateTable
CREATE TABLE "call_requests" (
    "call_request_id" TEXT NOT NULL,
    "customer_id" TEXT NOT NULL,
    "phone_number" TEXT NOT NULL,
    "customer_name" TEXT NOT NULL,
    "status" "CallRequestStatus" NOT NULL DEFAULT 'PENDING',
    "call_id" TEXT,
    "requested_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "call_requests_pkey" PRIMARY KEY ("call_request_id")
);

-- CreateIndex
CREATE UNIQUE INDEX "call_requests_call_id_key" ON "call_requests"("call_id");

-- CreateIndex
CREATE INDEX "call_requests_customer_id_idx" ON "call_requests"("customer_id");

-- CreateIndex
CREATE INDEX "call_requests_status_idx" ON "call_requests"("status");

-- AddForeignKey
ALTER TABLE "call_requests" ADD CONSTRAINT "call_requests_customer_id_fkey" FOREIGN KEY ("customer_id") REFERENCES "customers"("customer_id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "call_requests" ADD CONSTRAINT "call_requests_call_id_fkey" FOREIGN KEY ("call_id") REFERENCES "calls"("call_id") ON DELETE SET NULL ON UPDATE CASCADE;
