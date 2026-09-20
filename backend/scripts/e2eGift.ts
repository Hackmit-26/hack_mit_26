/**
 * `pnpm e2e:gift` - §14 integration script.
 *
 * Drives the whole gift flow in-process via app.inject() on the seeded demo group:
 *   happy path  -> thread reaches `revealed`, recipient gets 404 at every step
 *   cancel path -> every pulled contribution ends `refunded`
 *
 * Runs against whatever VISA_MODE is configured; the assertions hold for both.
 */
import assert from 'node:assert/strict';
import type { FastifyInstance } from 'fastify';
import { resetDb } from '../src/db/index.js';
import { seed } from '../src/db/seed.js';
import { buildServer } from '../src/server.js';
import type { Contribution, Thread } from '../src/types/api.js';

type Json = Record<string, unknown>;

let app: FastifyInstance;

function auth(userId: string): Record<string, string> {
  return { authorization: `Bearer dev:${userId}` };
}

async function call<T>(
  method: 'GET' | 'POST' | 'PATCH' | 'DELETE',
  url: string,
  userId: string,
  payload?: Json,
): Promise<{ status: number; body: T }> {
  const res = await app.inject({ method, url, headers: auth(userId), payload });
  const body = res.body ? (JSON.parse(res.body) as T) : (undefined as T);
  return { status: res.statusCode, body };
}

async function ok<T>(
  method: 'GET' | 'POST' | 'PATCH' | 'DELETE',
  url: string,
  userId: string,
  payload?: Json,
): Promise<T> {
  const { status, body } = await call<T>(method, url, userId, payload);
  if (status >= 300) {
    throw new Error(`${method} ${url} as ${userId} -> ${status} ${JSON.stringify(body)}`);
  }
  return body;
}

/**
 * `POST /threads` kicks off pick generation in the background, so the frontend just polls
 * `GET /threads/:id`. Calling `POST /threads/:id/picks` here instead would burn a regeneration.
 */
async function awaitPicks(threadId: string, userId: string): Promise<Thread['picks']> {
  for (let attempt = 0; attempt < 100; attempt++) {
    const thread = await ok<Thread>('GET', `/threads/${threadId}`, userId);
    if (thread.picks.length > 0) return thread.picks;
    await new Promise((resolve) => setTimeout(resolve, 100));
  }
  throw new Error(`picks never generated for ${threadId}`);
}

/** §14 recipient leak test: every thread-shaped endpoint must 404 for the recipient. */
async function assertRecipientBlind(threadId: string, recipientId: string): Promise<void> {
  const probes: [Parameters<typeof call>[0], string, Json | undefined][] = [
    ['GET', `/threads/${threadId}`, undefined],
    ['POST', `/threads/${threadId}/picks`, undefined],
    ['POST', `/threads/${threadId}/votes`, { pickId: 'anything' }],
    ['POST', `/threads/${threadId}/lock`, undefined],
    ['POST', `/threads/${threadId}/contributions/me/approve`, { confirm: true }],
    ['POST', `/threads/${threadId}/contributions/me/opt-out`, undefined],
    ['POST', `/threads/${threadId}/cancel`, undefined],
    ['POST', `/threads/${threadId}/bought`, undefined],
    ['POST', `/threads/${threadId}/reveal`, undefined],
  ];
  for (const [method, url, payload] of probes) {
    const { status, body } = await call<Json>(method, url, recipientId, payload);
    assert.equal(status, 404, `recipient leak: ${method} ${url} -> ${status} ${JSON.stringify(body)}`);
  }
}

