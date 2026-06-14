import 'dotenv/config';
import { createProxy } from './proxy';
import { getPool } from './db';

const PORT = parseInt(process.env.PORT ?? '3333', 10);

async function runMigrations(): Promise<void> {
  const pool = getPool();

  // Enable pgvector and create facts table if it doesn't exist
  await pool.query(`CREATE EXTENSION IF NOT EXISTS vector`);

  await pool.query(`
    CREATE TABLE IF NOT EXISTS facts (
      id          UUID PRIMARY KEY DEFAULT gen_random_uuid(),
      content     TEXT NOT NULL,
      embedding   vector(1536) NOT NULL,
      file_paths  TEXT[] NOT NULL DEFAULT '{}',
      author      TEXT NOT NULL DEFAULT '',
      repo        TEXT NOT NULL DEFAULT '',
      created_at  TIMESTAMP NOT NULL DEFAULT now(),
      hit_count   INTEGER NOT NULL DEFAULT 0,
      last_hit_at TIMESTAMP,
      verified    BOOLEAN NOT NULL DEFAULT false
    )
  `);

  // HNSW index for fast approximate nearest-neighbour search
  await pool.query(`
    CREATE INDEX IF NOT EXISTS facts_embedding_idx
    ON facts USING hnsw (embedding vector_cosine_ops)
  `);
}

async function main(): Promise<void> {
  try {
    await runMigrations();
    console.log('[boa] database ready');
  } catch (err) {
    console.error('[boa] database migration failed:', err);
    process.exit(1);
  }

  const app = createProxy();

  app.listen(PORT, () => {
    console.log(`Boa proxy running on port ${PORT} — point ANTHROPIC_BASE_URL here`);
    console.log(`  ANTHROPIC_BASE_URL=http://localhost:${PORT}`);
  });
}

main();
