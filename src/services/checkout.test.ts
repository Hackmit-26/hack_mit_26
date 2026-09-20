import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import { ApiError } from "@/lib/api";
import type { Contribution, Thread } from "@/lib/apiTypes";
import {
  approveShare,
  buildPaymentInstruction,
  setGroupGiftApi,
  type CheckoutStage,
  type GroupGiftApi,
} from "@/services/checkout";
import { getProduct } from "@/data/products";

const INSTRUCTION = buildPaymentInstruction({
  product: getProduct("prod-esh-vanity"),
  forUserId: "esh",
  amountCentsOverride: 5000,
});

function contribution(overrides: Partial<Contribution> = {}): Contribution {
  return {
    userId: "kristina",
    name: "Kristina",
    status: "pulled",
    amountCents: 5000,
    visaTxnId: "4000000000001",
    ...overrides,
  };
}

function thread(overrides: Partial<Thread> = {}): Thread {
  return {
    id: "thread-esh-birthday",
    groupId: "tea-party",
    recipientId: "esh",
    recipientName: "Esh",
    organiserId: "kristina",
    state: "collecting",
    budgetMinCents: 12000,
    budgetMaxCents: 18000,
    deadline: "2026-11-14T23:59:00.000Z",
    winningPickId: "pick-esh-oscillator",
    pushStatus: null,
    regenerations: 0,
    picks: [],
    myVotePickId: null,
    contributions: [contribution()],
    ...overrides,
  };
}

/** The passkey beat is a real 1.4s wait; run the clock rather than sit through it. */
async function run(threadId: string, stages: CheckoutStage[]) {
  const pending = approveShare(threadId, INSTRUCTION, (s) => stages.push(s));
  await vi.runAllTimersAsync();
  return pending;
}

let api: { approve: ReturnType<typeof vi.fn>; thread: ReturnType<typeof vi.fn> };

beforeEach(() => {
  vi.useFakeTimers();
  api = { approve: vi.fn(), thread: vi.fn() };
  setGroupGiftApi(api as unknown as GroupGiftApi);
});

afterEach(() => {
  vi.useRealTimers();
});

describe("approveShare", () => {
  it("pulls the share, then re-reads the thread for the push receipt", async () => {
    api.approve.mockResolvedValue(contribution());
    api.thread.mockResolvedValue(
      thread({ state: "funded", pushStatus: "succeeded" }),
    );

    const stages: CheckoutStage[] = [];
    const result = await run("thread-esh-birthday", stages);

    expect(api.approve).toHaveBeenCalledWith("thread-esh-birthday");
    expect(stages).toEqual(["authorizing", "processing", "confirmed"]);
    expect(result).toMatchObject({ ok: true });
    if (!result.ok) throw new Error("expected a successful pull");
    expect(result.contribution.visaTxnId).toBe("4000000000001");
    expect(result.thread.pushStatus).toBe("succeeded");
  });

  it("does not read the thread when the pull itself failed", async () => {
    api.approve.mockResolvedValue(contribution({ status: "failed", visaTxnId: null }));

    const stages: CheckoutStage[] = [];
    const result = await run("thread-esh-birthday", stages);

    expect(api.thread).not.toHaveBeenCalled();
    expect(stages.at(-1)).toBe("declined");
    expect(result.ok).toBe(false);
    if (result.ok) throw new Error("expected a declined pull");
    expect(result.reason).toContain("declined");
    expect(result.contribution?.status).toBe("failed");
  });

  it("reports a timeout that parked in pulling as unfinished, not as a decline", async () => {
    api.approve.mockResolvedValue(contribution({ status: "pulling", visaTxnId: null }));

    const result = await run("thread-esh-birthday", []);

    expect(result.ok).toBe(false);
    if (result.ok) throw new Error("expected an unfinished pull");
    expect(result.reason).toContain("still settling");
  });

  it("surfaces the server's message when approve rejects", async () => {
    api.approve.mockRejectedValue(
      new ApiError("INVALID_STATE", 'Cannot chip in to a thread in state "funded"', 409),
    );

    const stages: CheckoutStage[] = [];
    const result = await run("thread-esh-birthday", stages);

    expect(stages.at(-1)).toBe("declined");
    expect(result.ok).toBe(false);
    if (result.ok) throw new Error("expected a rejected approve");
    expect(result.reason).toBe('Cannot chip in to a thread in state "funded"');
    expect(result.contribution).toBeNull();
  });
});
