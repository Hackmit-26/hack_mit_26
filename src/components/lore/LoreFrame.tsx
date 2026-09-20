"use client";

import { Grain } from "@/components/primitives/Glyphs";

/**
 * Shared chrome for the three lore case files: navy card, dotted evidence
 * board, "Spotted by the AI" tag and the rubber stamp.
 */
export function LoreFrame({
  grainId,
  children,
}: {
  grainId: string;
  children: React.ReactNode;
}) {
  return (
    <div
      className="a-card"
      style={{
        position: "relative",
        width: 720,
        height: 900,
        boxSizing: "border-box",
        borderRadius: 36,
        background: "#141A47",
        color: "#F5ECD9",
        overflow: "hidden",
      }}
    >
      <svg
        width="720"
        height="900"
        viewBox="0 0 720 900"
        style={{ position: "absolute", left: 0, top: 0, pointerEvents: "none" }}
        aria-hidden="true"
      >
        <defs>
          <pattern id={`dots-${grainId}`} width="28" height="28" patternUnits="userSpaceOnUse">
            <circle cx="2" cy="2" r="1.4" fill="#F5ECD9" fillOpacity="0.13" />
          </pattern>
        </defs>
        <rect width="720" height="900" fill={`url(#dots-${grainId})`} />
      </svg>
      <Grain w={720} h={900} id={grainId} light />
      {children}
    </div>
  );
}

export function LoreHeader({ caseLabel }: { caseLabel: string }) {
  return (
    <>
      <div
        style={{
          position: "absolute",
          left: 44,
          top: 38,
          right: 44,
          display: "flex",
          justifyContent: "space-between",
          alignItems: "center",
          fontSize: 14,
          fontWeight: 700,
          letterSpacing: "0.16em",
          textTransform: "uppercase",
        }}
      >
        <div>Chapter 3 · Group lore</div>
        <div
          style={{
            padding: "5px 12px",
            border: "2px solid #F5ECD9",
            borderRadius: 6,
            letterSpacing: "0.14em",
          }}
        >
          {caseLabel}
        </div>
      </div>

      <div
        style={{
          position: "absolute",
          left: 44,
          top: 82,
          display: "inline-flex",
          alignItems: "center",
          gap: 8,
          height: 28,
          padding: "0 12px 0 8px",
          boxSizing: "border-box",
          borderRadius: 999,
          background: "#F5E39B",
          color: "#141A47",
          fontSize: 12.5,
          fontWeight: 700,
          letterSpacing: "0.08em",
          textTransform: "uppercase",
        }}
      >
        <svg width="14" height="14" viewBox="0 0 26 26" aria-hidden="true">
          <path
            d="M13 1 l3.4 8.6 L25 13 l-8.6 3.4 L13 25 l-3.4 -8.6 L1 13 l8.6 -3.4 z"
            fill="#141A47"
          />
        </svg>
        Spotted by the AI
      </div>
    </>
  );
}

export function LoreStamp({
  label,
  value,
  top,
  rotate,
  delay,
  right = 44,
}: {
  label: string;
  value: string;
  top: number;
  rotate: number;
  delay: number;
  right?: number;
}) {
  return (
    <div
      className="a-stamp"
      style={{
        animationDelay: `${delay}s`,
        position: "absolute",
        right,
        top,
        padding: "6px 12px",
        border: "3px solid #E8806F",
        borderRadius: 8,
        color: "#E8806F",
        fontSize: 13,
        fontWeight: 700,
        letterSpacing: "0.16em",
        textTransform: "uppercase",
        textAlign: "center",
        lineHeight: 1.25,
        transform: `rotate(${rotate}deg)`,
      }}
    >
      {label}
      <br />
      <span
        style={{
          fontFamily: "var(--font-display), Georgia, serif",
          fontSize: 26,
          letterSpacing: 0,
          textTransform: "none",
          fontStyle: "italic",
        }}
      >
        {value}
      </span>
    </div>
  );
}
