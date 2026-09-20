import Fastify, { type FastifyInstance } from 'fastify';
import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import { db, resetDb } from '../src/db/index.js';
import {
  DEMO_BIRTHDAY_THREAD_ID,
  DEMO_GROUP_ID,
  DEMO_RECIPIENT_ID,
  DEMO_REVERSAL_THREAD_ID,
  DEMO_STAR_ITEM_ID,
  DEMO_USER_IDS,
  deadlineForBirthday,
  seedDemoData,
  seedDemoThreads,
} from '../src/db/seed.js';
import { AppError } from '../src/lib/errors.js';
import {
  MAX_RESULTS,
  loadCatalogue,
  productSchema,
  searchCatalogue,
} from '../src/products/catalogue.js';
import { linkPreview } from '../src/products/linkPreview.js';
import demoRoutes from '../src/routes/demo.js';

const CATEGORIES = [
  'clothing',
  'shoes',
  'accessories',
  'beauty',
  'home',
  'kitchen',
  'books',
  'music',
  'tech',
  'games',
  'stationery',
  'food_drink',
  'sports_outdoors',
  'art_crafts',
];

describe('catalogue', () => {
  it('loads a catalogue where every product matches the Product shape', () => {
    const products = loadCatalogue();
    expect(products.length).toBeGreaterThanOrEqual(140);
    for (const product of products) {
      expect(() => productSchema.parse(product)).not.toThrow();
    }
  });

  it('has unique ids, integer cents and a spread of categories and price points', () => {
    const products = loadCatalogue();
    expect(new Set(products.map((p) => p.id)).size).toBe(products.length);

    for (const category of CATEGORIES) {
      expect(products.filter((p) => p.category === category).length).toBeGreaterThanOrEqual(5);
    }

    const prices = products.map((p) => p.priceCents);
    expect(prices.every(Number.isInteger)).toBe(true);
    expect(Math.min(...prices)).toBeLessThanOrEqual(2000);
    expect(Math.max(...prices)).toBeGreaterThanOrEqual(35_000);
  });

  it('caches the parsed catalogue rather than re-reading it', () => {
    expect(loadCatalogue()).toBe(loadCatalogue());
  });
});

describe('searchCatalogue', () => {
  const wideBudget = { minCents: 0, maxCents: 100_000 };

  it('excludes everything outside the budget', () => {
    const budget = { minCents: 15_000, maxCents: 36_000 };
    const results = searchCatalogue(['camera'], budget);

    expect(results.length).toBeGreaterThan(0);
    for (const product of results) {
      expect(product.priceCents).toBeGreaterThanOrEqual(budget.minCents);
      expect(product.priceCents).toBeLessThanOrEqual(budget.maxCents);
    }

    const cheapest = Math.min(...loadCatalogue().map((p) => p.priceCents));
    expect(results.some((p) => p.priceCents === cheapest)).toBe(false);
  });

  it('ranks the obviously matching product first', () => {
    const sx70 = searchCatalogue(
      ['refurbished polaroid sx-70 instant film camera'],
      { minCents: 15_000, maxCents: 36_000 },
    );
    expect(sx70[0]?.name).toContain('SX-70');

    const skillet = searchCatalogue(['pre-seasoned cast iron skillet'], {
      minCents: 1000,
      maxCents: 10_000,
    });
    expect(skillet[0]?.name).toBe('Cast Iron Skillet 10 Inch');

    const shoe = searchCatalogue(['carbon plate marathon racing shoes for a runner'], wideBudget);
    expect(shoe[0]?.name).toContain('Velo 3');
  });

  it('returns a full shortlist of 20-30 candidates and is deterministic', () => {
    const budget = { minCents: 2000, maxCents: 40_000 };
    const first = searchCatalogue(['sourdough baking', 'ceramics'], budget);

    expect(first.length).toBe(MAX_RESULTS);
    expect(first.length).toBeGreaterThanOrEqual(20);
    expect(searchCatalogue(['sourdough baking', 'ceramics'], budget).map((p) => p.id)).toEqual(
      first.map((p) => p.id),
    );
  });

  it('returns nothing when no product fits the budget', () => {
    expect(searchCatalogue(['camera'], { minCents: 1, maxCents: 100 })).toEqual([]);
  });
});

