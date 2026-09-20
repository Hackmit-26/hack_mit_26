import type { FastifyInstance } from 'fastify';
import { z } from 'zod';
import { requireAuth } from '../auth/verifyUser.js';
import { db, now } from '../db/index.js';
import { assertItemVisibleTo } from '../domain/permissions.js';

const body = z.object({
  itemId: z.string().min(1),
  type: z.enum(['heart', 'wishlist']),
});

export default async function reactionsRoutes(app: FastifyInstance): Promise<void> {
  app.post('/reactions', async (request, reply) => {
    const { userId } = requireAuth(request);
    const { itemId, type } = body.parse(request.body);

    assertItemVisibleTo(itemId, userId);

    const existing = db.reactions.find(
      (r) => r.userId === userId && r.itemId === itemId && r.type === type,
    );
    if (!existing) db.reactions.insert({ userId, itemId, type, createdAt: now() });

    return reply.status(204).send();
  });

  app.delete('/reactions', async (request, reply) => {
    const { userId } = requireAuth(request);
    const { itemId, type } = body.parse(request.body);

    db.reactions.remove((r) => r.userId === userId && r.itemId === itemId && r.type === type);

    return reply.status(204).send();
  });
}
