import type { FastifyInstance } from 'fastify';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { db, newId, now, resetDb } from '../src/db/index.js';
import type { ItemRow, UserRow, Visibility } from '../src/db/types.js';
import { buildServer } from '../src/server.js';
import type {
  ApiError,
  Birthday,
  FindItem,
  Group,
  Item,
  User,
  WishlistRoster,
} from '../src/types/api.js';

let app: FastifyInstance;

const auth = (userId: string) => ({ authorization: `Bearer dev:${userId}` });

function user(name: string, birthday: string | null = null): UserRow {
  return db.users.insert({
    id: newId(),
    name,
    avatarUrl: null,
    birthday,
    cardLast4: null,
    visaCardRef: null,
  });
}

function group(name = 'Crew'): string {
  const id = newId();
  db.groups.insert({ id, name, emoji: '🛍️', inviteCode: 'ABC234', createdAt: now() });
  return id;
}

function member(groupId: string, userId: string): void {
  db.memberships.insert({ groupId, userId, joinedAt: now() });
}

function item(ownerId: string, groupId: string | null, visibility: Visibility, name: string): ItemRow {
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
    visibility,
    embedding: null,
    createdAt: now(),
  });
}

beforeEach(async () => {
  resetDb();
  app = await buildServer();
});

afterEach(async () => {
  await app.close();
});

describe('groups', () => {
  it('creates a group the creator is already a member of', async () => {
    const alice = user('Alice');

    const res = await app.inject({
      method: 'POST',
      url: '/groups',
      headers: auth(alice.id),
      payload: { name: 'Shop Talk', emoji: '🧦' },
    });

    expect(res.statusCode).toBe(200);
    const body = res.json<Group>();
    expect(body.inviteCode).toMatch(/^[A-Z2-9]{6}$/);
    expect(body.members.map((m) => m.id)).toEqual([alice.id]);
    expect(body.members[0]?.hasBirthday).toBe(false);
  });

  it('joins by invite code and is idempotent', async () => {
    const alice = user('Alice');
    const bob = user('Bob', '1999-04-02');

    const created = await app.inject({
      method: 'POST',
      url: '/groups',
      headers: auth(alice.id),
      payload: { name: 'Shop Talk', emoji: '🧦' },
    });
    const code = created.json<Group>().inviteCode;

    const first = await app.inject({
      method: 'POST',
      url: '/groups/join',
      headers: auth(bob.id),
      payload: { inviteCode: code.toLowerCase() },
    });
    expect(first.statusCode).toBe(200);
    expect(first.json<Group>().members).toHaveLength(2);

    const second = await app.inject({
      method: 'POST',
      url: '/groups/join',
      headers: auth(bob.id),
      payload: { inviteCode: code },
    });
    expect(second.statusCode).toBe(200);
    expect(second.json<Group>().members).toHaveLength(2);
    expect(db.memberships.all()).toHaveLength(2);

    const bobMember = second.json<Group>().members.find((m) => m.id === bob.id);
    expect(bobMember?.hasBirthday).toBe(true);
  });

  it('rejects an unknown invite code', async () => {
    const alice = user('Alice');
    const res = await app.inject({
      method: 'POST',
      url: '/groups/join',
      headers: auth(alice.id),
      payload: { inviteCode: 'ZZZZZZ' },
    });
    expect(res.statusCode).toBe(404);
    expect(res.json().error.code).toBe('NOT_FOUND');
  });

  it('refuses to show a group to a non-member', async () => {
    const alice = user('Alice');
    const mallory = user('Mallory');
    const groupId = group();
    member(groupId, alice.id);

    const ok = await app.inject({ method: 'GET', url: `/groups/${groupId}`, headers: auth(alice.id) });
    expect(ok.statusCode).toBe(200);

    const denied = await app.inject({
      method: 'GET',
      url: `/groups/${groupId}`,
      headers: auth(mallory.id),
    });
    expect(denied.statusCode).toBe(403);
    expect(denied.json().error.code).toBe('NOT_MEMBER');
  });
});

