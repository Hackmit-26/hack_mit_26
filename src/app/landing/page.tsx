"use client";

import { motion } from "framer-motion";
import Link from "next/link";

import { Avatar } from "@/components/primitives/Avatar";
import { ArrowRight, Lock, Sparkle } from "@/components/primitives/Glyphs";
import { ProductArt } from "@/components/primitives/ProductArt";
import { group, userList } from "@/data/users";
import { storyChapters } from "@/data/chapters";

/**
 * Landing. The hook from the demo script, the group you're already in, and
 * one way in. Built from the same system as the cards: midnight ground,
 * cream paper, ink outlines, hard offset shadows.
 */
export default function LandingPage() {
  return (
    <main
      style={{
        minHeight: "100dvh",
        background: "#0B0F2A",
        color: "#F5ECD9",
        position: "relative",
        overflow: "hidden",
        padding: "clamp(20px, 5vw, 56px)",
        boxSizing: "border-box",
      }}
    >
      {/* the same blurred blobs as the story shell */}
      <div style={blob("#BBA9E8", 0.22, 110, { left: "-12%", top: "-18%", size: "42vw" })} />
      <div style={blob("#E8806F", 0.2, 120, { right: "-14%", bottom: "-22%", size: "46vw" })} />
      <div style={blob("#4A56FF", 0.16, 90, { right: "12%", top: "6%", size: "18vw" })} />

      <header
        style={{
          position: "relative",
          display: "flex",
          alignItems: "center",
          justifyContent: "space-between",
          gap: 16,
          flexWrap: "wrap",
        }}
      >
        <div style={{ display: "flex", alignItems: "center", gap: 12 }}>
          <Sparkle size={26} />
          <div
            style={{
              fontFamily: "var(--font-display), Georgia, serif",
              fontSize: "clamp(26px, 3.4vw, 34px)",
              lineHeight: 1,
            }}
          >
            Shop <em style={{ color: "#EBB5BD" }}>Wrapped</em>
          </div>
        </div>
        <Link
          href="/join"
          style={{
            fontSize: 15,
            fontWeight: 600,
            color: "rgba(245,236,217,0.8)",
            borderBottom: "1px solid rgba(245,236,217,0.35)",
            paddingBottom: 2,
          }}
        >
          Have an invite link?
        </Link>
      </header>

      <div
        style={{
          position: "relative",
          maxWidth: 1180,
          margin: "0 auto",
          paddingTop: "clamp(36px, 7vh, 88px)",
          display: "grid",
          gridTemplateColumns: "minmax(0, 1.15fr) minmax(0, 0.85fr)",
          gap: "clamp(24px, 4vw, 56px)",
          alignItems: "center",
        }}
        className="landing-grid"
      >
        <motion.div
          initial={{ opacity: 0, y: 28 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.8, ease: [0.2, 0.7, 0.2, 1] }}
        >
          <div
            style={{
              fontSize: 13,
              fontWeight: 700,
              letterSpacing: "0.16em",
              textTransform: "uppercase",
              color: "#F5E39B",
            }}
          >
            {group.name} · {group.period} issue
          </div>

          <h1
            style={{
              fontFamily: "var(--font-display), Georgia, serif",
              fontSize: "clamp(48px, 7.2vw, 96px)",
              lineHeight: 0.9,
              letterSpacing: "-0.03em",
              margin: "14px 0 0",
              fontWeight: 400,
            }}
          >
            Your friends are the best{" "}
            <em style={{ color: "#EBB5BD" }}>recommendation engine</em> you have.
          </h1>

          <p
            style={{
              fontSize: "clamp(17px, 1.6vw, 22px)",
              lineHeight: 1.45,
              maxWidth: 560,
              margin: "22px 0 0",
              color: "rgba(245,236,217,0.88)",
            }}
          >
            A private monthly recap of what your group bought — and what it says about
            all of you. Social first, commerce second.
          </p>

          <div
            style={{
              fontFamily: "var(--font-hand), cursive",
              fontSize: 26,
              color: "#F5E39B",
              transform: "rotate(-1.5deg)",
              marginTop: 18,
            }}
          >
            nobody sees what anyone spent.
          </div>

          <div
            style={{
              display: "flex",
              gap: 14,
              flexWrap: "wrap",
              marginTop: 32,
              alignItems: "center",
            }}
          >
            <Link
              href="/wrapped"
              scroll={false}
              style={{
                display: "inline-flex",
                alignItems: "center",
                gap: 12,
                height: 64,
                padding: "0 30px",
                boxSizing: "border-box",
                borderRadius: 999,
                background: "#F5ECD9",
                color: "#141A47",
                fontSize: 18,
                fontWeight: 700,
                boxShadow: "5px 5px 0 #E8806F",
              }}
            >
              Open September’s Wrapped
              <ArrowRight />
            </Link>
            <Link
              href="/group"
              style={{
                display: "inline-flex",
                alignItems: "center",
                height: 64,
                padding: "0 28px",
                boxSizing: "border-box",
                borderRadius: 999,
                border: "2px solid rgba(245,236,217,0.55)",
                fontSize: 17,
                fontWeight: 700,
              }}
            >
              See the group
            </Link>
          </div>

          <div
            style={{
              display: "flex",
              alignItems: "center",
              gap: 10,
              marginTop: 26,
              fontSize: 14,
              color: "rgba(245,236,217,0.72)",
            }}
          >
            <Lock />
            Private to your group. Exact totals are never shared.
          </div>
        </motion.div>

        {/* the four chapters, as a stacked deck */}
        <motion.div
          initial={{ opacity: 0, y: 40 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.9, delay: 0.15, ease: [0.2, 0.7, 0.2, 1] }}
          style={{ display: "flex", flexDirection: "column", gap: 12 }}
        >
          {storyChapters.map((c, i) => (
            <motion.div
              key={c.id}
              whileHover={{ x: 6 }}
              style={{
                display: "flex",
                alignItems: "center",
                gap: 14,
                padding: "14px 18px",
                boxSizing: "border-box",
                border: "2px solid #141A47",
                borderRadius: 22,
                background: c.bg,
                color: c.fg,
                boxShadow: "5px 5px 0 #141A47",
                transform: `rotate(${[-1.2, 0.8, -0.6, 1][i]}deg)`,
              }}
            >
              <div
                style={{
                  width: 54,
                  height: 54,
                  flexShrink: 0,
                  borderRadius: "50%",
                  border: `2px solid ${c.fg}`,
                  display: "flex",
                  alignItems: "center",
                  justifyContent: "center",
                  fontFamily: "var(--font-display), Georgia, serif",
                  fontSize: 26,
                }}
              >
                {i + 1}
              </div>
              <div style={{ minWidth: 0 }}>
                <div
                  style={{
                    fontSize: 11.5,
                    fontWeight: 700,
                    letterSpacing: "0.14em",
                    textTransform: "uppercase",
                    opacity: 0.85,
                  }}
                >
                  {c.question}
                </div>
                <div
                  style={{
                    fontFamily: "var(--font-display), Georgia, serif",
                    fontSize: 28,
                    lineHeight: 1.05,
                  }}
                >
                  {c.name}
                </div>
              </div>
            </motion.div>
          ))}

          <div
            style={{
              display: "flex",
              alignItems: "center",
              gap: 12,
              marginTop: 8,
              padding: "10px 16px 10px 10px",
              border: "1px solid rgba(245,236,217,0.25)",
              borderRadius: 999,
              background: "rgba(20,26,71,0.5)",
              alignSelf: "flex-start",
            }}
          >
            <div style={{ display: "flex" }}>
              {userList.map((u, i) => (
                <div
                  key={u.id}
                  style={{
                    width: 34,
                    height: 34,
                    borderRadius: "50%",
                    border: "2px solid #0B0F2A",
                    marginLeft: i === 0 ? 0 : -9,
                  }}
                >
                  <Avatar who={u.id} />
                </div>
              ))}
            </div>
            <span style={{ fontSize: 14.5, fontWeight: 500 }}>
              4 friends · 67 purchases read
            </span>
          </div>

          <div
            style={{
              display: "flex",
              gap: 10,
              marginTop: 6,
              opacity: 0.85,
            }}
          >
            {(["ring", "matcha", "sneaker", "camera"] as const).map((k, i) => (
              <div
                key={k}
                style={{
                  width: 52,
                  height: 52,
                  padding: 6,
                  boxSizing: "border-box",
                  borderRadius: 14,
                  background: ["#EBB5BD", "#A8DCC2", "#BBA9E8", "#F5E39B"][i],
                  border: "2px solid #141A47",
                  transform: `rotate(${[-6, 4, -3, 5][i]}deg)`,
                }}
              >
                <ProductArt kind={k} />
              </div>
            ))}
          </div>
        </motion.div>
      </div>

      <style>{`
        @media (max-width: 900px) {
          .landing-grid { grid-template-columns: minmax(0, 1fr) !important; }
        }
      `}</style>
    </main>
  );
}

function blob(
  color: string,
  opacity: number,
  blur: number,
  pos: { left?: string; right?: string; top?: string; bottom?: string; size: string },
): React.CSSProperties {
  return {
    position: "absolute",
    left: pos.left,
    right: pos.right,
    top: pos.top,
    bottom: pos.bottom,
    width: pos.size,
    height: pos.size,
    borderRadius: "50%",
    background: color,
    opacity,
    filter: `blur(${blur}px)`,
    pointerEvents: "none",
  };
}
