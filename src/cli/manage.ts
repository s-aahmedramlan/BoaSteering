import { getPool } from '../db';

interface FactRow {
  id: string;
  verified: boolean;
  hit_count: number;
  created_at: Date;
  content: string;
}

export async function listFacts(): Promise<void> {
  const pool = getPool();
  const result = await pool.query<FactRow>(
    `SELECT id, verified, hit_count, created_at, content
     FROM facts
     ORDER BY created_at DESC`,
  );

  const header = 'ID        VER  HITS  CREATED     CONTENT';
  console.log(header);

  for (const row of result.rows) {
    const id = row.id.slice(0, 8);
    const ver = row.verified ? '✓' : '-';
    const hits = String(row.hit_count).padEnd(4);
    const created = row.created_at.toISOString().slice(0, 10);
    const content = row.content.length > 80 ? row.content.slice(0, 79) + '…' : row.content;
    console.log(`${id}  ${ver.padEnd(4)} ${hits}  ${created}  ${content}`);
  }
}

export async function deleteFact(id: string): Promise<void> {
  const pool = getPool();
  const result = await pool.query(
    `DELETE FROM facts WHERE id::text LIKE $1`,
    [id + '%'],
  );
  const count = (result as { rowCount: number | null }).rowCount ?? 0;
  if (count > 0) {
    console.log(`Deleted fact ${id}`);
  } else {
    console.log(`No fact found with id ${id}`);
  }
}

export async function verifyFact(id: string): Promise<void> {
  const pool = getPool();
  const result = await pool.query(
    `UPDATE facts SET verified = true WHERE id::text LIKE $1`,
    [id + '%'],
  );
  const count = (result as { rowCount: number | null }).rowCount ?? 0;
  if (count > 0) {
    console.log(`Verified fact ${id}`);
  } else {
    console.log(`No fact found with id ${id}`);
  }
}
