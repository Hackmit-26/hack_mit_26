import { beforeAll, beforeEach, describe, expect, it } from 'vitest';
import { z } from 'zod';
import { embedText, mockEmbedding, unit } from '../src/ai/embed.js';
import { checkGrounding, fuzzyNameMatch, generatePicks, mentionsItemName } from '../src/ai/giftPicker.js';
import { ingestReceipt, isExcludedItem, normaliseCategory } from '../src/ai/ingest.js';
import { chatJSON, stripFences } from '../src/ai/llm.js';
import { cosine, memberVector, signalItems, tasteTwins } from '../src/ai/taste.js';
import {
  applyVetoes,
  cardMentionsUser,
  containsPriceLanguage,
  findPriceViolations,
  generateWrapped,
} from '../src/ai/wrappedGenerator.js';
import { db, newId, now, resetDb } from '../src/db/index.js';
import type { ItemRow } from '../src/db/types.js';
import { AppError } from '../src/lib/errors.js';
import type { WrappedCards } from '../src/types/api.js';

beforeAll(() => {
  process.env.LLM_MOCK = 'true';
  process.env.EMBED_DIM = '64';
});

const GROUP = 'group-1';

function seedUser(id: string, name: string): void {
  db.users.insert({ id, name, avatarUrl: null, birthday: null, cardLast4: null, visaCardRef: null });
  db.memberships.insert({ groupId: GROUP, userId: id, joinedAt: now() });
}

function seedItem(overrides: Partial<ItemRow> & { ownerId: string; name: string }): ItemRow {
  return db.items.insert({
    id: newId(),
    groupId: GROUP,
    category: 'home',
    merchant: 'Shop',
    imageUrl: null,
    description: null,
    priceCents: 2000,
    purchasedAt: null,
    visibility: 'shared',
    embedding: null,
    createdAt: now(),
    ...overrides,
  });
}

beforeEach(() => {
  resetDb();
  db.groups.insert({
    id: GROUP,
    name: 'Threadcount',
    emoji: '🧵',
    inviteCode: 'ABC123',
    createdAt: now(),
  });
});

describe('llm wrapper', () => {
  it('strips code fences and surrounding chatter', () => {
    expect(stripFences('```json\n{"a":1}\n```')).toBe('{"a":1}');
    expect(stripFences('Sure! {"a":1} hope that helps')).toBe('{"a":1}');
    expect(stripFences('[{"a":1}]')).toBe('[{"a":1}]');
  });

  it('returns the fixture in mock mode without touching the network', async () => {
    const schema = z.object({ hello: z.string() });
    await expect(chatJSON(schema, [{ role: 'user', content: 'hi' }], { mock: () => ({ hello: 'there' }) })).resolves.toEqual(
      { hello: 'there' },
    );
  });

  it('rejects a fixture that does not satisfy the schema', async () => {
    const schema = z.object({ hello: z.string() });
    await expect(
      chatJSON(schema, [{ role: 'user', content: 'hi' }], { mock: () => ({ hello: 42 }) }),
    ).rejects.toMatchObject({ code: 'LLM_ERROR' });
  });
});

describe('embeddings', () => {
  it('is deterministic, unit length and vocabulary-aware', async () => {
    const a = await embedText('ceramic pour over coffee dripper');
    const b = await embedText('ceramic pour over coffee dripper');
    const c = await embedText('ceramic coffee dripper matte');
    const d = await embedText('trail running shoes gore tex');

    expect(a).toEqual(b);
    expect(Math.hypot(...a)).toBeCloseTo(1, 6);
    expect(cosine(a, c)).toBeGreaterThan(cosine(a, d));
  });

  it('normalises to a unit vector', () => {
    expect(Math.hypot(...unit([3, 4]))).toBeCloseTo(1, 10);
    expect(mockEmbedding('x', 8)).toHaveLength(8);
  });
});

