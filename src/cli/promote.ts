import * as fs from 'fs';
import * as os from 'os';
import * as path from 'path';
import Anthropic from '@anthropic-ai/sdk';
import { getPool } from '../db';

interface FactRow {
  id: string;
  content: string;
  file_paths: string[];
  authors: string[];
}

function commonDirPrefix(filePaths: string[]): string {
  const dirs = filePaths.map((p) => path.dirname(p));
  if (dirs.length === 0) return '';

  const counts = new Map<string, number>();
  for (const d of dirs) {
    counts.set(d, (counts.get(d) ?? 0) + 1);
  }

  let best = '';
  let bestCount = 0;
  for (const [dir, count] of counts) {
    if (count > bestCount || (count === bestCount && dir.length < best.length)) {
      best = dir;
      bestCount = count;
    }
  }

  return best;
}

async function shouldPromote(client: Anthropic, content: string): Promise<boolean> {
  try {
    const message = await client.messages.create({
      model: 'claude-haiku-4-5',
      max_tokens: 10,
      system:
        'You are deciding whether a fact belongs in a CLAUDE.md file for a coding agent.\n' +
        'PROMOTE if: the fact is knowledge a coding agent cannot infer by reading the codebase — team history, tribal knowledge, non-obvious conventions, things that changed over time, domain expertise, or facts about external system behaviour.\n' +
        'SKIP if: the agent could figure it out by reading the code files directly — architecture that\'s visible in the code, patterns that are consistently used everywhere, things any competent developer would infer.\n' +
        'Respond with exactly one word: PROMOTE or SKIP.',
      messages: [{ role: 'user', content }],
    });
    const text = message.content[0].type === 'text' ? message.content[0].text : '';
    return text.includes('PROMOTE');
  } catch {
    return false;
  }
}

export function computeClaudeMdPath(filePaths: string[], base: string, isGlobal: boolean): string {
  if (isGlobal) return path.join(os.homedir(), '.claude', 'CLAUDE.md');
  if (filePaths.length > 0) {
    const dir = commonDirPrefix(filePaths);
    return dir && dir !== '.' ? path.join(base, dir, 'CLAUDE.md') : path.join(base, 'CLAUDE.md');
  }
  return path.join(base, 'CLAUDE.md');
}

export function appendFactToFile(filePath: string, fact: string): 'promoted' | 'already_exists' {
  let existing = '';
  try {
    existing = fs.readFileSync(filePath, 'utf8');
  } catch (err: unknown) {
    if ((err as NodeJS.ErrnoException).code !== 'ENOENT') throw err;
  }

  if (existing.includes(fact)) return 'already_exists';

  let updated: string;
  if (existing.includes('## Boa')) {
    const boaIndex = existing.indexOf('## Boa');
    const afterBoa = existing.slice(boaIndex);
    const nextSectionMatch = afterBoa.match(/\n## [^\n]/);
    if (nextSectionMatch && nextSectionMatch.index !== undefined) {
      const insertAt = boaIndex + nextSectionMatch.index;
      updated = existing.slice(0, insertAt) + `\n- ${fact}` + existing.slice(insertAt);
    } else {
      updated = existing.trimEnd() + `\n- ${fact}\n`;
    }
  } else {
    updated = existing.trimEnd() + `\n\n## Boa\n\n- ${fact}\n`;
  }

  const dir = path.dirname(filePath);
  if (!fs.existsSync(dir)) fs.mkdirSync(dir, { recursive: true });
  fs.writeFileSync(filePath, updated, 'utf8');
  return 'promoted';
}

export async function promoteFacts(repoRoot?: string, global = false): Promise<void> {
  const base = repoRoot ?? process.cwd();
  const pool = getPool();

  const threshold = parseInt(process.env.PROMOTE_THRESHOLD ?? '2', 10);

  const result = await pool.query<FactRow>(
    `SELECT id, content, file_paths, authors FROM facts WHERE array_length(authors, 1) >= $1`,
    [threshold],
  );

  if (result.rows.length === 0) {
    console.log(`No facts ready to promote (need at least ${threshold} unique author(s))`);
    return;
  }

  console.log(`Promoting ${result.rows.length} candidate facts...`);

  const client = new Anthropic({ apiKey: process.env.ANTHROPIC_API_KEY, baseURL: 'https://api.anthropic.com' });

  let promotedCount = 0;
  let skippedCount = 0;
  let alreadyExistsCount = 0;

  for (const row of result.rows) {
    const promote = await shouldPromote(client, row.content);

    if (!promote) {
      console.log(`  - skipped (inferable): "${row.content}"`);
      skippedCount++;
      continue;
    }

    const filePaths: string[] = Array.isArray(row.file_paths) ? row.file_paths : [];
    const claudeMdPath = computeClaudeMdPath(filePaths, base, global);

    const outcome = appendFactToFile(claudeMdPath, row.content);
    const displayPath = global ? `~/.claude/CLAUDE.md` : path.relative(base, claudeMdPath) || 'CLAUDE.md';

    const authorCount = Array.isArray(row.authors) ? row.authors.length : 0;

    if (outcome === 'already_exists') {
      console.log(`  - already exists: "${row.content}"`);
      alreadyExistsCount++;
    } else {
      console.log(`  ✓ promoted → ${displayPath}: "${row.content}" (${authorCount} author${authorCount === 1 ? '' : 's'})`);
      promotedCount++;
    }
  }

  console.log(`Done. ${promotedCount} promoted, ${skippedCount} skipped, ${alreadyExistsCount} already existed.`);
}
