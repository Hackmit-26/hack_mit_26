import { AppError } from '../lib/errors.js';

const TIMEOUT_MS = 30_000;

const envOr = (key: string, fallback: string): string => process.env[key]?.trim() || fallback;

export function embedDim(): number {
  const parsed = Number.parseInt(envOr('EMBED_DIM', '512'), 10);
  return Number.isFinite(parsed) && parsed > 0 ? parsed : 512;
}

export function isMocked(): boolean {
  const flag = process.env.EMBED_MOCK?.trim().toLowerCase() ?? process.env.LLM_MOCK?.trim().toLowerCase();
  if (flag === 'true' || flag === '1') return true;
  if (flag === 'false' || flag === '0') return false;
  return !process.env.EMBED_API_KEY?.trim();
}

/** FNV-1a: small, stable across processes, good enough to seed a PRNG. */
function hash32(input: string): number {
  let h = 0x811c9dc5;
  for (let i = 0; i < input.length; i += 1) {
    h ^= input.charCodeAt(i);
    h = Math.imul(h, 0x01000193) >>> 0;
  }
  return h >>> 0;
}

function mulberry32(seed: number): () => number {
  let a = seed >>> 0;
  return () => {
    a = (a + 0x6d2b79f5) >>> 0;
    let t = a;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

export function unit(vector: number[]): number[] {
  const norm = Math.sqrt(vector.reduce((sum, v) => sum + v * v, 0));
  if (norm === 0) return vector.slice();
  return vector.map((v) => v / norm);
}

/**
 * Deterministic pseudo-embedding. Words contribute independently, so two strings that share
 * vocabulary land near each other and cosine similarity still means something offline.
 */
export function mockEmbedding(text: string, dim = embedDim()): number[] {
  const tokens = text
    .toLowerCase()
    .split(/[^a-z0-9]+/)
    .filter(Boolean);
  const words = tokens.length > 0 ? tokens : ['\u0000empty'];

  const acc = new Array<number>(dim).fill(0);
  for (const word of words) {
    const random = mulberry32(hash32(word));
    for (let i = 0; i < dim; i += 1) {
      acc[i] = (acc[i] ?? 0) + (random() * 2 - 1);
    }
  }
  return unit(acc);
}

async function openaiEmbed(input: string): Promise<number[]> {
  const apiKey = process.env.EMBED_API_KEY?.trim();
  const provider = envOr('EMBED_PROVIDER', 'openai');
  if (provider !== 'openai') {
    throw new AppError('LLM_ERROR', 502, `Unsupported EMBED_PROVIDER "${provider}"`);
  }
  if (!apiKey) throw new AppError('LLM_ERROR', 502, 'EMBED_API_KEY is not set');

  let response: Response;
  try {
    response = await fetch(`${envOr('EMBED_BASE_URL', 'https://api.openai.com')}/v1/embeddings`, {
      method: 'POST',
      headers: { 'content-type': 'application/json', authorization: `Bearer ${apiKey}` },
      body: JSON.stringify({
        model: envOr('EMBED_MODEL', 'text-embedding-3-small'),
        input,
        dimensions: embedDim(),
      }),
      signal: AbortSignal.timeout(TIMEOUT_MS),
    });
  } catch (error) {
    throw new AppError('LLM_ERROR', 502, `Embedding request failed: ${(error as Error).message}`);
  }

  if (!response.ok) {
    const detail = await response.text().catch(() => '');
    throw new AppError('LLM_ERROR', 502, `Embedding ${response.status}: ${detail.slice(0, 300)}`);
  }

  const payload = (await response.json()) as { data?: { embedding?: number[] }[] };
  const embedding = payload.data?.[0]?.embedding;
  if (!embedding?.length) throw new AppError('LLM_ERROR', 502, 'Embedding response had no vector');
  return unit(embedding);
}

export async function embedText(text: string): Promise<number[]> {
  const input = text.trim();
  if (isMocked()) return mockEmbedding(input);
  return openaiEmbed(input || 'item');
}

/**
 * We deliberately skip CLIP: no hosted image model is wired up, so an image "embedding" is the
 * text embedding of whatever we know about the image. Callers should prefer real item text.
 */
export async function embedImage(url: string): Promise<number[]> {
  return embedText(url);
}
