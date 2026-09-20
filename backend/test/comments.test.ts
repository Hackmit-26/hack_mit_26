import type { FastifyInstance, LightMyRequestResponse } from 'fastify';
import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import { db, newId, now, resetDb } from '../src/db/index.js';
import type { GiftPickRow, GiftThreadRow, ItemRow, UserRow, Visibility } from '../src/db/types.js';
import { buildServer } from '../src/server.js';
import type { ApiError, Comment } from '../src/types/api.js';

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

function thread(groupId: string, recipientId: string, organiserId: string): GiftThreadRow {
  return db.giftThreads.insert({
    id: newId(),
    groupId,
    recipientId,
    organiserId,
    state: 'voting',
    budgetMinCents: 2000,
    budgetMaxCents: 12000,
    deadline: '2026-10-05T23:59:00.000Z',
    winningPickId: null,
    pushTxnId: null,
    pushStatus: null,
    revealAt: null,
    regenerations: 0,
    createdAt: now(),
  });
}

function pick(threadId: string, productName: string): GiftPickRow {
  return db.giftPicks.insert({
    id: newId(),
    threadId,
    productName,
    productUrl: null,
    imageUrl: null,
    priceCents: 9000,
    merchant: 'Example',
    reason: 'because',
    citedItemIds: [],
    source: 'ai',
    createdAt: now(),
  });
}

function post(userId: string, payload: Record<string, unknown>): Promise<LightMyRequestResponse> {
  return app.inject({ method: 'POST', url: '/comments', headers: auth(userId), payload });
}

function list(
  userId: string,
  targetType: string,
  targetId: string,
): Promise<LightMyRequestResponse> {
  return app.inject({
    method: 'GET',
    url: `/comments?targetType=${targetType}&targetId=${targetId}`,
    headers: auth(userId),
  });
}

function del(userId: string, id: string): Promise<LightMyRequestResponse> {
  return app.inject({ method: 'DELETE', url: `/comments/${id}`, headers: auth(userId) });
}

beforeEach(async () => {
  resetDb();
  app = await buildServer();
});

afterEach(async () => {
  await app.close();
});

