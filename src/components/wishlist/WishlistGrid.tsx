"use client";

import { motion } from "framer-motion";
import Link from "next/link";

import { useItemDetail } from "@/components/commerce/ItemDetailModal";
import { ItemLink } from "@/components/primitives/ItemLink";
import { ProductArt } from "@/components/primitives/ProductArt";
import { formatPrice } from "@/services/commerce";
import { useApp, type WishlistItem } from "@/state/store";

/** The list itself. Empty is a real state here, not an oversight. */
export function WishlistGrid() {
  const { wishlist, removeWishlistItem } = useApp();

  if (wishlist.length === 0) return <WishlistEmpty />;

  return (
    <div
      style={{
        display: "grid",
        gridTemplateColumns: "repeat(auto-fill, minmax(208px, 1fr))",
        gap: 14,
        marginTop: 14,
      }}
    >
      {wishlist.map((item) => (
        <WishlistTile
          key={item.id}
          item={item}
          onRemove={() => removeWishlistItem(item.id)}
        />
      ))}
    </div>
  );
}

export function WishlistTile({
  item,
  onRemove,
}: {
  item: WishlistItem;
  onRemove: () => void;
}) {
  const { openItem } = useItemDetail();

  return (
    <motion.div
      initial={{ opacity: 0, y: 14 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.35, ease: [0.2, 0.7, 0.2, 1] }}
      style={{
        position: "relative",
        padding: 12,
        boxSizing: "border-box",
        border: "2px solid #141A47",
        borderRadius: 20,
        background: "#F5ECD9",
        color: "#141A47",
        boxShadow: "4px 4px 0 #141A47",
      }}
    >
      {/* The tile opens the details; the link out lives inside them, and below. */}
      <ItemLink
        url={item.pending ? null : item.url}
        label={`${item.title} at ${item.merchant}`}
        onActivate={
          item.pending ? undefined : () => openItem({ kind: "wishlist", id: item.id })
        }
      >
        <div
          style={{
            height: 108,
            borderRadius: 14,
            background: item.bg,
            border: "2px solid #141A47",
            padding: 6,
            boxSizing: "border-box",
            opacity: item.pending ? 0.5 : 1,
            transition: "opacity .3s",
          }}
        >
          <ProductArt kind={item.art} src={item.image} />
        </div>

        <div style={{ fontSize: 15, fontWeight: 700, marginTop: 9, lineHeight: 1.2 }}>
          {item.title}
        </div>
        <div style={{ fontSize: 13, opacity: 0.75, marginTop: 2 }}>
          {item.merchant}
          {item.priceCents !== null && ` · ${formatPrice(item.priceCents)}`}
        </div>
      </ItemLink>

      {item.pending && (
        <div
          style={{
            display: "inline-flex",
            alignItems: "center",
            height: 24,
            padding: "0 10px",
            marginTop: 8,
            boxSizing: "border-box",
            borderRadius: 999,
            background: "#F5E39B",
            border: "2px solid #141A47",
            fontSize: 11.5,
            fontWeight: 700,
            letterSpacing: "0.1em",
            textTransform: "uppercase",
          }}
        >
          Reading the page
        </div>
      )}

      {!item.pending && item.note && (
        <div style={{ fontSize: 12.5, marginTop: 7, color: "#B8412F", fontWeight: 600 }}>
          {item.note}
        </div>
      )}

      {item.url && !item.pending && (
        <Link
          href={item.url}
          target="_blank"
          rel="noopener noreferrer"
          style={{
            display: "inline-block",
            fontSize: 12.5,
            fontWeight: 700,
            marginTop: 7,
            textDecoration: "underline",
          }}
        >
          Open the link
        </Link>
      )}

      <button
        type="button"
        onClick={onRemove}
        aria-label={`Remove ${item.title} from your list`}
        style={{
          position: "absolute",
          right: -8,
          top: -10,
          width: 30,
          height: 30,
          display: "flex",
          alignItems: "center",
          justifyContent: "center",
          border: "2px solid #141A47",
          borderRadius: "50%",
          background: "#E8806F",
          color: "#141A47",
          fontSize: 16,
          fontWeight: 700,
          lineHeight: 1,
        }}
      >
        ×
      </button>
    </motion.div>
  );
}

export function WishlistEmpty() {
  return (
    <div
      style={{
        marginTop: 14,
        padding: "clamp(22px, 4vw, 40px)",
        boxSizing: "border-box",
        border: "2px dashed rgba(245,236,217,0.5)",
        borderRadius: 30,
        color: "rgba(245,236,217,0.92)",
      }}
    >
      <div
        style={{
          fontFamily: "var(--font-display), Georgia, serif",
          fontSize: "clamp(26px, 3.4vw, 38px)",
          lineHeight: 1.05,
          maxWidth: 620,
        }}
      >
        Nothing on the list yet. Your friends are guessing.
      </div>
      <div
        style={{
          fontFamily: "var(--font-hand), cursive",
          fontSize: 24,
          color: "#F5E39B",
          marginTop: 12,
          transform: "rotate(-1deg)",
        }}
      >
        paste a link above, or save something from the Wrapped.
      </div>
      <Link
        href="/wrapped"
        scroll={false}
        style={{
          display: "inline-flex",
          alignItems: "center",
          gap: 10,
          height: 52,
          padding: "0 24px",
          marginTop: 18,
          boxSizing: "border-box",
          borderRadius: 999,
          background: "#F5ECD9",
          color: "#141A47",
          fontSize: 16,
          fontWeight: 700,
          boxShadow: "4px 4px 0 #E8806F",
        }}
      >
        Open the Wrapped
      </Link>
    </div>
  );
}
