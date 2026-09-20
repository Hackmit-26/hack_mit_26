"use client";

import { AnimatePresence, motion } from "framer-motion";
import { useEffect, useState } from "react";

import { Avatar } from "@/components/primitives/Avatar";
import { Check, Lock, Sparkle } from "@/components/primitives/Glyphs";
import { ItemLink } from "@/components/primitives/ItemLink";
import { ProductArt } from "@/components/primitives/ProductArt";
import { VisaMark } from "@/components/primitives/VisaMark";
import { VisaTag } from "@/components/chapters/GiftCard";
import { getUser } from "@/data/users";
import {
  findOptions,
  formatPrice,
  searchUrl,
  type ProductOption,
} from "@/services/commerce";
import {
  buildPaymentInstruction,
  defaultSpendLimits,
  exceedsLimits,
  runCheckout,
  type CheckoutStage,
  type PaymentInstruction,
  type PurchaseOutcome,
} from "@/services/checkout";
import { useApp } from "@/state/store";
import type { UserId } from "@/lib/types";

export interface BuyRequest {
  productId: string;
  forUserId?: UserId;
  inspiredByUserId?: UserId;
  /** A group-gift share rather than the full price. */
  amountCentsOverride?: number;
}

/**
 * The buy sheet: same item, close match or budget option, then a checkout
 * that shows the spend limit and takes a passkey approval before anything
 * is charged. All payment work is delegated to `services/checkout`.
 */
export function BuySheet({
  request,
  onClose,
}: {
  request: BuyRequest | null;
  onClose: () => void;
}) {
  const { recordOrder } = useApp();

  const [options, setOptions] = useState<ProductOption[]>([]);
  const [chosen, setChosen] = useState(0);
  const [stage, setStage] = useState<CheckoutStage>("idle");
  const [instruction, setInstruction] = useState<PaymentInstruction | null>(null);
  const [outcome, setOutcome] = useState<PurchaseOutcome | null>(null);

  // Load the three sourced options whenever a new item is opened.
  useEffect(() => {
    let live = true;
    if (!request) return;

    setOptions([]);
    setChosen(0);
    setStage("reviewing");
    setOutcome(null);
    setInstruction(null);

    findOptions(request.productId).then((next) => {
      if (live) setOptions(next);
    });

    return () => {
      live = false;
    };
  }, [request]);

  // Esc closes the sheet, except while the charge is in flight.
  useEffect(() => {
    if (!request) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape" && stage !== "authorizing" && stage !== "processing") {
        e.stopPropagation();
        onClose();
      }
    };
    window.addEventListener("keydown", onKey, true);
    return () => window.removeEventListener("keydown", onKey, true);
  }, [request, stage, onClose]);

  if (!request) return null;

  const option = options[chosen];
  const amountCents =
    request.amountCentsOverride ?? option?.product.priceCents ?? 0;
  const overLimit = instruction ? exceedsLimits(instruction) : false;

  const start = async () => {
    if (!option) return;
    const next = buildPaymentInstruction({
      product: option.product,
      forUserId: request.forUserId,
      inspiredByUserId: request.inspiredByUserId,
      amountCentsOverride: request.amountCentsOverride,
    });
    setInstruction(next);

    const result = await runCheckout(next, setStage);
    setOutcome(result);
    recordOrder(result);
  };

  const busy = stage === "authorizing" || stage === "processing";

  return (
    <AnimatePresence>
      <motion.div
        key="buy-sheet"
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        exit={{ opacity: 0 }}
        transition={{ duration: 0.2 }}
        style={{
          position: "absolute",
          inset: 0,
          background: "rgba(11,15,42,0.72)",
          backdropFilter: "blur(6px)",
          display: "flex",
          alignItems: "center",
          justifyContent: "center",
          zIndex: 40,
        }}
        onClick={() => !busy && onClose()}
      >
        <motion.div
          role="dialog"
          aria-modal="true"
          aria-label="Buy sheet"
          initial={{ y: 40, opacity: 0, scale: 0.98 }}
          animate={{ y: 0, opacity: 1, scale: 1 }}
          exit={{ y: 24, opacity: 0 }}
          transition={{ duration: 0.34, ease: [0.2, 0.8, 0.3, 1] }}
          onClick={(e) => e.stopPropagation()}
          style={{
            position: "relative",
            width: 640,
            maxHeight: 860,
            boxSizing: "border-box",
            borderRadius: 32,
            background: "#F5ECD9",
            color: "#141A47",
            border: "2px solid #141A47",
            boxShadow: "8px 8px 0 #141A47",
            padding: 30,
            overflow: "hidden",
          }}
        >
          <AnimatePresence mode="wait">
            {stage === "confirmed" && outcome ? (
              <Confirmed
                key="confirmed"
                outcome={outcome}
                option={option}
                request={request}
                onClose={onClose}
              />
            ) : busy ? (
              <Authorizing key="authorizing" stage={stage} amountCents={amountCents} />
            ) : (
              <Review
                key="review"
                options={options}
                chosen={chosen}
                setChosen={setChosen}
                request={request}
                amountCents={amountCents}
                overLimit={overLimit}
                onCancel={onClose}
                onContinue={start}
              />
            )}
          </AnimatePresence>
        </motion.div>
      </motion.div>
    </AnimatePresence>
  );
}

