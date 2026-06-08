import express, { Request, Response, NextFunction } from 'express';
import { extractFacts } from './extractor';
import { storeFact } from './dedup';
import { retrieveAndInject, extractFilePaths } from './retriever';
import { detectRepo } from './repo';

const ANTHROPIC_API_BASE = 'https://api.anthropic.com';

// Headers we must not forward upstream
const HOP_BY_HOP = new Set([
  'host',
  'connection',
  'keep-alive',
  'transfer-encoding',
  'te',
  'trailer',
  'upgrade',
  'proxy-authorization',
  'proxy-authenticate',
  // content-length must be dropped — we may modify the body (fact injection),
  // so fetch must recompute it from the actual serialized body
  'content-length',
  // ask for plain text responses to avoid gzip double-decompression at the client
  'accept-encoding',
]);

// Headers we must not forward downstream
const DROP_RESPONSE_HEADERS = new Set([
  'content-encoding',
  'content-length',
  'transfer-encoding',
]);

export function createProxy(): express.Application {
  const app = express();

  // Raw body needed so we can parse and re-forward
  app.use(express.json({ limit: '10mb' }));
  app.use(express.raw({ type: '*/*', limit: '10mb' }));

  app.post('/v1/messages', handleMessages);

  // Pass-through for everything else
  app.all('*', passthroughProxy);

  return app;
}

// ── /v1/messages ─────────────────────────────────────────────────────────────

async function handleMessages(req: Request, res: Response): Promise<void> {
  const body = req.body as Record<string, unknown>;
  const isStreaming = body.stream === true;

  // Inject relevant facts into the system prompt before forwarding
  const modifiedBody = await injectFacts(body, req);

  const upstreamHeaders = buildUpstreamHeaders(req);

  try {
    const upstream = await fetch(`${ANTHROPIC_API_BASE}/v1/messages`, {
      method: 'POST',
      headers: { ...upstreamHeaders, 'content-type': 'application/json' },
      body: JSON.stringify(modifiedBody),
    });

    forwardResponseHeaders(upstream, res);
    res.status(upstream.status);

    if (!upstream.body) {
      res.end();
      return;
    }

    if (isStreaming) {
      await handleStreamingResponse(upstream, res, body, req);
    } else {
      await handleJsonResponse(upstream, res, body, req);
    }
  } catch (err) {
    console.error('[boa:proxy] upstream request failed:', err);
    if (!res.headersSent) {
      res.status(502).json({ error: 'upstream request failed' });
    }
  }
}

async function handleJsonResponse(
  upstream: globalThis.Response,
  res: Response,
  originalBody: Record<string, unknown>,
  req: Request,
): Promise<void> {
  const responseText = await upstream.text();
  res.send(responseText);

  // Async extraction — never block the response
  setImmediate(() => {
    runExtractionPipeline(originalBody, responseText, req).catch((err) =>
      console.error('[boa:extractor] pipeline error:', err),
    );
  });
}

async function handleStreamingResponse(
  upstream: globalThis.Response,
  res: Response,
  originalBody: Record<string, unknown>,
  req: Request,
): Promise<void> {
  res.setHeader('content-type', 'text/event-stream');

  const reader = upstream.body!.getReader();
  const decoder = new TextDecoder();
  const chunks: string[] = [];

  // eslint-disable-next-line no-constant-condition
  while (true) {
    const { done, value } = await reader.read();
    if (done) break;
    const chunk = decoder.decode(value, { stream: true });
    chunks.push(chunk);
    res.write(chunk);
  }
  res.end();

  const fullText = chunks.join('');
  const assistantText = extractTextFromSSE(fullText);

  // Async extraction
  setImmediate(() => {
    runExtractionPipelineFromText(originalBody, assistantText, req).catch((err) =>
      console.error('[boa:extractor] streaming pipeline error:', err),
    );
  });
}

// ── Fact injection ────────────────────────────────────────────────────────────

async function injectFacts(
  body: Record<string, unknown>,
  req: Request,
): Promise<Record<string, unknown>> {
  try {
    const systemPrompt =
      typeof body.system === 'string'
        ? body.system
        : Array.isArray(body.system)
          ? (body.system as Array<{ text?: string }>)
              .map((b) => b.text ?? '')
              .join('\n')
          : '';

    const messages = (body.messages ?? []) as Array<{ role: string; content: unknown }>;
    const lastUserContent = messages
      .filter((m) => m.role === 'user')
      .map((m) => (typeof m.content === 'string' ? m.content : JSON.stringify(m.content)))
      .join('\n');

    const repo = await extractRepoFromRequest(req);
    const injectedSystem = await retrieveAndInject({
      systemPrompt,
      repo,
      requestText: lastUserContent,
    });

    if (injectedSystem === systemPrompt) return body;

    return { ...body, system: injectedSystem };
  } catch (err) {
    console.error('[boa:injector] failed to inject facts:', err);
    return body;
  }
}

