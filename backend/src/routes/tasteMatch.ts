import type { FastifyInstance } from 'fastify';
import { z } from 'zod';
import { generateTasteMatch } from '../ai/tasteMatch.js';
import { requireAuth } from '../auth/verifyUser.js';
import { assertMember } from '../domain/permissions.js';

const idParams = z.object({ id: z.string().min(1) });

export default async function tasteMatchRoutes(app: FastifyInstance): Promise<void> {
  /** Chapter 1 of the Wrapped. Scores are computed here; only the copy comes from the model. */
  app.get('/groups/:id/taste-match', async (request) => {
    const { userId } = requireAuth(request);
    const { id } = idParams.parse(request.params);
    assertMember(id, userId);

    return generateTasteMatch(id);
  });
}