describe('no-prices validator', () => {
  it('catches money in every sneaky form', () => {
    for (const text of [
      '$20',
      '50 dollars',
      '20USD',
      '20 USD',
      'about £15',
      'worth €40',
      'that cost 1,299 dollars',
      'USD 30 of pure chaos',
      '99 cents of joy',
      'a pricey little candle',
      'they spent all month on it',
      'the budget for this was wild',
      'suspiciously cheap',
    ]) {
      expect(containsPriceLanguage(text), text).toBe(true);
    }
  });

  it('lets clean copy through', () => {
    for (const text of [
      'Linen, oat milk and one deeply unserious lamp.',
      '3 hearts in under an hour',
      'Two carts, one shared brain cell',
      'Ceramic Pour-Over Dripper energy',
    ]) {
      expect(containsPriceLanguage(text), text).toBe(false);
    }
  });

  it('reports the offending card path', () => {
    const cards = {
      aesthetic: { title: 'Linen Core', blurb: 'Soft and quiet.', moodboardItemIds: [] },
      personas: [{ userId: 'u1', archetype: 'Lamp Person', roast: 'Bought a lamp for $40.', exampleItemIds: [] }],
      findOfTheMonth: { itemId: 'i1', ownerId: null, heartCount: 3, blurb: 'Everyone wanted it.' },
      tasteTwins: { userIds: ['u1', 'u2'], sharedThemes: ['Lamps'], blurb: 'Same brain.', itemIds: [] },
      finds: [],
    } satisfies WrappedCards;

    expect(findPriceViolations(cards)).toEqual(['personas.0.roast']);
    cards.personas[0]!.roast = 'Bought a lamp and told nobody.';
    expect(findPriceViolations(cards)).toEqual([]);
  });
});

describe('taste model', () => {
  it('weights wishlist above heart above bought', async () => {
    seedUser('u1', 'Priya');
    seedUser('u2', 'Sam');

    const wishlisted = seedItem({ ownerId: 'u2', name: 'Alpha Alpha Alpha', description: 'alpha' });
    const hearted = seedItem({ ownerId: 'u2', name: 'Bravo Bravo Bravo', description: 'bravo' });
    const bought = seedItem({ ownerId: 'u1', name: 'Charlie Charlie Charlie', description: 'charlie' });

    db.reactions.insert({ userId: 'u1', itemId: wishlisted.id, type: 'wishlist', createdAt: now() });
    db.reactions.insert({ userId: 'u1', itemId: hearted.id, type: 'heart', createdAt: now() });

    const signals = signalItems('u1', GROUP);
    expect(signals.map((s) => [s.signal, s.weight])).toEqual([
      ['wishlist', 3],
      ['heart', 2],
      ['bought', 1],
    ]);

    const vector = await memberVector('u1', GROUP);
    expect(vector).not.toBeNull();
    const toWishlist = cosine(vector!, await embedText('Alpha Alpha Alpha home Shop alpha'));
    const toHeart = cosine(vector!, await embedText('Bravo Bravo Bravo home Shop bravo'));
    const toBought = cosine(vector!, await embedText('Charlie Charlie Charlie home Shop charlie'));

    expect(toWishlist).toBeGreaterThan(toHeart);
    expect(toHeart).toBeGreaterThan(toBought);
  });

  it('ignores private items', async () => {
    seedUser('u1', 'Priya');
    seedItem({ ownerId: 'u1', name: 'Secret Thing', visibility: 'private' });
    expect(signalItems('u1', GROUP)).toEqual([]);
    await expect(memberVector('u1', GROUP)).resolves.toBeNull();
  });

  it('picks the genuinely closest pair as twins', async () => {
    seedUser('u1', 'Priya');
    seedUser('u2', 'Sam');
    seedUser('u3', 'Noor');

    for (const name of ['Linen Shirt', 'Linen Trousers', 'Linen Scarf']) {
      seedItem({ ownerId: 'u1', name, category: 'clothing', description: 'soft linen' });
    }
    for (const name of ['Linen Robe', 'Linen Apron', 'Linen Napkins']) {
      seedItem({ ownerId: 'u2', name, category: 'clothing', description: 'soft linen' });
    }
    for (const name of ['Carbon Mountain Bike', 'Titanium Bike Pedals', 'Bike Repair Multitool']) {
      seedItem({ ownerId: 'u3', name, category: 'sports_outdoors', description: 'cycling gear' });
    }

    const twins = await tasteTwins(GROUP);
    expect(twins).not.toBeNull();
    expect(twins!.userIds.sort()).toEqual(['u1', 'u2']);
    expect(twins!.itemIds.length).toBeGreaterThan(0);
    expect(twins!.itemIdsByUser['u1']?.length).toBeLessThanOrEqual(5);
  });
});