describe('comments on an item', () => {
  it('round-trips create, list and delete, and names the author', async () => {
    const alice = user('Alice');
    const bob = user('Bob');
    const groupId = group();
    member(groupId, alice.id);
    member(groupId, bob.id);
    const jacket = item(bob.id, groupId, 'shared', 'Loud jacket');

    const created = await post(alice.id, {
      targetType: 'purchase',
      targetId: jacket.id,
      body: 'this jacket is a crime',
    });
    expect(created.statusCode).toBe(200);
    expect(created.json<Comment>()).toMatchObject({
      targetType: 'purchase',
      targetId: jacket.id,
      parentId: null,
      authorId: alice.id,
      // The UI must not have to join to render a name.
      authorName: 'Alice',
      body: 'this jacket is a crime',
      editedAt: null,
    });
    const commentId = created.json<Comment>().id;

    const seen = await list(bob.id, 'purchase', jacket.id);
    expect(seen.statusCode).toBe(200);
    expect(seen.json<Comment[]>().map((c) => [c.id, c.authorName, c.body])).toEqual([
      [commentId, 'Alice', 'this jacket is a crime'],
    ]);

    const removed = await del(alice.id, commentId);
    expect(removed.statusCode).toBe(204);

    const after = await list(bob.id, 'purchase', jacket.id);
    expect(after.json<Comment[]>()).toEqual([]);

    // Soft delete, never a hard one: their schema retires a comment with `deleted_at`.
    const row = db.comments.find((c) => c.id === commentId);
    expect(row?.deletedAt).toEqual(expect.any(String));

    // Deleting twice is a 404, not a crash.
    expect((await del(alice.id, commentId)).statusCode).toBe(404);
  });

  it('lists in creation order and threads a reply under its parent', async () => {
    const alice = user('Alice');
    const bob = user('Bob');
    const groupId = group();
    member(groupId, alice.id);
    member(groupId, bob.id);
    const jacket = item(bob.id, groupId, 'shared', 'Loud jacket');

    const first = await post(alice.id, {
      targetType: 'purchase',
      targetId: jacket.id,
      body: 'first',
    });
    const parentId = first.json<Comment>().id;
    const reply = await post(bob.id, {
      targetType: 'purchase',
      targetId: jacket.id,
      parentId,
      body: 'second',
    });
    expect(reply.statusCode).toBe(200);
    expect(reply.json<Comment>().parentId).toBe(parentId);

    const seen = await list(alice.id, 'purchase', jacket.id);
    expect(seen.json<Comment[]>().map((c) => c.body)).toEqual(['first', 'second']);
  });

  it('refuses a reply whose parent hangs off a different target', async () => {
    const alice = user('Alice');
    const groupId = group();
    member(groupId, alice.id);
    const jacket = item(alice.id, groupId, 'shared', 'Loud jacket');
    const boots = item(alice.id, groupId, 'shared', 'Boots');

    const onJacket = await post(alice.id, {
      targetType: 'purchase',
      targetId: jacket.id,
      body: 'on the jacket',
    });

    const res = await post(alice.id, {
      targetType: 'purchase',
      targetId: boots.id,
      parentId: onJacket.json<Comment>().id,
      body: 'smuggled',
    });
    expect(res.statusCode).toBe(404);
    expect(db.comments.all()).toHaveLength(1);
  });

  it('rejects an empty or oversized body', async () => {
    const alice = user('Alice');
    const groupId = group();
    member(groupId, alice.id);
    const jacket = item(alice.id, groupId, 'shared', 'Loud jacket');

    for (const body of ['   ', 'x'.repeat(1001)]) {
      const res = await post(alice.id, { targetType: 'purchase', targetId: jacket.id, body });
      expect(res.statusCode).toBe(400);
      expect(res.json<ApiError>().error.code).toBe('VALIDATION_ERROR');
    }
    expect(db.comments.all()).toHaveLength(0);
  });
});

describe('a comment is exactly as visible as the thing it hangs off', () => {
  it('404s create and list on a private item the caller cannot see', async () => {
    const alice = user('Alice');
    const bob = user('Bob');
    const groupId = group();
    member(groupId, alice.id);
    member(groupId, bob.id);
    const secret = item(bob.id, groupId, 'private', 'Secret socks');

    const created = await post(alice.id, {
      targetType: 'purchase',
      targetId: secret.id,
      body: 'peeking',
    });
    expect(created.statusCode).toBe(404);
    expect(created.json<ApiError>().error.code).toBe('NOT_FOUND');
    expect(db.comments.all()).toHaveLength(0);

    expect((await list(alice.id, 'purchase', secret.id)).statusCode).toBe(404);

    // The owner is unaffected.
    const owner = await post(bob.id, {
      targetType: 'purchase',
      targetId: secret.id,
      body: 'mine',
    });
    expect(owner.statusCode).toBe(200);
    expect((await list(bob.id, 'purchase', secret.id)).json<Comment[]>()).toHaveLength(1);
  });

  it('404s a non-member of the group and an unknown target alike', async () => {
    const alice = user('Alice');
    const mallory = user('Mallory');
    const groupId = group();
    member(groupId, alice.id);
    const jacket = item(alice.id, groupId, 'shared', 'Loud jacket');

    expect((await list(mallory.id, 'purchase', jacket.id)).statusCode).toBe(404);
    expect((await list(alice.id, 'purchase', newId())).statusCode).toBe(404);
    expect(
      (await post(mallory.id, { targetType: 'purchase', targetId: jacket.id, body: 'hi' }))
        .statusCode,
    ).toBe(404);
  });

  it('stops a non-author deleting someone else\u2019s comment', async () => {
    const alice = user('Alice');
    const bob = user('Bob');
    const groupId = group();
    member(groupId, alice.id);
    member(groupId, bob.id);
    const jacket = item(alice.id, groupId, 'shared', 'Loud jacket');

    const created = await post(alice.id, {
      targetType: 'purchase',
      targetId: jacket.id,
      body: 'mine to delete',
    });
    const commentId = created.json<Comment>().id;

    // Bob can see the comment and its author already, so 403 reveals nothing new.
    const res = await del(bob.id, commentId);
    expect(res.statusCode).toBe(403);
    expect(db.comments.find((c) => c.id === commentId)?.deletedAt).toBeNull();
    expect((await list(bob.id, 'purchase', jacket.id)).json<Comment[]>()).toHaveLength(1);
  });
});

