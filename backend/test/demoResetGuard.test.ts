import Fastify, { type FastifyInstance } from 'fastify';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

vi.mock('../src/config.js', async () => {
  const actual = await vi.importActual<typeof import('../src/config.js')>('../src/config.js');
  return { config: { ...actual.config, DB_MODE: 'postgres' } };
});

import { db, resetDb } from '../src/db/index.js';
import { AppError } from '../src/lib/errors.js';
import demoRoutes from '../src/routes/demo.js';

let app: FastifyInstance;

beforeEach(async () => {
  resetDb();
  process.env.DEMO_MODE = 'true';
  app = Fastify({ logger: false });
  // Mirrors the mapping in server.ts so the guard's status code is what a caller would see.
  app.setErrorHandler((err, _request, reply) => {
    if (err instanceof AppError) {
      return reply.status(err.httpStatus).send({ error: { code: err.code, message: err.message } });
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

/**
 * `/demo/reset` is unauthenticated and seeds §15 fixtures over whatever is in the store. Against
 * postgres that silently discards everything `hydrateFromPostgres` loaded, so the route must not
 * exist there however DEMO_MODE is set.
 */
describe('POST /demo/reset under DB_MODE=postgres', () => {
  it('404s even with DEMO_MODE=true', async () => {
    const response = await app.inject({ method: 'POST', url: '/demo/reset' });

    expect(response.statusCode).toBe(404);
  });

  it('leaves the hydrated store untouched', async () => {
    db.groups.insert({
      id: 'group-from-postgres',
      name: 'Hydrated',
      emoji: '🫖',
      inviteCode: 'HYDRATED',
      createdAt: new Date().toISOString(),
    });

    await app.inject({ method: 'POST', url: '/demo/reset' });

    expect(db.groups.all().map((g) => g.id)).toEqual(['group-from-postgres']);
  });
});
