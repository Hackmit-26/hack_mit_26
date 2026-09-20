import { db, newId, now } from '../db/index.js';
import type { GiftPickRow, GiftThreadRow, ItemRow } from '../db/types.js';
import { AppError, notFound } from '../lib/errors.js';
import { logger } from '../lib/logger.js';
import { searchCatalogue } from '../products/catalogue.js';
import type { Product } from '../types/api.js';
import { embedText } from './embed.js';
import { chatJSON } from './llm.js';
import { giftProfilePrompt, giftProfileSchema } from './prompts/giftProfile.js';
import { giftQueriesPrompt, giftQueriesSchema } from './prompts/giftQueries.js';
import {
  giftReasonsPrompt,
  giftReasonsSchema,
  type ReasonCandidate,
} from './prompts/giftReasons.js';
import { cosine, memberVector, signalItems, type SignalItem, type SignalKind } from './taste.js';

const WANTED = 3;
const MAX_GROUNDING_RETRIES = 2;

/* -------------------------------------------------------------------------- */
/* Grounding: the single worst failure mode is a hallucinated citation          */
/* -------------------------------------------------------------------------- */

const STOPWORDS = new Set(['with', 'from', 'that', 'this', 'your', 'their', 'size', 'pack', 'the']);

const normalise = (text: string): string =>
  text
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, ' ')
    .trim();

const significantTokens = (name: string): string[] =>
  normalise(name)
    .split(' ')
    .filter((token) => token.length >= 4 && !STOPWORDS.has(token));

/**
 * Does this reason actually name the item? Exact phrase wins; otherwise the distinctive words
 * must be there (one may be dropped for names of three words or more, because "the Aesop hand
 * balm" is a fair way to refer to "Aesop Resurrection Hand Balm").
 */
export function mentionsItemName(reason: string, itemName: string): boolean {
  const haystack = normalise(reason);
  const needle = normalise(itemName);
  if (!needle) return false;
  if (haystack.includes(needle)) return true;

  const tokens = significantTokens(itemName);
  if (tokens.length === 0) return false;
  const matched = tokens.filter((token) => haystack.includes(token)).length;
  if (tokens.length >= 3) return matched >= tokens.length - 1;
  return matched === tokens.length;
}

export type GroundingResult = { ok: boolean; problem: string | null };

/**
 * §1 rule 5: a pick must cite at least one of the recipient's real signal items, and the
 * reason must say that item's name out loud. Anything else is a hallucination and is rejected.
 */
export function checkGrounding(
  pick: { reason: string; citedItemIds: string[] },
  signals: { id: string; name: string }[],
): GroundingResult {
  if (pick.citedItemIds.length === 0) {
    return { ok: false, problem: 'citedItemIds was empty' };
  }

  const byId = new Map(signals.map((signal) => [signal.id, signal.name]));
  const unknown = pick.citedItemIds.filter((id) => !byId.has(id));
  if (unknown.length > 0) {
    return { ok: false, problem: `cited item ids are not the recipient's: ${unknown.join(', ')}` };
  }

  const named = pick.citedItemIds.some((id) => mentionsItemName(pick.reason, byId.get(id) ?? ''));
  if (!named) {
    const names = pick.citedItemIds.map((id) => `"${byId.get(id)}"`).join(' or ');
    return { ok: false, problem: `the reason never names ${names}` };
  }

  return { ok: true, problem: null };
}

/* -------------------------------------------------------------------------- */
/* Candidates                                                                  */
/* -------------------------------------------------------------------------- */

type Candidate = {
  id: string;
  name: string;
  url: string;
  imageUrl: string | null;
  priceCents: number;
  merchant: string;
  description: string;
  category: string;
  /** Set when the candidate is one of the recipient's own signal items. */
  sourceItemId: string | null;
  signal: SignalKind | null;
};

const searchUrl = (name: string): string =>
  `https://www.google.com/search?q=${encodeURIComponent(name)}`;

function fromItem(signal: SignalItem, midCents: number): Candidate {
  const { item } = signal;
  return {
    id: `item:${item.id}`,
    name: item.name,
    url: searchUrl(item.name),
    imageUrl: item.imageUrl,
    priceCents: item.priceCents ?? midCents,
    merchant: item.merchant ?? '',
    description: item.description ?? '',
    category: item.category,
    sourceItemId: item.id,
    signal: signal.signal,
  };
}

