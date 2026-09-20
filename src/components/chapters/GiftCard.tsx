"use client";

import { AnimatePresence, motion } from "framer-motion";

import { Avatar } from "@/components/primitives/Avatar";
import { ArrowRight, GiftIcon, Grain } from "@/components/primitives/Glyphs";
import { ProductArt } from "@/components/primitives/ProductArt";
import { VisaMark } from "@/components/primitives/VisaMark";
import {
  budgets,
  getProduct,
  giftProfiles,
  giftableUserIds,
  groupGifts,
  recommendationsFor,
} from "@/data/products";
import { getUser } from "@/data/users";
import { formatPrice, shareOf } from "@/services/commerce";
import { useApp } from "@/state/store";
import type { BudgetKey, Recommendation, UserId } from "@/lib/types";

const TINT = ["#F5ECD9", "#EBB5BD", "#A8DCC2", "#BBA9E8", "#F5E39B"];
const ROT = [-2, 1.5, -1, 2, -1.5];

export type GiftStep = "pick" | "main" | "detail";

export interface GiftState {
  step: GiftStep;
  who: UserId;
  budget: BudgetKey;
  /** Index into the current budget's recommendation list. */
  item: number;
}

/**
 * Chapter 4 · Gift mode.
 *
 * Three screens in one card: pick a friend, read their gift profile, then
 * open one idea. Buying happens through the buy sheet, which the parent
 * opens — this card never touches payment logic.
 */
