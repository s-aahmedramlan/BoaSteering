// ts-node: --project tsconfig.scripts.json
import { execSync } from 'child_process';
import * as path from 'path';
import * as dotenv from 'dotenv';

// Load .env from project root (one level up from scripts/)
dotenv.config({ path: path.resolve(__dirname, '../.env') });

import { getPool } from '../src/db';
import { detectRepo } from '../src/repo';

async function main(): Promise<void> {
  let changedFiles: string[] = [];

  try {
    const output = execSync('git diff-tree -r --name-only ORIG_HEAD HEAD', {
      encoding: 'utf8',
      stdio: ['ignore', 'pipe', 'ignore'],
    });
    changedFiles = output.split('\n').filter((f) => f.trim() !== '');
  } catch {
    console.log('[boa:hook] could not determine changed files — skipping verification');
    process.exit(0);
  }

  if (changedFiles.length === 0) {
    console.log('[boa:hook] no changed files — skipping verification');
    process.exit(0);
  }

  let repo = '';
  try {
    repo = await detectRepo();
  } catch {
    // detectRepo already swallows errors; this is just extra safety
  }

  const pool = getPool();

  let verifiedCount = 0;
  try {
    const result = await pool.query<{ count: string }>(
      `UPDATE facts
       SET verified = true
       WHERE repo = $1
         AND file_paths && $2::text[]
         AND verified = false
       RETURNING id`,
      [repo, changedFiles],
    );
    verifiedCount = result.rowCount ?? 0;
  } catch (err) {
    console.error('[boa:hook] db error during verification:', err);
  }

  console.log(
    `[boa:hook] verified ${verifiedCount} facts for ${changedFiles.length} changed files`,
  );

  try {
    await pool.end();
  } catch {
    // ignore pool teardown errors
  }
}

main().catch((err) => {
  console.error('[boa:hook] unexpected error:', err);
  process.exit(0); // always exit cleanly
});
