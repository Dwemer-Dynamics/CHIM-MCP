import pg from 'pg';
import dotenv from 'dotenv';

dotenv.config();

const { Pool } = pg;
export type DatabaseTarget = 'dwemer' | 'stobe';

interface QueryOptions {
  database?: DatabaseTarget;
}

interface DbConfig {
  host: string;
  port: number;
  database: string;
  user: string;
  password: string;
}

const dbConfig: DbConfig = {
  host: process.env.DB_HOST || 'localhost',
  port: parseInt(process.env.DB_PORT || '5432', 10),
  database: process.env.DB_NAME || 'dwemer',
  user: process.env.DB_USER || 'dwemer',
  password: process.env.DB_PASSWORD || 'dwemer',
};

export const pool = new Pool(dbConfig);
const stobeDbConfig: DbConfig = {
  ...dbConfig,
  database: process.env.STOBE_DB_NAME || 'stobe',
};
export const stobePool = new Pool(stobeDbConfig);

function setupPoolListeners(activePool: InstanceType<typeof Pool>, label: DatabaseTarget): void {
  // Set search path for consistent table resolution
  activePool.on('connect', async (client) => {
    await client.query('SET search_path TO public');
  });

  activePool.on('error', (err) => {
    console.error(`Unexpected ${label} database error:`, err);
  });
}

setupPoolListeners(pool, 'dwemer');
setupPoolListeners(stobePool, 'stobe');

function getPoolForDatabase(database: DatabaseTarget): InstanceType<typeof Pool> {
  if (database === 'stobe') {
    return stobePool;
  }
  return pool;
}

async function executeReadOnlyQuery<T = unknown>(
  activePool: InstanceType<typeof Pool>,
  query: string,
  params?: unknown[]
): Promise<T[]> {
  const client = await activePool.connect();
  try {
    await client.query('BEGIN TRANSACTION READ ONLY');
    const result = await client.query(query, params);
    await client.query('COMMIT');
    return result.rows as T[];
  } catch (error) {
    await client.query('ROLLBACK');
    throw error;
  } finally {
    client.release();
  }
}

async function executeReadOnlyTransaction<T = unknown>(
  activePool: InstanceType<typeof Pool>,
  queries: Array<{ query: string; params?: unknown[] }>
): Promise<T[][]> {
  const client = await activePool.connect();
  try {
    await client.query('BEGIN TRANSACTION READ ONLY');
    const results: T[][] = [];

    for (const { query, params } of queries) {
      const result = await client.query(query, params);
      results.push(result.rows as T[]);
    }

    await client.query('COMMIT');
    return results;
  } catch (error) {
    await client.query('ROLLBACK');
    throw error;
  } finally {
    client.release();
  }
}

/**
 * Execute a query in a read-only transaction
 */
export async function readOnlyQuery<T = unknown>(
  query: string,
  params?: unknown[],
  options: QueryOptions = {}
): Promise<T[]> {
  const database = options.database || 'dwemer';
  return executeReadOnlyQuery<T>(getPoolForDatabase(database), query, params);
}

/**
 * Execute multiple queries in a single read-only transaction
 */
export async function readOnlyTransaction<T = unknown>(
  queries: Array<{ query: string; params?: unknown[] }>,
  options: QueryOptions = {}
): Promise<T[][]> {
  const database = options.database || 'dwemer';
  return executeReadOnlyTransaction<T>(getPoolForDatabase(database), queries);
}

/**
 * Close the connection pool
 */
export async function closePool(): Promise<void> {
  await Promise.all([pool.end(), stobePool.end()]);
}
