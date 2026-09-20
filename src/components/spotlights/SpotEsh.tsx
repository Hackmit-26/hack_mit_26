"use client";

import { Avatar } from "@/components/primitives/Avatar";
import { Grain } from "@/components/primitives/Glyphs";
import { ProductArt } from "@/components/primitives/ProductArt";
import { eshStoreChips, spotlights } from "@/data/wrapped";

const CHIP_BG = ["#F5ECD9", "#EBB5BD", "#A8DCC2", "#F5E39B"];
const ROT = [-3, 2, -1, 3, -2, 1];
const DX = [0, 22, 6, 30, 0, 18];

/** Spotlight · Esh — store names raining down both sides, three polaroids. */
export function SpotEsh() {
  const s = spotlights.esh;

  return (
    <div
      className="a-card"
      style={{
        position: "relative",
        width: 720,
        height: 900,
        boxSizing: "border-box",
        borderRadius: 36,
        background: s.bg,
        color: "#141A47",
        overflow: "hidden",
      }}
    >
      <Grain w={720} h={900} id="grainSpotEsh" />
      <div
        style={{
          position: "absolute",
          left: 130,
          top: 70,
          width: 460,
          height: 320,
          borderRadius: "50%",
          background: "#F5ECD9",
          opacity: 0.5,
        }}
      />
      <svg
        width="720"
        height="420"
        viewBox="0 0 720 420"
        style={{ position: "absolute", left: 0, top: 0 }}
        fill="none"
        aria-hidden="true"
      >
        <path
          d="M250 130 C 200 80 120 120 190 200 M470 130 C 520 80 600 120 530 200"
          stroke="#141A47"
          strokeWidth="2"
          strokeDasharray="2 8"
          strokeLinecap="round"
        />
      </svg>

      <div
        style={{
          position: "absolute",
          left: 44,
          top: 38,
          fontSize: 14,
          fontWeight: 700,
          letterSpacing: "0.16em",
          textTransform: "uppercase",
        }}
      >
        Chapter 2 · Spotlights
      </div>
      <div
        style={{
          position: "absolute",
          left: 0,
          right: 0,
          top: 70,
          textAlign: "center",
          fontSize: 14,
          fontWeight: 700,
          letterSpacing: "0.16em",
          textTransform: "uppercase",
        }}
      >
        Esh’s September era
      </div>

      <div
        style={{
          position: "absolute",
          left: 44,
          top: 112,
          display: "flex",
          flexDirection: "column",
          gap: 10,
          alignItems: "flex-start",
        }}
      >
        {eshStoreChips.left.map((t, i) => (
          <StoreChip
            key={t}
            label={t}
            bg={CHIP_BG[i % 4]}
            rotate={ROT[i]}
            offset={DX[i]}
            side="left"
            delay={i * 0.08}
          />
        ))}
      </div>
      <div
        style={{
          position: "absolute",
          right: 44,
          top: 112,
          display: "flex",
          flexDirection: "column",
          gap: 10,
          alignItems: "flex-end",
        }}
      >
        {eshStoreChips.right.map((t, i) => (
          <StoreChip
            key={t}
            label={t}
            bg={CHIP_BG[(i + 2) % 4]}
            rotate={-ROT[i]}
            offset={DX[(i + 3) % 6]}
            side="right"
            delay={i * 0.08}
          />
        ))}
      </div>

      <div
        style={{
          position: "absolute",
          left: 260,
          top: 132,
          width: 200,
          height: 200,
          boxSizing: "border-box",
          border: "3px solid #141A47",
          borderRadius: "50%",
          overflow: "hidden",
          background: "#F5ECD9",
          boxShadow: "6px 6px 0 #141A47",
        }}
      >
        <Avatar who="esh" />
      </div>
      <div
        style={{
          position: "absolute",
          left: 226,
          top: 336,
          width: 268,
          textAlign: "center",
          fontFamily: "var(--font-hand), cursive",
          fontSize: 24,
          lineHeight: 1,
          color: "#B8412F",
          transform: "rotate(-2deg)",
        }}
      >
        12 stores. 14 purchases. no notes.
      </div>

      <div
        style={{
          position: "absolute",
          left: 0,
          right: 0,
          top: 376,
          textAlign: "center",
          fontFamily: "var(--font-display), Georgia, serif",
          fontSize: 78,
          lineHeight: 0.95,
          letterSpacing: "-0.03em",
        }}
      >
        {s.title} <em>{s.titleAccent}</em>
      </div>
      <div
        style={{
          position: "absolute",
          left: 80,
          right: 80,
          top: 464,
          textAlign: "center",
          fontSize: 21,
          lineHeight: 1.38,
          fontWeight: 500,
          textWrap: "pretty",
        }}
      >
        {s.lead}
      </div>

      <div
        style={{
          position: "absolute",
          left: 44,
          top: 550,
          width: 632,
          display: "grid",
          gridTemplateColumns: "repeat(3, minmax(0, 1fr))",
          gap: 22,
        }}
      >
        {s.stats.map((stat, i) => (
          <div
            key={stat.kicker}
            style={{
              boxSizing: "border-box",
              padding: "10px 10px 12px",
              border: "2px solid #141A47",
              borderRadius: 10,
              background: "#F5ECD9",
              boxShadow: "5px 5px 0 #141A47",
              transform: `rotate(${[-2.5, 1.5, -1.5][i]}deg)`,
            }}
          >
            <div
              style={{
                height: 96,
                border: "2px solid #141A47",
                borderRadius: 6,
                background: stat.bg,
                padding: "4px 0",
                boxSizing: "border-box",
                display: "flex",
                justifyContent: "center",
              }}
            >
              <div style={{ width: 88, height: 88 }}>
                {stat.art && <ProductArt kind={stat.art} />}
              </div>
            </div>
            <div
              style={{
                marginTop: 8,
                fontSize: 12.5,
                fontWeight: 700,
                letterSpacing: "0.12em",
                textTransform: "uppercase",
                color: "#B8412F",
              }}
            >
              {stat.kicker}
            </div>
            <div
              style={{
                fontFamily: "var(--font-display), Georgia, serif",
                fontSize: 40,
                lineHeight: 1,
              }}
            >
              {stat.headline}
            </div>
            <div style={{ fontSize: 14.5, lineHeight: 1.3 }}>{stat.body}</div>
          </div>
        ))}
      </div>

      <div
        style={{
          position: "absolute",
          left: 44,
          top: 812,
          fontFamily: "var(--font-hand), cursive",
          fontSize: 23,
          lineHeight: 1,
          transform: "rotate(-1.5deg)",
        }}
      >
        {s.evidence}
      </div>
    </div>
  );
}

function StoreChip({
  label,
  bg,
  rotate,
  offset,
  side,
  delay,
}: {
  label: string;
  bg: string;
  rotate: number;
  offset: number;
  side: "left" | "right";
  delay: number;
}) {
  return (
    <div
      className="a-chip"
      style={{
        animationDelay: `${delay}s`,
        marginLeft: side === "left" ? offset : undefined,
        marginRight: side === "right" ? offset : undefined,
        display: "flex",
        alignItems: "center",
        height: 34,
        padding: "0 14px",
        boxSizing: "border-box",
        border: "2px solid #141A47",
        borderRadius: 999,
        background: bg,
        fontSize: 14,
        fontWeight: 600,
        transform: `rotate(${rotate}deg)`,
        boxShadow: "3px 3px 0 #141A47",
        whiteSpace: "nowrap",
      }}
    >
      {label}
    </div>
  );
}
