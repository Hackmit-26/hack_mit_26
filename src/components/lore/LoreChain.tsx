"use client";

import { Avatar } from "@/components/primitives/Avatar";
import { ItemLink } from "@/components/primitives/ItemLink";
import { ProductArt } from "@/components/primitives/ProductArt";
import { chainFootnote, chainReaction, loreCases } from "@/data/wrapped";
import type { ArtKind } from "@/lib/types";
import { searchUrl } from "@/services/commerce";
import { LoreFrame, LoreHeader } from "./LoreFrame";

const POS = [
  { left: 44, top: 322 },
  { left: 376, top: 424 },
  { left: 44, top: 526 },
  { left: 376, top: 628 },
];

/** Case 03 — one pair of Sambas, three friends, eleven days. */
export function LoreChain() {
  const c = loreCases[2];

  return (
    <LoreFrame grainId="grainLoreChain">
      <LoreHeader caseLabel="Case 03 / 03" />

      <svg
        width="720"
        height="900"
        viewBox="0 0 720 900"
        style={{ position: "absolute", left: 0, top: 0, pointerEvents: "none" }}
        aria-hidden="true"
      >
        <defs>
          <marker
            id="tipChain"
            viewBox="0 0 10 10"
            refX="7"
            refY="5"
            markerWidth="8"
            markerHeight="8"
            orient="auto-start-reverse"
          >
            <path
              d="M1 1 L8 5 L1 9"
              fill="none"
              stroke="#E8806F"
              strokeWidth="2"
              strokeLinecap="round"
              strokeLinejoin="round"
            />
          </marker>
        </defs>
        <g fill="#F5E39B">
          <path d="M650 90 l4 -12 l4 12 l12 4 l-12 4 l-4 12 l-4 -12 l-12 -4 z" opacity="0.8" />
        </g>

        <g fill="none" stroke="#E8806F" strokeWidth="3" strokeLinecap="round">
          <path
            className="a-draw"
            style={{ ["--dash" as string]: 200, animationDelay: "0.9s" }}
            d="M250 410 C 250 460 300 468 370 468"
            markerEnd="url(#tipChain)"
          />
          <path
            className="a-draw"
            style={{ ["--dash" as string]: 200, animationDelay: "1.6s" }}
            d="M520 512 C 520 566 440 570 350 570"
            markerEnd="url(#tipChain)"
          />
          <path
            className="a-draw"
            style={{ ["--dash" as string]: 200, animationDelay: "2.3s" }}
            d="M250 614 C 250 660 300 672 370 672"
            markerEnd="url(#tipChain)"
          />
        </g>

        <g
          fontFamily="var(--font-hand), cursive"
          fontSize="21"
          fontWeight="700"
          textAnchor="middle"
          fill="#F5E39B"
        >
          <g className="a-fade" style={{ animationDelay: "1.3s" }}>
            <rect x="247" y="445" width="74" height="27" rx="13.5" fill="#141A47" stroke="#E8806F" strokeWidth="2" />
            <text x="284" y="465">+3 days</text>
          </g>
          <g className="a-fade" style={{ animationDelay: "2s" }}>
            <rect x="431" y="548" width="74" height="27" rx="13.5" fill="#141A47" stroke="#E8806F" strokeWidth="2" />
            <text x="468" y="568">+7 days</text>
          </g>
          <g className="a-fade" style={{ animationDelay: "2.7s" }}>
            <rect x="247" y="647" width="74" height="27" rx="13.5" fill="#141A47" stroke="#E8806F" strokeWidth="2" />
            <text x="284" y="667">+1 day</text>
          </g>
        </g>
      </svg>

      <div
        style={{
          position: "absolute",
          left: 44,
          top: 116,
          fontFamily: "var(--font-display), Georgia, serif",
          fontSize: 70,
          lineHeight: 0.92,
          letterSpacing: "-0.03em",
        }}
      >
        {c.title}
        <br />
        <em style={{ color: "#BBA9E8" }}>{c.titleAccent}</em>
      </div>
      <div
        style={{
          position: "absolute",
          left: 44,
          top: 258,
          fontFamily: "var(--font-hand), cursive",
          fontSize: 30,
          lineHeight: 1,
          color: "#F5E39B",
        }}
      >
        {c.subtitle}
      </div>

      {chainReaction.map((node, i) => (
        <div
          key={node.userId}
          className="a-drop"
          style={{
            animationDelay: `${0.5 + i * 0.7}s`,
            position: "absolute",
            left: POS[i].left,
            top: POS[i].top,
            width: 300,
            height: 88,
            boxSizing: "border-box",
            display: "flex",
            alignItems: "center",
            gap: 12,
            padding: "0 14px 0 12px",
            border: "2px solid #F5ECD9",
            borderRadius: 18,
            background: node.bg,
            color: "#141A47",
            boxShadow: "4px 4px 0 rgba(0,0,0,0.35)",
          }}
        >
          <ItemLink
            url={searchUrl(node.title, null)}
            label={node.title}
            style={{
              display: "flex",
              alignItems: "center",
              gap: 12,
              flex: 1,
              minWidth: 0,
            }}
          >
          <div
            style={{
              width: 60,
              height: 60,
              flexShrink: 0,
              boxSizing: "border-box",
              border: "2px solid #141A47",
              borderRadius: "50%",
              background: "#F5ECD9",
              padding: node.art === "socks" ? 0 : 6,
              display: "flex",
              alignItems: "center",
              justifyContent: "center",
            }}
          >
            {node.art === "socks" ? (
              <svg width="38" height="38" viewBox="0 0 48 48" fill="none" aria-hidden="true">
                <path
                  d="M16 5 h14 v19 l10 8 a7 7 0 0 1 -4 12 h-15 a8 8 0 0 1 -5 -14 z"
                  fill="#F5ECD9"
                  stroke="#141A47"
                  strokeWidth="2.4"
                  strokeLinejoin="round"
                />
                <path d="M16 11 h14 M16 16 h14" stroke="#E8806F" strokeWidth="2.6" strokeLinecap="round" />
              </svg>
            ) : (
              <ProductArt kind={node.art as ArtKind} />
            )}
          </div>
          <div style={{ display: "flex", flexDirection: "column", gap: 1 }}>
            <div
              style={{
                fontSize: 11.5,
                fontWeight: 700,
                letterSpacing: "0.12em",
                textTransform: "uppercase",
                color: "#B8412F",
              }}
            >
              {node.kicker}
            </div>
            <div
              style={{
                fontFamily: "var(--font-display), Georgia, serif",
                fontSize: 27,
                lineHeight: 1,
              }}
            >
              {node.title}
            </div>
            <div style={{ fontSize: 13.5, lineHeight: 1.2 }}>{node.when}</div>
          </div>
          </ItemLink>
          <div
            style={{
              position: "absolute",
              right: -10,
              top: -14,
              width: 40,
              height: 40,
              borderRadius: "50%",
              overflow: "hidden",
              border: "2px solid #F5ECD9",
              boxSizing: "border-box",
              background: "#F5ECD9",
            }}
          >
            <Avatar who={node.userId} />
          </div>
        </div>
      ))}

      <div
        className="a-stamp"
        style={{
          animationDelay: "3.3s",
          position: "absolute",
          left: 44,
          top: 732,
          width: 400,
          height: 64,
          boxSizing: "border-box",
          display: "flex",
          alignItems: "center",
          justifyContent: "space-between",
          padding: "0 18px",
          border: "3px solid #E8806F",
          borderRadius: 10,
          color: "#E8806F",
          transform: "rotate(-2deg)",
        }}
      >
        <div
          style={{
            fontSize: 12.5,
            fontWeight: 700,
            letterSpacing: "0.16em",
            textTransform: "uppercase",
            lineHeight: 1.3,
          }}
        >
          Sabina
          <br />
          influence score
        </div>
        <div
          style={{
            fontFamily: "var(--font-display), Georgia, serif",
            fontSize: 46,
            fontStyle: "italic",
            lineHeight: 1,
          }}
        >
          {c.verdict}
        </div>
      </div>
      <div
        className="a-fade"
        style={{
          animationDelay: "2.7s",
          position: "absolute",
          left: 470,
          top: 738,
          width: 206,
          fontFamily: "var(--font-hand), cursive",
          fontSize: 23,
          lineHeight: 1,
          color: "#F5ECD9",
          transform: "rotate(2deg)",
        }}
      >
        {chainFootnote}
      </div>

      <div
        style={{
          position: "absolute",
          left: 44,
          top: 812,
          fontFamily: "var(--font-hand), cursive",
          fontSize: 23,
          lineHeight: 1,
          color: "#F5ECD9",
          opacity: 0.9,
          transform: "rotate(-1deg)",
        }}
      >
        {c.evidence}
      </div>
    </LoreFrame>
  );
}
