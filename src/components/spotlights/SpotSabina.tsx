"use client";

import { Grain } from "@/components/primitives/Glyphs";
import { ProductArt } from "@/components/primitives/ProductArt";
import { spotlights, sabinaReceipt, sabinaWeek } from "@/data/wrapped";

/** Spotlight · Sabina — day-of-week bubbles and the Sept 12 receipt. */
export function SpotSabina() {
  const s = spotlights.sabina;

  const days = sabinaWeek.days.map((d, i) => {
    const n = sabinaWeek.counts[i];
    const weekend = i >= 5;
    return {
      d,
      n: n === 0 ? "" : String(n),
      size: n === 0 ? 26 : 34 + n * 7,
      fs: n >= 4 ? 34 : 22,
      border: n === 0 ? "dashed" : "solid",
      bg: i === 5 ? "#E8806F" : i === 6 ? "#F5E39B" : n === 0 ? "transparent" : "#A8DCC2",
      labelColor: weekend ? "#B8412F" : "#141A47",
      delay: 0.3 + i * 0.09,
    };
  });

  // The torn-off bottom edge of the receipt.
  let zig = "M0 0";
  for (let i = 0; i < 19; i += 1) zig += " l7 11 l7 -11";

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
      <Grain w={720} h={900} id="grainSpotSabina" />
      <div
        style={{
          position: "absolute",
          left: -90,
          top: 610,
          width: 360,
          height: 360,
          borderRadius: "50%",
          background: "#F5E39B",
          opacity: 0.55,
        }}
      />
      <svg
        width="720"
        height="900"
        viewBox="0 0 720 900"
        style={{ position: "absolute", left: 0, top: 0 }}
        fill="none"
        aria-hidden="true"
      >
        <g fill="#F5ECD9" stroke="#141A47" strokeWidth="2">
          <path d="M650 96 l5 -14 l5 14 l14 5 l-14 5 l-5 14 l-5 -14 l-14 -5 z" />
          <path d="M60 250 l4 -10 l4 10 l10 4 l-10 4 l-4 10 l-4 -10 l-10 -4 z" />
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
        Sabina’s September era
      </div>

      <div
        style={{
          position: "absolute",
          left: 0,
          right: 0,
          top: 96,
          textAlign: "center",
          fontFamily: "var(--font-display), Georgia, serif",
          fontSize: 80,
          lineHeight: 0.95,
          letterSpacing: "-0.03em",
        }}
      >
        {s.title} <em>{s.titleAccent}</em>
      </div>
      <div
        style={{
          position: "absolute",
          left: 90,
          right: 90,
          top: 186,
          textAlign: "center",
          fontSize: 21,
          lineHeight: 1.38,
          fontWeight: 500,
          textWrap: "pretty",
        }}
      >
        {s.lead}
      </div>

      {/* purchases by day of week */}
      <div
        style={{
          position: "absolute",
          left: 44,
          top: 268,
          width: 632,
          height: 136,
          boxSizing: "border-box",
          border: "2px solid #141A47",
          borderRadius: 26,
          background: "#F5ECD9",
          boxShadow: "5px 5px 0 #141A47",
          padding: "12px 22px 0",
        }}
      >
        <div
          style={{
            display: "flex",
            justifyContent: "space-between",
            alignItems: "flex-end",
            height: 96,
          }}
        >
          {days.map((c) => (
            <div
              key={c.d}
              className="a-dot"
              style={{
                animationDelay: `${c.delay}s`,
                width: c.size,
                height: c.size,
                flexShrink: 0,
                boxSizing: "border-box",
                border: `2px ${c.border} #141A47`,
                borderRadius: "50%",
                background: c.bg,
                display: "flex",
                alignItems: "center",
                justifyContent: "center",
                fontFamily: "var(--font-display), Georgia, serif",
                fontSize: c.fs,
                lineHeight: 1,
              }}
            >
              {c.n}
            </div>
          ))}
        </div>
        <div style={{ display: "flex", justifyContent: "space-between", marginTop: 8 }}>
          {days.map((c) => (
            <div
              key={c.d}
              style={{
                width: 60,
                textAlign: "center",
                fontSize: 12.5,
                fontWeight: 700,
                letterSpacing: "0.14em",
                textTransform: "uppercase",
                color: c.labelColor,
              }}
            >
              {c.d}
            </div>
          ))}
        </div>
        <div
          style={{
            position: "absolute",
            right: 26,
            top: -18,
            fontFamily: "var(--font-hand), cursive",
            fontSize: 23,
            lineHeight: 1,
            color: "#B8412F",
            transform: "rotate(3deg)",
            background: s.bg,
            padding: "0 6px",
          }}
        >
          purchases by day of week
        </div>
      </div>

      {/* the receipt */}
      <div
        className="a-tape"
        style={{
          position: "absolute",
          left: 44,
          top: 416,
          width: 266,
          filter: "drop-shadow(4px 4px 0 #141A47)",
        }}
      >
        <div
          style={{
            boxSizing: "border-box",
            padding: "14px 16px 6px",
            background: "#FBF6EA",
            border: "2px solid #141A47",
            borderBottom: 0,
          }}
        >
          <div
            style={{
              textAlign: "center",
              fontSize: 13,
              fontWeight: 700,
              letterSpacing: "0.2em",
              textTransform: "uppercase",
            }}
          >
            {sabinaReceipt.header}
          </div>
          <div
            style={{
              textAlign: "center",
              fontFamily: "var(--font-hand), cursive",
              fontSize: 21,
              lineHeight: 1,
              color: "#B8412F",
              marginTop: 2,
            }}
          >
            {sabinaReceipt.subtitle}
          </div>
          <div style={{ borderTop: "2px dashed #141A47", margin: "8px 0 2px" }} />
          {sabinaReceipt.rows.map((r) => (
            <div
              key={r.time}
              style={{
                padding: "3px 0",
                borderBottom: "1px dashed rgba(20,26,71,0.4)",
              }}
            >
              <div
                style={{
                  display: "flex",
                  justifyContent: "space-between",
                  fontSize: 13,
                  fontWeight: 700,
                  letterSpacing: "0.04em",
                  lineHeight: 1.15,
                }}
              >
                <span>{r.store}</span>
                <span style={{ fontWeight: 500, opacity: 0.7 }}>{r.time}</span>
              </div>
              <div style={{ fontSize: 13, lineHeight: 1.15, opacity: 0.8 }}>{r.item}</div>
            </div>
          ))}
          <div
            style={{
              display: "flex",
              justifyContent: "space-between",
              alignItems: "baseline",
              padding: "6px 0 2px",
            }}
          >
            <span
              style={{
                fontSize: 13,
                fontWeight: 700,
                letterSpacing: "0.14em",
                textTransform: "uppercase",
              }}
            >
              Total
            </span>
            <span style={{ fontFamily: "var(--font-hand), cursive", fontSize: 22, lineHeight: 1 }}>
              {sabinaReceipt.total}
            </span>
          </div>
        </div>
        <svg width="266" height="14" viewBox="0 0 266 14" style={{ display: "block" }} aria-hidden="true">
          <path d={zig} fill="#FBF6EA" stroke="#141A47" strokeWidth="2" strokeLinejoin="round" />
        </svg>
      </div>

      <div
        style={{
          position: "absolute",
          left: 336,
          top: 414,
          width: 340,
          display: "flex",
          flexDirection: "column",
          gap: 10,
        }}
      >
        {s.stats.map((stat, i) => (
          <div
            key={stat.kicker}
            className="a-cascadeR"
            style={{
              animationDelay: `${0.7 + i * 0.25}s`,
              marginLeft: i === 1 ? 12 : 0,
              boxSizing: "border-box",
              display: "flex",
              alignItems: "center",
              gap: 14,
              padding: "10px 16px 10px 12px",
              border: "2px solid #141A47",
              borderRadius: 22,
              background: "#F5ECD9",
              boxShadow: "5px 5px 0 #141A47",
              transform: `rotate(${[0.7, -0.8, 0.5][i]}deg)`,
            }}
          >
            <div
              style={{
                width: 68,
                height: 68,
                flexShrink: 0,
                borderRadius: "50%",
                background: stat.bg,
                border: "2px solid #141A47",
                padding: stat.art ? 7 : 0,
                boxSizing: "border-box",
                display: "flex",
                alignItems: "center",
                justifyContent: "center",
              }}
            >
              {stat.art ? (
                <ProductArt kind={stat.art} />
              ) : (
                <svg width="44" height="44" viewBox="0 0 48 48" fill="none" aria-hidden="true">
                  <rect x="6" y="9" width="36" height="32" rx="6" fill="#F5ECD9" stroke="#141A47" strokeWidth="2.4" />
                  <path d="M6 19 H42" stroke="#141A47" strokeWidth="2.4" />
                  <path d="M15 5 V12 M33 5 V12" stroke="#141A47" strokeWidth="2.4" strokeLinecap="round" />
                  <rect x="24" y="23" width="8" height="8" rx="2" fill="#E8806F" stroke="#141A47" strokeWidth="2" />
                  <rect x="33" y="23" width="6" height="8" rx="2" fill="#E8806F" stroke="#141A47" strokeWidth="2" />
                </svg>
              )}
            </div>
            <div style={{ display: "flex", flexDirection: "column", gap: 1 }}>
              <div
                style={{
                  fontSize: 12.5,
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
                  fontSize: stat.headline.length > 10 ? 30 : 40,
                  lineHeight: 0.95,
                }}
              >
                {stat.headline}
              </div>
              <div style={{ fontSize: 14.5, lineHeight: 1.3 }}>{stat.body}</div>
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
