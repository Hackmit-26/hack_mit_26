"use client";

import { AnimatePresence, motion } from "framer-motion";
import { useState } from "react";

import { Avatar } from "@/components/primitives/Avatar";
import { SpotKristina } from "@/components/spotlights/SpotKristina";
import { SpotMadhav } from "@/components/spotlights/SpotMadhav";
import { SpotEsh } from "@/components/spotlights/SpotEsh";
import { SpotSabina } from "@/components/spotlights/SpotSabina";
import { getUser } from "@/data/users";
import { spotlightOrder } from "@/data/wrapped";
import type { UserId } from "@/lib/types";

const covers: Record<UserId, () => React.JSX.Element> = {
  kristina: SpotKristina,
  esh: SpotEsh,
  sabina: SpotSabina,
  madhav: SpotMadhav,
};

/**
 * Chapter 2 · Spotlights.
 *
 * The friend switch happens inside the frame, so the four-step story never
 * turns into a page of scrolling.
 */
export function SpotlightsCard({
  who,
  onChange,
}: {
  who: UserId;
  onChange: (who: UserId) => void;
}) {
  const Cover = covers[who];

  return (
    <div
      style={{
        position: "absolute",
        left: 360,
        top: 50,
        width: 720,
        height: 900,
        borderRadius: 36,
        overflow: "hidden",
        boxShadow: "0 40px 90px rgba(0,0,0,0.5)",
      }}
    >
      <AnimatePresence mode="wait">
        <motion.div
          key={who}
          initial={{ opacity: 0, scale: 0.98 }}
          animate={{ opacity: 1, scale: 1 }}
          exit={{ opacity: 0, scale: 1.01 }}
          transition={{ duration: 0.28, ease: [0.2, 0.8, 0.3, 1] }}
          style={{ position: "absolute", inset: 0 }}
        >
          <Cover />
        </motion.div>
      </AnimatePresence>

      <div
        role="group"
        aria-label="Choose a friend"
        style={{
          position: "absolute",
          left: 32,
          right: 32,
          top: 842,
          height: 44,
          display: "flex",
          alignItems: "center",
          gap: 8,
          paddingRight: 140,
          boxSizing: "border-box",
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
                display: "flex",
                alignItems: "center",
                gap: 8,
                height: 44,
                padding: "0 16px 0 4px",
                boxSizing: "border-box",
                border: "2px solid #141A47",
                borderRadius: 999,
                background: on ? "#141A47" : "#F5ECD9",
                color: on ? "#F5ECD9" : "#141A47",
                fontSize: 15,
                fontWeight: 700,
                boxShadow: "3px 3px 0 #141A47",
                transition: "background .2s, color .2s",
              }}
            >
              <span
                style={{
                  display: "block",
                  width: 34,
                  height: 34,
                  borderRadius: "50%",
                  overflow: "hidden",
                  border: `2px solid ${on ? "#F5ECD9" : "#141A47"}`,
                  boxSizing: "border-box",
                  background: "#F5ECD9",
                }}
              >
                <Avatar who={id} />
              </span>
              <span>{getUser(id).name}</span>
            </button>
          );
        })}
        <div
          style={{
            position: "absolute",
            right: 0,
            top: "50%",
            width: 132,
            textAlign: "right",
            fontFamily: "var(--font-hand), cursive",
            fontSize: 18,
            lineHeight: 0.95,
            transform: "translateY(-50%) rotate(-2deg)",
            color: "#141A47",
          }}
        >
          the AI chose these from 11 possible highlights
        </div>
      </div>
    </div>
  );
}