const fromProduct = (product: Product): Candidate => ({
  id: `product:${product.id}`,
  name: product.name,
  // The merchant feed has no product pages, so fall back to the same search link items use.
  url: product.url ?? searchUrl(product.name),
  imageUrl: product.imageUrl,
  priceCents: product.priceCents,
  merchant: product.merchant,
  description: product.description,
  category: product.category,
  sourceItemId: null,
  signal: null,
});

/** Loose name match, used to spot "they already own this" and repeats of earlier picks. */
export function fuzzyNameMatch(a: string, b: string): boolean {
  const left = normalise(a);
  const right = normalise(b);
  if (!left || !right) return false;
  if (left === right || left.includes(right) || right.includes(left)) return true;

  const leftTokens = new Set(significantTokens(a));
  const rightTokens = significantTokens(b);
  if (leftTokens.size === 0 || rightTokens.length === 0) return false;
  const overlap = rightTokens.filter((token) => leftTokens.has(token)).length;
  return overlap / Math.max(leftTokens.size, rightTokens.length) >= 0.6;
}

function band(priceCents: number, min: number, max: number): 'low' | 'mid' | 'high' {
  const span = Math.max(max - min, 1) / 3;
  if (priceCents < min + span) return 'low';
  if (priceCents < min + 2 * span) return 'mid';
  return 'high';
}

/* -------------------------------------------------------------------------- */
/* Pipeline                                                                    */
/* -------------------------------------------------------------------------- */

const VERB: Record<SignalKind, string> = {
  wishlist: 'saved',
  heart: 'hearted',
  bought: 'already owns',
};

export function templateReason(recipientName: string, signal: SignalItem): string {
  return `${recipientName} ${VERB[signal.signal]} "${signal.item.name}" — this is in the same spirit.`;
}

function mockSummary(recipientName: string, signals: SignalItem[]): string {
  const names = signals.slice(0, 3).map((s) => `"${s.item.name}"`);
  const categories = [...new Set(signals.map((s) => s.item.category))].slice(0, 3);
  return `${recipientName} gravitates to ${categories.join(', ') || 'a bit of everything'} — think ${names.join(
    ', ',
  )}. A good gift leans tactile and considered rather than gadgety, and fits the same quiet palette.`;
}

function mockQueries(signals: SignalItem[]): string[] {
  const categories = [...new Set(signals.map((s) => s.item.category))];
  const base = signals.slice(0, 3).map((s) => s.item.name.toLowerCase().split(' ').slice(0, 3).join(' '));
  const queries = [...new Set([...base, ...categories.map((c) => `${c.replace(/_/g, ' ')} gift`)])];
  while (queries.length < 3) queries.push('thoughtful gift');
  return queries.slice(0, 5);
}

async function rankCandidates(
  candidates: Candidate[],
  vector: number[] | null,
): Promise<Candidate[]> {
  const scored: { candidate: Candidate; score: number }[] = [];
  for (const candidate of candidates) {
    const text = [candidate.name, candidate.category, candidate.description].filter(Boolean).join(' ');
    const score = vector ? cosine(await embedText(text), vector) : 0;
    scored.push({ candidate, score });
  }

  // Wishlist pins to the top, hearted next: the recipient told us, so no ranking beats that.
  const pin = (candidate: Candidate): number =>
    candidate.signal === 'wishlist' ? 2 : candidate.signal === 'heart' ? 1 : 0;

  return scored
    .sort(
      (a, b) =>
        pin(b.candidate) - pin(a.candidate) ||
        b.score - a.score ||
        a.candidate.id.localeCompare(b.candidate.id),
    )
    .map((entry) => entry.candidate);
}

function loadThread(threadId: string): GiftThreadRow {
  const thread = db.giftThreads.find((t) => t.id === threadId);
  if (!thread) throw notFound('Thread not found');
  return thread;
}

