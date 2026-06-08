---
name: manual-conversation-ingest
description: Planned CLI command to manually ingest a conversation transcript into Boa's fact store
metadata:
  type: project
---

Build `npm run boa ingest-conversation <file.txt>` CLI command.

User pastes or saves a conversation (from Claude.ai, Slack, etc.) to a text file, runs the command, and Boa parses it with extractFacts(), deduplicates, and stores the facts.

**Why:** Simpler alternative to the browser extension for one-off imports. User chose to build the automatic browser extension first.

**How to apply:** When user asks to revisit manual ingestion, add a new runner at `src/cli/ingest-conversation-runner.ts` that reads a file and calls a `extractFactsFromTranscript()` function — same pipeline as the browser extension endpoint.
