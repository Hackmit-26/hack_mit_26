"use client";

import { useState } from "react";

import { Check, Sparkle } from "@/components/primitives/Glyphs";

/**
 * The invite code, front and centre on the welcome screen.
 * Tapping it copies — the whole point of the code is to pass it on.
 */
export function InviteCodeCard({ code }: { code: string }) {
  const [copied, setCopied] = useState(false);

  async function copy() {
    try {
      await navigator.clipboard.writeText(code);
    } catch {
      // Clipboard is blocked outside a secure context; the code is on screen
      // either way, so the card still does its job.
      return;
    }
    setCopied(true);
    setTimeout(() => setCopied(false), 1800);
  }

  return (
    <button
      type="button"
      onClick={copy}
      aria-label={`Invite code ${code}. Tap to copy.`}
      style={{
        display: "flex",
        alignItems: "center",
        gap: "clamp(14px, 2vw, 22px)",
        padding: "16px 22px",
        borderRadius: 22,
        border: "2px solid #141A47",
        background: "#F5ECD9",
        color: "#141A47",
        boxShadow: "5px 5px 0 #141A47",
        textAlign: "left",
      }}
    >
      <Sparkle size={22} />

      <span>
        <span
          style={{
            display: "block",
            fontSize: 11.5,
            fontWeight: 700,
            letterSpacing: "0.16em",
            textTransform: "uppercase",
            opacity: 0.6,
          }}
        >
          Invite code
        </span>
        <span
          style={{
            display: "block",
            fontFamily: "var(--font-display), Georgia, serif",
            fontSize: "clamp(28px, 3.6vw, 38px)",
            letterSpacing: "0.18em",
            lineHeight: 1.05,
          }}
        >
          {code}
        </span>
      </span>

      <span
        style={{
          marginLeft: "auto",
          display: "inline-flex",
          alignItems: "center",
          gap: 7,
          fontSize: 13.5,
          fontWeight: 700,
          color: copied ? "#1F7A4D" : "#5A5F7A",
          whiteSpace: "nowrap",
        }}
      >
        {copied ? (
          <>
            <Check size={16} />
            Copied
          </>
        ) : (
          "Tap to copy"
        )}
      </span>
    </button>
  );
}
