import type { FastifyInstance } from 'fastify';
import { z } from 'zod';
import { requireAuth } from '../auth/verifyUser.js';
import { db } from '../db/index.js';
import type { ItemRow } from '../db/types.js';
import { assertMember, visibleOwnerId } from '../domain/permissions.js';
import { productLink } from '../domain/productLinks.js';
import { marksPickTaken } from '../domain/threadStateMachine.js';
import { notFound } from '../lib/errors.js';
import type { FindItem } from '../types/api.js';

const idParams = z.object({ id: z.string().min(1) });

/**
 * §7.10: an item already chosen as a group gift reads as "taken" to everyone but its owner.
 * Picks are products rather than rows in `items`, so the link is the product name.
 */
function isTaken(item: ItemRow, viewerId: string): boolean {
  if (item.ownerId === viewerId) return false;
  return Boolean(
    db.giftThreads.find(
      (t) =>
        t.groupId === item.groupId &&
        t.recipientId === item.ownerId &&
        t.winningPickId !== null &&
        marksPickTaken(t.state) &&
        db.giftPicks.find((p) => p.id === t.winningPickId)?.productName.toLowerCase() ===
          item.name.toLowerCase(),
    ),
  );
}

export default async function findsRoutes(app: FastifyInstance): Promise<void> {
  app.get('/groups/:id/finds', async (request) => {
    const { userId } = requireAuth(request);
    const { id } = idParams.parse(request.params);

    const group = db.groups.find((g) => g.id === id);
    if (!group) throw notFound('Group not found');
    assertMember(group.id, userId);

    const reactions = db.reactions.all();

    return db.items
      .filter((i) => i.groupId === group.id && i.visibility !== 'private')
      .sort((a, b) => b.createdAt.localeCompare(a.createdAt))
      .map((item): FindItem => {
        const mine = reactions.filter((r) => r.itemId === item.id && r.userId === userId);
        const ownerId = visibleOwnerId(item, userId);

        const find: FindItem = {
          id: item.id,
          ownerId,
          name: item.name,
          category: item.category,
          merchant: item.merchant,
          imageUrl: item.imageUrl,
          productUrl: productLink(item.name, item.merchant, item.productUrl),
          description: item.description,
          // Anonymous aggregate only: §1 rule 4 forbids ever naming who hearted an item.
          heartCount: reactions.filter((r) => r.itemId === item.id && r.type === 'heart').length,
          iHearted: mine.some((r) => r.type === 'heart'),
          iWishlisted: mine.some((r) => r.type === 'wishlist'),
        };

        if (ownerId !== null && isTaken(item, userId)) find.taken = true;
        if (item.purchasedAt === null) find.wanted = true;
        return find;
      });
  });
}
