import { getPool } from './db';

const MAX_FACTS = 5;
const MAX_FACTS_FALLBACK = 3;
const MAX_INJECTED_TOKENS = 300;
const CHARS_PER_TOKEN = 4;

export interface RetrievalContext {
  systemPrompt: string;
  repo: string;
  requestText: string;
}

export interface RetrievedFact {
  id: string;
  content: string;
}

export async function retrieveAndInject(ctx: RetrievalContext): Promise<string> {
  const filePaths = extractFilePaths(ctx.systemPrompt + '\n' + ctx.requestText);

  if (filePaths.length === 0 && !ctx.repo) {
    return ctx.systemPrompt;
  }

  let facts: RetrievedFact[] = [];
  try {
    facts = await retrieveFacts(filePaths, ctx.repo);
  } catch (err) {
    console.error('[boa:retriever] failed to retrieve facts:', err);
    return ctx.systemPrompt;
  }

  if (facts.length === 0) return ctx.systemPrompt;

  const injectedBlock = buildInjectedBlock(facts);
  await incrementHitCounts(facts.map((f) => f.id));

  return injectedBlock + '\n\n' + ctx.systemPrompt;
}

async function retrieveFacts(filePaths: string[], repo: string): Promise<RetrievedFact[]> {
  const pool = getPool();
  const hasFilePaths = filePaths.length > 0;
  const pgFilePaths = `{${filePaths.map((p) => `"${p.replace(/"/g, '\\"')}"`).join(',')}}`;

  const params: unknown[] = [];
  const conditions: string[] = [];

  if (repo) {
    params.push(repo);
    conditions.push(`repo = $${params.length}`);
  }
  if (hasFilePaths) {
    params.push(pgFilePaths);
    conditions.push(`file_paths && $${params.length}::text[]`);
  }

  params.push(MAX_FACTS);
  const where = conditions.length > 0 ? `WHERE ${conditions.join(' AND ')}` : '';

  const result = await pool.query<{ id: string; content: string }>(
    `SELECT id, content
     FROM facts
     ${where}
     ORDER BY verified DESC, hit_count DESC, created_at DESC
     LIMIT $${params.length}`,
    params,
  );

  return result.rows;
}

function buildInjectedBlock(facts: RetrievedFact[]): string {
  const header = 'Team conventions:';
  const maxChars = MAX_INJECTED_TOKENS * CHARS_PER_TOKEN;

  let block = header;
  let count = 0;

  for (const fact of facts) {
    const line = `\n- ${fact.content}`;
    if ((block + line).length > maxChars && count >= MAX_FACTS_FALLBACK) break;
    block += line;
    count++;
  }

  return block;
}

async function incrementHitCounts(ids: string[]): Promise<void> {
  if (ids.length === 0) return;
  const pool = getPool();
  await pool.query(
    `UPDATE facts
     SET hit_count = hit_count + 1, last_hit_at = now()
     WHERE id = ANY($1::uuid[])`,
    [ids],
  );
}

export function extractFilePaths(text: string): string[] {
  const patterns = [
    /(?:from|require)\s*\(\s*['"]([^'"]+)['"]\s*\)/g,
    /(?:from)\s+['"]([^'"]+)['"]/g,
    /\b((?:src|lib|app|packages?|services?|components?|utils?|api|internal)\/[^\s"'`>,)]+\.[a-zA-Z0-9]+)/g,
    /\b(\.[./][^\s"'`>,)]+\.[a-zA-Z0-9]+)/g,
    /<path>([^<]+)<\/path>/g,
    /"path"\s*:\s*"([^"]+)"/g,
  ];

  const found = new Set<string>();
  for (const pattern of patterns) {
    let match: RegExpExecArray | null;
    pattern.lastIndex = 0;
    while ((match = pattern.exec(text)) !== null) {
      const p = match[1].trim();
      if (p.length > 2 && p.length < 200) found.add(p);
    }
  }

  return Array.from(found);
}
