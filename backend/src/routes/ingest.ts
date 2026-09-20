import type { FastifyInstance } from 'fastify';
import { z } from 'zod';
import { ingestReceipt } from '../ai/ingest.js';
import { requireAuth } from '../auth/verifyUser.js';
import { assertMember } from '../domain/permissions.js';
import type { Item } from '../types/api.js';

/**
 * JSON only: @fastify/multipart is not registered on the server, so the frontend uploads the
 * receipt to storage (or inlines a data URL) and sends us a reference.
 */
const body = z
  .object({
    imageUrl: z.url().optional(),
    imageBase64: z.string().min(16).optional(),
    groupId: z.string().min(1).nullable().optional(),
  })
  .refine((value) => Boolean(value.imageUrl || value.imageBase64), {
    message: 'imageUrl or imageBase64 is required',
  });

export default async function ingestRoutes(app: FastifyInstance): Promise<void> {
  app.post('/items/ingest', async (request) => {
    const { userId } = requireAuth(request);
    const input = body.parse(request.body);

    const groupId = input.groupId ?? null;
    if (groupId) assertMember(groupId, userId);

    const rows = await ingestReceipt({
      ownerId: userId,
      groupId,
      ...(input.imageUrl ? { imageUrl: input.imageUrl } : {}),
      ...(input.imageBase64 ? { imageBase64: input.imageBase64 } : {}),
    });

    const items: Item[] = rows.map((row) => ({
      id: row.id,
      ownerId: row.ownerId,
      name: row.name,
      category: row.category,
      merchant: row.merchant,
      imageUrl: row.imageUrl,
      description: row.description,
      priceCents: row.priceCents,
      purchasedAt: row.purchasedAt,
      visibility: row.visibility,
    }));

    return items;
  });
}
