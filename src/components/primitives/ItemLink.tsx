"use client";

/**
 * The clickable part of a product tile — usually the photo and the title.
 *
 * An item with no page renders as a plain block rather than a dead link:
 * `productUrl` is null on every receipt and on catalogue rows the merchant
 * feed never gave a page for, and that is a lot of the group's month.
 */
export function ItemLink({
  url,
  label,
  style,
  children,
}: {
  url: string | null | undefined;
  /** Names the item for a screen reader, which cannot see the tile around it. */
  label: string;
  style?: React.CSSProperties;
  children: React.ReactNode;
}) {
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
