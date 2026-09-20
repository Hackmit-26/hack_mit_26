import { cleanup, fireEvent, render, screen, waitFor } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import {
  ItemDetailProvider,
  useItemDetail,
} from "@/components/commerce/ItemDetailModal";
import {
  artForFind,
  bgForFind,
  clearFindsCache,
  feedOrder,
  findCommentTarget,
  getCachedFind,
  ownerOf,
  setFindsApi,
  sharedUnion,
  useGroupFinds,
  wantLine,
} from "@/components/commerce/findsStore";
import type { RosterUser } from "@/components/commerce/findsStore";
import { setViewer } from "@/lib/api";
import type { FindItem, WishlistRoster } from "@/lib/apiTypes";
import { AppProvider, setCommentsApi, setWishlistApi } from "@/state/store";

function find(over: Partial<FindItem> & { id: string }): FindItem {
  return {
    ownerId: "esh",
    name: "A thing",
    category: "tech",
    merchant: "A shop",
    imageUrl: null,
    productUrl: null,
    description: null,
    heartCount: 0,
    iHearted: false,
    iWishlisted: false,
    ...over,
  };
}

const HERO = find({
  id: "item-esh-02",
  ownerId: "esh",
  name: "Marshall Stanmore III",
  category: "music",
  merchant: "Sound & Vision",
  productUrl: "https://example.com/stanmore",
  description: "the one that lives on the kitchen counter.",
  heartCount: 2,
  iWishlisted: true,
});

/** Shared anonymously: the server strips the owner before it ever leaves. */
const ANON = find({
  id: "item-sabina-24",
  ownerId: null,
  name: "Loose Leaf Tea Sampler",
  category: "food_drink",
  merchant: "Ember & Grind",
});

const ROSTERS: WishlistRoster[] = [
  {
    itemId: "item-esh-02",
    users: [
      { id: "kristina", name: "Kristina", avatarUrl: null },
      { id: "madhav", name: "Madhav", avatarUrl: null },
      { id: "sabina", name: "Sabina", avatarUrl: null },
    ],
  },
];

const heart = vi.fn<(itemId: string, on: boolean) => Promise<void>>();
const wishlist = vi.fn<(itemId: string, on: boolean) => Promise<void>>();

function stubApi(finds: FindItem[] = [HERO, ANON]): void {
  setFindsApi({
    finds: async () => finds,
    wishlists: async () => ROSTERS,
    heart,
    wishlist,
  });
}

/** The group feed and the modal, as the group page wires them together. */
function Harness() {
  const feed = useGroupFinds("tea-party");
  const { openItem } = useItemDetail();

  if (feed.status !== "ready") return <div>feed:{feed.status}</div>;

  return (
    <div>
      <div>feed:ready</div>
      {feed.finds.map((f) => (
        <button
          key={f.id}
          type="button"
          onClick={() => openItem({ kind: "find", id: f.id })}
        >
          open {f.id}
        </button>
      ))}
    </div>
  );
}

function mount() {
  return render(
    <AppProvider>
      <ItemDetailProvider>
        <Harness />
      </ItemDetailProvider>
    </AppProvider>,
  );
}

async function openFind(id: string) {
  await screen.findByText("feed:ready");
  fireEvent.click(screen.getByRole("button", { name: `open ${id}` }));
  return screen.getByRole("dialog");
}

beforeEach(() => {
  window.sessionStorage.clear();
  clearFindsCache();
  heart.mockReset();
  heart.mockResolvedValue(undefined);
  wishlist.mockReset();
  wishlist.mockResolvedValue(undefined);
  setViewer("kristina");
  stubApi();
  setCommentsApi({
    list: async () => [],
    create: async () => {
      throw new Error("not used");
    },
    remove: async () => undefined,
    viewerId: () => "kristina",
  });
  setWishlistApi({
    addLink: async () => ({ id: "x", name: "x", merchant: null, imageUrl: null, priceCents: null }),
    list: async () => [],
    remove: async () => {},
  });
});

