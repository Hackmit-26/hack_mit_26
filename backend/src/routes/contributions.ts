import type { FastifyInstance } from 'fastify';
import { z } from 'zod';
import { requireAuth } from '../auth/verifyUser.js';
import { assertOrganiser, loadVisibleThread } from '../domain/permissions.js';
import { approveShare, optOut, removeContributor, toThread } from '../services/giftFlow.js';

const approveBody = z
  .object({
    confirm: z.boolean().optional(),
    passkeyAssertion: z
      .object({
        credentialId: z.string().min(1),
        signature: z.string().optional(),
        clientDataJSON: z.string().optional(),
      })
      .optional(),
  })
  .default({});

export default async function contributionsRoutes(app: FastifyInstance): Promise<void> {
  app.post<{ Params: { id: string } }>(
    '/threads/:id/contributions/me/approve',
    async (request) => {
      const { userId } = requireAuth(request);
      const thread = loadVisibleThread(request.params.id, userId);
      const proof = approveBody.parse(request.body ?? {});
      return approveShare(thread.id, userId, proof);
    },
  );

  app.post<{ Params: { id: string } }>(
    '/threads/:id/contributions/me/opt-out',
    async (request) => {
      const { userId } = requireAuth(request);
      const thread = loadVisibleThread(request.params.id, userId);
      return toThread(optOut(thread.id, userId), userId);
    },
  );

  app.post<{ Params: { id: string; userId: string } }>(
    '/threads/:id/contributions/:userId/remove',
    async (request) => {
      const { userId } = requireAuth(request);
      const thread = assertOrganiser(request.params.id, userId);
      return toThread(await removeContributor(thread.id, request.params.userId), userId);
    },
  );
}
