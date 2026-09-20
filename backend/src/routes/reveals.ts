import type { FastifyInstance } from 'fastify';
import { requireAuth } from '../auth/verifyUser.js';
import { buildReveal } from '../services/giftFlow.js';

export default async function revealsRoutes(app: FastifyInstance): Promise<void> {
  /**
   * The one endpoint the recipient may read, and only once the thread is revealed (§7.9).
   * Gift name, image and contributor names - no amounts, no votes, no losing picks.
   */
  app.get<{ Params: { threadId: string } }>('/reveals/:threadId', async (request) => {
    const { userId } = requireAuth(request);
    return buildReveal(request.params.threadId, userId);
  });
}
