"use client";

import { Grain } from "@/components/primitives/Glyphs";

export const M_W = 390;
export const M_H = 844;

/**
 * Mobile card: full-bleed, no frame. Four progress segments at the top, the
 * wordmark and "n / 4" below it, then the chapter's own content.
 */
export function MobileFrame({
  step,
  bg,
  grainId,
  children,
  decor,
}: {
  /** 1-based; 5 is the closing screen, which fills every segment. */
  step: number;
  bg: string;
  grainId: string;
  children: React.ReactNode;
  decor?: React.ReactNode;
}) {
  return (
    <div
      style={{
        position: "relative",
        width: M_W,
        height: M_H,
        boxSizing: "border-box",
        overflow: "hidden",
        background: bg,
        color: "#141A47",
        padding: "0 16px",
      }}
    >
      <Grain w={M_W} h={M_H} id={grainId} />
      {decor}

      <div
        style={{
          position: "absolute",
          left: 16,
          right: 16,
          top: 12,
          display: "flex",
          gap: 4,
        }}
      >
        {[1, 2, 3, 4].map((n) => (
          <div
            key={n}
            style={{
              flex: 1,
              height: 3,
              borderRadius: 2,
              background: n <= step ? "#141A47" : "rgba(20,26,71,0.25)",
              transition: "background .3s",
            }}
          />
        ))}
      </div>

      <div
        style={{
          position: "relative",
          display: "flex",
          justifyContent: "space-between",
          alignItems: "center",
          height: 44,
          marginTop: 22,
          paddingRight: 44,
        }}
      >
        <div style={{ fontFamily: "var(--font-display), Georgia, serif", fontSize: 24 }}>
          Shop <em style={{ color: "#B8412F" }}>Wrapped</em>
        </div>
        <div style={{ fontSize: 13, fontWeight: 700, letterSpacing: "0.14em" }}>
          {step <= 4 ? `${step} / 4` : "The end"}
        </div>
      </div>

      {children}
    </div>
  );
}

/** The fixed bottom action on every mobile card. */
export function MobileCta({
  label,
  onClick,
  top = 764,
}: {
  label: string;
  onClick: () => void;
  top?: number;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      style={{
        position: "absolute",
        left: 16,
        right: 16,
        top,
        display: "flex",
        alignItems: "center",
        justifyContent: "center",
        gap: 10,
        height: 52,
        border: 0,
        borderRadius: 999,
        background: "#141A47",
        color: "#F5ECD9",
        fontSize: 16,
        fontWeight: 700,
        boxShadow: "4px 4px 0 #B8412F",
      }}
    >
      {label}
      <svg
        width="20"
        height="20"
        viewBox="0 0 26 26"
        fill="none"
        stroke="currentColor"
        strokeWidth="2"
        strokeLinecap="round"
        strokeLinejoin="round"
        aria-hidden="true"
      >
        <path d="M5 13 H21 M14 6 L21 13 L14 20" />
      </svg>
    </button>
  );
}

export function Blob({
  color,
  opacity,
  size,
  left,
  right,
  top,
  bottom,
}: {
  color: string;
  opacity: number;
  size: number;
  left?: number;
  right?: number;
  top?: number;
  bottom?: number;
}) {
  return (
    <div
      style={{
        position: "absolute",
        left,
        right,
        top,
        bottom,
        width: size,
        height: size,
        borderRadius: "50%",
        background: color,
        opacity,
      }}
    />
  );
}
