import { PrismaNeon } from "@prisma/adapter-neon";
import { neonConfig } from "@neondatabase/serverless";
import WebSocket from "ws";
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
 * `@neondatabase/serverless`'s Pool (which the adapter uses internally)
 * needs a WebSocket implementation. Node.js only gained a stable *global*
 * `WebSocket` in v22; on Node 20 (this project's target, see package.json
 * "engines") there isn't one by default. Next.js's bundler happens to
 * polyfill this for code it bundles, which is why this worked without any
 * explicit config when only exercised through `next dev`/`next start` --
 * but it broke immediately the first time the exact same adapter was used
 * from a plain `node`/`tsx` process outside Next's bundler (prisma/seed.ts,
 * see CHANGELOG.md). Setting `ws` explicitly here fixes it for real,
 * instead of continuing to rely on an accident of the bundler, and costs
 * nothing on Node 22+ (the `ws` package still works there).
 */
neonConfig.webSocketConstructor = WebSocket;

/**
 * Next.js hot-reloads server modules in dev, which would otherwise create a
 * new PrismaClient (and a new adapter/connection) on every edit. Caching the
 * instance on `globalThis` in development avoids that; production gets a
 * fresh singleton per server instance, which is what we want on Vercel.
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
