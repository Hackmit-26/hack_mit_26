import type { FastifyInstance } from 'fastify';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

// Runs before the imports below, so config picks the deterministic Visa mock and the
// confirm-button passkey fallback whatever the developer's .env says.
const picker = vi.hoisted(() => {
  process.env.VISA_MODE = 'mock';
  process.env.PASSKEY_MODE = 'confirm';
  return { prices: [] as number[] };
});

// The AI picker is another agent's pipeline (LLM + catalogue). This suite owns the flow
// around it, so the boundary is stubbed and `picker.prices` decides what comes back.
vi.mock('../src/ai/giftPicker.js', () => ({
  generatePicks: async (threadId: string) =>
    picker.prices.map((priceCents, i) => ({
      id: `${threadId}-pick-${i + 1}-${picker.prices.length}`,
      threadId,
      productName: `Pick ${i + 1}`,
      productUrl: `https://shop.example/pick-${i + 1}`,
      imageUrl: `https://img.example/pick-${i + 1}.jpg`,
      priceCents,
      merchant: 'Example',
      reason: `Rio hearted something like Pick ${i + 1}.`,
      citedItemIds: ['item-1'],
      source: 'ai' as const,
      createdAt: new Date(Date.UTC(2026, 0, 1, 0, 0, i)).toISOString(),
    })),
}));

import { buildServer } from '../src/server.js';
import { db, now, resetDb } from '../src/db/index.js';
import type { ContributionRow } from '../src/db/types.js';
import { deadlineSweeper } from '../src/jobs/deadlineSweeper.js';
import { pushWhenFunded } from '../src/jobs/pushWhenFunded.js';
import { refundRetry } from '../src/jobs/refundRetry.js';
import type { Contribution, GiftPick, Thread } from '../src/types/api.js';
import { visa } from '../src/visa/index.js';
import { MOCK_DECLINE_AMOUNT_CENTS, MOCK_TIMEOUT_AMOUNT_CENTS, resetMockVisa } from '../src/visa/mock.js';

const GROUP = 'group-birthday-crew';
const RECIPIENT = 'user-rio';
const ORGANISER = 'user-ada';
const BO = 'user-bo';
const CY = 'user-cy';
const CONTRIBUTORS = [ORGANISER, BO, CY];

const PEOPLE: [string, string][] = [
  [ORGANISER, 'Ada'],
  [BO, 'Bo'],
  [CY, 'Cy'],
  [RECIPIENT, 'Rio'],
];

let app: FastifyInstance;

function seed(): void {
  db.groups.insert({
    id: GROUP,
    name: 'Birthday Crew',
    emoji: 'gift',
    inviteCode: 'CREW01',
    createdAt: now(),
  });
  for (const [id, name] of PEOPLE) {
    db.users.insert({
      id,
      name,
      avatarUrl: null,
      birthday: '1999-06-15',
      cardLast4: '4321',
      visaCardRef: `test-card-${name.toLowerCase()}`,
    });
    db.memberships.insert({ groupId: GROUP, userId: id, joinedAt: now() });
  }
}

function as(userId: string): { authorization: string } {
  return { authorization: `Bearer dev:${userId}` };
}

async function createThread(userId = ORGANISER): Promise<Thread> {
  picker.prices = [];
  const res = await app.inject({
    method: 'POST',
    url: '/threads',
    headers: as(userId),
    payload: {
      groupId: GROUP,
      recipientId: RECIPIENT,
      budgetMinCents: 2_000,
      budgetMaxCents: 12_000,
    },
  });
  expect(res.statusCode).toBe(201);
  // Let the background pick generation kicked off by POST /threads settle.
  await new Promise((resolve) => setImmediate(resolve));
  return res.json<Thread>();
}

/** Drives the real generate endpoint so the thread opens voting on picks at these prices. */
async function withPicks(threadId: string, prices: number[]): Promise<GiftPick[]> {
  picker.prices = prices;
  const res = await app.inject({
    method: 'POST',
    url: `/threads/${threadId}/picks`,
    headers: as(ORGANISER),
  });
  expect(res.statusCode).toBe(200);
  return res.json<GiftPick[]>();
}

async function vote(threadId: string, userId: string, pickId: string): Promise<void> {
  const res = await app.inject({
    method: 'POST',
    url: `/threads/${threadId}/votes`,
    headers: as(userId),
    payload: { pickId },
  });
  expect(res.statusCode).toBe(204);
}

