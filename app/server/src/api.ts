import { Router, Request, Response } from 'express';
import { getPool } from './db';

export function createApiRouter(): Router {
  const router = Router();

  // GET /api/facts — list all facts, optional ?repo= and ?verified= filters
  router.get('/facts', async (req: Request, res: Response): Promise<void> => {
    try {
      const pool = getPool();
      const conditions: string[] = [];
      const params: unknown[] = [];

      if (req.query.repo) {
        params.push(req.query.repo);
        conditions.push(`repo = $${params.length}`);
      }
      if (req.query.verified !== undefined) {
        params.push(req.query.verified === 'true');
        conditions.push(`verified = $${params.length}`);
      }

      const where = conditions.length > 0 ? `WHERE ${conditions.join(' AND ')}` : '';
      const result = await pool.query(
        `SELECT id, content, file_paths, author, repo, created_at, hit_count, last_hit_at, verified
         FROM facts
         ${where}
         ORDER BY created_at DESC`,
        params,
      );
      res.json(result.rows);
    } catch (err) {
      console.error('[boa:api] GET /facts error:', err);
      res.status(500).json({ error: 'internal server error' });
    }
  });

  // GET /api/facts/stats — aggregate counts for the dashboard
  router.get('/facts/stats', async (_req: Request, res: Response): Promise<void> => {
    try {
      const pool = getPool();
      const result = await pool.query(`
        SELECT
          COUNT(*)::int                                   AS total,
          COUNT(*) FILTER (WHERE verified = true)::int   AS verified,
          COUNT(DISTINCT repo) FILTER (WHERE repo <> '')::int AS repos,
          COUNT(*) FILTER (WHERE created_at > now() - interval '24 hours')::int AS added_today,
          COUNT(*) FILTER (
            WHERE last_hit_at < now() - interval '30 days'
               OR (hit_count > 3
                   AND created_at < now() - interval '7 days'
                   AND last_hit_at < now() - interval '3 days')
          )::int AS stale
        FROM facts
      `);
      res.json(result.rows[0]);
    } catch (err) {
      console.error('[boa:api] GET /facts/stats error:', err);
      res.status(500).json({ error: 'internal server error' });
    }
  });

  // DELETE /api/facts/:id
  router.delete('/facts/:id', async (req: Request, res: Response): Promise<void> => {
    try {
      const pool = getPool();
      const result = await pool.query(
        `DELETE FROM facts WHERE id::text LIKE $1`,
        [req.params.id + '%'],
      );
      const count = (result as { rowCount: number | null }).rowCount ?? 0;
      if (count === 0) {
        res.status(404).json({ error: 'fact not found' });
        return;
      }
      res.json({ deleted: count });
    } catch (err) {
      console.error('[boa:api] DELETE /facts/:id error:', err);
      res.status(500).json({ error: 'internal server error' });
    }
  });

  // PATCH /api/facts/:id/verify
  router.patch('/facts/:id/verify', async (req: Request, res: Response): Promise<void> => {
    try {
      const pool = getPool();
      const result = await pool.query(
        `UPDATE facts SET verified = true WHERE id::text LIKE $1 RETURNING id, verified`,
        [req.params.id + '%'],
      );
      if (result.rows.length === 0) {
        res.status(404).json({ error: 'fact not found' });
        return;
      }
      res.json(result.rows[0]);
    } catch (err) {
      console.error('[boa:api] PATCH /facts/:id/verify error:', err);
      res.status(500).json({ error: 'internal server error' });
    }
  });

  return router;
}
