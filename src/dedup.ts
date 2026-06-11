import * as path from 'path';
import { getPool } from './db';
import { getEmbedding } from './embeddings';
import { appendFactToFile, computeClaudeMdPath } from './cli/promote';

export interface StoreCandidateOptions {
  content: string;
  filePaths: string[];
  author: string;
  repo: string;
  verified?: boolean;
}

export async function storeFact(candidate: StoreCandidateOptions): Promise<void> {
  const embedding = await getEmbedding(candidate.content);
  const pool = getPool();

  const pgFilePaths = `{${candidate.filePaths.map((p) => `"${p.replace(/"/g, '\\"')}"`).join(',')}}`;
  const hasFilePaths = candidate.filePaths.length > 0;

  // Query top matching fact by cosine similarity within the same repo
  const result = await pool.query<{ id: string; content: string; authors: string[]; similarity: number }>(
    `SELECT id, content, authors, 1 - (embedding <=> $1::vector) AS similarity
     FROM facts
     WHERE repo = $2
       ${hasFilePaths ? 'AND file_paths && $3::text[]' : ''}
     ORDER BY embedding <=> $1::vector
     LIMIT 1`,
    hasFilePaths
      ? [`[${embedding.join(',')}]`, candidate.repo, pgFilePaths]
      : [`[${embedding.join(',')}]`, candidate.repo],
  );

  const top = result.rows[0];

  if (top) {
    if (top.similarity > 0.92) {
      const existingAuthors: string[] = Array.isArray(top.authors) ? top.authors : [];
      if (existingAuthors.includes(candidate.author)) {
        // Same author, true duplicate — discard silently
        return;
      }
      // Different author — cross-dev convergence, append author
      try {
        const updated = await pool.query<{ authors: string[]; content: string; file_paths: string[] }>(
          `UPDATE facts SET authors = array_append(authors, $1) WHERE id = $2 RETURNING authors, content, file_paths`,
          [candidate.author, top.id],
        );
        const updatedRow = updated.rows[0];
        const updatedAuthors: string[] = updatedRow?.authors ?? existingAuthors;
        console.log(
          `[boa:dedup] cross-dev convergence: "${top.content}" now seen by ${updatedAuthors.length} author(s)`,
        );

        // Auto-promote to shared CLAUDE.md when 3 devs have independently hit the same fact
        if (updatedAuthors.length >= 3 && updatedRow) {
          const filePaths: string[] = Array.isArray(updatedRow.file_paths) ? updatedRow.file_paths : [];
          const claudeMdPath = computeClaudeMdPath(filePaths, process.cwd(), false);
          appendFactToFile(claudeMdPath, updatedRow.content);
          await pool.query(
            `UPDATE facts SET promoted_at = now(), promoted_to = $1 WHERE id = $2 AND promoted_at IS NULL`,
            [claudeMdPath, top.id],
          );
          console.log(`[boa:auto-promote] shared → ${claudeMdPath}: "${updatedRow.content}"`);
        }
      } catch (err) {
        console.error('[boa:auto-promote] convergence promotion failed:', err);
      }
      return;
    }

    if (top.similarity > 0.75) {
      // Potentially contradictory — flag and discard
      console.warn(
        `[boa:dedup] potential conflict detected (similarity=${top.similarity.toFixed(3)})\n` +
          `  existing: ${top.content}\n` +
          `  candidate: ${candidate.content}`,
      );
      return;
    }
  }

  // Store the new fact
  await pool.query(
    `INSERT INTO facts (content, embedding, file_paths, author, repo, verified, authors)
     VALUES ($1, $2::vector, $3::text[], $4, $5, $6, ARRAY[$4])`,
    [
      candidate.content,
      `[${embedding.join(',')}]`,
      pgFilePaths,
      candidate.author,
      candidate.repo,
      candidate.verified ?? false,
    ],
  );

  // Immediately write to personal CLAUDE.{author}.md — one correction is enough to persist it
  if (candidate.author) {
    try {
      const safeName = candidate.author.replace(/[^a-zA-Z0-9_-]/g, '-');
      const claudeMdPath = path.join(process.cwd(), `CLAUDE.${safeName}.md`);
      appendFactToFile(claudeMdPath, candidate.content);
      console.log(`[boa:auto-promote] personal → CLAUDE.${safeName}.md: "${candidate.content}"`);
    } catch (err) {
      console.error('[boa:auto-promote] personal promotion failed:', err);
    }
  }
}