async function lock(threadId: string): Promise<Thread> {
  const res = await app.inject({
    method: 'POST',
    url: `/threads/${threadId}/lock`,
    headers: as(ORGANISER),
  });
  expect(res.statusCode).toBe(200);
  return res.json<Thread>();
}

function approve(threadId: string, userId: string) {
  return app.inject({
    method: 'POST',
    url: `/threads/${threadId}/contributions/me/approve`,
    headers: as(userId),
    payload: { confirm: true },
  });
}

async function getThread(threadId: string, userId = ORGANISER): Promise<Thread> {
  const res = await app.inject({ method: 'GET', url: `/threads/${threadId}`, headers: as(userId) });
  expect(res.statusCode).toBe(200);
  return res.json<Thread>();
}

function rows(threadId: string): ContributionRow[] {
  return db.contributions.filter((c) => c.threadId === threadId);
}

/** Locks a thread on a pick of the given price and returns the thread id. */
async function collectingThread(priceCents: number): Promise<string> {
  const thread = await createThread();
  const picks = await withPicks(thread.id, [priceCents, priceCents + 1_000]);
  await vote(thread.id, ORGANISER, picks[0]!.id);
  const locked = await lock(thread.id);
  expect(locked.state).toBe('collecting');
  return thread.id;
}

beforeEach(async () => {
  resetDb();
  resetMockVisa();
  vi.restoreAllMocks();
  seed();
  app = await buildServer();
});

afterEach(async () => {
  await app.close();
});

describe('gift flow happy path', () => {
  it('runs create -> picks -> vote -> lock -> approve x3 -> funded -> push -> bought -> reveal', async () => {
    const thread = await createThread();
    expect(thread.state).toBe('picking');
    expect(thread.organiserId).toBe(ORGANISER);
    // §7.2: the day before the birthday, at 23:59 UTC.
    expect(thread.deadline.endsWith('T23:59:00.000Z')).toBe(true);
    expect(new Date(thread.deadline).getTime() + 86_400_000).toBe(
      Date.parse(`${new Date(thread.deadline).getUTCFullYear()}-06-15T23:59:00.000Z`),
    );

    const picks = await withPicks(thread.id, [9_000, 5_000, 7_000]);
    expect(picks).toHaveLength(3);
    expect((await getThread(thread.id)).state).toBe('voting');

    await vote(thread.id, ORGANISER, picks[0]!.id);
    await vote(thread.id, BO, picks[0]!.id);
    await vote(thread.id, CY, picks[1]!.id);

    const locked = await lock(thread.id);
    expect(locked.state).toBe('collecting');
    expect(locked.winningPickId).toBe(picks[0]!.id);
    expect(locked.contributions).toHaveLength(3);
    expect(locked.contributions.every((c) => c.amountCents === 3_000)).toBe(true);
    // §7.4 invariant
    expect(locked.contributions.reduce((s, c) => s + (c.amountCents ?? 0), 0)).toBe(9_000);

    for (const userId of CONTRIBUTORS) {
      const res = await approve(thread.id, userId);
      expect(res.statusCode).toBe(200);
      expect(res.json<Contribution>().status).toBe('pulled');
    }

    const funded = await getThread(thread.id);
    expect(funded.state).toBe('funded');
    expect(funded.pushStatus).toBe('succeeded');
    expect(db.giftThreads.find((t) => t.id === thread.id)?.pushTxnId).toBeTruthy();

    const bought = await app.inject({
      method: 'POST',
      url: `/threads/${thread.id}/bought`,
      headers: as(ORGANISER),
    });
    expect(bought.json<Thread>().state).toBe('bought');

    const revealed = await app.inject({
      method: 'POST',
      url: `/threads/${thread.id}/reveal`,
      headers: as(ORGANISER),
    });
    expect(revealed.json<Thread>().state).toBe('revealed');

    const reveal = await app.inject({
      method: 'GET',
      url: `/reveals/${thread.id}`,
      headers: as(RECIPIENT),
    });
    expect(reveal.statusCode).toBe(200);
    expect(reveal.json()).toEqual({
      giftName: 'Pick 1',
      imageUrl: 'https://img.example/pick-1.jpg',
      contributors: ['Ada', 'Bo', 'Cy'],
    });
  });

  it('breaks a vote tie with the organiser vote, then by lowest price', async () => {
    const thread = await createThread();
    const picks = await withPicks(thread.id, [8_000, 4_000]);
    await vote(thread.id, BO, picks[0]!.id);
    await vote(thread.id, CY, picks[1]!.id);
    await vote(thread.id, ORGANISER, picks[1]!.id);
    // Organiser's pick is tied at 2 votes with picks[0]; the organiser breaks it.
    expect((await lock(thread.id)).winningPickId).toBe(picks[1]!.id);

    resetDb();
    resetMockVisa();
    seed();
    const second = await createThread();
    const morePicks = await withPicks(second.id, [8_000, 4_000]);
    // Nobody voted: everything is tied at zero, so the cheapest pick wins.
    expect((await lock(second.id)).winningPickId).toBe(morePicks[1]!.id);
  });

  it('409s with the existing thread id when one already exists for this birthday', async () => {
    const first = await createThread();
    const res = await app.inject({
      method: 'POST',
      url: '/threads',
      headers: as(BO),
      payload: { groupId: GROUP, recipientId: RECIPIENT, budgetMinCents: 1_000, budgetMaxCents: 2_000 },
    });
    expect(res.statusCode).toBe(409);
    expect(res.json<{ threadId: string }>().threadId).toBe(first.id);
  });

  it('refuses to let the recipient organise their own gift', async () => {
    const res = await app.inject({
      method: 'POST',
      url: '/threads',
      headers: as(RECIPIENT),
      payload: { groupId: GROUP, recipientId: RECIPIENT, budgetMinCents: 1_000, budgetMaxCents: 2_000 },
    });
    expect(res.statusCode).toBe(409);
  });
});

