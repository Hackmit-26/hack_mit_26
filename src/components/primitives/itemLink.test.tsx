import { cleanup, fireEvent, render, screen } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";

import { ItemLink } from "@/components/primitives/ItemLink";

afterEach(cleanup);

describe("ItemLink", () => {
  it("opens the product page in a new tab", () => {
    render(
      <ItemLink url="https://threadbare.com/scarf" label="Oat cashmere scarf at threadbare.com">
        <span>Oat cashmere scarf</span>
      </ItemLink>,
    );

    const link = screen.getByRole("link", {
      name: "Oat cashmere scarf at threadbare.com — open the product page in a new tab",
    });
    expect(link.getAttribute("href")).toBe("https://threadbare.com/scarf");
    expect(link.getAttribute("target")).toBe("_blank");
    expect(link.getAttribute("rel")).toBe("noopener noreferrer");
  });

  it("renders a plain tile when the item has no page", () => {
    const { container } = render(
      <ItemLink url={null} label="September receipt at Kudo Bakery">
        <span>Claw clip</span>
      </ItemLink>,
    );

    expect(screen.queryByRole("link")).toBeNull();
    expect(container.querySelector("a")).toBeNull();
    expect(screen.getByText("Claw clip")).toBeTruthy();
  });

  it("renders a plain tile when the url is absent", () => {
    const { container } = render(
      <ItemLink url={undefined} label="Charm necklace at Tin & Tulip">
        <span>Charm necklace</span>
      </ItemLink>,
    );

    expect(container.querySelector("a")).toBeNull();
    expect(screen.getByText("Charm necklace")).toBeTruthy();
  });

  it("opens the details instead of the page when given a handler", () => {
    const onActivate = vi.fn();
    const { container } = render(
      <ItemLink
        url="https://threadbare.com/scarf"
        label="Oat cashmere scarf at threadbare.com"
        onActivate={onActivate}
      >
        <span>Oat cashmere scarf</span>
      </ItemLink>,
    );

    expect(container.querySelector("a")).toBeNull();
    fireEvent.click(
      screen.getByRole("button", {
        name: "Oat cashmere scarf at threadbare.com — open the item details",
      }),
    );
    expect(onActivate).toHaveBeenCalledOnce();
  });

  it("is still clickable when the item has no page at all", () => {
    const onActivate = vi.fn();
    render(
      <ItemLink url={null} label="Iced matcha at Verde Café" onActivate={onActivate}>
        <span>Iced matcha</span>
      </ItemLink>,
    );

    fireEvent.click(
      screen.getByRole("button", { name: "Iced matcha at Verde Café — open the item details" }),
    );
    expect(onActivate).toHaveBeenCalledOnce();
  });
});