describe('seedDemoData', () => {
  beforeEach(() => resetDb());

  it('creates the demo group, users, memberships, items and reactions', () => {
    seedDemoData();

    expect(db.users.all().map((u) => u.id).sort()).toEqual(
      [DEMO_USER_IDS.leo, DEMO_USER_IDS.maya, DEMO_USER_IDS.priya, DEMO_USER_IDS.sam].sort(),
    );
    expect(db.groups.all()).toHaveLength(1);
    expect(db.groups.all()[0]?.id).toBe(DEMO_GROUP_ID);
    expect(db.memberships.all()).toHaveLength(4);
    expect(db.items.all().length).toBeGreaterThanOrEqual(100);
    expect(db.reactions.all().length).toBeGreaterThan(0);

    for (const userId of Object.values(DEMO_USER_IDS)) {
      expect(db.items.filter((i) => i.ownerId === userId).length).toBeGreaterThanOrEqual(25);
    }
  });

  it('mostly shares items so Wrapped and gifting have data, but exercises the other paths', () => {
    seedDemoData();
    const items = db.items.all();

    expect(items.filter((i) => i.visibility === 'shared').length / items.length).toBeGreaterThan(
      0.8,
    );
    expect(items.some((i) => i.visibility === 'private')).toBe(true);
    expect(items.some((i) => i.visibility === 'anonymous')).toBe(true);
    expect(items.every((i) => i.priceCents === null || Number.isInteger(i.priceCents))).toBe(true);
  });

  it('sets up the demo heart: the recipient hearted another member item', () => {
    seedDemoData();

    const star = db.items.find((i) => i.id === DEMO_STAR_ITEM_ID);
    expect(star?.ownerId).toBe(DEMO_USER_IDS.sam);
    expect(star?.ownerId).not.toBe(DEMO_RECIPIENT_ID);
    expect(star?.visibility).toBe('shared');
    expect(
      db.reactions.find(
        (r) =>
          r.userId === DEMO_RECIPIENT_ID && r.itemId === DEMO_STAR_ITEM_ID && r.type === 'heart',
      ),
    ).toBeDefined();
  });

  it('gives the recipient a birthday inside the nudge window', () => {
    seedDemoData();

    const recipient = db.users.find((u) => u.id === DEMO_RECIPIENT_ID);
    expect(recipient?.birthday).toMatch(/^\d{4}-\d{2}-\d{2}$/);

    const deadline = new Date(deadlineForBirthday(recipient?.birthday ?? '1999-01-01'));
    const daysUntil = (deadline.getTime() - Date.now()) / 86_400_000;
    expect(daysUntil).toBeGreaterThan(0);
    expect(daysUntil).toBeLessThan(14);
  });

  it('is idempotent when called twice after resetDb()', () => {
    seedDemoData();
    const counts = {
      users: db.users.all().length,
      groups: db.groups.all().length,
      memberships: db.memberships.all().length,
      items: db.items.all().length,
      reactions: db.reactions.all().length,
    };

    seedDemoData();

    expect(db.users.all()).toHaveLength(counts.users);
    expect(db.groups.all()).toHaveLength(counts.groups);
    expect(db.memberships.all()).toHaveLength(counts.memberships);
    expect(db.items.all()).toHaveLength(counts.items);
    expect(db.reactions.all()).toHaveLength(counts.reactions);
  });
});