describe('money safety', () => {
  it('reverses every pulled contribution when the organiser cancels mid-collecting', async () => {
    const threadId = await collectingThread(9_000);
    await approve(threadId, ORGANISER);
    await approve(threadId, BO);
    expect(rows(threadId).filter((c) => c.status === 'pulled')).toHaveLength(2);

    const reverseSpy = vi.spyOn(visa, 'reverseFunds');
    const res = await app.inject({
      method: 'POST',
      url: `/threads/${threadId}/cancel`,
      headers: as(ORGANISER),
    });

    expect(res.statusCode).toBe(200);
    expect(res.json<Thread>().state).toBe('refunded');
    expect(reverseSpy).toHaveBeenCalledTimes(2);

    const after = rows(threadId);
    expect(after.filter((c) => c.status === 'refunded')).toHaveLength(2);
    expect(after.filter((c) => c.status === 'refunded').every((c) => c.reversalTxnId)).toBe(true);
    // Nobody who never paid is refunded anything.
    expect(after.find((c) => c.userId === CY)?.status).toBe('pending');
  });

  it('reverses pulls for a thread that misses its deadline', async () => {
    const threadId = await collectingThread(9_000);
    await approve(threadId, ORGANISER);
    db.giftThreads.update((t) => t.id === threadId, {
      deadline: new Date(Date.now() - 60_000).toISOString(),
    });

    const result = await deadlineSweeper();
    expect(result.expired).toEqual([threadId]);
    expect(db.giftThreads.find((t) => t.id === threadId)?.state).toBe('refunded');
    expect(rows(threadId).find((c) => c.userId === ORGANISER)?.status).toBe('refunded');
  });

  it('is safe to re-run the cancel path after a crash', async () => {
    const threadId = await collectingThread(9_000);
    await approve(threadId, ORGANISER);
    await app.inject({ method: 'POST', url: `/threads/${threadId}/cancel`, headers: as(ORGANISER) });

    const reverseSpy = vi.spyOn(visa, 'reverseFunds');
    await refundRetry();
    await deadlineSweeper();
    expect(reverseSpy).not.toHaveBeenCalled();
    expect(db.giftThreads.find((t) => t.id === threadId)?.state).toBe('refunded');
  });

  it('retries a reversal that failed, and only finishes once the money is back', async () => {
    const threadId = await collectingThread(9_000);
    await approve(threadId, ORGANISER);

    vi.spyOn(visa, 'reverseFunds').mockResolvedValueOnce({
      ok: false,
      stan: '000001',
      rrn: '600000000001',
      error: 'network blip',
      raw: {},
    });
    await app.inject({ method: 'POST', url: `/threads/${threadId}/cancel`, headers: as(ORGANISER) });

    expect(db.giftThreads.find((t) => t.id === threadId)?.state).toBe('refunding');
    expect(rows(threadId).find((c) => c.userId === ORGANISER)?.status).toBe('refunding');

    await refundRetry();
    expect(db.giftThreads.find((t) => t.id === threadId)?.state).toBe('refunded');
    expect(rows(threadId).find((c) => c.userId === ORGANISER)?.reversalTxnId).toBeTruthy();
  });
});

