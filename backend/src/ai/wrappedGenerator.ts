import { db, newId, now } from '../db/index.js';
import type { ItemRow } from '../db/types.js';
import { groupMemberIds } from '../domain/permissions.js';
import { AppError } from '../lib/errors.js';
import { logger } from '../lib/logger.js';
import type { WrappedCardKey, WrappedCards } from '../types/api.js';
import { chatJSON } from './llm.js';
import {
  wrappedCopyPrompt,
  wrappedCopySchema,
  type WrappedCopy,
  type WrappedFacts,
} from './prompts/wrappedCopy.js';
import { groupSharedItems, largestCluster, tasteTwins } from './taste.js';

const MIN_MEMBERS = 3;
const MIN_ITEMS_PER_MEMBER = 5;
const COPY_VARIANTS = 3;
const MAX_COPY_ROUNDS = 3;

/* -------------------------------------------------------------------------- */
/* No prices, anywhere (§1 rule 2, §8.4)                                       */
/* -------------------------------------------------------------------------- */

const CURRENCY_SYMBOL = /[$€£¥₹¢₩]/;
const NUMBER_THEN_MONEY = /\d[\d.,]*\s*(?:usd|dollars?|bucks|eur|euros?|gbp|pounds?|cents?|quid)\b/i;
const MONEY_THEN_NUMBER = /\b(?:usd|dollars?|eur|euros?|gbp|cents?)\s*\.?\s*\d/i;
const MONEY_WORD =
  /\b(?:usd|dollars?|bucks|quid|prices?|priced|pricey|spent|spends?|spending|paid|costs?|costly|budgets?|expensive|cheap|afford(?:able)?|discount(?:ed)?|bargain|receipts? total|total spend)\b/i;

/**
 * True if a string leaks money in any form: a currency symbol, a number next to a currency
 * word, or plain money talk. Deliberately trigger-happy — a false positive costs one
 * regeneration, a false negative puts a price on the demo screen.
 */
export function containsPriceLanguage(text: string): boolean {
  return (
    CURRENCY_SYMBOL.test(text) ||
    NUMBER_THEN_MONEY.test(text) ||
    MONEY_THEN_NUMBER.test(text) ||
    MONEY_WORD.test(text)
  );
}

/** Every human-readable string in the cards, with a path so a failure is debuggable. */
export function copyFields(cards: WrappedCards): { path: string; text: string }[] {
  const fields: { path: string; text: string }[] = [
    { path: 'aesthetic.title', text: cards.aesthetic.title },
    { path: 'aesthetic.blurb', text: cards.aesthetic.blurb },
    { path: 'findOfTheMonth.blurb', text: cards.findOfTheMonth.blurb },
    { path: 'tasteTwins.blurb', text: cards.tasteTwins.blurb },
  ];
  cards.tasteTwins.sharedThemes.forEach((theme, index) =>
    fields.push({ path: `tasteTwins.sharedThemes.${index}`, text: theme }),
  );
  cards.personas.forEach((persona, index) => {
    fields.push({ path: `personas.${index}.archetype`, text: persona.archetype });
    fields.push({ path: `personas.${index}.roast`, text: persona.roast });
  });
  return fields;
}

/** Returns the paths of copy fields that mention money. Empty means the cards are safe to ship. */
export function findPriceViolations(cards: WrappedCards): string[] {
  return copyFields(cards)
    .filter((field) => containsPriceLanguage(field.text))
    .map((field) => field.path);
}

function copyHasPrices(copy: WrappedCopy): boolean {
  const texts = [
    copy.aesthetic.title,
    copy.aesthetic.blurb,
    copy.findOfTheMonth.blurb,
    copy.tasteTwins.blurb,
    ...copy.tasteTwins.sharedThemes,
    ...copy.personas.flatMap((p) => [p.archetype, p.roast]),
  ];
  return texts.some(containsPriceLanguage);
}

/* -------------------------------------------------------------------------- */
/* Deterministic data                                                          */
/* -------------------------------------------------------------------------- */

export type WrappedData = {
  groupName: string;
  heartCounts: Map<string, number>;
  sharedItems: ItemRow[];
  members: { userId: string; name: string; items: ItemRow[] }[];
  clusterItems: ItemRow[];
  find: { item: ItemRow; heartCount: number; ownerId: string | null };
  twins: { userIds: [string, string]; itemIds: string[] };
};

const userName = (userId: string): string =>
  db.users.find((u) => u.id === userId)?.name ?? 'A friend';

