import type { ZodType } from 'zod';
import { AppError } from '../lib/errors.js';
import { logger } from '../lib/logger.js';

export type ChatRole = 'system' | 'user' | 'assistant';
export type ChatMessage = { role: ChatRole; content: string };

export type JsonOpts<T> = {
  /**
   * Deterministic fixture used when LLM_MOCK=true. It is validated against the same schema,
   * so a fixture that drifts from the schema fails loudly in tests rather than at the demo.
   */
  mock?: () => unknown;
  model?: string;
  maxTokens?: number;
  temperature?: number;
  /** Shows up in logs so a bad prompt is identifiable. */
  label?: string;
  /** Extra semantic validation beyond the schema; its message is fed back on retry. */
  check?: (value: T) => string | null;
};

const TIMEOUT_MS = 30_000;
const MAX_ATTEMPTS = 3; // initial call + 2 retries (§8.1)

const envOr = (key: string, fallback: string): string => process.env[key]?.trim() || fallback;

export type LlmConfig = {
  provider: string;
  apiKey: string;
  /**
   * Only needed for an org-level key. Anthropic rejects those with a 400 unless the request names
   * a workspace; a key created inside a workspace carries it already and leaves this empty.
   */
  workspaceId: string;
  baseUrl: string;
  textModel: string;
  visionModel: string;
  copyModel: string;
};

/** Read lazily so tests (and `.env` reloads) can flip providers without reimporting. */
export function llmConfig(): LlmConfig {
  return {
    provider: envOr('LLM_PROVIDER', 'anthropic'),
    apiKey: process.env.LLM_API_KEY?.trim() ?? '',
    workspaceId: process.env.LLM_WORKSPACE_ID?.trim() ?? '',
    baseUrl: envOr('LLM_BASE_URL', 'https://api.anthropic.com'),
    textModel: envOr('LLM_MODEL_TEXT', 'claude-sonnet-4-6'),
    visionModel: envOr('LLM_MODEL_VISION', 'claude-sonnet-4-6'),
    copyModel: envOr('LLM_MODEL_COPY', 'claude-opus-4-6'),
  };
}

/** Mock is explicit via LLM_MOCK, and implicit whenever there is no key to call with. */
export function isMocked(): boolean {
  const flag = process.env.LLM_MOCK?.trim().toLowerCase();
  if (flag === 'true' || flag === '1') return true;
  if (flag === 'false' || flag === '0') return false;
  return llmConfig().apiKey === '';
}

export const llmMode = (): 'mock' | string => (isMocked() ? 'mock' : llmConfig().provider);

const JSON_RULE =
  'Reply with a single JSON value and nothing else. No prose, no markdown, no code fences.';

