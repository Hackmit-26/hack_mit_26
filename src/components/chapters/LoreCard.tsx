"use client";

import { AnimatePresence, motion } from "framer-motion";

import { LoreChain } from "@/components/lore/LoreChain";
import { LoreMatcha } from "@/components/lore/LoreMatcha";
import { LoreSkin } from "@/components/lore/LoreSkin";
import { loreCases } from "@/data/wrapped";

const files: Record<string, () => React.JSX.Element> = {
  matcha: LoreMatcha,
  skin: LoreSkin,
  chain: LoreChain,
};

/** Chapter 3 · Group lore — case files swap inside the frame. */
export function LoreCard({
  caseId,
  onChange,
}: {
  caseId: string;
  onChange: (id: string) => void;
}) {
  const File = files[caseId] ?? LoreMatcha;

  return (
    <div
      style={{
        position: "absolute",
        left: 360,
        top: 50,
        width: 720,
        height: 900,
        borderRadius: 36,
        overflow: "hidden",
        boxShadow: "0 40px 90px rgba(0,0,0,0.5)",
      }}
    >
      <AnimatePresence mode="wait">
        <motion.div
          key={caseId}
          initial={{ opacity: 0, scale: 0.98 }}
          animate={{ opacity: 1, scale: 1 }}
          exit={{ opacity: 0, scale: 1.01 }}
          transition={{ duration: 0.28, ease: [0.2, 0.8, 0.3, 1] }}
          style={{ position: "absolute", inset: 0 }}
        >
          <File />
        </motion.div>
      </AnimatePresence>

      <div
        role="group"
        aria-label="Choose a case file"
        style={{
          position: "absolute",
          left: 32,
          right: 32,
          top: 842,
          height: 44,
          display: "flex",
          alignItems: "center",
          gap: 8,
        }}
      >
        {loreCases.map((c) => {
          const on = c.id === caseId;
          return (
            <button
              key={c.id}
              type="button"
              onClick={() => onChange(c.id)}
              aria-pressed={on}
              style={{
                flex: 1,
                display: "flex",
                alignItems: "center",
                justifyContent: "center",
                gap: 8,
                height: 44,
                padding: "0 12px",
                boxSizing: "border-box",
                border: "2px solid #F5ECD9",
                borderRadius: 999,
                background: on ? "#F5ECD9" : "transparent",
                color: on ? "#141A47" : "#F5ECD9",
                fontSize: 14.5,
                fontWeight: 700,
                whiteSpace: "nowrap",
                transition: "background .2s, color .2s",
              }}
            >
              <span style={{ fontSize: 12, letterSpacing: "0.1em", opacity: 0.75 }}>
                {c.index}
              </span>
              <span>{c.tab}</span>
            </button>
          );
        })}
      </div>
    </div>
  );
}
