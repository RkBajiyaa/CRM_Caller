import bcrypt from "bcryptjs";

/**
 * No authentication happens in this build anymore (see CHANGELOG.md --
 * lib/auth/jwt.ts, session.ts, and every login/logout route were
 * removed). This file survives only because `Agent.passwordHash` is
 * still a required, non-null schema column (lib/agents/service.ts's
 * `createAgent` still needs *something* to hash into it), not because
 * anything checks a password against it. `verifyPassword` currently has
 * no caller -- kept as a small, correct, self-contained utility rather
 * than deleted, since re-adding auth later would need it back unchanged.
 */

// Cost factor 12 -- standard, safe default for bcrypt in 2026; higher costs
// more CPU per hash without being slow enough to matter here.
const SALT_ROUNDS = 12;

export async function hashPassword(plaintext: string): Promise<string> {
  return bcrypt.hash(plaintext, SALT_ROUNDS);
}

export async function verifyPassword(plaintext: string, hash: string): Promise<boolean> {
  return bcrypt.compare(plaintext, hash);
}