function heartCounts(items: ItemRow[]): Map<string, number> {
  const counts = new Map<string, number>();
  for (const item of items) {
    counts.set(item.id, db.reactions.filter((r) => r.itemId === item.id && r.type === 'heart').length);
  }
  return counts;
}

function topCategories(items: ItemRow[]): string[] {
  const counts = new Map<string, number>();
  for (const item of items) counts.set(item.category, (counts.get(item.category) ?? 0) + 1);
  return [...counts.entries()]
    .sort((a, b) => b[1] - a[1] || a[0].localeCompare(b[0]))
    .slice(0, 3)
    .map(([category]) => category);
}

export async function collectWrappedData(groupId: string): Promise<WrappedData> {
  const group = db.groups.find((g) => g.id === groupId);
  if (!group) throw new AppError('NOT_FOUND', 404, 'Group not found');

  const sharedItems = groupSharedItems(groupId);
  const counts = heartCounts(sharedItems);

  const members = groupMemberIds(groupId)
    .map((userId) => ({
      userId,
      name: userName(userId),
      items: sharedItems.filter((item) => item.ownerId === userId),
    }))
    .filter((member) => member.items.length > 0);

  const qualifying = members.filter((m) => m.items.length >= MIN_ITEMS_PER_MEMBER);
  if (qualifying.length < MIN_MEMBERS) {
    throw new AppError(
      'NOT_ENOUGH_DATA',
      422,
      `Wrapped needs ${MIN_MEMBERS} members with ${MIN_ITEMS_PER_MEMBER} shared items each; ${qualifying.length} so far`,
    );
  }

  const byHeat = (a: ItemRow, b: ItemRow): number =>
    (counts.get(b.id) ?? 0) - (counts.get(a.id) ?? 0) ||
    a.createdAt.localeCompare(b.createdAt) ||
    a.id.localeCompare(b.id);

  const hottest = [...sharedItems].sort(byHeat)[0];
  if (!hottest) throw new AppError('NOT_ENOUGH_DATA', 422, 'This group has no shared items yet');

  const cluster = await largestCluster(groupId);
  const twins = await tasteTwins(groupId);
  if (!twins) throw new AppError('NOT_ENOUGH_DATA', 422, 'Not enough taste signal for twins');

  return {
    groupName: group.name,
    heartCounts: counts,
    sharedItems: [...sharedItems].sort(byHeat),
    members: members.map((m) => ({ ...m, items: [...m.items].sort(byHeat) })),
    clusterItems: (cluster?.items ?? sharedItems).slice().sort(byHeat),
    find: {
      item: hottest,
      heartCount: counts.get(hottest.id) ?? 0,
      // §1 rule 3: an anonymous find never names its owner, which is why ownerId is nullable.
      ownerId: hottest.visibility === 'anonymous' ? null : hottest.ownerId,
    },
    twins: { userIds: twins.userIds, itemIds: twins.itemIds },
  };
}

function toFacts(data: WrappedData): WrappedFacts {
  const name = (id: string): string => data.members.find((m) => m.userId === id)?.name ?? userName(id);
  const itemName = (id: string): string => data.sharedItems.find((i) => i.id === id)?.name ?? '';

  return {
    groupName: data.groupName,
    members: data.members.map((member) => ({
      userId: member.userId,
      name: member.name,
      itemNames: member.items.slice(0, 8).map((i) => i.name),
      topCategories: topCategories(member.items),
    })),
    clusterItemNames: data.clusterItems.slice(0, 8).map((i) => i.name),
    findOfTheMonth: {
      itemName: data.find.item.name,
      ownerName: data.find.ownerId ? name(data.find.ownerId) : null,
      heartCount: data.find.heartCount,
    },
    twins: {
      names: [name(data.twins.userIds[0]), name(data.twins.userIds[1])],
      userIds: data.twins.userIds,
      itemNames: data.twins.itemIds.map(itemName).filter(Boolean),
    },
  };
}

/* -------------------------------------------------------------------------- */
/* Copy                                                                        */
/* -------------------------------------------------------------------------- */

const titleCase = (value: string): string =>
  value
    .replace(/_/g, ' ')
    .split(' ')
    .map((word) => (word ? word[0]?.toUpperCase() + word.slice(1) : word))
    .join(' ');

/**
 * Offline copy. Doubles as the LLM_MOCK fixture and as the last-resort fallback when the model
 * keeps smuggling prices in — it is built from real item names, so it is always grounded and
 * always price-free.
 */
