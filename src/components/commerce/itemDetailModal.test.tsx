import { cleanup, fireEvent, render, screen, waitFor } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it } from "vitest";

import {
  ItemDetailProvider,
  useItemDetail,
  type ItemDetailRequest,
} from "@/components/commerce/ItemDetailModal";
import { SaveButton } from "@/components/wishlist/SaveButton";
import { AppProvider, setCommentsApi, setWishlistApi } from "@/state/store";

/** A tile, reduced to the one thing every tile now does. */
function Trigger({ request }: { request: ItemDetailRequest }) {
  const { openItem } = useItemDetail();
  return (
    <button type="button" onClick={() => openItem(request)}>
      open the tile
    </button>
  );
}

function mount(request: ItemDetailRequest, extra?: React.ReactNode) {
  return render(
    <AppProvider>
      <ItemDetailProvider>
        {extra}
        <Trigger request={request} />
      </ItemDetailProvider>
    </AppProvider>,
  );
}

function openIt() {
  fireEvent.click(screen.getByRole("button", { name: "open the tile" }));
  return screen.getByRole("dialog");
}

function linkNamed(pattern: RegExp): HTMLElement | undefined {
  return screen.queryAllByRole("link").find((a) => pattern.test(a.textContent ?? ""));
}

beforeEach(() => {
  window.sessionStorage.clear();
  setCommentsApi({
    list: async () => [],
    create: async () => {
      throw new Error("not used");
    },
    remove: async () => undefined,
    viewerId: () => "kristina",
  });
  setWishlistApi({ addLink: async () => ({ id: "x", name: "x", merchant: null, imageUrl: null, priceCents: null }), list: async () => [], remove: async () => {} });
});

afterEach(cleanup);

