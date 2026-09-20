/**
 * Chapter 1 of the Wrapped: the group's closest taste pair, and three scores describing how
 * closely they match.
 *
 * The split here is deliberate and is the whole credibility of the card: **the three scores are
 * computed from real rows, and the model only ever writes the words around them.** An LLM that
 * invents "86%" cannot answer "why 86?"; a cosine over the pair's actual items can. So the
 * numbers are arithmetic and the prose is Claude, and neither does the other's job.
 */

import { db } from '../db/index.js';
import type { ItemRow } from '../db/types.js';
import { groupMemberIds } from '../domain/permissions.js';
import { AppError } from '../lib/errors.js';
import { logger } from '../lib/logger.js';
import { chatJSON } from './llm.js';
import {
  tasteMatchCopySchema,
  tasteMatchPrompt,
  type MemberFacts,
  type TasteMatchCopy,
  type TasteMatchFacts,
} from './prompts/tasteMatch.js';
import { cosine, isGroupVisible, memberVector, signalItems } from './taste.js';
import { containsPriceLanguage } from './wrappedGenerator.js';

const MIN_MEMBERS = 2;
const MIN_ITEMS_PER_MEMBER = 3;

/* -------------------------------------------------------------------------- */
/* Scores                                                                      */
/* -------------------------------------------------------------------------- */

/**
 * Log-ish price bands in cents. Histogram shape, never a figure, leaves the building — the card
 * is a social surface and social surfaces carry no prices (§1 rule 2).
 */
export const PRICE_BANDS = [500, 1500, 4000, 10000, 25000] as const;

export function priceHistogram(items: ItemRow[]): number[] {
  const bins = new Array<number>(PRICE_BANDS.length + 1).fill(0);
  for (const item of items) {
    if (item.priceCents === null) continue;
    const found = PRICE_BANDS.findIndex((band) => (item.priceCents as number) < band);
    const index = found === -1 ? PRICE_BANDS.length : found;
    bins[index] = (bins[index] ?? 0) + 1;
  }
  return bins;
}

const DAY_NAMES = ['Sunday', 'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday'];

/** `purchasedAt` is a date with no clock, so the rhythm we can honestly measure is the week. */
export function weekdayHistogram(items: ItemRow[]): number[] {
  const bins = new Array<number>(7).fill(0);
  for (const item of items) {
    const stamp = item.purchasedAt ?? item.createdAt;
    const date = new Date(stamp);
    if (Number.isNaN(date.getTime())) continue;
    const day = date.getUTCDay();
    bins[day] = (bins[day] ?? 0) + 1;
  }
  return bins;
}

const pct = (value: number): number => Math.round(Math.max(0, Math.min(1, value)) * 100);

export type PairScores = { taste: number; budget: number; timing: number };

/* -------------------------------------------------------------------------- */
/* Member shape                                                                */
/* -------------------------------------------------------------------------- */

type Member = {
  userId: string;
  name: string;
  /** Everything that describes their taste: saves, hearts and their own shares. */
  signalItems: ItemRow[];
  /** Only what they themselves put in the group — what they actually buy. */
  ownItems: ItemRow[];
  vector: number[] | null;
};

const userName = (userId: string): string =>
  db.users.find((u) => u.id === userId)?.name ?? 'A friend';

function topCounts(values: (string | null)[], limit: number): { value: string; count: number }[] {
  const counts = new Map<string, number>();
  for (const value of values) {
    if (!value) continue;
    counts.set(value, (counts.get(value) ?? 0) + 1);
  }
  return [...counts.entries()]
    .sort((a, b) => b[1] - a[1] || a[0].localeCompare(b[0]))
    .slice(0, limit)
    .map(([value, count]) => ({ value, count }));
}

async function loadMembers(groupId: string): Promise<Member[]> {
  const members: Member[] = [];
  for (const userId of groupMemberIds(groupId)) {
    const signals = signalItems(userId, groupId).map((s) => s.item);
    const own = db.items.filter(
      (item) => item.ownerId === userId && isGroupVisible(item, groupId),
    );
    if (signals.length < MIN_ITEMS_PER_MEMBER) continue;
    members.push({
      userId,
      name: userName(userId),
      signalItems: signals,
      ownItems: own,
      vector: await memberVector(userId, groupId),
    });
  }
  return members;
}

