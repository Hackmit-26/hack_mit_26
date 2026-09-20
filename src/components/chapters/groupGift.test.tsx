import { cleanup, render, screen, waitFor } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import { GiftCard, type GiftState } from "@/components/chapters/GiftCard";
import { ItemDetailProvider } from "@/components/commerce/ItemDetailModal";
import { userList } from "@/data/users";
import type { Contribution, Thread } from "@/lib/apiTypes";
import type { UserId } from "@/lib/types";
import { AppProvider } from "@/state/store";

const listGroupThreads = vi.fn<() => Promise<Thread[]>>();

vi.mock("@/lib/api", async (importOriginal) => ({
  ...(await importOriginal<typeof import("@/lib/api")>()),
  listGroupThreads: () => listGroupThreads(),
}));

const EVERYONE: UserId[] = ["kristina", "esh", "sabina", "madhav"];

function contribution(
  userId: UserId,
  status: Contribution["status"],
  amountCents: number,
  visaTxnId: string | null = null,
): Contribution {
  const name = userList.find((u) => u.id === userId)?.name ?? userId;
  return { userId, name, status, amountCents, visaTxnId };
}

/** A `collecting` pot for `recipientId`, shaped exactly like `GET /groups/:id/threads` returns. */
function pot(recipientId: UserId, contributions: Contribution[]): Thread {
  return {
    id: `thread-${recipientId}`,
    groupId: "tea-party",
    recipientId,
    recipientName: userList.find((u) => u.id === recipientId)?.name ?? recipientId,
    organiserId: contributions[0]?.userId ?? "kristina",
    state: "collecting",
    budgetMinCents: 12000,
    budgetMaxCents: 18000,
    deadline: "2026-11-14T23:59:00.000Z",
    winningPickId: "pick-1",
    pushStatus: null,
    regenerations: 0,
    picks: [
      {
        id: "pick-1",
        productName: "Dual Wavefolder Oscillator Module",
        productUrl: null,
        imageUrl: null,
        priceCents: contributions.reduce((sum, c) => sum + (c.amountCents ?? 0), 0),
        merchant: "Signal Forge",
        reason: "cited",
        citedItemIds: [],
        source: "ai",
        voteCount: 0,
      },
    ],
    myVotePickId: null,
    contributions,
  };
}

/** Puts the app in `viewerId`'s seat the way the demo switcher does, then renders gift mode. */
function giftModeAs(viewerId: UserId, who: UserId) {
  window.sessionStorage.setItem("shop-wrapped-demo", JSON.stringify({ viewerId }));
  const state: GiftState = { step: "main", who, budget: "group", item: -1 };
  return render(
    <AppProvider>
      <ItemDetailProvider>
        <GiftCard state={state} setState={() => {}} onBuy={() => {}} />
      </ItemDetailProvider>
    </AppProvider>,
  );
}

function pickerAs(viewerId: UserId) {
  window.sessionStorage.setItem("shop-wrapped-demo", JSON.stringify({ viewerId }));
  const state: GiftState = { step: "pick", who: "esh", budget: "group", item: -1 };
  return render(
    <AppProvider>
      <GiftCard state={state} setState={() => {}} onBuy={() => {}} />
    </AppProvider>,
  );
}

beforeEach(() => {
  window.sessionStorage.clear();
  listGroupThreads.mockReset();
  listGroupThreads.mockResolvedValue([]);
});

afterEach(() => {
  cleanup();
  vi.useRealTimers();
});

describe("group gift, from every account", () => {
  it.each(EVERYONE)("never offers %s their own gift to shop for", async (viewerId) => {
    pickerAs(viewerId);
    const picker = await screen.findByRole("group", {
      name: "Choose a friend to shop for",
    });

    const offered = Array.from(picker.querySelectorAll("button")).map(
      (b) => b.textContent ?? "",
    );
    const me = userList.find((u) => u.id === viewerId)!;
    expect(offered).toHaveLength(3);
    expect(offered.some((label) => label.includes(me.name))).toBe(false);
  });

  it.each(EVERYONE.filter((id) => id !== "esh"))(
    "shows %s their own backend share, not the catalogue estimate",
    async (viewerId) => {
      // An opt-out has re-split a $150 pot two ways, so nobody owes the $50 the card assumes.
      listGroupThreads.mockResolvedValue([
        pot(
          "esh",
          EVERYONE.filter((id) => id !== "esh").map((id) =>
            id === "madhav"
              ? contribution(id, "opted_out", 0)
              : contribution(id, "pending", 7500),
          ),
        ),
      ]);

      giftModeAs(viewerId, "esh");

      if (viewerId === "madhav") {
        // Opted out: no share to approve, and the card says so rather than inviting a payment.
        expect(await screen.findByText("Opted out")).toBeTruthy();
        await waitFor(() =>
          expect(screen.getByText(/\$150 total, split 2 ways/)).toBeTruthy(),
        );
        return;
      }

      expect(
        await screen.findByRole("button", { name: /Approve your \$75 share/ }),
      ).toBeTruthy();
      await waitFor(() =>
        expect(screen.getByText(/\$150 total, split 2 ways/)).toBeTruthy(),
      );
    },
  );

  it("labels only the viewer's own row You, whoever is looking", async () => {
    const contributions = EVERYONE.filter((id) => id !== "esh").map((id) =>
      contribution(id, "pending", 5000),
    );
    listGroupThreads.mockResolvedValue([pot("esh", contributions)]);

    for (const viewerId of EVERYONE.filter((id) => id !== "esh")) {
      giftModeAs(viewerId, "esh");
      expect(await screen.findAllByText("You")).toHaveLength(1);

      const others = EVERYONE.filter((id) => id !== "esh" && id !== viewerId);
      for (const id of others) {
        const name = userList.find((u) => u.id === id)!.name;
        expect(screen.getAllByText(name).length).toBeGreaterThan(0);
      }
      cleanup();
    }
  });

  it("renders each contribution status the backend reports", async () => {
    listGroupThreads.mockResolvedValue([
      pot("esh", [
        contribution("kristina", "pulled", 5000, "4000000000001"),
        contribution("sabina", "failed", 5000),
        contribution("madhav", "pending", 5000),
      ]),
    ]);

    giftModeAs("madhav", "esh");

    expect(await screen.findByText("In: $50")).toBeTruthy();
    expect(screen.getByText("Pull failed")).toBeTruthy();
    expect(screen.getByText("Pending $50")).toBeTruthy();
    expect(screen.getByRole("button", { name: /Approve your \$50 share/ })).toBeTruthy();
  });

  it("keeps the catalogue split while a thread is still picking", async () => {
    // `picking` threads carry no contributions, so the pot cannot say how it divides yet.
    listGroupThreads.mockResolvedValue([
      { ...pot("madhav", []), state: "picking", winningPickId: null, picks: [] },
    ]);

    giftModeAs("sabina", "madhav");

    expect(await screen.findByText(/\$90 total, split 3 ways/)).toBeTruthy();
  });

  it("falls back to the catalogue split when no thread exists yet", async () => {
    listGroupThreads.mockResolvedValue([]);
    giftModeAs("sabina", "madhav");

    // prod-madhav-grinder is $90 split three ways.
    expect(await screen.findByText(/\$90 total, split 3 ways/)).toBeTruthy();
    expect(screen.getByText("each")).toBeTruthy();
  });
});
