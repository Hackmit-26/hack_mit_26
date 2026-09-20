"use client";

import { AnimatePresence, motion } from "framer-motion";
import { useEffect, useState } from "react";

import { CommentThread } from "@/components/comments/CommentThread";
import { useApp, type CommentTarget } from "@/state/store";

function SpeechBubble({ size = 16 }: { size?: number }) {
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" aria-hidden="true">
      <path
        d="M3.5 5.5h17v11h-9l-5 4v-4h-3z"
        fill="none"
        stroke="currentColor"
        strokeWidth="2.2"
        strokeLinejoin="round"
      />
    </svg>
  );
}

/**
 * The comment affordance: a chip that sits next to the reactions and opens the
 * conversation. `popover` floats it above the chip for the Wrapped's fixed
 * stage; `inline` pushes it into the flow, for tiles in a grid.
 */
export function CommentDock({
  target,
  compact = false,
  placement = "popover",
  title = "The group chat",
  label = "Comments",
  hideLabel = false,
  onOpenChange,
}: {
  target: CommentTarget;
  compact?: boolean;
  placement?: "popover" | "inline";
  title?: string;
  /** Always the chip's accessible name, even when `hideLabel` drops the text. */
  label?: string;
  hideLabel?: boolean;
  /** So a caller can make room for the panel — the group tiles widen for it. */
  onOpenChange?: (open: boolean) => void;
}) {
  const { commentCount, loadComments } = useApp();
  const [open, setOpenState] = useState(false);
  const count = commentCount(target);

  function setOpen(next: boolean): void {
    setOpenState(next);
    onOpenChange?.(next);
  }

  const { targetType, targetId } = target;
  useEffect(() => {
    void loadComments({ targetType, targetId });
  }, [loadComments, targetType, targetId]);

  // A card change while the panel is open should not show the previous conversation.
  useEffect(() => setOpenState(false), [targetType, targetId]);

  const panel = (
    <motion.div
      initial={{ opacity: 0, y: placement === "popover" ? 10 : -6, scale: 0.98 }}
      animate={{ opacity: 1, y: 0, scale: 1 }}
      exit={{ opacity: 0, y: placement === "popover" ? 10 : -6, scale: 0.98 }}
      transition={{ duration: 0.22, ease: [0.2, 0.7, 0.2, 1] }}
      onClick={(event) => event.stopPropagation()}
      style={{
        ...(placement === "popover"
          ? {
              position: "absolute",
              bottom: "calc(100% + 12px)",
              // The phone frame clips anything past its edge, so hug the chip there.
              // `x` rather than a CSS transform: framer owns this element's transform.
              ...(compact ? { right: 0 } : { left: "50%", x: "-50%" }),
              width: compact ? 326 : 440,
              maxHeight: compact ? 420 : 460,
              zIndex: 40,
            }
          : { width: "min(100%, 460px)", maxHeight: 420, marginTop: 10 }),
        display: "flex",
        flexDirection: "column",
        padding: compact ? 12 : 16,
        boxSizing: "border-box",
        border: "2px solid #141A47",
        borderRadius: 22,
        background: "#F5ECD9",
        color: "#141A47",
        boxShadow: "5px 5px 0 #141A47",
        textAlign: "left",
      }}
    >
      <div
        style={{
          display: "flex",
          alignItems: "center",
          justifyContent: "space-between",
          gap: 10,
          flexShrink: 0,
        }}
      >
        <div
          style={{
            fontFamily: "var(--font-display), Georgia, serif",
            fontSize: compact ? 21 : 25,
            lineHeight: 1,
          }}
        >
          {title.split(" ").slice(0, -1).join(" ")}{" "}
          <em style={{ color: "#B8412F" }}>{title.split(" ").slice(-1)}</em>
        </div>
        <button
          type="button"
          onClick={() => setOpen(false)}
          aria-label="Close the comments"
          style={{
            width: 26,
            height: 26,
            flexShrink: 0,
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
            border: "2px solid #141A47",
            borderRadius: "50%",
            background: "transparent",
            color: "#141A47",
            fontSize: 14,
            fontWeight: 700,
            lineHeight: 1,
            cursor: "pointer",
          }}
        >
          ×
        </button>
      </div>

      <div style={{ marginTop: 10, minHeight: 0, display: "flex", flexDirection: "column" }}>
        <CommentThread target={target} compact={compact} />
      </div>
    </motion.div>
  );

  return (
    <div style={{ position: "relative", ...(placement === "inline" ? { width: "100%" } : {}) }}>
      <motion.button
        type="button"
        onClick={() => setOpen(!open)}
        aria-expanded={open}
        aria-label={count > 0 ? `${label} · ${count}` : label}
        whileTap={{ scale: 0.94 }}
        style={{
          display: "flex",
          alignItems: "center",
          gap: compact ? 6 : 8,
          height: compact ? 34 : 40,
          padding: compact ? "0 12px" : "0 16px",
          boxSizing: "border-box",
          border: "2px solid #141A47",
          borderRadius: 999,
          background: open ? "#141A47" : count > 0 ? "#EBB5BD" : "rgba(245,236,217,0.92)",
          color: open ? "#F5ECD9" : "#141A47",
          fontFamily: "inherit",
          fontSize: compact ? 12.5 : 15,
          fontWeight: 600,
          boxShadow: "3px 3px 0 #141A47",
          cursor: "pointer",
          transition: "background .2s, color .2s",
        }}
      >
        <SpeechBubble size={compact ? 14 : 16} />
        {!hideLabel && label}
        {count > 0 && <span style={{ fontWeight: 700 }}>{count}</span>}
      </motion.button>

      <AnimatePresence>{open && panel}</AnimatePresence>
    </div>
  );
}
