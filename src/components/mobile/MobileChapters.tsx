"use client";

import { AnimatePresence, motion } from "framer-motion";

import { Avatar } from "@/components/primitives/Avatar";
import { ItemLink } from "@/components/primitives/ItemLink";
import { ProductArt } from "@/components/primitives/ProductArt";
import { CommentComposer } from "@/components/comments/CommentComposer";
import { artForFind } from "@/components/commerce/findsStore";
import { useItemDetail } from "@/components/commerce/ItemDetailModal";
import { VisaTag, contributionChip, useGroupGiftThread } from "@/components/chapters/GiftCard";
import { DebateTranscript, debateOwner, useDebateThread } from "@/components/chapters/DebateCard";
import { useGroupDebate } from "@/components/chapters/debateStore";
import { Blob, MobileCta, MobileFrame } from "./MobileFrame";
import {
  birthdayTag,
  budgets,
  getProduct,
  giftProfiles,
  groupGifts,
  recommendationsFor,
} from "@/data/products";
import { backendGroupId, getUser, groupMembersExcept } from "@/data/users";
import {
  chainReaction,
  loreCases,
  matchaTimeline,
  skincareSync,
  spotlightOrder,
  spotlights,
  tasteMatch,
  tasteStats,
  closingTiles,
} from "@/data/wrapped";
import { formatPrice, searchUrl, shareOf } from "@/services/commerce";
import { useApp } from "@/state/store";
import type { GiftState } from "@/components/chapters/GiftCard";
import type { Debate } from "@/lib/apiTypes";
import type { UserId } from "@/lib/types";

const TAG_BG = ["#F5ECD9", "#EBB5BD", "#A8DCC2", "#BBA9E8", "#F5ECD9"];

/** Every chapter opens on this line, the same distance below the wordmark. */
const KICKER: React.CSSProperties = {
  position: "relative",
  marginTop: 14,
  fontSize: 12,
  fontWeight: 700,
  letterSpacing: "0.16em",
  textTransform: "uppercase",
};

/* ------------------------------------------------------------------ 1 */

export function MTaste() {
  const { viewerId } = useApp();
  const [a, b] = tasteMatch.pair;
  const inPair = viewerId === a || viewerId === b;

  return (
    <MobileFrame
      step={1}
      bg="#EBB5BD"
      grainId="grainMTaste"
      decor={<Blob color="#F5E39B" opacity={0.55} size={240} right={-90} top={-80} />}
    >
      <div style={KICKER}>Chapter 1 · Taste match</div>
      <div
        style={{
          position: "relative",
          fontFamily: "var(--font-display), Georgia, serif",
          fontSize: 46,
          lineHeight: 0.98,
          letterSpacing: "-0.025em",
          marginTop: 4,
        }}
      >
        Taste twins:{" "}
        <em style={{ color: "#B8412F" }}>
          {getUser(a).name} + {getUser(b).name}
        </em>
      </div>

      <div style={{ position: "relative", width: 358, height: 232, marginTop: 2 }}>
        <svg
          width="358"
          height="232"
          viewBox="0 0 358 232"
          style={{ position: "absolute", left: 0, top: 0 }}
          aria-hidden="true"
        >
          <defs>
            <clipPath id="clipMTaste">
              <circle cx="121" cy="114" r="98" />
            </clipPath>
          </defs>
          <circle cx="121" cy="114" r="98" fill="#F5ECD9" stroke="#141A47" strokeWidth="2.4" />
          <circle cx="237" cy="114" r="98" fill="#BBA9E8" stroke="#141A47" strokeWidth="2.4" />
          <circle cx="237" cy="114" r="98" fill="#E8806F" clipPath="url(#clipMTaste)" />
          <circle cx="121" cy="114" r="98" fill="none" stroke="#141A47" strokeWidth="2.4" />
          <path
            d="M172 40 l3 -9 l3 9 l9 3 l-9 3 l-3 9 l-3 -9 l-9 -3 z"
            fill="#F5E39B"
            stroke="#141A47"
            strokeWidth="1.6"
          />
        </svg>

        <div
          className="a-up"
          style={{
            position: "absolute",
            left: 41,
            top: 72,
            width: 80,
            height: 96,
            boxSizing: "border-box",
            border: "2.5px solid #141A47",
            borderRadius: "40px 40px 12px 12px",
            overflow: "hidden",
            background: "#F5ECD9",
            boxShadow: "4px 4px 0 #141A47",
            transform: "rotate(-4deg)",
          }}
        >
          <Avatar who={a} />
        </div>
        <div
          className="a-up"
          style={{
            position: "absolute",
            left: 237,
            top: 72,
            width: 80,
            height: 96,
            boxSizing: "border-box",
            border: "2.5px solid #141A47",
            borderRadius: "40px 40px 12px 12px",
            overflow: "hidden",
            background: "#F5ECD9",
            boxShadow: "4px 4px 0 #141A47",
            transform: "rotate(4deg)",
          }}
        >
          <Avatar who={b} />
        </div>
        <div
          style={{
            position: "absolute",
            left: 139,
            width: 80,
            top: 84,
            textAlign: "center",
            fontFamily: "var(--font-display), Georgia, serif",
            fontSize: 42,
            lineHeight: 1,
          }}
        >
          {tasteMatch.tasteScore}%
          <div
            style={{
              fontFamily: "var(--font-body), sans-serif",
              fontSize: 11,
              fontWeight: 700,
              letterSpacing: "0.12em",
              textTransform: "uppercase",
              marginTop: 2,
            }}
          >
            Match
          </div>
        </div>
        <div
          style={{
            position: "absolute",
            left: 30,
            top: 196,
            width: 100,
            fontFamily: "var(--font-hand), cursive",
            fontSize: 19,
            lineHeight: 0.95,
            transform: "rotate(-3deg)",
          }}
        >
          both love silver
        </div>
        <div
          style={{
            position: "absolute",
            right: 24,
            top: 200,
            width: 100,
            textAlign: "right",
            fontFamily: "var(--font-hand), cursive",
            fontSize: 19,
            lineHeight: 0.95,
            transform: "rotate(3deg)",
          }}
        >
          and tiny drinks
        </div>
      </div>

      <div style={{ position: "relative", display: "flex", gap: 8, marginTop: 6 }}>
        {tasteStats.map((s, i) => (
          <div
            key={s.kicker}
            style={{
              flex: 1,
              boxSizing: "border-box",
              padding: "8px 10px",
              border: "2px solid #141A47",
              borderRadius: 14,
              background: s.bg,
              boxShadow: "3px 3px 0 #141A47",
              transform: `rotate(${[-1.5, 1, -1][i]}deg)`,
            }}
          >
            <div
              style={{
                fontSize: 11,
                fontWeight: 700,
                letterSpacing: "0.12em",
                textTransform: "uppercase",
                color: "#B8412F",
              }}
            >
              {["Taste", "Budget", "Chaos"][i]}
            </div>
            <div
              style={{
                fontFamily: "var(--font-display), Georgia, serif",
                fontSize: 32,
                lineHeight: 1,
              }}
            >
              {s.value}
            </div>
            <div style={{ fontSize: 12.5 }}>{s.note}</div>
          </div>
        ))}
      </div>

      <div
        style={{
          position: "relative",
          marginTop: 14,
          fontSize: 16,
          lineHeight: 1.38,
          fontWeight: 500,
        }}
      >
        {tasteMatch.lead}
      </div>

      <div
        style={{
          position: "relative",
          marginTop: 14,
          boxSizing: "border-box",
          padding: "10px 14px 12px",
          background: "#F5E39B",
          border: "2px solid #141A47",
          borderRadius: 6,
          boxShadow: "4px 4px 0 #141A47",
          transform: "rotate(-1deg)",
        }}
      >
        <div
          style={{
            fontFamily: "var(--font-hand), cursive",
            fontSize: 21,
            lineHeight: 1,
            color: "#B8412F",
          }}
        >
          one thing {inPair ? "you" : "they"} absolutely disagree on
        </div>
        <div style={{ fontSize: 14.5, lineHeight: 1.35, marginTop: 4 }}>
          <b>Esh</b> shops 12 stores in 14 purchases. <b>Kristina</b> is committed to Sephora: 5
          visits.
        </div>
      </div>
    </MobileFrame>
  );
}

