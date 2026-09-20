/**
 * Checkout orchestration.
 *
 * Shaped after Visa Intelligent Commerce so the sandbox can be dropped in
 * without touching a component: build a payment instruction, get the
 * cardholder's passkey approval, request credentials, complete the purchase,
 * then send the outcome signal.
 *
 * Every function here is the ONLY place a "payment" happens. Components call
 * these and render whatever state comes back — no fake payment logic lives in
 * the UI.
 */

import { ApiError, approveMyContribution, getThread } from "@/lib/api";
import type { Contribution, Thread } from "@/lib/apiTypes";
import type { Product, UserId } from "@/lib/types";

export interface PaymentInstruction {
  id: string;
  productId: string;
  merchant: string;
  /** The agent may never spend more than this. */
  maxAmountCents: number;
  amountCents: number;
  /** Who the purchase is credited to — feeds the Trendsetter signal. */
  inspiredByUserId?: UserId;
  /** Who it is being bought for, when it is a gift. */
  forUserId?: UserId;
  createdAt: string;
}

export interface PasskeyApproval {
  instructionId: string;
  approvedAt: string;
  /** Stands in for the device attestation the real flow returns. */
  method: "passkey" | "face-id";
}

export interface PaymentCredential {
  instructionId: string;
  /** An agent-specific token; we never hold a card number. */
  networkToken: string;
  last4: string;
}

export interface PurchaseOutcome {
  id: string;
  instructionId: string;
  status: "confirmed" | "declined";
  amountCents: number;
  merchant: string;
  productId: string;
  /** Tied to the exact card it came from in the Wrapped. */
  sourceCardId: string;
  confirmedAt: string;
  inspiredByUserId?: UserId;
}

export type CheckoutStage =
  | "idle"
  | "reviewing"
  | "authorizing"
  | "processing"
  | "confirmed"
  | "declined";

/** Spend limits a member sets once; shown before every approval. */
export interface SpendLimits {
  perPurchaseCents: number;
  monthlyCents: number;
  monthlyUsedCents: number;
}

export const defaultSpendLimits: SpendLimits = {
  perPurchaseCents: 15000,
  monthlyCents: 40000,
  monthlyUsedCents: 12600,
};

const wait = (ms: number) => new Promise<void>((r) => setTimeout(r, ms));

let counter = 0;
function nextId(prefix: string): string {
  counter += 1;
  return `${prefix}_${Date.now().toString(36)}${counter}`;
}

/**
 * Step 1 — build the instruction the user is asked to approve.
 * The max amount is what bounds the agent; it never exceeds the limit.
 */
export function buildPaymentInstruction(input: {
  product: Product;
  inspiredByUserId?: UserId;
  forUserId?: UserId;
  /** For a group gift, this member's share rather than the full price. */
  amountCentsOverride?: number;
}): PaymentInstruction {
  const amountCents = input.amountCentsOverride ?? input.product.priceCents;
  return {
    id: nextId("pi"),
    productId: input.product.id,
    merchant: input.product.merchant,
    amountCents,
    maxAmountCents: amountCents,
    inspiredByUserId: input.inspiredByUserId,
    forUserId: input.forUserId,
    createdAt: new Date().toISOString(),
  };
}

export function exceedsLimits(
  instruction: PaymentInstruction,
  limits: SpendLimits = defaultSpendLimits,
): boolean {
  return (
    instruction.amountCents > limits.perPurchaseCents ||
    limits.monthlyUsedCents + instruction.amountCents > limits.monthlyCents
  );
}

/** Step 2 — step-up verification. The real flow raises the platform prompt. */
export async function requestPasskeyApproval(
  instruction: PaymentInstruction,
): Promise<PasskeyApproval> {
  await wait(1400);
  return {
    instructionId: instruction.id,
    approvedAt: new Date().toISOString(),
    method: "passkey",
  };
}

/** Step 3 — exchange the approval for an agent-scoped credential. */
export async function requestCredentials(
  approval: PasskeyApproval,
): Promise<PaymentCredential> {
  await wait(500);
  return {
    instructionId: approval.instructionId,
    networkToken: `tkn_${approval.instructionId.slice(3)}`,
    last4: "4242",
  };
}

