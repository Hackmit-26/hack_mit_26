"use client";

import { Avatar } from "@/components/primitives/Avatar";
import { ItemLink } from "@/components/primitives/ItemLink";
import { ProductArt } from "@/components/primitives/ProductArt";
import { getUser } from "@/data/users";
import { loreCases, skincareAbstainer, skincareSync } from "@/data/wrapped";
import { searchUrl } from "@/services/commerce";
import { LoreFrame, LoreHeader, LoreStamp } from "./LoreFrame";

/** Case 02 — three purchases inside one 72-hour window. */
export function LoreSkin() {
  const c = loreCases[1];

  return (
    <LoreFrame grainId="grainLoreSkin">
      <LoreHeader caseLabel="Case 02 / 03" />

      <svg
        width="720"
        height="900"
        viewBox="0 0 720 900"
        style={{ position: "absolute", left: 0, top: 0, pointerEvents: "none" }}
        aria-hidden="true"
      >
        <g fill="#F5E39B">
          <path
            d="M652 96 l4 -12 l4 12 l12 4 l-12 4 l-4 12 l-4 -12 l-12 -4 z"
            opacity="0.8"
          />
        </g>

        {/* the 72-hour ruler */}
        <g fill="none" stroke="#F5ECD9" strokeWidth="2" strokeLinecap="round">
          <path d="M44 322 V312 H676 V322" opacity="0.7" />
          <path d="M44 350 H676" strokeWidth="3" opacity="0.9" />
          <g strokeWidth="2">
            <path d="M97 344 V356" />
            <path d="M307 344 V356" />
            <path d="M518 344 V356" />
          </g>
        </g>
        <g fill="#F5ECD9" fontFamily="var(--font-hand), cursive" fontSize="21" textAnchor="middle">
          <text x="97" y="384">Sat 12</text>
          <text x="307" y="384">Sun 13</text>
          <text x="518" y="384">Mon 14</text>
        </g>
        <rect x="326" y="296" width="68" height="24" rx="12" fill="#141A47" />
        <text
          x="360"
          y="314"
          textAnchor="middle"
          fontFamily="var(--font-body), sans-serif"
          fontSize="13"
          fontWeight="700"
          letterSpacing="1.8"
          fill="#F5E39B"
        >
          72 HOURS
        </text>

        <g fill="none" stroke="#E8806F" strokeWidth="3" strokeLinecap="round">
          <path className="a-draw" style={{ animationDelay: "0.5s" }} d="M95 350 C 95 400 130 400 142 440" />
          <path className="a-draw" style={{ animationDelay: "1s" }} d="M284 350 C 284 400 340 400 360 440" />
          <path className="a-draw" style={{ animationDelay: "1.5s" }} d="M660 350 C 660 400 600 400 578 440" />
        </g>
        <g fill="#E8806F" stroke="#141A47" strokeWidth="2.5">
          <circle cx="95" cy="350" r="8" />
          <circle cx="284" cy="350" r="8" />
          <circle cx="660" cy="350" r="8" />
        </g>
      </svg>

      <div
        style={{
          position: "absolute",
          left: 44,
          top: 116,
          fontFamily: "var(--font-display), Georgia, serif",
          fontSize: 78,
          lineHeight: 0.9,
          letterSpacing: "-0.03em",
        }}
      >
        {c.title}
        <br />
        <em style={{ color: "#EBB5BD" }}>{c.titleAccent}</em>
      </div>
      <div
        style={{
          position: "absolute",
          left: 44,
          top: 268,
          fontFamily: "var(--font-hand), cursive",
          fontSize: 30,
          lineHeight: 1,
          color: "#F5E39B",
        }}
      >
        {c.subtitle}
      </div>

      <LoreStamp
        label={c.verdictLabel}
        value={c.verdict}
        top={136}
        rotate={8}
        delay={2.4}
        right={48}
      />

      <div
        style={{
          position: "absolute",
          left: 44,
          top: 442,
          width: 632,
          display: "flex",
          gap: 22,
        }}
      >
        {skincareSync.map((s, i) => (
          <div
            key={s.userId}
            className="a-drop"
            style={{
              animationDelay: `${0.6 + i * 0.5}s`,
              flex: 1,
              boxSizing: "border-box",
              padding: "12px 12px 14px",
              border: "2px solid #F5ECD9",
              borderRadius: 16,
              background: s.bg,
              color: "#141A47",
              transform:
                i === 1 ? "rotate(1deg) translateY(6px)" : `rotate(${i === 0 ? -1.5 : -1}deg)`,
              boxShadow: "4px 4px 0 rgba(0,0,0,0.35)",
              textAlign: "center",
            }}
          >
            <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
              <div
                style={{
                  width: 40,
                  height: 40,
                  borderRadius: "50%",
                  overflow: "hidden",
                  border: "2px solid #141A47",
                  boxSizing: "border-box",
                  background: "#F5ECD9",
                }}
              >
                <Avatar who={s.userId} />
              </div>
              <div
                style={{
                  fontSize: 12.5,
                  fontWeight: 700,
                  letterSpacing: "0.14em",
                  textTransform: "uppercase",
                }}
              >
                {getUser(s.userId).name}
              </div>
            </div>
            <ItemLink url={searchUrl(s.item, s.merchant)} label={`${s.item} at ${s.merchant}`}>
              <div
                style={{
                  width: 104,
                  height: 104,
                  margin: "8px auto 6px",
                  boxSizing: "border-box",
                  border: "2px solid #141A47",
                  borderRadius: "50%",
                  background: "#F5ECD9",
                  padding: 10,
                }}
              >
                <ProductArt kind={s.art} />
              </div>
              <div
                style={{
                  fontFamily: "var(--font-display), Georgia, serif",
                  fontSize: 25,
                  lineHeight: 1,
                }}
              >
                {s.item}
              </div>
              <div
                style={{
                  fontSize: 13.5,
                  fontWeight: 600,
                  marginTop: 4,
                  textDecoration: "underline",
                }}
              >
                {s.merchant}
              </div>
            </ItemLink>
            <div
              style={{
                fontFamily: "var(--font-hand), cursive",
                fontSize: 21,
                lineHeight: 1,
                color: "#B8412F",
                marginTop: 2,
              }}
            >
              {s.when}
            </div>
          </div>
        ))}
      </div>

      <div
        className="a-fade"
        style={{
          animationDelay: "2.1s",
          position: "absolute",
          left: 44,
          top: 722,
          width: 632,
          boxSizing: "border-box",
          display: "flex",
          alignItems: "center",
          gap: 14,
          padding: "8px 16px 8px 8px",
          border: "2px dashed rgba(245,236,217,0.6)",
          borderRadius: 999,
        }}
      >
        <div
          style={{
            width: 44,
            height: 44,
            flexShrink: 0,
            borderRadius: "50%",
            overflow: "hidden",
            border: "2px solid #F5ECD9",
            boxSizing: "border-box",
            background: "#F5ECD9",
          }}
        >
          <Avatar who={skincareAbstainer.userId} />
        </div>
        <div style={{ fontSize: 15.5, lineHeight: 1.3 }}>
          <b>Madhav abstained.</b> Alibi on file: one tiny succulent, Sept 12.
        </div>
      </div>
      <div
        className="a-fade"
        style={{
          animationDelay: "2.1s",
          position: "absolute",
          left: 60,
          top: 776,
          fontFamily: "var(--font-hand), cursive",
          fontSize: 23,
          lineHeight: 1,
          color: "#EBB5BD",
          transform: "rotate(-1deg)",
        }}
      >
        {skincareAbstainer.aside}
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