/* ------------------------------------------------------------------ 2 */

export function MSpot({
  who,
  onChange,
}: {
  who: UserId;
  onChange: (who: UserId) => void;
}) {
  const s = spotlights[who];

  return (
    <MobileFrame
      step={2}
      bg={s.bg}
      grainId="grainMSpot"
      decor={<Blob color="#F5ECD9" opacity={0.45} size={260} right={-80} top={120} />}
    >
      <div style={KICKER}>Chapter 2 · Spotlights</div>

      <AnimatePresence mode="wait">
        <motion.div
          key={who}
          initial={{ opacity: 0, y: 14 }}
          animate={{ opacity: 1, y: 0 }}
          exit={{ opacity: 0, y: -10 }}
          transition={{ duration: 0.24 }}
          style={{ position: "relative" }}
        >
          <div style={{ display: "flex", alignItems: "center", gap: 14, marginTop: 10 }}>
            <div
              style={{
                width: 92,
                height: 110,
                flexShrink: 0,
                boxSizing: "border-box",
                border: "3px solid #141A47",
                borderRadius: "46px 46px 14px 14px",
                overflow: "hidden",
                background: "#F5ECD9",
                boxShadow: "4px 4px 0 #141A47",
                transform: "rotate(-3deg)",
              }}
            >
              <Avatar who={who} />
            </div>
            <div>
              <div
                style={{
                  fontSize: 11.5,
                  fontWeight: 700,
                  letterSpacing: "0.14em",
                  textTransform: "uppercase",
                }}
              >
                {getUser(who).name}’s September era
              </div>
              <div
                style={{
                  fontFamily: "var(--font-display), Georgia, serif",
                  fontSize: 38,
                  lineHeight: 0.92,
                  letterSpacing: "-0.03em",
                  marginTop: 2,
                }}
              >
                {s.title} <em>{s.titleAccent}</em>
              </div>
            </div>
          </div>

          <div style={{ fontSize: 16, lineHeight: 1.36, fontWeight: 500, marginTop: 12 }}>
            {s.lead}
          </div>

          <div style={{ display: "flex", flexDirection: "column", gap: 10, marginTop: 14 }}>
            {s.stats.map((stat, i) => (
              <div
                key={stat.kicker}
                className="a-up"
                style={{
                  animationDelay: `${0.1 + i * 0.12}s`,
                  boxSizing: "border-box",
                  display: "flex",
                  alignItems: "center",
                  gap: 12,
                  padding: "10px 12px",
                  border: "2px solid #141A47",
                  borderRadius: 18,
                  background: "#F5ECD9",
                  boxShadow: "4px 4px 0 #141A47",
                  transform: `rotate(${[-0.6, 0.6, -0.4][i]}deg)`,
                }}
              >
                <div
                  style={{
                    width: 54,
                    height: 54,
                    flexShrink: 0,
                    borderRadius: "50%",
                    background: stat.bg,
                    border: "2px solid #141A47",
                    padding: stat.art ? 6 : 0,
                    boxSizing: "border-box",
                    display: "flex",
                    alignItems: "center",
                    justifyContent: "center",
                  }}
                >
                  {stat.art ? (
                    <ProductArt kind={stat.art} />
                  ) : (
                    <svg width="30" height="30" viewBox="0 0 100 100" aria-hidden="true">
                      <path d="M62 10 a42 42 0 1 0 28 62 a32 32 0 1 1 -28 -62 z" fill="#F5E39B" />
                    </svg>
                  )}
                </div>
                <div style={{ minWidth: 0 }}>
                  <div
                    style={{
                      fontSize: 10.5,
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
                      fontSize: stat.headline.length > 10 ? 24 : 32,
                      lineHeight: 0.98,
                    }}
                  >
                    {stat.headline}
                  </div>
                  <div style={{ fontSize: 13, lineHeight: 1.28 }}>{stat.body}</div>
                </div>
              </div>
            ))}
          </div>
        </motion.div>
      </AnimatePresence>

      <div
        role="group"
        aria-label="Choose a friend"
        style={{
          position: "absolute",
          left: 16,
          right: 16,
          top: 700,
          display: "flex",
          gap: 6,
        }}
      >
        {spotlightOrder.map((id) => {
          const on = id === who;
          return (
            <button
              key={id}
              type="button"
              onClick={() => onChange(id)}
              aria-pressed={on}
              style={{
                flex: 1,
                display: "flex",
                flexDirection: "column",
                alignItems: "center",
                gap: 3,
                padding: "5px 0 7px",
                border: "2px solid #141A47",
                borderRadius: 16,
                background: on ? "#141A47" : "rgba(245,236,217,0.65)",
                color: on ? "#F5ECD9" : "#141A47",
                fontSize: 11.5,
                fontWeight: 700,
                transition: "background .2s, color .2s",
              }}
            >
              <span
                style={{
                  width: 30,
                  height: 30,
                  borderRadius: "50%",
                  overflow: "hidden",
                  border: `2px solid ${on ? "#F5ECD9" : "#141A47"}`,
                  boxSizing: "border-box",
                }}
              >
                <Avatar who={id} />
              </span>
              {getUser(id).name}
            </button>
          );
        })}
      </div>
    </MobileFrame>
  );
}

