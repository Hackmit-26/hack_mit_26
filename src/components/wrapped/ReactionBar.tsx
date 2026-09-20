"use client";

import { motion } from "framer-motion";

import { Avatar } from "@/components/primitives/Avatar";
import { Heart } from "@/components/primitives/Glyphs";
import { useApp } from "@/state/store";

/**
 * The like on the card you're looking at: one heart, the count, and the
 * friends behind it. The other reaction kinds stay in the model — they are
 * surfaced where there is room to label them.
 */
const LIKE = "accurate" as const;

export function ReactionBar({
  targetId,
  compact = false,
}: {
  targetId: string;
  compact?: boolean;
}) {
  const { reactionsFor, viewerReacted, toggleReaction, viewerId } = useApp();

  const others = reactionsFor(targetId).filter(
    (r) => r.kind === LIKE && r.userId !== viewerId,
  );
  const mine = viewerReacted(targetId, LIKE);
  const count = others.length + (mine ? 1 : 0);
  const face = compact ? 20 : 24;

  return (
    <motion.button
      type="button"
      onClick={() => toggleReaction(targetId, LIKE)}
      aria-pressed={mine}
      aria-label={count > 0 ? `Like this · ${count}` : "Like this"}
      whileTap={{ scale: 0.92 }}
      style={{
        display: "flex",
        alignItems: "center",
        gap: compact ? 6 : 8,
        height: compact ? 34 : 40,
        padding: compact ? "0 12px" : "0 16px",
        boxSizing: "border-box",
        border: "2px solid #141A47",
        borderRadius: 999,
        background: mine ? "#141A47" : count > 0 ? "#F5E39B" : "rgba(245,236,217,0.92)",
        color: mine ? "#F5ECD9" : "#141A47",
        fontFamily: "inherit",
        fontSize: compact ? 12.5 : 15,
        fontWeight: 600,
        boxShadow: "3px 3px 0 #141A47",
        cursor: "pointer",
        transition: "background .2s, color .2s",
      }}
    >
      <Heart size={compact ? 15 : 17} />
      {count > 0 && <span style={{ fontWeight: 700 }}>{count}</span>}

      {others.length > 0 && (
        <span style={{ display: "flex", marginLeft: 2 }}>
          {others.slice(0, 3).map((r, i) => (
            <span
              key={r.id}
              style={{
                width: face,
                height: face,
                borderRadius: "50%",
                overflow: "hidden",
                border: `2px solid ${mine ? "#141A47" : "#F5ECD9"}`,
                boxSizing: "border-box",
                marginLeft: i === 0 ? 0 : -7,
              }}
            >
              <Avatar who={r.userId} />
            </span>
          ))}
        </span>
      )}
    </motion.button>
  );
}
