import type { ContributionStatus } from '../domain/splits.js';
import type { ThreadState } from '../domain/threadStateMachine.js';
import type { PickSource, Visibility } from '../db/types.js';

export type { ContributionStatus, ThreadState, PickSource, Visibility };

export type ApiError = { error: { code: string; message: string } };

export type User = {
  id: string;
  name: string;
  avatarUrl: string | null;
  birthday: string | null;
  cardLast4: string | null;
};

export type GroupMember = { id: string; name: string; avatarUrl: string | null; hasBirthday: boolean };

export type Group = {
  id: string;
  name: string;
  emoji: string;
  inviteCode: string;
  members: GroupMember[];
};

export type Item = {
  id: string;
  ownerId: string | null;
  name: string;
  category: string;
  merchant: string | null;
  imageUrl: string | null;
  description: string | null;
  priceCents: number | null;
  purchasedAt: string | null;
  visibility: Visibility;
};

/** Finds never carry prices - §1 rule 2 applies to anything the group browses together. */
export type FindItem = {
  id: string;
  ownerId: string | null;
  name: string;
  category: string;
  merchant: string | null;
  imageUrl: string | null;
  description: string | null;
  heartCount: number;
  iHearted: boolean;
  iWishlisted: boolean;
  taken?: boolean;
};

export type ExtractedItem = {
  name: string;
  category: string;
  merchant: string;
  priceCents: number | null;
  purchasedAt: string | null;
  description: string;
};

export type WrappedCards = {
  aesthetic: { title: string; blurb: string; moodboardItemIds: string[] };
  personas: { userId: string; archetype: string; roast: string; exampleItemIds: string[] }[];
  findOfTheMonth: {
    itemId: string;
    ownerId: string | null;
    heartCount: number;
    blurb: string;
  };
  tasteTwins: {
    userIds: [string, string];
    sharedThemes: string[];
    blurb: string;
    itemIds: string[];
  };
  finds: { itemId: string }[];
};

export type WrappedCardKey = keyof WrappedCards;

export type Birthday = {
  userId: string;
  name: string;
  date: string;
  daysUntil: number;
  existingThreadId: string | null;
};

export type GiftPick = {
  id: string;
  productName: string;
  /** Null for catalogue products: the merchant feed carries images but no product page. */
  productUrl: string | null;
  imageUrl: string | null;
  priceCents: number;
  merchant: string | null;
  reason: string;
  citedItemIds: string[];
  source: PickSource;
  voteCount: number;
};

export type Contribution = {
  userId: string;
  name: string;
  status: ContributionStatus;
  amountCents: number | null;
  visaTxnId: string | null;
};

export type Thread = {
  id: string;
  groupId: string;
  recipientId: string;
  recipientName: string;
  organiserId: string;
  state: ThreadState;
  budgetMinCents: number;
  budgetMaxCents: number;
  deadline: string;
  winningPickId: string | null;
  pushStatus: string | null;
  regenerations: number;
  picks: GiftPick[];
  myVotePickId: string | null;
  contributions: Contribution[];
};

export type Reveal = { giftName: string; imageUrl: string | null; contributors: string[] };

export type Product = {
  id: string;
  name: string;
  /** Null for catalogue products: the merchant feed carries images but no product page. */
  url: string | null;
  imageUrl: string;
  priceCents: number;
  merchant: string;
  category: string;
  description: string;
};