export function scorePair(a: Member, b: Member): PairScores {
  return {
    taste: pct(a.vector && b.vector ? cosine(a.vector, b.vector) : 0),
    budget: pct(cosine(priceHistogram(a.ownItems), priceHistogram(b.ownItems))),
    timing: pct(cosine(weekdayHistogram(a.ownItems), weekdayHistogram(b.ownItems))),
  };
}

const spendShape = (items: ItemRow[]): string => {
  const bins = priceHistogram(items);
  const peak = bins.indexOf(Math.max(...bins));
  if (peak <= 1) return 'everyday';
  if (peak <= 3) return 'considered';
  return 'investment';
};

const peakDay = (items: ItemRow[]): string => {
  const bins = weekdayHistogram(items);
  const max = Math.max(...bins);
  return max === 0 ? 'no clear day' : (DAY_NAMES[bins.indexOf(max)] ?? 'no clear day');
};

function toMemberFacts(member: Member): MemberFacts {
  const merchants = topCounts(
    member.ownItems.map((i) => i.merchant),
    1,
  );
  const top = merchants[0] ?? null;
  return {
    userId: member.userId,
    name: member.name,
    topCategories: topCounts(
      member.signalItems.map((i) => i.category),
      3,
    ).map((c) => c.value),
    itemNames: member.signalItems.map((i) => i.name),
    topMerchant: top?.value ?? null,
    topMerchantCount: top?.count ?? 0,
    merchantVariety: new Set(member.ownItems.map((i) => i.merchant).filter(Boolean)).size,
    itemCount: member.ownItems.length,
    peakDay: peakDay(member.ownItems),
    spendShape: spendShape(member.ownItems),
  };
}

/* -------------------------------------------------------------------------- */
/* Copy                                                                        */
/* -------------------------------------------------------------------------- */

const titleCase = (value: string): string =>
  value.replace(/_/g, ' ').replace(/\b\w/g, (c) => c.toUpperCase());

/** Offline copy: the LLM_MOCK fixture and the last-resort fallback. Always price-free. */
export function templateCopy(facts: TasteMatchFacts): TasteMatchCopy {
  const [a, b] = facts.members;
  const tags = (facts.sharedCategories.length > 0 ? facts.sharedCategories : a.topCategories)
    .slice(0, 4)
    .map(titleCase);
  const shared = facts.sharedItemNames[0] ?? a.itemNames[0] ?? 'the same shelf';

  return {
    lead: `${a.name} and ${b.name} both keep circling ${tags.join(', ').toLowerCase()} — "${shared}" turned up on both their lists.`,
    sharedTags: tags.length >= 2 ? tags : [...tags, 'Same Brain'],
    notes: {
      taste: 'same shelves',
      budget: 'same wallet energy',
      timing: `both peak on ${a.peakDay.toLowerCase()}`,
    },
    disagreements: [
      {
        userId: a.userId,
        text: `${a.name} spreads it around — ${a.merchantVariety} different shops across ${a.itemCount} finds.`,
      },
      {
        userId: b.userId,
        text: `${b.name} is loyal to ${b.topMerchant ?? 'one shelf'} and shows no sign of stopping.`,
      },
    ],
  };
}

/** The model may only name the two members of the pair, and may never mention money. */
function checkCopy(copy: TasteMatchCopy, facts: TasteMatchFacts): string | null {
  const ids = facts.members.map((m) => m.userId);

  const texts = [
    copy.lead,
    copy.notes.taste,
    copy.notes.budget,
    copy.notes.timing,
    ...copy.sharedTags,
    ...copy.disagreements.map((d) => d.text),
  ];
  const offender = texts.find(containsPriceLanguage);
  if (offender) return `"${offender}" mentions money, which this card may never do`;

  const seen = copy.disagreements.map((d) => d.userId);
  const unknown = seen.filter((id) => !ids.includes(id));
  if (unknown.length > 0) return `unknown userIds: ${unknown.join(', ')}. Use ${ids.join(' and ')}`;
  if (new Set(seen).size !== 2) return 'the two disagreement lines must be about different people';

  return null;
}

