# Boa

An HTTP proxy that sits in front of the Anthropic API. It captures org-specific facts from developer-agent conversations, stores them in a vector database, and injects relevant facts into future requests — zero manual work required.

## How it works

```
your tool  →  Boa proxy (localhost:3333)  →  Anthropic API
                    ↕
              Postgres + pgvector
```

1. Every request to `/v1/messages` is forwarded to Anthropic unchanged (except for injected facts).
2. After the response is returned to the client, Boa asynchronously extracts atomic facts using a fast LLM call.
3. Extracted facts are deduplicated via cosine similarity and stored in Postgres.
4. On subsequent requests, Boa retrieves relevant facts (by file path + semantic similarity) and prepends them to the system prompt — capped at 300 tokens.

## One-line setup

```bash
ANTHROPIC_BASE_URL=http://localhost:3333
```

That's the only change your tool needs. Everything else is invisible.

## Prerequisites

- Node.js 18+
- PostgreSQL with the [pgvector](https://github.com/pgvector/pgvector) extension

## Installation

```bash
npm install
cp .env.example .env
# fill in ANTHROPIC_API_KEY, OPENAI_API_KEY, DATABASE_URL
```

## Running

```bash
# development (ts-node, auto-restarts not included)
npm run dev

# production
npm run build
npm start
```

On startup, Boa creates the `facts` table and HNSW index automatically — no separate migration step needed.

## Environment variables

| Variable | Required | Default | Description |
|---|---|---|---|
| `ANTHROPIC_API_KEY` | yes | — | Forwarded to the Anthropic API |
| `OPENAI_API_KEY` | yes | — | Used for `text-embedding-3-small` embeddings |
| `DATABASE_URL` | yes | — | Postgres connection string |
| `PORT` | no | `3333` | Port the proxy listens on |

## Optional request headers

Tools can pass these headers to enrich stored facts:

| Header | Description |
|---|---|
| `x-boa-repo` | Repository identifier (e.g. `acme/backend`). Facts are scoped per repo. |
| `x-boa-author` | Developer identifier, stored for auditability. |

## Fact lifecycle

- **Captured** — LLM detects an org-specific correction or constraint in the conversation.
- **Deduplicated** — cosine similarity > 0.92 with an existing fact → discarded.
- **Conflict-flagged** — similarity between 0.75–0.92 → logged to console, discarded.
- **Injected** — top-5 facts (similarity > 0.80, overlapping file paths) prepended to system prompt.
- **Stale** — not hit in 30 days, or frequently hit but not recently → flagged in logs.
- **Verified** — mark facts as `verified = true` via a git hook on merge to signal team consensus.

## Staleness check

Call `flagStaleFacts()` from `src/staleness.ts` on a cron or git hook:

```typescript
import { flagStaleFacts } from './src/staleness';
await flagStaleFacts(); // logs stale facts to console
```

## Database schema

```sql
facts (
  id          UUID PRIMARY KEY,
  content     TEXT,           -- the atomic fact, one sentence
  embedding   vector(1536),   -- text-embedding-3-small
  file_paths  TEXT[],         -- files in scope when captured
  author      TEXT,
  repo        TEXT,
  created_at  TIMESTAMP,
  hit_count   INTEGER,        -- incremented on every injection
  last_hit_at TIMESTAMP,
  verified    BOOLEAN         -- true after PR merge sync
)
```
