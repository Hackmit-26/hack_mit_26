"use client";

import Link from "next/link";

import { Sparkle } from "@/components/primitives/Glyphs";

/** Shared chrome for the non-story routes: midnight ground, soft blobs. */
export function PageShell({ children }: { children: React.ReactNode }) {
  return (
    <main
      style={{
        minHeight: "100dvh",
        background: "#0B0F2A",
        color: "#F5ECD9",
        position: "relative",
        overflowX: "hidden",
        padding: "clamp(20px, 4vw, 44px) clamp(18px, 5vw, 56px) 64px",
        boxSizing: "border-box",
      }}
    >
      <div
        style={{
          position: "absolute",
          left: "-10%",
          top: "-14%",
          width: "40vw",
          height: "40vw",
          borderRadius: "50%",
          background: "#BBA9E8",
          opacity: 0.18,
          filter: "blur(110px)",
          pointerEvents: "none",
        }}
      />
      <div
        style={{
          position: "absolute",
          right: "-12%",
          bottom: "-18%",
          width: "44vw",
          height: "44vw",
          borderRadius: "50%",
          background: "#E8806F",
          opacity: 0.16,
          filter: "blur(120px)",
          pointerEvents: "none",
        }}
      />

      <div style={{ position: "relative", maxWidth: 1180, margin: "0 auto" }}>
        <Link
          href="/"
          style={{
            display: "inline-flex",
            alignItems: "center",
            gap: 12,
            marginBottom: "clamp(24px, 4vh, 48px)",
          }}
        >
          <Sparkle size={22} />
          <span
            style={{
              fontFamily: "var(--font-display), Georgia, serif",
              fontSize: 28,
              lineHeight: 1,
            }}
          >
            Shop <em style={{ color: "#EBB5BD" }}>Wrapped</em>
          </span>
        </Link>

        {children}
      </div>
    </main>
  );
}

export function SectionLabel({
  children,
  style,
}: {
  children: React.ReactNode;
  style?: React.CSSProperties;
}) {
  return (
    <div
      style={{
        fontSize: 13,
        fontWeight: 700,
        letterSpacing: "0.16em",
        textTransform: "uppercase",
        color: "#F5E39B",
        ...style,
      }}
    >
      {children}
    </div>
  );
}

/** Cream paper with the house ink outline and hard offset shadow. */
export function PaperCard({
  children,
  bg = "#F5ECD9",
  style,
  className,
}: {
  children: React.ReactNode;
  bg?: string;
  style?: React.CSSProperties;
  className?: string;
}) {
  return (
    <div
      className={className}
      style={{
        padding: "clamp(18px, 3vw, 30px)",
        boxSizing: "border-box",
        border: "2px solid #141A47",
        borderRadius: 30,
        background: bg,
        color: "#141A47",
        boxShadow: "6px 6px 0 #141A47",
        ...style,
      }}
    >
      {children}
    </div>
  );
}