export function templateCopy(facts: WrappedFacts, variant = 0): WrappedCopy {
  const cluster = facts.clusterItemNames;
  const first = cluster[0] ?? facts.findOfTheMonth.itemName;
  const second = cluster[1] ?? facts.findOfTheMonth.itemName;
  const themeWords = facts.members.flatMap((m) => m.topCategories);
  const themes = [...new Set(themeWords)].slice(0, 3).map(titleCase);

  const titles = [
    `${titleCase(themes[0] ?? 'Quietly Unhinged')} Core`,
    `The ${titleCase(themes[0] ?? 'Group')} Committee`,
    `Soft Launch ${titleCase(themes[1] ?? 'Era')}`,
  ];

  return {
    aesthetic: {
      title: titles[variant % titles.length] ?? titles[0] ?? 'Group Core',
      blurb: `${facts.groupName} keeps circling "${first}" and "${second}". Nobody has admitted there is a theme, but the moodboard filled itself in.`,
    },
    personas: facts.members.map((member) => {
      const example = member.itemNames[variant % Math.max(member.itemNames.length, 1)] ?? member.itemNames[0] ?? first;
      return {
        userId: member.userId,
        archetype: `${titleCase(member.topCategories[0] ?? 'Chaos')} Loyalist`,
        roast: `${member.name} saw "${example}" and decided that was the whole personality now. It is working, annoyingly.`,
      };
    }),
    findOfTheMonth: {
      blurb: `"${facts.findOfTheMonth.itemName}" collected ${facts.findOfTheMonth.heartCount} hearts before anyone could pretend to be casual about it.`,
    },
    tasteTwins: {
      sharedThemes: themes.length > 0 ? themes : ['Same Brain'],
      blurb: `${facts.twins.names[0]} and ${facts.twins.names[1]} both gravitate to "${facts.twins.itemNames[0] ?? first}". Two carts, one shared brain cell.`,
    },
  };
}

/** How many real item names the copy actually says out loud (§8.4 variant heuristic). */
export function specificityScore(copy: WrappedCopy, itemNames: string[]): number {
  const haystack = [
    copy.aesthetic.title,
    copy.aesthetic.blurb,
    copy.findOfTheMonth.blurb,
    copy.tasteTwins.blurb,
    ...copy.tasteTwins.sharedThemes,
    ...copy.personas.flatMap((p) => [p.archetype, p.roast]),
  ]
    .join(' ')
    .toLowerCase();

  return itemNames.filter((name) => name.length > 2 && haystack.includes(name.toLowerCase())).length;
}

async function generateCopy(data: WrappedData, facts: WrappedFacts): Promise<WrappedCopy> {
  const itemNames = data.sharedItems.map((item) => item.name);

  for (let round = 0; round < MAX_COPY_ROUNDS; round += 1) {
    const clean: WrappedCopy[] = [];
    for (let variant = 0; variant < COPY_VARIANTS; variant += 1) {
      const index = round * COPY_VARIANTS + variant;
      try {
        const copy = await chatJSON(wrappedCopySchema, wrappedCopyPrompt(facts, index), {
          label: `wrapped.copy.v${index}`,
          model: process.env.LLM_MODEL_COPY?.trim() || 'claude-opus-4-6',
          temperature: 0.9,
          maxTokens: 1500,
          mock: () => templateCopy(facts, index),
        });
        if (copyHasPrices(copy)) {
          logger.warn('wrapped.copy_rejected_prices', { variant: index });
          continue;
        }
        clean.push(copy);
      } catch (error) {
        logger.warn('wrapped.copy_failed', { variant: index, error: (error as Error).message });
      }
    }

    const best = clean.sort(
      (a, b) => specificityScore(b, itemNames) - specificityScore(a, itemNames),
    )[0];
    if (best) return best;
  }

  logger.warn('wrapped.copy_fallback_template', {});
  return templateCopy(facts, 0);
}

/* -------------------------------------------------------------------------- */
/* Assembly                                                                    */
/* -------------------------------------------------------------------------- */

