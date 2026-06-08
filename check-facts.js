require('dotenv').config();
const { Pool } = require('pg');
const pool = new Pool({ connectionString: process.env.DATABASE_URL });

async function main() {
  const stats = await pool.query(`
    SELECT COUNT(*) as total_facts, ROUND(AVG(LENGTH(content))) as avg_chars,
           SUM(LENGTH(content)) as total_chars, SUM(hit_count) as total_hits
    FROM facts
  `);
  console.log('=== Facts table stats ===');
  console.log(stats.rows[0]);

  const recent = await pool.query(`
    SELECT id, hit_count, verified, LENGTH(content) as chars, created_at, content
    FROM facts ORDER BY created_at DESC LIMIT 20
  `);
  console.log('\n=== Most recent 20 facts ===');
  recent.rows.forEach(row => {
    const ver = row.verified ? '✓' : '-';
    console.log(`[${ver} | ${row.hit_count} hits | ${row.chars}ch | ${new Date(row.created_at).toISOString().slice(0,16)}] ${row.content.slice(0,120)}`);
  });

  await pool.end();
}

main().catch(e => { console.error(e); pool.end(); });