// ── Extraction pipeline ───────────────────────────────────────────────────────

async function runExtractionPipeline(
  requestBody: Record<string, unknown>,
  responseText: string,
  req: Request,
): Promise<void> {
  let assistantText = '';
  try {
    const parsed = JSON.parse(responseText) as {
      content?: Array<{ type: string; text?: string }>;
    };
    assistantText = (parsed.content ?? [])
      .filter((b) => b.type === 'text')
      .map((b) => b.text ?? '')
      .join('');
  } catch {
    return;
  }

  await runExtractionPipelineFromText(requestBody, assistantText, req);
}

async function runExtractionPipelineFromText(
  requestBody: Record<string, unknown>,
  assistantText: string,
  req: Request,
): Promise<void> {
  if (!assistantText) return;

  const system =
    typeof requestBody.system === 'string'
      ? requestBody.system
      : Array.isArray(requestBody.system)
        ? (requestBody.system as Array<{ text?: string }>).map((b) => b.text ?? '').join('\n')
        : '';

  const messages = (requestBody.messages ?? []) as Array<{ role: string; content: unknown }>;

  const facts = await extractFacts({ system, messages, assistantResponse: assistantText });
  if (facts.length === 0) return;

  const repo = await extractRepoFromRequest(req);
  const author = (req.headers['x-boa-author'] as string | undefined) ?? '';
  const allText = system + ' ' + messages.map((m) => JSON.stringify(m.content)).join(' ');
  const filePaths = extractFilePaths(allText);

  for (const fact of facts) {
    await storeFact({ content: fact, filePaths, author, repo }).catch((err) =>
      console.error('[boa:dedup] store error:', err),
    );
  }

  console.log(`[boa:extractor] stored ${facts.length} fact(s) for repo=${repo || '(none)'}`);
}

// ── Pass-through proxy ────────────────────────────────────────────────────────

async function passthroughProxy(req: Request, res: Response, _next: NextFunction): Promise<void> {
  const upstreamUrl = `${ANTHROPIC_API_BASE}${req.url}`;
  const upstreamHeaders = buildUpstreamHeaders(req);

  try {
    const upstream = await fetch(upstreamUrl, {
      method: req.method,
      headers: upstreamHeaders,
      body: ['GET', 'HEAD'].includes(req.method) ? undefined : JSON.stringify(req.body),
    });

    forwardResponseHeaders(upstream, res);
    res.status(upstream.status);

    const body = await upstream.arrayBuffer();
    res.end(Buffer.from(body));
  } catch (err) {
    console.error('[boa:proxy] passthrough error:', err);
    if (!res.headersSent) {
      res.status(502).json({ error: 'upstream request failed' });
    }
  }
}

// ── Helpers ───────────────────────────────────────────────────────────────────

function buildUpstreamHeaders(req: Request): Record<string, string> {
  const headers: Record<string, string> = {};
  for (const [key, value] of Object.entries(req.headers)) {
    if (!HOP_BY_HOP.has(key.toLowerCase()) && typeof value === 'string') {
      headers[key] = value;
    }
  }
  // Ensure the real API key is used even if client passed something different
  if (process.env.ANTHROPIC_API_KEY) {
    headers['x-api-key'] = process.env.ANTHROPIC_API_KEY;
  }
  return headers;
}

function forwardResponseHeaders(upstream: globalThis.Response, res: Response): void {
  for (const [key, value] of upstream.headers.entries()) {
    const lower = key.toLowerCase();
    if (!HOP_BY_HOP.has(lower) && !DROP_RESPONSE_HEADERS.has(lower)) {
      res.setHeader(key, value);
    }
  }
}

async function extractRepoFromRequest(req: Request): Promise<string> {
  const header = req.headers['x-boa-repo'] as string | undefined;
  if (header) return header;
  return detectRepo();
}

function extractTextFromSSE(sse: string): string {
  const lines = sse.split('\n');
  const textParts: string[] = [];

  for (const line of lines) {
    if (!line.startsWith('data: ')) continue;
    const data = line.slice(6).trim();
    if (data === '[DONE]') continue;

    try {
      const event = JSON.parse(data) as {
        type?: string;
        delta?: { type?: string; text?: string };
      };
      if (event.type === 'content_block_delta' && event.delta?.type === 'text_delta') {
        textParts.push(event.delta.text ?? '');
      }
    } catch {
      // Non-JSON SSE line — skip
    }
  }

  return textParts.join('');
}