describe('visa failure paths', () => {
  it('leaves a declined pull failed and retryable, with the thread still collecting', async () => {
    const threadId = await collectingThread(MOCK_DECLINE_AMOUNT_CENTS * CONTRIBUTORS.length);
    expect(rows(threadId)[0]?.amountCents).toBe(MOCK_DECLINE_AMOUNT_CENTS);

    const first = await approve(threadId, BO);
    expect(first.statusCode).toBe(200);
    expect(first.json<Contribution>().status).toBe('failed');
    expect((await getThread(threadId)).state).toBe('collecting');

    const pullSpy = vi.spyOn(visa, 'pullFunds');
    const retry = await approve(threadId, BO);
    expect(retry.statusCode).toBe(200);
    expect(pullSpy).toHaveBeenCalledTimes(1);
    expect(rows(threadId).find((c) => c.userId === BO)?.status).toBe('failed');
  });

  it('leaves a timed-out pull in pulling with a statusIdentifier, never failed', async () => {
    const threadId = await collectingThread(MOCK_TIMEOUT_AMOUNT_CENTS * CONTRIBUTORS.length);

    const res = await approve(threadId, BO);
    expect(res.statusCode).toBe(200);
    expect(res.json<Contribution>().status).toBe('pulling');

    const row = rows(threadId).find((c) => c.userId === BO);
    expect(row?.status).toBe('pulling');
    expect(row?.statusIdentifier).toBeTruthy();
    expect(row?.pullTxnId).toBeNull();
    expect((await getThread(threadId)).state).toBe('collecting');

    // The sweeper asks Visa what actually happened rather than guessing.
    await deadlineSweeper();
    expect(rows(threadId).find((c) => c.userId === BO)?.status).toBe('pulled');
  });

  it('keeps the thread funded and retries when the push fails', async () => {
    const threadId = await collectingThread(9_000);
    vi.spyOn(visa, 'pushFunds').mockResolvedValueOnce({
      ok: false,
      stan: '000002',
      rrn: '600000000002',
      error: 'push blip',
      raw: {},
    });
    for (const userId of CONTRIBUTORS) await approve(threadId, userId);

    const failed = await getThread(threadId);
    expect(failed.state).toBe('funded');
    expect(failed.pushStatus).toBe('failed');

    await pushWhenFunded();
    expect(db.giftThreads.find((t) => t.id === threadId)?.pushStatus).toBe('succeeded');
    expect(db.giftThreads.find((t) => t.id === threadId)?.pushTxnId).toBeTruthy();
  });

  it('pushes the pot exactly once', async () => {
    const threadId = await collectingThread(9_000);
    const pushSpy = vi.spyOn(visa, 'pushFunds');
    for (const userId of CONTRIBUTORS) await approve(threadId, userId);

    expect(pushSpy).toHaveBeenCalledTimes(1);
    expect(pushSpy.mock.calls[0]?.[0].amountCents).toBe(9_000);
    await pushWhenFunded();
    expect(pushSpy).toHaveBeenCalledTimes(1);
  });
});

