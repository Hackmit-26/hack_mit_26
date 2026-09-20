"use client";

import { useState } from "react";

import { Avatar } from "@/components/primitives/Avatar";
import { Grain, ReplayIcon, ShareIcon } from "@/components/primitives/Glyphs";
import { userList } from "@/data/users";
import { closingTiles } from "@/data/wrapped";

/** The closing screen: pick a chapter to share, or replay. */
export function ClosingCard({ onReplay }: { onReplay: () => void }) {
  const [fav, setFav] = useState(3);
  const favTile = closingTiles[fav - 1];

  return (
    <div
      className="a-card"
      style={{
        position: "absolute",
        left: 360,
        top: 70,
        width: 720,
        height: 900,
        boxSizing: "border-box",
        borderRadius: 36,
        background: "#F5ECD9",
        color: "#141A47",
        overflow: "hidden",
        boxShadow: "0 40px 90px rgba(0,0,0,0.5)",
        padding: "38px 44px 36px",
        display: "flex",
        flexDirection: "column",
        justifyContent: "space-between",
      }}
    >
      <Grain w={720} h={900} id="grainClosing" />
      <div
        style={{
          position: "absolute",
          right: -100,
          top: -100,
          width: 340,
          height: 340,
          borderRadius: "50%",
          background: "#BBA9E8",
          opacity: 0.5,
        }}
      />
      <div
        style={{
          position: "absolute",
          left: -100,
          bottom: 60,
          width: 300,
          height: 300,
          borderRadius: "50%",
          background: "#EBB5BD",
          opacity: 0.5,
        }}
      />

      <div
        style={{
          position: "relative",
          display: "flex",
          justifyContent: "space-between",
          alignItems: "center",
          fontSize: 14,
          fontWeight: 700,
          letterSpacing: "0.16em",
          textTransform: "uppercase",
        }}
      >
        <div>September issue · The end</div>
        <div>See you in October</div>
      </div>

      <div style={{ position: "relative", display: "flex", flexDirection: "column", gap: 26 }}>
        <div style={{ display: "flex", alignItems: "center", paddingLeft: 6 }}>
          {userList.map((u, i) => (
            <div
              key={u.id}
              style={{
                width: 92,
                height: 92,
                borderRadius: "50%",
                border: "4px solid #F5ECD9",
                marginLeft: i === 0 ? 0 : -18,
                transform: `rotate(${[-6, 3, -3, 6][i]}deg)`,
              }}
            >
              <Avatar who={u.id} />
            </div>
          ))}
        </div>
        <div
          style={{
            fontFamily: "var(--font-display), Georgia, serif",
            fontSize: 84,
            lineHeight: 0.92,
            letterSpacing: "-0.025em",
          }}
        >
          Same friends.
          <br />
          <em style={{ color: "#C4553F" }}>Different carts.</em>
          <br />
          See you next month.
        </div>
      </div>

      <div style={{ position: "relative", display: "flex", flexDirection: "column", gap: 14 }}>
        <div style={{ display: "flex", alignItems: "baseline", justifyContent: "space-between" }}>
          <div
            style={{
              fontSize: 13,
              fontWeight: 700,
              letterSpacing: "0.14em",
              textTransform: "uppercase",
            }}
          >
            Pick a chapter to share
          </div>
          <div
            style={{
              fontFamily: "var(--font-hand), cursive",
              fontSize: 26,
              lineHeight: 1,
              color: "#C4553F",
            }}
          >
            chapter {fav}: {favTile.label}
          </div>
        </div>

        <div
          style={{
            display: "grid",
            gridTemplateColumns: `repeat(${closingTiles.length}, minmax(0, 1fr))`,
            gap: 10,
          }}
        >
          {closingTiles.map((t, i) => {
            const on = i + 1 === fav;
            return (
              <button
                key={t.n}
                type="button"
                onClick={() => setFav(i + 1)}
                aria-label={`Chapter ${i + 1}: ${t.label}`}
                aria-pressed={on}
                style={{
                  height: 118,
                  padding: "10px 10px 12px",
                  boxSizing: "border-box",
                  display: "flex",
                  flexDirection: "column",
                  justifyContent: "space-between",
                  alignItems: "flex-start",
                  textAlign: "left",
                  border: "2px solid #141A47",
                  borderRadius: 16,
                  background: t.bg,
                  color: t.fg,
                  boxShadow: on ? "4px 4px 0 #E8806F" : "none",
                  transform: `translateY(${on ? -6 : 0}px)`,
                  transition: "transform .2s, box-shadow .2s",
                }}
              >
                <span
                  style={{
                    fontSize: 11.5,
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
                    fontSize: 25,
                    lineHeight: 1,
                  }}
                >
                  {t.title}
                </span>
              </button>
            );
          })}
        </div>

        <div style={{ display: "flex", gap: 10 }}>
          <button
            type="button"
            style={{
              flexGrow: 1,
              display: "flex",
              alignItems: "center",
              justifyContent: "center",
              gap: 10,
              height: 54,
              border: 0,
              borderRadius: 999,
              background: "#141A47",
              color: "#F5ECD9",
              fontSize: 16,
              fontWeight: 700,
              boxShadow: "3px 3px 0 #E8806F",
            }}
          >
            <ShareIcon />
            Share this chapter
          </button>
          <button
            type="button"
            onClick={onReplay}
            style={{
              display: "flex",
              alignItems: "center",
              justifyContent: "center",
              gap: 10,
              height: 54,
              padding: "0 26px",
              boxSizing: "border-box",
              border: "2px solid #141A47",
              borderRadius: 999,
              background: "transparent",
              fontSize: 16,
              fontWeight: 700,
            }}
          >
            <ReplayIcon />
            Replay Wrapped
          </button>
        </div>
      </div>
    </div>
  );
}