describe("ItemDetailModal", () => {
  it("is not on the page until a tile asks for it", () => {
    mount({ kind: "product", id: "prod-esh-rings" });
    expect(screen.queryByRole("dialog")).toBeNull();
  });

  it("opens a catalogue product with its price, shop and page", () => {
    mount({ kind: "product", id: "prod-esh-rings" });
    const dialog = openIt();

    expect(dialog.getAttribute("aria-modal")).toBe("true");
    expect(dialog.getAttribute("aria-label")).toBe(
      "Silver stacking rings, set of 3 at Tin & Tulip",
    );
    expect(screen.getByText("Silver stacking rings, set of 3")).toBeTruthy();
    expect(screen.getByText("Tin & Tulip")).toBeTruthy();
    expect(screen.getByText("$24")).toBeTruthy();

    const out = linkNamed(/Open the product page/);
    expect(out?.getAttribute("href")).toBe("https://www.etsy.com/c/jewelry/rings");
    expect(out?.getAttribute("target")).toBe("_blank");
    expect(out?.getAttribute("rel")).toBe("noopener noreferrer");
  });

  it("opens a receipt with everyone in the group who bought the same thing", () => {
    mount({ kind: "purchase", id: "p-esh-2" });
    openIt();

    expect(screen.getByText("Adidas Samba")).toBeTruthy();
    expect(screen.getByText("Bought by")).toBeTruthy();
    // Esh bought it on the 10th, Sabina on the 7th — one item, two buyers.
    expect(screen.getByText("Esh")).toBeTruthy();
    expect(screen.getByText("Sabina")).toBeTruthy();
    expect(screen.getByText("Sep 10 · Adidas")).toBeTruthy();
    expect(screen.getByText("Sep 7 · Adidas")).toBeTruthy();
    expect(linkNamed(/Open the product page/)?.getAttribute("href")).toBe(
      "https://www.adidas.com/us/samba",
    );
  });

  it("keeps someone else's amount to themselves until they share it", () => {
    mount({ kind: "purchase", id: "p-esh-2" });
    openIt();

    expect(screen.queryByText("$100")).toBeNull();
    expect(screen.getByText("Amount hidden by the buyer")).toBeTruthy();
  });

  it("shows the viewer their own amount", () => {
    mount({ kind: "purchase", id: "p-kristina-9" });
    openIt();

    expect(screen.getByText("$100")).toBeTruthy();
    expect(screen.queryByText("Amount hidden by the buyer")).toBeNull();
  });

  it("names the friends who liked it", () => {
    mount({ kind: "purchase", id: "p-sabina-3" });
    openIt();

    expect(screen.getByText("Liked by")).toBeTruthy();
    expect(screen.getByText("Esh")).toBeTruthy();
    expect(screen.queryByText(/no likes yet/)).toBeNull();
  });

  it("says so rather than faking a roster when nobody has liked it", () => {
    mount({ kind: "purchase", id: "p-kristina-9" });
    openIt();

    expect(screen.getByText(/no likes yet/)).toBeTruthy();
  });

  it("stays deliberate with no photo and no product page", () => {
    // A café matcha: no page to open, no photo to show. Both are normal.
    const { container } = mount({ kind: "purchase", id: "p-kristina-7" });
    const dialog = openIt();

    expect(screen.getByText("Iced matcha")).toBeTruthy();
    expect(screen.getByText("Verde Café")).toBeTruthy();
    expect(linkNamed(/Open the product page/)).toBeUndefined();
    expect(screen.getByText(/no product page for this one/)).toBeTruthy();
    // The illustration stands in for the photo.
    expect(container.querySelectorAll('img[src^="/products"]')).toHaveLength(0);
    expect(dialog.querySelector("svg")).toBeTruthy();
    // Four people in a four-person group drink the same matcha.
    expect(screen.getByText("Sep 8 · Verde Café")).toBeTruthy();
  });

  it("opens a saved wishlist row as the viewer's own", async () => {
    mount({ kind: "wishlist", id: "prod-esh-rings" }, <SaveButton productId="prod-esh-rings" />);
    fireEvent.click(screen.getByRole("button", { name: "Save to your list" }));
    openIt();

    expect(screen.getByText("Saved from the Wrapped")).toBeTruthy();
    expect(screen.getByText("Added by")).toBeTruthy();
    expect(screen.getByText("Kristina")).toBeTruthy();
    // The list you are looking at is not news about who wishlisted it.
    expect(screen.queryByText("On a wishlist")).toBeNull();
  });

  it("tells a product it is already on the viewer's list", () => {
    mount({ kind: "product", id: "prod-esh-rings" }, <SaveButton productId="prod-esh-rings" />);
    fireEvent.click(screen.getByRole("button", { name: "Save to your list" }));
    openIt();

    expect(screen.getByText("On a wishlist")).toBeTruthy();
    expect(screen.getByText("Kristina")).toBeTruthy();
  });

  it("omits the rosters it has no answer for", () => {
    mount({ kind: "product", id: "prod-esh-rings" });
    openIt();

    expect(screen.queryByText("Bought by")).toBeNull();
    expect(screen.queryByText("On a wishlist")).toBeNull();
    expect(screen.queryByText("Added by")).toBeNull();
  });

  it("carries the comment thread", async () => {
    mount({ kind: "purchase", id: "p-esh-2" });
    openIt();

    expect(screen.getByText("Comments")).toBeTruthy();
    fireEvent.click(screen.getByRole("button", { name: "Open the thread" }));
    expect(screen.getByLabelText("Add a comment")).toBeTruthy();
    await waitFor(() =>
      expect(screen.getByText(/no one has said anything yet/)).toBeTruthy(),
    );
  });

  it("closes on Escape and gives focus back to the tile", async () => {
    mount({ kind: "product", id: "prod-esh-rings" });
    const tile = screen.getByRole("button", { name: "open the tile" });
    tile.focus();
    openIt();

    expect(document.activeElement).not.toBe(tile);

    fireEvent.keyDown(document.body, { key: "Escape" });

    await waitFor(() => expect(screen.queryByRole("dialog")).toBeNull());
    expect(document.activeElement).toBe(tile);
  });

  it("closes on the close button", async () => {
    mount({ kind: "product", id: "prod-esh-rings" });
    openIt();

    fireEvent.click(screen.getByRole("button", { name: "Close" }));
    await waitFor(() => expect(screen.queryByRole("dialog")).toBeNull());
  });

  it("shows nothing at all for an id that resolves to nothing", () => {
    mount({ kind: "product", id: "prod-does-not-exist" });
    fireEvent.click(screen.getByRole("button", { name: "open the tile" }));

    expect(screen.queryByRole("dialog")).toBeNull();
  });
});
