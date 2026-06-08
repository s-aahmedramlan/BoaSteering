/* global chrome */
'use strict';

const BOA_ENDPOINT = 'http://localhost:3333/ingest/conversation';
const HASH_KEY = 'boa_last_hash';
const SYNC_INTERVAL_MS = 5 * 60 * 1000; // 5 minutes

// ── Scrape conversation text from claude.ai ───────────────────────────────────

function scrapeConversation() {
  const parts = [];

  // Primary: data-testid attributes used by Claude.ai
  const humanTurns = document.querySelectorAll('[data-testid="human-turn"]');
  const aiTurns = document.querySelectorAll('[data-testid="ai-turn"]');

  if (humanTurns.length > 0 || aiTurns.length > 0) {
    // Interleave by DOM order
    const allTurns = Array.from(
      document.querySelectorAll('[data-testid="human-turn"], [data-testid="ai-turn"]')
    );
    for (const turn of allTurns) {
      const isHuman = turn.getAttribute('data-testid') === 'human-turn';
      const label = isHuman ? 'Human' : 'Assistant';
      const text = (turn.textContent || '').trim();
      if (text) {
        parts.push(`${label}: ${text}`);
      }
    }
  } else {
    // Fallback: role="presentation" (human) / role="main" (assistant) alternating divs
    const presentations = document.querySelectorAll('[role="presentation"]');
    const mains = document.querySelectorAll('[role="main"]');

    if (presentations.length > 0) {
      const combined = Array.from(
        document.querySelectorAll('[role="presentation"], [role="main"]')
      );
      let humanIdx = 0;
      let aiIdx = 0;
      for (const el of combined) {
        const role = el.getAttribute('role');
        const text = (el.textContent || '').trim();
        if (!text) continue;
        if (role === 'presentation') {
          parts.push(`Human: ${text}`);
          humanIdx++;
        } else if (role === 'main') {
          parts.push(`Assistant: ${text}`);
          aiIdx++;
        }
      }
      void humanIdx; void aiIdx;
    }
  }

  return parts.join('\n');
}

// ── SHA-256 hash via Web Crypto ───────────────────────────────────────────────

async function sha256(text) {
  const encoder = new TextEncoder();
  const data = encoder.encode(text);
  const hashBuffer = await crypto.subtle.digest('SHA-256', data);
  const hashArray = Array.from(new Uint8Array(hashBuffer));
  return hashArray.map((b) => b.toString(16).padStart(2, '0')).join('');
}

// ── Core sync function ────────────────────────────────────────────────────────

async function syncConversation() {
  const text = scrapeConversation();

  if (!text) {
    return { stored: 0, skipped: 0, noChange: true };
  }

  const hash = await sha256(text);
  const lastHash = localStorage.getItem(HASH_KEY);

  if (hash === lastHash) {
    console.log('[boa] no changes since last sync');
    return { stored: 0, skipped: 0, noChange: true };
  }

  try {
    const response = await fetch(BOA_ENDPOINT, {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({ text, source: 'claude.ai' }),
    });

    if (!response.ok) {
      // Boa returned an error status — fail silently
      return { stored: 0, skipped: 0, noChange: false };
    }

    const result = await response.json();
    const stored = result.stored ?? 0;
    const skipped = result.skipped ?? 0;

    localStorage.setItem(HASH_KEY, hash);
    console.log(`[boa] sent conversation, stored: ${stored} facts`);

    return { stored, skipped, noChange: false };
  } catch {
    // Boa not running or network error — fail silently
    return { stored: 0, skipped: 0, noChange: false };
  }
}

// ── Message listener (popup → content script) ────────────────────────────────

chrome.runtime.onMessage.addListener((msg, _sender, sendResponse) => {
  if (msg.type === 'SYNC_NOW') {
    syncConversation().then((result) => sendResponse(result));
    return true; // keep channel open for async
  }
});

// ── Periodic sync ─────────────────────────────────────────────────────────────

setInterval(() => {
  syncConversation();
}, SYNC_INTERVAL_MS);

// ── Initial sync after page settles ──────────────────────────────────────────

setTimeout(() => {
  syncConversation();
}, 10000);
