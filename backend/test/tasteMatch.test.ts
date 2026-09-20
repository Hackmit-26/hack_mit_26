import type { FastifyInstance } from 'fastify';
import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import {
  generateTasteMatch,
  priceHistogram,
  templateCopy,
  weekdayHistogram,
  type TasteMatchResult,
} from '../src/ai/tasteMatch.js';
import { db, newId, now, resetDb } from '../src/db/index.js';
import type { ItemRow, UserRow, Visibility } from '../src/db/types.js';
import { buildServer } from '../src/server.js';

let app: FastifyInstance;

const auth = (userId: string) => ({ authorization: `Bearer dev:${userId}` });

function user(name: string): UserRow {
  return db.users.insert({
    id: newId(),
    name,
    avatarUrl: null,
    birthday: null,
    cardLast4: null,
    visaCardRef: null,
  });
}

function group(name = 'Crew'): string {
  const id = newId();
  db.groups.insert({ id, name, emoji: '🛍️', inviteCode: 'ABC234', createdAt: now() });
  return id;
}

const member = (groupId: string, userId: string): void => {
  db.memberships.insert({ groupId, userId, joinedAt: now() });
};

function item(
  ownerId: string,
  groupId: string,
  name: string,
  overrides: Partial<ItemRow> = {},
): ItemRow {
  return db.items.insert({
    id: newId(),
    ownerId,
    groupId,
    name,
    category: 'clothing',
    merchant: 'Uniqlo',
    imageUrl: null,
    description: null,
    priceCents: 4500,
    purchasedAt: '2026-09-01',
    visibility: 'shared' as Visibility,
    embedding: null,
    createdAt: now(),
    ...overrides,
  });
}

/** Two members with enough signal to score. */
function seedPair(): { groupId: string; a: UserRow; b: UserRow } {
  const groupId = group();
  const a = user('Ada');
  const b = user('Grace');
  member(groupId, a.id);
  member(groupId, b.id);

  for (let i = 0; i < 4; i += 1) {
    item(a.id, groupId, `Ada silver ring ${i}`, { category: 'accessories', priceCents: 3000 });
    item(b.id, groupId, `Grace silver cuff ${i}`, { category: 'accessories', priceCents: 3200 });
  }
  return { groupId, a, b };
}

beforeEach(async () => {
  resetDb();
  app = await buildServer();
});

afterEach(async () => {
  await app.close();
});

describe('score maths', () => {
  it('buckets prices into bands rather than exposing figures', () => {
    const groupId = group();
    const owner = user('Ada');
    const items = [
      item(owner.id, groupId, 'sticker', { priceCents: 200 }),
      item(owner.id, groupId, 'mug', { priceCents: 1200 }),
      item(owner.id, groupId, 'coat', { priceCents: 30000 }),
      item(owner.id, groupId, 'unknown', { priceCents: null }),
    ];

    // bands: <500, <1500, <4000, <10000, <25000, rest
    expect(priceHistogram(items)).toEqual([1, 1, 0, 0, 0, 1]);
  });

  it('reads the week from purchasedAt, falling back to createdAt', () => {
    const groupId = group();
    const owner = user('Ada');
    // 2026-09-01 is a Tuesday; 2026-09-05 is a Saturday.
    const items = [
      item(owner.id, groupId, 'a', { purchasedAt: '2026-09-01' }),
      item(owner.id, groupId, 'b', { purchasedAt: '2026-09-01' }),
      item(owner.id, groupId, 'c', { purchasedAt: '2026-09-05' }),
    ];

    const bins = weekdayHistogram(items);
    expect(bins[2]).toBe(2); // Tuesday
    expect(bins[6]).toBe(1); // Saturday
  });

  it('scores identical shoppers higher than opposite ones', async () => {
    const groupId = group();
    const a = user('Ada');
    const b = user('Grace');
    const c = user('Hedy');
    [a, b, c].forEach((u) => member(groupId, u.id));

    // Ada and Grace buy the same band on the same day; Hedy does neither.
    for (let i = 0; i < 4; i += 1) {
      item(a.id, groupId, `ring ${i}`, { priceCents: 3000, purchasedAt: '2026-09-01' });
      item(b.id, groupId, `cuff ${i}`, { priceCents: 3200, purchasedAt: '2026-09-01' });
      item(c.id, groupId, `sofa ${i}`, { priceCents: 90000, purchasedAt: '2026-09-05' });
    }

    const result = await generateTasteMatch(groupId);
    expect(result.budgetScore).toBe(100);
    expect(result.timingScore).toBe(100);
    // Hedy's pairings are strictly worse on budget, so she is not the winning pair.
    expect(result.pair).not.toContain(c.id);
  });
});

