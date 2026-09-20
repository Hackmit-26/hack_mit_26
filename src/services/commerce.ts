/**
 * Product sourcing and matching.
 *
 * Visa does not find products, so this is ours: given an item from a friend's
 * Wrapped, return the same item, a close match and a budget option, ranked
 * against the recipient's taste profile and budget.
 *
 * Backed by the seeded catalogue today; point `search` at a shopping-results
 * API later and nothing above it changes.
 */

import { getProduct, products, recommendationsFor } from "@/data/products";
import type { Product, Recommendation, UserId } from "@/lib/types";

export type MatchKind = "same" | "close" | "budget";

export interface ProductOption {
  kind: MatchKind;
  label: string;
  product: Product;
  /** Why this option is here, in the why-we-think voice. */
  reason: string;
}

const wait = (ms: number) => new Promise<void>((r) => setTimeout(r, ms));

/**
 * The three options a buy sheet offers for any item.
 * "Same item" is always the one the friend actually found.
 */
export async function findOptions(productId: string): Promise<ProductOption[]> {
  await wait(260);
  const same = getProduct(productId);

  const others = products.filter(
    (p) => p.id !== same.id && p.merchant !== same.merchant,
  );

  // A close match is the same kind of thing at a comparable price — never a
  // $150 alternative to a $78 find. Same illustration wins ties, then price.
  const distance = (p: Product) => {
    const priceGap = Math.abs(p.priceCents - same.priceCents) / same.priceCents;
    return priceGap + (p.art === same.art ? 0 : 0.45);
  };

  const close = [...others]
    .filter((p) => p.priceCents <= same.priceCents * 1.4)
    .sort((a, b) => distance(a) - distance(b))[0];

  // The budget option is the best-value cheaper thing, comfortably below.
  const cheaper = others
    .filter(
      (p) =>
        p.priceCents <= same.priceCents * 0.8 &&
        p.id !== close?.id,
    )
    .sort((a, b) => b.priceCents - a.priceCents)[0];

  const options: ProductOption[] = [
    {
      kind: "same",
      label: "The same one",
      product: same,
      reason: "Exactly what your friend found.",
    },
  ];

  if (close) {
    options.push({
      kind: "close",
      label: "Close match",
      product: close,
      reason: "Same shape, different shop.",
    });
  }
  if (cheaper) {
    options.push({
      kind: "budget",
      label: "Budget option",
      product: cheaper,
      reason: "Under your usual range for this category.",
    });
  }

  return options;
}

/** Ranked gift ideas for one friend inside one budget band. */
export async function findRecommendations(
  forUserId: UserId,
  budget: string,
): Promise<Recommendation[]> {
  await wait(200);
  return recommendationsFor(forUserId, budget);
}

/**
 * Where a tile links out to when the item is one of ours rather than one the
 * backend resolved. The seeded catalogue and the September receipts are shops
 * without a product page, so this is the same search URL the backend's gift
 * picker falls back to.
 */
export function searchUrl(name: string, merchant: string | null): string {
  const query = merchant ? `${name} ${merchant}` : name;
  return `https://www.google.com/search?q=${encodeURIComponent(query)}`;
}

export function formatPrice(cents: number): string {
  return cents % 100 === 0
    ? `$${cents / 100}`
    : `$${(cents / 100).toFixed(2)}`;
}

/** Each member's share of a split gift, rounded the way the card shows it. */
export function shareOf(totalCents: number, ways: number): number {
  return Math.round(totalCents / ways / 100) * 100;
}
