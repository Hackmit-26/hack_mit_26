"use client";

import { Grain } from "@/components/primitives/Glyphs";
import { ProductArt } from "@/components/primitives/ProductArt";
import { madhavStamps, spotlights } from "@/data/wrapped";

const ROT = [-6, 4, -3, 5, -5, 3, 4, -4, 6];
const INKS = ["#141A47", "#B8412F", "#141A47"];
const BGS = [
  "rgba(245,227,155,0.55)",
  "rgba(235,181,189,0.45)",
  "rgba(168,220,194,0.5)",
];

/** Spotlight · Madhav — the loyalty card, nine stamps deep. */
export function SpotMadhav() {
  const s = spotlights.madhav;

  const stamps = madhavStamps.dates.map((d, i) => ({
    d,
    r: ROT[i],
    ink: INKS[i % 3],
    bg: BGS[(i + Math.floor(i / 3)) % 3],
    delay: 0.4 + i * 0.12,
  }));

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
      <Grain w={720} h={900} id="grainSpotMadhav" />
      <div
        style={{
          position: "absolute",
          right: -120,
          top: 250,
          width: 400,
          height: 400,
          borderRadius: "50%",
          background: "#EBB5BD",
          opacity: 0.6,
        }}
      />
      <svg
        width="720"
        height="330"
        viewBox="0 0 720 330"
        style={{ position: "absolute", left: 0, top: 0 }}
        fill="none"
        aria-hidden="true"
      >
        <g fill="#F5ECD9" stroke="#141A47" strokeWidth="2">
          <path d="M70 120 l5 -14 l5 14 l14 5 l-14 5 l-5 14 l-5 -14 l-14 -5 z" />
          <path d="M640 190 l4 -10 l4 10 l10 4 l-10 4 l-4 10 l-4 -10 l-10 -4 z" />
        </g>
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
        Madhav’s September era
      </div>

      <div
        style={{
          position: "absolute",
          left: 0,
          right: 0,
          top: 92,
          textAlign: "center",
          fontFamily: "var(--font-display), Georgia, serif",
          fontSize: 124,
          lineHeight: 0.95,
          letterSpacing: "-0.035em",
        }}
      >
        {s.title} <em>{s.titleAccent}</em>
      </div>
      <div
        style={{
          position: "absolute",
          left: 100,
          right: 100,
          top: 220,
          textAlign: "center",
          fontSize: 21,
          lineHeight: 1.38,
          fontWeight: 500,
          textWrap: "pretty",
        }}
      >
        {s.lead}
      </div>

      {/* loyalty card */}
      <div
        style={{
          position: "absolute",
          left: 44,
          top: 310,
          width: 336,
          boxSizing: "border-box",
          padding: "18px 22px 16px",
          border: "2px solid #141A47",
          borderRadius: 20,
          background: "#F5ECD9",
          boxShadow: "6px 6px 0 #141A47",
          transform: "rotate(-1.8deg)",
        }}
      >
        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "baseline" }}>
          <div
            style={{
              fontSize: 13,
              fontWeight: 700,
              letterSpacing: "0.16em",
              textTransform: "uppercase",
            }}
          >
            {madhavStamps.merchant}
          </div>
          <div
            style={{
              fontFamily: "var(--font-hand), cursive",
              fontSize: 21,
              lineHeight: 1,
              color: "#B8412F",
            }}
          >
            loyalty card
          </div>
        </div>
        <div style={{ borderTop: "2px dashed #141A47", margin: "10px 0 12px" }} />
        <div
          style={{
            display: "grid",
            gridTemplateColumns: "repeat(3, minmax(0, 1fr))",
            gap: "12px 8px",
          }}
        >
          {stamps.map((st) => (
            <div
              key={st.d}
              style={{ display: "flex", flexDirection: "column", alignItems: "center", gap: 5 }}
            >
              <div
                className="a-stamp"
                style={{
                  animationDelay: `${st.delay}s`,
                  width: 78,
                  height: 78,
                  boxSizing: "border-box",
                  border: `2.5px solid ${st.ink}`,
                  borderRadius: "50%",
                  background: st.bg,
                  display: "flex",
                  alignItems: "center",
                  justifyContent: "center",
                  transform: `rotate(${st.r}deg)`,
                }}
              >
                <svg width="40" height="40" viewBox="0 0 48 48" fill="none" aria-hidden="true">
                  <path
                    d="M8 18 H34 V30 a10 10 0 0 1 -10 10 H18 a10 10 0 0 1 -10 -10 z"
                    fill={st.ink}
                    fillOpacity="0.12"
                    stroke={st.ink}
                    strokeWidth="2.6"
                    strokeLinejoin="round"
                  />
                  <path
                    d="M34 21 h3 a5 5 0 0 1 0 10 h-4"
                    stroke={st.ink}
                    strokeWidth="2.6"
                    strokeLinecap="round"
                  />
                  <path
                    d="M16 12 c-2 -3 2 -4 0 -7 M24 12 c-2 -3 2 -4 0 -7"
                    stroke={st.ink}
                    strokeWidth="2.2"
                    strokeLinecap="round"
                  />
                </svg>
              </div>
              <div style={{ fontSize: 12.5, fontWeight: 600, letterSpacing: "0.06em" }}>{st.d}</div>
            </div>
          ))}
        </div>
        <div style={{ borderTop: "2px dashed #141A47", margin: "14px 0 8px" }} />
        <div
          style={{
            fontFamily: "var(--font-hand), cursive",
            fontSize: 23,
            lineHeight: 1.05,
            textAlign: "center",
          }}
        >
          {madhavStamps.footer}
        </div>
      </div>

      <div
        style={{
          position: "absolute",
          left: 408,
          top: 318,
          width: 268,
          display: "flex",
          flexDirection: "column",
          gap: 14,
        }}
      >
        {s.stats.map((stat, i) => (
          <div
            key={stat.kicker}
            className="a-cascadeR"
            style={{
              animationDelay: `${1.2 + i * 0.25}s`,
              boxSizing: "border-box",
              display: "flex",
              alignItems: "center",
              gap: 12,
              padding: "12px 12px 12px 14px",
              border: "2px solid #141A47",
              borderRadius: 22,
              background: "#F5ECD9",
              boxShadow: "5px 5px 0 #141A47",
              transform: `rotate(${[0.8, -0.8, 0.6][i]}deg)`,
            }}
          >
            <div style={{ display: "flex", flexDirection: "column", gap: 1, flex: 1 }}>
              <div
                style={{
                  fontSize: 12,
                  fontWeight: 700,
                  letterSpacing: "0.1em",
                  textTransform: "uppercase",
                  color: "#B8412F",
                }}
              >
                {stat.kicker}
              </div>
              <div
                style={{
                  fontFamily: "var(--font-display), Georgia, serif",
                  fontSize: stat.headline.length > 10 ? 30 : 40,
                  lineHeight: 0.95,
                }}
              >
                {stat.headline}
              </div>
              <div style={{ fontSize: 14, lineHeight: 1.3 }}>{stat.body}</div>
            </div>
            <div
              style={{
                width: 56,
                height: 56,
                flexShrink: 0,
                borderRadius: "50%",
                background: stat.bg,
                border: "2px solid #141A47",
                padding: 6,
                boxSizing: "border-box",
              }}
            >
              {stat.art && <ProductArt kind={stat.art} />}
            </div>
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
