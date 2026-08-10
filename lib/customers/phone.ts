/**
 * Phone-number normalization for *lookup only*.
 *
 * `Customer.phoneNumber` remains the single source of truth and the value
 * every client sees -- nothing here ever rewrites it. These helpers only
 * derive `Customer.phoneKey`, the indexed column
 * `GET /api/customers/lookup` falls back to when an exact string match
 * misses (CLAUDE.md rule #1: phone number is a lookup/matching field,
 * never identity).
 *
 * The rule is deliberately the same one the Android app already applies
 * locally when it matches a recording to a call
 * (`ConbunCall_V4`'s `PhoneNumberUtils.looseMatch`: strip to digits, compare
 * the last 10) -- so both sides agree on when two numbers are "the same
 * number" without either having to change. Ten digits is the national
 * subscriber-number length for India (+91), which is what this CRM's data
 * is; it also makes "+91 93352 74362", "+919335274362", "09335274362" and
 * "9335274362" all resolve to one customer, which is exactly the mismatch
 * that was stranding CRM call requests (see CHANGELOG.md 2026-08-10).
 */

const PHONE_KEY_DIGITS = 10;

/** Every digit in `raw`, in order, with '+', spaces, dashes and brackets dropped. */
export function phoneDigits(raw: string): string {
  return raw.replace(/\D/g, "");
}

/**
 * The indexed lookup key for a phone number: its last {@link PHONE_KEY_DIGITS}
 * digits. Returns `null` when there are no digits at all, so a garbage value
 * can never match another garbage value.
 *
 * Shorter-than-10-digit numbers key on all the digits they have, rather than
 * being rejected -- the CRM already contains such rows and silently making
 * them unlookupable would be worse than matching them exactly.
 */
export function phoneKey(raw: string | null | undefined): string | null {
  if (!raw) return null;
  const digits = phoneDigits(raw);
  if (digits.length === 0) return null;
  return digits.slice(-PHONE_KEY_DIGITS);
}
