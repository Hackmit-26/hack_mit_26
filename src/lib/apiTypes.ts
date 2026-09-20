/**
 * Mirrors `backend/src/types/api.ts` and the zod request schemas in `backend/src/routes/`.
 * Keep this file in lockstep with the backend; nothing here is inferred at runtime.
 */

export type Visibility = "private" | "shared" | "anonymous";
export type ReactionType = "heart" | "wishlist";
export type CommentTargetType =
  | "purchase"
  | "product"
  | "wrapped_card"
  | "gift_thread"
  | "gift_pick";
export type PickSource = "ai" | "member";
export type PushStatus = "pending" | "succeeded" | "failed";

export type ThreadState =
  | "picking"
  | "voting"
  | "collecting"
  | "funded"
  | "bought"
  | "revealed"
  | "refunding"
  | "refunded";

export type ContributionStatus =
  | "pending"
  | "pulling"
  | "pulled"
  | "failed"
  | "refunding"
  | "refunded"
  | "opted_out"
  | "removed";

export const ERROR_CODES = [
  "UNAUTHENTICATED",
  "NOT_FOUND",
  "NOT_MEMBER",
  "INVALID_STATE",
  "NOT_ENOUGH_DATA",
  "VISA_ERROR",
  "LLM_ERROR",
  "VALIDATION_ERROR",
  "INTERNAL",
] as const;

export type KnownErrorCode = (typeof ERROR_CODES)[number];

/** The server may add codes we do not know about yet, so keep the union open. */
export type ApiErrorCode = KnownErrorCode | (string & {});

export type ApiErrorEnvelope = { error: { code: string; message: string } };

/** POST /threads answers 409 with the existing thread so the UI can jump straight to it. */
export type DuplicateThreadEnvelope = ApiErrorEnvelope & { threadId: string };

export type User = {
  id: string;
  name: string;
  avatarUrl: string | null;
  birthday: string | null;
  cardLast4: string | null;
};

export type GroupMember = {
  id: string;
  name: string;
  avatarUrl: string | null;
  hasBirthday: boolean;
};

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
  /** Null when there is no page to open: the tile renders as a plain tile. */
  productUrl: string | null;
  description: string | null;
  priceCents: number | null;
  purchasedAt: string | null;
  visibility: Visibility;
};

/** Finds never carry prices. `ownerId` is null when the item was shared anonymously. */
export type FindItem = {
  id: string;
  ownerId: string | null;
  name: string;
  category: string;
  merchant: string | null;
  imageUrl: string | null;
  /** Null when there is no page to open: the tile renders as a plain tile. */
  productUrl: string | null;
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
  personas: {
    userId: string;
    archetype: string;
    roast: string;
    exampleItemIds: string[];
  }[];
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

/** A comment is exactly as visible as the thing it hangs off; a hidden target 404s. */
export type Comment = {
  id: string;
  targetType: CommentTargetType;
  targetId: string;
  parentId: string | null;
  authorId: string;
  authorName: string;
  body: string;
  createdAt: string;
  editedAt: string | null;
};

export type Reveal = {
  giftName: string;
  imageUrl: string | null;
  contributors: string[];
};

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

export type WrappedResponse = { wrappedId: string; cards: WrappedCards };

export type CardResponse = { cardLast4: string };

export type HealthResponse = {
  ok: boolean;
  visaMode: string;
  llmMode: string;
};

export type PasskeyMode = "webauthn" | "confirm";

export type PasskeyRegistrationOptions = {
  mode: PasskeyMode;
  challenge: string;
  rp: { id: string; name: string };
  user: { id: string; name: string; displayName: string };
  pubKeyCredParams: { type: string; alg: number }[];
  timeout: number;
  attestation: string;
  authenticatorSelection: {
    userVerification: string;
    residentKey: string;
  };
};

export type PasskeyAuthOptions = {
  mode: PasskeyMode;
  challenge: string;
  rpId: string;
  timeout: number;
  userVerification: string;
  allowCredentials: { type: string; id: string; transports: string[] }[];
};

export type PasskeyVerifyResponse = { verified: boolean; credentialId: string };

/* ---------------------------------------------------------------- requests */

export type CreateGroupBody = { name: string; emoji: string };

export type JoinGroupBody = { inviteCode: string };

export type UpdateMeBody = {
  name?: string;
  avatarUrl?: string | null;
  /** YYYY-MM-DD. */
  birthday?: string | null;
};

export type SetCardBody = { cardRef: string };

export type CreateItemBody = {
  name: string;
  category: string;
  merchant?: string | null;
  imageUrl?: string | null;
  description?: string | null;
  priceCents?: number | null;
  /** YYYY-MM-DD. */
  purchasedAt?: string | null;
  /** Required by the server whenever `visibility` is not "private". */
  groupId?: string | null;
  visibility?: Visibility;
};

export type UpdateItemVisibilityBody = { visibility: Visibility };

/** The server refuses a body carrying neither `imageUrl` nor `imageBase64`. */
export type IngestReceiptBody = { groupId?: string | null } & (
  | { imageUrl: string; imageBase64?: string }
  | { imageUrl?: string; imageBase64: string }
);

export type ReactionBody = { itemId: string; type: ReactionType };

export type WishlistLinkBody = { url: string; priceCents?: number };

export type VetoWrappedCardBody = { cardKey: WrappedCardKey };

/** The server trims `body` and refuses an empty one, or one over 1000 characters. */
export type CreateCommentBody = {
  targetType: CommentTargetType;
  targetId: string;
  /** Required for `wrapped_card`, which has no row to look up: the group carries the permission. */
  groupId?: string;
  parentId?: string | null;
  body: string;
};

export type CreateThreadBody = {
  groupId: string;
  recipientId: string;
  budgetMinCents: number;
  budgetMaxCents: number;
};

export type ThreadPickLinkBody = {
  url: string;
  priceCents: number;
  productName?: string;
  imageUrl?: string;
  merchant?: string;
};

export type VoteBody = { pickId: string };

export type ApprovalProof = {
  confirm?: boolean;
  passkeyAssertion?: {
    credentialId: string;
    signature?: string;
    clientDataJSON?: string;
  };
};

export type PasskeyRegistrationVerifyBody = {
  challenge: string;
  credentialId: string;
  publicKey: string;
  transports?: string[];
};
