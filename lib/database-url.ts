/**
 * Vercel × Neon 連携では POSTGRES_URL 等が自動注入される一方、
 * 手動では DATABASE_URL を使うことが多い。どちらかがあれば接続する。
 */
export function resolveDatabaseConnectionString(): string | undefined {
  const s =
    process.env.DATABASE_URL?.trim() ||
    process.env.POSTGRES_URL?.trim() ||
    process.env.POSTGRES_PRISMA_URL?.trim();
  return s || undefined;
}
