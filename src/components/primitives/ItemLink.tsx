"use client";

/**
 * The clickable part of a product tile — usually the photo and the title.
 *
 * Two modes. With `onActivate` the tile is a button that opens the item's
 * detail modal, which is what almost every tile now wants: the outbound page
 * is one action inside that modal rather than the tile's only behaviour, and
 * an item with no page is still worth opening. Without it the tile is a plain
 * outbound link, and an item with no page renders as a plain block rather than
 * a dead link — `productUrl` is null on every receipt and on catalogue rows
 * the merchant feed never gave a page for, and that is a lot of the month.
 */
export function ItemLink({
  url,
  label,
  style,
  onActivate,
  children,
}: {
  url: string | null | undefined;
  /** Names the item for a screen reader, which cannot see the tile around it. */
  label: string;
  style?: React.CSSProperties;
  /** Opens the details instead of the page. Works with or without a `url`. */
  onActivate?: () => void;
  children: React.ReactNode;
}) {
  if (onActivate) {
    return (
      <button
        type="button"
        onClick={onActivate}
        aria-label={`${label} — open the item details`}
        style={{
          display: "block",
          width: "100%",
          padding: 0,
          border: 0,
          background: "none",
          color: "inherit",
          font: "inherit",
          textAlign: "left",
          cursor: "pointer",
          ...style,
        }}
      >
        {children}
      </button>
    );
  }

  if (!url) return <div style={style}>{children}</div>;

  return (
    <a
      href={url}
      target="_blank"
      rel="noopener noreferrer"
      aria-label={`${label} — open the product page in a new tab`}
      style={{ display: "block", color: "inherit", textDecoration: "none", ...style }}
    >
      {children}
    </a>
  );
}
