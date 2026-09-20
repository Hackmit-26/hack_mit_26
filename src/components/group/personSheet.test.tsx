import { cleanup, fireEvent, render, screen } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it } from "vitest";

import {
  clearFindsCache,
  setFindsApi,
  useGroupFinds,
} from "@/components/commerce/findsStore";
import { ItemDetailProvider } from "@/components/commerce/ItemDetailModal";
import { PersonSheet, personLists } from "@/components/group/PersonSheet";
import type { FindItem, WishlistRoster } from "@/lib/apiTypes";
import { AppProvider } from "@/state/store";

function find(over: Partial<FindItem> & Pick<FindItem, "id">): FindItem {
  return {
    name: "A thing",
    merchant: "A shop",
    category: "home",
    imageUrl: null,
    productUrl: null,
    description: null,
    ownerId: "esh",
    heartCount: 0,
    iHearted: false,
    iWishlisted: false,
    ...over,
  } as FindItem;
}

const FINDS = [
  find({ id: "item-esh-01", name: "Eurorack Skiff Case", ownerId: "esh" }),
  find({ id: "item-esh-02", name: "Patch Cable Pack", ownerId: "esh" }),
  find({ id: "item-sab-01", name: "Instant Camera", ownerId: "sabina" }),
  find({ id: "item-anon-01", name: "Natural Wine Trio", ownerId: null }),
];

// Esh wants Sabina's camera. That row is the whole point of the wishlist tab: it is
// somebody else's find, so it can only come from the roster, never from `ownerId`.
const ROSTERS: WishlistRoster[] = [
  { itemId: "item-sab-01", users: [{ id: "esh", name: "Esh", avatarUrl: null }] },
  { itemId: "item-anon-01", users: [{ id: "madhav", name: "Madhav", avatarUrl: null }] },
];

function sheet(userId: "esh" | "madhav") {
  return render(
    <AppProvider>
      <ItemDetailProvider>
        <PersonSheet userId={userId} finds={FINDS} onClose={() => undefined} />
      </ItemDetailProvider>
    </AppProvider>,
  );
}

beforeEach(async () => {
  window.sessionStorage.clear();
  clearFindsCache();
  setFindsApi({
    finds: async () => FINDS,
    wishlists: async () => ROSTERS,
    heart: async () => undefined,
    wishlist: async () => undefined,
  });
  // The sheet reads the feed cache rather than fetching, so prime it the way the home
  // page does — mount the hook and let the fetch land — then throw the tree away.
  const view = render(<Primer />);
  await new Promise((r) => setTimeout(r, 0));
  view.unmount();
});

function Primer() {
  useGroupFinds("tea-party");
  return null;
}

afterEach(cleanup);

describe("personLists", () => {
  it("splits a person's own finds from the ones they only want", () => {
    const { bought, wants } = personLists("esh", FINDS);
    expect(bought.map((f) => f.id)).toEqual(["item-esh-01", "item-esh-02"]);
    expect(wants.map((f) => f.id)).toEqual(["item-sab-01"]);
  });

  it("never counts an anonymously shared item as anybody's purchase", () => {
    const { bought, wants } = personLists("madhav", FINDS);
    expect(bought).toEqual([]);
    expect(wants.map((f) => f.id)).toEqual(["item-anon-01"]);
  });
});

describe("PersonSheet", () => {
  it("opens on what they bought and switches to what they want", () => {
    sheet("esh");
    expect(screen.getByRole("dialog", { name: "Esh's lists" })).toBeTruthy();
    expect(screen.getByText("Eurorack Skiff Case")).toBeTruthy();
    expect(screen.queryByText("Instant Camera")).toBeNull();

    fireEvent.click(screen.getByRole("button", { name: /Wishlist/ }));
    expect(screen.getByText("Instant Camera")).toBeTruthy();
    expect(screen.queryByText("Eurorack Skiff Case")).toBeNull();
  });

  it("says so rather than showing an empty grid", () => {
    sheet("madhav");
    expect(screen.getByText(/hasn’t shared anything this month/)).toBeTruthy();
  });
});
