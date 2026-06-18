import type { VercelRequest, VercelResponse } from '@vercel/node';
import Anthropic from '@anthropic-ai/sdk';

/**
 * Vercel serverless function for the Price Sync diagnosis.
 * Mirrors the local Express handler in app/server/src/api.ts so the demo
 * works when hosted (the Express server does not deploy to Vercel).
 *
 * The ANTHROPIC_API_KEY is read from the server-side environment and is
 * never exposed to the browser. Set it in the Vercel project's
 * Environment Variables.
 */

interface SimilarCase {
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
}

// Best-effort per-IP rate limit (per warm instance). The hard backstop is a
// spend cap on the API key in the Anthropic console.
const WINDOW_MS = 60_000;
const MAX_PER_WINDOW = 8;
const hits = new Map<string, number[]>();

function rateLimited(ip: string): boolean {
  const now = Date.now();
  const recent = (hits.get(ip) || []).filter((t) => now - t < WINDOW_MS);
  recent.push(now);
  hits.set(ip, recent);
  return recent.length > MAX_PER_WINDOW;
}

export default async function handler(req: VercelRequest, res: VercelResponse): Promise<void> {
  if (req.method !== 'POST') {
    res.status(405).json({ error: 'method not allowed' });
    return;
  }

  const ip = (req.headers['x-forwarded-for'] as string)?.split(',')[0]?.trim() || 'unknown';
  if (rateLimited(ip)) {
    res.status(429).json({ error: 'rate limit exceeded — try again in a minute' });
    return;
  }

  try {
    const { readings, errorCodes, notes, similarCases } = req.body as {
      readings: Record<string, string>;
      errorCodes: string[];
      notes?: string;
      similarCases: SimilarCase[];
    };

    if (!readings || !similarCases || similarCases.length === 0) {
      res.status(400).json({ error: 'readings and similar cases required' });
      return;
    }
    if (!process.env.ANTHROPIC_API_KEY) {
      res.status(500).json({ error: 'server missing ANTHROPIC_API_KEY' });
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

Reason explicitly: what do the voltage readings rule out? What does the RS-485 status tell you? What does the error code pattern indicate? Then commit to a diagnosis. Use Able product terminology (PCU, Price Sync, price panels, 12V rail) — never generic terms.

Real Able part numbers: ABLE-PSU-12V-150W (power supply), ABLE-DGT-MOD-8IN (digit module), ABLE-CBL-RS485-10FT (RS-485 cable), ABLE-PCU-COMMBD (PCU comm board).

Return ONLY valid JSON (no markdown), with this exact shape:
{
  "ruling_out": [{"cause": "...", "reason": "..."}, ...],   // 2-3 causes you eliminate, each with a specific reason tied to the readings
  "most_likely_cause": "...",
  "confidence": 60-100,
  "reasoning": "...",                                         // cite how many retrieved tickets share the signature
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
    const stripped = text.trim().replace(/^```(?:json)?\s*/i, '').replace(/\s*```$/i, '').trim();
    const match = stripped.match(/\{[\s\S]*\}/);
    res.status(200).json(JSON.parse(match ? match[0] : stripped));
  } catch (err) {
    console.error('[boa:api] /api/diagnose error:', err);
    res.status(500).json({ error: 'diagnosis synthesis failed' });
  }
}
