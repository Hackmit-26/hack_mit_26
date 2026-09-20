import type { FastifyInstance } from 'fastify';
import { z } from 'zod';
import { requireAuth } from '../auth/verifyUser.js';
import { db, newId, now } from '../db/index.js';
import { mirrorReaction } from '../db/mirror.js';
import { linkPreview, type LinkPreview } from '../products/linkPreview.js';
import { toItem } from './items.js';

const body = z.object({
  url: z.url(),
  priceCents: z.int().nonnegative().optional(),
});

function hostnameOf(url: string): string {
  return new URL(url).hostname.replace(/^www\./, '');
}

/** The preview is best effort: a wishlist entry from a link the scraper hates is still useful. */
async function preview(url: string): Promise<LinkPreview> {
  try {
    return await linkPreview(url);
  } catch {
    const host = hostnameOf(url);
    return { title: `Saved from ${host}`, imageUrl: null, priceCents: null, merchant: host };
  }
}

export default async function wishlistRoutes(app: FastifyInstance): Promise<void> {
  // `GET /items/mine` also returns receipts. The wishlist is only what the viewer starred, so it
  // reads through the reactions rather than the items.
  app.get('/wishlist', async (request) => {
    const { userId } = requireAuth(request);
    const starred = new Set(
      db.reactions.filter((r) => r.userId === userId && r.type === 'wishlist').map((r) => r.itemId),
    );
    return db.items
      .filter((i) => starred.has(i.id))
      .sort((a, b) => b.createdAt.localeCompare(a.createdAt))
      .map((i) => toItem(i));
  });

  app.post('/wishlist/link', async (request) => {
    const { userId } = requireAuth(request);
    const parsed = body.parse(request.body);

    const link = await preview(parsed.url);

    const item = db.items.insert({
      id: newId(),
      ownerId: userId,
      groupId: null,
      name: link.title,
      category: 'other',
      merchant: link.merchant ?? hostnameOf(parsed.url),
      imageUrl: link.imageUrl,
      description: null,
      priceCents: parsed.priceCents ?? link.priceCents ?? null,
      purchasedAt: null,
      visibility: 'private',
      embedding: null,
      createdAt: now(),
    });

    db.reactions.insert({ userId, itemId: item.id, type: 'wishlist', createdAt: now() });

    // One mirror, not two: it pushes the purchase ahead of the reaction that references it.
    void mirrorReaction(userId, item.id, 'wishlist');

    return toItem(item);
  });
}