/** Step 4 — complete the purchase at the merchant. */
export async function completePurchase(
  instruction: PaymentInstruction,
  credential: PaymentCredential,
): Promise<PurchaseOutcome> {
  await wait(900);
  return {
    id: nextId("ord"),
    instructionId: instruction.id,
    status: "confirmed",
    amountCents: instruction.amountCents,
    merchant: instruction.merchant,
    productId: instruction.productId,
    sourceCardId: credential.networkToken,
    confirmedAt: new Date().toISOString(),
    inspiredByUserId: instruction.inspiredByUserId,
  };
}

/** Step 5 — record the outcome against the original instruction. */
export async function sendOutcomeSignal(outcome: PurchaseOutcome): Promise<void> {
  await wait(120);
  if (process.env.NODE_ENV !== "production") {
    // Stands in for the Signals call; useful while demoing.
    console.info("[checkout] signal", outcome.id, outcome.status);
  }
}

/**
 * The whole flow, with a callback so the sheet can animate each stage.
 * Swap the four calls inside for the sandbox and the UI does not change.
 */
export async function runCheckout(
  instruction: PaymentInstruction,
  onStage: (stage: CheckoutStage) => void,
): Promise<PurchaseOutcome> {
  onStage("authorizing");
  const approval = await requestPasskeyApproval(instruction);

  onStage("processing");
  const credential = await requestCredentials(approval);
  const outcome = await completePurchase(instruction, credential);

  await sendOutcomeSignal(outcome);
  onStage(outcome.status === "confirmed" ? "confirmed" : "declined");
  return outcome;
}

/* ------------------------------------------------- real group-gift money */

/**
 * The one call that moves money. `POST /threads/:id/contributions/me/approve`
 * runs the Visa pull for whoever the bearer token is, then settles the thread:
 * the last approver's response is the request in which the pot is pushed to
 * the organiser. So the whole group gift lands inside `approveShare`.
 */
export interface GroupGiftApi {
  approve(threadId: string): Promise<Contribution>;
  thread(threadId: string): Promise<Thread>;
}

const backendGroupGiftApi: GroupGiftApi = {
  approve: (threadId) => approveMyContribution(threadId, { confirm: true }),
  thread: getThread,
};

let groupGiftApi: GroupGiftApi = backendGroupGiftApi;

/** THE API SEAM. Nothing else in the app approves a contribution. Tests inject here. */
export function setGroupGiftApi(api: GroupGiftApi): void {
  groupGiftApi = api;
}

export type ShareApproval =
  | { ok: true; contribution: Contribution; thread: Thread }
  | { ok: false; reason: string; contribution: Contribution | null };

/** A pull that did not land, said plainly enough to read off a stage screen. */
function pullFailure(status: Contribution["status"]): string {
  switch (status) {
    case "failed":
      return "The bank declined this pull. Nothing was taken.";
    case "pulling":
      return "The pull timed out at the network. It is still settling — retry in a moment.";
    case "opted_out":
      return "You opted out of this gift.";
    case "removed":
      return "You are no longer on this gift.";
    default:
      return `The pull ended as "${status}".`;
  }
}

/**
 * Passkey first (the pre-flight the cardholder sees), then the real approve.
 * Resolves rather than throws: a declined pull on stage has to render, not hang.
 */
export async function approveShare(
  threadId: string,
  instruction: PaymentInstruction,
  onStage: (stage: CheckoutStage) => void,
): Promise<ShareApproval> {
  onStage("authorizing");
  await requestPasskeyApproval(instruction);

  onStage("processing");
  let contribution: Contribution;
  try {
    contribution = await groupGiftApi.approve(threadId);
  } catch (cause) {
    onStage("declined");
    return {
      ok: false,
      reason: cause instanceof ApiError ? cause.message : "Could not reach the server",
      contribution: null,
    };
  }

  if (contribution.status !== "pulled") {
    onStage("declined");
    return { ok: false, reason: pullFailure(contribution.status), contribution };
  }

  // The approve response is the contribution alone; the thread carries `state`
  // and `pushStatus`, which is where the push receipt lives.
  let thread: Thread;
  try {
    thread = await groupGiftApi.thread(threadId);
  } catch (cause) {
    onStage("declined");
    return {
      ok: false,
      reason: cause instanceof ApiError ? cause.message : "Could not reach the server",
      contribution,
    };
  }

  onStage("confirmed");
  return { ok: true, contribution, thread };
}
