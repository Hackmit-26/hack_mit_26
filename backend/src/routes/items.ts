import type { FastifyInstance } from 'fastify';
import { z } from 'zod';
import { requireAuth } from '../auth/verifyUser.js';
import { db, newId, now } from '../db/index.js';
import type { ItemRow } from '../db/types.js';
import { assertMember } from '../domain/permissions.js';
import { AppError, notFound } from '../lib/errors.js';
import type { Item } from '../types/api.js';

const VISIBILITY = ['private', 'shared', 'anonymous'] as const;

const createBody = z.object({
  name: z.string().trim().min(1).max(200),
  category: z.string().trim().min(1).max(60),
  merchant: z.string().trim().min(1).max(120).nullable().optional(),
  imageUrl: z.url().nullable().optional(),
  description: z.string().max(2000).nullable().optional(),
  priceCents: z.int().nonnegative().nullable().optional(),
  purchasedAt: z
    .string()
    .regex(/^\d{4}-\d{2}-\d{2}$/, 'expected YYYY-MM-DD')
    .nullable()
    .optional(),
  groupId: z.string().min(1).nullable().optional(),
  visibility: z.enum(VISIBILITY).default('private'),
});

const patchBody = z.object({ visibility: z.enum(VISIBILITY) });
const idParams = z.object({ id: z.string().min(1) });

export function toItem(item: ItemRow, ownerId: string | null = item.ownerId): Item {
  return {
    id: item.id,
    ownerId,
    name: item.name,
    category: item.category,
    merchant: item.merchant,
    imageUrl: item.imageUrl,
    description: item.description,
    priceCents: item.priceCents,
    purchasedAt: item.purchasedAt,
    visibility: item.visibility,
  };
}

export default async function itemsRoutes(app: FastifyInstance): Promise<void> {
  app.get('/items/mine', async (request) => {
    const { userId } = requireAuth(request);
    return db.items
      .filter((i) => i.ownerId === userId)
      .sort((a, b) => b.createdAt.localeCompare(a.createdAt))
      .map((i) => toItem(i));
  });

  app.post('/items', async (request) => {
    const { userId } = requireAuth(request);
    const body = createBody.parse(request.body);

    const groupId = body.groupId ?? null;
    if (groupId) assertMember(groupId, userId);
    if (body.visibility !== 'private' && !groupId) {
      throw new AppError('VALIDATION_ERROR', 400, 'groupId is required for a non-private item');
    }

    const item = db.items.insert({
      id: newId(),
      ownerId: userId,
      groupId,
      name: body.name,
      category: body.category,
      merchant: body.merchant ?? null,
      imageUrl: body.imageUrl ?? null,
      description: body.description ?? null,
      priceCents: body.priceCents ?? null,
      purchasedAt: body.purchasedAt ?? null,
      visibility: body.visibility,
      embedding: null,
      createdAt: now(),
    });

    return toItem(item);
  });

  app.patch('/items/:id', async (request) => {
    const { userId } = requireAuth(request);
    const { id } = idParams.parse(request.params);
    const { visibility } = patchBody.parse(request.body);

    // A non-owner gets 404 rather than 403: whether an item exists is itself private.
    const item = db.items.find((i) => i.id === id && i.ownerId === userId);
    if (!item) throw notFound('Item not found');

    if (visibility !== 'private' && !item.groupId) {
      throw new AppError('VALIDATION_ERROR', 400, 'This item has no group to be shared with');
    }

    const updated = db.items.update((i) => i.id === item.id, { visibility });
    if (!updated) throw notFound('Item not found');
    return toItem(updated);
  });
}