export function GiftCard({
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
  }) => void;
}) {
  const { isSaved, toggleSaved, startGroupGift, hasStartedGroupGift } = useApp();

  const person = getUser(state.who);
  const profile = giftProfiles[state.who];
  const isGroup = state.budget === "group";
  const recs = isGroup ? [] : recommendationsFor(state.who, state.budget);

  return (
    <div
      className="a-card"
      style={{
        position: "absolute",
        left: 360,
        top: 50,
        width: 720,
        height: 900,
        boxSizing: "border-box",
        borderRadius: 36,
        background: "#F5E39B",
        color: "#141A47",
        overflow: "hidden",
        boxShadow: "0 40px 90px rgba(0,0,0,0.5)",
      }}
    >
      <Grain w={720} h={900} id="grainGift" />
      <div
        style={{
          position: "absolute",
          right: -130,
          top: -110,
          width: 400,
          height: 400,
          borderRadius: "50%",
          background: "#EBB5BD",
          opacity: 0.7,
        }}
      />
      <div
        style={{
          position: "absolute",
          left: -120,
          bottom: -150,
          width: 360,
          height: 360,
          borderRadius: "50%",
          background: "#A8DCC2",
          opacity: 0.55,
        }}
      />

      <AnimatePresence mode="wait">
        <motion.div
          key={state.step}
          initial={{ opacity: 0, y: 26 }}
          animate={{ opacity: 1, y: 0 }}
          exit={{ opacity: 0, y: -16 }}
          transition={{ duration: 0.32, ease: [0.2, 0.8, 0.3, 1] }}
          style={{ position: "absolute", left: 0, top: 0, width: 720, height: 900 }}
        >
          {state.step === "pick" && (
            <PickScreen state={state} setState={setState} />
          )}

          {state.step === "main" && (
            <>
              <div
                style={{
                  position: "absolute",
                  left: 44,
                  top: 38,
                  fontSize: 14,
                  fontWeight: 700,
                  letterSpacing: "0.16em",
                  textTransform: "uppercase",
                }}
              >
                Chapter 4 · Gift mode
              </div>
              <button
                type="button"
                onClick={() => setState({ ...state, step: "pick" })}
                style={{
                  position: "absolute",
                  right: 44,
                  top: 26,
                  height: 36,
                  padding: "0 16px",
                  boxSizing: "border-box",
                  border: "2px solid #141A47",
                  borderRadius: 999,
                  background: "#F5ECD9",
                  color: "#141A47",
                  fontSize: 14,
                  fontWeight: 700,
                }}
              >
                ← Change friend
              </button>

              <div
                style={{
                  position: "absolute",
                  left: 44,
                  top: 88,
                  width: 124,
                  height: 150,
                  boxSizing: "border-box",
                  border: "3px solid #141A47",
                  borderRadius: "62px 62px 18px 18px",
                  overflow: "hidden",
                  background: "#F5ECD9",
                  boxShadow: "5px 5px 0 #141A47",
                  transform: "rotate(-3deg)",
                }}
              >
                <Avatar who={state.who} />
              </div>

              <div style={{ position: "absolute", left: 196, top: 82, width: 480 }}>
                <div
                  style={{
                    fontSize: 13,
                    fontWeight: 700,
                    letterSpacing: "0.16em",
                    textTransform: "uppercase",
                    color: "#B8412F",
                  }}
                >
                  Shopping for {person.name}
                </div>
                <div
                  style={{
                    fontFamily: "var(--font-display), Georgia, serif",
                    fontSize: 48,
                    lineHeight: 1,
                    letterSpacing: "-0.02em",
                    marginTop: 2,
                  }}
                >
                  {person.name}’s <em>gift profile</em>
                </div>
                <div
                  style={{
                    fontFamily: "var(--font-hand), cursive",
                    fontSize: 22,
                    lineHeight: 1,
                    margin: "4px 0 10px",
                  }}
                >
                  the AI read {profile.purchaseCount} purchases and boiled it down:
                </div>
                <div style={{ display: "flex", flexWrap: "wrap", gap: 8 }}>
                  {profile.tags.map((t, i) => (
                    <span
                      key={t}
                      className="a-tag"
                      style={{
                        animationDelay: `${0.15 + i * 0.09}s`,
                        display: "inline-flex",
                        alignItems: "center",
                        height: 34,
                        padding: "0 14px",
                        boxSizing: "border-box",
                        border: "2px solid #141A47",
                        borderRadius: 999,
                        background:
                          t === "Birthday in 12 days" ? "#E8806F" : TINT[i % 5],
                        fontSize: 14.5,
                        fontWeight: 600,
                        transform: `rotate(${ROT[i % 5]}deg)`,
                        boxShadow: "3px 3px 0 #141A47",
                      }}
                    >
                      {t}
                    </span>
                  ))}
                </div>
              </div>

              <div
                role="group"
                aria-label="Gift budget"
                style={{
                  position: "absolute",
                  left: 44,
                  top: 336,
                  width: 632,
                  display: "flex",
                  gap: 10,
                }}
              >
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
                        display: "flex",
                        alignItems: "center",
                        justifyContent: "center",
                        gap: 7,
                        height: 46,
                        padding: "0 6px",
                        boxSizing: "border-box",
                        border: "2px solid #141A47",
                        borderRadius: 999,
                        background: on ? "#141A47" : "#F5ECD9",
                        color: on ? "#F5ECD9" : "#141A47",
                        fontSize: 15.5,
                        fontWeight: 700,
                        boxShadow: "3px 3px 0 #141A47",
                        whiteSpace: "nowrap",
                        transition: "background .2s, color .2s",
                      }}
                    >
                      {b.label}
                    </button>
                  );
                })}
              </div>

              {!isGroup && (
                <div
                  style={{
                    position: "absolute",
                    left: 44,
                    top: 400,
                    width: 632,
                    display: "flex",
                    flexDirection: "column",
                    gap: 14,
                  }}
                >
                  {recs.map((r, i) => (
                    <RecRow
                      key={r.id}
                      rec={r}
                      delay={i * 0.12}
                      onView={() => setState({ ...state, step: "detail", item: i })}
                    />
                  ))}
                </div>
              )}

              {isGroup && (
                <GroupGiftPanel
                  who={state.who}
                  started={hasStartedGroupGift(state.who)}
                  onStart={() => startGroupGift(state.who)}
                  onBuyShare={(productId, amount) =>
                    onBuy({
                      productId,
                      forUserId: state.who,
                      amountCentsOverride: amount,
                    })
                  }
                />
              )}

              <div
                style={{
                  position: "absolute",
                  left: 44,
                  top: 858,
                  fontFamily: "var(--font-hand), cursive",
                  fontSize: 22,
                  lineHeight: 1,
                  transform: "rotate(-1deg)",
                }}
              >
                picked by the AI from behavior + friend signals. nobody sees what anyone spent.
              </div>
            </>
          )}

          {state.step === "detail" && (
            <DetailScreen
              state={state}
              setState={setState}
              saved={isSaved(currentProductId(state))}
              onToggleSave={() => toggleSaved(currentProductId(state))}
              onBuy={() =>
                onBuy({
                  productId: currentProductId(state),
                  forUserId: state.who,
                  inspiredByUserId: inspiredBy(state),
                })
              }
            />
          )}
        </motion.div>
      </AnimatePresence>
    </div>
  );
}

