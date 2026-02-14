import pg from 'pg';
import dotenv from 'dotenv';

dotenv.config();

const { Pool } = pg;

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

// Test connection and set search path
pool.on('connect', async (client) => {
  await client.query('SET search_path TO public');
});

pool.on('error', (err) => {
  console.error('Unexpected database error:', err);
});

/**
 * Execute a query in a read-only transaction
 */
export async function readOnlyQuery<T = unknown>(
  query: string,
  params?: unknown[]
): Promise<T[]> {
  const client = await pool.connect();
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

/**
 * Execute multiple queries in a single read-only transaction
 */
export async function readOnlyTransaction<T = unknown>(
  queries: Array<{ query: string; params?: unknown[] }>
): Promise<T[][]> {
  const client = await pool.connect();
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
 * Close the connection pool
 */
export async function closePool(): Promise<void> {
  await pool.end();
}
