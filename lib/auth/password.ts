import bcrypt from "bcryptjs";

// Cost factor 12 -- standard, safe default for bcrypt in 2026; higher costs
// more CPU per login attempt (defends brute force) without being slow
// enough to hurt normal login latency.
const SALT_ROUNDS = 12;

/** Never store the plaintext -- only this hash goes into Agent.passwordHash. */
export async function hashPassword(plaintext: string): Promise<string> {
  return bcrypt.hash(plaintext, SALT_ROUNDS);
}

export async function verifyPassword(plaintext: string, hash: string): Promise<boolean> {
  return bcrypt.compare(plaintext, hash);
}