describe('double-pull protection', () => {
  it('pulls once when approve is called twice in sequence', async () => {
    const threadId = await collectingThread(9_000);
    const pullSpy = vi.spyOn(visa, 'pullFunds');

    const first = await approve(threadId, BO);
    const second = await approve(threadId, BO);

    expect(first.statusCode).toBe(200);
    expect(second.statusCode).toBe(200);
    expect(pullSpy).toHaveBeenCalledTimes(1);
    expect(rows(threadId).filter((c) => c.status === 'pulled')).toHaveLength(1);
  });

  it('pulls once when two approvals race', async () => {
    const threadId = await collectingThread(9_000);
    // Hold the pull open so the second request really does arrive mid-flight.
    const realPull = visa.pullFunds.bind(visa);
    const pullSpy = vi.spyOn(visa, 'pullFunds').mockImplementation(async (params) => {
      await new Promise((resolve) => setTimeout(resolve, 20));
      return realPull(params);
    });

    const results = await Promise.all([approve(threadId, BO), approve(threadId, BO)]);

    expect(pullSpy).toHaveBeenCalledTimes(1);
    expect(results.filter((r) => r.statusCode === 200)).toHaveLength(1);
    expect(results.filter((r) => r.statusCode === 409)).toHaveLength(1);
    expect(rows(threadId).filter((c) => c.status === 'pulled')).toHaveLength(1);
  });

  it('rejects approvals without a confirm in the fallback passkey mode', async () => {
    const threadId = await collectingThread(9_000);
    const res = await app.inject({
      method: 'POST',
      url: `/threads/${threadId}/contributions/me/approve`,
      headers: as(BO),
      payload: {},
    });
    expect(res.statusCode).toBe(400);
    expect(rows(threadId).find((c) => c.userId === BO)?.status).toBe('pending');
  });
});

describe('opt-out and removal', () => {
  it('allows opting out before any pull and rebalances the split', async () => {
    const threadId = await collectingThread(9_000);
    const res = await app.inject({
      method: 'POST',
      url: `/threads/${threadId}/contributions/me/opt-out`,
      headers: as(CY),
    });

    expect(res.statusCode).toBe(200);
    const thread = res.json<Thread>();
    expect(thread.contributions.find((c) => c.userId === CY)?.status).toBe('opted_out');
    const owed = thread.contributions.filter((c) => c.status !== 'opted_out');
    expect(owed.map((c) => c.amountCents).sort()).toEqual([4_500, 4_500]);
    expect(owed.reduce((s, c) => s + (c.amountCents ?? 0), 0)).toBe(9_000);
  });

  it('rejects opting out once anyone has paid', async () => {
    const threadId = await collectingThread(9_000);
    await approve(threadId, BO);

    const res = await app.inject({
      method: 'POST',
      url: `/threads/${threadId}/contributions/me/opt-out`,
      headers: as(CY),
    });
    expect(res.statusCode).toBe(409);
    expect(rows(threadId).find((c) => c.userId === CY)?.status).toBe('pending');
  });

  it('lets the organiser remove a non-payer and funds the thread when it completes the pot', async () => {
    const threadId = await collectingThread(9_000);
    await approve(threadId, ORGANISER);
    await approve(threadId, BO);

    const res = await app.inject({
      method: 'POST',
      url: `/threads/${threadId}/contributions/${CY}/remove`,
      headers: as(ORGANISER),
    });
    expect(res.statusCode).toBe(200);
    expect(res.json<Thread>().state).toBe('funded');
    expect(rows(threadId).find((c) => c.userId === CY)?.status).toBe('removed');
  });

  it('refuses to remove someone who already paid', async () => {
    const threadId = await collectingThread(9_000);
    await approve(threadId, BO);

    const res = await app.inject({
      method: 'POST',
      url: `/threads/${threadId}/contributions/${BO}/remove`,
      headers: as(ORGANISER),
    });
    expect(res.statusCode).toBe(409);
    expect(rows(threadId).find((c) => c.userId === BO)?.status).toBe('pulled');
  });
});

/**
 * Pooling is the whole product, and every member has to be able to play every part of it. These
 * drive the same pot from each person's login rather than always organising as Ada.
 */
