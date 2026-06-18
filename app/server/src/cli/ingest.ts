import * as fs from 'fs';
import * as path from 'path';
import { getPool } from '../db';
import { getEmbedding } from '../embeddings';
import { detectRepo } from '../repo';

export async function ingest(rootDir: string): Promise<void> {
  const absRoot = path.resolve(rootDir);
  const files = findMarkdownAndText(absRoot);
  const repo = await detectRepo(absRoot);

  let totalStored = 0;
  let totalSkipped = 0;

  for (const filePath of files) {
    const relPath = path.relative(absRoot, filePath).replace(/\\/g, '/');
    const content = fs.readFileSync(filePath, 'utf-8');
    const chunks = content
      .split(/\n\n+/)
      .map((c) => c.trim())
      .filter((c) => c.length >= 50);

    let stored = 0;
    let skipped = 0;

    for (const chunk of chunks) {
      const inserted = await ingestChunk(chunk, relPath, repo);
      if (inserted) stored++; else skipped++;
    }

    process.stdout.write(
      `ingesting ${relPath}... ${stored} chunks stored, ${skipped} skipped (duplicates)\n`,
    );
    totalStored += stored;
    totalSkipped += skipped;
  }

  process.stdout.write(`Done. ${totalStored} chunks stored, ${totalSkipped} skipped.\n`);
}

async function ingestChunk(content: string, relPath: string, repo: string): Promise<boolean> {
  const embedding = await getEmbedding(content);
  const pool = getPool();

  const pgFilePaths = `{"${relPath.replace(/"/g, '\\"')}"}`;
  const pgVector = `[${embedding.join(',')}]`;

  const result = await pool.query<{ similarity: number }>(
    `SELECT 1 - (embedding <=> $1::vector) AS similarity
     FROM facts
     WHERE repo = $2
       AND file_paths && $3::text[]
     ORDER BY embedding <=> $1::vector
     LIMIT 1`,
    [pgVector, repo, pgFilePaths],
  );

  const top = result.rows[0];
  if (top && top.similarity > 0.75) return false;

  await pool.query(
    `INSERT INTO facts (content, embedding, file_paths, author, repo, verified)
     VALUES ($1, $2::vector, $3::text[], $4, $5, $6)`,
    [content, pgVector, pgFilePaths, 'docs', repo, true],
  );
  return true;
}

function findMarkdownAndText(dir: string): string[] {
  const results: string[] = [];
  const entries = fs.readdirSync(dir, { withFileTypes: true });
  for (const entry of entries) {
    const full = path.join(dir, entry.name);
    if (entry.isDirectory()) {
      results.push(...findMarkdownAndText(full));
    } else if (entry.isFile() && /\.(md|txt)$/.test(entry.name)) {
      results.push(full);
    }
  }
  return results;
}