/** Generates (or regenerates) 3 grounded picks for a thread and persists them to db.giftPicks. */
export async function generatePicks(threadId: string): Promise<GiftPickRow[]> {
  const thread = loadThread(threadId);
  const recipientName = db.users.find((u) => u.id === thread.recipientId)?.name ?? 'They';
  const budget = { minCents: thread.budgetMinCents, maxCents: thread.budgetMaxCents };
  const midCents = Math.round((budget.minCents + budget.maxCents) / 2);

  const signals = signalItems(thread.recipientId, thread.groupId);
  if (signals.length === 0) {
    throw new AppError('NOT_ENOUGH_DATA', 422, `${recipientName} has not shared or saved anything yet`);
  }

  // 1. Profile.
  const { summary } = await chatJSON(giftProfileSchema, giftProfilePrompt(recipientName, signals.map((s) => ({
    name: s.item.name,
    category: s.item.category,
    signal: s.signal,
  }))), {
    label: 'gift.profile',
    temperature: 0.4,
    mock: () => ({ summary: mockSummary(recipientName, signals) }),
  });

  // 2. Candidates: the recipient's own saved/hearted items first, then the catalogue.
  const { queries } = await chatJSON(giftQueriesSchema, giftQueriesPrompt(summary), {
    label: 'gift.queries',
    temperature: 0.5,
    mock: () => ({ queries: mockQueries(signals) }),
  });

  // "Owned" means they actually bought it. Testing ownerId instead would throw away the
  // recipient's own wishlist - the single strongest gift signal there is - because a wishlist
  // entry is by definition saved by, and therefore attributed to, the recipient.
  const owns = (item: ItemRow): boolean =>
    item.ownerId === thread.recipientId && item.purchasedAt !== null;
  const ownedItems: ItemRow[] = signals.filter((s) => owns(s.item)).map((s) => s.item);
  const giftable = signals.filter((s) => s.signal !== 'bought' && !owns(s.item));

  const previousPicks = db.giftPicks.filter((p) => p.threadId === threadId);
  const candidates: Candidate[] = [
    ...giftable.map((signal) => fromItem(signal, midCents)),
    ...searchCatalogue(queries, budget).map(fromProduct),
  ];

  // 3. Filter: already owned, out of budget, repeats.
  const seen: string[] = [];
  const filtered = candidates.filter((candidate) => {
    if (candidate.priceCents < budget.minCents || candidate.priceCents > budget.maxCents) return false;
    if (ownedItems.some((item) => fuzzyNameMatch(item.name, candidate.name))) return false;
    if (previousPicks.some((pick) => fuzzyNameMatch(pick.productName, candidate.name))) return false;
    if (seen.some((name) => fuzzyNameMatch(name, candidate.name))) return false;
    seen.push(candidate.name);
    return true;
  });

  if (filtered.length === 0) {
    throw new AppError(
      'NOT_ENOUGH_DATA',
      422,
      'No gift candidates fit this budget - widen it or add products to the catalogue',
    );
  }

  // 4. Rank.
  const vector = await memberVector(thread.recipientId, thread.groupId);
  const ranked = (await rankCandidates(filtered, vector)).slice(0, 30);
  const wanted = Math.min(WANTED, ranked.length);

  // 5/6. Explain, then insist on grounding.
  const byId = new Map(ranked.map((candidate) => [candidate.id, candidate]));
  const signalRefs = signals.map((s) => ({ id: s.item.id, name: s.item.name }));
  const reasonCandidates: ReasonCandidate[] = ranked.map((candidate) => ({
    id: candidate.id,
    name: candidate.name,
    merchant: candidate.merchant,
    description: candidate.description,
    band: band(candidate.priceCents, budget.minCents, budget.maxCents),
    fromWishlist: candidate.signal === 'wishlist',
  }));

  const chosen = await explainPicks({
    recipientName,
    summary,
    reasonCandidates,
    signalRefs,
    wanted,
    byId,
    ranked,
    signals,
  });

  const rows = chosen.map((choice) => ({
    id: newId(),
    threadId,
    productName: choice.candidate.name,
    productUrl: choice.candidate.url,
    imageUrl: choice.candidate.imageUrl,
    priceCents: choice.candidate.priceCents,
    merchant: choice.candidate.merchant || null,
    reason: choice.reason,
    citedItemIds: choice.citedItemIds,
    source: 'ai' as const,
    createdAt: now(),
  }));

  db.giftPicks.insertMany(rows);
  logger.info('gift.picks_generated', { threadId, picks: rows.length });
  return rows;
}