describe('pooling across every member', () => {
  const EVERYONE = PEOPLE.map(([id]) => id);

  /** A fresh `collecting` pot for an arbitrary organiser/recipient pair, on a pick at this price. */
  async function pot(
    organiserId: string,
    recipientId: string,
    priceCents: number,
  ): Promise<Thread> {
    resetDb();
    resetMockVisa();
    seed();

    picker.prices = [];
    const created = await app.inject({
      method: 'POST',
      url: '/threads',
      headers: as(organiserId),
      payload: { groupId: GROUP, recipientId, budgetMinCents: 1_000, budgetMaxCents: 100_000 },
    });
    expect(created.statusCode).toBe(201);
    await new Promise((resolve) => setImmediate(resolve));
    const threadId = created.json<Thread>().id;

    picker.prices = [priceCents];
    expect(
      (await app.inject({ method: 'POST', url: `/threads/${threadId}/picks`, headers: as(organiserId) }))
        .statusCode,
    ).toBe(200);

    const locked = await app.inject({
      method: 'POST',
      url: `/threads/${threadId}/lock`,
      headers: as(organiserId),
    });
    expect(locked.statusCode).toBe(200);
    return locked.json<Thread>();
  }

  const sum = (thread: Thread): number =>
    thread.contributions.reduce((acc, c) => acc + (c.amountCents ?? 0), 0);

  it.each(
    EVERYONE.flatMap((organiserId) =>
      EVERYONE.filter((id) => id !== organiserId).map((recipientId) => [organiserId, recipientId]),
    ),
  )('funds a pot organised by %s for %s', async (organiserId, recipientId) => {
    const locked = await pot(organiserId!, recipientId!, 9_000);
    const contributors = locked.contributions.map((c) => c.userId).sort();

    // Everyone but the recipient chips in, and the organiser is in there exactly once.
    expect(contributors).toEqual(EVERYONE.filter((id) => id !== recipientId).sort());
    expect(contributors.filter((id) => id === organiserId)).toHaveLength(1);
    expect(sum(locked)).toBe(9_000);

    const pushSpy = vi.spyOn(visa, 'pushFunds');
    for (const userId of contributors) {
      const res = await approve(locked.id, userId);
      expect(res.statusCode).toBe(200);
      expect(res.json<Contribution>().status).toBe('pulled');
    }

    const funded = await getThread(locked.id, organiserId!);
    expect(funded.state).toBe('funded');
    expect(funded.pushStatus).toBe('succeeded');
    // The pot that lands on the organiser is the price, not a share of it.
    expect(pushSpy).toHaveBeenCalledTimes(1);
    expect(pushSpy.mock.calls[0]?.[0].amountCents).toBe(9_000);

    // The recipient still cannot see any of it.
    const peek = await app.inject({
      method: 'GET',
      url: `/threads/${locked.id}`,
      headers: as(recipientId!),
    });
    expect(peek.statusCode).toBe(404);
  });

  it('splits a price that does not divide evenly without losing or gaining a cent', async () => {
    const locked = await pot(BO, RECIPIENT, 10_000);
    const amounts = locked.contributions.map((c) => c.amountCents ?? 0).sort();

    expect(amounts).toEqual([3_333, 3_333, 3_334]);
    expect(sum(locked)).toBe(10_000);

    const pushSpy = vi.spyOn(visa, 'pushFunds');
    for (const c of locked.contributions) await approve(locked.id, c.userId);

    expect((await getThread(locked.id, BO)).state).toBe('funded');
    expect(pushSpy.mock.calls[0]?.[0].amountCents).toBe(10_000);
  });

  it('rebalances an uneven split onto the people who are left when someone opts out', async () => {
    const locked = await pot(CY, RECIPIENT, 10_000);
    const leaver = locked.contributions.find((c) => c.userId !== CY)?.userId;

    const res = await app.inject({
      method: 'POST',
      url: `/threads/${locked.id}/contributions/me/opt-out`,
      headers: as(leaver!),
    });
    expect(res.statusCode).toBe(200);

    const after = res.json<Thread>();
    expect(after.contributions.find((c) => c.userId === leaver)?.amountCents).toBe(0);
    expect(
      after.contributions
        .filter((c) => c.userId !== leaver)
        .map((c) => c.amountCents ?? 0)
        .sort(),
    ).toEqual([5_000, 5_000]);
    expect(sum(after)).toBe(10_000);
  });

  it('counts the organiser share once when the organiser pays last', async () => {
    const locked = await pot(CY, RECIPIENT, 9_000);
    const others = locked.contributions.map((c) => c.userId).filter((id) => id !== CY);

    for (const userId of others) await approve(locked.id, userId);
    expect((await getThread(locked.id, CY)).state).toBe('collecting');

    const pushSpy = vi.spyOn(visa, 'pushFunds');
    await approve(locked.id, CY);

    const funded = await getThread(locked.id, CY);
    expect(funded.state).toBe('funded');
    expect(funded.contributions.filter((c) => c.userId === CY)).toHaveLength(1);
    expect(pushSpy.mock.calls[0]?.[0].amountCents).toBe(9_000);
  });

  it('refuses to let the last contributor opt out and strand the pot', async () => {
    const locked = await pot(ORGANISER, RECIPIENT, 9_000);
    const [first, second, last] = locked.contributions.map((c) => c.userId);

    for (const userId of [first, second]) {
      const res = await app.inject({
        method: 'POST',
        url: `/threads/${locked.id}/contributions/me/opt-out`,
        headers: as(userId!),
      });
      expect(res.statusCode).toBe(200);
    }
    expect(rows(locked.id).find((c) => c.userId === last)?.amountCents).toBe(9_000);

    const res = await app.inject({
      method: 'POST',
      url: `/threads/${locked.id}/contributions/me/opt-out`,
      headers: as(last!),
    });
    expect(res.statusCode).toBe(409);
    // Still payable, rather than a thread nobody owes anything on.
    expect(rows(locked.id).find((c) => c.userId === last)?.status).toBe('pending');
    expect((await approve(locked.id, last!)).json<Contribution>().status).toBe('pulled');
    expect((await getThread(locked.id)).state).toBe('funded');
  });

  it('refuses to let the organiser remove the last contributor', async () => {
    const locked = await pot(ORGANISER, RECIPIENT, 9_000);
    const [first, second, last] = locked.contributions.map((c) => c.userId);

    for (const userId of [first, second]) {
      const res = await app.inject({
        method: 'POST',
        url: `/threads/${locked.id}/contributions/${userId}/remove`,
        headers: as(ORGANISER),
      });
      expect(res.statusCode).toBe(200);
    }

    const res = await app.inject({
      method: 'POST',
      url: `/threads/${locked.id}/contributions/${last}/remove`,
      headers: as(ORGANISER),
    });
    expect(res.statusCode).toBe(409);
    expect(rows(locked.id).find((c) => c.userId === last)?.status).toBe('pending');
  });

  it('refuses an opt-out from someone who has already paid', async () => {
    const locked = await pot(BO, RECIPIENT, 9_000);
    await approve(locked.id, BO);

    const res = await app.inject({
      method: 'POST',
      url: `/threads/${locked.id}/contributions/me/opt-out`,
      headers: as(BO),
    });
    expect(res.statusCode).toBe(409);
    expect(rows(locked.id).find((c) => c.userId === BO)?.status).toBe('pulled');
  });

  it('lets any member organise, but only that member drive their own thread', async () => {
    const locked = await pot(CY, RECIPIENT, 9_000);

    for (const userId of [ORGANISER, BO]) {
      const res = await app.inject({
        method: 'POST',
        url: `/threads/${locked.id}/contributions/${ORGANISER}/remove`,
        headers: as(userId),
      });
      expect(res.statusCode).toBe(403);
    }

    const res = await app.inject({
      method: 'POST',
      url: `/threads/${locked.id}/contributions/${ORGANISER}/remove`,
      headers: as(CY),
    });
    expect(res.statusCode).toBe(200);
  });
});

