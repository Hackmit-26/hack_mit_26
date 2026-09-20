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