async function happyPath(groupId: string, recipientId: string, contributors: string[]): Promise<void> {
  const [organiser, ...rest] = contributors;
  assert.ok(organiser, 'need at least one contributor');

  let thread = await ok<Thread>('POST', '/threads', organiser, {
    groupId,
    recipientId,
    budgetMinCents: 4000,
    budgetMaxCents: 12000,
  });
  assert.equal(thread.state, 'picking');
  await assertRecipientBlind(thread.id, recipientId);

  const dup = await call<Json>('POST', '/threads', organiser, {
    groupId,
    recipientId,
    budgetMinCents: 4000,
    budgetMaxCents: 12000,
  });
  assert.equal(dup.status, 409, 'second thread for the same recipient must 409');

  const picks = await awaitPicks(thread.id, organiser);
  assert.ok(picks.length >= 3, `expected >=3 picks, got ${picks.length}`);
  for (const pick of picks) {
    assert.ok(pick.citedItemIds.length > 0, `pick ${pick.id} cites no item (§1 rule 5)`);
    assert.ok(pick.priceCents >= 4000 && pick.priceCents <= 12000, `pick ${pick.id} out of budget`);
  }

  const winner = picks[0];
  assert.ok(winner);
  for (const userId of contributors) {
    await ok('POST', `/threads/${thread.id}/votes`, userId, { pickId: winner.id });
  }

  thread = await ok<Thread>('POST', `/threads/${thread.id}/lock`, organiser);
  assert.equal(thread.state, 'collecting');
  assert.equal(thread.winningPickId, winner.id);

  const total = thread.contributions.reduce((sum, c) => sum + (c.amountCents ?? 0), 0);
  assert.equal(total, winner.priceCents, 'split must sum to the pick price');

  for (const userId of contributors) {
    const c = await ok<Contribution>('POST', `/threads/${thread.id}/contributions/me/approve`, userId, {
      confirm: true,
    });
    assert.equal(c.status, 'pulled', `${userId} approve -> ${c.status}`);
    assert.ok(c.visaTxnId, `${userId} has no Visa txn id`);
  }

  thread = await ok<Thread>('GET', `/threads/${thread.id}`, organiser);
  assert.equal(thread.state, 'funded');
  assert.equal(thread.pushStatus, 'succeeded', 'pot must push to the organiser once funded');
  await assertRecipientBlind(thread.id, recipientId);

  const nonOrganiser = rest[0];
  if (nonOrganiser) {
    const forbidden = await call<Json>('POST', `/threads/${thread.id}/bought`, nonOrganiser);
    assert.equal(forbidden.status, 403, 'only the organiser can mark bought');
  }

  thread = await ok<Thread>('POST', `/threads/${thread.id}/bought`, organiser);
  assert.equal(thread.state, 'bought');

  const tooEarly = await call<Json>('GET', `/reveals/${thread.id}`, recipientId);
  assert.equal(tooEarly.status, 404, 'recipient must not see the reveal before it happens');

  thread = await ok<Thread>('POST', `/threads/${thread.id}/reveal`, organiser);
  assert.equal(thread.state, 'revealed');

  const reveal = await ok<{ giftName: string; contributors: string[] }>(
    'GET',
    `/reveals/${thread.id}`,
    recipientId,
  );
  assert.equal(reveal.giftName, winner.productName);
  assert.equal(reveal.contributors.length, contributors.length);

  console.log(`  happy path: revealed "${reveal.giftName}" funded by ${reveal.contributors.join(', ')}`);
}

async function cancelPath(groupId: string, recipientId: string, contributors: string[]): Promise<void> {
  const [organiser, second] = contributors;
  assert.ok(organiser && second, 'cancel path needs two contributors');

  let thread = await ok<Thread>('POST', '/threads', organiser, {
    groupId,
    recipientId,
    budgetMinCents: 4000,
    budgetMaxCents: 12000,
  });
  const picks = await awaitPicks(thread.id, organiser);
  const winner = picks[0];
  assert.ok(winner);
  await ok('POST', `/threads/${thread.id}/votes`, organiser, { pickId: winner.id });
  thread = await ok<Thread>('POST', `/threads/${thread.id}/lock`, organiser);

  // Only two of the contributors pay, then the organiser pulls the plug.
  for (const userId of [organiser, second]) {
    const c = await ok<Contribution>('POST', `/threads/${thread.id}/contributions/me/approve`, userId, {
      confirm: true,
    });
    assert.equal(c.status, 'pulled');
  }

  thread = await ok<Thread>('POST', `/threads/${thread.id}/cancel`, organiser);
  assert.ok(
    thread.state === 'refunding' || thread.state === 'refunded',
    `cancel mid-collecting -> ${thread.state}`,
  );

  thread = await ok<Thread>('GET', `/threads/${thread.id}`, organiser);
  assert.equal(thread.state, 'refunded', 'every pull must be reversed (§1 rule 6)');
  for (const c of thread.contributions) {
    assert.ok(
      c.status === 'refunded' || c.status === 'pending',
      `contribution for ${c.userId} left in ${c.status}`,
    );
  }
  const refunded = thread.contributions.filter((c) => c.status === 'refunded');
  assert.equal(refunded.length, 2, 'both pulled shares must be refunded');

  console.log(`  cancel path: ${refunded.length} shares refunded, thread ${thread.state}`);
}

async function main(): Promise<void> {
  resetDb();
  const { groupId, userIds } = seed();
  app = await buildServer();

  const [recipient, ...contributors] = userIds;
  assert.ok(recipient, 'seed must produce users');
  assert.ok(contributors.length >= 3, `need >=3 contributors, got ${contributors.length}`);

  console.log('e2e:gift');
  await happyPath(groupId, recipient, contributors);
  await cancelPath(groupId, recipient, contributors);

  await app.close();
  console.log('e2e:gift OK');
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
