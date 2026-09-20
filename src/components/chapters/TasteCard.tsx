"use client";

import { Avatar } from "@/components/primitives/Avatar";
import { Grain } from "@/components/primitives/Glyphs";
import { ProductArt } from "@/components/primitives/ProductArt";
import { backendGroupId, getUser, users } from "@/data/users";
import { tasteMatch, tasteStats, tasteVennNotes } from "@/data/wrapped";
import type { UserId } from "@/lib/types";
import { useApp } from "@/state/store";

import { useTasteMatch } from "./tasteMatchStore";

const CARD_W = 720;
const CARD_H = 900;

/** Chapter 1 · Taste match — the Venn reveal. */
export function TasteCard() {
  const { viewerId } = useApp();

  // The pair and all three scores are computed by the backend off real item rows; only the copy
  // around them is written by the model. The seeded fixture stays as the fallback so a cold or
  // thin backend degrades to the old static card rather than to an empty chapter.
  const state = useTasteMatch(backendGroupId);
  // Avatars and the Venn art are keyed by the fixture roster, so a group whose ids this build
  // has no face for renders the fixture rather than crashing on a missing user.
  const match = state.status === "ready" ? state.match : null;
  const live =
    match && [...match.pair, ...match.disagreement.map((d) => d.userId)].every((id) => id in users)
      ? match
      : null;

  const [a, b] = (live ? live.pair : tasteMatch.pair) as [UserId, UserId];
  const tasteScore = live ? live.tasteScore : tasteMatch.tasteScore;
  const disagreement = live ? live.disagreement : tasteMatch.disagreement;
  const otherPairs = live ? live.otherPairs : tasteMatch.otherPairs;
  const footnote = live ? live.footnote : tasteMatch.footnote;
  const stats = live
    ? [
        { kicker: "Taste match", value: `${live.tasteScore}%`, note: live.notes.taste, bg: "#F5ECD9" },
        { kicker: "Budget match", value: `${live.budgetScore}%`, note: live.notes.budget, bg: "#A8DCC2" },
        { kicker: "Shopping rhythm", value: `${live.timingScore}%`, note: live.notes.timing, bg: "#F5E39B" },
      ]
    : tasteStats;

  // The AI picked the group's closest pair, which is not always a pair the viewer is in.
  const inPair = viewerId === a || viewerId === b;

  return (
    <div
      className="a-card"
      style={{
        position: "absolute",
        left: 360,
        top: 70,
        width: CARD_W,
        height: CARD_H,
        boxSizing: "border-box",
        borderRadius: 36,
        background: "#EBB5BD",
        color: "#141A47",
        overflow: "hidden",
        boxShadow: "0 40px 90px rgba(0,0,0,0.5)",
        padding: "38px 44px 30px",
        display: "flex",
        flexDirection: "column",
        justifyContent: "space-between",
      }}
    >
      <Grain w={CARD_W} h={CARD_H} id="grainTaste" />
      <div
        style={{
          position: "absolute",
          right: -110,
          top: -100,
          width: 320,
          height: 320,
          borderRadius: "50%",
          background: "#F5E39B",
          opacity: 0.55,
        }}
      />

      <div style={{ position: "relative", display: "flex", flexDirection: "column", gap: 6 }}>
        <div
          style={{
            display: "flex",
            justifyContent: "space-between",
            alignItems: "center",
            fontSize: 14,
            fontWeight: 700,
            letterSpacing: "0.16em",
            textTransform: "uppercase",
          }}
        >
          <div>Chapter 1 · Taste match</div>
          <div
            style={{
              fontFamily: "var(--font-hand), cursive",
              fontSize: 24,
              letterSpacing: 0,
              textTransform: "none",
              color: "#B8412F",
              transform: "rotate(-2deg)",
            }}
          >
            1 of 6 pairs. the AI picked this one.
          </div>
        </div>
        <div
          style={{
            fontFamily: "var(--font-display), Georgia, serif",
            fontSize: 62,
            lineHeight: 0.95,
            letterSpacing: "-0.02em",
          }}
        >
          Taste twins:{" "}
          <em style={{ color: "#B8412F" }}>
            {getUser(a).name} + {getUser(b).name}
          </em>
        </div>
      </div>

      {/* Venn */}
      <div style={{ position: "relative", height: 352 }}>
        <svg
          width="632"
          height="352"
          viewBox="0 0 632 352"
          style={{ position: "absolute", left: 0, top: 0 }}
          aria-hidden="true"
        >
          <defs>
            <clipPath id="clipTasteA">
              <circle cx="205" cy="176" r="172" />
            </clipPath>
          </defs>
          <circle cx="205" cy="176" r="172" fill="#F5ECD9" stroke="#141A47" strokeWidth="2.5" />
          <circle cx="427" cy="176" r="172" fill="#BBA9E8" stroke="#141A47" strokeWidth="2.5" />
          <circle cx="427" cy="176" r="172" fill="#E8806F" clipPath="url(#clipTasteA)" />
          <circle cx="205" cy="176" r="172" fill="none" stroke="#141A47" strokeWidth="2.5" />
          <circle cx="427" cy="176" r="172" fill="none" stroke="#141A47" strokeWidth="2.5" />
        </svg>

        <div
          className="a-fromL"
          style={{
            position: "absolute",
            left: 2,
            top: 0,
            width: 128,
            display: "flex",
            flexDirection: "column",
            alignItems: "center",
            gap: 4,
            transform: "rotate(-3deg)",
          }}
        >
          <div
            style={{
              width: 128,
              height: 138,
              boxSizing: "border-box",
              border: "3px solid #141A47",
              borderRadius: "64px 64px 18px 18px",
              overflow: "hidden",
              background: "#E8806F",
              boxShadow: "5px 5px 0 #141A47",
            }}
          >
            <Avatar who={a} />
          </div>
          <div style={{ fontSize: 14, fontWeight: 700, letterSpacing: "0.18em" }}>
            {getUser(a).name.toUpperCase()}
          </div>
        </div>

        <div
          className="a-fromR"
          style={{
            position: "absolute",
            right: 2,
            top: 0,
            width: 128,
            display: "flex",
            flexDirection: "column",
            alignItems: "center",
            gap: 4,
            transform: "rotate(3deg)",
          }}
        >
          <div
            style={{
              width: 128,
              height: 138,
              boxSizing: "border-box",
              border: "3px solid #141A47",
              borderRadius: "64px 64px 18px 18px",
              overflow: "hidden",
              background: "#BBA9E8",
              boxShadow: "5px 5px 0 #141A47",
            }}
          >
            <Avatar who={b} />
          </div>
          <div style={{ fontSize: 14, fontWeight: 700, letterSpacing: "0.18em" }}>
            {getUser(b).name.toUpperCase()}
          </div>
        </div>

        <FloatArt left={44} top={200} size={70} rotate={-8} kind={tasteVennNotes.left.items[0]} />
        <FloatArt left={132} top={246} size={68} rotate={8} kind={tasteVennNotes.left.items[1]} />
        <Scribble left={74} top={300} rotate={-4}>
          {tasteVennNotes.left.note}
        </Scribble>

        <FloatArt right={48} top={196} size={72} rotate={8} kind={tasteVennNotes.right.items[0]} />
        <FloatArt right={136} top={244} size={68} rotate={-8} kind={tasteVennNotes.right.items[1]} />
        <Scribble right={64} top={300} rotate={4}>
          {tasteVennNotes.right.note}
        </Scribble>

        <FloatArt left={268} top={22} size={96} height={76} rotate={-4} kind={tasteVennNotes.middle.top} />
        <div
          className="a-pop"
          style={{
            position: "absolute",
            left: 246,
            top: 116,
            width: 140,
            display: "flex",
            flexDirection: "column",
            alignItems: "center",
            transform: "rotate(-4deg)",
          }}
        >
          <div
            style={{
              fontFamily: "var(--font-display), Georgia, serif",
              fontSize: 78,
              lineHeight: 0.85,
              letterSpacing: "-0.03em",
            }}
          >
            {tasteScore}%
          </div>
          <div
            style={{
              fontSize: 13,
              fontWeight: 700,
              letterSpacing: "0.16em",
              textTransform: "uppercase",
            }}
          >
            Taste match
          </div>
        </div>
        <FloatArt left={276} top={250} size={80} rotate={6} kind={tasteVennNotes.middle.bottom} />
        <svg
          width="34"
          height="34"
          viewBox="0 0 60 60"
          style={{ position: "absolute", left: 228, top: 60 }}
          aria-hidden="true"
        >
          <path
            d="M30 2 l7 20 l20 8 l-20 8 l-7 20 l-7 -20 l-20 -8 l20 -8 z"
            fill="#F5E39B"
            stroke="#141A47"
            strokeWidth="3"
            strokeLinejoin="round"
          />
        </svg>
      </div>

      {/* three stats */}
      <div
        style={{
          position: "relative",
          display: "grid",
          gridTemplateColumns: "repeat(3, minmax(0, 1fr))",
          gap: 12,
        }}
      >
        {stats.map((s, i) => (
          <div
            key={s.kicker}
            style={{
              boxSizing: "border-box",
              padding: "10px 14px",
              border: "2px solid #141A47",
              borderRadius: 18,
              background: s.bg,
              boxShadow: "4px 4px 0 #141A47",
              transform: `rotate(${i === 1 ? 1 : -1}deg)`,
            }}
          >
            <div
              style={{
                fontSize: 12,
                fontWeight: 700,
                letterSpacing: "0.12em",
                textTransform: "uppercase",
              }}
            >
              {s.kicker}
            </div>
            <div
              style={{
                fontFamily: "var(--font-display), Georgia, serif",
                fontSize: 36,
                lineHeight: 1,
              }}
            >
              {s.value}
            </div>
            <div style={{ fontFamily: "var(--font-hand), cursive", fontSize: 21, lineHeight: 1 }}>
              {s.note}
            </div>
          </div>
        ))}
      </div>

      <div
        style={{
          position: "relative",
          fontSize: 21,
          lineHeight: 1.38,
          fontWeight: 500,
          textWrap: "pretty",
        }}
      >
        {live ? (
          live.lead
        ) : (
          <>
            {inPair ? "You both" : `${getUser(a).name} and ${getUser(b).name} both`} gravitate
            toward{" "}
            <strong style={{ fontWeight: 700 }}>
              silver jewelry, neutral basics, skincare,
            </strong>{" "}
            and <strong style={{ fontWeight: 700 }}>little drinks.</strong>
          </>
        )}
      </div>

      {/* disagreement */}
      <div
        style={{
          position: "relative",
          boxSizing: "border-box",
          padding: "14px 18px",
          borderRadius: "6px 22px 22px 22px",
          background: "#F5E39B",
          border: "2px solid #141A47",
          boxShadow: "5px 5px 0 #141A47",
          display: "flex",
          flexDirection: "column",
          gap: 8,
          transform: "rotate(-0.6deg)",
        }}
      >
        <div
          style={{
            fontFamily: "var(--font-hand), cursive",
            fontSize: 26,
            lineHeight: 1,
            color: "#B8412F",
          }}
        >
          one thing {inPair ? "you" : "they"} absolutely disagree on
        </div>
        <div style={{ display: "flex", gap: 18 }}>
          {disagreement.map((d) => (
            <div
              key={d.userId}
              style={{ display: "flex", gap: 10, alignItems: "flex-start", flex: 1 }}
            >
              <div
                style={{
                  width: 38,
                  height: 38,
                  flexShrink: 0,
                  borderRadius: "50%",
                  border: "2px solid #141A47",
                }}
              >
                <Avatar who={d.userId as UserId} />
              </div>
              <div style={{ fontSize: 15.5, lineHeight: 1.3 }}>
                <strong>{d.text.split(".")[0]}.</strong>
                {d.text.slice(d.text.indexOf(".") + 1)}
              </div>
            </div>
          ))}
        </div>
      </div>

      <div
        style={{
          position: "relative",
          display: "flex",
          justifyContent: "space-between",
          alignItems: "center",
          fontSize: 13.5,
          fontWeight: 500,
        }}
      >
        <div>{footnote}</div>
        <div style={{ display: "flex", gap: 8 }}>
          {otherPairs.map((p) => (
            <div
              key={p.pair.join("-")}
              style={{
                display: "flex",
                alignItems: "center",
                height: 32,
                padding: "0 12px",
                boxSizing: "border-box",
                border: "2px solid #141A47",
                borderRadius: 999,
                fontWeight: 700,
              }}
            >
              {getUser(p.pair[0] as UserId).name} + {getUser(p.pair[1] as UserId).name} {p.score}%
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}

function FloatArt({
  left,
  right,
  top,
  size,
  height,
  rotate,
  kind,
}: {
  left?: number;
  right?: number;
  top: number;
  size: number;
  height?: number;
  rotate: number;
  kind: Parameters<typeof ProductArt>[0]["kind"];
}) {
  return (
    <div
      style={{
        position: "absolute",
        left,
        right,
        top,
        width: size,
        height: height ?? size,
        transform: `rotate(${rotate}deg)`,
      }}
    >
      <ProductArt kind={kind} />
    </div>
  );
}

function Scribble({
  left,
  right,
  top,
  rotate,
  children,
}: {
  left?: number;
  right?: number;
  top: number;
  rotate: number;
  children: React.ReactNode;
}) {
  return (
    <div
      style={{
        position: "absolute",
        left,
        right,
        top,
        fontFamily: "var(--font-hand), cursive",
        fontSize: 22,
        lineHeight: 1,
        transform: `rotate(${rotate}deg)`,
      }}
    >
      {children}
    </div>
  );
}
