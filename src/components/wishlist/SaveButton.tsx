"use client";

import { motion } from "framer-motion";

import { Heart } from "@/components/primitives/Glyphs";
import { useApp } from "@/state/store";

/**
 * The save control, one component, used from any product tile. A save here is
 * the loudest signal the gift picker has, so the on state is unambiguous:
 * filled mint, not a faint outline.
 */
export function SaveButton({
  productId,
  compact = false,
  label,
}: {
  productId: string;
  compact?: boolean;
  /** Overrides the unsaved label; the saved label is always "On your list". */
  label?: string;
}) {
  const { isSaved, toggleSaved } = useApp();
  const saved = isSaved(productId);

  return (
    <motion.button
      type="button"
      onClick={() => toggleSaved(productId)}
      aria-pressed={saved}
      aria-label={saved ? "Remove from your list" : "Save to your list"}
      whileTap={{ scale: 0.94 }}
      style={{
        display: "inline-flex",
        alignItems: "center",
        justifyContent: "center",
        gap: compact ? 6 : 9,
        height: compact ? 36 : 48,
        padding: compact ? "0 12px" : "0 20px",
        boxSizing: "border-box",
        border: "2px solid #141A47",
        borderRadius: 999,
        background: saved ? "#A8DCC2" : "#F5ECD9",
        color: "#141A47",
        fontSize: compact ? 13 : 15,
        fontWeight: 700,
        transition: "background .2s",
      }}
    >
      <Heart size={compact ? 13 : 16} />
      {saved ? "On your list" : (label ?? "Save to list")}
    </motion.button>
  );
}
