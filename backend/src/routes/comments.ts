import type { FastifyInstance } from 'fastify';
import { z } from 'zod';
import { requireAuth } from '../auth/verifyUser.js';
import { mirrorComment, unmirrorComment } from '../db/mirror.js';
import { db, newId, now } from '../db/index.js';
import type { CommentRow, CommentTargetType } from '../db/types.js';
import { assertItemVisibleTo, assertMember, loadVisibleThread } from '../domain/permissions.js';
import { AppError, notFound } from '../lib/errors.js';
import type { Comment } from '../types/api.js';

const TARGET_TYPES = ['purchase', 'product', 'wrapped_card', 'gift_thread', 'gift_pick'] as const;

// Their CHECK is `char_length(body) between 1 and 1000`; trimming first rejects whitespace-only.
const createBody = z.object({
  targetType: z.enum(TARGET_TYPES),
  targetId: z.string().min(1),
  /** Required for `wrapped_card`, ignored otherwise - see assertTargetVisibleTo. */
  groupId: z.string().min(1).optional(),
  parentId: z.string().min(1).nullable().optional(),
  body: z.string().trim().min(1).max(1000),
});

const listQuery = z.object({
  targetType: z.enum(TARGET_TYPES),
  targetId: z.string().min(1),
  groupId: z.string().min(1).optional(),
});

const idParams = z.object({ id: z.string().min(1) });

const ITEM_KINDS: ReadonlySet<CommentTargetType> = new Set<CommentTargetType>([
  'purchase',
  'product',
]);

/**
 * The single authorisation gate for every comment operation. A comment is exactly as visible as
 * the thing it hangs off, so this never invents a rule - it delegates to the existing checks and
 * inherits their failure modes, which is the whole point:
 *
 *  - `assertItemVisibleTo` already 404s an item you may not see;
 *  - `loadVisibleThread` already 404s - never 403s - the gift recipient, because a 403 would
 *    confirm the thread exists and spoil the surprise (§5.2, and test/recipientLeak.test.ts).
 *
 * Every branch therefore fails as NOT_FOUND/404 and an unknown target is indistinguishable from
 * a forbidden one. Returns the group the comment belongs to, for the mirror's NOT NULL column.
 *
 * `wrapped_card` is the one target that is not a row we own - a card is generated copy, keyed by
 * the client. There is nothing to look up, so the group carries the authorisation and the rule is
 * the same one `GET /groups/:id/finds` uses: you can talk about a Wrapped you are a member of.
 */
function assertTargetVisibleTo(
  targetType: CommentTargetType,
  targetId: string,
  userId: string,
  groupId: string | undefined,
): string | null {
  switch (targetType) {
    case 'purchase':
    case 'product':
      return assertItemVisibleTo(targetId, userId).groupId;
    case 'wrapped_card': {
      if (!groupId) throw new AppError('VALIDATION_ERROR', 400, 'groupId is required');
      const group = db.groups.find((g) => g.id === groupId);
      if (!group) throw notFound('Group not found');
      assertMember(group.id, userId);
      return group.id;
    }
    case 'gift_thread':
      return loadVisibleThread(targetId, userId).groupId;
    case 'gift_pick': {
      const pick = db.giftPicks.find((p) => p.id === targetId);
      // Same 404 as an invisible thread: a missing pick must not read differently to a hidden one.
      if (!pick) throw notFound('Comment target not found');
      return loadVisibleThread(pick.threadId, userId).groupId;
    }
  }
}

/**
 * `purchase` and `product` are one thing to this backend - both hydrate into `db.items` and the
 * id is a uuid unique across their two tables - so a thread stays coherent whichever label the
 * client happened to send. The gift kinds are matched exactly; they are not interchangeable.
 */
function onTarget(targetType: CommentTargetType, targetId: string) {
  const itemish = ITEM_KINDS.has(targetType);
  return (c: CommentRow): boolean =>
    c.targetId === targetId &&
    (itemish ? ITEM_KINDS.has(c.targetType) : c.targetType === targetType);
}

function toComment(row: CommentRow): Comment {
  return {
    id: row.id,
    targetType: row.targetType,
    targetId: row.targetId,
    parentId: row.parentId,
    authorId: row.userId,
    authorName: db.users.find((u) => u.id === row.userId)?.name ?? 'Someone',
    body: row.body,
    createdAt: row.createdAt,
    editedAt: row.editedAt,
  };
}

export default async function commentsRoutes(app: FastifyInstance): Promise<void> {
  app.post('/comments', async (request) => {
    const { userId } = requireAuth(request);
    const input = createBody.parse(request.body);

    const groupId = assertTargetVisibleTo(input.targetType, input.targetId, userId, input.groupId);

    const parentId = input.parentId ?? null;
    if (parentId) {
      // A reply may only attach to a live comment on the same target. Threading across targets
      // would let a reply drag a gift thread's discussion into a feed the recipient can read.
      const onSameTarget = onTarget(input.targetType, input.targetId);
      const parent = db.comments.find(
        (c) => c.id === parentId && c.deletedAt === null && onSameTarget(c),
      );
      if (!parent) throw notFound('Parent comment not found');
    }

    const row = db.comments.insert({
      id: newId(),
      userId,
      groupId,
      targetType: input.targetType,
      targetId: input.targetId,
      parentId,
      body: input.body,
      createdAt: now(),
      editedAt: null,
      deletedAt: null,
    });

    void mirrorComment(row.id);

    return toComment(row);
  });

  app.get('/comments', async (request) => {
    const { userId } = requireAuth(request);
    const { targetType, targetId, groupId } = listQuery.parse(request.query);

    assertTargetVisibleTo(targetType, targetId, userId, groupId);

    const onSameTarget = onTarget(targetType, targetId);
    return db.comments
      .filter((c) => c.deletedAt === null && onSameTarget(c))
      .sort((a, b) => a.createdAt.localeCompare(b.createdAt))
      .map(toComment);
  });

  app.delete('/comments/:id', async (request, reply) => {
    const { userId } = requireAuth(request);
    const { id } = idParams.parse(request.params);

    const row = db.comments.find((c) => c.id === id && c.deletedAt === null);
    if (!row) throw notFound('Comment not found');

    // Visibility is checked before authorship, and in that order on purpose: the gift recipient
    // has to 404 here exactly as they would on the list, or the status code alone tells them a
    // thread exists. Only once the caller is known to see the target is a 403 safe - by then
    // they can already read the comment and its author, so it reveals nothing new.
    assertTargetVisibleTo(row.targetType, row.targetId, userId, row.groupId ?? undefined);

    if (row.userId !== userId) {
      throw new AppError('NOT_MEMBER', 403, 'Only the author can delete this comment');
    }

    // Soft delete: their schema retires comments with `deleted_at`, which is also what keeps the
    // write-through mirror's never-DELETE promise free. Replies are left standing.
    db.comments.update((c) => c.id === row.id, { deletedAt: now() });
    void unmirrorComment(row.id);

    return reply.status(204).send();
  });
}
