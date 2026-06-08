import 'dotenv/config';
import { Server } from '@modelcontextprotocol/sdk/server/index.js';
import { StdioServerTransport } from '@modelcontextprotocol/sdk/server/stdio.js';
import {
  CallToolRequestSchema,
  ListToolsRequestSchema,
} from '@modelcontextprotocol/sdk/types.js';
import { storeFact } from './dedup';
import { detectRepo } from './repo';

const server = new Server(
  { name: 'boa', version: '1.0.0' },
  { capabilities: { tools: {} } },
);

server.setRequestHandler(ListToolsRequestSchema, async () => ({
  tools: [
    {
      name: 'save_fact',
      description:
        'Save an org-specific fact about this codebase or team conventions. Call this ONLY for facts a coding agent would otherwise get wrong — team conventions, internal constraints, codebase-specific corrections. NOT for general programming knowledge or one-off fixes.',
      inputSchema: {
        type: 'object',
        properties: {
          fact: {
            type: 'string',
            description: 'The atomic fact to save, as a single clear sentence.',
          },
        },
        required: ['fact'],
      },
    },
  ],
}));

server.setRequestHandler(CallToolRequestSchema, async (request) => {
  if (request.params.name !== 'save_fact') {
    return { content: [{ type: 'text', text: 'Unknown tool' }] };
  }

  const fact = (request.params.arguments as { fact?: string })?.fact ?? '';
  if (!fact) {
    return { content: [{ type: 'text', text: 'fact is required' }] };
  }

  try {
    const repo = await detectRepo();
    await storeFact({ content: fact, filePaths: [], author: 'claude', repo });
    console.error(`[boa:mcp] saved: ${fact}`);
    return { content: [{ type: 'text', text: `Saved: "${fact}"` }] };
  } catch (err) {
    console.error('[boa:mcp] failed to save fact:', err);
    return { content: [{ type: 'text', text: 'Failed to save — is DATABASE_URL set?' }] };
  }
});

async function main() {
  const transport = new StdioServerTransport();
  await server.connect(transport);
  console.error('[boa:mcp] server running on stdio');
}

main().catch((err) => {
  console.error('[boa:mcp] fatal:', err);
  process.exit(1);
});
