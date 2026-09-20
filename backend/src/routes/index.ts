import type { FastifyInstance } from 'fastify';
import birthdaysRoutes from './birthdays.js';
import commentsRoutes from './comments.js';
import contributionsRoutes from './contributions.js';
import debateRoutes from './debate.js';
import demoRoutes from './demo.js';
import findsRoutes from './finds.js';
import groupsRoutes from './groups.js';
import ingestRoutes from './ingest.js';
import itemsRoutes from './items.js';
import meRoutes from './me.js';
import passkeysRoutes from './passkeys.js';
import reactionsRoutes from './reactions.js';
import revealsRoutes from './reveals.js';
import threadsRoutes from './threads.js';
import wishlistRoutes from './wishlist.js';
import wrappedRoutes from './wrapped.js';

export async function registerRoutes(app: FastifyInstance): Promise<void> {
  for (const plugin of [
    groupsRoutes,
    meRoutes,
    itemsRoutes,
    ingestRoutes,
    reactionsRoutes,
    commentsRoutes,
    findsRoutes,
    debateRoutes,
    wishlistRoutes,
    birthdaysRoutes,
    wrappedRoutes,
    threadsRoutes,
    contributionsRoutes,
    revealsRoutes,
    passkeysRoutes,
    demoRoutes,
  ]) {
    await app.register(plugin);
  }
}