/* ------------------------------------------------------------------ 3 */

export function MLore({
  caseId,
  onChange,
}: {
  caseId: string;
  onChange: (id: string) => void;
}) {
  const index = Math.max(0, loreCases.findIndex((c) => c.id === caseId));
  const c = loreCases[index];

  return (
    <div
      style={{
        position: "relative",
        width: 390,
        height: 844,
        boxSizing: "border-box",
        overflow: "hidden",
        background: "#141A47",
        color: "#F5ECD9",
        padding: "0 16px",
      }}
    >
      <svg
        width="390"
        height="844"
        viewBox="0 0 390 844"
        style={{ position: "absolute", left: 0, top: 0, pointerEvents: "none" }}
        aria-hidden="true"
      >
        <defs>
          <pattern id="dotsMLore" width="28" height="28" patternUnits="userSpaceOnUse">
            <circle cx="2" cy="2" r="1.4" fill="#F5ECD9" fillOpacity="0.13" />
          </pattern>
        </defs>
        <rect width="390" height="844" fill="url(#dotsMLore)" />
      </svg>

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
              background: n <= 3 ? "#F5ECD9" : "rgba(245,236,217,0.25)",
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
          Un<em style={{ color: "#EBB5BD" }}>wrap</em>
        </div>
        <div style={{ fontSize: 13, fontWeight: 700, letterSpacing: "0.14em" }}>3 / 4</div>
      </div>

      <div
        style={{
          ...KICKER,
          display: "flex",
          justifyContent: "space-between",
          alignItems: "center",
          fontSize: 11.5,
          letterSpacing: "0.14em",
        }}
      >
        <div>Chapter 3 · Group lore</div>
        <div style={{ padding: "3px 8px", border: "2px solid #F5ECD9", borderRadius: 5 }}>
          Case {c.index} / 03
        </div>
      </div>

      <AnimatePresence mode="wait">
        <motion.div
          key={c.id}
          initial={{ opacity: 0, y: 14 }}
          animate={{ opacity: 1, y: 0 }}
          exit={{ opacity: 0, y: -10 }}
          transition={{ duration: 0.24 }}
          style={{ position: "relative" }}
        >
          <div
            style={{
              display: "inline-flex",
              alignItems: "center",
              gap: 6,
              height: 24,
              padding: "0 10px 0 7px",
              boxSizing: "border-box",
              borderRadius: 999,
              background: "#F5E39B",
              color: "#141A47",
              fontSize: 11,
              fontWeight: 700,
              letterSpacing: "0.08em",
              textTransform: "uppercase",
              marginTop: 10,
            }}
          >
            <svg width="12" height="12" viewBox="0 0 26 26" aria-hidden="true">
              <path
                d="M13 1 l3.4 8.6 L25 13 l-8.6 3.4 L13 25 l-3.4 -8.6 L1 13 l8.6 -3.4 z"
                fill="#141A47"
              />
            </svg>
            Spotted by the AI
          </div>

          <div
            style={{
              fontFamily: "var(--font-display), Georgia, serif",
              fontSize: 44,
              lineHeight: 0.92,
              letterSpacing: "-0.03em",
              marginTop: 8,
            }}
          >
            {c.title}{" "}
            <em style={{ color: ["#A8DCC2", "#EBB5BD", "#BBA9E8"][index] }}>{c.titleAccent}</em>
          </div>
          <div
            style={{
              fontFamily: "var(--font-hand), cursive",
              fontSize: 22,
              lineHeight: 1.05,
              color: "#F5E39B",
              marginTop: 8,
            }}
          >
            {c.subtitle}
          </div>

          <div style={{ marginTop: 14, display: "flex", flexDirection: "column", gap: 8 }}>
            {index === 0 &&
              matchaTimeline.slice(0, 5).map((e, i) => (
                <div
                  key={`${e.userId}-${e.date}`}
                  className="a-pin"
                  style={{
                    animationDelay: `${0.2 + i * 0.16}s`,
                    display: "flex",
                    alignItems: "center",
                    gap: 10,
                    padding: "7px 12px 8px 8px",
                    border: "2px solid #F5ECD9",
                    borderRadius: 14,
                    background: ["#A8DCC2", "#EBB5BD", "#BBA9E8", "#F5E39B"][i % 4],
                    color: "#141A47",
                    transform: `rotate(${i % 2 ? 0.6 : -0.6}deg)`,
                  }}
                >
                  <div
                    style={{
                      width: 40,
                      height: 40,
                      flexShrink: 0,
                      borderRadius: "50%",
                      overflow: "hidden",
                      border: "2px solid #141A47",
                      boxSizing: "border-box",
                    }}
                  >
                    <Avatar who={e.userId} />
                  </div>
                  <ItemLink
                    url={searchUrl(e.item, e.store)}
                    label={`${e.item} at ${e.store}`}
                    style={{ flex: 1, minWidth: 0 }}
                  >
                    <div
                      style={{
                        fontSize: 15,
                        fontWeight: 700,
                        lineHeight: 1.1,
                        textDecoration: "underline",
                      }}
                    >
                      {e.store}
                    </div>
                    <div style={{ fontSize: 12, opacity: 0.85 }}>
                      {getUser(e.userId).name} · {e.time}
                    </div>
                  </ItemLink>
                  <div
                    style={{
                      fontFamily: "var(--font-hand), cursive",
                      fontSize: 20,
                      lineHeight: 1,
                      textAlign: "right",
                    }}
                  >
                    {e.date}
                  </div>
                </div>
              ))}

            {index === 1 && <MSkinCards />}

            {index === 2 &&
              chainReaction.map((n, i) => (
                <div
                  key={n.userId}
                  className="a-drop"
                  style={{
                    animationDelay: `${0.2 + i * 0.22}s`,
                    marginLeft: i * 14,
                    display: "flex",
                    alignItems: "center",
                    gap: 10,
                    padding: "7px 12px 7px 8px",
                    border: "2px solid #F5ECD9",
                    borderRadius: 14,
                    background: n.bg,
                    color: "#141A47",
                  }}
                >
                  <ItemLink
                    url={searchUrl(n.title, null)}
                    label={n.title}
                    style={{
                      display: "flex",
                      alignItems: "center",
                      gap: 10,
                      flex: 1,
                      minWidth: 0,
                    }}
                  >
                    <div
                      style={{
                        width: 42,
                        height: 42,
                        flexShrink: 0,
                        borderRadius: "50%",
                        border: "2px solid #141A47",
                        background: "#F5ECD9",
                        boxSizing: "border-box",
                        padding: 4,
                      }}
                    >
                      {n.art !== "socks" && <ProductArt kind={n.art} />}
                    </div>
                    <div style={{ flex: 1, minWidth: 0 }}>
                      <div
                        style={{
                          fontSize: 10,
                          fontWeight: 700,
                          letterSpacing: "0.1em",
                          textTransform: "uppercase",
                          color: "#B8412F",
                        }}
                      >
                        {n.kicker}
                      </div>
                      <div
                        style={{
                          fontFamily: "var(--font-display), Georgia, serif",
                          fontSize: 21,
                          lineHeight: 1,
                        }}
                      >
                        {n.title}
                      </div>
                      <div style={{ fontSize: 12 }}>{n.when}</div>
                    </div>
                  </ItemLink>
                  {n.gap && (
                    <div
                      style={{
                        fontFamily: "var(--font-hand), cursive",
                        fontSize: 17,
                        color: "#B8412F",
                        whiteSpace: "nowrap",
                      }}
                    >
                      {n.gap}
                    </div>
                  )}
                </div>
              ))}
          </div>

          <div
            style={{
              fontFamily: "var(--font-hand), cursive",
              fontSize: 19,
              lineHeight: 1,
              opacity: 0.85,
              marginTop: 12,
            }}
          >
            {c.evidence}
          </div>
        </motion.div>
      </AnimatePresence>

      <div
        role="group"
        aria-label="Choose a case file"
        style={{
          position: "absolute",
          left: 16,
          right: 16,
          top: 700,
          display: "flex",
          gap: 6,
        }}
      >
        {loreCases.map((lc) => {
          const on = lc.id === caseId;
          return (
            <button
              key={lc.id}
              type="button"
              onClick={() => onChange(lc.id)}
              aria-pressed={on}
              style={{
                flex: 1,
                height: 44,
                border: "2px solid #F5ECD9",
                borderRadius: 999,
                background: on ? "#F5ECD9" : "transparent",
                color: on ? "#141A47" : "#F5ECD9",
                fontSize: 12,
                fontWeight: 700,
                transition: "background .2s, color .2s",
              }}
            >
              {lc.tab}
            </button>
          );
        })}
      </div>
    </div>
  );
}