/** The recommendation currently open in the detail screen. */
function currentRec(state: GiftState): Recommendation {
  const list = recommendationsFor(state.who, state.budget);
  return list[state.item] ?? recommendationsFor(state.who, "u50")[0];
}

function currentProductId(state: GiftState): string {
  return currentRec(state).productId;
}

/** Credit the friend whose signal surfaced this idea, when there is one. */
function inspiredBy(state: GiftState): UserId | undefined {
  const signal = currentRec(state).signal;
  const found = (["esh", "sabina", "madhav", "kristina"] as UserId[]).find((id) =>
    signal.startsWith(getUser(id).name),
  );
  return found;
}

function PickScreen({
  state,
  setState,
}: {
  state: GiftState;
  setState: (next: GiftState) => void;
}) {
  const person = getUser(state.who);

  return (
    <>
      <div
        style={{
          position: "absolute",
          left: 44,
          top: 38,
          fontSize: 14,
          fontWeight: 700,
          letterSpacing: "0.16em",
          textTransform: "uppercase",
        }}
      >
        Chapter 4 · Gift mode
      </div>

      <div style={{ position: "absolute", left: 44, top: 82, width: 632 }}>
        <div
          style={{
            fontFamily: "var(--font-display), Georgia, serif",
            fontSize: 38,
            lineHeight: 1.1,
            letterSpacing: "-0.01em",
          }}
        >
          You know {person.name}’s shopping habits.
        </div>
        <div
          style={{
            fontFamily: "var(--font-display), Georgia, serif",
            fontSize: 60,
            lineHeight: 0.96,
            letterSpacing: "-0.025em",
            fontStyle: "italic",
            color: "#B8412F",
            marginTop: 8,
          }}
        >
          But do you actually know what {person.name} would want?
        </div>
      </div>

      <div
        style={{
          position: "absolute",
          left: 44,
          top: 330,
          display: "flex",
          alignItems: "center",
          gap: 18,
        }}
      >
        <div
          style={{
            display: "flex",
            alignItems: "center",
            gap: 10,
            height: 46,
            padding: "0 20px 0 16px",
            boxSizing: "border-box",
            borderRadius: 999,
            background: "#141A47",
            color: "#F5ECD9",
            fontSize: 15,
            fontWeight: 700,
            letterSpacing: "0.14em",
            textTransform: "uppercase",
            transform: "rotate(-2deg)",
            boxShadow: "4px 4px 0 #B8412F",
          }}
        >
          <GiftIcon />
          Gift mode
        </div>
        <div
          style={{
            fontFamily: "var(--font-hand), cursive",
            fontSize: 34,
            lineHeight: 1,
            transform: "rotate(-1deg)",
          }}
        >
          Shopping for {person.name}?
        </div>
      </div>

      <div
        role="group"
        aria-label="Choose a friend to shop for"
        style={{
          position: "absolute",
          left: 44,
          top: 396,
          width: 632,
          display: "flex",
          gap: 22,
        }}
      >
        {giftableUserIds.map((id) => {
          const on = id === state.who;
          const u = getUser(id);
          return (
            <button
              key={id}
              type="button"
              onClick={() => setState({ ...state, who: id, item: -1 })}
              aria-pressed={on}
              style={{
                flex: 1,
                padding: 0,
                border: 0,
                background: "transparent",
                textAlign: "center",
                color: "#141A47",
                opacity: on ? 1 : 0.62,
                transform: `scale(${on ? 1.04 : 0.97})`,
                transition: "transform .25s, opacity .25s",
              }}
            >
              <div
                style={{
                  height: 220,
                  boxSizing: "border-box",
                  border: "3px solid #141A47",
                  borderRadius: "96px 96px 22px 22px",
                  overflow: "hidden",
                  background: "#F5ECD9",
                  boxShadow: on ? "7px 7px 0 #B8412F" : "4px 4px 0 #141A47",
                  transition: "box-shadow .25s",
                }}
              >
                <Avatar who={id} />
              </div>
              <div
                style={{
                  fontFamily: "var(--font-display), Georgia, serif",
                  fontSize: 32,
                  lineHeight: 1,
                  marginTop: 10,
                }}
              >
                {u.name}
              </div>
              <div
                style={{
                  fontFamily: "var(--font-hand), cursive",
                  fontSize: 20,
                  lineHeight: 1,
                  color: "#B8412F",
                }}
              >
                {u.persona}
              </div>
            </button>
          );
        })}
      </div>

      <div
        style={{
          position: "absolute",
          left: 44,
          top: 700,
          width: 632,
          textAlign: "center",
        }}
      >
        {state.who === "sabina" ? (
          <span
            style={{
              display: "inline-flex",
              alignItems: "center",
              gap: 10,
              height: 42,
              padding: "0 20px",
              boxSizing: "border-box",
              borderRadius: 999,
              background: "#E8806F",
              border: "2px solid #141A47",
              fontSize: 16,
              fontWeight: 700,
            }}
          >
            Sabina’s birthday is in 12 days
            <span
              style={{ fontFamily: "var(--font-hand), cursive", fontSize: 22, fontWeight: 700 }}
            >
              group gift ready
            </span>
          </span>
        ) : (
          <span style={{ fontFamily: "var(--font-hand), cursive", fontSize: 26, lineHeight: 1 }}>
            the AI reads {person.name}’s September carts so you don’t have to guess.
          </span>
        )}
      </div>

      <button
        type="button"
        onClick={() => setState({ ...state, step: "main", item: -1 })}
        style={{
          position: "absolute",
          left: 44,
          top: 772,
          width: 632,
          height: 68,
          display: "flex",
          alignItems: "center",
          justifyContent: "center",
          gap: 12,
          border: 0,
          borderRadius: 999,
          background: "#141A47",
          color: "#F5ECD9",
          fontSize: 19,
          fontWeight: 700,
          boxShadow: "5px 5px 0 #B8412F",
        }}
      >
        Open {person.name}’s gift profile
        <ArrowRight />
      </button>
    </>
  );
}

