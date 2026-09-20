"use client";

import { useState } from "react";

import { userList } from "@/data/users";
import { useApp } from "@/state/store";

/**
 * Stage control, not a product feature.
 *
 * "Unwrap" is demoed by one person driving a four-person group gift on their own: put in
 * $50 as Kristina, become Sabina, approve, become Madhav, approve, watch the push land. This is
 * the thing that makes that possible, so it is deliberately dressed as scaffolding - taped to the
 * bottom-left corner, labelled DEMO, and collapsed to a single pill until it is wanted.
 *
 * `setViewerId` re-points the bearer token, rewrites who `displayName()` calls "You", and remounts
 * the app so everything refetches. See `@/state/store`.
 */
export function ViewerSwitcher() {
  const { viewerId, setViewerId } = useApp();
  const [open, setOpen] = useState(false);

  const current = userList.find((u) => u.id === viewerId) ?? userList[0];

  return (
    <div
      style={{
        position: "fixed",
        left: 16,
        bottom: 16,
        zIndex: 9999,
        display: "flex",
        flexDirection: "column",
        alignItems: "flex-start",
        gap: 8,
        fontFamily: "var(--font-body)",
      }}
    >
      {open && (
        <div
          style={{
            display: "flex",
            flexDirection: "column",
            gap: 4,
            padding: 8,
            borderRadius: 14,
            background: "#141A47",
            // Dashed, because nothing else in the app is: this is not shipped UI.
            border: "1px dashed rgba(245,236,217,0.35)",
            boxShadow: "0 18px 40px rgba(11,15,42,0.55)",
          }}
        >
          <div
            style={{
              padding: "2px 6px 6px",
              fontSize: 10,
              letterSpacing: "0.14em",
              textTransform: "uppercase",
              color: "rgba(245,236,217,0.5)",
            }}
          >
            View as
          </div>

          {userList.map((user) => {
            const active = user.id === viewerId;
            return (
              <button
                key={user.id}
                type="button"
                onClick={() => {
                  setViewerId(user.id);
                  setOpen(false);
                }}
                style={{
                  display: "flex",
                  alignItems: "center",
                  gap: 10,
                  width: "100%",
                  padding: "7px 12px 7px 8px",
                  borderRadius: 10,
                  border: "none",
                  cursor: "pointer",
                  textAlign: "left",
                  background: active ? "rgba(245,236,217,0.12)" : "transparent",
                  color: "#F5ECD9",
                  fontFamily: "inherit",
                  fontSize: 14,
                  fontWeight: active ? 600 : 400,
                }}
              >
                <span
                  aria-hidden
                  style={{
                    width: 22,
                    height: 22,
                    flex: "0 0 auto",
                    borderRadius: "50%",
                    background: user.color,
                    color: "#0B0F2A",
                    fontSize: 11,
                    fontWeight: 700,
                    display: "grid",
                    placeItems: "center",
                  }}
                >
                  {user.name.slice(0, 1)}
                </span>
                {user.name}
                {active && (
                  <span style={{ marginLeft: "auto", fontSize: 11, opacity: 0.6 }}>you</span>
                )}
              </button>
            );
          })}
        </div>
      )}

      <button
        type="button"
        onClick={() => setOpen((v) => !v)}
        aria-expanded={open}
        style={{
          display: "flex",
          alignItems: "center",
          gap: 8,
          padding: "7px 12px 7px 8px",
          borderRadius: 999,
          cursor: "pointer",
          background: "#141A47",
          border: "1px dashed rgba(245,236,217,0.35)",
          boxShadow: "0 10px 26px rgba(11,15,42,0.45)",
          color: "#F5ECD9",
          fontFamily: "inherit",
          fontSize: 13,
        }}
      >
        <span
          aria-hidden
          style={{
            width: 22,
            height: 22,
            borderRadius: "50%",
            background: current.color,
            color: "#0B0F2A",
            fontSize: 11,
            fontWeight: 700,
            display: "grid",
            placeItems: "center",
          }}
        >
          {current.name.slice(0, 1)}
        </span>
        <span
          style={{
            fontSize: 9,
            letterSpacing: "0.16em",
            padding: "2px 5px",
            borderRadius: 4,
            color: "#0B0F2A",
            background: "#E8806F",
            fontWeight: 700,
          }}
        >
          DEMO
        </span>
        <span>{current.name}</span>
      </button>
    </div>
  );
}