describe('the gift recipient can never learn a thread exists through comments', () => {
  const SECRET = 'the marimekko throw is ordered';

  const setup = () => {
    const ada = user('Ada');
    const bo = user('Bo');
    const rio = user('Rio');
    const mallory = user('Mallory');
    const groupId = group('Birthday Crew');
    for (const u of [ada, bo, rio]) member(groupId, u.id);
    const gift = thread(groupId, rio.id, ada.id);
    const chosen = pick(gift.id, 'Marimekko throw');
    return { ada, bo, rio, mallory, groupId, gift, chosen };
  };

  it('lets the organiser and members comment on the thread and its picks', async () => {
    const { ada, bo, gift, chosen } = setup();

    const onThread = await post(ada.id, {
      targetType: 'gift_thread',
      targetId: gift.id,
      body: SECRET,
    });
    expect(onThread.statusCode).toBe(200);

    const onPick = await post(bo.id, {
      targetType: 'gift_pick',
      targetId: chosen.id,
      body: 'this one',
    });
    expect(onPick.statusCode).toBe(200);

    expect((await list(bo.id, 'gift_thread', gift.id)).json<Comment[]>()).toHaveLength(1);
    expect((await list(ada.id, 'gift_pick', chosen.id)).json<Comment[]>()).toHaveLength(1);
  });

  it('returns 404 - never 403 - to the recipient on every comment endpoint', async () => {
    const { ada, rio, gift, chosen } = setup();

    const organiserComment = await post(ada.id, {
      targetType: 'gift_thread',
      targetId: gift.id,
      body: SECRET,
    });
    const commentId = organiserComment.json<Comment>().id;

    const calls = [
      post(rio.id, { targetType: 'gift_thread', targetId: gift.id, body: 'what is this' }),
      post(rio.id, { targetType: 'gift_pick', targetId: chosen.id, body: 'what is this' }),
      list(rio.id, 'gift_thread', gift.id),
      list(rio.id, 'gift_pick', chosen.id),
      // Visibility is checked before authorship, so this is 404 and not 403.
      del(rio.id, commentId),
    ];

    const bodies: string[] = [];
    for (const call of await Promise.all(calls)) {
      expect(call.statusCode).toBe(404);
      expect(call.json<ApiError>().error.code).toBe('NOT_FOUND');
      bodies.push(call.body);
    }

    // Nothing the recipient touched leaked the secret, the thread or the pick.
    const combined = bodies.join('\n');
    for (const leak of [SECRET, 'Marimekko', gift.id, chosen.id, commentId]) {
      expect(combined).not.toContain(leak);
    }

    // And the organiser's comment survived the recipient's delete attempt.
    expect(db.comments.find((c) => c.id === commentId)?.deletedAt).toBeNull();
  });

  it('404s a non-member on a gift thread and an orphan pick alike', async () => {
    const { mallory, gift } = setup();

    expect((await list(mallory.id, 'gift_thread', gift.id)).statusCode).toBe(404);
    // An unknown pick must not read differently to a hidden one.
    expect((await list(mallory.id, 'gift_pick', newId())).statusCode).toBe(404);
  });
});
