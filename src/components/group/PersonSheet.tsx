"use client";

import { AnimatePresence, motion } from "framer-motion";
import { useEffect, useMemo, useRef, useState } from "react";

import {
  artForFind,
  bgForFind,
  getCachedRoster,
  ownerOf,
} from "@/components/commerce/findsStore";
import { useItemDetail } from "@/components/commerce/ItemDetailModal";
import { Avatar } from "@/components/primitives/Avatar";
import { Heart, Star } from "@/components/primitives/Glyphs";
import { ProductArt } from "@/components/primitives/ProductArt";
import { getUser } from "@/data/users";
import type { FindItem } from "@/lib/apiTypes";
import type { UserId } from "@/lib/types";

type Tab = "bought" | "wants";

/**
 * Everything one person shared this month, in two lists.
 *
 * Both come out of the feed the home page already fetched, so opening this is
 * free: "bought" is their own rows, "wants" is every row whose wishlist roster
 * names them — including other people's finds, which is the interesting half.
 */
export function personLists(
  userId: UserId,
  finds: FindItem[],
): { bought: FindItem[]; wants: FindItem[] } {
  const bought: FindItem[] = [];
  const wants: FindItem[] = [];
  for (const find of finds) {
    if (ownerOf(find) === userId) bought.push(find);
    if (getCachedRoster(find.id).some((u) => u.id === userId)) wants.push(find);
  }
  return { bought, wants };
}

export function PersonSheet({
  userId,
  finds,
  onClose,
}: {
  userId: UserId | null;
  finds: FindItem[];
  onClose: () => void;
}) {
  return (
    <AnimatePresence>
      {userId && <Panel key={userId} userId={userId} finds={finds} onClose={onClose} />}
    </AnimatePresence>
  );
}

function Panel({
  userId,
  finds,
  onClose,
}: {
  userId: UserId;
  finds: FindItem[];
  onClose: () => void;
}) {
  const person = getUser(userId);
  const [tab, setTab] = useState<Tab>("bought");
  const panel = useRef<HTMLDivElement | null>(null);

  const { bought, wants } = useMemo(() => personLists(userId, finds), [userId, finds]);
  const rows = tab === "bought" ? bought : wants;

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") onClose();
    };
    document.addEventListener("keydown", onKey);
    panel.current?.focus();
    return () => document.removeEventListener("keydown", onKey);
  }, [onClose]);

  return (
    <motion.div
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      exit={{ opacity: 0 }}
      onClick={onClose}
      style={{
        position: "fixed",
        inset: 0,
        zIndex: 300,
        display: "flex",
        justifyContent: "flex-end",
        background: "rgba(11,15,42,0.62)",
      }}
    >
      <motion.div
        ref={panel}
        role="dialog"
        aria-modal="true"
        aria-label={`${person.name}'s lists`}
        tabIndex={-1}
        onClick={(e) => e.stopPropagation()}
        initial={{ x: 40, opacity: 0 }}
        animate={{ x: 0, opacity: 1 }}
        exit={{ x: 40, opacity: 0 }}
        transition={{ duration: 0.28, ease: [0.2, 0.7, 0.2, 1] }}
        style={{
          width: "min(560px, 100%)",
          height: "100%",
          overflowY: "auto",
          boxSizing: "border-box",
          padding: 24,
          background: "#F5ECD9",
          color: "#141A47",
          borderLeft: "2px solid #141A47",
          outline: "none",
        }}
      >
        <div style={{ display: "flex", alignItems: "center", gap: 14 }}>
          <div
            style={{
              width: 62,
              height: 62,
              flexShrink: 0,
              borderRadius: "50%",
              overflow: "hidden",
              border: "2px solid #141A47",
              background: person.color,
            }}
          >
            <Avatar who={person.id} />
          </div>
          <div style={{ minWidth: 0, flex: 1 }}>
            <div
              style={{
                fontFamily: "var(--font-display), Georgia, serif",
                fontSize: 34,
                lineHeight: 1,
              }}
            >
              {person.name}
            </div>
            <div style={{ fontFamily: "var(--font-hand), cursive", fontSize: 20 }}>
              {person.persona}
            </div>
          </div>
          <button
            type="button"
            onClick={onClose}
            aria-label="Close"
            style={{
              width: 38,
              height: 38,
              flexShrink: 0,
              border: "2px solid #141A47",
              borderRadius: "50%",
              background: "#F5ECD9",
              color: "#141A47",
              fontSize: 17,
              fontWeight: 700,
              cursor: "pointer",
            }}
          >
            ✕
          </button>
        </div>

        <div style={{ display: "flex", gap: 8, marginTop: 18 }}>
          <TabButton on={tab === "bought"} onClick={() => setTab("bought")}>
            <Heart size={14} /> Bought · {bought.length}
          </TabButton>
          <TabButton on={tab === "wants"} onClick={() => setTab("wants")}>
            <Star size={14} /> Wishlist · {wants.length}
          </TabButton>
        </div>

        {rows.length === 0 ? (
          <div
            style={{
              fontFamily: "var(--font-hand), cursive",
              fontSize: 22,
              marginTop: 24,
              opacity: 0.75,
            }}
          >
            {tab === "bought"
              ? `${person.name} hasn’t shared anything this month.`
              : `Nothing on ${person.name}’s list yet.`}
          </div>
        ) : (
          <div
            style={{
              display: "grid",
              gridTemplateColumns: "repeat(auto-fill, minmax(150px, 1fr))",
              gap: 12,
              marginTop: 18,
            }}
          >
            {rows.map((find) => (
              <ListTile key={`${tab}-${find.id}`} find={find} />
            ))}
          </div>
        )}
      </motion.div>
    </motion.div>
  );
}

function TabButton({
  on,
  onClick,
  children,
}: {
  on: boolean;
  onClick: () => void;
  children: React.ReactNode;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      aria-pressed={on}
      style={{
        display: "inline-flex",
        alignItems: "center",
        gap: 7,
        height: 40,
        padding: "0 18px",
        boxSizing: "border-box",
        border: "2px solid #141A47",
        borderRadius: 999,
        background: on ? "#141A47" : "transparent",
        color: on ? "#F5ECD9" : "#141A47",
        fontSize: 14.5,
        fontWeight: 700,
        cursor: "pointer",
      }}
    >
      {children}
    </button>
  );
}

function ListTile({ find }: { find: FindItem }) {
  const { openItem } = useItemDetail();

  return (
    <button
      type="button"
      onClick={() => openItem({ kind: "find", id: find.id })}
      aria-label={`${find.name} — open the item details`}
      style={{
        display: "block",
        width: "100%",
        textAlign: "left",
        padding: 10,
        boxSizing: "border-box",
        border: "2px solid #141A47",
        borderRadius: 18,
        background: "#FFFDF6",
        color: "#141A47",
        boxShadow: "3px 3px 0 #141A47",
        font: "inherit",
        cursor: "pointer",
      }}
    >
      <div
        style={{
          height: 78,
          borderRadius: 12,
          overflow: "hidden",
          border: "2px solid #141A47",
          background: bgForFind(find),
          padding: find.imageUrl ? 0 : 5,
          boxSizing: "border-box",
        }}
      >
        <ProductArt kind={artForFind(find)} src={find.imageUrl ?? undefined} />
      </div>
      <div style={{ fontSize: 14, fontWeight: 700, marginTop: 7, lineHeight: 1.2 }}>
        {find.name}
      </div>
      <div style={{ fontSize: 12, opacity: 0.7 }}>{find.merchant ?? "No shop recorded"}</div>
    </button>
  );
}