describe('seedDemoThreads', () => {
  beforeEach(() => {
    resetDb();
    seedDemoData();
    seedDemoThreads();
  });

  it('creates a fresh picking thread for the recipient with no picks yet', () => {
    const thread = db.giftThreads.find((t) => t.id === DEMO_BIRTHDAY_THREAD_ID);

    expect(thread?.state).toBe('picking');
    expect(thread?.recipientId).toBe(DEMO_RECIPIENT_ID);
    expect(thread?.organiserId).not.toBe(DEMO_RECIPIENT_ID);
    expect(thread?.winningPickId).toBeNull();
    expect(db.giftPicks.filter((p) => p.threadId === DEMO_BIRTHDAY_THREAD_ID)).toHaveLength(0);
  });

  it('creates a collecting thread with exactly two pulled shares for the reversal moment', () => {
    const thread = db.giftThreads.find((t) => t.id === DEMO_REVERSAL_THREAD_ID);
    const contributions = db.contributions.filter((c) => c.threadId === DEMO_REVERSAL_THREAD_ID);
    const pick = db.giftPicks.find((p) => p.id === thread?.winningPickId);

    expect(thread?.state).toBe('collecting');
    expect(thread?.recipientId).not.toBe(DEMO_RECIPIENT_ID);
    expect(contributions).toHaveLength(3);
    expect(contributions.filter((c) => c.status === 'pulled')).toHaveLength(2);

    for (const pulledRow of contributions.filter((c) => c.status === 'pulled')) {
      expect(pulledRow.pullTxnId).toBeTruthy();
      expect(pulledRow.pullStan).toBeTruthy();
      expect(pulledRow.pullRrn).toBeTruthy();
    }

    // §7.4 invariant: shares add up to the winning pick's price.
    expect(contributions.reduce((sum, c) => sum + c.amountCents, 0)).toBe(pick?.priceCents);
    expect(contributions.some((c) => c.userId === thread?.recipientId)).toBe(false);
  });

  it('cites real recipient items in the pre-made pick reason', () => {
    const pick = db.giftPicks.find((p) => p.id === db.giftThreads.find((t) => t.id === DEMO_REVERSAL_THREAD_ID)?.winningPickId);

    expect(pick?.citedItemIds.length).toBeGreaterThan(0);
    for (const itemId of pick?.citedItemIds ?? []) {
      const item = db.items.find((i) => i.id === itemId);
      expect(item?.ownerId).toBe(DEMO_USER_IDS.maya);
      expect(pick?.reason).toContain(item?.name);
    }
  });

  it('is idempotent', () => {
    seedDemoThreads();

    expect(db.giftThreads.all()).toHaveLength(2);
    expect(db.contributions.all()).toHaveLength(3);
    expect(db.giftPicks.all()).toHaveLength(1);
  });
});

describe('POST /demo/reset', () => {
  let app: FastifyInstance;

  beforeEach(async () => {
    app = Fastify({ logger: false });
    // Mirrors the mapping in server.ts so the guard's status code is what a caller would see.
    app.setErrorHandler((err, _request, reply) => {
      if (err instanceof AppError) {
        return reply
          .status(err.httpStatus)
          .send({ error: { code: err.code, message: err.message } });
      }
      throw err;
    });
    await app.register(demoRoutes);
    await app.ready();
  });

  afterEach(async () => {
    delete process.env.DEMO_MODE;
    await app.close();
  });

  it('404s when DEMO_MODE is unset', async () => {
    delete process.env.DEMO_MODE;
    resetDb();

    const response = await app.inject({ method: 'POST', url: '/demo/reset' });

    expect(response.statusCode).toBe(404);
    expect(db.users.all()).toHaveLength(0);
  });

  it('404s when DEMO_MODE is set to anything other than "true"', async () => {
    process.env.DEMO_MODE = 'false';

    expect((await app.inject({ method: 'POST', url: '/demo/reset' })).statusCode).toBe(404);
  });

  it('resets to the known demo state with 204 when DEMO_MODE=true', async () => {
    process.env.DEMO_MODE = 'true';
    resetDb();

    const response = await app.inject({ method: 'POST', url: '/demo/reset' });

    expect(response.statusCode).toBe(204);
    expect(db.users.all()).toHaveLength(4);
    expect(db.items.all().length).toBeGreaterThanOrEqual(100);
    expect(db.giftThreads.all()).toHaveLength(2);
    expect(db.contributions.filter((c) => c.status === 'pulled')).toHaveLength(2);
  });

  it('is repeatable without duplicating rows', async () => {
    process.env.DEMO_MODE = 'true';

    await app.inject({ method: 'POST', url: '/demo/reset' });
    await app.inject({ method: 'POST', url: '/demo/reset' });

    expect(db.users.all()).toHaveLength(4);
    expect(db.giftThreads.all()).toHaveLength(2);
    expect(db.contributions.all()).toHaveLength(3);
  });
});

describe('linkPreview', () => {
  it('rejects malformed and non-http URLs with a clean AppError', async () => {
    await expect(linkPreview('not a url')).rejects.toBeInstanceOf(AppError);
    await expect(linkPreview('ftp://example.com/thing')).rejects.toBeInstanceOf(AppError);
  });
});
