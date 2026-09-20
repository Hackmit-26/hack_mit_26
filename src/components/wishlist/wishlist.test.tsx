import { cleanup, fireEvent, render, screen, waitFor } from "@testing-library/react";
import type { ReactNode } from "react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import { AddLinkForm } from "@/components/wishlist/AddLinkForm";
import { SaveButton } from "@/components/wishlist/SaveButton";
import { WishlistGrid } from "@/components/wishlist/WishlistGrid";
import {
  AppProvider,
  setWishlistApi,
  type WishlistLinkResult,
} from "@/state/store";

const CATALOGUE_ID = "prod-esh-rings";

function serverItem(over: Partial<WishlistLinkResult> = {}): WishlistLinkResult {
  return {
    id: "srv-1",
    name: "Oat cashmere scarf",
    merchant: "threadbare.com",
    imageUrl: null,
    priceCents: 6400,
    ...over,
  };
}

function ui(children: ReactNode) {
  return render(<AppProvider>{children}</AppProvider>);
}

function paste(url: string) {
  fireEvent.change(screen.getByLabelText("Product link"), {
    target: { value: url },
  });
  fireEvent.submit(screen.getByRole("button", { name: "Add to list" }));
}

beforeEach(() => {
  window.sessionStorage.clear();
  setWishlistApi({
    addLink: vi.fn(async () => serverItem()),
    list: vi.fn(async () => []),
  });
});

afterEach(cleanup);

describe("WishlistGrid", () => {
  it("says so when the list is empty", () => {
    ui(<WishlistGrid />);
    expect(screen.getByText(/Nothing on the list yet/)).toBeTruthy();
    expect(screen.queryByRole("button", { name: /Remove/ })).toBeNull();
  });

  it("renders a saved catalogue item and removes it again", async () => {
    ui(
      <>
        <SaveButton productId={CATALOGUE_ID} />
        <WishlistGrid />
      </>,
    );

    fireEvent.click(screen.getByRole("button", { name: "Save to your list" }));
    expect(screen.getByText("Silver stacking rings, set of 3")).toBeTruthy();
    expect(screen.getByText(/Tin & Tulip/)).toBeTruthy();
    expect(screen.queryByText(/Nothing on the list yet/)).toBeNull();

    fireEvent.click(
      screen.getByRole("button", {
        name: "Remove Silver stacking rings, set of 3 from your list",
      }),
    );
    expect(screen.getByText(/Nothing on the list yet/)).toBeTruthy();
  });
});

describe("SaveButton", () => {
  it("flips its label and never double-saves", () => {
    ui(
      <>
        <SaveButton productId={CATALOGUE_ID} />
        <WishlistGrid />
      </>,
    );
    const button = () =>
      screen.getByRole("button", { name: /^(Save to|Remove from) your list$/ });

    fireEvent.click(button());
    expect(screen.getByText("On your list")).toBeTruthy();
    expect(button().getAttribute("aria-pressed")).toBe("true");

    fireEvent.click(button());
    expect(screen.getByText("Save to list")).toBeTruthy();
    expect(screen.getByText(/Nothing on the list yet/)).toBeTruthy();
  });
});

describe("AddLinkForm", () => {
  it("shows the row pending while the page is being read", async () => {
    let release!: (value: WishlistLinkResult) => void;
    setWishlistApi({
      addLink: () => new Promise<WishlistLinkResult>((r) => (release = r)),
      list: async () => [],
    });

    ui(
      <>
        <AddLinkForm />
        <WishlistGrid />
      </>,
    );

    paste("https://threadbare.com/scarf");

    expect(screen.getByText("Reading threadbare.com…")).toBeTruthy();
    expect(screen.getByText("Reading the page")).toBeTruthy();
    expect(
      screen.getByRole("button", { name: "Reading the page…" }).hasAttribute("disabled"),
    ).toBe(true);

    release(serverItem());

    await waitFor(() => expect(screen.getByText("Oat cashmere scarf")).toBeTruthy());
    expect(screen.getByText(/threadbare.com · \$64/)).toBeTruthy();
    expect(screen.queryByText("Reading the page")).toBeNull();
    expect(screen.getByRole("button", { name: "Add to list" })).toBeTruthy();
  });

  it("keeps the item on the list when the backend is unreachable", async () => {
    setWishlistApi({
      addLink: async () => {
        throw new Error("fetch failed");
      },
      list: async () => [],
    });

    ui(
      <>
        <AddLinkForm />
        <WishlistGrid />
      </>,
    );

    paste("https://threadbare.com/scarf");

    await waitFor(() =>
      expect(screen.getByText("Saved from threadbare.com")).toBeTruthy(),
    );
    expect(screen.getByText(/couldn’t reach the server/)).toBeTruthy();
    expect(screen.queryByText(/Nothing on the list yet/)).toBeNull();
  });

  it("carries a typed price into the request", async () => {
    const addLink = vi.fn(async () => serverItem({ priceCents: 3800 }));
    setWishlistApi({ addLink, list: async () => [] });

    ui(<AddLinkForm />);
    fireEvent.change(screen.getByLabelText("Product link"), {
      target: { value: "https://threadbare.com/scarf" },
    });
    fireEvent.change(screen.getByLabelText("Price, if you know it"), {
      target: { value: "$38.00" },
    });
    fireEvent.submit(screen.getByRole("button", { name: "Add to list" }));

    await waitFor(() =>
      expect(addLink).toHaveBeenCalledWith("https://threadbare.com/scarf", 3800),
    );
  });

  it("rejects something that is not a link", async () => {
    const addLink = vi.fn(async () => serverItem());
    setWishlistApi({ addLink, list: async () => [] });

    ui(
      <>
        <AddLinkForm />
        <WishlistGrid />
      </>,
    );

    paste("the green scarf sabina had");

    expect(screen.getByRole("alert").textContent).toContain("needs to be a link");
    expect(addLink).not.toHaveBeenCalled();
    expect(screen.getByText(/Nothing on the list yet/)).toBeTruthy();
  });

  it("does not add the same link twice", async () => {
    ui(
      <>
        <AddLinkForm />
        <WishlistGrid />
      </>,
    );

    paste("https://threadbare.com/scarf");
    await waitFor(() => expect(screen.getByText("Oat cashmere scarf")).toBeTruthy());
    paste("https://threadbare.com/scarf");
    await waitFor(() =>
      expect(screen.getByRole("button", { name: "Add to list" })).toBeTruthy(),
    );

    expect(screen.getAllByText("Oat cashmere scarf")).toHaveLength(1);
  });
});