afterEach(cleanup);

describe("feedOrder", () => {
  it("takes the group in turn rather than one person at a time", () => {
    const rows = [
      find({ id: "k1", ownerId: "kristina" }),
      find({ id: "k2", ownerId: "kristina" }),
      find({ id: "k3", ownerId: "kristina" }),
      find({ id: "e1", ownerId: "esh" }),
      find({ id: "e2", ownerId: "esh" }),
      find({ id: "a1", ownerId: null }),
    ];

    expect(feedOrder(rows, 6).map((f) => f.id)).toEqual(["k1", "e1", "a1", "k2", "e2", "k3"]);
  });

  it("stops at the limit and never repeats a row", () => {
    const rows = [
      find({ id: "k1", ownerId: "kristina" }),
      find({ id: "e1", ownerId: "esh" }),
      find({ id: "e2", ownerId: "esh" }),
    ];

    expect(feedOrder(rows, 2).map((f) => f.id)).toEqual(["k1", "e1"]);
    expect(feedOrder(rows, 99).map((f) => f.id)).toEqual(["k1", "e1", "e2"]);
    expect(feedOrder([], 8)).toEqual([]);
  });
});

describe("sharedUnion", () => {
  const person = (id: string, name: string): RosterUser => ({ id, name, avatarUrl: null });

  const ROWS = [
    find({ id: "k1", ownerId: "kristina" }),
    find({ id: "k2", ownerId: "kristina" }),
    find({ id: "k3", ownerId: "kristina", wanted: true }),
    find({ id: "e1", ownerId: "esh" }),
    find({ id: "e2", ownerId: "esh" }),
    find({ id: "a1", ownerId: null }),
  ];

  const LISTS: Record<string, RosterUser[]> = {
    e1: [person("kristina", "Kristina"), person("madhav", "Madhav")],
    k3: [person("esh", "Esh"), person("kristina", "Kristina")],
    a1: [person("sabina", "Sabina")],
  };

  it("is every shared buy and every wishlist entry, and nothing is left behind a limit", () => {
    // The whole point of the change: the section used to be a 12-row sample of this.
    expect(sharedUnion(ROWS, LISTS)).toHaveLength(ROWS.length);
    expect(new Set(sharedUnion(ROWS, LISTS).map((r) => r.find.id)).size).toBe(ROWS.length);
  });

  it("joins the two halves on item id rather than stacking them, so a wanted buy is one tile", () => {
    const rows = sharedUnion(ROWS, LISTS);
    const e1 = rows.filter((r) => r.find.id === "e1");

    expect(e1).toHaveLength(1);
    expect(e1[0]?.kind).toBe("bought");
    expect(e1[0]?.wantedBy.map((u) => u.id)).toEqual(["kristina", "madhav"]);
    expect(rows.find((r) => r.find.id === "k1")?.wantedBy).toEqual([]);
  });

  it("keeps the round-robin so one person cannot take the top of the page", () => {
    // One person per turn, and k3 is Kristina's want so it takes her first turn rather than
    // the last slot on the page — the server sorts by purchase date, which a want has not got.
    expect(sharedUnion(ROWS, LISTS).map((r) => r.find.id)).toEqual([
      "k3",
      "e1",
      "a1",
      "k1",
      "e2",
      "k2",
    ]);
    // Same input, same order, every time — the demo does not reshuffle itself.
    expect(sharedUnion(ROWS, LISTS).map((r) => r.find.id)).toEqual(
      sharedUnion(ROWS, LISTS).map((r) => r.find.id),
    );
  });

  it("says which rows are a want rather than a buy", () => {
    const kind = (id: string) => sharedUnion(ROWS, LISTS).find((r) => r.find.id === id)?.kind;

    expect(kind("k3")).toBe("wanted");
    expect(kind("k1")).toBe("bought");
    expect(kind("a1")).toBe("bought");
  });

  it("never turns a wishlist roster back into attribution", () => {
    const anon = sharedUnion(ROWS, LISTS).find((r) => r.find.id === "a1");

    // Sabina's name is on the roster because she wants it, not because she shared it.
    expect(anon?.wantedBy.map((u) => u.id)).toEqual(["sabina"]);
    expect(anon?.find.ownerId).toBeNull();
    expect(anon ? ownerOf(anon.find) : "missing").toBeNull();
  });

  it("ignores a roster with no find behind it, and an empty feed", () => {
    expect(sharedUnion(ROWS, { ...LISTS, "item-private": [person("esh", "Esh")] })).toHaveLength(
      ROWS.length,
    );
    expect(sharedUnion([], LISTS)).toEqual([]);
  });
});