describe('receipt ingest', () => {
  it('drops pharmacy and health items before storing', async () => {
    seedUser('u1', 'Priya');

    const rows = await ingestReceipt({ ownerId: 'u1', groupId: GROUP, imageUrl: 'https://x.test/r.jpg' });
    const names = rows.map((r) => r.name);

    expect(names).toContain('Oversized Linen Shirt');
    expect(names).not.toContain('Ibuprofen 200mg');
    expect(db.items.all().some((i) => /ibuprofen/i.test(i.name))).toBe(false);
    expect(rows.every((r) => r.visibility === 'private')).toBe(true);
  });

  it('recognises health items by category and by wording', () => {
    expect(isExcludedItem({ name: 'Sertraline 50mg', category: 'pharmacy', description: '' })).toBe(true);
    expect(isExcludedItem({ name: 'Daily Multivitamin', category: 'other', description: 'chewable' })).toBe(true);
    expect(isExcludedItem({ name: 'Cotton Tote', category: 'other', description: 'from the pharmacy counter' })).toBe(true);
    expect(isExcludedItem({ name: 'Linen Shirt', category: 'clothing', description: 'sand coloured' })).toBe(false);
  });

  it('coerces unknown categories to other', () => {
    expect(normaliseCategory('Food Drink')).toBe('food_drink');
    expect(normaliseCategory('vibes')).toBe('other');
  });
});

describe('gift grounding check', () => {
  const signals = [
    { id: 'item-1', name: 'Aesop Resurrection Hand Balm' },
    { id: 'item-2', name: 'Moleskine' },
  ];

  it('accepts a real citation named in the reason', () => {
    expect(
      checkGrounding(
        { reason: 'She saved the Aesop Resurrection Hand Balm, so this is the same energy.', citedItemIds: ['item-1'] },
        signals,
      ),
    ).toEqual({ ok: true, problem: null });
  });

  it('rejects a hallucinated item id', () => {
    const result = checkGrounding(
      { reason: 'She loved the Aesop Resurrection Hand Balm.', citedItemIds: ['item-999'] },
      signals,
    );
    expect(result.ok).toBe(false);
    expect(result.problem).toContain('item-999');
  });

  it('rejects an empty citation list', () => {
    expect(checkGrounding({ reason: 'Trust me.', citedItemIds: [] }, signals).ok).toBe(false);
  });

  it('rejects a reason that never names the cited item', () => {
    const result = checkGrounding({ reason: 'It suits her vibe.', citedItemIds: ['item-2'] }, signals);
    expect(result.ok).toBe(false);
    expect(result.problem).toContain('Moleskine');
  });

  it('rejects a partially mixed citation where one id is invented', () => {
    expect(
      checkGrounding(
        { reason: 'Because of the Moleskine.', citedItemIds: ['item-2', 'item-404'] },
        signals,
      ).ok,
    ).toBe(false);
  });

  it('tolerates a natural shortening of a long item name', () => {
    expect(mentionsItemName('the Aesop hand balm she saved', 'Aesop Resurrection Hand Balm')).toBe(true);
    expect(mentionsItemName('a nice candle', 'Aesop Resurrection Hand Balm')).toBe(false);
  });

  it('fuzzy matches already-owned products', () => {
    expect(fuzzyNameMatch('Oversized Linen Shirt', 'oversized linen shirt')).toBe(true);
    expect(fuzzyNameMatch('Oversized Linen Shirt', 'Carbon Mountain Bike')).toBe(false);
  });
});