async function generateCopy(facts: TasteMatchFacts): Promise<{ copy: TasteMatchCopy; source: 'ai' | 'template' }> {
  try {
    const copy = await chatJSON(tasteMatchCopySchema, tasteMatchPrompt(facts), {
      label: 'wrapped.tasteMatch',
      temperature: 0.7,
      maxTokens: 900,
      check: (value) => checkCopy(value, facts),
      mock: () => templateCopy(facts),
    });
    // chatJSON retries on a failed check, but never trust the last attempt blindly.
    const problem = checkCopy(copy, facts);
    if (problem) {
      logger.warn('tasteMatch.copy_rejected', { problem });
      return { copy: templateCopy(facts), source: 'template' };
    }
    return { copy, source: 'ai' };
  } catch (error) {
    logger.warn('tasteMatch.copy_failed', { error: (error as Error).message });
    return { copy: templateCopy(facts), source: 'template' };
  }
}

/* -------------------------------------------------------------------------- */
/* Entry point                                                                 */
/* -------------------------------------------------------------------------- */

export type TasteMatchResult = {
  pair: [string, string];
  tasteScore: number;
  budgetScore: number;
  timingScore: number;
  lead: string;
  sharedTags: string[];
  notes: { taste: string; budget: string; timing: string };
  disagreement: { userId: string; text: string }[];
  footnote: string;
  otherPairs: { pair: [string, string]; score: number }[];
  source: 'ai' | 'template';
};

export async function generateTasteMatch(groupId: string): Promise<TasteMatchResult> {
  if (!db.groups.find((g) => g.id === groupId)) {
    throw new AppError('NOT_FOUND', 404, 'Group not found');
  }

  const members = await loadMembers(groupId);
  if (members.length < MIN_MEMBERS) {
    throw new AppError(
      'NOT_ENOUGH_DATA',
      422,
      `A taste match needs ${MIN_MEMBERS} members with ${MIN_ITEMS_PER_MEMBER} shared items each; ${members.length} so far`,
    );
  }

  // Every pair, scored. Deterministic ordering so the same data always tells the same story.
  const pairs: { a: Member; b: Member; scores: PairScores }[] = [];
  for (let i = 0; i < members.length; i += 1) {
    for (let j = i + 1; j < members.length; j += 1) {
      const a = members[i];
      const b = members[j];
      if (!a || !b) continue;
      pairs.push({ a, b, scores: scorePair(a, b) });
    }
  }
  pairs.sort(
    (x, y) =>
      y.scores.taste - x.scores.taste ||
      y.scores.budget - x.scores.budget ||
      x.a.userId.localeCompare(y.a.userId) ||
      x.b.userId.localeCompare(y.b.userId),
  );

  const winner = pairs[0];
  if (!winner) throw new AppError('NOT_ENOUGH_DATA', 422, 'Not enough taste signal for a pair');

  const factsA = toMemberFacts(winner.a);
  const factsB = toMemberFacts(winner.b);
  const sharedCategories = factsA.topCategories.filter((c) => factsB.topCategories.includes(c));
  const inShared = (item: ItemRow): boolean => sharedCategories.includes(item.category);

  const facts: TasteMatchFacts = {
    scores: winner.scores,
    sharedCategories,
    sharedItemNames: [
      ...winner.a.signalItems.filter(inShared).map((i) => i.name),
      ...winner.b.signalItems.filter(inShared).map((i) => i.name),
    ],
    members: [factsA, factsB],
  };

  const { copy, source } = await generateCopy(facts);

  const comparedItems = new Set(
    members.flatMap((m) => m.signalItems.map((i) => i.id)),
  ).size;

  logger.info('tasteMatch.generated', {
    groupId,
    pair: [winner.a.userId, winner.b.userId],
    scores: winner.scores,
    source,
  });

  return {
    pair: [winner.a.userId, winner.b.userId],
    tasteScore: winner.scores.taste,
    budgetScore: winner.scores.budget,
    timingScore: winner.scores.timing,
    lead: copy.lead,
    sharedTags: copy.sharedTags,
    notes: copy.notes,
    disagreement: copy.disagreements.map((d) => ({ userId: d.userId, text: d.text })),
    footnote: `Compared ${comparedItems} items across ${members.length} members, ${pairs.length} pairs.`,
    otherPairs: pairs
      .slice(1, 3)
      .map((p) => ({ pair: [p.a.userId, p.b.userId] as [string, string], score: p.scores.taste })),
    source,
  };
}
