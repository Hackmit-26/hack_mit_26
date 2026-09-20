/**
 * Offline coverage for the social write path of the Supabase mirror.
 *
 * Be clear about what this is NOT: there is no database here and nothing is stubbed to pretend
 * otherwise. `vitest.config.ts` pins DB_MODE=memory, which makes every `mirror()` unit return
 * before it asks the pool for a client, so the only things these tests can honestly assert are
 *  (a) the pure row -> bind-parameter mappings and the target_type resolution rule, and
 *  (b) that the exported mirror entry points are genuinely inert offline.
 * Whether the SQL itself satisfies the teammates' constraints is only provable against their
 * live schema, and is not covered.
 */
import { afterEach, describe, expect, it } from 'vitest';
import { db, newId, now, resetDb } from '../src/db/index.js';
import {
  PURCHASE_SQL,
  REACTION_SQL,
  mirrorItem,
  mirrorItems,
  mirrorReaction,
  purchaseParams,
  reactionParams,
  resolveTargetType,
  unmirrorReaction,
} from '../src/db/mirror.js';
import type { ItemRow, ReactionRow } from '../src/db/types.js';

afterEach(() => resetDb());

/** Highest `$n` placeholder in a statement, so the bind arrays cannot silently drift from it. */
function placeholders(sql: string): number {
  return Math.max(...[...sql.matchAll(/\$(\d+)/g)].map((m) => Number(m[1])));
}

function item(patch: Partial<ItemRow> = {}): ItemRow {
  return {
    id: newId(),
    ownerId: newId(),
    groupId: null,
    name: 'Oversized Linen Shirt',
    category: 'clothing',
    merchant: 'Uniqlo',
    imageUrl: 'https://cdn.example/shirt.png',
    description: 'Boxy sand-coloured linen shirt',
    priceCents: 4990,
    purchasedAt: '2026-09-14',
    visibility: 'private',
    embedding: null,
    createdAt: now(),
    ...patch,
  };
}

describe('resolveTargetType', () => {
  it('calls an id that exists in purchases a purchase', () => {
    expect(resolveTargetType(true, false)).toBe('purchase');
  });

  it('calls an id that exists only in products a product', () => {
    expect(resolveTargetType(false, true)).toBe('product');
  });

  it('prefers purchase when the id somehow exists in both', () => {
    expect(resolveTargetType(true, true)).toBe('purchase');
  });

  it('returns null when neither table has the id, so no FK is invented', () => {
    expect(resolveTargetType(false, false)).toBeNull();
  });
});

describe('purchaseParams', () => {
  it('binds one value per placeholder in PURCHASE_SQL', () => {
    // The literal `false` for `excluded` is inlined, so it is not a bind parameter.
    expect(purchaseParams(item(), null)).toHaveLength(placeholders(PURCHASE_SQL));
  });

  it('maps an ItemRow onto their purchases columns in order', () => {
    const row = item({ groupId: 'g1', visibility: 'shared' });
    expect(purchaseParams(row, 'merchant-uuid')).toEqual([
      row.id,
      row.ownerId,
      'g1',
      row.name,
      row.category,
      'merchant-uuid',
      row.imageUrl,
      row.priceCents,
      row.purchasedAt,
      'shared',
      row.createdAt,
    ]);
  });

  it('passes a null merchant_id straight through when the name is not in their table', () => {
    expect(purchaseParams(item({ merchant: 'Some Shop Nobody Seeded' }), null)[5]).toBeNull();
  });

  it('dates an unpurchased wishlist link by the day it was saved', () => {
    // `purchases.purchased_at` is NOT NULL, so a null here loses the whole row.
    const params = purchaseParams(
      item({ purchasedAt: null, visibility: 'private', createdAt: '2026-09-20T02:12:42.589Z' }),
      null,
    );
    expect(params[8]).toBe('2026-09-20');
    expect(params[9]).toBe('private');
  });

  it('prefers a real purchase date over the created date', () => {
    const params = purchaseParams(
      item({ purchasedAt: '2026-08-01', createdAt: '2026-09-20T02:12:42.589Z' }),
      null,
    );
    expect(params[8]).toBe('2026-08-01');
  });

  it('never binds the embedding: our 512-dim vectors do not fit their column', () => {
    const params = purchaseParams(item({ embedding: [0.1, 0.2, 0.3] }), null);
    expect(params.some((p) => Array.isArray(p))).toBe(false);
  });

  it('never binds the description: purchases has no such column', () => {
    const params = purchaseParams(item({ description: 'leaky' }), null);
    expect(params).not.toContain('leaky');
  });
});

describe('reactionParams', () => {
  const reaction = (patch: Partial<ReactionRow> = {}): ReactionRow => ({
    userId: 'u1',
    itemId: 'target-1',
    type: 'heart',
    createdAt: '2026-09-19T00:00:00.000Z',
    ...patch,
  });

  it('binds one value per placeholder in REACTION_SQL', () => {
    expect(reactionParams('r1', reaction(), 'purchase', null)).toHaveLength(
      placeholders(REACTION_SQL),
    );
  });

  it('writes the resolved target_type alongside the target id', () => {
    expect(reactionParams('r1', reaction(), 'product', 'g1')).toEqual([
      'r1',
      'u1',
      'product',
      'target-1',
      'heart',
      'g1',
      '2026-09-19T00:00:00.000Z',
    ]);
  });

  it('keeps our two reaction types as their kind verbatim, so hydration round-trips', () => {
    expect(reactionParams('r1', reaction({ type: 'wishlist' }), 'product', null)[4]).toBe(
      'wishlist',
    );
    expect(reactionParams('r1', reaction({ type: 'heart' }), 'purchase', null)[4]).toBe('heart');
  });
});

describe('mirror entry points offline', () => {
  it('resolve without touching a pool when DB_MODE is memory', async () => {
    const row = db.items.insert(item());
    db.reactions.insert({
      userId: row.ownerId,
      itemId: row.id,
      type: 'wishlist',
      createdAt: now(),
    });

    // getPool() throws without DATABASE_URL; these resolving proves mirror() short-circuits
    // before it ever asks for a client.
    await expect(
      Promise.all([
        mirrorItem(row.id),
        mirrorItems([row.id]),
        mirrorReaction(row.ownerId, row.id, 'wishlist'),
        unmirrorReaction(row.ownerId, row.id, 'wishlist'),
      ]),
    ).resolves.toBeDefined();
  });

  it('is a no-op for an id that is not in the working set', async () => {
    await expect(mirrorItem('nope')).resolves.toBeUndefined();
  });
});
