import type { FastifyInstance } from 'fastify';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

const picker = vi.hoisted(() => {
  process.env.VISA_MODE = 'mock';
  process.env.PASSKEY_MODE = 'confirm';
  return { prices: [] as number[] };
});

vi.mock('../src/ai/giftPicker.js', () => ({
  generatePicks: async (threadId: string) =>
    picker.prices.map((priceCents, i) => ({
      id: `${threadId}-pick-${i + 1}`,
      threadId,
      productName: SECRETS[i] ?? `Secret gift ${i}`,
      productUrl: `https://shop.example/secret-${i + 1}`,
      imageUrl: `https://img.example/secret-${i + 1}.jpg`,
      priceCents,
      merchant: 'Example',
      reason: `Rio hearted something like ${SECRETS[i]}.`,
      citedItemIds: ['item-1'],
      source: 'ai' as const,
      createdAt: new Date(Date.UTC(2026, 0, 1, 0, 0, i)).toISOString(),
    })),
}));

import { buildServer } from '../src/server.js';
import { db, now, resetDb } from '../src/db/index.js';
import type { Thread } from '../src/types/api.js';
import { resetMockVisa } from '../src/visa/mock.js';

/** Strings that must never reach the recipient before the reveal. */
const SECRETS = ['Marimekko throw', 'Losing pick A', 'Losing pick B'];

const GROUP = 'group-birthday-crew';
const RECIPIENT = 'user-rio';
const ORGANISER = 'user-ada';
const BO = 'user-bo';
const CY = 'user-cy';

const PEOPLE: [string, string][] = [
  [ORGANISER, 'Ada'],
  [BO, 'Bo'],
  [CY, 'Cy'],
  [RECIPIENT, 'Rio'],
];

let app: FastifyInstance;
let threadId: string;
let winningPickId: string;

function as(userId: string): { authorization: string } {
  return { authorization: `Bearer dev:${userId}` };
}

/** Every endpoint that touches a gift thread, as the recipient would call it. */
function recipientCalls(): { method: 'GET' | 'POST'; url: string; payload?: unknown }[] {
  return [
    { method: 'GET', url: `/threads/${threadId}` },
    { method: 'POST', url: `/threads/${threadId}/picks` },
    {
      method: 'POST',
      url: `/threads/${threadId}/picks/link`,
      payload: { url: 'https://shop.example/peek', priceCents: 1_000 },
    },
    { method: 'POST', url: `/threads/${threadId}/votes`, payload: { pickId: winningPickId } },
    { method: 'POST', url: `/threads/${threadId}/lock` },
    {
      method: 'POST',
      url: `/threads/${threadId}/contributions/me/approve`,
      payload: { confirm: true },
    },
    { method: 'POST', url: `/threads/${threadId}/contributions/me/opt-out` },
    { method: 'POST', url: `/threads/${threadId}/contributions/${BO}/remove` },
    { method: 'POST', url: `/threads/${threadId}/cancel` },
    { method: 'POST', url: `/threads/${threadId}/bought` },
    { method: 'POST', url: `/threads/${threadId}/reveal` },
  ];
}

async function callAsRecipient(call: { method: 'GET' | 'POST'; url: string; payload?: unknown }) {
  return app.inject({
    method: call.method,
    url: call.url,
    headers: as(RECIPIENT),
    ...(call.payload ? { payload: call.payload } : {}),
  });
}

beforeEach(async () => {
  resetDb();
  resetMockVisa();
  vi.restoreAllMocks();

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

  app = await buildServer();

  const created = await app.inject({
    method: 'POST',
    url: '/threads',
    headers: as(ORGANISER),
    payload: {
      groupId: GROUP,
      recipientId: RECIPIENT,
      budgetMinCents: 2_000,
      budgetMaxCents: 12_000,
    },
  });
  threadId = created.json<Thread>().id;
  await new Promise((resolve) => setImmediate(resolve));

  picker.prices = [9_000, 4_000, 6_000];
  const picks = await app.inject({
    method: 'POST',
    url: `/threads/${threadId}/picks`,
    headers: as(ORGANISER),
  });
  winningPickId = picks.json<{ id: string }[]>()[0]!.id;
});

afterEach(async () => {
  await app.close();
});

async function advanceToCollecting(): Promise<void> {
  await app.inject({
    method: 'POST',
    url: `/threads/${threadId}/votes`,
    headers: as(ORGANISER),
    payload: { pickId: winningPickId },
  });
  await app.inject({ method: 'POST', url: `/threads/${threadId}/lock`, headers: as(ORGANISER) });
}

async function advanceToRevealed(): Promise<void> {
  await advanceToCollecting();
  for (const userId of [ORGANISER, BO, CY]) {
    await app.inject({
      method: 'POST',
      url: `/threads/${threadId}/contributions/me/approve`,
      headers: as(userId),
      payload: { confirm: true },
    });
  }
  await app.inject({ method: 'POST', url: `/threads/${threadId}/bought`, headers: as(ORGANISER) });
  await app.inject({ method: 'POST', url: `/threads/${threadId}/reveal`, headers: as(ORGANISER) });
}

