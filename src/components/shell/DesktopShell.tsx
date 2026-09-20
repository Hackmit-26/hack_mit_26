"use client";

import { motion } from "framer-motion";

import { group, storyChapters, userList } from "@/data";
import { Avatar } from "@/components/primitives/Avatar";
import { ArrowLeft, ArrowRight, Lock, Sparkle } from "@/components/primitives/Glyphs";

/**
 * The 1440 × 1000 page shell: one card centred, prev and next circles 60px
 * outside the card edges, chapter progress in the top bar.
 *
 * The rings scale up and the ribbon drifts left as you fall through the
 * chapters — both driven by `step`, as in the Shell artboard.
 */
export function DesktopShell({
  step,
  onPrev,
  onNext,
  children,
}: {
  /** 1-based chapter number; 5 is the closing screen. */
  step: number;
  onPrev?: () => void;
  onNext?: () => void;
  children: React.ReactNode;
}) {
  const holeScale = 0.8 + step * 0.32;
  const ribbonX = -step * 90;
  const stepLabel = step <= 4 ? `${step} / 4` : "The end";

  return (
    <div
      style={{
        position: "relative",
        width: 1440,
        height: 1000,
        overflow: "hidden",
        background: "#0B0F2A",
        color: "#F5ECD9",
      }}
    >
      {/* soft blobs */}
      <div style={blob("#BBA9E8", 0.22, 110, { left: -180, top: -200, size: 640 })} />
      <div style={blob("#E8806F", 0.2, 120, { right: -220, bottom: -240, size: 720 })} />
      <div style={blob("#4A56FF", 0.18, 90, { right: 120, top: 60, size: 260 })} />

      <svg
        width="1440"
        height="1000"
        viewBox="0 0 1440 1000"
        style={{ position: "absolute", left: 0, top: 0 }}
        aria-hidden="true"
      >
        <motion.g
          animate={{ scale: holeScale }}
          transition={{ duration: 0.9, ease: [0.2, 0.7, 0.2, 1] }}
          style={{ transformOrigin: "300px 760px" }}
          fill="none"
          stroke="#F5ECD9"
          strokeOpacity="0.09"
          strokeWidth="1.5"
        >
          <ellipse cx="300" cy="760" rx="60" ry="26" />
          <ellipse cx="300" cy="760" rx="130" ry="56" />
          <ellipse cx="300" cy="760" rx="220" ry="96" />
          <ellipse cx="300" cy="760" rx="330" ry="142" />
          <ellipse cx="300" cy="760" rx="470" ry="200" />
        </motion.g>

        <motion.g
          animate={{ x: ribbonX }}
          transition={{ duration: 0.9, ease: [0.2, 0.7, 0.2, 1] }}
        >
          <path
            d="M-200 820 C120 620 260 980 560 760 S 980 380 1240 560 S 1560 300 1700 380"
            fill="none"
            stroke="#EBB5BD"
            strokeOpacity="0.5"
            strokeWidth="2"
            strokeDasharray="3 9"
            strokeLinecap="round"
          />
          <path
            d="M-200 860 C160 680 300 1020 600 800 S 1020 430 1280 610 S 1600 340 1740 420"
            fill="none"
            stroke="#BBA9E8"
            strokeOpacity="0.28"
            strokeWidth="18"
            strokeLinecap="round"
          />
        </motion.g>

        <g fill="#F5E39B">
          <path d="M170 250 l6 -20 l6 20 l20 6 l-20 6 l-6 20 l-6 -20 l-20 -6 z" opacity="0.9" />
          <path d="M1290 780 l5 -16 l5 16 l16 5 l-16 5 l-5 16 l-5 -16 l-16 -5 z" opacity="0.8" />
          <path d="M1180 170 l4 -12 l4 12 l12 4 l-12 4 l-4 12 l-4 -12 l-12 -4 z" opacity="0.7" />
        </g>
        <g fill="#A8DCC2" opacity="0.8">
          <path d="M110 640 l4 -12 l4 12 l12 4 l-12 4 l-4 12 l-4 -12 l-12 -4 z" />
          <path d="M1330 470 l4 -12 l4 12 l12 4 l-12 4 l-4 12 l-4 -12 l-12 -4 z" />
        </g>
        <g fill="#F5ECD9" opacity="0.55">
          <circle cx="230" cy="420" r="2.5" />
          <circle cx="120" cy="300" r="2" />
          <circle cx="1350" cy="300" r="2.5" />
          <circle cx="1240" cy="900" r="2" />
          <circle cx="340" cy="930" r="2.5" />
          <circle cx="1110" cy="90" r="2" />
        </g>
        <g transform="translate(150 480) rotate(-16)" opacity="0.7">
          <path d="M0 -20 C-30 -20 -30 8 0 26 C30 8 30 -20 0 -20 Z" fill="#E8806F" />
        </g>
        <g transform="translate(1310 640) rotate(14)" opacity="0.6">
          <path d="M0 -26 L18 0 L0 26 L-18 0 Z" fill="#BBA9E8" />
        </g>
        <g transform="translate(1250 250) rotate(10)" opacity="0.55">
          <path
            d="M0 -24 C10 -8 26 -2 26 8 C26 18 14 20 6 14 C8 24 10 28 14 32 H-14 C-10 28 -8 24 -6 14 C-14 20 -26 18 -26 8 C-26 -2 -10 -8 0 -24 Z"
            fill="#F5ECD9"
          />
        </g>
      </svg>

      {/* wordmark */}
      <div
        style={{
          position: "absolute",
          left: 48,
          top: 36,
          display: "flex",
          alignItems: "center",
          gap: 12,
        }}
      >
        <Sparkle size={26} />
        <div
          style={{
            fontFamily: "var(--font-display), Georgia, serif",
            fontSize: 34,
            lineHeight: 1,
            letterSpacing: "-0.01em",
          }}
        >
          Shop <em style={{ color: "#EBB5BD" }}>Wrapped</em>
        </div>
      </div>

      {/* chapter progress */}
      <div
        style={{
          position: "absolute",
          left: "50%",
          top: 30,
          transform: "translateX(-50%)",
          display: "flex",
          alignItems: "center",
          gap: 22,
        }}
      >
        {storyChapters.map((c, i) => {
          const n = i + 1;
          const done = n <= step;
          return (
            <div
              key={c.id}
              style={{
                display: "flex",
                alignItems: "center",
                gap: 8,
                opacity: n === step ? 1 : done ? 0.85 : 0.5,
                transition: "opacity .3s",
              }}
            >
              <span
                style={{
                  display: "block",
                  width: 14,
                  height: 14,
                  boxSizing: "border-box",
                  borderRadius: "50%",
                  border: "2px solid #F5ECD9",
                  background: done ? "#F5ECD9" : "transparent",
                  transition: "background .3s",
                }}
              />
              <span
                style={{
                  fontSize: 15,
                  fontWeight: n === step ? 700 : 500,
                  letterSpacing: "0.04em",
                  color: "#F5ECD9",
                }}
              >
                {c.name}
              </span>
            </div>
          );
        })}
        <div
          style={{
            fontSize: 13,
            fontWeight: 700,
            letterSpacing: "0.14em",
            color: "#F5E39B",
            paddingLeft: 6,
          }}
        >
          {stepLabel}
        </div>
      </div>

      {/* group pill */}
      <div
        style={{
          position: "absolute",
          right: 48,
          top: 30,
          display: "flex",
          alignItems: "center",
          gap: 10,
          padding: "8px 16px 8px 8px",
          border: "1px solid rgba(245,236,217,0.25)",
          borderRadius: 999,
          background: "rgba(20,26,71,0.5)",
        }}
      >
        <div style={{ display: "flex" }}>
          {userList.map((u, i) => (
            <div
              key={u.id}
              style={{
                width: 30,
                height: 30,
                borderRadius: "50%",
                border: "2px solid #0B0F2A",
                marginLeft: i === 0 ? 0 : -8,
              }}
            >
              <Avatar who={u.id} />
            </div>
          ))}
        </div>
        <div style={{ fontSize: 15, fontWeight: 500 }}>
          {group.name} · {group.period}
        </div>
      </div>

      {/* the card */}
      {children}

      {/* prev / next */}
      <NavCircle side="left" enabled={!!onPrev} onClick={onPrev} />
      <NavCircle side="right" enabled={!!onNext} onClick={onNext} />

      <div
        style={{
          position: "absolute",
          left: 226,
          top: 546,
          width: 104,
          textAlign: "center",
          fontFamily: "var(--font-hand), cursive",
          fontSize: 22,
          color: "#EBB5BD",
          transform: "rotate(-4deg)",
          pointerEvents: "none",
        }}
      >
        back up the hole
      </div>
      <div
        style={{
          position: "absolute",
          right: 226,
          top: 546,
          width: 104,
          textAlign: "center",
          fontFamily: "var(--font-hand), cursive",
          fontSize: 22,
          color: "#F5E39B",
          transform: "rotate(3deg)",
          pointerEvents: "none",
        }}
      >
        keep falling
      </div>

      <div
        style={{
          position: "absolute",
          left: 48,
          bottom: 34,
          display: "flex",
          alignItems: "center",
          gap: 10,
          fontSize: 14,
          color: "rgba(245,236,217,0.78)",
        }}
      >
        <Lock />
        <span>Private to your group. Exact totals are never shared.</span>
      </div>
      <div
        style={{
          position: "absolute",
          right: 48,
          bottom: 30,
          display: "flex",
          alignItems: "center",
          gap: 8,
          fontSize: 14,
          color: "rgba(245,236,217,0.78)",
        }}
      >
        <Key>←</Key>
        <Key>→</Key>
        <span>to fall through</span>
      </div>
    </div>
  );
}