function assemble(data: WrappedData, copy: WrappedCopy, facts: WrappedFacts): WrappedCards {
  const moodboard = [
    ...data.clusterItems.map((item) => item.id),
    ...data.sharedItems.map((item) => item.id),
  ];
  const moodboardItemIds = [...new Set(moodboard)].slice(0, 9);

  const byUser = new Map(copy.personas.map((persona) => [persona.userId, persona]));
  const fallback = templateCopy(facts, 0);

  const personas = data.members.map((member) => {
    const written =
      byUser.get(member.userId) ?? fallback.personas.find((p) => p.userId === member.userId);
    return {
      userId: member.userId,
      archetype: written?.archetype ?? 'Quiet Collector',
      roast: written?.roast ?? `${member.name} has a type and "${member.items[0]?.name ?? 'it'}" is it.`,
      exampleItemIds: member.items.slice(0, 3).map((item) => item.id),
    };
  });

  return {
    aesthetic: {
      title: copy.aesthetic.title,
      blurb: copy.aesthetic.blurb,
      moodboardItemIds,
    },
    personas,
    findOfTheMonth: {
      itemId: data.find.item.id,
      ownerId: data.find.ownerId,
      heartCount: data.find.heartCount,
      blurb: copy.findOfTheMonth.blurb,
    },
    tasteTwins: {
      userIds: data.twins.userIds,
      sharedThemes: copy.tasteTwins.sharedThemes,
      blurb: copy.tasteTwins.blurb,
      itemIds: data.twins.itemIds,
    },
    finds: data.sharedItems.map((item) => ({ itemId: item.id })),
  };
}

/* -------------------------------------------------------------------------- */
/* Vetoes (§8.4)                                                               */
/* -------------------------------------------------------------------------- */

export const WRAPPED_CARD_KEYS = [
  'aesthetic',
  'personas',
  'findOfTheMonth',
  'tasteTwins',
  'finds',
] as const;

/** The true owner, including for anonymous items - they still get to veto their own card. */
const ownersOf = (itemIds: string[]): string[] =>
  itemIds
    .map((id) => db.items.find((item) => item.id === id)?.ownerId)
    .filter((ownerId): ownerId is string => Boolean(ownerId));

export function cardMentionsUser(
  cards: WrappedCards,
  cardKey: WrappedCardKey,
  userId: string,
): boolean {
  switch (cardKey) {
    case 'aesthetic':
      return ownersOf(cards.aesthetic.moodboardItemIds).includes(userId);
    case 'personas':
      return cards.personas.some((persona) => persona.userId === userId);
    case 'findOfTheMonth':
      return ownersOf([cards.findOfTheMonth.itemId]).includes(userId);
    case 'tasteTwins':
      return cards.tasteTwins.userIds.includes(userId);
    case 'finds':
      return ownersOf(cards.finds.map((find) => find.itemId)).includes(userId);
    default:
      return false;
  }
}

/**
 * A veto only bites for someone the card actually mentions. Vetoing "personas" removes just
 * that member's persona; every other card is dropped whole.
 */
export function applyVetoes(
  cards: WrappedCards,
  vetoes: { userId: string; cardKey: string }[],
): Partial<WrappedCards> {
  const result: Partial<WrappedCards> = { ...cards };

  for (const veto of vetoes) {
    const key = veto.cardKey as WrappedCardKey;
    if (!WRAPPED_CARD_KEYS.includes(key)) continue;
    if (!cardMentionsUser(cards, key, veto.userId)) continue;

    if (key === 'personas') {
      const kept = (result.personas ?? cards.personas).filter((p) => p.userId !== veto.userId);
      if (kept.length === 0) delete result.personas;
      else result.personas = kept;
      continue;
    }
    delete result[key];
  }

  return result;
}

export async function generateWrapped(
  groupId: string,
): Promise<{ wrappedId: string; cards: WrappedCards }> {
  const data = await collectWrappedData(groupId);
  const facts = toFacts(data);
  const copy = await generateCopy(data, facts);

  let cards = assemble(data, copy, facts);
  const violations = findPriceViolations(cards);
  if (violations.length > 0) {
    // Belt and braces: the per-variant filter should have caught this already.
    logger.warn('wrapped.price_violation_fallback', { violations });
    cards = assemble(data, templateCopy(facts, 0), facts);
    const remaining = findPriceViolations(cards);
    if (remaining.length > 0) {
      throw new AppError('LLM_ERROR', 502, `Wrapped copy kept mentioning prices: ${remaining.join(', ')}`);
    }
  }

  const wrappedId = newId();
  db.wrapped.insert({ id: wrappedId, groupId, cardsJson: cards, createdAt: now() });
  logger.info('wrapped.generated', { groupId, wrappedId, items: data.sharedItems.length });

  return { wrappedId, cards };
}
