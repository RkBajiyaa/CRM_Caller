/**
 * ============================================================================
 * DEVELOPMENT/TEST DATA ONLY -- NOT REAL CUSTOMERS
 * ============================================================================
 *
 * Creates ~28 obviously-fictional customers (plus two supporting test
 * agent accounts) so the CRM's Customers page and the new "Call" button
 * can be exercised against real rows in the real database, without
 * touching or resembling any real customer.
 *
 * Every generated customer is marked as test data in THREE independent,
 * mutually-reinforcing ways so it's unmistakable in the UI and in the
 * database, not just in a comment here:
 *   1. Name is prefixed "(Test) " -- visible in every list/table column.
 *   2. Phone number is a sequential +91 90000 000XX block -- no real
 *      customer's number would be sequentially numbered like this.
 *   3. `notes` explicitly says "Development/test customer -- safe to
 *      delete. Not a real customer."
 *
 * Idempotent (find-then-create per phone number, not upsert -- see
 * prisma/seed.ts's comment on why). Safe to re-run: existing test rows
 * are left alone, only missing ones are created. Never touches any
 * customer whose phone number isn't in the reserved +91 90000 000XX
 * block, so real data (e.g. the customer created directly through the
 * CRM UI) is never read, modified, or deleted by this script.
 *
 * Run with: npx tsx prisma/seed-test-customers.ts (or `npm run db:seed-test-customers`)
 */
// Loaded explicitly -- unlike prisma/seed.ts (invoked via `prisma db seed`,
// which loads prisma.config.ts's `import "dotenv/config"` first), this
// script is run directly (`npm run db:seed-test-customers` -> `tsx ...`),
// so nothing else populates process.env for it first.
import "dotenv/config";
import { PrismaNeon } from "@prisma/adapter-neon";
import { neonConfig } from "@neondatabase/serverless";
import WebSocket from "ws";
import { PrismaClient } from "../lib/generated/prisma/client";
import bcrypt from "bcryptjs";

neonConfig.webSocketConstructor = WebSocket;

const TEST_PHONE_PREFIX = "+91 90000 000"; // + 2-digit suffix below -- reserved, sequential, obviously synthetic

const TEST_AGENTS = [
  { name: "Test Agent - Neha Verma", email: "test-agent-1@conbun.dev" },
  { name: "Test Agent - Amit Rathore", email: "test-agent-2@conbun.dev" },
];
const TEST_AGENT_PASSWORD = "ConbunTestAgent!2026"; // dev-only, same non-secret status as prisma/seed.ts's admin password

const LOCATIONS = [
  "Jaipur, Rajasthan",
  "Udaipur, Rajasthan",
  "Jodhpur, Rajasthan",
  "Kota, Rajasthan",
  "Jaisalmer, Rajasthan",
  "Ajmer, Rajasthan",
  "Bikaner, Rajasthan",
  "Alwar, Rajasthan",
  "Bharatpur, Rajasthan",
  "Sikar, Rajasthan",
];

const STATUSES = ["ACTIVE", "INACTIVE", "FOLLOW_UP", "CLOSED"] as const;

const NAMES = [
  "Priya Sharma",
  "Arjun Mehta",
  "Sanya Kapoor",
  "Vikram Singh",
  "Fatima Khan",
  "Karan Joshi",
  "Anjali Verma",
  "Rohit Gupta",
  "Neha Malhotra",
  "Suresh Yadav",
  "Divya Reddy",
  "Aditya Rathore",
  "Meera Patel",
  "Rajesh Kumar",
  "Pooja Agarwal",
  "Sanjay Chauhan",
  "Kavita Bhatt",
  "Manish Tiwari",
  "Ritu Saxena",
  "Deepak Chopra",
  "Swati Nair",
  "Vivek Bansal",
  "Ananya Iyer",
  "Harish Pillai",
  "Nisha Bhatia",
  "Amit Trivedi",
  "Preeti Desai",
  "Gaurav Mishra",
];

const TEST_NOTE = "Development/test customer -- safe to delete. Not a real customer.";

const daysAgo = (n: number) => new Date(Date.now() - n * 86_400_000);

async function main() {
  const connectionString = process.env.DATABASE_URL;
  if (!connectionString) {
    throw new Error("DATABASE_URL is not set -- cannot seed.");
  }
  const prisma = new PrismaClient({ adapter: new PrismaNeon({ connectionString }) });

  // --- Test agents (so "assigned agent" has real variety to test with) ---
  const agentIds: (string | null)[] = [null]; // null = "Unassigned" is one of the varied states too
  for (const spec of TEST_AGENTS) {
    const existing = await prisma.agent.findUnique({ where: { email: spec.email } });
    const agent =
      existing ??
      (await prisma.agent.create({
        data: {
          name: spec.name,
          email: spec.email,
          passwordHash: await bcrypt.hash(TEST_AGENT_PASSWORD, 12),
          role: "AGENT",
        },
      }));
    agentIds.push(agent.id);
    console.log(`Test agent ready: ${agent.name} (${agent.id})`);
  }
  // Include the real dev admin too, if it exists, for variety -- but don't create it here, that's seed.ts's job.
  const devAdmin = await prisma.agent.findUnique({ where: { email: "admin@conbun.dev" } });
  if (devAdmin) agentIds.push(devAdmin.id);

  // --- Test customers ---
  let created = 0;
  let skipped = 0;
  for (let i = 0; i < NAMES.length; i++) {
    const suffix = String(i + 1).padStart(2, "0");
    const phoneNumber = `${TEST_PHONE_PREFIX}${suffix}`;

    const existing = await prisma.customer.findUnique({ where: { phoneNumber } });
    if (existing) {
      skipped++;
      continue;
    }

    const agentId = agentIds[i % agentIds.length];
    const agentName = agentId ? (await prisma.agent.findUnique({ where: { id: agentId } }))?.name ?? null : null;

    await prisma.customer.create({
      data: {
        name: `(Test) ${NAMES[i]}`,
        phoneNumber,
        location: LOCATIONS[i % LOCATIONS.length],
        assignedAgentId: agentId,
        assignedAgent: agentName,
        accountCreatedAt: i % 3 === 0 ? null : daysAgo(60 + i * 5),
        crmEntryCreatedAt: daysAgo(i * 2),
        status: STATUSES[i % STATUSES.length],
        notes: TEST_NOTE,
      },
    });
    created++;
  }

  console.log(`Test customer seed complete. Created: ${created}, already present (skipped): ${skipped}.`);
  await prisma.$disconnect();
}

main().catch((error) => {
  console.error("Test customer seed failed:", error);
  process.exit(1);
});
