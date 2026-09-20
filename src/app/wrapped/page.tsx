"use client";

import { AnimatePresence, motion, type PanInfo } from "framer-motion";
import Link from "next/link";
import { useCallback, useEffect, useState } from "react";

import { ClosingCard } from "@/components/chapters/ClosingCard";
import { DebateCard } from "@/components/chapters/DebateCard";
import { GiftCard, type GiftState } from "@/components/chapters/GiftCard";
import { LoreCard } from "@/components/chapters/LoreCard";
import { SpotlightsCard } from "@/components/chapters/SpotlightsCard";
import { TasteCard } from "@/components/chapters/TasteCard";
import { CommentDock } from "@/components/comments/CommentDock";
import { BuySheet, type BuyRequest } from "@/components/commerce/BuySheet";
import {
  MClosing,
  MDebate,
  MGift,
  MLore,
  MSpot,
  MTaste,
} from "@/components/mobile/MobileChapters";
import { M_H, M_W } from "@/components/mobile/MobileFrame";
import { ReactionBar } from "@/components/wrapped/ReactionBar";
import { Stage, useIsMobile } from "@/components/primitives/Stage";
import { DesktopShell } from "@/components/shell/DesktopShell";
import { wrappedCards } from "@/data";
import { groupMembersExcept } from "@/data/users";
import { cardTarget, useApp, type CommentTarget } from "@/state/store";
import type { ChapterId, UserId } from "@/lib/types";

