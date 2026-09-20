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
