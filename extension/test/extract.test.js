/**
 * `src/extract.js` is a content script, not a module — Chrome evaluates the file and takes the
 * value of its last expression. `window.eval(source)` reproduces exactly that, so these run the
 * shipped file with no shim in between.
 */

import { readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { JSDOM } from "jsdom";
import { describe, expect, it } from "vitest";

const source = readFileSync(
  fileURLToPath(new URL("../src/extract.js", import.meta.url)),
  "utf8",
);

function extract(html, url = "https://shop.example.com/products/thing") {
  const dom = new JSDOM(html, { url, runScripts: "outside-only", pretendToBeVisual: true });
  return dom.window.eval(source);
}

/** The only price on the page, so whatever comes back came from this string. */
const priceOf = (text) => extract(`<html><body><p class="price">${text}</p></body></html>`).priceCents;

describe("price parsing", () => {
  it.each([
    ["$1,299.00", 129900],
    ["1.299,00 €", 129900],
    ["1 299,00 €", 129900],
    ["£45", 4500],
    ["45", 4500],
    ["From $12.99", 1299],
    ["12.99 - 24.99", 1299],
  ])("reads %s as %i cents", (text, cents) => {
    expect(priceOf(text)).toBe(cents);
  });

  it("does not fuse a price with the number that follows it", () => {
    // Two sibling prices are joined by a space once the text is normalised; treating that as one
    // number turned $1,299.00 into $1,299,001,499.00.
    expect(priceOf("$1,299.00 $1,499.00")).toBe(129900);
    expect(priceOf("$30.00 100% cotton")).toBe(3000);
  });

  it("ignores prices that are not prices", () => {
    expect(priceOf("$0.00")).toBeNull();
    expect(priceOf("4.5 out of 5")).toBeNull();
    expect(priceOf("$44/mo with Affirm")).toBeNull();
  });

  it("prefers the sale price over its struck-through sibling", () => {
    const { priceCents } = extract(`<html><body>
      <span class="price price--compare"><del>$149.00</del></span>
      <div class="price-item price-item--sale">$99.00</div>
    </body></html>`);
    expect(priceCents).toBe(9900);
  });
});

describe("structured data", () => {
  it("reads a schema.org Product ahead of the OG tags", () => {
    const result = extract(`<html><head>
      <meta property="og:title" content="Ceramic Mug">
      <meta property="og:site_name" content="Nook Goods">
      <script type="application/ld+json">{"@type":"Product","name":"Hand-thrown Ceramic Mug",
        "brand":{"name":"Nook"},"image":["https://cdn.nook.com/mug.jpg"],"description":"A mug.",
        "offers":{"@type":"Offer","price":"38.00","priceCurrency":"USD"}}</script>
    </head><body></body></html>`);

    expect(result).toMatchObject({
      title: "Hand-thrown Ceramic Mug",
      imageUrl: "https://cdn.nook.com/mug.jpg",
      priceCents: 3800,
      currency: "USD",
      merchant: "Nook",
      category: "kitchen",
      confident: true,
    });
  });

  it("skips a related-products node for the one that carries a price", () => {
    const result = extract(`<html><head>
      <script type="application/ld+json">{"@type":"Product","name":"Related Sock"}</script>
      <script type="application/ld+json">{"@context":"https://schema.org","@graph":[
        {"@type":"WebSite","name":"Shop"},
        {"@type":"Product","name":"Merino Crew Sweater",
         "offers":{"@type":"AggregateOffer","lowPrice":"120.00","priceCurrency":"GBP"},
         "category":{"@type":"Thing","name":"Knitwear"}}]}</script>
    </head><body></body></html>`);

    expect(result).toMatchObject({ title: "Merino Crew Sweater", priceCents: 12000, currency: "GBP" });
  });

  it("survives one malformed JSON-LD block", () => {
    const result = extract(`<html><head>
      <script type="application/ld+json">{ not json </script>
      <script type="application/ld+json">{"@type":"Product","name":"Still Found",
        "offers":{"price":10}}</script>
    </head><body></body></html>`);
    expect(result.title).toBe("Still Found");
    expect(result.priceCents).toBe(1000);
  });
});

describe("pages without structured data", () => {
  it("falls back to Open Graph", () => {
    const result = extract(`<html><head>
      <meta property="og:title" content="Air Max 90 Sneaker">
      <meta property="og:image" content="https://nike.com/shoe.png">
      <meta property="product:price:amount" content="129.99">
      <meta property="product:price:currency" content="GBP">
      <meta property="og:site_name" content="Nike">
    </head><body></body></html>`);

    expect(result).toMatchObject({
      title: "Air Max 90 Sneaker",
      priceCents: 12999,
      currency: "GBP",
      merchant: "Nike",
      category: "shoes",
    });
  });

  it("reads Amazon's product title and sale price", () => {
    const result = extract(
      `<html><head><title>Amazon.com: Anker 737 Power Bank</title></head><body>
        <span id="productTitle">Anker 737 Power Bank</span>
        <span class="a-price a-text-price basisPrice"><span class="a-offscreen">$1,499.00</span></span>
        <div class="a-price"><span class="a-offscreen">$1,299.00</span></div>
      </body></html>`,
      "https://www.amazon.com/dp/B0B5THZQ2J",
    );

    expect(result).toMatchObject({
      title: "Anker 737 Power Bank",
      priceCents: 129900,
      currency: "USD",
      merchant: "amazon.com",
    });
  });

  it("does not let the site nav decide the category", () => {
    const result = extract(`<html><body>
      <nav><a>Shoes</a><a>Bags</a></nav>
      <h1>Heavyweight Cotton T-Shirt</h1>
    </body></html>`);
    expect(result.category).toBe("clothing");
  });

  // Every one of these is a shape a live retailer page actually served; with singular-only
  // keywords they all fell through to 'other'.
  it.each([
    ["Air Force 1 Low Men's Shoes", "shoes"],
    ["Chelsea Boots", "shoes"],
    ["AIRism Cotton Oversized T-Shirts", "clothing"],
    ["Wide Leg Trousers", "clothing"],
    ["Linen Summer Dresses", "clothing"],
    ["Polarised Sunglasses", "accessories"],
    ["Gold Hoop Earrings", "accessories"],
    ["Automatic Dive Watches", "accessories"],
    ["Fine Silver Jewellery", "accessories"],
    ["Hydrating Moisturiser", "beauty"],
    ["Santoku Knives", "kitchen"],
    ["Floating Oak Shelves", "home"],
    ["Noise Cancelling Headphones", "tech"],
    ["Dot Grid Notebooks", "stationery"],
  ])("categorises the plural title %s", (title, category) => {
    const result = extract(`<html><head><title>${title}</title></head><body></body></html>`);
    expect(result.category).toBe(category);
  });

  it("still returns something usable on a page with nothing on it", () => {
    const result = extract(`<html><head><title>Wool Scarf</title></head><body></body></html>`);
    expect(result).toMatchObject({
      title: "Wool Scarf",
      imageUrl: null,
      priceCents: null,
      category: "accessories",
      confident: false,
    });
    expect(result.url).toBe("https://shop.example.com/products/thing");
  });
});

describe("the item body the backend will accept", () => {
  it("never yields an empty-string url or image", () => {
    // `POST /items` validates both with `z.url()`, so "" is a 400 where null is fine.
    const result = extract(`<html><head><meta property="og:image" content=""></head><body></body></html>`);
    expect(result.imageUrl).toBeNull();
    expect(result.url).toMatch(/^https:\/\//);
  });

  it("resolves relative images against the page", () => {
    const result = extract(`<html><head><meta property="og:image" content="/img/mug.jpg"></head><body></body></html>`);
    expect(result.imageUrl).toBe("https://shop.example.com/img/mug.jpg");
  });

  it("rejects a javascript: image url", () => {
    const result = extract(
      `<html><head><meta property="og:image" content="javascript:alert(1)"></head><body></body></html>`,
    );
    expect(result.imageUrl).toBeNull();
  });
});
