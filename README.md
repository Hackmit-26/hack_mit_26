# Shop Wrapped

A private monthly recap for a close friend group. Social first, commerce second:
every recommendation arrives as something a friend already found.

Two processes. The backend is a real Fastify API over Supabase, with Anthropic
doing the gift reasoning and Visa Direct moving the money.

```bash
# backend
cd backend && pnpm install
cp .env.example .env                 # runs offline as-is
pnpm dev                             # http://localhost:8080

# frontend, in a second terminal, from the repo root
npm install
cp .env.local.example .env.local     # API base URL + the viewer to sign in as
npm run dev                          # http://localhost:3000
```

Out of the box `.env.example` is fully offline: `DB_MODE=memory` seeds from
fixtures, `LLM_MOCK=true` resolves every model call to a registered fixture and
`VISA_MODE=mock` answers like the sandbox does. Fill in the credentials and the
same code paths go live — there is no separate "demo" implementation.

## The demo path

`/` landing → `/group` → `/wrapped` → a gift → buy sheet → passkey → confirmed →
back to the story. `/settings` shows the privacy controls, `/join` the invite flow.

In the Wrapped: **← →** navigate, **space** advances, **R** replays. On a phone,
swipe or tap (right 60% forward, left 40% back).

## Layout model

Cards are drawn at the design's exact pixel sizes — 1440 × 1000 for the desktop
shell with a 720 × 900 card inside it, 390 × 844 full-bleed on mobile — and
`components/primitives/Stage.tsx` scales the whole stage to fit the viewport.
Nothing reflows between cards, so there are no layout jumps and the proportions
stay identical to the design at any window size.

## Where things live

```
src/
  app/            routes: landing, group, wrapped, join, settings
  components/
    primitives/   Avatar, ProductArt (25 illustrations), Stage, Glyphs
    shell/        the 1440×1000 desktop page shell
    chapters/     the five desktop story cards
    spotlights/   four spotlight covers — one system, varied layouts
    lore/         three lore case files
    mobile/       the 390×844 adaptations
    commerce/     BuySheet: options → spend limit → passkey → confirmation
    wrapped/      ReactionBar
  data/           seeded users, purchases, products, recommendations, reactions
  services/       checkout.ts (Visa-shaped), commerce.ts (sourcing + matching)
  state/          one reducer for reactions, privacy, saved items, orders
```

## The backend

`backend/` is a Fastify + TypeScript API over Supabase, with the AI and the
payments both real.

```
backend/src/
  routes/         items, finds, wishlist, reactions, comments, wrapped,
                  threads, contributions, reveals, birthdays, passkeys
  ai/             giftPicker, wrappedGenerator, ingest (receipt vision),
                  taste, embed — prompts under ai/prompts/
  domain/         threadStateMachine, splits, permissions, productLinks
  visa/           visaDirect (pull/push/reverse), mle, client, cards
  db/             store (authoritative), postgres (hydrate), mirror (write-through)
```

**Persistence.** The in-memory store is authoritative for the duration of a
request; Postgres is a projection. The API hydrates its working set from
Supabase at boot and mirrors writes back through `db/mirror.ts`, so the demo
never blocks on a round trip but nothing is lost across a restart.

**Gift picking is genuinely AI.** `ai/giftPicker.ts` builds a taste profile from
what the recipient actually saved, searches the catalogue over embeddings, and
asks Claude for a shortlist. Every pick must cite real items the recipient
hearted or wishlisted — a pick that cites nothing is rejected and retried, so
the reasoning you read on a card is grounded in that person's own history.

**Visa Direct.** `visa/visaDirect.ts` speaks the Funds Transfer API directly
over two-way SSL: `pullfundstransactions` to collect each contributor's share,
`pushfundstransactions` to disburse, `reversefundstransactions` to unwind a
cancelled pool. All three are live against the Visa sandbox: `pnpm visa:smoke`
runs a pull, a push and a reversal and expects `actionCode: "00"` from each.

Our project has Message Level Encryption on, so plaintext bodies are rejected
outright; `visa/mle.ts` wraps every request as a compact JWE (`RSA-OAEP-256` +
`A128GCM`) under an `encData` key and decrypts the response, which Visa seals to
our own certificate. Transactions are written to an append-only audit trail.

Two diagnostics exist because both failures are miserable to re-derive from the
error text. `pnpm visa:probe` separates the three ways a call dies before it
reaches the funds-transfer logic — 9611 not entitled, 9005 no such route, 9125
MLE expected — and checks the MLE certificate is Visa's rather than the
client certificate that sits next to it on the dashboard, since encrypting to
our own key reproduces 9125 exactly.

**A gift pool is a state machine.** `picking → voting → collecting → funded →
bought → revealed`, with `refunding → refunded` for a cancellation. Every
transition is guarded in `domain/threadStateMachine.ts`, so a late vote or a
double approval is a 409 rather than a double charge.

**Privacy is enforced server-side, not hidden in the UI.** The recipient of a
gift gets a 404 — never a 403 — on the thread, the reveal and its comments,
because *whether a gift exists* is itself the secret. Hearts are returned as an
anonymous count and never name who reacted. Finds carry no prices.

## Swapping in the rest

- **Product sourcing** — `services/commerce.ts`. `findOptions()` returns the same
  item, a close match and a budget option. Point it at a shopping-results API;
  callers don't change.
- **Payments UI** — `services/checkout.ts`, shaped after Visa Intelligent
  Commerce: `buildPaymentInstruction` → `requestPasskeyApproval` →
  `requestCredentials` → `completePurchase` → `sendOutcomeSignal`.
  `runCheckout()` drives the sheet's stages; the money itself moves through
  Visa Direct on the backend.

## Tests

```bash
npx vitest run                  # frontend
cd backend && pnpm test         # backend
```

Both suites are offline and deterministic: the backend's `vitest.config.ts`
pins `DB_MODE=memory` and `LLM_MOCK=true` so a populated `.env` can never point
the suite at live Supabase or a real model.

## Design source

Ported from the Shop Wrapped design canvas: colours, type scale, card grounds,
copy and animations come from those artboards. The landing, group, join and
settings screens are not in the canvas — they are built from the same system
(midnight ground, cream paper, ink outlines, hard offset shadows, Instrument
Serif over Hanken Grotesk with Caveat annotations).