describe('me', () => {
  it('returns the caller from the bearer token alone', async () => {
    const alice = user('Alice', '1998-03-04');
    user('Bob');

    const res = await app.inject({ method: 'GET', url: '/me', headers: auth(alice.id) });

    expect(res.statusCode).toBe(200);
    expect(res.json<User>()).toEqual({
      id: alice.id,
      name: 'Alice',
      avatarUrl: null,
      birthday: '1998-03-04',
      cardLast4: null,
    });
  });

  it('rejects an unauthenticated read', async () => {
    const res = await app.inject({ method: 'GET', url: '/me' });
    expect(res.statusCode).toBe(401);
  });

  it('lists only the groups the caller belongs to', async () => {
    const alice = user('Alice');
    const bob = user('Bob');
    const shared = group('Tea Party');
    const theirs = group('Book Club');
    member(shared, alice.id);
    member(shared, bob.id);
    member(theirs, bob.id);

    const mine = await app.inject({ method: 'GET', url: '/me/groups', headers: auth(alice.id) });
    expect(mine.statusCode).toBe(200);
    expect(mine.json<Group[]>().map((g) => g.id)).toEqual([shared]);
    expect(mine.json<Group[]>()[0]?.members.map((m) => m.name)).toEqual(['Alice', 'Bob']);

    const theirsRes = await app.inject({ method: 'GET', url: '/me/groups', headers: auth(bob.id) });
    expect(theirsRes.json<Group[]>().map((g) => g.name)).toEqual(['Book Club', 'Tea Party']);
  });

  it('patches the caller and only the caller', async () => {
    const alice = user('Alice');
    const bob = user('Bob');

    const res = await app.inject({
      method: 'PATCH',
      url: '/me',
      headers: auth(alice.id),
      payload: { name: 'Alice A', birthday: '1998-03-04' },
    });

    expect(res.statusCode).toBe(200);
    expect(res.json<User>()).toMatchObject({ id: alice.id, name: 'Alice A', birthday: '1998-03-04' });
    expect(db.users.find((u) => u.id === bob.id)?.name).toBe('Bob');
  });

  it('rejects a bad birthday', async () => {
    const alice = user('Alice');
    const res = await app.inject({
      method: 'PATCH',
      url: '/me',
      headers: auth(alice.id),
      payload: { birthday: '4th March' },
    });
    expect(res.statusCode).toBe(400);
    expect(res.json().error.code).toBe('VALIDATION_ERROR');
  });

  it('stores a known test card and rejects an unknown ref', async () => {
    const alice = user('Alice');

    const ok = await app.inject({
      method: 'POST',
      url: '/me/card',
      headers: auth(alice.id),
      payload: { cardRef: 'test-card-1' },
    });
    expect(ok.statusCode).toBe(200);
    expect(ok.json().cardLast4).toBe('3304');
    expect(db.users.find((u) => u.id === alice.id)?.visaCardRef).toBe('test-card-1');

    const bad = await app.inject({
      method: 'POST',
      url: '/me/card',
      headers: auth(alice.id),
      payload: { cardRef: 'my-real-card' },
    });
    expect(bad.statusCode).toBe(400);
  });
});

describe('items', () => {
  it('returns the caller their own items including private ones', async () => {
    const alice = user('Alice');
    const bob = user('Bob');
    const groupId = group();
    member(groupId, alice.id);
    member(groupId, bob.id);

    item(alice.id, groupId, 'private', 'Secret socks');
    item(alice.id, groupId, 'shared', 'Loud jacket');
    item(bob.id, groupId, 'shared', "Bob's boots");

    const res = await app.inject({ method: 'GET', url: '/items/mine', headers: auth(alice.id) });
    expect(res.statusCode).toBe(200);
    const names = res.json<Item[]>().map((i) => i.name);
    expect(names.sort()).toEqual(['Loud jacket', 'Secret socks']);
  });

  it('creates a private item by default', async () => {
    const alice = user('Alice');
    const res = await app.inject({
      method: 'POST',
      url: '/items',
      headers: auth(alice.id),
      payload: { name: 'Kettle', category: 'kitchen', priceCents: 3200 },
    });
    expect(res.statusCode).toBe(200);
    expect(res.json<Item>().visibility).toBe('private');
  });

  it('rejects PATCH /items/:id from a non-owner', async () => {
    const alice = user('Alice');
    const bob = user('Bob');
    const groupId = group();
    member(groupId, alice.id);
    member(groupId, bob.id);
    const shared = item(alice.id, groupId, 'shared', 'Loud jacket');

    const res = await app.inject({
      method: 'PATCH',
      url: `/items/${shared.id}`,
      headers: auth(bob.id),
      payload: { visibility: 'private' },
    });
    expect(res.statusCode).toBe(404);
    expect(db.items.find((i) => i.id === shared.id)?.visibility).toBe('shared');

    const owner = await app.inject({
      method: 'PATCH',
      url: `/items/${shared.id}`,
      headers: auth(alice.id),
      payload: { visibility: 'anonymous' },
    });
    expect(owner.statusCode).toBe(200);
    expect(owner.json<Item>().visibility).toBe('anonymous');
  });
});