describe('GET /groups/:id/taste-match', () => {
  it('returns computed scores and grounded copy for a member', async () => {
    const { groupId, a, b } = seedPair();

    const res = await app.inject({
      method: 'GET',
      url: `/groups/${groupId}/taste-match`,
      headers: auth(a.id),
    });

    expect(res.statusCode).toBe(200);
    const body = res.json<TasteMatchResult>();

    expect(body.pair.sort()).toEqual([a.id, b.id].sort());
    for (const score of [body.tasteScore, body.budgetScore, body.timingScore]) {
      expect(score).toBeGreaterThanOrEqual(0);
      expect(score).toBeLessThanOrEqual(100);
      expect(Number.isInteger(score)).toBe(true);
    }
    expect(body.lead.length).toBeGreaterThan(0);
    expect(body.sharedTags.length).toBeGreaterThanOrEqual(2);
    expect(body.disagreement).toHaveLength(2);
    expect(body.disagreement.map((d) => d.userId).sort()).toEqual([a.id, b.id].sort());
  });

  it('never puts a price on the card', async () => {
    const { groupId, a } = seedPair();

    const res = await app.inject({
      method: 'GET',
      url: `/groups/${groupId}/taste-match`,
      headers: auth(a.id),
    });

    const body = res.json<TasteMatchResult>();
    const copy = [
      body.lead,
      body.notes.taste,
      body.notes.budget,
      body.notes.timing,
      ...body.sharedTags,
      ...body.disagreement.map((d) => d.text),
    ].join(' ');

    expect(copy).not.toMatch(/[$£€¥]/);
    expect(copy).not.toMatch(/\b(price|priced|cheap|expensive|spent|cost|budget)\b/i);
  });

  it('refuses a non-member', async () => {
    const { groupId } = seedPair();
    const outsider = user('Mallory');

    const res = await app.inject({
      method: 'GET',
      url: `/groups/${groupId}/taste-match`,
      headers: auth(outsider.id),
    });

    expect(res.statusCode).toBe(403);
  });

  it('422s a group with too little signal to compare', async () => {
    const groupId = group();
    const lonely = user('Ada');
    member(groupId, lonely.id);
    item(lonely.id, groupId, 'one thing');

    const res = await app.inject({
      method: 'GET',
      url: `/groups/${groupId}/taste-match`,
      headers: auth(lonely.id),
    });

    expect(res.statusCode).toBe(422);
  });
});

describe('template fallback', () => {
  it('is price-free and names real items', () => {
    const copy = templateCopy({
      scores: { taste: 80, budget: 70, timing: 60 },
      sharedCategories: ['accessories'],
      sharedItemNames: ['Silver signet ring'],
      members: [
        {
          userId: 'a',
          name: 'Ada',
          topCategories: ['accessories'],
          itemNames: ['Silver signet ring'],
          topMerchant: 'Mejuri',
          topMerchantCount: 3,
          merchantVariety: 5,
          itemCount: 8,
          peakDay: 'Saturday',
          spendShape: 'considered',
        },
        {
          userId: 'b',
          name: 'Grace',
          topCategories: ['accessories'],
          itemNames: ['Silver cuff'],
          topMerchant: 'Sephora',
          topMerchantCount: 4,
          merchantVariety: 2,
          itemCount: 7,
          peakDay: 'Saturday',
          spendShape: 'considered',
        },
      ],
    });

    expect(copy.lead).toContain('Silver signet ring');
    expect(copy.disagreements.map((d) => d.userId)).toEqual(['a', 'b']);
    expect(JSON.stringify(copy)).not.toMatch(/[$£€¥]/);
  });
});
