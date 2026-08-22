-- DropIndex
DROP INDEX "calls_agent_id_idx";

-- AlterTable
ALTER TABLE "call_requests" ADD COLUMN     "agent_id" TEXT,
ADD COLUMN     "device_id" TEXT;

-- AlterTable
ALTER TABLE "calls" ADD COLUMN     "client_call_id" TEXT,
ADD COLUMN     "device_id" TEXT;

-- CreateTable
CREATE TABLE "devices" (
    "device_id" TEXT NOT NULL,
    "label" TEXT,
    "agent_id" TEXT,
    "is_active" BOOLEAN NOT NULL DEFAULT true,
    "last_seen_at" TIMESTAMP(3),
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "devices_pkey" PRIMARY KEY ("device_id")
);

-- CreateIndex
CREATE INDEX "devices_agent_id_idx" ON "devices"("agent_id");

-- CreateIndex
CREATE INDEX "call_requests_device_id_status_requested_at_idx" ON "call_requests"("device_id", "status", "requested_at");

-- CreateIndex
CREATE INDEX "call_requests_agent_id_idx" ON "call_requests"("agent_id");

-- CreateIndex
CREATE UNIQUE INDEX "calls_client_call_id_key" ON "calls"("client_call_id");

-- CreateIndex
CREATE INDEX "calls_agent_id_started_at_idx" ON "calls"("agent_id", "started_at");

-- CreateIndex
CREATE INDEX "calls_device_id_started_at_idx" ON "calls"("device_id", "started_at");

-- AddForeignKey
ALTER TABLE "calls" ADD CONSTRAINT "calls_device_id_fkey" FOREIGN KEY ("device_id") REFERENCES "devices"("device_id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "call_requests" ADD CONSTRAINT "call_requests_agent_id_fkey" FOREIGN KEY ("agent_id") REFERENCES "agents"("agent_id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "call_requests" ADD CONSTRAINT "call_requests_device_id_fkey" FOREIGN KEY ("device_id") REFERENCES "devices"("device_id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "devices" ADD CONSTRAINT "devices_agent_id_fkey" FOREIGN KEY ("agent_id") REFERENCES "agents"("agent_id") ON DELETE SET NULL ON UPDATE CASCADE;
