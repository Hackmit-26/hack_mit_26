import type { FastifyInstance } from 'fastify';
import { resetDb } from '../db/index.js';
import { seedDemoData, seedDemoThreads } from '../db/seed.js';
import { notFound } from '../lib/errors.js';

export function demoModeEnabled(): boolean {
  return process.env.DEMO_MODE === 'true';
}

/**
 * Restores the §15 stage state: the group, personas, items and reactions, a fresh `picking`
 * thread for the birthday recipient, and a pre-made `collecting` thread with two shares already
 * pulled for the reversal moment.
 */
export function resetDemoState(): void {
  resetDb();
  seedDemoData();
  seedDemoThreads();
}

export default async function demoRoutes(app: FastifyInstance): Promise<void> {
  app.post('/demo/reset', async (_request, reply) => {
    // Not a 403: outside a demo this endpoint should not appear to exist at all.
    if (!demoModeEnabled()) throw notFound('Not found');

    resetDemoState();
    return reply.status(204).send();
  });
}
