import { db } from '../db/index.js';
import type { GiftThreadRow, ItemRow } from '../db/types.js';
import { AppError, notFound } from '../lib/errors.js';

export function isMember(groupId: string, userId: string): boolean {
  return Boolean(db.memberships.find((m) => m.groupId === groupId && m.userId === userId));
}

export function assertMember(groupId: string, userId: string): void {
  if (!isMember(groupId, userId)) {
    throw new AppError('NOT_MEMBER', 403, 'You are not a member of this group');
  }
}

export function groupMemberIds(groupId: string): string[] {
  return db.memberships
    .filter((m) => m.groupId === groupId)
    .map((m) => m.userId)
    .sort();
}

/**
 * Loads a thread for someone who is allowed to see it.
 *
 * The recipient gets 404 rather than 403: a 403 would confirm the thread exists and spoil
 * the surprise, which §5.2 calls out explicitly.
 */
export function loadVisibleThread(threadId: string, userId: string): GiftThreadRow {
  const thread = db.giftThreads.find((t) => t.id === threadId);
  if (!thread) throw notFound('Thread not found');
  if (thread.recipientId === userId) throw notFound('Thread not found');
  if (!isMember(thread.groupId, userId)) throw notFound('Thread not found');
  return thread;
}

export function assertNotRecipient(threadId: string, userId: string): GiftThreadRow {
  return loadVisibleThread(threadId, userId);
}

export function assertOrganiser(threadId: string, userId: string): GiftThreadRow {
  const thread = loadVisibleThread(threadId, userId);
  if (thread.organiserId !== userId) {
    throw new AppError('NOT_MEMBER', 403, 'Only the organiser can do this');
  }
  return thread;
}

export function isItemVisibleTo(item: ItemRow, userId: string): boolean {
  if (item.ownerId === userId) return true;
  if (item.visibility === 'private') return false;
  return Boolean(item.groupId && isMember(item.groupId, userId));
}

export function assertItemVisibleTo(itemId: string, userId: string): ItemRow {
  const item = db.items.find((i) => i.id === itemId);
  if (!item || !isItemVisibleTo(item, userId)) throw notFound('Item not found');
  return item;
}

/** Anonymous items never leak their owner to anyone but the owner (§1 rule 3). */
export function visibleOwnerId(item: ItemRow, viewerId: string): string | null {
  if (item.ownerId === viewerId) return item.ownerId;
  return item.visibility === 'anonymous' ? null : item.ownerId;
}