function RecRow({
  rec,
  delay,
  onView,
}: {
  rec: Recommendation;
  delay: number;
  onView: () => void;
}) {
  const product = getProduct(rec.productId);
  const forName = getUser(rec.forUserId).name;

  return (
    <div
      className="a-up"
      style={{
        animationDelay: `${delay}s`,
        boxSizing: "border-box",
        display: "flex",
        gap: 16,
        padding: 14,
        border: "2px solid #141A47",
        borderRadius: 26,
        background: "#F5ECD9",
        boxShadow: "5px 5px 0 #141A47",
        minHeight: 206,
      }}
    >
      <div
        style={{
          width: 132,
          flexShrink: 0,
          display: "flex",
          flexDirection: "column",
          alignItems: "center",
        }}
      >
        <div
          style={{
            width: 132,
            height: 132,
            boxSizing: "border-box",
            border: "2px solid #141A47",
            borderRadius: 20,
            background: product.bg,
            padding: 12,
          }}
        >
          <ProductArt kind={product.art} />
        </div>
        <div
          style={{
            fontFamily: "var(--font-display), Georgia, serif",
            fontSize: 38,
            lineHeight: 1,
            marginTop: 8,
          }}
        >
          {formatPrice(product.priceCents)}
        </div>
      </div>

      <div
        style={{
          flex: 1,
          minWidth: 0,
          display: "flex",
          flexDirection: "column",
          gap: 5,
        }}
      >
        <div
          style={{
            fontFamily: "var(--font-display), Georgia, serif",
            fontSize: 28,
            lineHeight: 1,
            letterSpacing: "-0.01em",
          }}
        >
          {product.title}
        </div>
        <div style={{ display: "flex", alignItems: "center", gap: 8, fontSize: 14 }}>
          <b>{product.merchant}</b>
          <VisaTag />
          <span style={{ opacity: 0.7 }}>
            {product.isNew ? `New to ${forName}` : `${forName} shops here`}
          </span>
        </div>
        <div style={{ fontSize: 14, lineHeight: 1.32 }}>
          <Label>Behavior</Label>
          {rec.behavior}
        </div>
        <div style={{ fontSize: 14, lineHeight: 1.32 }}>
          <Label>Friend signal</Label>
          {rec.signal}
        </div>
        <button
          type="button"
          onClick={onView}
          style={{
            alignSelf: "flex-end",
            marginTop: "auto",
            height: 38,
            padding: "0 20px",
            border: 0,
            borderRadius: 999,
            background: "#141A47",
            color: "#F5ECD9",
            fontSize: 15,
            fontWeight: 700,
          }}
        >
          View gift
        </button>
      </div>
    </div>
  );
}

