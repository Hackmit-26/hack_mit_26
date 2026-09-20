"use client";

import { motion } from "framer-motion";

import { Avatar } from "@/components/primitives/Avatar";
import { Heart } from "@/components/primitives/Glyphs";
import { reactionKinds } from "@/data/reactions";
import { useApp } from "@/state/store";

/**
 * Reactions from friends stack as chips with their avatar on the card they
 * touched. The viewer's selected chip inverts to navy.
 */
export function ReactionBar({
  targetId,
  compact = false,
}: {
  targetId: string;
  compact?: boolean;
}) {
  const { reactionsFor, viewerReacted, toggleReaction, viewerId } = useApp();
  const all = reactionsFor(targetId);

  return (
    <div
      style={{
        display: "flex",
        alignItems: "center",
        gap: compact ? 4 : 8,
        flexWrap: compact ? "nowrap" : "wrap",
        justifyContent: "center",
        padding: compact ? "5px 6px" : "8px 10px",
        borderRadius: 999,
        background: "rgba(245,236,217,0.92)",
        border: "2px solid #141A47",
        boxShadow: "3px 3px 0 #141A47",
      }}
    >
      {reactionKinds.map(({ kind, label }) => {
        const others = all.filter((r) => r.kind === kind && r.userId !== viewerId);
        const mine = viewerReacted(targetId, kind);
        const count = others.length + (mine ? 1 : 0);

        return (
          <motion.button
            key={kind}
            type="button"
            onClick={() => toggleReaction(targetId, kind)}
            aria-pressed={mine}
            whileTap={{ scale: 0.92 }}
            style={{
              display: "flex",
              alignItems: "center",
              gap: compact ? 5 : 7,
              height: compact ? 34 : 40,
              padding: compact ? "0 8px" : "0 14px",
              boxSizing: "border-box",
              border: "2px solid #141A47",
              borderRadius: 999,
              background: mine ? "#141A47" : count > 0 ? "#F5E39B" : "transparent",
              color: mine ? "#F5ECD9" : "#141A47",
              fontSize: compact ? 12.5 : 15,
              fontWeight: 600,
              transition: "background .2s, color .2s",
            }}
          >
            {kind === "accurate" && <Heart size={compact ? 14 : 16} />}
            {label}
            {count > 0 && <span style={{ fontWeight: 700 }}>{count}</span>}

            {!compact && others.length > 0 && (
              <span style={{ display: "flex", marginLeft: 2 }}>
                {others.slice(0, 3).map((r, i) => (
                  <span
                    key={r.id}
                    style={{
                      width: 22,
                      height: 22,
                      borderRadius: "50%",
                      overflow: "hidden",
                      border: "2px solid #F5ECD9",
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
      })}
    </div>
  );
}
