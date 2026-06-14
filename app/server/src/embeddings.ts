import OpenAI from 'openai';

let openaiClient: OpenAI;

function getOpenAI(): OpenAI {
  if (!openaiClient) {
    openaiClient = new OpenAI({ apiKey: process.env.OPENAI_API_KEY });
  }
  return openaiClient;
}

// text-embedding-3-small has an 8191 token limit (~4 chars/token); truncate to stay safe
const MAX_EMBEDDING_CHARS = 24000;

export async function getEmbedding(text: string): Promise<number[]> {
  const client = getOpenAI();
  const truncated = text.length > MAX_EMBEDDING_CHARS
    ? text.slice(text.length - MAX_EMBEDDING_CHARS)
    : text;
  const response = await client.embeddings.create({
    model: 'text-embedding-3-small',
    input: truncated,
  });
  return response.data[0].embedding;
}
