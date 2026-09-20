import type { ContributionStatus } from '../domain/splits.js';
import type { ThreadState } from '../domain/threadStateMachine.js';

export type Visibility = 'private' | 'shared' | 'anonymous';
export type ReactionType = 'heart' | 'wishlist';
export type PickSource = 'ai' | 'member';
export type PushStatus = 'pending' | 'succeeded' | 'failed';

export type UserRow = {
  id: string;
  name: string;
  avatarUrl: string | null;
  birthday: string | null;
  cardLast4: string | null;
  visaCardRef: string | null;
};

export type GroupRow = {
  id: string;
  name: string;
  emoji: string;
  inviteCode: string;
  createdAt: string;
};

export type MembershipRow = { groupId: string; userId: string; joinedAt: string };

export type ItemRow = {
  id: string;
  ownerId: string;
  groupId: string | null;
  name: string;
  category: string;
  merchant: string | null;
  imageUrl: string | null;
  description: string | null;
  priceCents: number | null;
  purchasedAt: string | null;
  visibility: Visibility;
  embedding: number[] | null;
  createdAt: string;
  /** Source URL for items created from a pasted link; the gift picker needs it to build a pick. */
  productUrl?: string | null;
};

export type ReactionRow = {
  userId: string;
  itemId: string;
  type: ReactionType;
  createdAt: string;
};

/**
 * The subset of their `target_kind` enum that this backend can authorise a read against.
 * `purchase` and `product` both resolve to an `ItemRow` (postgres.ts turns catalogue saves into
 * synthetic items); `gift_thread` and `gift_pick` resolve to a thread, which is what makes the
 * §5.2 recipient rule apply to comments. `wrapped_card` resolves to nothing - a card is
 * generated copy the client keys itself - so it is authorised by group membership instead.
 * `lore_case`, `spotlight` and `taste_pair` are all cards under another name; the frontend sends
 * them as `wrapped_card` rather than us guessing at three more vocabularies.
 */
export type CommentTargetType = 'purchase' | 'product' | 'wrapped_card' | 'gift_thread' | 'gift_pick';

/**
 * Mirrors their `comments` table one-for-one, including the soft delete: `deleted_at` is how
 * their schema retires a comment, and honouring it is what lets the write-through mirror keep
 * its never-DELETE promise.
 */
export type CommentRow = {
  id: string;
  userId: string;
  /** Their column is NOT NULL, but a comment on an ungrouped private item has no group. */
  groupId: string | null;
  targetType: CommentTargetType;
  targetId: string;
  parentId: string | null;
  body: string;
  createdAt: string;
  editedAt: string | null;
  deletedAt: string | null;
};

export type WrappedRow = {
  id: string;
  groupId: string;
  cardsJson: unknown;
  createdAt: string;
};

export type WrappedVetoRow = { wrappedId: string; userId: string; cardKey: string };

export type GiftThreadRow = {
  id: string;
  groupId: string;
  recipientId: string;
  organiserId: string;
  state: ThreadState;
  budgetMinCents: number;
  budgetMaxCents: number;
  deadline: string;
  winningPickId: string | null;
  pushTxnId: string | null;
  pushStatus: PushStatus | null;
  revealAt: string | null;
  regenerations: number;
  createdAt: string;
};

export type GiftPickRow = {
  id: string;
  threadId: string;
  productName: string;
  productUrl: string | null;
  imageUrl: string | null;
  priceCents: number;
  merchant: string | null;
  reason: string;
  citedItemIds: string[];
  source: PickSource;
  createdAt: string;
};

export type VoteRow = { threadId: string; userId: string; pickId: string };

export type ContributionRow = {
  id: string;
  threadId: string;
  userId: string;
  amountCents: number;
  status: ContributionStatus;
  pullTxnId: string | null;
  pullStan: string | null;
  pullRrn: string | null;
  statusIdentifier: string | null;
  reversalTxnId: string | null;
  idempotencyKey: string;
  updatedAt: string;
};

export type PasskeyRow = {
  userId: string;
  credentialId: string;
  publicKey: string;
  counter: number;
  transports: string[];
};