function MSkinCards() {
  return (
    <div style={{ display: "flex", gap: 8 }}>
      {skincareSync.map((s, i) => (
        <div
          key={s.userId}
          className="a-drop"
          style={{
            animationDelay: `${0.2 + i * 0.3}s`,
            flex: 1,
            boxSizing: "border-box",
            padding: "8px 8px 10px",
            border: "2px solid #F5ECD9",
            borderRadius: 14,
            background: s.bg,
            color: "#141A47",
            textAlign: "center",
            transform: `rotate(${[-1.5, 1, -1][i]}deg)`,
          }}
        >
          <ItemLink url={searchUrl(s.item, s.merchant)} label={`${s.item} at ${s.merchant}`}>
            <div
              style={{
                width: 62,
                height: 62,
                margin: "0 auto 4px",
                boxSizing: "border-box",
                border: "2px solid #141A47",
                borderRadius: "50%",
                background: "#F5ECD9",
                padding: 6,
              }}
            >
              <ProductArt kind={s.art} />
            </div>
            <div
              style={{
                fontFamily: "var(--font-display), Georgia, serif",
                fontSize: 16,
                lineHeight: 1.05,
              }}
            >
              {s.item}
            </div>
            <div
              style={{
                fontSize: 11,
                fontWeight: 600,
                marginTop: 2,
                textDecoration: "underline",
              }}
            >
              {s.merchant}
            </div>
          </ItemLink>
          <div
            style={{
              fontFamily: "var(--font-hand), cursive",
              fontSize: 16,
              color: "#B8412F",
            }}
          >
            {s.when}
          </div>
        </div>
      ))}
    </div>
  );
}

