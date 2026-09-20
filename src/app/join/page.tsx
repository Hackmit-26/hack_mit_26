"use client";

import { AnimatePresence, motion } from "framer-motion";
import { useRouter } from "next/navigation";
import { useState } from "react";

import { Avatar } from "@/components/primitives/Avatar";
import { ArrowRight, Check, Lock, Sparkle } from "@/components/primitives/Glyphs";
import { ProductArt } from "@/components/primitives/ProductArt";
import { PageShell, PaperCard, SectionLabel } from "@/components/layout/PageShell";
import { group, userList } from "@/data/users";
import type { ArtKind } from "@/lib/types";

type Step = "code" | "connect" | "choose" | "done";

/** What a judge "uploads" on stage — three things they already own. */
const SAMPLE_ITEMS: { art: ArtKind; label: string; merchant: string; image?: string }[] = [
  { art: "mug", label: "Hand-thrown mug", merchant: "Clay & Cloud" },
  { art: "sneaker", label: "Adidas Samba", merchant: "Adidas" },
  { art: "notebook", label: "Pocket notebook", merchant: "Sundry Paper Co." },
];

/**
 * Invite → join → connect purchases → choose what to share.
 * Nothing is shared by default; the member picks item by item.
 */
export default function JoinPage() {
  const router = useRouter();
  const [step, setStep] = useState<Step>("code");
  const [code, setCode] = useState(group.inviteCode);
  const [scanning, setScanning] = useState(false);
  const [found, setFound] = useState<number[]>([]);
  const [shared, setShared] = useState<number[]>([]);

  const scan = () => {
    setScanning(true);
    setFound([]);
    SAMPLE_ITEMS.forEach((_, i) => {
      setTimeout(() => {
        setFound((f) => [...f, i]);
        if (i === SAMPLE_ITEMS.length - 1) {
          setScanning(false);
          setTimeout(() => setStep("choose"), 400);
        }
      }, 500 + i * 550);
    });
  };

  return (
    <PageShell>
      <SectionLabel>You’ve been invited</SectionLabel>
      <h1
        style={{
          fontFamily: "var(--font-display), Georgia, serif",
          fontSize: "clamp(40px, 5.6vw, 68px)",
          lineHeight: 0.94,
          letterSpacing: "-0.03em",
          margin: "10px 0 0",
          fontWeight: 400,
          maxWidth: 780,
        }}
      >
        Join <em style={{ color: "#EBB5BD" }}>{group.name}</em> before the October issue.
      </h1>

      <div style={{ display: "flex", alignItems: "center", gap: 12, marginTop: 20 }}>
        <div style={{ display: "flex" }}>
          {userList.map((u, i) => (
            <div
              key={u.id}
              style={{
                width: 42,
                height: 42,
                borderRadius: "50%",
                border: "2px solid #0B0F2A",
                marginLeft: i === 0 ? 0 : -11,
              }}
            >
              <Avatar who={u.id} />
            </div>
          ))}
        </div>
        <span style={{ fontSize: 15, color: "rgba(245,236,217,0.8)" }}>
          {userList.length} friends are already in
        </span>
      </div>

      <div style={{ marginTop: 30, maxWidth: 760 }}>
        <AnimatePresence mode="wait">
          {step === "code" && (
            <Panel key="code">
              <PaperCard>
                <SectionLabel style={{ color: "#C4553F" }}>Step 1 · Invite code</SectionLabel>
                <label
                  htmlFor="invite"
                  style={{ display: "block", fontSize: 17, marginTop: 12, fontWeight: 500 }}
                >
                  Paste the code your friend sent you.
                </label>
                <div style={{ display: "flex", gap: 10, marginTop: 12, flexWrap: "wrap" }}>
                  <input
                    id="invite"
                    value={code}
                    onChange={(e) => setCode(e.target.value.toUpperCase())}
                    style={{
                      flex: 1,
                      minWidth: 220,
                      height: 58,
                      padding: "0 20px",
                      boxSizing: "border-box",
                      border: "2px solid #141A47",
                      borderRadius: 999,
                      background: "#FBF6EA",
                      fontFamily: "var(--font-body)",
                      fontSize: 18,
                      fontWeight: 700,
                      letterSpacing: "0.16em",
                      color: "#141A47",
                    }}
                  />
                  <button
                    type="button"
                    onClick={() => setStep("connect")}
                    disabled={code.trim().length < 4}
                    style={{
                      height: 58,
                      padding: "0 26px",
                      border: 0,
                      borderRadius: 999,
                      background: "#141A47",
                      color: "#F5ECD9",
                      fontSize: 16,
                      fontWeight: 700,
                      boxShadow: "4px 4px 0 #E8806F",
                      opacity: code.trim().length < 4 ? 0.5 : 1,
                    }}
                  >
                    Join the group
                  </button>
                </div>
              </PaperCard>
            </Panel>
          )}

          {step === "connect" && (
            <Panel key="connect">
              <PaperCard>
                <SectionLabel style={{ color: "#C4553F" }}>
                  Step 2 · Connect purchases
                </SectionLabel>
                <div
                  style={{
                    fontFamily: "var(--font-display), Georgia, serif",
                    fontSize: 34,
                    lineHeight: 1.05,
                    marginTop: 8,
                  }}
                >
                  Add a few things you already own.
                </div>
                <p style={{ fontSize: 16, lineHeight: 1.4, marginTop: 8 }}>
                  Upload receipts or order emails and the AI reads the items out of them.
                  Card transactions only show a merchant and an amount, so item details
                  come from receipts.
                </p>

                <button
                  type="button"
                  onClick={scan}
                  disabled={scanning}
                  style={{
                    marginTop: 16,
                    width: "100%",
                    minHeight: 150,
                    border: "2px dashed #141A47",
                    borderRadius: 24,
                    background: "#FBF6EA",
                    color: "#141A47",
                    display: "flex",
                    flexDirection: "column",
                    alignItems: "center",
                    justifyContent: "center",
                    gap: 8,
                  }}
                >
                  <Sparkle size={30} fill="#F5E39B" stroke="#141A47" />
                  <span style={{ fontSize: 17, fontWeight: 700 }}>
                    {scanning ? "Reading your receipts…" : "Upload 3 receipts or photos"}
                  </span>
                  <span style={{ fontFamily: "var(--font-hand), cursive", fontSize: 20 }}>
                    nothing is shared yet.
                  </span>
                </button>

                <div style={{ display: "flex", gap: 12, marginTop: 16, flexWrap: "wrap" }}>
                  {SAMPLE_ITEMS.map((item, i) => (
                    <motion.div
                      key={item.label}
                      initial={{ opacity: 0.25, scale: 0.96 }}
                      animate={
                        found.includes(i)
                          ? { opacity: 1, scale: 1 }
                          : { opacity: 0.25, scale: 0.96 }
                      }
                      transition={{ duration: 0.35, ease: [0.2, 0.8, 0.3, 1] }}
                      style={{
                        flex: "1 1 180px",
                        display: "flex",
                        alignItems: "center",
                        gap: 12,
                        padding: 10,
                        border: "2px solid #141A47",
                        borderRadius: 18,
                        background: "#F5ECD9",
                      }}
                    >
                      <div
                        style={{
                          width: 54,
                          height: 54,
                          flexShrink: 0,
                          border: "2px solid #141A47",
                          borderRadius: 14,
                          background: ["#EBB5BD", "#A8DCC2", "#BBA9E8"][i],
                          padding: 5,
                          boxSizing: "border-box",
                        }}
                      >
                        <ProductArt kind={item.art} src={item.image} />
                      </div>
                      <div style={{ minWidth: 0 }}>
                        <div style={{ fontSize: 14.5, fontWeight: 700 }}>{item.label}</div>
                        <div style={{ fontSize: 12.5, opacity: 0.75 }}>{item.merchant}</div>
                      </div>
                    </motion.div>
                  ))}
                </div>
              </PaperCard>
            </Panel>
          )}

          {step === "choose" && (
            <Panel key="choose">
              <PaperCard>
                <SectionLabel style={{ color: "#C4553F" }}>
                  Step 3 · Choose what to share
                </SectionLabel>
                <div
                  style={{
                    fontFamily: "var(--font-display), Georgia, serif",
                    fontSize: 34,
                    lineHeight: 1.05,
                    marginTop: 8,
                  }}
                >
                  Each purchase starts private.
                </div>

                <div style={{ display: "flex", flexDirection: "column", gap: 10, marginTop: 16 }}>
                  {SAMPLE_ITEMS.map((item, i) => {
                    const on = shared.includes(i);
                    return (
                      <div
                        key={item.label}
                        style={{
                          display: "flex",
                          alignItems: "center",
                          gap: 14,
                          padding: 12,
                          border: "2px solid #141A47",
                          borderRadius: 20,
                          background: on ? "#A8DCC2" : "#FBF6EA",
                          transition: "background .25s",
                        }}
                      >
                        <div
                          style={{
                            width: 52,
                            height: 52,
                            flexShrink: 0,
                            border: "2px solid #141A47",
                            borderRadius: 14,
                            background: "#F5ECD9",
                            padding: 5,
                            boxSizing: "border-box",
                          }}
                        >
                          <ProductArt kind={item.art} src={item.image} />
                        </div>
                        <div style={{ flex: 1, minWidth: 0 }}>
                          <div style={{ fontSize: 16, fontWeight: 700 }}>{item.label}</div>
                          <div style={{ fontSize: 13, opacity: 0.75 }}>{item.merchant}</div>
                        </div>
                        <button
                          type="button"
                          onClick={() =>
                            setShared((s) =>
                              s.includes(i) ? s.filter((x) => x !== i) : [...s, i],
                            )
                          }
                          aria-pressed={on}
                          style={{
                            height: 44,
                            padding: "0 18px",
                            border: "2px solid #141A47",
                            borderRadius: 999,
                            background: on ? "#141A47" : "transparent",
                            color: on ? "#F5ECD9" : "#141A47",
                            fontSize: 14.5,
                            fontWeight: 700,
                            display: "flex",
                            alignItems: "center",
                            gap: 8,
                          }}
                        >
                          {on ? "Shared" : "Share"}
                        </button>
                      </div>
                    );
                  })}
                </div>

                <button
                  type="button"
                  onClick={() => setStep("done")}
                  style={{
                    marginTop: 18,
                    width: "100%",
                    height: 60,
                    display: "flex",
                    alignItems: "center",
                    justifyContent: "center",
                    gap: 10,
                    border: 0,
                    borderRadius: 999,
                    background: "#141A47",
                    color: "#F5ECD9",
                    fontSize: 17,
                    fontWeight: 700,
                    boxShadow: "4px 4px 0 #E8806F",
                  }}
                >
                  {shared.length === 0
                    ? "Join without sharing anything"
                    : `Share ${shared.length} and join`}
                  <ArrowRight />
                </button>
              </PaperCard>
            </Panel>
          )}

          {step === "done" && (
            <Panel key="done">
              <PaperCard bg="#F5E39B">
                <div style={{ display: "flex", alignItems: "center", gap: 16 }}>
                  <div
                    className="a-stamp"
                    style={{
                      width: 88,
                      height: 88,
                      flexShrink: 0,
                      borderRadius: "50%",
                      border: "3px solid #141A47",
                      background: "#A8DCC2",
                      display: "flex",
                      alignItems: "center",
                      justifyContent: "center",
                      boxShadow: "5px 5px 0 #141A47",
                    }}
                  >
                    <svg width="48" height="48" viewBox="0 0 48 48" fill="none" aria-hidden="true">
                      <path
                        d="M12 25 L20 33 L36 15"
                        stroke="#141A47"
                        strokeWidth="4.5"
                        strokeLinecap="round"
                        strokeLinejoin="round"
                      />
                    </svg>
                  </div>
                  <div>
                    <div
                      style={{
                        fontFamily: "var(--font-display), Georgia, serif",
                        fontSize: 40,
                        lineHeight: 1,
                      }}
                    >
                      You’re in {group.name}.
                    </div>
                    <div
                      style={{
                        fontFamily: "var(--font-hand), cursive",
                        fontSize: 24,
                        marginTop: 6,
                      }}
                    >
                      your persona card generates as soon as the story opens.
                    </div>
                  </div>
                </div>

                <div
                  style={{
                    display: "flex",
                    flexDirection: "column",
                    gap: 8,
                    marginTop: 18,
                    fontSize: 16,
                  }}
                >
                  <div style={{ display: "flex", gap: 10, alignItems: "flex-start" }}>
                    <Check />
                    {shared.length} of {SAMPLE_ITEMS.length} items shared with the group
                  </div>
                  <div style={{ display: "flex", gap: 10, alignItems: "flex-start" }}>
                    <Check />
                    Amounts stay hidden unless you turn them on
                  </div>
                  <div style={{ display: "flex", gap: 10, alignItems: "flex-start" }}>
                    <Check />
                    Health and pharmacy are never ingested
                  </div>
                </div>

                <div style={{ display: "flex", gap: 10, marginTop: 20, flexWrap: "wrap" }}>
                  <button
                    type="button"
                    onClick={() => router.push("/wrapped", { scroll: false })}
                    style={{
                      flex: "1 1 240px",
                      height: 60,
                      display: "flex",
                      alignItems: "center",
                      justifyContent: "center",
                      gap: 10,
                      border: 0,
                      borderRadius: 999,
                      background: "#141A47",
                      color: "#F5ECD9",
                      fontSize: 17,
                      fontWeight: 700,
                      boxShadow: "4px 4px 0 #B8412F",
                    }}
                  >
                    Open the Wrapped
                    <ArrowRight />
                  </button>
                  <button
                    type="button"
                    onClick={() => router.push("/")}
                    style={{
                      flex: "0 1 180px",
                      height: 60,
                      border: "2px solid #141A47",
                      borderRadius: 999,
                      background: "transparent",
                      color: "#141A47",
                      fontSize: 16,
                      fontWeight: 700,
                    }}
                  >
                    See the group
                  </button>
                </div>
              </PaperCard>
            </Panel>
          )}
        </AnimatePresence>
      </div>

      <div
        style={{
          display: "flex",
          alignItems: "center",
          gap: 10,
          marginTop: 28,
          fontSize: 14,
          color: "rgba(245,236,217,0.7)",
        }}
      >
        <Lock />
        Nothing is shared by default. You choose item by item, and you can leave any time.
      </div>
    </PageShell>
  );
}

function Panel({ children }: { children: React.ReactNode }) {
  return (
    <motion.div
      initial={{ opacity: 0, y: 24 }}
      animate={{ opacity: 1, y: 0 }}
      exit={{ opacity: 0, y: -16 }}
      transition={{ duration: 0.34, ease: [0.2, 0.8, 0.3, 1] }}
    >
      {children}
    </motion.div>
  );
}