function NavCircle({
  side,
  enabled,
  onClick,
}: {
  side: "left" | "right";
  enabled: boolean;
  onClick?: () => void;
}) {
  const position =
    side === "left"
      ? { left: 246 as const }
      : { right: 246 as const };

  const base: React.CSSProperties = {
    position: "absolute",
    ...position,
    top: 468,
    width: 64,
    height: 64,
    borderRadius: "50%",
    display: "flex",
    alignItems: "center",
    justifyContent: "center",
    padding: 0,
  };

  if (!enabled) {
    return (
      <div
        style={{
          ...base,
          border: "1.5px dashed rgba(245,236,217,0.25)",
          color: "rgba(245,236,217,0.35)",
        }}
        aria-hidden="true"
      >
        {side === "left" ? <ArrowLeft size={26} /> : <ArrowRight size={26} />}
      </div>
    );
  }

  return (
    <motion.button
      type="button"
      onClick={onClick}
      aria-label={side === "left" ? "Previous chapter" : "Next chapter"}
      whileHover={{ scale: 1.08 }}
      whileTap={{ scale: 0.94 }}
      style={{
        ...base,
        cursor: "pointer",
        border:
          side === "left" ? "1.5px solid rgba(245,236,217,0.6)" : "none",
        background: side === "left" ? "rgba(245,236,217,0.08)" : "#F5ECD9",
        color: side === "left" ? "#F5ECD9" : "#0B0F2A",
      }}
    >
      {side === "left" ? <ArrowLeft size={26} /> : <ArrowRight size={26} />}
    </motion.button>
  );
}

function Key({ children }: { children: React.ReactNode }) {
  return (
    <div
      style={{
        minWidth: 30,
        height: 28,
        padding: "0 6px",
        boxSizing: "border-box",
        border: "1px solid rgba(245,236,217,0.4)",
        borderRadius: 6,
        display: "flex",
        alignItems: "center",
        justifyContent: "center",
        fontSize: 13,
      }}
    >
      {children}
    </div>
  );
}

function blob(
  color: string,
  opacity: number,
  blur: number,
  pos: { left?: number; right?: number; top?: number; bottom?: number; size: number },
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
  };
}
