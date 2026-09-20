import type { FastifyInstance } from 'fastify';
import { z } from 'zod';
import { requireAuth } from '../auth/verifyUser.js';
import { db, newId, now } from '../db/index.js';
import { mirrorReaction } from '../db/mirror.js';
import { assertMember, groupMemberIds } from '../domain/permissions.js';
import { notFound } from '../lib/errors.js';
import { linkPreview, type LinkPreview } from '../products/linkPreview.js';
import type { WishlistRoster } from '../types/api.js';
import { toItem } from './items.js';

const idParams = z.object({ id: z.string().min(1) });

const body = z.object({
  // `z.url()` alone accepts any scheme, and the tile it produces is an unopenable link.
  url: z.url().refine((u) => /^https?:$/.test(new URL(u).protocol), 'expected an http(s) URL'),
  priceCents: z.int().nonnegative().optional(),
  groupId: z.string().min(1).optional(),
});

/**
 * `purchases.group_id` is NOT NULL, so an ungrouped wishlist item cannot be mirrored and would
 * vanish on restart. The item stays `private` either way - `GET /groups/:id/finds` filters those
 * out - so the group id is tenancy, not exposure. Ambiguous membership is left null rather than
 * guessed at.
 */
function resolveGroupId(userId: string, requested: string | undefined): string | null {
  if (requested) {
    assertMember(requested, userId);
    return requested;
  }
  const mine = db.memberships.filter((m) => m.userId === userId);
  return mine.length === 1 ? (mine[0]?.groupId ?? null) : null;
}

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

  /**
   * The group-wide companion to `GET /wishlist`: "three other people also want this" is the one
   * signal a gifting app cannot fake, and the viewer-scoped list can only ever name the viewer.
   *
   * It reads over exactly the slice `GET /groups/:id/finds` returns, so every roster has a tile to
   * attach to and a `private` item can never appear here - not even to its own owner, who already
   * has it under `/wishlist`. Items nobody starred are omitted rather than sent as empty rosters.
   */
  app.get('/groups/:id/wishlists', async (request) => {
    const { userId } = requireAuth(request);
    const { id } = idParams.parse(request.params);

    const group = db.groups.find((g) => g.id === id);
    if (!group) throw notFound('Group not found');
    assertMember(group.id, userId);

    const memberIds = new Set(groupMemberIds(group.id));
    const visible = new Map(
      db.items
        .filter((i) => i.groupId === group.id && i.visibility !== 'private')
        .map((i) => [i.id, i] as const),
    );

    // A Set per item: hydrating from postgres can replay a reaction the store already holds.
    const rosters = new Map<string, Set<string>>();
    for (const reaction of db.reactions.all()) {
      if (reaction.type !== 'wishlist') continue;
      if (!memberIds.has(reaction.userId)) continue;

      const item = visible.get(reaction.itemId);
      if (!item) continue;

      // An anonymous item's owner starring it is a tell, so strip them for everyone but themselves.
      if (item.visibility === 'anonymous' && reaction.userId === item.ownerId && userId !== item.ownerId) {
        continue;
      }

      const roster = rosters.get(item.id) ?? new Set<string>();
      roster.add(reaction.userId);
      rosters.set(item.id, roster);
    }

    return [...rosters]
      .map(([itemId, userIds]): WishlistRoster => ({
        itemId,
        users: [...userIds].sort().flatMap((memberId) => {
          const member = db.users.find((u) => u.id === memberId);
          return member ? [{ id: member.id, name: member.name, avatarUrl: member.avatarUrl }] : [];
        }),
      }))
      .filter((roster) => roster.users.length > 0)
      .sort((a, b) => a.itemId.localeCompare(b.itemId));
  });

  app.post('/wishlist/link', async (request) => {
    const { userId } = requireAuth(request);
    const parsed = body.parse(request.body);

    const link = await preview(parsed.url);

    const item = db.items.insert({
      id: newId(),
      ownerId: userId,
      groupId: resolveGroupId(userId, parsed.groupId),
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
      // The pasted link is the one genuinely canonical product page in the whole dataset.
      productUrl: parsed.url,
    });

    db.reactions.insert({ userId, itemId: item.id, type: 'wishlist', createdAt: now() });

    // One mirror, not two: it pushes the purchase ahead of the reaction that references it.
    void mirrorReaction(userId, item.id, 'wishlist');

    return toItem(item);
  });
}