describe('the recipient can never see their own gift thread', () => {
  it('returns 404 - never 403 - from every thread endpoint while voting', async () => {
    for (const call of recipientCalls()) {
      const res = await callAsRecipient(call);
      expect(
        { url: call.url, status: res.statusCode },
        `${call.method} ${call.url} leaked`,
      ).toEqual({ url: call.url, status: 404 });
      expect(res.json<{ error: { code: string } }>().error.code).toBe('NOT_FOUND');
    }
  });

  it('returns 404 from every thread endpoint once money is moving', async () => {
    await advanceToCollecting();
    for (const call of recipientCalls()) {
      const res = await callAsRecipient(call);
      expect({ url: call.url, status: res.statusCode }).toEqual({ url: call.url, status: 404 });
    }
  });

  it('returns 404 from every thread endpoint even after the reveal', async () => {
    await advanceToRevealed();
    for (const call of recipientCalls()) {
      const res = await callAsRecipient(call);
      expect({ url: call.url, status: res.statusCode }).toEqual({ url: call.url, status: 404 });
    }
  });

  it('never leaks a pick name, price or contributor status in any response body', async () => {
    await advanceToCollecting();
    await app.inject({
      method: 'POST',
      url: `/threads/${threadId}/contributions/me/approve`,
      headers: as(BO),
      payload: { confirm: true },
    });

    const bodies: string[] = [];
    for (const call of [
      ...recipientCalls(),
      { method: 'GET' as const, url: `/groups/${GROUP}/threads` },
      { method: 'GET' as const, url: `/reveals/${threadId}` },
    ]) {
      bodies.push((await callAsRecipient(call)).body);
    }

    const combined = bodies.join('\n');
    for (const secret of SECRETS) expect(combined).not.toContain(secret);
    for (const leak of ['9000', '3000', 'pulled', 'winningPickId', 'contributions', threadId]) {
      expect(combined).not.toContain(leak);
    }
  });

  it('does not answer the recipient probing POST /threads for their own birthday', async () => {
    // The duplicate-thread 409 names the thread id so the organiser's UI can jump to it. If that
    // check runs before authorisation, the recipient can ask "does my gift exist?" and be told.
    const res = await app.inject({
      method: 'POST',
      url: '/threads',
      headers: as(RECIPIENT),
      payload: {
        groupId: GROUP,
        recipientId: RECIPIENT,
        budgetMinCents: 2_000,
        budgetMaxCents: 12_000,
      },
    });

    expect(res.statusCode).toBe(409);
    expect(res.json<{ threadId?: string }>().threadId).toBeUndefined();
    expect(res.body).not.toContain(threadId);
  });

  it('gives the recipient the same answer whether or not a thread exists', async () => {
    const probe = async () =>
      app.inject({
        method: 'POST',
        url: '/threads',
        headers: as(RECIPIENT),
        payload: {
          groupId: GROUP,
          recipientId: RECIPIENT,
          budgetMinCents: 2_000,
          budgetMaxCents: 12_000,
        },
      });

    const withThread = await probe();
    db.giftThreads.remove((t) => t.id === threadId);
    const withoutThread = await probe();

    expect(withThread.statusCode).toBe(withoutThread.statusCode);
    expect(withThread.body).toEqual(withoutThread.body);
  });

  it('does not let a non-member probe POST /threads for the group', async () => {
    db.users.insert({
      id: 'user-snoop',
      name: 'Snoop',
      avatarUrl: null,
      birthday: '1999-06-15',
      cardLast4: null,
      visaCardRef: null,
    });

    const res = await app.inject({
      method: 'POST',
      url: '/threads',
      headers: as('user-snoop'),
      payload: {
        groupId: GROUP,
        recipientId: RECIPIENT,
        budgetMinCents: 2_000,
        budgetMaxCents: 12_000,
      },
    });

    expect(res.statusCode).toBe(403);
    expect(res.json<{ threadId?: string }>().threadId).toBeUndefined();
    expect(res.body).not.toContain(threadId);
  });

  it('hides the thread from the group listing but shows it to everyone else', async () => {
    const theirs = await app.inject({
      method: 'GET',
      url: `/groups/${GROUP}/threads`,
      headers: as(RECIPIENT),
    });
    expect(theirs.statusCode).toBe(200);
    expect(theirs.json<Thread[]>()).toEqual([]);

    const others = await app.inject({
      method: 'GET',
      url: `/groups/${GROUP}/threads`,
      headers: as(CY),
    });
    expect(others.json<Thread[]>().map((t) => t.id)).toEqual([threadId]);
  });

  it('404s the reveal until the organiser has actually revealed', async () => {
    for (const stage of ['voting', 'collecting'] as const) {
      if (stage === 'collecting') await advanceToCollecting();
      const res = await app.inject({
        method: 'GET',
        url: `/reveals/${threadId}`,
        headers: as(RECIPIENT),
      });
      expect(res.statusCode).toBe(404);
    }
  });
});

describe('the reveal view is the recipient-safe projection', () => {
  it('returns only the gift name, image and contributor names', async () => {
    await advanceToRevealed();
    const res = await app.inject({
      method: 'GET',
      url: `/reveals/${threadId}`,
      headers: as(RECIPIENT),
    });

    expect(res.statusCode).toBe(200);
    const body = res.json<Record<string, unknown>>();
    expect(Object.keys(body).sort()).toEqual(['contributors', 'giftName', 'imageUrl']);
    expect(body).toEqual({
      giftName: SECRETS[0],
      imageUrl: 'https://img.example/secret-1.jpg',
      contributors: ['Ada', 'Bo', 'Cy'],
    });

    // No amounts, no votes, no losing picks.
    const raw = res.body;
    for (const losingPick of SECRETS.slice(1)) expect(raw).not.toContain(losingPick);
    expect(raw).not.toContain('3000');
    expect(raw).not.toContain('9000');
    expect(raw).not.toContain('voteCount');
  });

  it('keeps a non-member out of the reveal entirely', async () => {
    db.users.insert({
      id: 'user-outsider',
      name: 'Outsider',
      avatarUrl: null,
      birthday: null,
      cardLast4: null,
      visaCardRef: null,
    });
    await advanceToRevealed();

    const res = await app.inject({
      method: 'GET',
      url: `/reveals/${threadId}`,
      headers: as('user-outsider'),
    });
    expect(res.statusCode).toBe(404);
  });
});
