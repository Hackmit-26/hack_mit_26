import type { FastifyInstance } from 'fastify';
import { config } from '../config.js';
import { resetDb } from '../db/index.js';
import { seedDemoComments, seedDemoData, seedDemoThreads } from '../db/seed.js';
import { notFound } from '../lib/errors.js';

/**
 * The reset seeds §15 fixtures, so it only makes sense when fixtures are the source of truth.
 * Against postgres it would throw away everything `hydrateFromPostgres` just loaded and leave
 * the server serving stage props - and the route is unauthenticated, so anything that can reach
 * the port could trigger it.
 */
export function demoModeEnabled(): boolean {
  return process.env.DEMO_MODE === 'true' && config.DB_MODE !== 'postgres';
}

/**
 * Restores the §15 stage state: the group, personas, items and reactions, a fresh `picking`
 * thread for the birthday recipient, a pre-made `collecting` thread with two shares already
 * pulled for the reversal moment, and the comment threads the "most argued about" card computes
 * over.
 */
export function resetDemoState(): void {
  resetDb();
  seedDemoData();
  seedDemoThreads();
  seedDemoComments();
}

export default async function demoRoutes(app: FastifyInstance): Promise<void> {
  app.post('/demo/reset', async (_request, reply) => {
    // Not a 403: outside a demo this endpoint should not appear to exist at all.
    if (!demoModeEnabled()) throw notFound('Not found');

    resetDemoState();
    return reply.status(204).send();
  });
}
