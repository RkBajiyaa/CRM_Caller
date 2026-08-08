/**
 * Object-storage abstraction for recording audio files (CRM_ARCHITECTURE.md
 * Phase 5). Deliberately minimal: no cloud storage credentials/provider are
 * configured yet, so this is the interface future providers (S3, R2,
 * Vercel Blob, etc.) implement -- not a working upload path today.
 *
 * The `recordings` table only ever stores a reference (`storageProvider` +
 * `storageKey`), never audio bytes (explicit instruction, Phase 5) --
 * that's true regardless of which provider ends up behind this interface.
 *
 * V1 status: PENDING. `POST /api/calls/{id}/recording` registers whatever
 * metadata the caller (Android) already has about a recording -- it does
 * not receive, store, or move any audio bytes, and does not pretend to.
 */

export interface StorageProviderInfo {
  /** Matches Recording.storageProvider in prisma/schema.prisma. */
  name: string;
  configured: boolean;
}

/**
 * The only provider that exists right now. Swap this file's export for a
 * real implementation (e.g. an S3/R2-backed one) when object storage
 * credentials are available -- nothing else in the codebase needs to
 * change, since callers only ever ask `isStorageConfigured()`, they don't
 * import a specific provider.
 */
export function getStorageProviderInfo(): StorageProviderInfo {
  return { name: "pending", configured: false };
}

export function isStorageConfigured(): boolean {
  return getStorageProviderInfo().configured;
}