/** Pulls the JSON value out of a reply that may be fenced or wrapped in chatter. */
export function stripFences(raw: string): string {
  const trimmed = raw.trim();
  const fenced = /^```(?:json)?\s*([\s\S]*?)\s*```$/i.exec(trimmed);
  const body = (fenced?.[1] ?? trimmed).trim();
  if (body.startsWith('{') || body.startsWith('[')) return body;

  const first = body.search(/[[{]/);
  if (first === -1) return body;
  const opener = body[first];
  const closer = opener === '[' ? ']' : '}';
  const last = body.lastIndexOf(closer);
  return last > first ? body.slice(first, last + 1) : body.slice(first);
}

function describeIssues(error: unknown): string {
  if (error && typeof error === 'object' && 'issues' in error) {
    const issues = (error as { issues: { path: PropertyKey[]; message: string }[] }).issues;
    return issues.map((i) => `${i.path.join('.') || '(root)'}: ${i.message}`).join('; ');
  }
  return error instanceof Error ? error.message : String(error);
}

function validate<T>(schema: ZodType<T>, raw: string, check?: (value: T) => string | null): T {
  const text = stripFences(raw);
  let parsed: unknown;
  try {
    parsed = JSON.parse(text);
  } catch (error) {
    throw new Error(`not valid JSON (${(error as Error).message})`);
  }
  const result = schema.safeParse(parsed);
  if (!result.success) throw new Error(describeIssues(result.error));
  const problem = check?.(result.data);
  if (problem) throw new Error(problem);
  return result.data;
}

type AnthropicTextBlock = { type: 'text'; text: string };
type AnthropicImageBlock = {
  type: 'image';
  source:
    | { type: 'url'; url: string }
    | { type: 'base64'; media_type: string; data: string };
};
type AnthropicBlock = AnthropicTextBlock | AnthropicImageBlock;
type AnthropicMessage = { role: 'user' | 'assistant'; content: string | AnthropicBlock[] };

/** `data:image/png;base64,...`, a bare base64 blob, or an https URL. */
export function imageBlock(imageUrlOrBase64: string): AnthropicImageBlock {
  if (/^https?:\/\//i.test(imageUrlOrBase64)) {
    return { type: 'image', source: { type: 'url', url: imageUrlOrBase64 } };
  }
  const dataUrl = /^data:([\w/+.-]+);base64,(.*)$/s.exec(imageUrlOrBase64);
  return {
    type: 'image',
    source: {
      type: 'base64',
      media_type: dataUrl?.[1] ?? 'image/jpeg',
      data: dataUrl?.[2] ?? imageUrlOrBase64,
    },
  };
}

async function callAnthropic(
  messages: AnthropicMessage[],
  system: string,
  opts: { model: string; maxTokens: number; temperature: number; label: string },
): Promise<string> {
  const cfg = llmConfig();
  if (cfg.provider !== 'anthropic') {
    throw new AppError('LLM_ERROR', 502, `Unsupported LLM_PROVIDER "${cfg.provider}"`);
  }
  if (!cfg.apiKey) throw new AppError('LLM_ERROR', 502, 'LLM_API_KEY is not set');

  const started = Date.now();
  let response: Response;
  try {
    response = await fetch(`${cfg.baseUrl}/v1/messages`, {
      method: 'POST',
      headers: {
        'content-type': 'application/json',
        'x-api-key': cfg.apiKey,
        'anthropic-version': '2023-06-01',
        ...(cfg.workspaceId ? { 'anthropic-workspace-id': cfg.workspaceId } : {}),
      },
      body: JSON.stringify({
        model: opts.model,
        max_tokens: opts.maxTokens,
        temperature: opts.temperature,
        system: `${system}\n\n${JSON_RULE}`.trim(),
        messages,
      }),
      signal: AbortSignal.timeout(TIMEOUT_MS),
    });
  } catch (error) {
    throw new AppError('LLM_ERROR', 502, `LLM request failed: ${(error as Error).message}`);
  }

  if (!response.ok) {
    const detail = await response.text().catch(() => '');
    throw new AppError('LLM_ERROR', 502, `LLM ${response.status}: ${detail.slice(0, 300)}`);
  }

  const payload = (await response.json()) as {
    content?: { type: string; text?: string }[];
    usage?: { input_tokens?: number; output_tokens?: number };
  };

  logger.info('llm.call', {
    label: opts.label,
    model: opts.model,
    ms: Date.now() - started,
    inputTokens: payload.usage?.input_tokens ?? null,
    outputTokens: payload.usage?.output_tokens ?? null,
  });

  return (payload.content ?? [])
    .filter((block) => block.type === 'text')
    .map((block) => block.text ?? '')
    .join('')
    .trim();
}

function mockResult<T>(schema: ZodType<T>, opts: JsonOpts<T> | undefined, label: string): T {
  if (!opts?.mock) {
    throw new AppError('LLM_ERROR', 502, `No mock fixture registered for LLM call "${label}"`);
  }
  const result = schema.safeParse(opts.mock());
  if (!result.success) {
    throw new AppError('LLM_ERROR', 502, `Mock fixture for "${label}" is invalid: ${describeIssues(result.error)}`);
  }
  logger.info('llm.mock', { label });
  return result.data;
}

async function runWithRetries<T>(
  schema: ZodType<T>,
  build: (repair: ChatMessage[]) => { messages: AnthropicMessage[]; system: string },
  opts: JsonOpts<T> | undefined,
  defaults: { model: string; label: string },
): Promise<T> {
  const repair: ChatMessage[] = [];
  let lastError = 'unknown error';

  for (let attempt = 1; attempt <= MAX_ATTEMPTS; attempt += 1) {
    const { messages, system } = build(repair);
    const raw = await callAnthropic(messages, system, {
      model: opts?.model ?? defaults.model,
      maxTokens: opts?.maxTokens ?? 2048,
      temperature: opts?.temperature ?? 0.7,
      label: defaults.label,
    });
    try {
      return validate(schema, raw, opts?.check);
    } catch (error) {
      lastError = (error as Error).message;
      logger.warn('llm.invalid_output', { label: defaults.label, attempt, error: lastError });
      repair.push(
        { role: 'assistant', content: raw.slice(0, 4000) },
        {
          role: 'user',
          content: `That response was rejected: ${lastError}. Return corrected JSON only, matching the requested shape exactly.`,
        },
      );
    }
  }

  throw new AppError('LLM_ERROR', 502, `LLM output failed validation after ${MAX_ATTEMPTS} attempts: ${lastError}`);
}

function toAnthropic(messages: ChatMessage[]): { messages: AnthropicMessage[]; system: string } {
  const system = messages
    .filter((m) => m.role === 'system')
    .map((m) => m.content)
    .join('\n\n');
  const rest = messages
    .filter((m): m is ChatMessage & { role: 'user' | 'assistant' } => m.role !== 'system')
    .map((m) => ({ role: m.role, content: m.content }));
  return { messages: rest, system };
}

export async function chatJSON<T>(
  schema: ZodType<T>,
  messages: ChatMessage[],
  opts?: JsonOpts<T>,
): Promise<T> {
  const label = opts?.label ?? 'chatJSON';
  if (isMocked()) return mockResult(schema, opts, label);

  return runWithRetries(
    schema,
    (repair) => toAnthropic([...messages, ...repair]),
    opts,
    { model: llmConfig().textModel, label },
  );
}

export async function visionJSON<T>(
  schema: ZodType<T>,
  imageUrlOrBase64: string,
  prompt: string,
  opts?: JsonOpts<T>,
): Promise<T> {
  const label = opts?.label ?? 'visionJSON';
  if (isMocked()) return mockResult(schema, opts, label);

  const image = imageBlock(imageUrlOrBase64);
  return runWithRetries(
    schema,
    (repair) => ({
      system: '',
      messages: [
        { role: 'user', content: [image, { type: 'text', text: prompt }] },
        ...repair.map((m) => ({
          role: m.role === 'assistant' ? ('assistant' as const) : ('user' as const),
          content: m.content,
        })),
      ],
    }),
    opts,
    { model: llmConfig().visionModel, label },
  );
}