function DetailScreen({
  state,
  setState,
  saved,
  onToggleSave,
  onBuy,
}: {
  state: GiftState;
  setState: (next: GiftState) => void;
  saved: boolean;
  onToggleSave: () => void;
  onBuy: () => void;
}) {
  const rec = currentRec(state);
  const product = getProduct(rec.productId);
  const person = getUser(state.who);

  return (
    <>
      <button
        type="button"
        onClick={() => setState({ ...state, step: "main" })}
        style={{
          position: "absolute",
          left: 44,
          top: 26,
          height: 36,
          padding: "0 16px",
          boxSizing: "border-box",
          border: "2px solid #141A47",
          borderRadius: 999,
          background: "#F5ECD9",
          color: "#141A47",
          fontSize: 14,
          fontWeight: 700,
        }}
      >
        ← Back to ideas
      </button>
      <div
        style={{
          position: "absolute",
          right: 44,
          top: 38,
          fontSize: 14,
          fontWeight: 700,
          letterSpacing: "0.16em",
          textTransform: "uppercase",
        }}
      >
        Gift for {person.name}
      </div>

      <div
        style={{
          position: "absolute",
          left: 44,
          top: 84,
          width: 632,
          height: 250,
          boxSizing: "border-box",
          border: "2px solid #141A47",
          borderRadius: 30,
          background: product.bg,
          boxShadow: "5px 5px 0 #141A47",
          display: "flex",
          alignItems: "center",
          justifyContent: "center",
        }}
      >
        <div style={{ width: 210, height: 210 }}>
          <ProductArt kind={product.art} />
        </div>
        <div
          style={{
            position: "absolute",
            right: 22,
            top: 18,
            width: 92,
            height: 92,
            boxSizing: "border-box",
            border: "2px solid #141A47",
            borderRadius: "50%",
            background: "#F5ECD9",
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
            fontFamily: "var(--font-display), Georgia, serif",
            fontSize: 40,
            transform: "rotate(8deg)",
          }}
        >
          {formatPrice(product.priceCents)}
        </div>
      </div>

      <div style={{ position: "absolute", left: 44, top: 358, width: 632 }}>
        <div
          style={{
            fontFamily: "var(--font-display), Georgia, serif",
            fontSize: 50,
            lineHeight: 1,
            letterSpacing: "-0.02em",
          }}
        >
          {product.title}
        </div>
        <div
          style={{
            display: "flex",
            alignItems: "center",
            gap: 10,
            marginTop: 10,
            fontSize: 16,
          }}
        >
          <b>{product.merchant}</b>
          <VisaTag large />
          <span style={{ opacity: 0.7 }}>
            {product.isNew ? `New to ${person.name}` : `${person.name} shops here`}
          </span>
        </div>
      </div>

      <div
        style={{
          position: "absolute",
          left: 44,
          top: 470,
          width: 632,
          display: "flex",
          flexDirection: "column",
          gap: 12,
        }}
      >
        <ReasonBox kicker={`What ${person.name} does`} body={rec.behavior} rotate={-0.6} />
        <ReasonBox kicker="What the group knows" body={rec.signal} rotate={0.6} />
      </div>

      <div
        style={{
          position: "absolute",
          left: 44,
          top: 712,
          width: 632,
          display: "flex",
          gap: 12,
        }}
      >
        <button
          type="button"
          onClick={onBuy}
          style={{
            flex: 2,
            height: 64,
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
            gap: 10,
            border: 0,
            borderRadius: 999,
            background: "#141A47",
            color: "#F5ECD9",
            fontSize: 18,
            fontWeight: 700,
            boxShadow: "5px 5px 0 #B8412F",
          }}
        >
          See it at {product.merchant}
        </button>
        <button
          type="button"
          onClick={onToggleSave}
          aria-pressed={saved}
          style={{
            flex: 1,
            height: 64,
            border: "2px solid #141A47",
            borderRadius: 999,
            background: saved ? "#A8DCC2" : "#F5ECD9",
            color: "#141A47",
            fontSize: 16,
            fontWeight: 700,
            transition: "background .2s",
          }}
        >
          {saved ? "Saved to list" : "Save for later"}
        </button>
      </div>

      <div
        style={{
          position: "absolute",
          left: 44,
          top: 800,
          width: 632,
          fontFamily: "var(--font-hand), cursive",
          fontSize: 23,
          lineHeight: 1.05,
          transform: "rotate(-1deg)",
        }}
      >
        {person.name} will never see this search. Gifts stay a surprise until you say otherwise.
      </div>
    </>
  );
}

