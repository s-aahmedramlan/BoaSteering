# Boa

Boa is an HTTP proxy that sits in front of the Anthropic API. It captures org-specific facts from developer-agent conversations, stores them in Postgres, and injects relevant facts into future requests — automatically, with no manual work.

The core insight: when a developer corrects their AI coding agent, that correction should stick. And when three developers independently hit the same wall, it should become a team convention.

```
developer tool  →  Boa (localhost:3333)  →  Anthropic API
                         ↕
                   Postgres + pgvector
                         ↕
               CLAUDE.{author}.md  /  CLAUDE.md
```

## The problem

A developer corrects their agent: *"don't use fetch here, use axios — our network proxy blocks it."* The agent gets it right for the rest of the session. Next session, it makes the same mistake. The developer's teammates have the same experience independently.

Boa solves both: personal corrections persist immediately. Team-wide patterns surface automatically when enough developers hit the same thing.

## How it works

**Capture** (every session, automatic)
1. Request arrives at Boa's proxy
2. Boa retrieves relevant stored facts (by repo + file paths) and prepends them to the system prompt
3. Request is forwarded to Anthropic unchanged (aside from injected facts)
4. After the response returns, Boa asynchronously sends the exchange to a fast LLM to extract any org-specific facts
5. Extracted facts are deduplicated via cosine similarity and stored in Postgres

**Promotion** (automatic, no human required)

| Event | What happens |
|---|---|
| New fact stored for any author | Written to `CLAUDE.{author}.md` immediately |
| Same fact captured by 3 different authors | Written to shared `CLAUDE.md` automatically |
| `npm run promote` | Manual promotion with Haiku filter (optional) |

**Retrieval** (every request, automatic)
- Boa runs two queries per request: facts from the current developer's history, plus facts promoted by other developers in the same repo and file scope
- Both sets are merged, deduplicated, and injected into the system prompt (capped at ~300 tokens)
- A developer joining a repo for the first time immediately inherits what their teammates already learned

## Setup

**Prerequisites**
- Node.js 18+
- PostgreSQL with [pgvector](https://github.com/pgvector/pgvector) (or [Neon](https://neon.tech) — pgvector is built in)

**Install**

```bash
npm install
cp .env.example .env
# set ANTHROPIC_API_KEY, OPENAI_API_KEY, DATABASE_URL
```

**Run**

```bash
npm run dev
```

Boa creates the `facts` table and HNSW index on startup — no migration step needed.

**Point your tool at Boa**

```bash
ANTHROPIC_BASE_URL=http://localhost:3333
```

Set this before launching Claude Code (or any Anthropic SDK client) and all traffic routes through Boa automatically. To make it permanent:

```powershell
[System.Environment]::SetEnvironmentVariable("ANTHROPIC_BASE_URL", "http://localhost:3333", "User")
```

## Environment variables

| Variable | Required | Description |
|---|---|---|
| `ANTHROPIC_API_KEY` | yes | Forwarded to Anthropic; also used for fact extraction |
| `OPENAI_API_KEY` | yes | Used for `text-embedding-3-small` embeddings at storage time |
| `DATABASE_URL` | yes | Postgres connection string |
| `PORT` | no (default `3333`) | Port the proxy listens on |
| `PROMOTE_THRESHOLD` | no (default `2`) | Minimum author count for `npm run promote` |

## Request headers

Pass these from your tool to enrich stored facts:

| Header | Description |
|---|---|
| `x-boa-repo` | Repository identifier (e.g. `acme/api`). Facts are scoped per repo. |
| `x-boa-author` | Developer identifier. Used for personal `.md` files and cross-dev inheritance. |

## Manager dashboard

Open `http://localhost:3333/dashboard` in a browser while Boa is running.

Shows all facts that have reached the 2-author convergence threshold but haven't been promoted yet. The manager can promote or dismiss each fact with one click — no CLI, no SQL.

## CLI commands

```bash
# List all stored facts
npm run boa list

# Manually promote converged facts to CLAUDE.md (with Haiku filter)
npm run promote

# Promote to ~/.claude/CLAUDE.md (global, applies across all repos)
npm run promote -- --global

# Mark a fact as verified
npm run boa verify <id>

# Delete a fact
npm run boa delete <id>
```

## MCP server

Boa ships an MCP server that gives Claude a `save_fact` tool — so the agent can proactively capture facts mid-session without waiting for the extraction pipeline.

```bash
# Register with Claude Code (run once)
claude mcp add boa -- npx ts-node C:\path\to\boa\src\mcp.ts
```

Once registered, Claude will call `save_fact` when it learns something org-specific.

## Git hook

The post-merge hook marks facts as `verified = true` when the files they're associated with appear in a merge:

```bash
npm run install-hooks
```

Verified facts are ranked higher in retrieval.

## Browser extension (Claude.ai)

A Chrome extension in `extension/` captures conversations from `claude.ai` and sends them to Boa's `/ingest/conversation` endpoint, so facts are captured from interactive sessions too.

1. Open `chrome://extensions`
2. Enable **Developer mode**
3. Click **Load unpacked** → select the `extension/` folder
4. Make sure Boa is running on port 3333

Auto-syncs every 5 minutes. Click the **Boa** toolbar icon to sync immediately.

## Database schema

```sql
facts (
  id           UUID PRIMARY KEY,
  content      TEXT,           -- atomic fact, one sentence
  embedding    vector(1536),   -- text-embedding-3-small, used for dedup only
  file_paths   TEXT[],         -- files in scope when captured
  author       TEXT,           -- developer who captured it
  authors      TEXT[],         -- all developers who independently captured it
  repo         TEXT,
  created_at   TIMESTAMP,
  hit_count    INTEGER,        -- incremented on every injection
  last_hit_at  TIMESTAMP,
  verified     BOOLEAN,        -- true after git post-merge hook
  dismissed    BOOLEAN,        -- true if manager dismissed from dashboard
  promoted_at  TIMESTAMP,      -- when fact was written to a .md file
  promoted_to  TEXT            -- path of the .md file, or 'personal'
)
```

**Deduplication thresholds**

| Cosine similarity | Action |
|---|---|
| > 0.92, same author | Discard silently (true duplicate) |
| > 0.92, different author | Merge — append to `authors[]` |
| 0.75 – 0.92 | Log conflict warning, discard |
| < 0.75 | Store as new fact |

## Testing

```bash
# Simulate cross-dev convergence, personal .md promotion, and repo inheritance
node test-flows.js
```

Requires Boa running on port 3333. Cleans up its test data before each run.
