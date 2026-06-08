import Anthropic from '@anthropic-ai/sdk';

const SYSTEM_PROMPT = `You are an expert at identifying org-specific institutional knowledge from developer-agent conversations. Your job is to extract atomic facts — single, specific pieces of information that a coding agent would otherwise get wrong because they are specific to this team or codebase. Examples: 'This team uses gRPC not REST for internal service calls', 'The auth service returns 403 not 401 for expired tokens', 'Always use the internal retry utility at utils/retry.ts instead of raw fetch'. Return ONLY a JSON array of atomic fact strings, or an empty array if none found. No explanation, no markdown, just the JSON array.`;

export interface Exchange {
  system?: string;
  messages: Array<{ role: string; content: unknown }>;
  assistantResponse: string;
}

export async function extractFacts(exchange: Exchange): Promise<string[]> {
  const client = new Anthropic({ apiKey: process.env.ANTHROPIC_API_KEY });

  const conversationSummary = buildConversationSummary(exchange);

  try {
    const response = await client.messages.create({
      model: 'claude-haiku-4-5-20251001',
      max_tokens: 1024,
      system: SYSTEM_PROMPT,
      messages: [
        {
          role: 'user',
          content: conversationSummary,
        },
      ],
    });

    const text = response.content
      .filter((block) => block.type === 'text')
      .map((block) => (block as { type: 'text'; text: string }).text)
      .join('');

    const parsed = JSON.parse(stripMarkdownJson(text));
    if (!Array.isArray(parsed)) return [];
    return parsed.filter((item): item is string => typeof item === 'string');
  } catch (err) {
    console.error('[boa:extractor] failed to extract facts:', err);
    return [];
  }
}

function stripMarkdownJson(text: string): string {
  const match = text.match(/```(?:json)?\s*([\s\S]*?)```/);
  return match ? match[1].trim() : text.trim();
}

// Keep only the last N chars of the system prompt — tool definitions pad it massively
const MAX_SYSTEM_CHARS = 2000;
const MAX_SUMMARY_CHARS = 12000;

function buildConversationSummary(exchange: Exchange): string {
  const parts: string[] = [];

  if (exchange.system) {
    const sys = exchange.system.length > MAX_SYSTEM_CHARS
      ? '...' + exchange.system.slice(exchange.system.length - MAX_SYSTEM_CHARS)
      : exchange.system;
    parts.push(`<system_prompt>\n${sys}\n</system_prompt>`);
  }

  for (const msg of exchange.messages) {
    const content =
      typeof msg.content === 'string' ? msg.content : JSON.stringify(msg.content);
    parts.push(`<${msg.role}>\n${content}\n</${msg.role}>`);
  }

  parts.push(`<assistant>\n${exchange.assistantResponse}\n</assistant>`);

  const full = parts.join('\n\n');
  return full.length > MAX_SUMMARY_CHARS
    ? full.slice(full.length - MAX_SUMMARY_CHARS)
    : full;
}
