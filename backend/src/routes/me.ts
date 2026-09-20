import type { FastifyInstance } from 'fastify';
import { z } from 'zod';
import { requireAuth } from '../auth/verifyUser.js';
import { db } from '../db/index.js';
import type { UserRow } from '../db/types.js';
import { AppError, notFound } from '../lib/errors.js';
import type { User } from '../types/api.js';
import { getCard, listCardRefs } from '../visa/cards.js';

const patchBody = z.object({
  name: z.string().trim().min(1).max(80).optional(),
  avatarUrl: z.url().nullable().optional(),
  birthday: z
    .string()
    .regex(/^\d{4}-\d{2}-\d{2}$/, 'expected YYYY-MM-DD')
    .nullable()
    .optional(),
});

const cardBody = z.object({ cardRef: z.string().min(1) });

function toUser(user: UserRow): User {
  return {
    id: user.id,
    name: user.name,
    avatarUrl: user.avatarUrl,
    birthday: user.birthday,
    cardLast4: user.cardLast4,
  };
}

export default async function meRoutes(app: FastifyInstance): Promise<void> {
  app.patch('/me', async (request) => {
    const { userId } = requireAuth(request);
    const body = patchBody.parse(request.body);

    const patch: Partial<UserRow> = {};
    if (body.name !== undefined) patch.name = body.name;
    if (body.avatarUrl !== undefined) patch.avatarUrl = body.avatarUrl;
    if (body.birthday !== undefined) patch.birthday = body.birthday;

    const user = db.users.update((u) => u.id === userId, patch);
    if (!user) throw notFound('User not found');
    return toUser(user);
  });

  app.post('/me/card', async (request) => {
    const { userId } = requireAuth(request);
    const { cardRef } = cardBody.parse(request.body);

    if (!listCardRefs().includes(cardRef)) {
      throw new AppError('VALIDATION_ERROR', 400, `Unknown cardRef "${cardRef}"`);
    }

    const { last4 } = getCard(cardRef);
    const user = db.users.update((u) => u.id === userId, {
      visaCardRef: cardRef,
      cardLast4: last4,
    });
    if (!user) throw notFound('User not found');

    return { cardLast4: last4 };
  });
}