function GroupGiftPanel({
  who,
  started,
  onStart,
  onBuyShare,
}: {
  who: UserId;
  started: boolean;
  onStart: () => void;
  onBuyShare: (productId: string, amountCents: number) => void;
}) {
  const gift = groupGifts[who];
  const product = getProduct(gift.productId);
  const each = shareOf(product.priceCents, gift.splitWays);

  const others = giftableUserIds.filter((w) => w !== who);
  const contributors = (["kristina", ...others] as UserId[]).map((w, i) => {
    const isViewer = i === 0;
    const status = started
      ? isViewer
        ? `In: ${formatPrice(each)}`
        : "Invited"
      : isViewer
        ? `Ready: ${formatPrice(each)}`
        : "Not invited yet";
    const bg = started
      ? isViewer
        ? "#A8DCC2"
        : "#F5E39B"
      : isViewer
        ? "#A8DCC2"
        : "transparent";
    return { who: w, name: isViewer ? "You" : getUser(w).name, status, bg };
  });

  return (
    <div
      className="a-up"
      style={{
        position: "absolute",
        left: 44,
        top: 400,
        width: 632,
        boxSizing: "border-box",
        padding: 14,
        border: "2px solid #141A47",
        borderRadius: 26,
        background: "#F5ECD9",
        boxShadow: "5px 5px 0 #141A47",
      }}
    >
      <div
        style={{
          display: "flex",
          alignItems: "center",
          height: 38,
          padding: "0 16px",
          boxSizing: "border-box",
          border: "2px solid #141A47",
          borderRadius: 999,
          background: gift.bannerBg,
          fontSize: 15,
          fontWeight: 700,
        }}
      >
        {gift.banner}
      </div>

      <div style={{ display: "flex", gap: 16, marginTop: 12 }}>
        <div
          style={{
            width: 140,
            height: 140,
            flexShrink: 0,
            boxSizing: "border-box",
            border: "2px solid #141A47",
            borderRadius: 20,
            background: product.bg,
            padding: 12,
          }}
        >
          <ProductArt kind={product.art} />
        </div>
        <div
          style={{
            flex: 1,
            minWidth: 0,
            display: "flex",
            flexDirection: "column",
            gap: 4,
          }}
        >
          <div
            style={{
              fontFamily: "var(--font-display), Georgia, serif",
              fontSize: 30,
              lineHeight: 1,
            }}
          >
            {product.title}
          </div>
          <div style={{ display: "flex", alignItems: "center", gap: 8, fontSize: 14 }}>
            <b>{product.merchant}</b>
            <VisaTag />
          </div>
          <div style={{ fontSize: 14.5, marginTop: 4 }}>
            {formatPrice(product.priceCents)} total, split {gift.splitWays} ways
          </div>
          <div
            style={{
              fontFamily: "var(--font-display), Georgia, serif",
              fontSize: 50,
              lineHeight: 0.95,
              color: "#B8412F",
            }}
          >
            {formatPrice(each)}{" "}
            <span style={{ fontSize: 24, color: "#141A47" }}>each</span>
          </div>
        </div>
      </div>

      <div style={{ display: "flex", gap: 10, marginTop: 12 }}>
        {contributors.map((c) => (
          <div
            key={c.who}
            style={{
              flex: 1,
              display: "flex",
              alignItems: "center",
              gap: 10,
              padding: "6px 10px 6px 6px",
              boxSizing: "border-box",
              border: "2px solid #141A47",
              borderRadius: 999,
              background: c.bg,
              transition: "background .3s",
            }}
          >
            <div
              style={{
                width: 44,
                height: 44,
                flexShrink: 0,
                borderRadius: "50%",
                overflow: "hidden",
                border: "2px solid #141A47",
                boxSizing: "border-box",
                background: "#F5ECD9",
              }}
            >
              <Avatar who={c.who} />
            </div>
            <div style={{ lineHeight: 1.15 }}>
              <div style={{ fontSize: 15, fontWeight: 700 }}>{c.name}</div>
              <div style={{ fontSize: 12.5 }}>{c.status}</div>
            </div>
          </div>
        ))}
      </div>

      <button
        type="button"
        onClick={() => {
          if (!started) {
            onStart();
          } else {
            onBuyShare(product.id, each);
          }
        }}
        style={{
          marginTop: 12,
          width: "100%",
          height: 56,
          display: "flex",
          alignItems: "center",
          justifyContent: "center",
          gap: 10,
          border: "2px solid #141A47",
          borderRadius: 999,
          background: started ? "#A8DCC2" : "#141A47",
          color: started ? "#141A47" : "#F5ECD9",
          fontSize: 18,
          fontWeight: 700,
          boxShadow: "4px 4px 0 #B8412F",
          transition: "background .3s, color .3s",
        }}
      >
        {started ? `Approve your ${formatPrice(each)} share` : "Start Group Gift"}
      </button>

      <div style={{ fontSize: 13.5, lineHeight: 1.3, marginTop: 10 }}>
        <Label>Why</Label>
        {gift.why}
      </div>
    </div>
  );
}

