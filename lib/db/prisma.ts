import { PrismaNeon } from "@prisma/adapter-neon";
import { PrismaClient } from "@/lib/generated/prisma/client";

/**
 * Shared Prisma client singleton, using Neon's serverless driver adapter.
 *
 * Prisma 7 requires an explicit driver adapter (no more implicit
 * engine-based connection) -- see prisma/schema.prisma and
 * CRM_ARCHITECTURE.md #2. `@prisma/adapter-neon` is used instead of the more
 * generic `@prisma/adapter-pg` because it talks to Neon over HTTP/WebSocket
 * rather than a long-lived TCP connection, which fits Vercel's serverless
 * functions (short-lived invocations, no persistent connection pool to
 * exhaust) far better than a traditional TCP driver would.
 *
 * Next.js hot-reloads server modules in dev, which would otherwise create a
 * new PrismaClient (and a new adapter/connection) on every edit. Caching the
 * instance on `globalThis` in development avoids that; production gets a
 * fresh singleton per server instance, which is what we want on Vercel.
 *
 * No models exist yet (see prisma/schema.prisma) -- this file establishes
 * the db access point for Phase 2+ to build on, it does not perform any
 * queries itself, and is not imported by any route yet.
 */
const globalForPrisma = globalThis as unknown as {
  prisma: PrismaClient | undefined;
};

function createPrismaClient(): PrismaClient {
  const connectionString = process.env.DATABASE_URL;
  if (!connectionString) {
    throw new Error(
      "DATABASE_URL is not set. Copy .env.example to .env and fill in a real Neon connection string (see README.md \"Environment variables\")."
    );
  }
  const adapter = new PrismaNeon({ connectionString });
  return new PrismaClient({ adapter });
}

export const prisma = globalForPrisma.prisma ?? createPrismaClient();

if (process.env.NODE_ENV !== "production") {
  globalForPrisma.prisma = prisma;
}
