"use client";

import { motion } from "framer-motion";

import { toggleFindHeart } from "@/components/commerce/findsStore";
import { Heart } from "@/components/primitives/Glyphs";

/**
 * The real heart on a live find. The count is a server-side aggregate and
 * deliberately anonymous — §1 rule 4 forbids ever naming who hearted an item —
 * so there is a number and a state, and no roster to go with it.
 *
 * `stop` is on because the tile's whole surface is a button that opens the item.
 */
export function FindHeart({
  itemId,
  count,
  mine,
  compact = false,
}: {
  itemId: string;
  count: number;
  mine: boolean;
  compact?: boolean;
}) {
  return (
    <motion.button
      type="button"
      whileTap={{ scale: 0.92 }}
      onClick={(event) => {
        event.stopPropagation();
        void toggleFindHeart(itemId);
      }}
      aria-pressed={mine}
      aria-label={
        mine
          ? `Remove your heart · ${count} in the group`
          : `Heart this · ${count} in the group`
      }
      style={{
        display: "inline-flex",
        alignItems: "center",
        gap: compact ? 5 : 8,
        height: compact ? 28 : 40,
        padding: compact ? "0 10px" : "0 16px",
        boxSizing: "border-box",
        border: "2px solid #141A47",
        borderRadius: 999,
        background: mine ? "#E8806F" : "rgba(245,236,217,0.92)",
        color: "#141A47",
        fontFamily: "inherit",
        fontSize: compact ? 12.5 : 15,
        fontWeight: 700,
        boxShadow: "3px 3px 0 #141A47",
        cursor: "pointer",
        transition: "background .2s",
      }}
    >
      <Heart size={compact ? 13 : 16} />
      {count}
    </motion.button>
  );
}