describe('finds', () => {
  it('shows shared and anonymous items, hides private ones and anonymous owners', async () => {
    const alice = user('Alice');
    const bob = user('Bob');
    const groupId = group();
    member(groupId, alice.id);
    member(groupId, bob.id);

    item(bob.id, groupId, 'private', 'Secret socks');
    item(bob.id, groupId, 'shared', 'Loud jacket');
    item(bob.id, groupId, 'anonymous', 'Embarrassing mug');

    const res = await app.inject({
      method: 'GET',
      url: `/groups/${groupId}/finds`,
      headers: auth(alice.id),
    });
    expect(res.statusCode).toBe(200);

    const finds = res.json<FindItem[]>();
    expect(finds.map((f) => f.name).sort()).toEqual(['Embarrassing mug', 'Loud jacket']);

    const anon = finds.find((f) => f.name === 'Embarrassing mug');
    expect(anon?.ownerId).toBeNull();
    expect(finds.find((f) => f.name === 'Loud jacket')?.ownerId).toBe(bob.id);
  });

  it('never carries a price or any hint of one', async () => {
    const alice = user('Alice');
    const groupId = group();
    member(groupId, alice.id);
    item(alice.id, groupId, 'shared', 'Loud jacket');

    const res = await app.inject({
      method: 'GET',
      url: `/groups/${groupId}/finds`,
      headers: auth(alice.id),
    });

    const [find] = res.json<FindItem[]>();
    expect(find).toBeDefined();
    expect(Object.keys(find ?? {})).not.toContain('priceCents');
    expect(res.body).not.toContain('4500');
    expect(res.body).not.toContain('price');
  });

  it('refuses finds to a non-member', async () => {
    const mallory = user('Mallory');
    const alice = user('Alice');
    const groupId = group();
    member(groupId, alice.id);

    const res = await app.inject({
      method: 'GET',
      url: `/groups/${groupId}/finds`,
      headers: auth(mallory.id),
    });
    expect(res.statusCode).toBe(403);
  });
});

describe('reactions', () => {
  it('hearts idempotently, counts correctly and never names the hearters', async () => {
    const alice = user('Alice');
    const bob = user('Bob');
    const cara = user('Cara');
    const groupId = group();
    for (const u of [alice, bob, cara]) member(groupId, u.id);
    const jacket = item(bob.id, groupId, 'shared', 'Loud jacket');

    const heart = (userId: string) =>
      app.inject({
        method: 'POST',
        url: '/reactions',
        headers: auth(userId),
        payload: { itemId: jacket.id, type: 'heart' },
      });

    expect((await heart(alice.id)).statusCode).toBe(204);
    expect((await heart(alice.id)).statusCode).toBe(204);
    expect((await heart(cara.id)).statusCode).toBe(204);
    expect(db.reactions.all()).toHaveLength(2);

    const asBob = await app.inject({
      method: 'GET',
      url: `/groups/${groupId}/finds`,
      headers: auth(bob.id),
    });
    const ownerView = asBob.json<FindItem[]>()[0];
    expect(ownerView?.heartCount).toBe(2);
    expect(ownerView?.iHearted).toBe(false);
    // §1 rule 4: not even the owner learns who hearted it.
    expect(asBob.body).not.toContain(alice.id);
    expect(asBob.body).not.toContain(cara.id);

    const asAlice = await app.inject({
      method: 'GET',
      url: `/groups/${groupId}/finds`,
      headers: auth(alice.id),
    });
    expect(asAlice.json<FindItem[]>()[0]?.iHearted).toBe(true);

    const unheart = () =>
      app.inject({
        method: 'DELETE',
        url: '/reactions',
        headers: auth(alice.id),
        payload: { itemId: jacket.id, type: 'heart' },
      });

    expect((await unheart()).statusCode).toBe(204);
    expect((await unheart()).statusCode).toBe(204);

    const after = await app.inject({
      method: 'GET',
      url: `/groups/${groupId}/finds`,
      headers: auth(alice.id),
    });
    expect(after.json<FindItem[]>()[0]).toMatchObject({ heartCount: 1, iHearted: false });
  });

  it('refuses to react to an item the caller cannot see', async () => {
    const alice = user('Alice');
    const bob = user('Bob');
    const groupId = group();
    member(groupId, alice.id);
    member(groupId, bob.id);
    const secret = item(bob.id, groupId, 'private', 'Secret socks');

    const res = await app.inject({
      method: 'POST',
      url: '/reactions',
      headers: auth(alice.id),
      payload: { itemId: secret.id, type: 'heart' },
    });
    expect(res.statusCode).toBe(404);
    expect(db.reactions.all()).toHaveLength(0);
  });
});

