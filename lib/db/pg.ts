import { Pool, QueryResult, QueryResultRow } from 'pg';

let pool: Pool | null = null;
let schemaBootstrapped = false;
function triggerSchemaBootstrap() {
  if (schemaBootstrapped) return;
  schemaBootstrapped = true;
  import('@/lib/db/auto-migrate')
    .then(({ ensureDatabaseSchema }) => ensureDatabaseSchema())
    .catch((err) => console.warn('[Auto-Migrate Startup Warning]:', err.message));
}

export function getPgPool(): Pool {
  if (!pool) {
    const connectionString =
      process.env.DATABASE_URL || 'postgresql://postgres:postgres@localhost:5432/exams_db';
    const isLocal = connectionString.includes('localhost') || connectionString.includes('127.0.0.1');

    pool = new Pool({
      connectionString,
      ssl: isLocal ? false : { rejectUnauthorized: false },
      max: 25,
      idleTimeoutMillis: 20000,
      connectionTimeoutMillis: 3000,
      keepAlive: true,
      keepAliveInitialDelayMillis: 5000,
    });

    pool.on('error', (err: Error) => {
      console.warn('[PostgreSQL Pool Auto-Healing]', err.message);
      // If the pool encounters a fatal socket drop, reset it so future queries re-connect cleanly
      try {
        pool?.end().catch(() => {});
      } catch {
        // ignore
      }
      pool = null;
    });

    triggerSchemaBootstrap();
  }
  return pool;
}

/**
 * Resilient query wrapper with automatic 1-retry on dropped/terminated connections.
 */
export async function queryPg<T extends QueryResultRow = any>(
  text: string,
  params?: any[]
): Promise<QueryResult<T>> {
  let p = getPgPool();
  try {
    return await p.query<T>(text, params);
  } catch (err: any) {
    const isConnDrop =
      err.message?.includes('Connection terminated') ||
      err.message?.includes('connection timeout') ||
      err.code === 'ECONNRESET' ||
      err.code === '57P01' ||
      err.code === '08006' ||
      err.code === '08001';

    if (isConnDrop) {
      console.warn('[PostgreSQL Auto-Reconnecting after dropped socket...]');
      try {
        await p.end().catch(() => {});
      } catch {
        // ignore
      }
      pool = null;
      const freshPool = getPgPool();
      return await freshPool.query<T>(text, params);
    }

    // Auto-bootstrap schema if a table does not exist
    if (err.code === '42P01') {
      console.warn('[PostgreSQL Auto-Bootstrapping missing schema tables...]');
      try {
        const { ensureDatabaseSchema } = await import('@/lib/db/auto-migrate');
        await ensureDatabaseSchema();
        return await p.query<T>(text, params);
      } catch (bootErr: any) {
        console.error('[PostgreSQL Schema Bootstrap Failed]:', bootErr.message);
      }
    }

    throw err;
  }
}