/* ------------------------------------------------------------------ 4 */

export function MGift({
  state,
  setState,
  onBuy,
}: {
  state: GiftState;
  setState: (next: GiftState) => void;
  onBuy: (input: {
    productId: string;
    forUserId: UserId;
    amountCentsOverride?: number;
    inspiredByUserId?: UserId;
    threadId?: string;
  }) => void;
}) {
  const { viewerId } = useApp();
  const { openItem } = useItemDetail();
  const person = getUser(state.who);
  const profile = giftProfiles[state.who];
  const isGroup = state.budget === "group";
  const recs = isGroup ? [] : recommendationsFor(state.who, state.budget);
  const gift = groupGifts[state.who];
  const groupProduct = getProduct(gift.productId);
  const each = shareOf(groupProduct.priceCents, gift.splitWays);

  // Same live thread the desktop card reads, so the mobile approve is the real pull.
  const { thread } = useGroupGiftThread(state.who);
  const mine = thread?.contributions.find((c) => c.userId === viewerId) ?? null;
  const canApprove = thread?.state === "collecting" && mine?.status === "pending";
  const myShare = mine?.amountCents ?? each;

  // Same rule as the desktop card: a live thread's locked pick and remaining contributors win
  // over the catalogue product, so the headline cannot disagree with the chips.
  const potCents =
    thread?.picks.find((p) => p.id === thread.winningPickId)?.priceCents ??
    groupProduct.priceCents;
  // A thread that is still `picking` has no contributions yet, so it cannot say how the pot
  // divides; fall back to the catalogue estimate until the shares are actually written.
  const stillIn =
    thread?.contributions.filter((c) => c.status !== "opted_out" && c.status !== "removed") ?? [];
  const splitWays = stillIn.length > 0 ? stillIn.length : gift.splitWays;

  return (
    <MobileFrame
      step={4}
      bg="#F5E39B"
      grainId="grainMGift"
      decor={
        <>
          <Blob color="#EBB5BD" opacity={0.7} size={240} right={-90} top={-70} />
          <Blob color="#A8DCC2" opacity={0.55} size={260} left={-100} bottom={-110} />
        </>
      }
    >
      <div style={KICKER}>Chapter 4 · Gift mode</div>

      <div
        style={{
          position: "relative",
          display: "flex",
          gap: 14,
          alignItems: "center",
          marginTop: 8,
        }}
      >
        <div
          style={{
            width: 76,
            height: 92,
            flexShrink: 0,
            boxSizing: "border-box",
            border: "3px solid #141A47",
            borderRadius: "38px 38px 12px 12px",
            overflow: "hidden",
            background: "#F5ECD9",
            boxShadow: "4px 4px 0 #141A47",
            transform: "rotate(-3deg)",
          }}
        >
          <Avatar who={state.who} />
        </div>
        <div>
          <div
            style={{
              fontSize: 11.5,
              fontWeight: 700,
              letterSpacing: "0.14em",
              textTransform: "uppercase",
              color: "#B8412F",
            }}
          >
            Shopping for {person.name}
          </div>
          <div
            style={{
              fontFamily: "var(--font-display), Georgia, serif",
              fontSize: 36,
              lineHeight: 1,
              letterSpacing: "-0.02em",
            }}
          >
            {person.name}’s <em>gift profile</em>
          </div>
          <div
            style={{
              fontFamily: "var(--font-hand), cursive",
              fontSize: 19,
              lineHeight: 1,
              marginTop: 2,
            }}
          >
            the AI read {profile.purchaseCount} purchases:
          </div>
        </div>
      </div>

      {/* friend switcher */}
      <div style={{ position: "relative", display: "flex", gap: 6, marginTop: 12 }}>
        {groupMembersExcept(viewerId).map((id) => {
          const on = id === state.who;
          return (
            <button
              key={id}
              type="button"
              onClick={() => setState({ ...state, who: id, item: -1 })}
              aria-pressed={on}
              style={{
                flex: 1,
                height: 34,
                border: "2px solid #141A47",
                borderRadius: 999,
                background: on ? "#141A47" : "#F5ECD9",
                color: on ? "#F5ECD9" : "#141A47",
                fontSize: 12.5,
                fontWeight: 700,
                transition: "background .2s, color .2s",
              }}
            >
              {getUser(id).name}
            </button>
          );
        })}
      </div>

      <div
        style={{
          position: "relative",
          display: "flex",
          flexWrap: "wrap",
          gap: 6,
          marginTop: 10,
        }}
      >
        {profile.tags.map((t, i) => (
          <span
            key={t}
            style={{
              display: "inline-flex",
              alignItems: "center",
              height: 28,
              padding: "0 11px",
              boxSizing: "border-box",
              border: "2px solid #141A47",
              borderRadius: 999,
              background: t === birthdayTag(state.who) ? "#E8806F" : TAG_BG[i % 5],
              fontSize: 13,
              fontWeight: 600,
              boxShadow: "2px 2px 0 #141A47",
            }}
          >
            {t}
          </span>
        ))}
      </div>

      <div style={{ position: "relative", display: "flex", gap: 6, marginTop: 14 }}>
        {budgets.map((b) => {
          const on = b.key === state.budget;
          return (
            <button
              key={b.key}
              type="button"
              onClick={() => setState({ ...state, budget: b.key, item: -1 })}
              aria-pressed={on}
              style={{
                flex: 1,
                height: 40,
                boxSizing: "border-box",
                border: "2px solid #141A47",
                borderRadius: 999,
                background: on ? "#141A47" : "#F5ECD9",
                color: on ? "#F5ECD9" : "#141A47",
                fontSize: 12.5,
                fontWeight: 700,
                whiteSpace: "nowrap",
                transition: "background .2s, color .2s",
              }}
            >
              {b.key === "u50" ? "$25–50" : b.key === "u100" ? "$50–100" : b.label}
            </button>
          );
        })}
      </div>

      {!isGroup && (
        <div
          style={{
            position: "relative",
            display: "flex",
            flexDirection: "column",
            gap: 12,
            marginTop: 14,
          }}
        >
          {recs.map((r, i) => {
            const p = getProduct(r.productId);
            return (
              <div
                key={r.id}
                className="a-up"
                style={{
                  animationDelay: `${i * 0.1}s`,
                  position: "relative",
                  display: "flex",
                  gap: 12,
                  boxSizing: "border-box",
                  padding: 10,
                  border: "2px solid #141A47",
                  borderRadius: 22,
                  background: "#F5ECD9",
                  boxShadow: "4px 4px 0 #141A47",
                }}
              >
                <div style={{ width: 84, flexShrink: 0 }}>
                  <ItemLink
                    url={p.url}
                    label={`${p.title} at ${p.merchant}`}
                    onActivate={() => openItem({ kind: "product", id: p.id })}
                    style={{
                      width: 84,
                      height: 84,
                      boxSizing: "border-box",
                      border: "2px solid #141A47",
                      borderRadius: 16,
                      background: p.bg,
                      padding: 8,
                    }}
                  >
                    <ProductArt kind={p.art} />
                  </ItemLink>
                  <div
                    style={{
                      fontFamily: "var(--font-display), Georgia, serif",
                      fontSize: 30,
                      lineHeight: 1,
                      textAlign: "center",
                      marginTop: 6,
                    }}
                  >
                    {formatPrice(p.priceCents)}
                  </div>
                </div>
                <div style={{ flex: 1, minWidth: 0 }}>
                  <ItemLink
                    url={p.url}
                    label={`${p.title} at ${p.merchant}`}
                    onActivate={() => openItem({ kind: "product", id: p.id })}
                    style={{
                      fontFamily: "var(--font-display), Georgia, serif",
                      fontSize: 22,
                      lineHeight: 1,
                    }}
                  >
                    {p.title}
                  </ItemLink>
                  <div
                    style={{
                      display: "flex",
                      alignItems: "center",
                      gap: 6,
                      marginTop: 4,
                      fontSize: 12.5,
                    }}
                  >
                    <b>{p.merchant}</b>
                    <VisaTag />
                  </div>
                  <div style={{ fontSize: 12.5, lineHeight: 1.3, marginTop: 4 }}>
                    <b
                      style={{
                        fontSize: 10,
                        letterSpacing: "0.1em",
                        textTransform: "uppercase",
                        color: "#B8412F",
                      }}
                    >
                      Behavior{" "}
                    </b>
                    {r.behavior}
                  </div>
                  <div style={{ fontSize: 12.5, lineHeight: 1.3, marginTop: 3 }}>
                    <b
                      style={{
                        fontSize: 10,
                        letterSpacing: "0.1em",
                        textTransform: "uppercase",
                        color: "#B8412F",
                      }}
                    >
                      Friend signal{" "}
                    </b>
                    {r.signal}
                  </div>
                  <div style={{ display: "flex", justifyContent: "flex-end", marginTop: 6 }}>
                    <button
                      type="button"
                      onClick={() =>
                        onBuy({ productId: p.id, forUserId: state.who })
                      }
                      style={{
                        height: 32,
                        padding: "0 16px",
                        border: 0,
                        borderRadius: 999,
                        background: "#141A47",
                        color: "#F5ECD9",
                        fontSize: 13.5,
                        fontWeight: 700,
                      }}
                    >
                      View gift
                    </button>
                  </div>
                </div>
              </div>
            );
          })}
        </div>
      )}

      {isGroup && (
        <div
          className="a-up"
          style={{
            position: "relative",
            marginTop: 14,
            boxSizing: "border-box",
            padding: 12,
            border: "2px solid #141A47",
            borderRadius: 22,
            background: "#F5ECD9",
            boxShadow: "4px 4px 0 #141A47",
          }}
        >
          <div
            style={{
              display: "flex",
              alignItems: "center",
              height: 32,
              padding: "0 12px",
              boxSizing: "border-box",
              border: "2px solid #141A47",
              borderRadius: 999,
              background: gift.bannerBg,
              fontSize: 13,
              fontWeight: 700,
            }}
          >
            {gift.banner}
          </div>
          <div style={{ display: "flex", gap: 12, marginTop: 10 }}>
            <ItemLink
              url={groupProduct.url}
              label={`${groupProduct.title} at ${groupProduct.merchant}`}
              onActivate={() => openItem({ kind: "product", id: groupProduct.id })}
              style={{
                width: 96,
                height: 96,
                flexShrink: 0,
                boxSizing: "border-box",
                border: "2px solid #141A47",
                borderRadius: 16,
                background: groupProduct.bg,
                padding: 8,
              }}
            >
              <ProductArt kind={groupProduct.art} />
            </ItemLink>
            <div style={{ flex: 1, minWidth: 0 }}>
              <ItemLink
                url={groupProduct.url}
                label={`${groupProduct.title} at ${groupProduct.merchant}`}
                onActivate={() => openItem({ kind: "product", id: groupProduct.id })}
                style={{
                  fontFamily: "var(--font-display), Georgia, serif",
                  fontSize: 22,
                  lineHeight: 1,
                }}
              >
                {groupProduct.title}
              </ItemLink>
              <div style={{ fontSize: 12.5, marginTop: 4 }}>
                {formatPrice(potCents)} total, split {splitWays} ways
              </div>
              <div
                style={{
                  fontFamily: "var(--font-display), Georgia, serif",
                  fontSize: 38,
                  lineHeight: 0.95,
                  color: "#B8412F",
                }}
              >
                {formatPrice(myShare)}{" "}
                <span style={{ fontSize: 18, color: "#141A47" }}>
                  {thread ? "yours" : "each"}
                </span>
              </div>
            </div>
          </div>
          {thread && (
            <div style={{ display: "flex", gap: 6, marginTop: 10 }}>
              {thread.contributions.map((c) => {
                const chip = contributionChip(c);
                return (
                  <div
                    key={c.userId}
                    style={{
                      flex: 1,
                      padding: "5px 8px",
                      boxSizing: "border-box",
                      border: "2px solid #141A47",
                      borderRadius: 14,
                      background: chip.bg,
                      fontSize: 11,
                      lineHeight: 1.2,
                      transition: "background .3s",
                    }}
                  >
                    <div style={{ fontWeight: 700 }}>
                      {c.userId === viewerId ? "You" : c.name}
                    </div>
                    <div>{chip.status}</div>
                  </div>
                );
              })}
            </div>
          )}
          <button
            type="button"
            onClick={() =>
              onBuy({
                productId: groupProduct.id,
                forUserId: state.who,
                amountCentsOverride: thread ? myShare : each,
                ...(thread ? { threadId: thread.id } : {}),
              })
            }
            disabled={Boolean(thread) && !canApprove && mine?.status !== "failed"}
            style={{
              marginTop: 10,
              width: "100%",
              height: 48,
              border: "2px solid #141A47",
              borderRadius: 999,
              background: "#141A47",
              color: "#F5ECD9",
              fontSize: 15,
              fontWeight: 700,
              boxShadow: "3px 3px 0 #B8412F",
              opacity: Boolean(thread) && !canApprove && mine?.status !== "failed" ? 0.55 : 1,
            }}
          >
            {thread && !canApprove && mine?.status !== "failed"
              ? thread.state === "funded"
                ? `Funded · push ${thread.pushStatus ?? "pending"}`
                : `Your ${formatPrice(myShare)} is ${mine ? mine.status : "not requested"}`
              : `Approve your ${formatPrice(thread ? myShare : each)} share`}
          </button>
        </div>
      )}
    </MobileFrame>
  );
}

