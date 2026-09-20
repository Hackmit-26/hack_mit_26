# Shop Wrapped

A private monthly recap for a close friend group. Social first, commerce second:
every recommendation arrives as something a friend already found.

```bash
npm install
npm run dev      # http://localhost:3000
```

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

## Swapping in the backend

Nothing fake lives in a component.

- **Product sourcing** — `services/commerce.ts`. `findOptions()` returns the same
  item, a close match and a budget option. Point it at a shopping-results API;
  callers don't change.
- **Payments** — `services/checkout.ts`, shaped after Visa Intelligent Commerce:
  `buildPaymentInstruction` → `requestPasskeyApproval` → `requestCredentials` →
  `completePurchase` → `sendOutcomeSignal`. `runCheckout()` drives the sheet's
  stages. Replace the four calls with the sandbox and the UI is untouched.
- **Data** — every module under `src/data/` exports plain typed values matching
  `src/lib/types.ts`. Re-export the same names from API clients to go live.

## Design source

Ported from the Shop Wrapped design canvas: colours, type scale, card grounds,
copy and animations come from those artboards. The landing, group, join and
settings screens are not in the canvas — they are built from the same system
(midnight ground, cream paper, ink outlines, hard offset shadows, Instrument
Serif over Hanken Grotesk with Caveat annotations).