type Choice = { candidate: Candidate; reason: string; citedItemIds: string[] };

async function explainPicks(input: {
  recipientName: string;
  summary: string;
  reasonCandidates: ReasonCandidate[];
  signalRefs: { id: string; name: string }[];
  wanted: number;
  byId: Map<string, Candidate>;
  ranked: Candidate[];
  signals: SignalItem[];
}): Promise<Choice[]> {
  const prompt = giftReasonsPrompt({
    recipientName: input.recipientName,
    summary: input.summary,
    candidates: input.reasonCandidates,
    signals: input.signals.map((s) => ({ id: s.item.id, name: s.item.name, signal: s.signal })),
    wanted: input.wanted,
  });

  for (let attempt = 0; attempt <= MAX_GROUNDING_RETRIES; attempt += 1) {
    let result: { picks: { candidateId: string; reason: string; citedItemIds: string[] }[] };
    try {
      result = await chatJSON(giftReasonsSchema, prompt, {
        label: `gift.reasons.attempt${attempt}`,
        temperature: attempt === 0 ? 0.6 : 0.3,
        mock: () => ({ picks: mockPicks(input.ranked, input.signals, input.recipientName, input.wanted) }),
        check: (value) => {
          for (const pick of value.picks) {
            if (!input.byId.has(pick.candidateId)) return `unknown candidateId "${pick.candidateId}"`;
            const grounding = checkGrounding(pick, input.signalRefs);
            if (!grounding.ok) return `pick "${pick.candidateId}": ${grounding.problem}`;
          }
          return null;
        },
      });
    } catch (error) {
      logger.warn('gift.reasons_failed', { attempt, error: (error as Error).message });
      continue;
    }

    const choices: Choice[] = [];
    for (const pick of result.picks) {
      const candidate = input.byId.get(pick.candidateId);
      if (!candidate) continue;
      if (!checkGrounding(pick, input.signalRefs).ok) continue;
      if (choices.some((c) => c.candidate.id === candidate.id)) continue;
      choices.push({ candidate, reason: pick.reason, citedItemIds: pick.citedItemIds });
    }
    if (choices.length >= input.wanted) return choices.slice(0, input.wanted);
    logger.warn('gift.reasons_ungrounded', { attempt, kept: choices.length });
  }

  // Fallback (§8.5 step 6): top-ranked candidates with a template reason that cites a real item.
  logger.warn('gift.reasons_template_fallback', {});
  return input.ranked.slice(0, input.wanted).map((candidate) => {
    const signal =
      input.signals.find((s) => s.item.id === candidate.sourceItemId) ??
      input.signals.find((s) => s.signal !== 'bought') ??
      input.signals[0];
    if (!signal) throw new AppError('NOT_ENOUGH_DATA', 422, 'No signal item to cite');
    return {
      candidate,
      reason: templateReason(input.recipientName, signal),
      citedItemIds: [signal.item.id],
    };
  });
}

/** Deterministic offline picks: top-ranked candidates, each citing a real signal item by name. */
function mockPicks(
  ranked: Candidate[],
  signals: SignalItem[],
  recipientName: string,
  wanted: number,
): { candidateId: string; reason: string; citedItemIds: string[] }[] {
  const giftable = signals.filter((s) => s.signal !== 'bought');
  const pool = giftable.length > 0 ? giftable : signals;

  return ranked.slice(0, wanted).map((candidate, index) => {
    const own = signals.find((s) => s.item.id === candidate.sourceItemId);
    const signal = own ?? pool[index % pool.length] ?? pool[0];
    if (!signal) {
      return { candidateId: candidate.id, reason: 'No evidence available.', citedItemIds: [] };
    }
    // When the candidate *is* the signal item, saying it twice reads like a bug on screen.
    const reason = own
      ? `${recipientName} ${VERB[signal.signal]} "${signal.item.name}" — this is that exact thing.`
      : `${recipientName} ${VERB[signal.signal]} "${signal.item.name}", so ${candidate.name} lands in exactly the same lane.`;
    return { candidateId: candidate.id, reason, citedItemIds: [signal.item.id] };
  });
}