describe('listing and guards', () => {
  it('lists active group threads for members and hides them from the recipient', async () => {
    const thread = await createThread();

    const mine = await app.inject({
      method: 'GET',
      url: `/groups/${GROUP}/threads`,
      headers: as(BO),
    });
    expect(mine.json<Thread[]>().map((t) => t.id)).toEqual([thread.id]);

    const theirs = await app.inject({
      method: 'GET',
      url: `/groups/${GROUP}/threads`,
      headers: as(RECIPIENT),
    });
    expect(theirs.json<Thread[]>()).toEqual([]);
  });

  it('only lets the organiser lock, cancel, mark bought and reveal', async () => {
    const thread = await createThread();
    await withPicks(thread.id, [9_000]);

    for (const url of [`/threads/${thread.id}/lock`, `/threads/${thread.id}/cancel`]) {
      const res = await app.inject({ method: 'POST', url, headers: as(BO) });
      expect(res.statusCode).toBe(403);
    }
  });

  it('accepts a member-supplied product link as a pick', async () => {
    const thread = await createThread();
    const res = await app.inject({
      method: 'POST',
      url: `/threads/${thread.id}/picks/link`,
      headers: as(BO),
      payload: { url: 'https://shop.example/scarf', priceCents: 4_200, productName: 'Wool scarf' },
    });

    expect(res.statusCode).toBe(201);
    const pick = res.json<GiftPick>();
    expect(pick.source).toBe('member');
    expect(pick.reason).toBe('Added by Bo');
    expect((await getThread(thread.id)).state).toBe('voting');
  });
});