describe('gift picks end to end (mock)', () => {
  it('produces grounded picks pinned to the recipient wishlist', async () => {
    seedUser('u1', 'Priya');
    seedUser('u2', 'Sam');

    const wishlisted = seedItem({ ownerId: 'u2', name: 'Hasami Porcelain Mug', category: 'kitchen', priceCents: 3200 });
    const hearted = seedItem({ ownerId: 'u2', name: 'Cast Iron Skillet', category: 'kitchen', priceCents: 4500 });
    seedItem({ ownerId: 'u1', name: 'Chemex Filters', category: 'kitchen', priceCents: 1200 });

    db.reactions.insert({ userId: 'u1', itemId: wishlisted.id, type: 'wishlist', createdAt: now() });
    db.reactions.insert({ userId: 'u1', itemId: hearted.id, type: 'heart', createdAt: now() });

    const threadId = newId();
    db.giftThreads.insert({
      id: threadId,
      groupId: GROUP,
      recipientId: 'u1',
      organiserId: 'u2',
      state: 'picking',
      budgetMinCents: 1000,
      budgetMaxCents: 6000,
      deadline: now(),
      winningPickId: null,
      pushTxnId: null,
      pushStatus: null,
      revealAt: null,
      regenerations: 0,
      createdAt: now(),
    });

    const picks = await generatePicks(threadId);
    expect(picks.length).toBeGreaterThan(0);
    expect(picks[0]?.productName).toBe('Hasami Porcelain Mug');

    const signalRefs = signalItems('u1', GROUP).map((s) => ({ id: s.item.id, name: s.item.name }));
    for (const pick of picks) {
      expect(checkGrounding(pick, signalRefs)).toEqual({ ok: true, problem: null });
      expect(containsPriceLanguage(pick.reason)).toBe(false);
    }
    expect(db.giftPicks.all()).toHaveLength(picks.length);
  });

  it('never gifts something the recipient already owns', async () => {
    seedUser('u1', 'Priya');
    seedUser('u2', 'Sam');
    seedItem({ ownerId: 'u1', name: 'Hasami Porcelain Mug', category: 'kitchen', priceCents: 3200 });

    const threadId = newId();
    db.giftThreads.insert({
      id: threadId,
      groupId: GROUP,
      recipientId: 'u1',
      organiserId: 'u2',
      state: 'picking',
      budgetMinCents: 1000,
      budgetMaxCents: 6000,
      deadline: now(),
      winningPickId: null,
      pushTxnId: null,
      pushStatus: null,
      revealAt: null,
      regenerations: 0,
      createdAt: now(),
    });

    // An owned item is a taste signal, never a candidate (§1 signal table): the picks come
    // from the catalogue instead, and none of them may be the mug she already has.
    const picks = await generatePicks(threadId);
    expect(picks.length).toBeGreaterThan(0);
    for (const pick of picks) {
      expect(pick.productName).not.toBe('Hasami Porcelain Mug');
    }
  });
});

