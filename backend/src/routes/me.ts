import type { FastifyInstance } from 'fastify';
import { z } from 'zod';
import { requireAuth } from '../auth/verifyUser.js';
import { db } from '../db/index.js';
import type { GroupRow, UserRow } from '../db/types.js';
import { AppError, notFound } from '../lib/errors.js';
import type { Group, User } from '../types/api.js';
import { getCard, listCardRefs } from '../visa/cards.js';
import { toGroup } from './groups.js';

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
  // The frontend only holds a bearer token. Without these two reads it cannot discover who it is
  // signed in as, nor which group to render, without hardcoding uuids.
  app.get('/me', async (request) => {
    const { userId } = requireAuth(request);
    const user = db.users.find((u) => u.id === userId);
    if (!user) throw notFound('User not found');
    return toUser(user);
  });

  app.get('/me/groups', async (request): Promise<Group[]> => {
    const { userId } = requireAuth(request);
    return db.memberships
      .filter((m) => m.userId === userId)
      .map((m) => db.groups.find((g) => g.id === m.groupId))
      .filter((g): g is GroupRow => g !== undefined)
      .map(toGroup)
      .sort((a, b) => a.name.localeCompare(b.name));
  });

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
