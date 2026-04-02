import { Pool } from "pg";
import { resolveDatabaseConnectionString } from "./database-url";

let pool: Pool | null = null;

export function getDbPool() {
  if (pool) return pool;

  const connectionString = resolveDatabaseConnectionString();
  if (!connectionString) {
    throw new Error(
      "Database URL is not configured. Set DATABASE_URL or POSTGRES_URL (Vercel Neon sets POSTGRES_URL)."
    );
  }

  pool = new Pool({ connectionString });
  return pool;
}
