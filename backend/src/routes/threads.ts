import type { FastifyInstance } from 'fastify';
import { z } from 'zod';
import { requireAuth } from '../auth/verifyUser.js';
import { assertMember, assertOrganiser, loadVisibleThread } from '../domain/permissions.js';
import { invalidState } from '../lib/errors.js';
import { logger } from '../lib/logger.js';
import {
  addMemberPick,
  cancelThread,
  castVote,
  createThread,
  findDuplicateThread,
  generatePicksFor,
  lockThread,
  markBought,
  revealThread,
  toGiftPicks,
  toThread,
  visibleGroupThreads,
} from '../services/giftFlow.js';

const createBody = z.object({
  groupId: z.string().min(1),
  recipientId: z.string().min(1),
  budgetMinCents: z.int().nonnegative(),
  budgetMaxCents: z.int().nonnegative(),
});

const linkBody = z.object({
  url: z.url(),
  priceCents: z.int().positive(),
  productName: z.string().min(1).optional(),
  imageUrl: z.url().optional(),
  merchant: z.string().min(1).optional(),
});

const voteBody = z.object({ pickId: z.string().min(1) });

export default async function threadsRoutes(app: FastifyInstance): Promise<void> {
  app.post('/threads', async (request, reply) => {
    const { userId } = requireAuth(request);
    const body = createBody.parse(request.body);

    // Authorise before answering anything about whether a thread exists. The 409 below names the
    // thread id, so without these two guards a recipient could POST themselves as recipientId and
    // learn their own gift exists - the one secret §5.2 protects - and a non-member could probe
    // the group the same way. createThread re-checks both; this only moves them earlier.
    assertMember(body.groupId, userId);
    if (body.recipientId === userId) throw invalidState('You cannot organise your own gift');

    // 409 carries the existing thread id so the frontend can jump straight to it (§7.2).
    const duplicate = findDuplicateThread(body.groupId, body.recipientId);
    if (duplicate) {
      return reply.status(409).send({
        error: { code: 'INVALID_STATE', message: 'A gift thread already exists for this birthday' },
        threadId: duplicate.id,
      });
    }

    const thread = createThread(userId, body);

    // §7.2: picks generate in the background; the thread opens voting once they land.
    void generatePicksFor(thread.id).catch((err: unknown) => {
      logger.error('background pick generation failed', {
        threadId: thread.id,
        message: err instanceof Error ? err.message : String(err),
      });
    });

    return reply.status(201).send(toThread(thread, userId));
  });

  app.get<{ Params: { id: string } }>('/threads/:id', async (request) => {
    const { userId } = requireAuth(request);
    return toThread(loadVisibleThread(request.params.id, userId), userId);
  });

  app.get<{ Params: { id: string } }>('/groups/:id/threads', async (request) => {
    const { userId } = requireAuth(request);
    assertMember(request.params.id, userId);
    return visibleGroupThreads(request.params.id, userId);
  });

  app.post<{ Params: { id: string } }>('/threads/:id/picks', async (request) => {
    const { userId } = requireAuth(request);
    const thread = loadVisibleThread(request.params.id, userId);
    return generatePicksFor(thread.id);
  });

  app.post<{ Params: { id: string } }>('/threads/:id/picks/link', async (request, reply) => {
    const { userId } = requireAuth(request);
    const thread = loadVisibleThread(request.params.id, userId);
    const body = linkBody.parse(request.body);
    const pick = addMemberPick(thread.id, userId, body);
    return reply.status(201).send(toGiftPicks(thread.id).find((p) => p.id === pick.id));
  });

  app.post<{ Params: { id: string } }>('/threads/:id/votes', async (request, reply) => {
    const { userId } = requireAuth(request);
    const thread = loadVisibleThread(request.params.id, userId);
    castVote(thread.id, userId, voteBody.parse(request.body).pickId);
    return reply.status(204).send();
  });

  app.post<{ Params: { id: string } }>('/threads/:id/lock', async (request) => {
    const { userId } = requireAuth(request);
    const thread = assertOrganiser(request.params.id, userId);
    return toThread(lockThread(thread.id, userId), userId);
  });

  app.post<{ Params: { id: string } }>('/threads/:id/cancel', async (request) => {
    const { userId } = requireAuth(request);
    const thread = assertOrganiser(request.params.id, userId);
    return toThread(await cancelThread(thread.id, userId), userId);
  });

  app.post<{ Params: { id: string } }>('/threads/:id/bought', async (request) => {
    const { userId } = requireAuth(request);
    const thread = assertOrganiser(request.params.id, userId);
    return toThread(markBought(thread.id, userId), userId);
  });

  app.post<{ Params: { id: string } }>('/threads/:id/reveal', async (request) => {
    const { userId } = requireAuth(request);
    const thread = assertOrganiser(request.params.id, userId);
    return toThread(revealThread(thread.id, userId), userId);
  });
}
