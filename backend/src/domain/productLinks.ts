/**
 * Every tile the group sees should go somewhere when tapped.
 *
 * A canonical product page is the only answer worth preferring, but the data rarely has one:
 * all 3087 rows of the merchant catalogue carry a NULL `product_url`, `merchants.domain` is NULL
 * for all 114 brands, and no seeded purchase carries an `external_ref`. Only a link the user
 * pasted themselves (`POST /wishlist/link`) is a real page today.
 *
 * So the fallback is a merchant-scoped web search rather than null. It is not a fake product
 * page pretending to be real - it is a search, it always resolves, and it cannot 404 the way a
 * guessed `merchant.com/products/<slug>` would. A nameless item still gets null, because there
 * is nothing to search for.
 */
export function searchUrl(name: string, merchant: string | null = null): string | null {
  const query = [merchant, name].filter(Boolean).join(' ').trim();
  return query === '' ? null : `https://www.google.com/search?q=${encodeURIComponent(query)}`;
}

/** The link for an item: its own product page when it has one, otherwise a search for it. */
export function productLink(
  name: string,
  merchant: string | null,
  productUrl: string | null | undefined,
): string | null {
  return productUrl?.startsWith('http') ? productUrl : searchUrl(name, merchant);
}
