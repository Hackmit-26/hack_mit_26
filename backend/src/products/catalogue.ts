import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { z } from 'zod';
import type { Product } from '../types/api.js';

export const productSchema = z.object({
  id: z.string().min(1),
  name: z.string().min(1),
  url: z.url().nullable(),
  imageUrl: z.url(),
  priceCents: z.number().int().positive(),
  merchant: z.string().min(1),
  category: z.string().min(1),
  description: z.string().min(1),
});

/** §8.5 asks for 20-30 candidates to hand to the LLM. */
export const MAX_RESULTS = 30;

const CANDIDATE_PATHS = [
  fileURLToPath(new URL('../../fixtures/catalogue.json', import.meta.url)),
  resolve(process.cwd(), 'fixtures/catalogue.json'),
];

let cache: Product[] | undefined;

export function loadCatalogue(): Product[] {
  if (cache) return cache;

  let raw: string | undefined;
  for (const path of CANDIDATE_PATHS) {
    try {
      raw = readFileSync(path, 'utf8');
      break;
    } catch {
      // try the next candidate
    }
  }
  if (raw === undefined) {
    throw new Error(`Could not read catalogue.json (looked in ${CANDIDATE_PATHS.join(', ')})`);
  }

  cache = z.array(productSchema).parse(JSON.parse(raw));
  return cache;
}

/**
 * Replaces the bundled fixture with the merchant catalogue held in Postgres. Called once at boot
 * so that every pick cites a product id the teammates' `gift_picks.product_id` FK will accept.
 */
export function setCatalogue(products: Product[]): void {
  cache = products;
}

/** Words that show up in almost every LLM-written search query and carry no signal. */
const STOP_WORDS = new Set([
  'and',
  'are',
  'best',
  'for',
  'gift',
  'gifts',
  'good',
  'great',
  'her',
  'him',
  'his',
  'idea',
  'ideas',
  'into',
  'like',
  'likes',
  'love',
  'loves',
  'new',
  'present',
  'someone',
  'something',
  'that',
  'the',
  'their',
  'they',
  'who',
  'with',
]);

function tokenize(text: string): string[] {
  return text
    .toLowerCase()
    .split(/[^a-z0-9]+/)
    .filter((token) => token.length > 2 && !STOP_WORDS.has(token))
    .map((token) => (token.length > 3 && token.endsWith('s') ? token.slice(0, -1) : token));
}

const FIELDS = [
  { weight: 5, of: (p: Product) => p.name },
  { weight: 3, of: (p: Product) => p.category },
  { weight: 2, of: (p: Product) => p.merchant },
  { weight: 1, of: (p: Product) => p.description },
] as const;

function score(product: Product, queryTokens: Set<string>): number {
  let total = 0;
  for (const field of FIELDS) {
    const fieldTokens = new Set(tokenize(field.of(product)));
    for (const token of queryTokens) {
      if (fieldTokens.has(token)) total += field.weight;
    }
  }
  return total;
}

/**
 * Budget filter first, then deterministic token-overlap ranking across name, category, merchant
 * and description. Ties break on price then id, so the same inputs always give the same order.
 * The tail is padded from the in-budget pool so the picker always gets a full shortlist.
 */
export function searchCatalogue(
  queries: string[],
  budget: { minCents: number; maxCents: number },
): Product[] {
  const inBudget = loadCatalogue().filter(
    (p) => p.priceCents >= budget.minCents && p.priceCents <= budget.maxCents,
  );

  const queryTokens = new Set(queries.flatMap(tokenize));

  return inBudget
    .map((product) => ({ product, relevance: score(product, queryTokens) }))
    .sort(
      (a, b) =>
        b.relevance - a.relevance ||
        a.product.priceCents - b.product.priceCents ||
        a.product.id.localeCompare(b.product.id),
    )
    .slice(0, MAX_RESULTS)
    .map((scored) => scored.product);
}

export function findProduct(id: string): Product | undefined {
  return loadCatalogue().find((p) => p.id === id);
}
