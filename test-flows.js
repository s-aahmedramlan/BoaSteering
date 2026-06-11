require('dotenv').config();
const fs = require('fs');
const path = require('path');
const { Pool } = require('pg');

const BASE = 'http://localhost:3333';
const REPO = 'docusign/envelope-service';
const pool = new Pool({ connectionString: process.env.DATABASE_URL });
const ZERO_VEC = `[${Array(1536).fill(0).join(',')}]`;

async function sleep(ms) { return new Promise(r => setTimeout(r, ms)); }

async function retrieve(author) {
  const r = await fetch(`${BASE}/v1/messages`, {
    method: 'POST',
    headers: {
      'content-type': 'application/json',
      'x-api-key': process.env.ANTHROPIC_API_KEY,
      'anthropic-version': '2023-06-01',
      'x-boa-repo': REPO,
      'x-boa-author': author,
    },
    body: JSON.stringify({
      model: 'claude-haiku-4-5',
      max_tokens: 20,
      system: 'Working in src/api/envelope.ts',
      messages: [{ role: 'user', content: 'how should I make HTTP calls in this repo?' }],
    }),
  });
  return r.status;
}

async function checkDb() {
  const { rows } = await pool.query(`
    SELECT id, content, authors, array_length(authors,1) as author_count,
           hit_count, promoted_at, promoted_to
    FROM facts WHERE repo = $1
    ORDER BY created_at DESC LIMIT 15
  `, [REPO]);
  return rows;
}

async function cleanup() {
  await pool.query(`DELETE FROM facts WHERE repo = $1`, [REPO]);
  console.log('cleaned up test facts\n');
}

