import { cleanup, fireEvent, render, screen, waitFor } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import { DebateCard } from "@/components/chapters/DebateCard";
import { clearDebateCache, setDebateApi } from "@/components/chapters/debateStore";
import type { Debate } from "@/lib/apiTypes";
import { AppProvider, setCommentsApi, type CommentsApi } from "@/state/store";

const DEBATE: Debate = {
  itemId: "item-esh-06",
  name: "Mother-25 Semi-Modular Synth",
  merchant: "Signal Forge",
  category: "music",
  imageUrl: null,
  priceCents: 39900,
  ownerId: "esh",
  commentCount: 3,
  participants: [
    { id: "sabina", name: "Sabina", avatarUrl: null },
    { id: "esh", name: "Esh", avatarUrl: null },
  ],
  spanDays: 3,
  verdict: "Three days, three messages, and nobody backed down.",
  thread: [
    {
      id: "c1",
      userId: "sabina",
      userName: "Sabina",
      body: "your skiff is two thirds empty",
      createdAt: "2026-09-15T10:02:00.000Z",
      parentId: null,
    },
    {
      id: "c2",
      userId: "esh",
      userName: "Esh",
      body: "the case is empty BECAUSE i was waiting for this",
      createdAt: "2026-09-15T10:09:00.000Z",
      parentId: "c1",
    },
    {
      id: "c3",
      userId: "sabina",
      userName: "Sabina",
      body: "ok that is genuinely gorgeous",
      createdAt: "2026-09-18T12:06:00.000Z",
      parentId: null,
    },
  ],
};

const create = vi.fn<CommentsApi["create"]>();

function fakeComments(over: Partial<CommentsApi> = {}): CommentsApi {
  return {
    list: async () => [],
    create,
    remove: async () => undefined,
    viewerId: () => "kristina",
    ...over,
  };
}

function card() {
  return render(
    <AppProvider>
      <DebateCard />
    </AppProvider>,
  );
}

beforeEach(() => {
  window.sessionStorage.clear();
  clearDebateCache();
  create.mockReset();
  create.mockImplementation(async (_target, body, parentId) => ({
    id: "srv-new",
    targetType: "purchase" as const,
    targetId: "item-esh-06",
    parentId,
    authorId: "kristina",
    authorName: "Kristina",
    body,
    createdAt: "2026-09-20T10:00:00.000Z",
    editedAt: null,
  }));
  setCommentsApi(fakeComments());
  setDebateApi({ debate: async () => DEBATE });
});

afterEach(cleanup);

describe("DebateCard", () => {
  it("names the winning item, its owner and the verdict the server computed", async () => {
    card();
    await screen.findByText("Mother-25 Semi-Modular Synth");
    expect(screen.getByText(/Signal Forge · Esh's find/)).toBeTruthy();
    expect(screen.getByText(DEBATE.verdict)).toBeTruthy();
    expect(screen.getByText("$399")).toBeTruthy();
  });

  it("shows why this item won, in the server's numbers", async () => {
    card();
    await screen.findByText("Mother-25 Semi-Modular Synth");
    expect(screen.getByLabelText("3 messages")).toBeTruthy();
    expect(screen.getByLabelText("2 arguing")).toBeTruthy();
    expect(screen.getByLabelText("3 days")).toBeTruthy();
  });

  it("paints the thread that came with the verdict before /comments answers", async () => {
    card();
    await screen.findByText("your skiff is two thirds empty");
    expect(screen.getByText("the case is empty BECAUSE i was waiting for this")).toBeTruthy();
    expect(screen.getByText("ok that is genuinely gorgeous")).toBeTruthy();
  });

  it("never outs the buyer of an anonymously shared item", async () => {
    setDebateApi({ debate: async () => ({ ...DEBATE, ownerId: null }) });
    card();
    await screen.findByText("Mother-25 Semi-Modular Synth");
    expect(screen.getByText(/shared anonymously/)).toBeTruthy();
    expect(screen.queryByText(/Esh's find/)).toBeNull();
  });

  it("writes a comment from the card onto the item's real thread", async () => {
    card();
    const field = await screen.findByLabelText("Join the debate");
    fireEvent.change(field, { target: { value: "this is the best argument all month" } });
    fireEvent.click(screen.getByRole("button", { name: "Send" }));

    await waitFor(() => expect(create).toHaveBeenCalledTimes(1));
    const [target, body, parentId] = create.mock.calls[0];
    // `purchase` + the raw item id: the same target the item tile on the feed uses, so the
    // comment is there too rather than in a thread only this card can see.
    expect(target).toEqual({ targetType: "purchase", targetId: "item-esh-06" });
    expect(body).toBe("this is the best argument all month");
    expect(parentId).toBeNull();
    expect(screen.getByText("this is the best argument all month")).toBeTruthy();
  });

  it("says so rather than breaking when no item has been argued about", async () => {
    setDebateApi({
      debate: async () => {
        throw new Error("NOT_ENOUGH_DATA");
      },
    });
    vi.spyOn(console, "error").mockImplementation(() => undefined);
    card();
    await screen.findByText(/Nothing in the group has been argued about yet/);
  });
});