/* ------------------------------------------------------------------ 5 */

export function MDebate() {
  const state = useGroupDebate(backendGroupId);

  return (
    <MobileFrame
      step={5}
      bg="#BBA9E8"
      grainId="grainMDebate"
      decor={<Blob color="#F5E39B" opacity={0.5} size={250} right={-100} top={-90} />}
    >
      <div style={KICKER}>Chapter 5 · The group chat</div>
      {state.status === "ready" ? (
        <MDebateBody debate={state.debate} />
      ) : (
        <div style={{ position: "relative", marginTop: 40, fontSize: 15, opacity: 0.6 }}>
          {state.status === "empty"
            ? "Nothing has been argued about yet."
            : "Reading the group chat…"}
        </div>
      )}
    </MobileFrame>
  );
}

function MDebateBody({ debate }: { debate: Debate }) {
  const { rows, count, send } = useDebateThread(debate);
  const owner = debateOwner(debate);

  return (
    <div
      style={{
        position: "relative",
        // The frame's header eats the first 66px; the rest is this card's to divide.
        height: 744,
        display: "flex",
        flexDirection: "column",
        // Clears the demo viewer pill, which is fixed to the window at bottom-left and would
        // otherwise sit on top of the composer's avatar.
        paddingBottom: 52,
        boxSizing: "border-box",
      }}
    >
      <h2
        style={{
          margin: "10px 0 0",
          fontFamily: "var(--font-display), Georgia, serif",
          fontSize: 38,
          lineHeight: 0.96,
          fontWeight: 400,
          letterSpacing: "-0.02em",
        }}
      >
        The most <em style={{ color: "#B8412F" }}>debated</em>
        <br />
        buy of the month
      </h2>

      <div
        style={{
          display: "flex",
          alignItems: "center",
          gap: 12,
          marginTop: 14,
          padding: 10,
          background: "#F5ECD9",
          border: "2px solid #141A47",
          borderRadius: 16,
          boxShadow: "4px 4px 0 #141A47",
        }}
      >
        <div
          style={{
            width: 52,
            height: 52,
            flexShrink: 0,
            borderRadius: 11,
            overflow: "hidden",
            border: "2px solid #141A47",
            background: owner ? getUser(owner).color : "#FBF6EA",
            padding: 5,
            boxSizing: "border-box",
          }}
        >
          <ProductArt
            kind={artForFind({ id: debate.itemId, category: debate.category })}
            src={debate.imageUrl ?? undefined}
          />
        </div>
        <div style={{ minWidth: 0, flex: 1 }}>
          <div
            style={{
              fontSize: 15.5,
              fontWeight: 800,
              lineHeight: 1.15,
              overflow: "hidden",
              textOverflow: "ellipsis",
              whiteSpace: "nowrap",
            }}
          >
            {debate.name}
          </div>
          <div style={{ marginTop: 2, fontSize: 12, fontWeight: 600, opacity: 0.66 }}>
            {count} messages · {debate.participants.length} arguing ·{" "}
            {Math.max(1, debate.spanDays)} days
          </div>
        </div>
        {debate.priceCents !== null && (
          <div style={{ fontSize: 15, fontWeight: 800, flexShrink: 0 }}>
            {formatPrice(debate.priceCents)}
          </div>
        )}
      </div>

      <div
        style={{
          display: "flex",
          gap: 9,
          marginTop: 10,
          padding: "10px 13px",
          background: "#141A47",
          color: "#F5ECD9",
          borderRadius: 15,
        }}
      >
        <span
          aria-hidden="true"
          style={{
            fontFamily: "var(--font-display), Georgia, serif",
            fontSize: 32,
            lineHeight: 0.8,
            color: "#F5E39B",
          }}
        >
          “
        </span>
        <div>
          <div
            style={{
              fontSize: 9.5,
              fontWeight: 700,
              letterSpacing: "0.16em",
              textTransform: "uppercase",
              opacity: 0.6,
            }}
          >
            The verdict
          </div>
          <div style={{ marginTop: 2, fontSize: 13, fontWeight: 600, lineHeight: 1.32 }}>
            {debate.verdict}
          </div>
        </div>
      </div>

      <DebateTranscript rows={rows} gap={7} indent={20} />

      <CommentComposer onSend={send} label="Join the debate" placeholder="Weigh in…" compact />
    </div>
  );
}