describe("wantLine", () => {
  const person = (id: string, name: string): RosterUser => ({ id, name, avatarUrl: null });
  const KRISTINA = person("kristina", "Kristina");
  const ESH = person("esh", "Esh");
  const MADHAV = person("madhav", "Madhav");

  it("reads the viewer as themselves, whichever of the four is looking", () => {
    expect(wantLine([KRISTINA], "kristina")).toBe("You want this");
    expect(wantLine([KRISTINA], "esh")).toBe("Kristina wants this");
    expect(wantLine([ESH, KRISTINA], "kristina")).toBe("Esh and You want this");
    expect(wantLine([ESH, KRISTINA], "madhav")).toBe("Esh and Kristina want this");
  });

  it("counts the rest off rather than running the whole roster into the tile", () => {
    expect(wantLine([ESH, KRISTINA, MADHAV], "sabina")).toBe(
      "Esh, Kristina and 1 more want this",
    );
    expect(wantLine([], "esh")).toBe("");
  });
});

describe("find presentation", () => {
  it("picks an illustration from the category, and the same one every time", () => {
    expect(artForFind({ id: "item-1", category: "food_drink" })).toBe("mug");
    expect(artForFind({ id: "item-1", category: "tech" })).toBe("camera");
    // A category the seed has never produced still has to draw something stable.
    expect(artForFind({ id: "item-1", category: "wormholes" })).toBe(
      artForFind({ id: "item-1", category: "wormholes" }),
    );
    expect(artForFind({ id: "item-2", category: "wormholes" })).toBeTruthy();
  });

  it("reads the item's name before its category, so one tech shelf is not all cameras", () => {
    const tech = (name: string) => artForFind({ id: "item-1", category: "tech", name });

    expect(tech("Canon AE-1 Program 35mm SLR Body")).toBe("camera");
    expect(tech("Temperature-Controlled Soldering Station")).toBe("solder");
    expect(tech("65% Mechanical Keyboard Kit")).toBe("keyboard");
    expect(tech("Coiled Aviator USB-C Cable")).toBe("cable");

    expect(artForFind({ id: "item-2", category: "music", name: "Mother-25 Semi-Modular Synth" })).toBe(
      "synth",
    );
    expect(
      artForFind({ id: "item-3", category: "music", name: "Closed-Back Studio Monitor Headphones" }),
    ).toBe("headphones");
    expect(artForFind({ id: "item-4", category: "kitchen", name: "Carbon Steel Gyuto 210mm" })).toBe(
      "knife",
    );
  });

  it("takes the first keyword that matches, so a camera bag is a bag", () => {
    expect(artForFind({ id: "item-1", category: "accessories", name: "Waxed Canvas Camera Bag" })).toBe(
      "bag",
    );
    expect(
      artForFind({ id: "item-2", category: "accessories", name: "Whiskey Leather Camera Strap" }),
    ).toBe("necklace");
  });

  it("keeps book titles away from the keywords, since they read as prose", () => {
    // "Salt Fat Acid Heat" is not a tin of sea salt.
    const salt = artForFind({ id: "item-1", category: "books", name: "Salt Fat Acid Heat" });
    expect(["book", "notebook", "planner"]).toContain(salt);
    expect(artForFind({ id: "item-1", category: "books", name: "Salt Fat Acid Heat" })).toBe(salt);
  });

  it("still draws the same thing every time for a name it has never seen", () => {
    const unknown = { id: "item-9", category: "wormholes", name: "Quantum Foam Dispenser" };
    expect(artForFind(unknown)).toBe(artForFind(unknown));
    expect(artForFind({ ...unknown, id: "item-10" })).toBeTruthy();
  });

  it("colours a tile by its owner, and an anonymous one in cream", () => {
    expect(bgForFind({ ownerId: "esh" })).toBe("#BBA9E8");
    expect(bgForFind({ ownerId: null })).toBe("#F5ECD9");
    // A uuid from real Postgres is not one of the four demo people.
    expect(bgForFind({ ownerId: "b7f1-not-a-member" })).toBe("#F5ECD9");
    expect(ownerOf({ ownerId: "b7f1-not-a-member" })).toBeNull();
  });

  it("hangs comments off the real item row, not a hashed client key", () => {
    // `purchase` is the backend's item-ish kind: it authorises via assertItemVisibleTo.
    expect(findCommentTarget("item-esh-02")).toEqual({
      targetType: "purchase",
      targetId: "item-esh-02",
    });
  });
});

