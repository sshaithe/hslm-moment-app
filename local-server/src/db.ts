import { Pool } from 'pg';
import dotenv from 'dotenv';

dotenv.config();

if (!process.env.DATABASE_URL) {
  console.error('[DB] FATAL: DATABASE_URL environment variable is not set.');
  process.exit(1);
}

// ─── Connection Pool ──────────────────────────────────────────────────────────
// max: connection limit (scalable via env, defaulting to 50 for concurrent spikes).
// idleTimeoutMillis: release idle connections after 30s to save resources.
export const pool = new Pool({
  connectionString: process.env.DATABASE_URL,
  max: parseInt(process.env.DATABASE_POOL_MAX || '10', 10),
  idleTimeoutMillis: parseInt(process.env.DATABASE_POOL_IDLE_TIMEOUT || '30000', 10),
  connectionTimeoutMillis: parseInt(process.env.DATABASE_POOL_CONN_TIMEOUT || '10000', 10),
});

pool.on('error', (err) => {
  console.error('[DB] Unexpected error on idle client:', err);
});

// ─── Query helper with automatic error logging ────────────────────────────────
export async function query<T = Record<string, unknown>>(
  text: string,
  params?: unknown[]
): Promise<T[]> {
  const start = Date.now();
  try {
    const result = await pool.query(text, params);
    const duration = Date.now() - start;
    if (duration > 500) {
      console.warn(`[DB] Slow query (${duration}ms): ${text.substring(0, 80)}...`);
    }
    return result.rows as T[];
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : String(err);
    console.error(`[DB] Query error: ${message}\nQuery: ${text.substring(0, 120)}`);
    throw err;
  }
}

// ─── Health check ─────────────────────────────────────────────────────────────
export async function checkConnection(): Promise<boolean> {
  try {
    await pool.query('SELECT 1');
    return true;
  } catch {
    return false;
  }
}
