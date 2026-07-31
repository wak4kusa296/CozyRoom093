/**
 * PostgreSQL is the application's only runtime content and uploaded-asset store.
 * Set CONTENT_STORE=filesystem only for local development/import-export workflows.
 */
export type ContentStore = "postgres" | "filesystem";

const FILESYSTEM_STORE_MESSAGE =
  "CONTENT_STORE=filesystem is limited to local development. Use PostgreSQL for all deployed environments.";

export function getContentStore(): ContentStore {
  const configured = process.env.CONTENT_STORE?.trim().toLowerCase();
  if (configured === "filesystem") {
    if (process.env.NODE_ENV === "production" || process.env.VERCEL) {
      throw new Error(FILESYSTEM_STORE_MESSAGE);
    }
    return "filesystem";
  }
  return "postgres";
}

export function isPostgresContentStore(): boolean {
  return getContentStore() === "postgres";
}

export function isFilesystemContentStore(): boolean {
  return getContentStore() === "filesystem";
}

/** Thumbnails and push images use the same configured store as article Markdown. */
export function isPostgresAssetStore(): boolean {
  return isPostgresContentStore();
}

export function assertContentWritable(): void {
  getContentStore();
}
