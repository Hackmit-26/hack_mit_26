import type { FastifyInstance } from 'fastify';
import { z } from 'zod';
import { templateVerdict, type DebateFacts } from '../ai/debateCopy.js';
import { requireAuth } from '../auth/verifyUser.js';
import { db } from '../db/index.js';
import type { CommentRow, CommentTargetType, ItemRow } from '../db/types.js';
import { isItemVisibleTo, isMember, visibleOwnerId } from '../domain/permissions.js';
import { notFound } from '../lib/errors.js';
import type { GroupDebate } from '../types/api.js';

const paramsSchema = z.object({ groupId: z.string().min(1) });

/**
 * Same pair `onTarget` in comments.ts treats as one: both hydrate into `db.items`, so a thread
 * stays coherent whichever label the client sent. Counting only `purchase` here would drop
 * messages that `GET /comments?targetType=purchase` already returns for the same item.
 */
const ITEM_TARGETS: ReadonlySet<CommentTargetType> = new Set<CommentTargetType>([
  'purchase',
  'product',
]);

const DAY_MS = 86_400_000;

const userName = (userId: string): string =>
  db.users.find((u) => u.id === userId)?.name ?? 'Someone';

/** Whole days between the first and last message. A single sitting still counts as a day. */
function spanDays(first: string, last: string): number {
  const days = Math.floor((Date.parse(last) - Date.parse(first)) / DAY_MS);
  return Number.isFinite(days) ? Math.max(1, days) : 1;
}

export default async function debateRoutes(app: FastifyInstance): Promise<void> {
  app.get('/groups/:groupId/debate', async (request, reply) => {
    const { userId } = requireAuth(request);
    const { groupId } = paramsSchema.parse(request.params);

    const group = db.groups.find((g) => g.id === groupId);
    // 404 and not 403: a group you are not in should not read differently to one that is not there.
    if (!group || !isMember(group.id, userId)) throw notFound('Group not found');

    // Built from what the viewer may see, not from what the group owns: an item hidden from this
    // caller must never surface as their group's loudest argument.
    const visible = new Map<string, ItemRow>();
    for (const item of db.items.filter((i) => i.groupId === group.id)) {
      if (isItemVisibleTo(item, userId)) visible.set(item.id, item);
    }

    const threads = new Map<string, CommentRow[]>();
    for (const comment of db.comments.all()) {
      if (comment.deletedAt !== null) continue;
      if (!ITEM_TARGETS.has(comment.targetType)) continue;
      if (!visible.has(comment.targetId)) continue;

      const thread = threads.get(comment.targetId);
      if (thread) thread.push(comment);
      else threads.set(comment.targetId, [comment]);
    }

    const ranked = [...threads.entries()]
      .map(([itemId, comments]) => {
        const sorted = [...comments].sort((a, b) => a.createdAt.localeCompare(b.createdAt));
        return {
          itemId,
          comments: sorted,
          participantIds: [...new Set(sorted.map((c) => c.userId))],
          lastAt: sorted[sorted.length - 1]?.createdAt ?? '',
        };
      })
      .sort(
        (a, b) =>
          b.comments.length - a.comments.length ||
          b.participantIds.length - a.participantIds.length ||
          b.lastAt.localeCompare(a.lastAt) ||
          // Last resort so two identical threads still rank deterministically across requests.
          a.itemId.localeCompare(b.itemId),
      );

    const winner = ranked[0];
    // Nothing to argue about yet - the card hides itself rather than rendering an empty state.
    if (!winner) return reply.status(204).send();

    const item = visible.get(winner.itemId);
    if (!item) return reply.status(204).send();

    const ownerId = visibleOwnerId(item, userId);
    const participants = winner.participantIds.map((id) => {
      const user = db.users.find((u) => u.id === id);
      return { id, name: user?.name ?? 'Someone', avatarUrl: user?.avatarUrl ?? null };
    });

    const first = winner.comments[0]?.createdAt ?? '';
    const days = spanDays(first, winner.lastAt);

    const facts: DebateFacts = {
      itemName: item.name,
      messageCount: winner.comments.length,
      spanDays: days,
      participantNames: participants.map((p) => p.name),
      // The verdict is generated copy about a card that already hides the owner, so it reads the
      // masked id too - naming the owner here would undo visibleOwnerId one line above.
      ownerName: ownerId === null ? null : userName(ownerId),
      ownerReplied: ownerId !== null && winner.participantIds.includes(ownerId),
    };

    const debate: GroupDebate = {
      itemId: item.id,
      name: item.name,
      merchant: item.merchant,
      category: item.category,
      imageUrl: item.imageUrl,
      priceCents: item.priceCents,
      ownerId,
      commentCount: winner.comments.length,
      participants,
      spanDays: days,
      verdict: templateVerdict(facts),
      thread: winner.comments.map((c) => ({
        id: c.id,
        userId: c.userId,
        userName: userName(c.userId),
        body: c.body,
        createdAt: c.createdAt,
        parentId: c.parentId,
      })),
    };

    return debate;
  });
}