function ReasonBox({
  kicker,
  body,
  rotate,
}: {
  kicker: string;
  body: string;
  rotate: number;
}) {
  return (
    <div
      style={{
        padding: "14px 18px",
        border: "2px solid #141A47",
        borderRadius: 22,
        background: "#F5ECD9",
        transform: `rotate(${rotate}deg)`,
      }}
    >
      <div
        style={{
          fontSize: 12,
          fontWeight: 700,
          letterSpacing: "0.14em",
          textTransform: "uppercase",
          color: "#B8412F",
        }}
      >
        {kicker}
      </div>
      <div style={{ fontSize: 18, lineHeight: 1.35, marginTop: 3 }}>{body}</div>
    </div>
  );
}

function Label({ children }: { children: React.ReactNode }) {
  return (
    <span
      style={{
        fontSize: 11,
        fontWeight: 700,
        letterSpacing: "0.12em",
        textTransform: "uppercase",
        color: "#B8412F",
        marginRight: 8,
      }}
    >
      {children}
    </span>
  );
}

export function VisaTag({ large = false }: { large?: boolean }) {
  return (
    <span
      style={{
        display: "inline-flex",
        alignItems: "center",
        gap: large ? 7 : 6,
        padding: large ? "3px 10px" : "2px 8px",
        borderRadius: 999,
        background: "#141A47",
        color: "#F5ECD9",
        fontSize: large ? 11 : 10.5,
        fontWeight: 700,
        letterSpacing: "0.1em",
        textTransform: "uppercase",
        whiteSpace: "nowrap",
      }}
    >
      <VisaMark height={large ? 11 : 10} tone="cream" />
      merchant
    </span>
  );
}