describe('wishlist', () => {
  it('falls back to the hostname when the link preview fails, and wishlists the item', async () => {
    const alice = user('Alice');

    const res = await app.inject({
      method: 'POST',
      url: '/wishlist/link',
      headers: auth(alice.id),
      payload: { url: 'https://www.shop.example.com/things/1', priceCents: 1999 },
    });

    expect(res.statusCode).toBe(200);
    const created = res.json<Item>();
    expect(created.name).toContain('shop.example.com');
    expect(created.priceCents).toBe(1999);
    expect(created.visibility).toBe('private');

    expect(
      db.reactions.find(
        (r) => r.userId === alice.id && r.itemId === created.id && r.type === 'wishlist',
      ),
    ).toBeDefined();

    const mine = await app.inject({ method: 'GET', url: '/items/mine', headers: auth(alice.id) });
    expect(mine.json<Item[]>().map((i) => i.id)).toContain(created.id);
  });

  it('files the item under the caller\u2019s only group, still private', async () => {
    const alice = user('Alice');
    const crew = group();
    member(crew, alice.id);

    const res = await app.inject({
      method: 'POST',
      url: '/wishlist/link',
      headers: auth(alice.id),
      payload: { url: 'https://www.shop.example.com/things/3' },
    });

    const created = res.json<Item>();
    expect(db.items.find((i) => i.id === created.id)?.groupId).toBe(crew);
    expect(created.visibility).toBe('private');

    // Private items never reach the shared feed, so the group id is tenancy and not exposure.
    const finds = await app.inject({
      method: 'GET',
      url: `/groups/${crew}/finds`,
      headers: auth(alice.id),
    });
    expect(finds.json<FindItem[]>().map((f) => f.id)).not.toContain(created.id);
  });

  it('leaves the group null when membership is ambiguous', async () => {
    const alice = user('Alice');
    member(group('One'), alice.id);
    member(group('Two'), alice.id);

    const res = await app.inject({
      method: 'POST',
      url: '/wishlist/link',
      headers: auth(alice.id),
      payload: { url: 'https://www.shop.example.com/things/4' },
    });

    expect(db.items.find((i) => i.id === res.json<Item>().id)?.groupId).toBeNull();
  });

  it('lists only starred items, and only the caller\u2019s', async () => {
    const alice = user('Alice');
    const bob = user('Bob');
    const receipt = item(alice.id, null, 'private', 'A receipt, not a wish');

    const saved = await app.inject({
      method: 'POST',
      url: '/wishlist/link',
      headers: auth(alice.id),
      payload: { url: 'https://www.shop.example.com/things/2' },
    });
    const created = saved.json<Item>();

    const mine = await app.inject({ method: 'GET', url: '/wishlist', headers: auth(alice.id) });
    expect(mine.statusCode).toBe(200);
    expect(mine.json<Item[]>().map((i) => i.id)).toEqual([created.id]);
    expect(mine.json<Item[]>().map((i) => i.id)).not.toContain(receipt.id);

    const theirs = await app.inject({ method: 'GET', url: '/wishlist', headers: auth(bob.id) });
    expect(theirs.json<Item[]>()).toEqual([]);
  });
});

