import type { FastifyInstance } from 'fastify';
import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import { db, now, resetDb } from '../src/db/index.js';
import { buildServer } from '../src/server.js';

const USER = 'user-envelope';

let app: FastifyInstance;

beforeEach(async () => {
  resetDb();
  db.users.insert({
    id: USER,
    name: 'Envelope',
    avatarUrl: null,
    birthday: null,
    cardLast4: null,
    visaCardRef: null,
  });
  db.groups.insert({
    id: 'group-envelope',
    name: 'Envelope',
    emoji: '✉️',
    inviteCode: 'ENVELOPE',
    createdAt: now(),
  });
  app = await buildServer();
});

afterEach(async () => {
  await app.close();
});

const auth = { authorization: `Bearer ${USER}` };

/**
 * Fastify rejects an unparseable body before any route handler runs, so the failure never reaches
 * a zod schema. Without an explicit branch for it, a caller's bad JSON reads as a server crash.
 */
describe('framework-level 4xx', () => {
  it('answers a malformed JSON body with 400 and the agreed envelope', async () => {
    const response = await app.inject({
      method: 'PATCH',
      url: '/me',
      headers: { ...auth, 'content-type': 'application/json' },
      payload: '{oops',
    });

    expect(response.statusCode).toBe(400);
    expect(response.json<{ error: { code: string } }>().error.code).toBe('VALIDATION_ERROR');
  });

  it('answers an empty JSON body with 400, not 500', async () => {
    const response = await app.inject({
      method: 'POST',
      url: '/groups',
      headers: { ...auth, 'content-type': 'application/json' },
      payload: '',
    });

    expect(response.statusCode).toBe(400);
    expect(response.json<{ error: { code: string } }>().error.code).toBe('VALIDATION_ERROR');
  });

  it('never leaks a stack trace', async () => {
    const response = await app.inject({
      method: 'PATCH',
      url: '/me',
      headers: { ...auth, 'content-type': 'application/json' },
      payload: '{oops',
    });

    expect(response.body).not.toContain('at ');
    expect(response.json()).not.toHaveProperty('stack');
  });
});

describe('unknown routes', () => {
  it('404s in the same envelope every other error uses', async () => {
    const response = await app.inject({ method: 'GET', url: '/nope', headers: auth });

    expect(response.statusCode).toBe(404);
    expect(response.json<{ error: { code: string } }>().error.code).toBe('NOT_FOUND');
  });

  it('404s an unsupported method on a real path', async () => {
    const response = await app.inject({ method: 'DELETE', url: '/me', headers: auth });

    expect(response.statusCode).toBe(404);
    expect(response.json<{ error: { code: string } }>().error.code).toBe('NOT_FOUND');
  });
});
