import type { FastifyInstance } from 'fastify';
import { z } from 'zod';
import {
  WRAPPED_CARD_KEYS,
  applyVetoes,
  cardMentionsUser,
  generateWrapped,
} from '../ai/wrappedGenerator.js';
import { requireAuth } from '../auth/verifyUser.js';
import { db } from '../db/index.js';
import { assertMember } from '../domain/permissions.js';
import { AppError, notFound } from '../lib/errors.js';
import type { WrappedCards } from '../types/api.js';

const idParams = z.object({ id: z.string().min(1) });
const vetoBody = z.object({ cardKey: z.enum(WRAPPED_CARD_KEYS) });

export default async function wrappedRoutes(app: FastifyInstance): Promise<void> {
  app.post('/groups/:id/wrapped', async (request) => {
    const { userId } = requireAuth(request);
    const { id } = idParams.parse(request.params);
    assertMember(id, userId);

    const { wrappedId, cards } = await generateWrapped(id);
    return { wrappedId, cards };
  });

  app.get('/wrapped/:id', async (request) => {
    const { userId } = requireAuth(request);
    const { id } = idParams.parse(request.params);

    const row = db.wrapped.find((w) => w.id === id);
    if (!row) throw notFound('Wrapped not found');
    assertMember(row.groupId, userId);

    const cards = row.cardsJson as WrappedCards;
    const vetoes = db.wrappedVetoes.filter((v) => v.wrappedId === id);
    return { wrappedId: row.id, cards: applyVetoes(cards, vetoes) };
  });

  app.post('/wrapped/:id/veto', async (request, reply) => {
    const { userId } = requireAuth(request);
    const { id } = idParams.parse(request.params);
    const { cardKey } = vetoBody.parse(request.body);

    const row = db.wrapped.find((w) => w.id === id);
    if (!row) throw notFound('Wrapped not found');
    assertMember(row.groupId, userId);

    // Only someone the card is about may pull it; otherwise anyone could censor the group.
    if (!cardMentionsUser(row.cardsJson as WrappedCards, cardKey, userId)) {
      throw new AppError('NOT_MEMBER', 403, 'That card is not about you');
    }

    const existing = db.wrappedVetoes.find(
      (v) => v.wrappedId === id && v.userId === userId && v.cardKey === cardKey,
    );
    if (!existing) db.wrappedVetoes.insert({ wrappedId: id, userId, cardKey });

    return reply.code(204).send();
  });
}