describe('group wishlists', () => {
  const star = (userId: string, itemId: string): void => {
    db.reactions.insert({ userId, itemId, type: 'wishlist', createdAt: now() });
  };

  it('names everyone in the group who wants a shared item, with enough to draw an avatar', async () => {
    const alice = user('Alice');
    const bob = user('Bob');
    const cleo = user('Cleo');
    db.users.update((u) => u.id === bob.id, { avatarUrl: 'https://img.example.com/bob.png' });

    const crew = group();
    for (const u of [alice, bob, cleo]) member(crew, u.id);

    const wanted = item(alice.id, crew, 'shared', 'Selvedge Denim Trucker Jacket');
    const ignored = item(alice.id, crew, 'shared', 'Nobody wants this');
    star(bob.id, wanted.id);
    star(cleo.id, wanted.id);

    const res = await app.inject({
      method: 'GET',
      url: `/groups/${crew}/wishlists`,
      headers: auth(alice.id),
    });

    expect(res.statusCode).toBe(200);
    const rosters = res.json<WishlistRoster[]>();
    expect(rosters.map((r) => r.itemId)).not.toContain(ignored.id);

    const roster = rosters.find((r) => r.itemId === wanted.id);
    expect(roster?.users.map((u) => u.id).sort()).toEqual([bob.id, cleo.id].sort());
    expect(roster?.users.find((u) => u.id === bob.id)).toEqual({
      id: bob.id,
      name: 'Bob',
      avatarUrl: 'https://img.example.com/bob.png',
    });
  });

  it('deduplicates a reaction the store already holds', async () => {
    const alice = user('Alice');
    const bob = user('Bob');
    const crew = group();
    member(crew, alice.id);
    member(crew, bob.id);

    const wanted = item(alice.id, crew, 'shared', 'Contax T2');
    star(bob.id, wanted.id);
    star(bob.id, wanted.id);

    const res = await app.inject({
      method: 'GET',
      url: `/groups/${crew}/wishlists`,
      headers: auth(alice.id),
    });
    expect(res.json<WishlistRoster[]>()[0]?.users).toHaveLength(1);
  });

  it('never surfaces a private item, not even to the owner who starred it', async () => {
    const alice = user('Alice');
    const crew = group();
    member(crew, alice.id);

    const secret = item(alice.id, crew, 'private', 'Suede Desert Boot');
    star(alice.id, secret.id);

    const res = await app.inject({
      method: 'GET',
      url: `/groups/${crew}/wishlists`,
      headers: auth(alice.id),
    });
    expect(res.json<WishlistRoster[]>()).toEqual([]);
  });

  it('keeps an anonymous item\u2019s owner off its own roster, but still names the others', async () => {
    const alice = user('Alice');
    const bob = user('Bob');
    const crew = group();
    member(crew, alice.id);
    member(crew, bob.id);

    const masked = item(alice.id, crew, 'anonymous', 'Loose Leaf Tea Sampler');
    star(alice.id, masked.id);
    star(bob.id, masked.id);

    const theirs = await app.inject({
      method: 'GET',
      url: `/groups/${crew}/wishlists`,
      headers: auth(bob.id),
    });
    expect(theirs.json<WishlistRoster[]>()[0]?.users.map((u) => u.id)).toEqual([bob.id]);

    // The owner is not hiding from themselves.
    const mine = await app.inject({
      method: 'GET',
      url: `/groups/${crew}/wishlists`,
      headers: auth(alice.id),
    });
    expect(mine.json<WishlistRoster[]>()[0]?.users.map((u) => u.id).sort()).toEqual(
      [alice.id, bob.id].sort(),
    );
  });

  it('ignores items in another group and wishlists from outside the group', async () => {
    const alice = user('Alice');
    const outsider = user('Outsider');
    const crew = group('Crew');
    const other = group('Other');
    member(crew, alice.id);
    member(other, alice.id);
    member(other, outsider.id);

    const ours = item(alice.id, crew, 'shared', 'Ours');
    const elsewhere = item(alice.id, other, 'shared', 'Elsewhere');
    star(outsider.id, ours.id);
    star(alice.id, elsewhere.id);

    const res = await app.inject({
      method: 'GET',
      url: `/groups/${crew}/wishlists`,
      headers: auth(alice.id),
    });
    expect(res.json<WishlistRoster[]>()).toEqual([]);
  });

  it('refuses a caller who is not in the group, and 404s an unknown one', async () => {
    const alice = user('Alice');
    const stranger = user('Stranger');
    const crew = group();
    member(crew, alice.id);
    star(alice.id, item(alice.id, crew, 'shared', 'Contax T2').id);

    const res = await app.inject({
      method: 'GET',
      url: `/groups/${crew}/wishlists`,
      headers: auth(stranger.id),
    });
    expect(res.statusCode).toBe(403);
    expect(res.json<ApiError>().error.code).toBe('NOT_MEMBER');

    const missing = await app.inject({
      method: 'GET',
      url: '/groups/nope/wishlists',
      headers: auth(alice.id),
    });
    expect(missing.statusCode).toBe(404);
    expect(missing.json<ApiError>().error.code).toBe('NOT_FOUND');
  });

  it('requires a token', async () => {
    const alice = user('Alice');
    const crew = group();
    member(crew, alice.id);

    const res = await app.inject({ method: 'GET', url: `/groups/${crew}/wishlists` });
    expect(res.statusCode).toBe(401);
  });
});

