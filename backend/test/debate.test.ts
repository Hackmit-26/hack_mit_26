import type { FastifyInstance, LightMyRequestResponse } from 'fastify';
import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import { db, newId, now, resetDb } from '../src/db/index.js';
import {
  DEMO_DEBATE_ITEM_ID,
  DEMO_GROUP_ID,
  DEMO_USER_IDS,
  seedDemoComments,
  seedDemoData,
} from '../src/db/seed.js';
import type { CommentRow, ItemRow, UserRow, Visibility } from '../src/db/types.js';
import { buildServer } from '../src/server.js';
import type { ApiError, GroupDebate } from '../src/types/api.js';

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

/** `minutesAgo` back from a fixed instant, so a thread's span is exact rather than wall-clock. */
const EPOCH = Date.parse('2026-09-20T12:00:00.000Z');

function comment(
  itemId: string,
  userId: string,
  groupId: string | null,
  body: string,
  minutesAgo: number,
): CommentRow {
  return db.comments.insert({
    id: newId(),
    userId,
    groupId,
    targetType: 'purchase',
    targetId: itemId,
    parentId: null,
    body,
    createdAt: new Date(EPOCH - minutesAgo * 60_000).toISOString(),
    editedAt: null,
    deletedAt: null,
  });
}

function debate(groupId: string, userId: string): Promise<LightMyRequestResponse> {
  return app.inject({ method: 'GET', url: `/groups/${groupId}/debate`, headers: auth(userId) });
}

beforeEach(async () => {
  resetDb();
  app = await buildServer();
});

afterEach(async () => {
  await app.close();
});

describe('GET /groups/:groupId/debate', () => {
  it('picks the most-commented item the viewer can see', async () => {
    const alice = user('Alice');
    const bob = user('Bob');
    const groupId = group();
    member(groupId, alice.id);
    member(groupId, bob.id);

    const loud = item(bob.id, groupId, 'shared', 'Loud jacket');
    const quiet = item(alice.id, groupId, 'shared', 'Quiet boots');

    comment(loud.id, alice.id, groupId, 'one', 60);
    comment(loud.id, bob.id, groupId, 'two', 50);
    comment(loud.id, alice.id, groupId, 'three', 40);
    comment(quiet.id, alice.id, groupId, 'only me', 30);

    const res = await debate(groupId, alice.id);
    expect(res.statusCode).toBe(200);

    const body = res.json<GroupDebate>();
    expect(body.itemId).toBe(loud.id);
    expect(body.commentCount).toBe(3);
    expect(body.ownerId).toBe(bob.id);
    expect(body.thread.map((t) => t.body)).toEqual(['one', 'two', 'three']);
    expect(body.thread.map((t) => t.userName)).toEqual(['Alice', 'Bob', 'Alice']);
    // Participants are deduplicated and ordered by who spoke first.
    expect(body.participants.map((p) => p.id)).toEqual([alice.id, bob.id]);
    expect(body.verdict).toContain('Alice');
  });

  it('breaks a tie on distinct participants, then on the most recent message', async () => {
    const alice = user('Alice');
    const bob = user('Bob');
    const groupId = group();
    member(groupId, alice.id);
    member(groupId, bob.id);

    const solo = item(alice.id, groupId, 'shared', 'Solo');
    const social = item(alice.id, groupId, 'shared', 'Social');

    comment(solo.id, alice.id, groupId, 'a', 20);
    comment(solo.id, alice.id, groupId, 'b', 10);
    comment(social.id, alice.id, groupId, 'a', 60);
    comment(social.id, bob.id, groupId, 'b', 50);

    // Same count, but two people beat one even though the solo thread is more recent.
    const body = (await debate(groupId, alice.id)).json<GroupDebate>();
    expect(body.itemId).toBe(social.id);
  });

  it('never returns an item the viewer cannot see, even when it is the loudest', async () => {
    const alice = user('Alice');
    const bob = user('Bob');
    const groupId = group();
    member(groupId, alice.id);
    member(groupId, bob.id);

    const secret = item(bob.id, groupId, 'private', 'Secret socks');
    const shared = item(bob.id, groupId, 'shared', 'Loud jacket');

    comment(secret.id, bob.id, groupId, 'mine 1', 60);
    comment(secret.id, bob.id, groupId, 'mine 2', 50);
    comment(secret.id, bob.id, groupId, 'mine 3', 40);
    comment(shared.id, alice.id, groupId, 'ours', 30);

    const seen = (await debate(groupId, alice.id)).json<GroupDebate>();
    expect(seen.itemId).toBe(shared.id);
    expect(JSON.stringify(seen)).not.toContain('Secret socks');
    expect(JSON.stringify(seen)).not.toContain('mine 1');

    // The owner still gets their own thread back - it is the loudest one they can see.
    expect((await debate(groupId, bob.id)).json<GroupDebate>().itemId).toBe(secret.id);
  });

  it('ignores comments on another group and on soft-deleted rows', async () => {
    const alice = user('Alice');
    const ours = group('Ours');
    const theirs = group('Theirs');
    member(ours, alice.id);
    member(theirs, alice.id);

    const mine = item(alice.id, ours, 'shared', 'Mine');
    const other = item(alice.id, theirs, 'shared', 'Theirs');

    comment(mine.id, alice.id, ours, 'kept', 60);
    const gone = comment(mine.id, alice.id, ours, 'deleted', 50);
    db.comments.update((c) => c.id === gone.id, { deletedAt: now() });
    comment(other.id, alice.id, theirs, 'elsewhere 1', 40);
    comment(other.id, alice.id, theirs, 'elsewhere 2', 30);

    const body = (await debate(ours, alice.id)).json<GroupDebate>();
    expect(body.itemId).toBe(mine.id);
    expect(body.commentCount).toBe(1);
    expect(body.thread.map((t) => t.body)).toEqual(['kept']);
  });

  it('204s when nothing in the group has been commented on', async () => {
    const alice = user('Alice');
    const groupId = group();
    member(groupId, alice.id);
    item(alice.id, groupId, 'shared', 'Nobody cares');

    const res = await debate(groupId, alice.id);
    expect(res.statusCode).toBe(204);
    expect(res.body).toBe('');
  });

  it('never names the owner of an anonymously shared item', async () => {
    const alice = user('Alice');
    const bob = user('Bob');
    const groupId = group();
    member(groupId, alice.id);
    member(groupId, bob.id);

    const hidden = item(bob.id, groupId, 'anonymous', 'Unmarked box');
    comment(hidden.id, alice.id, groupId, 'whose is this', 60);
    comment(hidden.id, bob.id, groupId, 'no comment', 50);

    const body = (await debate(groupId, alice.id)).json<GroupDebate>();
    expect(body.itemId).toBe(hidden.id);
    expect(body.ownerId).toBeNull();
    // Bob is named as a commenter - speaking is deliberate - but never as the owner.
    expect(body.verdict).toContain('nobody will admit whose');

    // The owner sees themselves, as they do on a find.
    expect((await debate(groupId, bob.id)).json<GroupDebate>().ownerId).toBe(bob.id);
  });

  it('floors spanDays but never reports less than a day', async () => {
    const alice = user('Alice');
    const groupId = group();
    member(groupId, alice.id);
    const jacket = item(alice.id, groupId, 'shared', 'Loud jacket');

    comment(jacket.id, alice.id, groupId, 'morning', 90);
    comment(jacket.id, alice.id, groupId, 'evening', 10);

    // Eighty minutes apart, so the true span floors to zero.
    const sameDay = (await debate(groupId, alice.id)).json<GroupDebate>();
    expect(sameDay.spanDays).toBe(1);
    expect(sameDay.verdict).toContain('One day');

    comment(jacket.id, alice.id, groupId, 'much later', 60 * 24 * 2 + 200);
    const spread = (await debate(groupId, alice.id)).json<GroupDebate>();
    expect(spread.spanDays).toBe(2);
  });

  it('404s - never 403s - a non-member and an unknown group alike', async () => {
    const alice = user('Alice');
    const mallory = user('Mallory');
    const groupId = group();
    member(groupId, alice.id);
    const jacket = item(alice.id, groupId, 'shared', 'Loud jacket');
    comment(jacket.id, alice.id, groupId, 'ours', 10);

    for (const res of [await debate(groupId, mallory.id), await debate(newId(), alice.id)]) {
      expect(res.statusCode).toBe(404);
      expect(res.json<ApiError>().error.code).toBe('NOT_FOUND');
      expect(res.body).not.toContain('Loud jacket');
    }
  });
});

