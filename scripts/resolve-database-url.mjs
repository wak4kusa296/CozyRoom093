/** @returns {string | undefined} */
export function resolveDatabaseUrl() {
  const s =
    process.env.DATABASE_URL?.trim() ||
    process.env.POSTGRES_URL?.trim() ||
    process.env.POSTGRES_PRISMA_URL?.trim();
  return s || undefined;
}
