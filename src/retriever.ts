import { getPool } from './db';
import { getEmbedding } from './embeddings';

const MAX_FACTS = 5;
const MAX_FACTS_FALLBACK = 3;
const SIMILARITY_THRESHOLD = 0.80;
const MAX_INJECTED_TOKENS = 300;

// Rough token estimate: ~4 chars per token
const CHARS_PER_TOKEN = 4;

export interface RetrievalContext {
  systemPrompt: string;
  repo: string;
  requestText: string;
}

export interface RetrievedFact {
  id: string;
  content: string;
  similarity: number;
}

export async function retrieveAndInject(ctx: RetrievalContext): Promise<string> {
  const filePaths = extractFilePaths(ctx.systemPrompt + '\n' + ctx.requestText);

  if (filePaths.length === 0 && !ctx.repo) {
    return ctx.systemPrompt;
  }

  let facts: RetrievedFact[] = [];
  try {
    facts = await retrieveFacts(ctx.requestText, filePaths, ctx.repo);
  } catch (err) {
    console.error('[boa:retriever] failed to retrieve facts:', err);
    return ctx.systemPrompt;
  }

  if (facts.length === 0) return ctx.systemPrompt;

  const injectedBlock = buildInjectedBlock(facts);
  await incrementHitCounts(facts.map((f) => f.id));

  return injectedBlock + '\n\n' + ctx.systemPrompt;
}

async function retrieveFacts(
  queryText: string,
  filePaths: string[],
  repo: string,
): Promise<RetrievedFact[]> {
  const pool = getPool();
  const embedding = await getEmbedding(queryText);
  const pgVector = `[${embedding.join(',')}]`;
  const hasFilePaths = filePaths.length > 0;
  const pgFilePaths = `{${filePaths.map((p) => `"${p.replace(/"/g, '\\"')}"`).join(',')}}`;

  const result = await pool.query<{ id: string; content: string; similarity: number }>(
    `SELECT id, content, 1 - (embedding <=> $1::vector) AS similarity
     FROM facts
     WHERE ${repo ? 'repo = $2 AND' : ''}
           ${hasFilePaths ? `file_paths && $${repo ? 3 : 2}::text[] AND` : ''}
           1 - (embedding <=> $1::vector) > ${SIMILARITY_THRESHOLD}
     ORDER BY embedding <=> $1::vector
     LIMIT $${buildParamIndex(repo, hasFilePaths)}`,
    buildQueryParams(pgVector, repo, hasFilePaths ? pgFilePaths : null, MAX_FACTS * 2),
  );

  return result.rows.slice(0, MAX_FACTS);
}

function buildParamIndex(repo: string, hasFilePaths: boolean): number {
  let idx = 1; // $1 = vector
  if (repo) idx++;
  if (hasFilePaths) idx++;
  return idx + 1;
}

function buildQueryParams(
  pgVector: string,
  repo: string,
  pgFilePaths: string | null,
  limit: number,
): unknown[] {
  const params: unknown[] = [pgVector];
  if (repo) params.push(repo);
  if (pgFilePaths) params.push(pgFilePaths);
  params.push(limit);
  return params;
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
    // ESM/CJS imports: from './foo/bar' or require('./foo/bar')
    /(?:from|require)\s*\(\s*['"]([^'"]+)['"]\s*\)/g,
    /(?:from)\s+['"]([^'"]+)['"]/g,
    // Absolute-ish paths that look like source files
    /\b((?:src|lib|app|packages?|services?|components?|utils?|api|internal)\/[^\s"'`>,)]+\.[a-zA-Z0-9]+)/g,
    // Relative paths
    /\b(\.[./][^\s"'`>,)]+\.[a-zA-Z0-9]+)/g,
    // Tool result paths like <path>src/foo.ts</path> or "path": "src/foo.ts"
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
