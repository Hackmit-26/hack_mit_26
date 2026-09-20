import type { FastifyInstance } from 'fastify';
import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import { db, newId, now, resetDb } from '../src/db/index.js';
import type { ItemRow } from '../src/db/types.js';
import { productLink, searchUrl } from '../src/domain/productLinks.js';
import { buildServer } from '../src/server.js';
import type { Item } from '../src/types/api.js';

let app: FastifyInstance;

const auth = (userId: string) => ({ authorization: `Bearer dev:${userId}` });

function owner(): string {
  const id = newId();
  db.users.insert({ id, name: 'Kris', avatarUrl: null, birthday: null, cardLast4: null, visaCardRef: null });
  return id;
}

function item(ownerId: string, fields: Partial<ItemRow> = {}): ItemRow {
  return db.items.insert({
    id: newId(),
    ownerId,
    groupId: null,
    name: 'Lens cleaning kit',
    category: 'tech',
    merchant: 'Lensmith',
    imageUrl: null,
    description: null,
    priceCents: 1450,
    purchasedAt: '2026-09-11',
    visibility: 'private',
    embedding: null,
    createdAt: now(),
    ...fields,
  });
}

beforeEach(async () => {
  resetDb();
  app = await buildServer();
});

afterEach(async () => {
  await app.close();
});

describe('productLink', () => {
  it('prefers the real product page', () => {
    expect(productLink('Bike computer', 'Kestrel', 'https://kestrel.com/p/1')).toBe(
      'https://kestrel.com/p/1',
    );
  });

  it('falls back to a merchant-scoped search, never a guessed product page', () => {
    expect(productLink('Lens cleaning kit', 'Lensmith', null)).toBe(
      'https://www.google.com/search?q=Lensmith%20Lens%20cleaning%20kit',
    );
  });

  it('ignores a stored value that is not an http url', () => {
    expect(productLink('Toner', null, 'products/abc')).toBe(searchUrl('Toner'));
  });

  it('is null when there is nothing to search for', () => {
    expect(productLink('', null, null)).toBeNull();
    expect(searchUrl('   ')).toBeNull();
  });
});

describe('item serialisation', () => {
  it('GET /items/mine gives every item a clickable url', async () => {
    const userId = owner();
    item(userId);
    item(userId, { name: 'Bike computer', merchant: 'Kestrel', productUrl: 'https://kestrel.com/p/1' });

    const res = await app.inject({ method: 'GET', url: '/items/mine', headers: auth(userId) });
    const items = res.json<Item[]>();

    expect(items).toHaveLength(2);
    for (const i of items) expect(i.productUrl).toMatch(/^https:\/\//);
    expect(items.find((i) => i.name === 'Bike computer')?.productUrl).toBe('https://kestrel.com/p/1');
  });

  it('POST /items round-trips a supplied product url', async () => {
    const userId = owner();
    const res = await app.inject({
      method: 'POST',
      url: '/items',
      headers: auth(userId),
      payload: {
        name: 'Hydrating toner',
        category: 'skincare',
        productUrl: 'https://sephora.com/p/toner',
      },
    });

    expect(res.statusCode).toBe(200);
    expect(res.json<Item>().productUrl).toBe('https://sephora.com/p/toner');
  });

  it('GET /wishlist links back to the page the user pasted', async () => {
    const userId = owner();
    const created = await app.inject({
      method: 'POST',
      url: '/wishlist/link',
      headers: auth(userId),
      payload: { url: 'https://example.com/products/mug' },
    });
    expect(created.json<Item>().productUrl).toBe('https://example.com/products/mug');

    const list = await app.inject({ method: 'GET', url: '/wishlist', headers: auth(userId) });
    expect(list.json<Item[]>()[0]?.productUrl).toBe('https://example.com/products/mug');
  });
});
