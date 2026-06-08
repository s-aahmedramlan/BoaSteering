require('dotenv').config();
const { Pool } = require('pg');

async function main() {
  // First restart Boa so the migration runs, then run this script separately.
  // This script calls the /ingest/conversation endpoint twice with different authors
  // to simulate two devs independently capturing the same fact.

  const base = `http://localhost:3333`;

  console.log('Sending fact from dev-alice...');
  const r1 = await fetch(`${base}/ingest/conversation`, {
    method: 'POST',
    headers: { 'content-type': 'application/json' },
    body: JSON.stringify({
      text: 'Human: what HTTP client should I use?\nAssistant: always use axios instead of fetch for HTTP calls in this project',
      source: 'dev-alice',
    }),
  });
  console.log('alice result:', await r1.json());

  // Small delay so embeddings don't race
  await new Promise(r => setTimeout(r, 2000));

  console.log('Sending same fact from dev-bob...');
  const r2 = await fetch(`${base}/ingest/conversation`, {
    method: 'POST',
    headers: { 'content-type': 'application/json' },
    body: JSON.stringify({
      text: 'Human: how do we make HTTP requests?\nAssistant: use axios not the native fetch API in this codebase',
      source: 'dev-bob',
    }),
  });
  console.log('bob result:', await r2.json());

  await new Promise(r => setTimeout(r, 2000));

  console.log('\nChecking facts table...');
  const pool = new Pool({ connectionString: process.env.DATABASE_URL });
  const result = await pool.query(`
    SELECT id, content, authors, array_length(authors, 1) as author_count
    FROM facts ORDER BY created_at DESC LIMIT 5
  `);
  result.rows.forEach(row => {
    console.log(`[${row.author_count} author(s)] ${row.authors} | ${row.content}`);
  });
  await pool.end();
}

main().catch(console.error);