describe('wrapped generator', () => {
  const seedWrappedGroup = (): void => {
    seedUser('u1', 'Priya');
    seedUser('u2', 'Sam');
    seedUser('u3', 'Noor');

    const catalogue: Record<string, string[]> = {
      u1: ['Linen Shirt', 'Linen Trousers', 'Rattan Pendant Lamp', 'Ceramic Vase', 'Woven Basket'],
      u2: ['Linen Robe', 'Stoneware Mug', 'Beeswax Candle', 'Cast Iron Skillet', 'Wool Throw'],
      u3: ['Trail Running Shoes', 'Bike Multitool', 'Down Sleeping Bag', 'Climbing Chalk', 'Steel Flask'],
    };
    for (const [ownerId, names] of Object.entries(catalogue)) {
      for (const name of names) seedItem({ ownerId, name, description: name.toLowerCase() });
    }
  };

  it('throws NOT_ENOUGH_DATA below 3 members with 5 shared items each', async () => {
    seedUser('u1', 'Priya');
    seedUser('u2', 'Sam');
    for (let i = 0; i < 5; i += 1) seedItem({ ownerId: 'u1', name: `Thing ${i}` });
    for (let i = 0; i < 5; i += 1) seedItem({ ownerId: 'u2', name: `Other ${i}` });

    await expect(generateWrapped(GROUP)).rejects.toBeInstanceOf(AppError);
    await expect(generateWrapped(GROUP)).rejects.toMatchObject({ code: 'NOT_ENOUGH_DATA', httpStatus: 422 });
  });

  it('does not count private items towards the precondition', async () => {
    seedUser('u1', 'Priya');
    seedUser('u2', 'Sam');
    seedUser('u3', 'Noor');
    for (const owner of ['u1', 'u2']) {
      for (let i = 0; i < 5; i += 1) seedItem({ ownerId: owner, name: `${owner} thing ${i}` });
    }
    for (let i = 0; i < 5; i += 1) {
      seedItem({ ownerId: 'u3', name: `hidden ${i}`, visibility: 'private' });
    }

    await expect(generateWrapped(GROUP)).rejects.toMatchObject({ code: 'NOT_ENOUGH_DATA' });
  });

  it('builds price-free, grounded cards', async () => {
    seedWrappedGroup();
    const hot = db.items.all().find((i) => i.name === 'Rattan Pendant Lamp')!;
    db.reactions.insert({ userId: 'u2', itemId: hot.id, type: 'heart', createdAt: now() });
    db.reactions.insert({ userId: 'u3', itemId: hot.id, type: 'heart', createdAt: now() });

    const { wrappedId, cards } = await generateWrapped(GROUP);

    expect(findPriceViolations(cards)).toEqual([]);
    expect(cards.findOfTheMonth.itemId).toBe(hot.id);
    expect(cards.findOfTheMonth.heartCount).toBe(2);
    expect(cards.findOfTheMonth.ownerId).toBe('u1');
    expect(cards.personas).toHaveLength(3);
    expect(cards.aesthetic.moodboardItemIds.length).toBeGreaterThanOrEqual(6);
    expect(new Set(cards.aesthetic.moodboardItemIds).size).toBe(cards.aesthetic.moodboardItemIds.length);
    expect(cards.tasteTwins.userIds).toHaveLength(2);
    expect(cards.finds).toHaveLength(15);
    expect(db.wrapped.find((w) => w.id === wrappedId)).toBeTruthy();

    // Every referenced id is a real shared item in this group.
    const shared = new Set(db.items.all().map((i) => i.id));
    for (const id of [...cards.aesthetic.moodboardItemIds, ...cards.tasteTwins.itemIds]) {
      expect(shared.has(id)).toBe(true);
    }
  });

  it('hides the owner of an anonymous find', async () => {
    seedWrappedGroup();
    const hot = db.items.all().find((i) => i.name === 'Beeswax Candle')!;
    hot.visibility = 'anonymous';
    db.reactions.insert({ userId: 'u1', itemId: hot.id, type: 'heart', createdAt: now() });

    const { cards } = await generateWrapped(GROUP);
    expect(cards.findOfTheMonth.itemId).toBe(hot.id);
    expect(cards.findOfTheMonth.ownerId).toBeNull();
  });

  it('vetoes only cards that mention the vetoing user', async () => {
    seedWrappedGroup();
    const { cards } = await generateWrapped(GROUP);

    expect(cardMentionsUser(cards, 'personas', 'u1')).toBe(true);
    expect(cardMentionsUser(cards, 'tasteTwins', 'u3')).toBe(cards.tasteTwins.userIds.includes('u3'));
    expect(cardMentionsUser(cards, 'findOfTheMonth', 'nobody')).toBe(false);

    const vetoed = applyVetoes(cards, [
      { userId: 'u1', cardKey: 'personas' },
      { userId: 'nobody', cardKey: 'findOfTheMonth' },
    ]);
    expect(vetoed.personas?.map((p) => p.userId)).toEqual(['u2', 'u3']);
    expect(vetoed.findOfTheMonth).toBeDefined();

    const owner = db.items.all().find((i) => i.id === cards.findOfTheMonth.itemId)!.ownerId;
    expect(applyVetoes(cards, [{ userId: owner, cardKey: 'findOfTheMonth' }]).findOfTheMonth).toBeUndefined();
  });
});
