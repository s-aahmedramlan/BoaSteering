// Precompute MiniLM embeddings for the Price Sync knowledge base.
// Run: node scripts/embed.mjs
import { pipeline, env } from '@xenova/transformers';
import { readFileSync, writeFileSync } from 'fs';

// Load the model from public/models (also served to the browser).
// Run from the app/ directory:  node scripts/embed.mjs
env.allowRemoteModels = false;
env.allowLocalModels = true;
env.localModelPath = './public/models';

// Natural-language string for a record — MUST match the runtime builder in DemoPage.tsx
export function buildEmbedText(r) {
  const panels = `${r.price_panels_lit} of ${r.total_price_panels} price panels lit`;
  const rs485 = r.rs485_response ? 'RS-485 responding' : 'RS-485 no response';
  const lte = r.lte_signal_present ? 'LTE signal present' : 'LTE signal absent';
  const codes = r.error_codes && r.error_codes.length ? r.error_codes.join(', ') : 'none';
  return [
    `${r.product} unit, ${r.unit_age_months} months old.`,
    `12V rail: ${r.voltage_12v_rail}V.`,
    `5V logic: ${r.voltage_5v_logic}V.`,
    `Controller ${r.controller_status}.`,
    `${rs485}.`,
    `${panels}.`,
    `${r.hours_since_last_price_update} hours since last price update.`,
    `${lte}.`,
    `Ambient ${r.ambient_temp_f}F.`,
    `Error codes: ${codes}.`,
    `Tech notes: ${r.technician_notes}`,
  ].join(' ');
}

const ROOT = 'C:/Users/ateeq/BoaSteering/app/public';
const records = JSON.parse(readFileSync(`${ROOT}/knowledge-base.json`, 'utf8'));
console.log(`Loaded ${records.length} records. Loading MiniLM model...`);

const extractor = await pipeline('feature-extraction', 'Xenova/all-MiniLM-L6-v2');
console.log('Model ready. Embedding...');

const vectors = [];
for (let i = 0; i < records.length; i++) {
  const text = buildEmbedText(records[i]);
  const out = await extractor(text, { pooling: 'mean', normalize: true });
  vectors.push(Array.from(out.data).map((x) => Math.round(x * 1e6) / 1e6));
  if ((i + 1) % 50 === 0) console.log(`  ${i + 1}/${records.length}`);
}

writeFileSync(`${ROOT}/embeddings.json`, JSON.stringify(vectors));
console.log(`Wrote embeddings.json (${vectors.length} x ${vectors[0].length})`);
