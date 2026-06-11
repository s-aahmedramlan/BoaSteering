import { drizzle } from 'drizzle-orm/node-postgres';
import { Pool } from 'pg';
import * as schema from './schema';

let pool: Pool;
let db: ReturnType<typeof drizzle<typeof schema>>;

export function getDb() {
  if (!db) {
    pool = new Pool({
      connectionString: process.env.DATABASE_URL,
      max: 10,
      idleTimeoutMillis: 30000,
      connectionTimeoutMillis: 5000,
    });
    db = drizzle(pool, { schema });
  }
  return db;
}

export function getPool() {
  getDb();
  return pool;
}

export { schema };
