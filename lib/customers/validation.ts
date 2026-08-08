import { z } from "zod";
import { CUSTOMER_STATUSES } from "@/lib/customers/types";

/**
 * Request-body validation at the API boundary, per CRM_ARCHITECTURE.md #4.
 * Shared by the Add New User form (client-side, for immediate feedback)
 * and the API routes (server-side, authoritative -- never trust the
 * client). `id`/`crmEntryCreatedAt` are intentionally absent from both
 * schemas: they are never accepted from a client (CLAUDE.md rule #5).
 */

const statusSchema = z.enum(CUSTOMER_STATUSES);

// A permissive phone-number check -- digits, spaces, +, -, (), at least 7
// digits total. This is a lookup/matching field, not a strict E.164
// validator; over-validating real-world phone input causes more support
// pain than it prevents.
const phoneNumberSchema = z
  .string()
  .trim()
  .min(1, "Phone number is required")
  .refine((v) => (v.match(/\d/g)?.length ?? 0) >= 7, {
    message: "Enter a valid phone number (at least 7 digits)",
  });

export const createCustomerSchema = z.object({
  name: z.string().trim().min(1, "Name is required").max(200),
  phoneNumber: phoneNumberSchema,
  location: z.string().trim().max(200).optional().nullable(),
  assignedAgentId: z.string().trim().min(1).optional().nullable(),
  accountCreatedAt: z
    .string()
    .datetime({ offset: true })
    .optional()
    .nullable()
    .or(z.literal("").transform(() => null)),
  status: statusSchema.optional(),
  notes: z.string().trim().max(2000).optional().nullable(),
});

export const updateCustomerSchema = createCustomerSchema.partial();

export type CreateCustomerParsed = z.infer<typeof createCustomerSchema>;
export type UpdateCustomerParsed = z.infer<typeof updateCustomerSchema>;