function Review({
  options,
  chosen,
  setChosen,
  request,
  amountCents,
  overLimit,
  onCancel,
  onContinue,
}: {
  options: ProductOption[];
  chosen: number;
  setChosen: (i: number) => void;
  request: BuyRequest;
  amountCents: number;
  overLimit: boolean;
  onCancel: () => void;
  onContinue: () => void;
}) {
  const option = options[chosen];
  const limits = defaultSpendLimits;
  const remaining = limits.monthlyCents - limits.monthlyUsedCents - amountCents;

  return (
    <motion.div
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      exit={{ opacity: 0 }}
      transition={{ duration: 0.18 }}
      style={{ display: "flex", flexDirection: "column", gap: 16 }}
    >
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
        <div
          style={{
            fontSize: 13,
            fontWeight: 700,
            letterSpacing: "0.16em",
            textTransform: "uppercase",
            color: "#C4553F",
          }}
        >
          {request.amountCentsOverride ? "Your share" : "Choose your option"}
        </div>
        <button
          type="button"
          onClick={onCancel}
          aria-label="Close"
          style={{
            width: 34,
            height: 34,
            border: "2px solid #141A47",
            borderRadius: "50%",
            background: "transparent",
            fontSize: 16,
            fontWeight: 700,
            lineHeight: 1,
          }}
        >
          ✕
        </button>
      </div>

      {!option ? (
        <div style={{ height: 320, display: "flex", alignItems: "center", justifyContent: "center" }}>
          <div style={{ fontFamily: "var(--font-hand), cursive", fontSize: 26, opacity: 0.7 }}>
            finding it at real merchants…
          </div>
        </div>
      ) : (
        <>
          <div style={{ display: "flex", gap: 18, alignItems: "center" }}>
            <ItemLink
              url={searchUrl(option.product.title, option.product.merchant)}
              label={`${option.product.title} at ${option.product.merchant}`}
              style={{
                width: 150,
                height: 150,
                flexShrink: 0,
                boxSizing: "border-box",
                border: "2px solid #141A47",
                borderRadius: 22,
                background: option.product.bg,
                padding: 14,
                boxShadow: "5px 5px 0 #141A47",
              }}
            >
              <ProductArt kind={option.product.art} src={option.product.image} />
            </ItemLink>
            <div style={{ flex: 1, minWidth: 0 }}>
              <ItemLink
                url={searchUrl(option.product.title, option.product.merchant)}
                label={`${option.product.title} at ${option.product.merchant}`}
                style={{
                  fontFamily: "var(--font-display), Georgia, serif",
                  fontSize: 34,
                  lineHeight: 1,
                  letterSpacing: "-0.01em",
                }}
              >
                {option.product.title}
              </ItemLink>
              <div
                style={{
                  display: "flex",
                  alignItems: "center",
                  gap: 8,
                  fontSize: 15,
                  marginTop: 8,
                }}
              >
                <b>{option.product.merchant}</b>
                <VisaTag />
              </div>
              <div
                style={{
                  fontFamily: "var(--font-display), Georgia, serif",
                  fontSize: 44,
                  lineHeight: 1,
                  marginTop: 6,
                }}
              >
                {formatPrice(amountCents)}
              </div>
              {request.amountCentsOverride && (
                <div style={{ fontSize: 14, opacity: 0.75 }}>
                  your share of {formatPrice(option.product.priceCents)}
                </div>
              )}
            </div>
          </div>

          {!request.amountCentsOverride && (
            <div
              role="group"
              aria-label="Product options"
              style={{ display: "flex", gap: 8 }}
            >
              {options.map((o, i) => {
                const on = i === chosen;
                return (
                  <button
                    key={o.product.id}
                    type="button"
                    onClick={() => setChosen(i)}
                    aria-pressed={on}
                    style={{
                      flex: 1,
                      padding: "10px 12px",
                      boxSizing: "border-box",
                      border: "2px solid #141A47",
                      borderRadius: 18,
                      background: on ? "#141A47" : "#FBF6EA",
                      color: on ? "#F5ECD9" : "#141A47",
                      textAlign: "left",
                      transition: "background .2s, color .2s",
                    }}
                  >
                    <div style={{ fontSize: 14, fontWeight: 700 }}>{o.label}</div>
                    <div style={{ fontSize: 13, opacity: 0.85, lineHeight: 1.25 }}>
                      {formatPrice(o.product.priceCents)} · {o.product.merchant}
                    </div>
                  </button>
                );
              })}
            </div>
          )}

          <div
            style={{
              padding: "14px 18px",
              border: "2px solid #141A47",
              borderRadius: 22,
              background: "#FBF6EA",
              display: "flex",
              flexDirection: "column",
              gap: 8,
            }}
          >
            <div style={{ display: "flex", gap: 10, alignItems: "flex-start", fontSize: 15.5 }}>
              <Check />
              {option.reason}
            </div>
            {request.forUserId && (
              <div style={{ display: "flex", gap: 10, alignItems: "flex-start", fontSize: 15.5 }}>
                <Check />
                Within {getUser(request.forUserId).name}’s normal spending range
              </div>
            )}
            {request.inspiredByUserId && (
              <div style={{ display: "flex", gap: 10, alignItems: "center", fontSize: 15.5 }}>
                <span
                  style={{
                    width: 26,
                    height: 26,
                    borderRadius: "50%",
                    border: "2px solid #141A47",
                    overflow: "hidden",
                    flexShrink: 0,
                  }}
                >
                  <Avatar who={request.inspiredByUserId} />
                </span>
                Credited to {getUser(request.inspiredByUserId).name}, who found it
              </div>
            )}
          </div>

          {/* spend limit — always visible before approval */}
          <div
            style={{
              display: "flex",
              alignItems: "center",
              justifyContent: "space-between",
              padding: "10px 16px",
              boxSizing: "border-box",
              border: `2px ${overLimit ? "solid #D6455A" : "dashed #141A47"}`,
              borderRadius: 999,
              fontSize: 14,
            }}
          >
            <span style={{ display: "flex", alignItems: "center", gap: 8, fontWeight: 700 }}>
              <Lock />
              Spend limit {formatPrice(limits.perPurchaseCents)} per purchase
            </span>
            <span style={{ opacity: 0.75 }}>
              {formatPrice(Math.max(remaining, 0))} left this month
            </span>
          </div>

          <div style={{ display: "flex", gap: 10 }}>
            <button
              type="button"
              onClick={onContinue}
              disabled={overLimit}
              style={{
                flex: 2,
                height: 58,
                border: 0,
                borderRadius: 999,
                background: "#141A47",
                color: "#F5ECD9",
                fontSize: 17,
                fontWeight: 700,
                boxShadow: "4px 4px 0 #E8806F",
                opacity: overLimit ? 0.5 : 1,
              }}
            >
              Continue to approval
            </button>
            <button
              type="button"
              onClick={onCancel}
              style={{
                flex: 1,
                height: 58,
                border: "2px solid #141A47",
                borderRadius: 999,
                background: "transparent",
                fontSize: 16,
                fontWeight: 700,
              }}
            >
              Not now
            </button>
          </div>

          <div
            style={{
              fontFamily: "var(--font-hand), cursive",
              fontSize: 21,
              lineHeight: 1,
              textAlign: "center",
              opacity: 0.8,
            }}
          >
            price is only visible to you.
          </div>
        </>
      )}
    </motion.div>
  );
}

