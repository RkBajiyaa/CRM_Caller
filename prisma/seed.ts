/**
 * Development-only seed: one admin agent account, so there's a way to log
 * into the CRM before a real admin creates real agent accounts through
 * POST /api/agents. Idempotent (upsert by email) -- safe to re-run.
 *
 * ============================================================================
 * DEV-ONLY CREDENTIALS -- documented on purpose, not a real secret.
 * ============================================================================
 * email:    admin@conbun.dev
 * password: ConbunDev!2026
 *
 * This is a known, shared local-development login, the same idea as any
 * project that ships a documented demo/dev account -- it is NOT protecting
 * anything sensitive by itself (the database it protects only has demo
 * data right now) and must NOT be relied on past local development. Before
 * any real deployment: create real admin accounts via POST /api/agents
 * (see API_DOCUMENTATION.md) and stop running this seed against that
 * database, or change this password first.
 *
 * Run with: npx prisma db seed
 */
import { PrismaNeon } from "@prisma/adapter-neon";
import { neonConfig } from "@neondatabase/serverless";
import WebSocket from "ws";
import { PrismaClient } from "../lib/generated/prisma/client";
import bcrypt from "bcryptjs";

// See lib/db/prisma.ts for why this is needed on Node 20 outside Next's bundler.
neonConfig.webSocketConstructor = WebSocket;

const DEV_ADMIN_EMAIL = "admin@conbun.dev";
const DEV_ADMIN_PASSWORD = "ConbunDev!2026";

async function main() {
  const connectionString = process.env.DATABASE_URL;
  if (!connectionString) {
    throw new Error("DATABASE_URL is not set -- cannot seed.");
  }
  const prisma = new PrismaClient({ adapter: new PrismaNeon({ connectionString }) });

  // findUnique + create instead of upsert() deliberately -- upsert runs as
  // an interactive transaction, which needs the Neon adapter's WebSocket
  // session mode. That's unavailable in some sandboxed/restricted network
  // environments (confirmed here) even though plain HTTP-based queries
  // work fine. A seed script re-run doesn't need transactional atomicity
  // against concurrent writers, so this simpler form is a real fix, not a
  // workaround-that-hides-a-bug.
  const existing = await prisma.agent.findUnique({ where: { email: DEV_ADMIN_EMAIL } });
  const agent =
    existing ??
    (await prisma.agent.create({
      data: {
        name: "Dev Admin",
        email: DEV_ADMIN_EMAIL,
        passwordHash: await bcrypt.hash(DEV_ADMIN_PASSWORD, 12),
        role: "ADMIN",
      },
    }));

  console.log(`Seed complete. Dev admin agent: ${agent.email} (${agent.id}).`);
  console.log("Credentials: see the comment at the top of prisma/seed.ts (dev-only, not printed here).");

  await prisma.$disconnect();
}

main().catch((error) => {
  console.error("Seed failed:", error);
  process.exit(1);
});