describe('birthdays', () => {
  afterEach(() => {
    vi.useRealTimers();
  });

  const freeze = (iso: string) => {
    vi.useFakeTimers({ toFake: ['Date'] });
    vi.setSystemTime(new Date(iso));
  };

  it('excludes the caller, computes daysUntil and drops birthdays beyond 30 days', async () => {
    freeze('2026-06-01T09:00:00Z');

    const alice = user('Alice', '1998-06-10');
    const bob = user('Bob', '1997-06-06');
    const cara = user('Cara', '1999-12-25');
    const dan = user('Dan', null);
    const groupId = group();
    for (const u of [alice, bob, cara, dan]) member(groupId, u.id);

    const res = await app.inject({
      method: 'GET',
      url: `/groups/${groupId}/birthdays`,
      headers: auth(alice.id),
    });

    expect(res.statusCode).toBe(200);
    const birthdays = res.json<Birthday[]>();
    expect(birthdays).toHaveLength(1);
    expect(birthdays[0]).toMatchObject({
      userId: bob.id,
      name: 'Bob',
      date: '2026-06-06',
      daysUntil: 5,
      existingThreadId: null,
    });
  });

  it('wraps over New Year', async () => {
    freeze('2026-12-20T23:30:00Z');

    const alice = user('Alice', '1998-06-10');
    const bob = user('Bob', '1997-01-03');
    const cara = user('Cara', '1999-12-20');
    const groupId = group();
    for (const u of [alice, bob, cara]) member(groupId, u.id);

    const res = await app.inject({
      method: 'GET',
      url: `/groups/${groupId}/birthdays`,
      headers: auth(alice.id),
    });

    const birthdays = res.json<Birthday[]>();
    expect(birthdays.map((b) => [b.name, b.date, b.daysUntil])).toEqual([
      ['Cara', '2026-12-20', 0],
      ['Bob', '2027-01-03', 14],
    ]);
  });

  it('reports a non-terminal thread and ignores a finished one', async () => {
    freeze('2026-06-01T09:00:00Z');

    const alice = user('Alice');
    const bob = user('Bob', '1997-06-06');
    const cara = user('Cara', '1999-06-07');
    const groupId = group();
    for (const u of [alice, bob, cara]) member(groupId, u.id);

    const thread = (recipientId: string, state: 'collecting' | 'refunded') => {
      const id = newId();
      db.giftThreads.insert({
        id,
        groupId,
        recipientId,
        organiserId: alice.id,
        state,
        budgetMinCents: 2000,
        budgetMaxCents: 8000,
        deadline: '2026-06-05T23:59:00.000Z',
        winningPickId: null,
        pushTxnId: null,
        pushStatus: null,
        revealAt: null,
        regenerations: 0,
        createdAt: now(),
      });
      return id;
    };

    const live = thread(bob.id, 'collecting');
    thread(cara.id, 'refunded');

    const res = await app.inject({
      method: 'GET',
      url: `/groups/${groupId}/birthdays`,
      headers: auth(alice.id),
    });

    const byName = Object.fromEntries(res.json<Birthday[]>().map((b) => [b.name, b.existingThreadId]));
    expect(byName).toEqual({ Bob: live, Cara: null });
  });
});
