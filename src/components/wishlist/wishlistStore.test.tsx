import { cleanup, render, screen, waitFor } from "@testing-library/react";
import { act } from "react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import {
  AppProvider,
  setWishlistApi,
  useApp,
  type WishlistApi,
  type WishlistLinkResult,
} from "@/state/store";

// We drive the store through React's own act(), outside render().
(globalThis as { IS_REACT_ACT_ENVIRONMENT?: boolean }).IS_REACT_ACT_ENVIRONMENT = true;

const CATALOGUE_ID = "prod-esh-rings";

function result(over: Partial<WishlistLinkResult> = {}): WishlistLinkResult {
  return {
    id: "srv-1",
    name: "Silver stacking rings",
    merchant: "tinandtulip.com",
    imageUrl: null,
    priceCents: 2400,
    ...over,
  };
}

/** Exposes the store to the test without rendering any of the real surface. */
let api: ReturnType<typeof useApp>;

function Probe() {
  api = useApp();
  return (
    <ul>
      {api.wishlist.map((w) => (
        <li key={w.id} data-pending={w.pending ? "yes" : "no"}>
          {w.title}
        </li>
      ))}
    </ul>
  );
}

function mount() {
  return render(
    <AppProvider>
      <Probe />
    </AppProvider>,
  );
}

const offlineApi: WishlistApi = {
  addLink: () => Promise.reject(new Error("fetch failed")),
  list: () => Promise.reject(new Error("fetch failed")),
};

beforeEach(() => {
  window.sessionStorage.clear();
  setWishlistApi({
    addLink: vi.fn(async () => result()),
    list: vi.fn(async () => []),
  });
});

afterEach(cleanup);

