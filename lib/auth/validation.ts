import { z } from "zod";

// Agent-record validation only -- no authentication in this build (see
// CHANGELOG.md). `password` here just satisfies Agent.passwordHash's
// schema requirement (bcrypt-hashed on write, lib/agents/service.ts), it
// isn't checked against anything on read anymore.
export const createAgentSchema = z.object({
  name: z.string().trim().min(1, "Name is required").max(200),
  email: z.string().trim().email("Enter a valid email address"),
  password: z.string().min(8, "Password must be at least 8 characters"),
  role: z.enum(["ADMIN", "AGENT"]).optional(),
});

export const updateAgentSchema = z.object({
  name: z.string().trim().min(1).max(200).optional(),
  role: z.enum(["ADMIN", "AGENT"]).optional(),
  isActive: z.boolean().optional(),
});