describe("the live group feed", () => {
  it("loads the finds and the wishlist rosters together", async () => {
    mount();

    expect(screen.getByText("feed:loading")).toBeTruthy();
    await screen.findByText("feed:ready");
    expect(screen.getByRole("button", { name: "open item-esh-02" })).toBeTruthy();
  });

  it("says so rather than showing an empty grid when the server is unreachable", async () => {
    setFindsApi({
      finds: async () => {
        throw new Error("down");
      },
      wishlists: async () => [],
      heart,
      wishlist,
    });
    mount();

    await screen.findByText("feed:error");
  });

  it("will not serve one person's feed to the next person", async () => {
    mount();
    await screen.findByText("feed:ready");
    expect(getCachedFind("item-esh-02")).toBeTruthy();

    // `iHearted`, `iWishlisted` and a stripped `ownerId` are all viewer-relative.
    setViewer("sabina");
    expect(getCachedFind("item-esh-02")).toBeNull();
  });
});

describe("the find modal", () => {
  it("shows the item, who shared it and who else wants it", async () => {
    mount();
    await openFind("item-esh-02");

    expect(screen.getByText("Marshall Stanmore III")).toBeTruthy();
    expect(screen.getByText("Sound & Vision")).toBeTruthy();
    expect(screen.getByText("the one that lives on the kitchen counter.")).toBeTruthy();
    expect(screen.getByText("Shared with the group")).toBeTruthy();

    expect(screen.getByText("Bought by")).toBeTruthy();
    expect(screen.getByText("Esh")).toBeTruthy();

    expect(screen.getByText("On a wishlist")).toBeTruthy();
    expect(screen.getByText("Kristina")).toBeTruthy();
    expect(screen.getByText("Madhav")).toBeTruthy();
    expect(screen.getByText("Sabina")).toBeTruthy();
    // The viewer reads as themselves on their own list.
    expect(screen.getByText("on your list")).toBeTruthy();
    expect(screen.getAllByText("on their list")).toHaveLength(2);
  });

  it("never names the owner of an anonymous find", async () => {
    mount();
    await openFind("item-sabina-24");

    expect(screen.getByText("Shared anonymously")).toBeTruthy();
    expect(screen.getByText("Someone in the group")).toBeTruthy();
    expect(screen.queryByText("Sabina")).toBeNull();
    // Nobody has starred it in this fixture, so the roster is absent rather than empty.
    expect(screen.queryByText("On a wishlist")).toBeNull();
  });

  it("is honest that a find carries no amount", async () => {
    mount();
    await openFind("item-esh-02");

    expect(screen.getByText("The group feed doesn’t carry amounts")).toBeTruthy();
  });

  it("degrades to no button at all when the item has no page", async () => {
    mount();
    await openFind("item-sabina-24");

    const out = screen
      .queryAllByRole("link")
      .find((a) => /Open the product page/.test(a.textContent ?? ""));
    expect(out).toBeUndefined();
    expect(screen.getByText(/no product page for this one/)).toBeTruthy();
  });

  it("counts hearts without naming anybody", async () => {
    mount();
    await openFind("item-esh-02");

    expect(screen.getByText("Hearts")).toBeTruthy();
    expect(screen.getByText("2 in the group. names stay private.")).toBeTruthy();
    expect(screen.queryByText("Liked by")).toBeNull();
  });

  it("hearts an item for real, and moves the count before the server answers", async () => {
    mount();
    await openFind("item-esh-02");

    fireEvent.click(screen.getByRole("button", { name: "Heart this · 2 in the group" }));

    await waitFor(() =>
      expect(screen.getByRole("button", { name: "Remove your heart · 3 in the group" })).toBeTruthy(),
    );
    expect(heart).toHaveBeenCalledWith("item-esh-02", true);
    expect(screen.getByText("you and 2 others.")).toBeTruthy();
    expect(getCachedFind("item-esh-02")?.iHearted).toBe(true);
  });

  it("puts the heart back when the server refuses it", async () => {
    heart.mockRejectedValue(new Error("nope"));
    mount();
    await openFind("item-esh-02");

    fireEvent.click(screen.getByRole("button", { name: "Heart this · 2 in the group" }));

    await waitFor(() => expect(getCachedFind("item-esh-02")?.iHearted).toBe(false));
    expect(screen.getByRole("button", { name: "Heart this · 2 in the group" })).toBeTruthy();
  });

  it("stars a find for real, and puts the viewer on the roster straight away", async () => {
    mount();
    await openFind("item-sabina-24");
    // Nobody is on this one's roster in the fixture, so the section is absent to begin with.
    expect(screen.queryByText("On a wishlist")).toBeNull();

    fireEvent.click(screen.getByRole("button", { name: "Add to your list" }));

    await waitFor(() =>
      expect(screen.getByRole("button", { name: "Remove from your list" })).toBeTruthy(),
    );
    expect(wishlist).toHaveBeenCalledWith("item-sabina-24", true);
    expect(screen.getByText("On a wishlist")).toBeTruthy();
    expect(screen.getByText("Kristina")).toBeTruthy();
    expect(getCachedFind("item-sabina-24")?.iWishlisted).toBe(true);
  });

  it("takes the viewer back off the roster when they unstar it", async () => {
    mount();
    await openFind("item-esh-02");
    expect(screen.getByText("on your list")).toBeTruthy();

    fireEvent.click(screen.getByRole("button", { name: "Remove from your list" }));

    await waitFor(() => expect(getCachedFind("item-esh-02")?.iWishlisted).toBe(false));
    expect(wishlist).toHaveBeenCalledWith("item-esh-02", false);
    expect(screen.queryByText("on your list")).toBeNull();
    expect(screen.getAllByText("on their list")).toHaveLength(2);
  });

  it("puts the star and the roster back together when the server refuses", async () => {
    wishlist.mockRejectedValue(new Error("nope"));
    mount();
    await openFind("item-sabina-24");

    fireEvent.click(screen.getByRole("button", { name: "Add to your list" }));

    await waitFor(() => expect(getCachedFind("item-sabina-24")?.iWishlisted).toBe(false));
    expect(screen.queryByText("On a wishlist")).toBeNull();
  });

  it("shows nothing for a find the feed has never loaded", async () => {
    mount();
    await screen.findByText("feed:ready");
    // Only the ids the feed handed out can be opened; anything else resolves to nothing.
    expect(screen.queryByRole("dialog")).toBeNull();
  });
});
