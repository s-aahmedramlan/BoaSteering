import { getPool } from './db';

export interface StaleFact {
  id: string;
  content: string;
  repo: string;
  hit_count: number;
  last_hit_at: Date | null;
  created_at: Date;
  reason: 'not_hit_30d' | 'frequently_hit_not_recent';
}

export async function flagStaleFacts(): Promise<StaleFact[]> {
  const pool = getPool();

  const result = await pool.query<StaleFact & { reason: string }>(
    `SELECT
       id, content, repo, hit_count, last_hit_at, created_at,
       CASE
         WHEN last_hit_at < now() - interval '30 days' THEN 'not_hit_30d'
         ELSE 'frequently_hit_not_recent'
       END AS reason
     FROM facts
     WHERE
       last_hit_at < now() - interval '30 days'
       OR (
         hit_count > 3
         AND created_at < now() - interval '7 days'
         AND last_hit_at < now() - interval '3 days'
       )
     ORDER BY last_hit_at ASC NULLS FIRST`,
  );

  const stale = result.rows as StaleFact[];

  if (stale.length > 0) {
    console.warn(`[boa:staleness] ${stale.length} stale fact(s) detected:`);
    for (const fact of stale) {
      console.warn(
        `  [${fact.reason}] (repo=${fact.repo}, hits=${fact.hit_count}, last_hit=${fact.last_hit_at?.toISOString() ?? 'never'}) "${fact.content}"`,
      );
    }
  }

  return stale;
}
