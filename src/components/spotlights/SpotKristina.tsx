"use client";

import { Avatar } from "@/components/primitives/Avatar";
import { Grain } from "@/components/primitives/Glyphs";
import { ProductArt } from "@/components/primitives/ProductArt";
import { spotlights } from "@/data/wrapped";

/** Spotlight · Kristina — the cascading stat stack, stepped right each row. */
export function SpotKristina() {
  const s = spotlights.kristina;

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
      <Grain w={720} h={900} id="grainSpotKristina" />
      <div
        style={{
          position: "absolute",
          right: -100,
          top: -110,
          width: 380,
          height: 380,
          borderRadius: "50%",
          background: "#141A47",
        }}
      />
      <svg
        width="720"
        height="330"
        viewBox="0 0 720 330"
        style={{ position: "absolute", left: 0, top: 0 }}
        aria-hidden="true"
      >
        <path
          d="M560 40 a44 44 0 1 0 44 60 a34 34 0 1 1 -44 -60 z"
          fill="#F5E39B"
          stroke="#141A47"
          strokeWidth="2.4"
          strokeLinejoin="round"
        />
        <g fill="#F5ECD9">
          <path d="M470 60 l4 -12 l4 12 l12 4 l-12 4 l-4 12 l-4 -12 l-12 -4 z" />
          <path d="M666 130 l3 -9 l3 9 l9 3 l-9 3 l-3 9 l-3 -9 l-9 -3 z" />
          <circle cx="620" cy="34" r="2.5" />
          <circle cx="516" cy="118" r="2" />
        </g>
      </svg>

      <div
        style={{
          position: "absolute",
          left: 44,
          top: 38,
          right: 44,
          display: "flex",
          justifyContent: "space-between",
          fontSize: 14,
          fontWeight: 700,
          letterSpacing: "0.16em",
          textTransform: "uppercase",
        }}
      >
        <div>Chapter 2 · Spotlights</div>
      </div>

      <div
        style={{
          position: "absolute",
          left: 44,
          top: 78,
          width: 420,
          display: "flex",
          flexDirection: "column",
          gap: 10,
        }}
      >
        <div
          style={{
            fontSize: 14,
            fontWeight: 700,
            letterSpacing: "0.16em",
            textTransform: "uppercase",
          }}
        >
          Kristina’s September era
        </div>
        <div
          style={{
            fontFamily: "var(--font-display), Georgia, serif",
            fontSize: 82,
            lineHeight: 0.9,
            letterSpacing: "-0.03em",
          }}
        >
          {s.title} <em>{s.titleAccent}</em>
        </div>
      </div>

      <div
        style={{
          position: "absolute",
          left: 448,
          top: 120,
          width: 200,
          height: 232,
          boxSizing: "border-box",
          border: "3px solid #141A47",
          borderRadius: "100px 100px 22px 22px",
          overflow: "hidden",
          background: "#F5ECD9",
          boxShadow: "6px 6px 0 #141A47",
          transform: "rotate(3deg)",
        }}
      >
        <Avatar who="kristina" />
      </div>

      <div
        style={{
          position: "absolute",
          left: 44,
          top: 268,
          width: 390,
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
          top: 404,
          width: 632,
          display: "flex",
          flexDirection: "column",
          gap: 12,
        }}
      >
        {s.stats.map((stat, i) => (
          <div
            key={stat.kicker}
            className="a-cascade"
            style={{
              animationDelay: `${0.5 + i * 0.25}s`,
              marginLeft: i * 22,
              boxSizing: "border-box",
              display: "flex",
              alignItems: "center",
              gap: 16,
              padding: "12px 18px 12px 12px",
              border: "2px solid #141A47",
              borderRadius: 22,
              background: "#F5ECD9",
              boxShadow: "5px 5px 0 #141A47",
              transform: `rotate(${i === 1 ? 0.8 : i === 0 ? -0.8 : -0.5}deg)`,
            }}
          >
            <div
              style={{
                width: 80,
                height: 80,
                flexShrink: 0,
                borderRadius: "50%",
                background: stat.bg,
                border: stat.art ? "2px solid #141A47" : undefined,
                padding: stat.art ? 8 : undefined,
                boxSizing: "border-box",
                display: "flex",
                alignItems: "center",
                justifyContent: "center",
              }}
            >
              {stat.art ? (
                <ProductArt kind={stat.art} />
              ) : (
                <svg width="46" height="46" viewBox="0 0 100 100" aria-hidden="true">
                  <path
                    d="M62 10 a42 42 0 1 0 28 62 a32 32 0 1 1 -28 -62 z"
                    fill="#F5E39B"
                  />
                </svg>
              )}
            </div>
            <div style={{ display: "flex", flexDirection: "column", gap: 2 }}>
              <div
                style={{
                  fontSize: 13,
                  fontWeight: 700,
                  letterSpacing: "0.14em",
                  textTransform: "uppercase",
                  color: "#B8412F",
                }}
              >
                {stat.kicker}
              </div>
              <div
                style={{
                  fontFamily: "var(--font-display), Georgia, serif",
                  fontSize: stat.headline.length > 12 ? 34 : 46,
                  lineHeight: 0.95,
                }}
              >
                {stat.headline}
              </div>
              <div style={{ fontSize: 16, lineHeight: 1.3 }}>{stat.body}</div>
            </div>
          </div>
        ))}
      </div>

      <div
        style={{
          position: "absolute",
          left: 44,
          top: 802,
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