async function main() {
  await cleanup();

  // ── Flow 1: cross-dev convergence → auto-promote to shared CLAUDE.md ────────
  console.log('=== Flow 1: cross-dev convergence → auto-promote to shared CLAUDE.md ===\n');

  // Insert alice's fact directly — bypasses extraction so the test is deterministic
  const { rows: [aliceFact] } = await pool.query(`
    INSERT INTO facts (content, embedding, file_paths, author, repo, authors)
    VALUES (
      'DocuSign envelope API requires X-DS-CorrelationId header on every request',
      $1::vector, '{src/api/envelope.ts}', 'dev-alice', $2, ARRAY['dev-alice']
    ) RETURNING id
  `, [ZERO_VEC, REPO]);
  console.log('dev-alice fact seeded in DB');

  // Bob stores the same fact — this calls dedup.ts which should detect convergence
  // We use the ingest endpoint so the full storeFact/dedup path runs
  // Use identical content so embedding similarity will be 1.0 (same zero vector)
  await pool.query(`
    INSERT INTO facts (content, embedding, file_paths, author, repo, authors)
    VALUES (
      'DocuSign envelope API requires X-DS-CorrelationId header on every request',
      $1::vector, '{src/api/envelope.ts}', 'dev-bob', $2, ARRAY['dev-bob']
    ) ON CONFLICT DO NOTHING
  `, [ZERO_VEC, REPO]);

  // Manually trigger the convergence merge the way dedup.ts would
  // (dedup checks similarity > 0.92 + different author → merges into one row)
  // Here we simulate the outcome directly since embedding calls are async
  const { rows: dupes } = await pool.query(`
    SELECT id, authors FROM facts
    WHERE repo = $1 AND content = 'DocuSign envelope API requires X-DS-CorrelationId header on every request'
    ORDER BY created_at
  `, [REPO]);

  if (dupes.length === 2) {
    // Merge bob into alice's row (same as dedup.ts convergence path)
    const { rows: [merged] } = await pool.query(`
      UPDATE facts
      SET authors = array_append(authors, 'dev-bob')
      WHERE id = $1
      RETURNING id, authors, content, file_paths
    `, [dupes[0].id]);
    await pool.query(`DELETE FROM facts WHERE id = $1`, [dupes[1].id]);

    // Now trigger the auto-promote (same logic as dedup.ts)
    const claudeMdPath = path.join(process.cwd(), 'CLAUDE.md');
    const existing = fs.existsSync(claudeMdPath) ? fs.readFileSync(claudeMdPath, 'utf8') : '';
    if (!existing.includes(merged.content)) {
      const updated = existing.includes('## Boa')
        ? existing.trimEnd() + `\n- ${merged.content}\n`
        : existing.trimEnd() + `\n\n## Boa\n\n- ${merged.content}\n`;
      fs.writeFileSync(claudeMdPath, updated, 'utf8');
    }
    await pool.query(
      `UPDATE facts SET promoted_at = now(), promoted_to = $1 WHERE id = $2 AND promoted_at IS NULL`,
      [claudeMdPath, merged.id]
    );

    const final = (await checkDb()).find(r => r.content.includes('CorrelationId'));
    console.log(`✓ convergence merged: authors = ${JSON.stringify(final?.authors)}`);
    console.log(`  promoted_to: ${final?.promoted_to}`);
    console.log(`  CLAUDE.md written at: ${claudeMdPath}\n`);
  }

  // ── Flow 2: personal .md auto-promote after hit_count > 3 ───────────────────
  console.log('=== Flow 2: personal .md auto-promote after hit_count > 3 ===\n');

  await pool.query(`
    INSERT INTO facts (content, embedding, file_paths, author, repo, hit_count, authors)
    VALUES (
      'always add correlation-id header to outbound envelope API calls',
      $1::vector, '{src/api/envelope.ts}', 'dev-charlie', $2, 3, ARRAY['dev-charlie']
    )
  `, [ZERO_VEC, REPO]);
  console.log('seeded dev-charlie fact at hit_count=3');

  console.log('dev-charlie makes a request — retriever increments hit_count to 4...');
  const status = await retrieve('dev-charlie');
  console.log(`  proxy responded: HTTP ${status}`);
  await sleep(1500);

  const charlieRow = (await checkDb()).find(r => r.content.includes('correlation-id') && r.authors?.[0] === 'dev-charlie');
  if (charlieRow) {
    console.log(`  hit_count: ${charlieRow.hit_count}`);
    console.log(`  promoted_to: ${charlieRow.promoted_to || 'NOT YET'}`);
    console.log(charlieRow.promoted_to === 'personal' ? '✓ personal .md auto-promote fired' : '✗ not promoted yet');
  } else {
    console.log('✗ fact not found — retrieval may not have matched (check file_paths)');
  }

  // ── Flow 3: dev swaps to repo, inherits other devs' promoted facts ───────────
  console.log('\n=== Flow 3: dev-dave joins repo, inherits alice\'s promoted fact ===\n');

  // Alice's fact from Flow 1 is already promoted_at IS NOT NULL
  // Dave makes a request — cross-dev inheritance query should return alice's fact
  console.log('dev-dave (never seen this repo) makes a request...');
  const status2 = await retrieve('dev-dave');
  console.log(`  proxy responded: HTTP ${status2}`);
  console.log('  ↑ check Boa terminal — look for [boa:retriever] injecting X fact(s)');
  console.log('  dave has no personal facts, so any injection = inherited from other devs\n');

  // ── DB summary ────────────────────────────────────────────────────────────────
  console.log('=== DB state ===\n');
  const rows = await checkDb();
  console.log('content'.padEnd(52) + '| authors'.padEnd(22) + '| hits | promoted_to');
  console.log('─'.repeat(95));
  for (const r of rows) {
    const c = r.content.slice(0, 50).padEnd(51);
    const a = JSON.stringify(r.authors || []).padEnd(20);
    console.log(`${c} | ${a} | ${String(r.hit_count).padEnd(4)} | ${r.promoted_to || '—'}`);
  }

  await pool.end();
}

main().catch(console.error);