describe("wishlist store", () => {
  it("saving a catalogue product puts the whole item on the list", async () => {
    mount();
    await act(async () => api.toggleSaved(CATALOGUE_ID));

    expect(api.wishlist).toHaveLength(1);
    expect(api.wishlist[0]).toMatchObject({
      productId: CATALOGUE_ID,
      source: "catalogue",
      title: "Silver stacking rings, set of 3",
      merchant: "Tin & Tulip",
      priceCents: 2400,
    });
    expect(api.isSaved(CATALOGUE_ID)).toBe(true);
    // Existing callers still look catalogue ids up in src/data.
    expect(api.savedProductIds).toEqual([CATALOGUE_ID]);
  });

  it("saving the same product twice unsaves it", async () => {
    mount();
    await act(async () => api.toggleSaved(CATALOGUE_ID));
    await act(async () => api.toggleSaved(CATALOGUE_ID));

    expect(api.wishlist).toHaveLength(0);
    expect(api.isSaved(CATALOGUE_ID)).toBe(false);
    expect(api.savedProductIds).toEqual([]);
  });

  it("holds link items that are not in the catalogue", async () => {
    mount();
    await act(async () => {
      await api.addWishlistLink("https://tinandtulip.com/rings");
    });

    expect(api.wishlist[0]).toMatchObject({
      source: "link",
      title: "Silver stacking rings",
      merchant: "tinandtulip.com",
      priceCents: 2400,
      url: "https://tinandtulip.com/rings",
      pending: false,
    });
    // Link items must never leak into the catalogue-backed id list.
    expect(api.savedProductIds).toEqual([]);
  });

  it("passes a typed price through to the seam", async () => {
    const addLink = vi.fn(async () => result({ priceCents: 3800 }));
    setWishlistApi({ addLink, list: async () => [] });
    mount();

    await act(async () => {
      await api.addWishlistLink("https://shop.test/thing", 3800);
    });

    expect(addLink).toHaveBeenCalledWith("https://shop.test/thing", 3800);
  });

  it("shows the item pending before the scrape lands", async () => {
    let release!: (value: WishlistLinkResult) => void;
    setWishlistApi({
      addLink: () => new Promise<WishlistLinkResult>((r) => (release = r)),
      list: async () => [],
    });
    mount();

    let pendingAdd!: Promise<void>;
    await act(async () => {
      pendingAdd = api.addWishlistLink("https://tinandtulip.com/rings");
    });

    expect(api.wishlist).toHaveLength(1);
    expect(api.wishlist[0].pending).toBe(true);
    expect(screen.getByText("Reading tinandtulip.com…")).toBeTruthy();

    await act(async () => {
      release(result());
      await pendingAdd;
    });

    expect(api.wishlist[0].pending).toBe(false);
    expect(screen.getByText("Silver stacking rings")).toBeTruthy();
  });

  it("keeps the item when the backend is unreachable", async () => {
    setWishlistApi(offlineApi);
    mount();

    await act(async () => {
      await api.addWishlistLink("https://tinandtulip.com/rings");
    });

    expect(api.wishlist).toHaveLength(1);
    expect(api.wishlist[0]).toMatchObject({
      title: "Saved from tinandtulip.com",
      merchant: "tinandtulip.com",
      pending: false,
    });
    expect(api.wishlist[0].note).toContain("couldn’t reach the server");
  });

  it("does not add the same link twice", async () => {
    mount();
    await act(async () => {
      await api.addWishlistLink("https://tinandtulip.com/rings");
    });
    await act(async () => {
      await api.addWishlistLink("https://tinandtulip.com/rings");
    });

    expect(api.wishlist).toHaveLength(1);
  });

  it("ignores an empty url without calling the seam", async () => {
    const addLink = vi.fn(async () => result());
    setWishlistApi({ addLink, list: async () => [] });
    mount();

    await act(async () => {
      await api.addWishlistLink("   ");
    });

    expect(addLink).not.toHaveBeenCalled();
    expect(api.wishlist).toHaveLength(0);
  });

  it("removes an item by id", async () => {
    mount();
    await act(async () => api.toggleSaved(CATALOGUE_ID));
    await act(async () => api.removeWishlistItem(CATALOGUE_ID));

    expect(api.wishlist).toHaveLength(0);
  });

  it("merges the server list without duplicating what is already local", async () => {
    setWishlistApi({
      addLink: async () => result(),
      list: async () => [result({ id: "srv-9", name: "Hojicha tin" })],
    });
    mount();

    await act(async () => {
      await api.refreshWishlist();
      await api.refreshWishlist();
    });

    expect(api.wishlist.filter((w) => w.title === "Hojicha tin")).toHaveLength(1);
  });

  it("keeps a server item with no product page on the list, without a url", async () => {
    setWishlistApi({
      addLink: async () => result(),
      list: async () => [result({ id: "srv-9", name: "Hojicha tin", url: null })],
    });
    mount();

    await act(async () => {
      await api.refreshWishlist();
    });

    const item = api.wishlist.find((w) => w.title === "Hojicha tin");
    expect(item).toBeDefined();
    expect(item?.url).toBeUndefined();
  });

  it("carries the server's product page onto the item", async () => {
    setWishlistApi({
      addLink: async () => result(),
      list: async () => [result({ id: "srv-9", url: "https://tinandtulip.com/rings" })],
    });
    mount();

    await act(async () => {
      await api.refreshWishlist();
    });

    expect(api.wishlist.find((w) => w.id === "srv-9")?.url).toBe(
      "https://tinandtulip.com/rings",
    );
  });

  it("survives a list() that never answers", async () => {
    setWishlistApi(offlineApi);
    mount();
    await act(async () => api.toggleSaved(CATALOGUE_ID));

    await act(async () => {
      await api.refreshWishlist();
    });

    expect(api.wishlist).toHaveLength(1);
  });

  it("migrates a session stored before the wishlist existed", async () => {
    window.sessionStorage.setItem(
      "shop-wrapped-demo",
      JSON.stringify({ savedProductIds: [CATALOGUE_ID] }),
    );
    mount();

    await waitFor(() => expect(api.wishlist).toHaveLength(1));
    expect(api.wishlist[0].title).toBe("Silver stacking rings, set of 3");
    expect(api.savedProductIds).toEqual([CATALOGUE_ID]);
  });
});
