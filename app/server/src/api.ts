import { Router, Request, Response } from 'express';
import Anthropic from '@anthropic-ai/sdk';
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

  // POST /api/diagnose - Differential diagnosis for an Able Price Sign sign
  router.post('/diagnose', async (req: Request, res: Response): Promise<void> => {
    try {
      const { readings, errorCodes, notes, similarCases } = req.body as {
        readings: Record<string, string>;
        errorCodes: string[];
        notes?: string;
        similarCases: Array<{
          ticket_id: string;
          technician_notes: string;
          root_cause: string;
          component_failed: string;
          part_number: string;
          rma_required: boolean;
          error_codes: string[];
          voltage_12v_rail: number;
          rs485_response: boolean;
          price_panels: string;
        }>;
      };

      if (!readings || !similarCases || similarCases.length === 0) {
        res.status(400).json({ error: 'readings and similar cases required' });
        return;
      }

      const client = new Anthropic({ apiKey: process.env.ANTHROPIC_API_KEY });

      const readingsText = Object.entries(readings)
        .map(([k, v]) => `  ${k}: ${v}`)
        .join('\n');

      const casesText = similarCases
        .map(
          (c, i) =>
            `Case ${i + 1} — ${c.ticket_id}\n` +
            `  12V rail: ${c.voltage_12v_rail}V · RS-485: ${c.rs485_response ? 'responding' : 'no response'} · panels: ${c.price_panels} · codes: ${c.error_codes.join(', ') || 'none'}\n` +
            `  notes: "${c.technician_notes}"\n` +
            `  resolved as: ${c.root_cause} → ${c.component_failed} (part ${c.part_number || 'none'}, RMA ${c.rma_required ? 'yes' : 'no'})`,
        )
        .join('\n\n');

      const message = await client.messages.create({
        model: 'claude-sonnet-4-6',
        max_tokens: 1200,
        system: `You are Boa, an AI diagnostic agent trained on Able's Price Sync service history. You reason like an experienced Able field service engineer — someone who has seen hundreds of Price Sync LTE failures and knows the diagnostic patterns cold.

A technician has submitted live diagnostic readings from a failed Price Sync sign. You have been given the 4 most similar resolved tickets from service history.

Reason explicitly: what do the voltage readings rule out? What does the RS-485 status tell you? What does the error code pattern indicate? Then commit to a diagnosis with step-by-step repair instructions that sound like how Able's techs actually talk. Use Able product terminology (PCU, Price Sync, price panels, 12V rail) — never generic terms.

Real Able part numbers: ABLE-PSU-12V-150W (power supply), ABLE-DGT-MOD-8IN (digit module), ABLE-CBL-RS485-10FT (RS-485 cable), ABLE-PCU-COMMBD (PCU comm board).

Return ONLY valid JSON (no markdown), with this exact shape:
{
  "ruling_out": [{"cause": "...", "reason": "..."}, ...],   // 2-3 causes you eliminate, each with a specific reason tied to the readings
  "most_likely_cause": "...",
  "confidence": 60-100,
  "reasoning": "...",                                         // cite how many retrieved tickets share the signature
  "steps": ["...", ...],                                      // 5-7 concrete repair steps in Able's voice
  "component": "...",
  "part_number": "ABLE-...",                                  // empty string if no part needed
  "rma_required": true/false,
  "rma_reason": "...",                                        // empty string if no RMA
  "fleet_note": "..."                                         // optional proactive fleet-wide pattern, or omit
}`,
        messages: [
          {
            role: 'user',
            content: `Live diagnostic readings:
${readingsText}
  error_codes: ${errorCodes.join(', ') || 'none'}
${notes ? `  technician_notes: "${notes}"` : ''}

Most similar resolved tickets from Price Sync service history:

${casesText}

Diagnose this sign. Return the JSON.`,
          },
        ],
      });

      const text = message.content[0].type === 'text' ? message.content[0].text : '';
      // Claude sometimes wraps JSON in ```json ... ``` fences — strip them before parsing
      const cleaned = text.trim().replace(/^```(?:json)?\s*/i, '').replace(/\s*```$/i, '').trim();
      const diagnosis = JSON.parse(cleaned);
      res.json(diagnosis);
    } catch (err) {
      console.error('[boa:api] POST /diagnose error:', err);
      res.status(500).json({ error: 'diagnosis synthesis failed' });
    }
  });

  return router;
}