export default function WrappedPage() {
  const isMobile = useIsMobile();
  const { isVetoed, viewerId } = useApp();

  // The gift chapter opens on the first friend who is not the viewer. The whole tree remounts
  // on a viewer switch, so reading it once here is enough to keep the picker off the viewer.
  const firstGiftee = groupMembersExcept(viewerId)[0];

  // Cards the viewer vetoed never appear in the story.
  const deck = wrappedCards.filter((c) => !isVetoed(c.id));

  const [index, setIndex] = useState(0);
  const [direction, setDirection] = useState(1);
  const [buy, setBuy] = useState<BuyRequest | null>(null);

  // Chapter-local state lives here so switching cards doesn't lose it.
  const [who, setWho] = useState<UserId>(viewerId);
  const [caseId, setCaseId] = useState("matcha");
  const [gift, setGift] = useState<GiftState>({
    step: "pick",
    who: firstGiftee,
    budget: "u50",
    item: -1,
  });

  const safeIndex = Math.min(index, deck.length - 1);
  const card = deck[safeIndex];
  const chapter: ChapterId = card?.chapter ?? "taste";

  const go = useCallback(
    (delta: number) => {
      setDirection(delta);
      setIndex((i) => Math.min(Math.max(i + delta, 0), deck.length - 1));
    },
    [deck.length],
  );

  const replay = useCallback(() => {
    setDirection(-1);
    setIndex(0);
    setGift({ step: "pick", who: firstGiftee, budget: "u50", item: -1 });
    setWho(viewerId);
    setCaseId("matcha");
  }, [firstGiftee, viewerId]);

  // Keyboard: arrows navigate, space advances, R replays.
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (buy) return;
      // A tile's item modal sits on top of the story. Arrows would otherwise change
      // the chapter underneath it, so the viewer closes the modal onto a different card.
      if (document.querySelector('[role="dialog"][aria-modal="true"]')) return;
      const target = e.target as HTMLElement | null;
      if (target && ["INPUT", "TEXTAREA", "SELECT"].includes(target.tagName)) return;

      if (e.key === "ArrowRight" || e.key === " ") {
        e.preventDefault();
        go(1);
      } else if (e.key === "ArrowLeft") {
        e.preventDefault();
        go(-1);
      } else if (e.key.toLowerCase() === "r") {
        replay();
      }
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [go, replay, buy]);

  // `?chapter=gift` opens the story on that chapter, so the home page can link at a
  // specific answer. Read after mount, not during render: the server has no query
  // string, and a first index that disagreed with it would hydrate wrong.
  useEffect(() => {
    const want = new URLSearchParams(window.location.search).get("chapter");
    const at = want ? deck.findIndex((c) => c.chapter === want) : -1;
    if (at > 0) setIndex(at);
    // Once, on entry: re-running it would drag the viewer back every time the deck changes.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // The story is a fixed stage; stop the page itself scrolling behind it.
  useEffect(() => {
    document.body.classList.add("stage-locked");
    return () => document.body.classList.remove("stage-locked");
  }, []);

  const onBuy = useCallback((req: BuyRequest) => setBuy(req), []);

  const content = (
    <>
      {chapter === "taste" && <TasteCard />}
      {chapter === "spotlights" && <SpotlightsCard who={who} onChange={setWho} />}
      {chapter === "lore" && <LoreCard caseId={caseId} onChange={setCaseId} />}
      {chapter === "gift" && (
        <GiftCard state={gift} setState={setGift} onBuy={onBuy} />
      )}
      {chapter === "debate" && <DebateCard />}
      {chapter === "closing" && <ClosingCard onReplay={replay} />}
    </>
  );

  const mobileContent = (
    <>
      {chapter === "taste" && <MTaste />}
      {chapter === "spotlights" && <MSpot who={who} onChange={setWho} />}
      {chapter === "lore" && <MLore caseId={caseId} onChange={setCaseId} />}
      {chapter === "gift" && <MGift state={gift} setState={setGift} onBuy={onBuy} />}
      {chapter === "debate" && <MDebate />}
      {chapter === "closing" && <MClosing onReplay={replay} />}
    </>
  );

  /**
   * Tap the right 60% for next, left 40% for back — but never steal a tap
   * meant for a control inside the card.
   */
  const onCardTap = (e: React.MouseEvent<HTMLDivElement>) => {
    const el = e.target as HTMLElement;
    if (el.closest("button, a, input, select, textarea, [role='switch']")) return;

    const rect = e.currentTarget.getBoundingClientRect();
    const x = (e.clientX - rect.left) / rect.width;
    go(x < 0.4 ? -1 : 1);
  };

  // Swipe up or left advances; down or right goes back.
  const onDragEnd = (_: unknown, info: PanInfo) => {
    const { offset, velocity } = info;
    const horizontal = Math.abs(offset.x) > Math.abs(offset.y);
    const threshold = 70;

    if (horizontal) {
      if (offset.x < -threshold || velocity.x < -450) go(1);
      else if (offset.x > threshold || velocity.x > 450) go(-1);
    } else {
      if (offset.y < -threshold || velocity.y < -450) go(1);
      else if (offset.y > threshold || velocity.y > 450) go(-1);
    }
  };

  if (isMobile) {
    return (
      <main
        style={{
          position: "fixed",
          inset: 0,
          background: "#0B0F2A",
          touchAction: "none",
        }}
      >
        <Stage width={M_W} height={M_H} maxScale={1.4}>
          <div
            onClick={onCardTap}
            style={{ position: "relative", width: M_W, height: M_H, overflow: "hidden" }}
          >
            <AnimatePresence mode="wait" custom={direction}>
              <motion.div
                key={card?.id ?? "empty"}
                custom={direction}
                initial={{ opacity: 0, y: direction > 0 ? 60 : -60 }}
                animate={{ opacity: 1, y: 0 }}
                exit={{ opacity: 0, y: direction > 0 ? -40 : 40 }}
                transition={{ duration: 0.36, ease: [0.2, 0.8, 0.3, 1] }}
                drag
                dragDirectionLock
                dragConstraints={{ left: 0, right: 0, top: 0, bottom: 0 }}
                dragElastic={0.18}
                onDragEnd={onDragEnd}
                style={{ position: "absolute", inset: 0 }}
              >
                {mobileContent}
              </motion.div>
            </AnimatePresence>

            {/* Screen-reader and keyboard equivalents for the tap zones. */}
            <button
              type="button"
              aria-label="Previous chapter"
              onClick={() => go(-1)}
              style={srOnly}
            />
            <button
              type="button"
              aria-label="Next chapter"
              onClick={() => go(1)}
              style={srOnly}
            />

            {/* The debate chapter puts its own composer on this line, so the rail would land on
                top of it. That card carries the interaction instead. */}
            {chapter !== "debate" && (
              <div
                style={{
                  position: "absolute",
                  left: 16,
                  right: 16,
                  bottom: 22,
                  display: "flex",
                  alignItems: "center",
                  justifyContent: "center",
                  gap: 8,
                  zIndex: 12,
                }}
              >
                <ReactionBar targetId={reactionTarget(chapter, who, caseId)} compact />
                <CommentDock
                  target={commentTarget(chapter, who, caseId)}
                  label="Comments"
                  hideLabel
                  compact
                />
              </div>
            )}

            <Link
              href="/"
              scroll={false}
              aria-label="Close the Wrapped"
              style={{
                position: "absolute",
                right: 14,
                top: 27,
                zIndex: 14,
                width: 34,
                height: 34,
                borderRadius: "50%",
                border: "2px solid currentColor",
                display: "flex",
                alignItems: "center",
                justifyContent: "center",
                fontSize: 15,
                fontWeight: 700,
                opacity: 0.75,
                color: chapter === "lore" ? "#F5ECD9" : "#141A47",
              }}
            >
              ✕
            </Link>
          </div>
        </Stage>

        <BuySheet request={buy} onClose={() => setBuy(null)} />
      </main>
    );
  }

  return (
    <main style={{ position: "fixed", inset: 0, background: "#0B0F2A" }}>
      <Stage width={1440} height={1000} padding={16}>
        <div style={{ position: "relative", width: 1440, height: 1000 }}>
          <DesktopShell
            step={safeIndex + 1}
            onPrev={safeIndex > 0 ? () => go(-1) : undefined}
            onNext={safeIndex < deck.length - 1 ? () => go(1) : undefined}
          >
            <AnimatePresence mode="wait" custom={direction}>
              <motion.div
                key={card?.id ?? "empty"}
                custom={direction}
                initial={{ opacity: 0, y: direction > 0 ? 70 : -70, scale: 0.97 }}
                animate={{ opacity: 1, y: 0, scale: 1 }}
                exit={{ opacity: 0, y: direction > 0 ? -50 : 50, scale: 0.98 }}
                transition={{ duration: 0.42, ease: [0.2, 0.7, 0.2, 1] }}
                style={{ position: "absolute", inset: 0 }}
              >
                {content}
              </motion.div>
            </AnimatePresence>
          </DesktopShell>

          {/* Bottom-right rail, opposite the privacy note. The card ends at
              y 970 and x 1080, so this clears it in both axes. */}
          <div
            style={{
              position: "absolute",
              right: 48,
              bottom: 24,
              display: "flex",
              alignItems: "center",
              gap: 10,
              zIndex: 20,
            }}
          >
            <ReactionBar targetId={reactionTarget(chapter, who, caseId)} compact />
            {/* The debate chapter has the item's own thread on the card; a second, card-level
                dock next to it would just be a decoy conversation. */}
            {chapter !== "debate" && (
              <CommentDock target={commentTarget(chapter, who, caseId)} compact />
            )}
          </div>

          <Link
            href="/"
            scroll={false}
            style={{
              position: "absolute",
              left: 48,
              top: 84,
              zIndex: 20,
              fontSize: 14,
              fontWeight: 600,
              color: "rgba(245,236,217,0.7)",
            }}
          >
            ← Close
          </Link>

          <BuySheet request={buy} onClose={() => setBuy(null)} />
        </div>
      </Stage>
    </main>
  );
}

/** Reactions attach to whichever sub-card is actually on screen. */
function reactionTarget(chapter: ChapterId, who: UserId, caseId: string): string {
  if (chapter === "spotlights") return `spot-${who}`;
  if (chapter === "lore") return `lore-${caseId}`;
  return `card-${chapter}`;
}

/** Comments hang off the same sub-card the reactions do. */
function commentTarget(chapter: ChapterId, who: UserId, caseId: string): CommentTarget {
  return cardTarget(reactionTarget(chapter, who, caseId));
}

const srOnly: React.CSSProperties = {
  position: "absolute",
  width: 1,
  height: 1,
  padding: 0,
  margin: -1,
  overflow: "hidden",
  clip: "rect(0 0 0 0)",
  whiteSpace: "nowrap",
  border: 0,
};
