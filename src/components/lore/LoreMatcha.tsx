"use client";

import { Avatar } from "@/components/primitives/Avatar";
import { ItemLink } from "@/components/primitives/ItemLink";
import { getUser } from "@/data/users";
import { loreCases, matchaTimeline } from "@/data/wrapped";
import { searchUrl } from "@/services/commerce";
import { LoreFrame, LoreHeader, LoreStamp } from "./LoreFrame";

const BGS = ["#A8DCC2", "#EBB5BD", "#BBA9E8", "#F5E39B"];
const ROT = [-1.2, 1, -0.8, 1.2, -1, 0.8, -1.2];

/** Case 01 — the matcha timeline, alternating down a dashed spine. */
export function LoreMatcha() {
  const c = loreCases[0];

  return (
    <LoreFrame grainId="grainLoreMatcha">
      <svg
        width="720"
        height="900"
        viewBox="0 0 720 900"
        style={{ position: "absolute", left: 0, top: 0, pointerEvents: "none" }}
        aria-hidden="true"
      >
        <g fill="#F5E39B">
          <path d="M640 60 l5 -14 l5 14 l14 5 l-14 5 l-5 14 l-5 -14 l-14 -5 z" />
          <path d="M60 214 l3 -9 l3 9 l9 3 l-9 3 l-3 9 l-3 -9 l-9 -3 z" opacity="0.8" />
        </g>
      </svg>
      <LoreHeader caseLabel="Case 01 / 03" />

      <div
        style={{
          position: "absolute",
          left: 44,
          top: 116,
          fontFamily: "var(--font-display), Georgia, serif",
          fontSize: 76,
          lineHeight: 0.92,
          letterSpacing: "-0.03em",
        }}
      >
        {c.title} <em style={{ color: "#A8DCC2" }}>{c.titleAccent}</em>
      </div>
      <div
        style={{
          position: "absolute",
          left: 44,
          top: 204,
          width: 500,
          fontFamily: "var(--font-hand), cursive",
          fontSize: 30,
          lineHeight: 1,
          color: "#F5E39B",
        }}
      >
        {c.subtitle}
      </div>

      <LoreStamp label={c.verdictLabel} value={c.verdict} top={196} rotate={-7} delay={2.3} />

      <div style={{ position: "absolute", left: 44, top: 280, width: 632 }}>
        <div
          style={{
            position: "absolute",
            left: 314,
            top: 10,
            bottom: 10,
            borderLeft: "3px dashed #E8806F",
          }}
        />
        <div style={{ display: "flex", flexDirection: "column", gap: 6 }}>
          {matchaTimeline.map((e, i) => {
            const left = i % 2 === 0;
            return (
              <div
                key={`${e.userId}-${e.date}`}
                className="a-pin"
                style={{
                  animationDelay: `${0.5 + i * 0.28}s`,
                  display: "flex",
                  flexDirection: left ? "row" : "row-reverse",
                  alignItems: "center",
                  gap: 14,
                  height: 66,
                }}
              >
                <div
                  style={{
                    flex: 1,
                    boxSizing: "border-box",
                    padding: "7px 12px 8px",
                    border: "2px solid #F5ECD9",
                    borderRadius: 12,
                    background: BGS[i % 4],
                    color: "#141A47",
                    transform: `rotate(${ROT[i]}deg)`,
                    boxShadow: "4px 4px 0 rgba(0,0,0,0.35)",
                  }}
                >
                  <div
                    style={{
                      fontSize: 12,
                      fontWeight: 700,
                      letterSpacing: "0.12em",
                      textTransform: "uppercase",
                      color: "#B8412F",
                      lineHeight: 1.1,
                    }}
                  >
                    {getUser(e.userId).name}
                  </div>
                  <ItemLink url={searchUrl(e.item, e.store)} label={`${e.item} at ${e.store}`}>
                    <div
                      style={{
                        fontSize: 17,
                        fontWeight: 700,
                        lineHeight: 1.15,
                        textDecoration: "underline",
                      }}
                    >
                      {e.store}
                    </div>
                    <div style={{ fontSize: 13, lineHeight: 1.2, opacity: 0.85 }}>
                      {e.item} · {e.time}
                    </div>
                  </ItemLink>
                </div>

                <div
                  style={{
                    width: 54,
                    height: 54,
                    flexShrink: 0,
                    boxSizing: "border-box",
                    borderRadius: "50%",
                    border: "3px solid #F5ECD9",
                    overflow: "hidden",
                    background: "#F5ECD9",
                  }}
                >
                  <Avatar who={e.userId} />
                </div>

                <div
                  style={{
                    flex: 1,
                    textAlign: left ? "left" : "right",
                    fontFamily: "var(--font-hand), cursive",
                    fontSize: 28,
                    lineHeight: 1,
                    color: "#F5ECD9",
                  }}
                >
                  {e.date}
                  <div style={{ fontSize: 20, color: "#EBB5BD", marginTop: 2 }}>{e.note}</div>
                </div>
              </div>
            );
          })}
        </div>
      </div>

      <div
        style={{
          position: "absolute",
          left: 44,
          top: 806,
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