function Authorizing({
  stage,
  amountCents,
}: {
  stage: CheckoutStage;
  amountCents: number;
}) {
  const authorizing = stage === "authorizing";

  return (
    <motion.div
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      exit={{ opacity: 0 }}
      transition={{ duration: 0.18 }}
      style={{
        height: 420,
        display: "flex",
        flexDirection: "column",
        alignItems: "center",
        justifyContent: "center",
        gap: 22,
        textAlign: "center",
      }}
    >
      <motion.div
        animate={{ scale: [1, 1.06, 1] }}
        transition={{ duration: 1.4, repeat: Infinity, ease: "easeInOut" }}
        style={{
          width: 130,
          height: 130,
          borderRadius: "50%",
          border: "3px solid #141A47",
          background: authorizing ? "#BBA9E8" : "#A8DCC2",
          display: "flex",
          alignItems: "center",
          justifyContent: "center",
          boxShadow: "6px 6px 0 #141A47",
          transition: "background .4s",
        }}
      >
        {authorizing ? (
          <svg width="64" height="64" viewBox="0 0 48 48" fill="none" aria-hidden="true">
            <rect
              x="9"
              y="21"
              width="30"
              height="21"
              rx="6"
              fill="#F5ECD9"
              stroke="#141A47"
              strokeWidth="2.6"
            />
            <path
              d="M16 21 V15 a8 8 0 0 1 16 0 V21"
              stroke="#141A47"
              strokeWidth="2.6"
              strokeLinecap="round"
            />
            <circle cx="24" cy="31" r="3.4" fill="#141A47" />
          </svg>
        ) : (
          <motion.div
            animate={{ rotate: 360 }}
            transition={{ duration: 1.1, repeat: Infinity, ease: "linear" }}
            style={{
              width: 58,
              height: 58,
              borderRadius: "50%",
              border: "5px solid #141A47",
              borderTopColor: "transparent",
            }}
          />
        )}
      </motion.div>

      <div
        style={{
          fontFamily: "var(--font-display), Georgia, serif",
          fontSize: 42,
          lineHeight: 1,
        }}
      >
        {authorizing ? "Approve with your passkey" : "Paying the merchant"}
      </div>
      <div style={{ fontSize: 17, lineHeight: 1.4, maxWidth: 420 }}>
        {authorizing
          ? `Confirm ${formatPrice(amountCents)} with Face ID. The agent can't spend more, or anywhere else, than you approve.`
          : "Requesting an agent token and completing the order."}
      </div>
      <div
        style={{
          display: "flex",
          alignItems: "center",
          gap: 10,
          fontSize: 14,
          opacity: 0.75,
        }}
      >
        <Lock />
        We never store card numbers.
        <span style={{ opacity: 0.5 }}>·</span>
        <VisaMark height={13} />
      </div>
    </motion.div>
  );
}