/* ------------------------------------------------------------------ 6 */

export function MClosing({ onReplay }: { onReplay: () => void }) {
  return (
    <MobileFrame
      step={6}
      bg="#F5ECD9"
      grainId="grainMClosing"
      decor={
        <>
          <Blob color="#BBA9E8" opacity={0.5} size={240} right={-80} top={-80} />
          <Blob color="#EBB5BD" opacity={0.5} size={240} left={-90} bottom={40} />
        </>
      }
    >
      <div style={KICKER}>September issue · The end</div>

      <div style={{ position: "relative", display: "flex", marginTop: 22, paddingLeft: 4 }}>
        {(["kristina", "esh", "sabina", "madhav"] as UserId[]).map((id, i) => (
          <div
            key={id}
            style={{
              width: 66,
              height: 66,
              borderRadius: "50%",
              border: "3px solid #F5ECD9",
              marginLeft: i === 0 ? 0 : -14,
              transform: `rotate(${[-6, 3, -3, 6][i]}deg)`,
            }}
          >
            <Avatar who={id} />
          </div>
        ))}
      </div>

      <div
        style={{
          position: "relative",
          fontFamily: "var(--font-display), Georgia, serif",
          fontSize: 54,
          lineHeight: 0.92,
          letterSpacing: "-0.025em",
          marginTop: 20,
        }}
      >
        Same friends.
        <br />
        <em style={{ color: "#C4553F" }}>Different carts.</em>
        <br />
        See you next month.
      </div>

      <div
        style={{
          position: "relative",
          fontSize: 12,
          fontWeight: 700,
          letterSpacing: "0.14em",
          textTransform: "uppercase",
          marginTop: 24,
        }}
      >
        Pick a chapter to share
      </div>
      <div
        style={{
          position: "relative",
          display: "grid",
          gridTemplateColumns: "1fr 1fr",
          gap: 8,
          marginTop: 8,
        }}
      >
        {closingTiles.map((t, i) => (
          <div
            key={t.n}
            style={{
              // An odd tile count would leave a hole in the two-up grid, so the last one widens.
              gridColumn:
                i === closingTiles.length - 1 && closingTiles.length % 2 === 1 ? "span 2" : "span 1",
              height: 80,
              padding: "10px 12px",
              boxSizing: "border-box",
              display: "flex",
              flexDirection: "column",
              justifyContent: "space-between",
              border: "2px solid #141A47",
              borderRadius: 16,
              background: t.bg,
              color: t.fg,
            }}
          >
            <span
              style={{
                fontSize: 10.5,
                fontWeight: 700,
                letterSpacing: "0.14em",
                textTransform: "uppercase",
                opacity: 0.8,
              }}
            >
              {t.n}
            </span>
            <span
              style={{
                fontFamily: "var(--font-display), Georgia, serif",
                fontSize: 22,
                lineHeight: 1,
              }}
            >
              {t.title}
            </span>
          </div>
        ))}
      </div>

      {/* Sits on the same line as the other chapters' bottom controls, so the
          reaction rail below it never gets covered. */}
      <MobileCta label="Replay Wrapped" onClick={onReplay} top={700} />
    </MobileFrame>
  );
}