describe('the seeded demo argument', () => {
  beforeEach(() => {
    resetDb();
    seedDemoData();
    seedDemoComments();
  });

  it('makes the synth the computed winner over the other two threads', async () => {
    const body = (await debate(DEMO_GROUP_ID, DEMO_USER_IDS.kristina)).json<GroupDebate>();

    expect(body.itemId).toBe(DEMO_DEBATE_ITEM_ID);
    expect(body.name).toBe('Mother-25 Semi-Modular Synth');
    expect(body.ownerId).toBe(DEMO_USER_IDS.esh);
    expect(body.commentCount).toBe(13);
    expect(body.participants.map((p) => p.id).sort()).toEqual(
      [DEMO_USER_IDS.esh, DEMO_USER_IDS.kristina, DEMO_USER_IDS.madhav, DEMO_USER_IDS.sabina].sort(),
    );
    expect(body.spanDays).toBe(3);
    expect(body.verdict).toBe(
      'Three days, thirteen messages, four people deep — Sabina, Madhav and Kristina all had opinions, and Esh answered back.',
    );

    // It has to actually be the most commented, not just the one we seeded first.
    const others = ['item-madhav-04', 'item-kristina-26'].map(
      (id) => db.comments.filter((c) => c.targetId === id).length,
    );
    expect(others.every((count) => count < body.commentCount)).toBe(true);
  });

  it('renders as a real chat: in order, nested, and every message in the past', async () => {
    const body = (await debate(DEMO_GROUP_ID, DEMO_USER_IDS.kristina)).json<GroupDebate>();
    const ids = new Set(body.thread.map((t) => t.id));

    const timestamps = body.thread.map((t) => t.createdAt);
    expect([...timestamps].sort()).toEqual(timestamps);
    expect(timestamps.every((t) => Date.parse(t) < Date.now())).toBe(true);
    expect(body.thread.every((t) => t.body.length <= 140)).toBe(true);

    const replies = body.thread.filter((t) => t.parentId !== null);
    expect(replies.length).toBeGreaterThanOrEqual(3);
    for (const reply of replies) {
      // A reply must hang off a message in this same thread, and land after it.
      expect(ids.has(reply.parentId ?? '')).toBe(true);
      const parent = body.thread.find((t) => t.id === reply.parentId);
      expect(Date.parse(reply.createdAt)).toBeGreaterThan(Date.parse(parent?.createdAt ?? ''));
    }
  });

  it('is readable by every member and is idempotent', async () => {
    const before = db.comments.all().length;
    seedDemoComments();
    expect(db.comments.all()).toHaveLength(before);

    for (const userId of Object.values(DEMO_USER_IDS)) {
      const res = await debate(DEMO_GROUP_ID, userId);
      expect(res.statusCode).toBe(200);
      expect(res.json<GroupDebate>().itemId).toBe(DEMO_DEBATE_ITEM_ID);
    }
  });
});