function Confirmed({
  outcome,
  option,
  request,
  onClose,
}: {
  outcome: PurchaseOutcome;
  option?: ProductOption;
  request: BuyRequest;
  onClose: () => void;
}) {
  return (
    <motion.div
      initial={{ opacity: 0, y: 12 }}
      animate={{ opacity: 1, y: 0 }}
      exit={{ opacity: 0 }}
      transition={{ duration: 0.3, ease: [0.2, 0.8, 0.3, 1] }}
      style={{ display: "flex", flexDirection: "column", gap: 18, alignItems: "center", textAlign: "center" }}
    >
      <div className="a-stamp" style={{ marginTop: 6 }}>
        <div
          style={{
            width: 118,
            height: 118,
            borderRadius: "50%",
            border: "3px solid #141A47",
            background: "#A8DCC2",
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
            boxShadow: "6px 6px 0 #141A47",
          }}
        >
          <svg width="62" height="62" viewBox="0 0 48 48" fill="none" aria-hidden="true">
            <path
              d="M12 25 L20 33 L36 15"
              stroke="#141A47"
              strokeWidth="4.5"
              strokeLinecap="round"
              strokeLinejoin="round"
            />
          </svg>
        </div>
      </div>

      <div
        style={{
          fontFamily: "var(--font-display), Georgia, serif",
          fontSize: 46,
          lineHeight: 1,
        }}
      >
        Ordered from <em style={{ color: "#C4553F" }}>{outcome.merchant}</em>
      </div>

      {option && (
        <ItemLink
          url={searchUrl(option.product.title, option.product.merchant)}
          label={`${option.product.title} at ${option.product.merchant}`}
          style={{ display: "flex", alignItems: "center", gap: 14 }}
        >
          <div
            style={{
              width: 76,
              height: 76,
              boxSizing: "border-box",
              border: "2px solid #141A47",
              borderRadius: 16,
              background: option.product.bg,
              padding: 8,
            }}
          >
            <ProductArt kind={option.product.art} src={option.product.image} />
          </div>
          <div style={{ textAlign: "left" }}>
            <div style={{ fontSize: 17, fontWeight: 700 }}>{option.product.title}</div>
            <div style={{ fontSize: 15, opacity: 0.8 }}>
              {formatPrice(outcome.amountCents)} · only visible to you
            </div>
          </div>
        </ItemLink>
      )}

      {request.inspiredByUserId && (
        <div
          style={{
            display: "flex",
            alignItems: "center",
            gap: 10,
            padding: "6px 18px 6px 6px",
            border: "2px solid #141A47",
            borderRadius: 999,
            background: "#F5E39B",
            boxShadow: "3px 3px 0 #141A47",
          }}
        >
          <span
            style={{
              width: 38,
              height: 38,
              borderRadius: "50%",
              overflow: "hidden",
              border: "2px solid #141A47",
              flexShrink: 0,
            }}
          >
            <Avatar who={request.inspiredByUserId} />
          </span>
          <span style={{ fontSize: 15, fontWeight: 700 }}>
            Credited to {getUser(request.inspiredByUserId).name}
          </span>
          <Sparkle size={20} />
        </div>
      )}

      <div
        style={{
          fontFamily: "var(--font-hand), cursive",
          fontSize: 23,
          lineHeight: 1.1,
          color: "#C4553F",
          maxWidth: 440,
        }}
      >
        {request.forUserId
          ? `${getUser(request.forUserId).name} will never see this search.`
          : "this one shows up in next month's Wrapped."}
      </div>

      <div
        style={{
          display: "flex",
          alignItems: "center",
          justifyContent: "center",
          gap: 8,
          fontSize: 13,
          opacity: 0.65,
        }}
      >
        <VisaMark height={12} />
        Receipt {outcome.id} · card ending 4242
      </div>

      <button
        type="button"
        onClick={onClose}
        style={{
          width: "100%",
          height: 58,
          border: 0,
          borderRadius: 999,
          background: "#141A47",
          color: "#F5ECD9",
          fontSize: 17,
          fontWeight: 700,
          boxShadow: "4px 4px 0 #E8806F",
        }}
      >
        Back to the Wrapped
      </button>
    </motion.div>
  );
}
