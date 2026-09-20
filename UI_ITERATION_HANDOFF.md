# Handoff: UI design/critique/build loops

You are picking up **Unwrap** — a private monthly shopping recap for a close friend group, plus
AI group-gifting funded by real Visa Direct calls. The backend and all three Visa legs (pull / push /
reverse) work against the live sandbox. **Nothing in this loop should require touching Visa code.**

Your job is repeated loops of: look at the UI → critique it → change design or add functionality →
verify → repeat.

---

## 1. Get it running (5 minutes)

Two package managers. **Root is npm. `backend/` is pnpm.** Mixing them produces
`ERR_PNPM_IGNORED_BUILDS` and a stray root lockfile. Watch your cwd — this bites every time.

### Fast mode — use this for 95% of UI work

```bash
# terminal 1
cd backend
PORT=8081 DB_MODE=memory DEMO_MODE=true LLM_MOCK=true VISA_MODE=mock pnpm dev

# terminal 2 (repo root)
NEXT_PUBLIC_API_BASE_URL=http://localhost:8081 npm run dev
```

No Postgres, no LLM latency, no Visa. `curl -X POST localhost:8081/demo/reset` → `204` resets to a
clean seeded world in milliseconds. Reset freely; you'll want it constantly.

Seeded under demo mode: users `esh`, `kristina`, `madhav`, `sabina`; group `tea-party`
("The Tea Party", invite code `TEAPARTY`). Kristina organises both threads and is the stage login.
One thread in `picking` — Sabina's birthday, so picks generate live — and one in `collecting` —
Esh's birthday, two shares already pulled, which the organiser cancels to show the Visa reversal.

### Real mode — for integration truth before you ship

```bash
cd backend && pnpm dev        # port 8080; reads .env: DB_MODE=postgres, VISA_MODE=sandbox, LLM_MOCK=false
npm run dev                   # root; defaults to http://localhost:8080
```

`POST /demo/reset` is **deliberately disabled when `DB_MODE=postgres`**. Don't "fix" that.

### The trap that will burn you

Demo mode: **96/96 finds have images.** Real Postgres: **15/217 finds have images**, **0/3087
products have a `product_url`**, **0/202 purchases have an `image_url`**.

A design that looks great in demo mode can be a wall of broken placeholders in production. Every
card, tile, and grid you touch needs a deliberate imageless state. Check your work against real mode
at least once per loop before calling something done.

---

## 2. The frontend as it stands

Next.js 15 App Router, React 19, framer-motion 11.

**Routes** (`src/app/`): `/` · `/welcome` · `/landing` · `/join` · `/group` · `/wishlist` ·
`/wrapped` · `/settings`

**Components** (`src/components/`): `chapters` `comments` `commerce` `layout` `lore` `mobile`
`primitives` `shell` `spotlights` `welcome` `wishlist` `wrapped`

**Styling convention — read this before writing CSS.** The codebase is ~100% inline
`style={{ ... }}`. Tailwind 3.4.17 is installed and configured but effectively unused beyond the
`@tailwind` directives. **Follow the existing inline convention.** Do not start a Tailwind migration
mid-hackathon; a half-converted codebase is worse than either endpoint.

- Palette tokens live in `tailwind.config.ts` (midnight `#0B0F2A`, cream `#F5ECD9`, a coral family,
  etc.) — read them from there even though you'll apply them inline.
- Fonts: `--font-display` / `--font-body` / `--font-hand`, wired in `src/app/layout.tsx`.
- 16 named keyframe animations in `src/app/globals.css`. Reuse them before writing a new one.

**Data layer:**
- `src/lib/api.ts` — ~40 functions, the single boundary to the backend.
- `src/lib/config.ts` — base URL, default `http://localhost:8080`. Override with
  `NEXT_PUBLIC_API_BASE_URL`.
- Auth is a module-level token; `setViewer(userId)` switches the acting user. Backend accepts
  `Authorization: Bearer dev:<userId>`. Switching viewers is how you test multi-user flows solo.
- `waitForPicks` polls for AI gift picks. Under `LLM_MOCK=true` it returns instantly; against the
  real model it takes **25–30s**. If you touch that code path, don't tune timeouts against mock mode.

---

## 3. The loop

Each iteration:

1. **Look.** Open the route in a browser at a real viewport. Mobile matters — there's a whole
   `mobile/` component dir and the demo is likely shown on a phone-sized window.
2. **Critique specifically.** "The gift thread card has no hierarchy — price, contributor count, and
   deadline are all the same weight" beats "it looks cluttered." Write the critique down before you
   start editing or you'll drift into whatever's easiest to change.
3. **Change one coherent thing.** Resist bundling an unrelated refactor into a design pass.
4. **Verify** (below).
5. **Re-open the browser and confirm.** Type checks prove the code compiles, not that the design
   works. Never report a UI change as done without having looked at it.

### Verification gates

```bash
# frontend (repo root, npm)
npm run typecheck && npm run build && npm test     # baseline: 74/74 passing, 7 test files

# backend (only if you touched it)
cd backend && pnpm typecheck && pnpm test          # baseline: 184/184 passing
```

Test coverage is thin on components — only `comments/` and `wishlist/` have component tests
(`comments.test.tsx`, `commentsStore.test.tsx`, `wishlist.test.tsx`, `wishlistStore.test.tsx`,
`primitives/itemLink.test.tsx`), plus `lib/api.test.ts` and `lib/commentsApi.test.ts`. If you add
real logic — not just styling — add a test beside it in the same pattern.

---

## 4. Operational hazards (all hit for real this session)

- **Supabase session pooler caps the whole project at 15 connections.** The pg pool is set to
  `max: 4` on purpose (`backend/src/db/postgres.ts`). Don't raise it.
- **Orphaned `tsx watch` processes hold connections open** and cause `EMAXCONNSESSION` or
  `EADDRINUSE` on the next boot. When the backend won't start:
  `lsof -ti:8080` and `ps aux | grep server.ts`, then kill the strays.
- **Postgres mirrors are fire-and-forget** (`void mirrorX(...)`). A `200` response can sit on top of
  a failed database write. If data seems to vanish, grep the backend log for `mirror failed` — that
  is exactly how a JSON-corruption bug hid for hours.
- **Ports:** backend 8080 (or 8081 in fast mode), frontend 3000. The backend is *not* on 4000.
- **`npm run build` poisons a running `npm run dev`.** They share `.next`, and a build that fails
  partway leaves production manifests behind — `build-manifest.json` ends up listing only `/_app`,
  and every page then serves `missing required error components, refreshing...` in an infinite
  reload. Nothing is wrong with your code. Stop the dev server, `rm -rf .next`, start it again.
  Run build gates when no dev server is up, or in a separate checkout.
- **A second frontend lands on :3001 and is CORS-blocked.** The backend's `FRONTEND_ORIGIN`
  defaults to `http://localhost:3000`, so the pages render empty while the API is perfectly
  healthy. Pass `FRONTEND_ORIGIN=http://localhost:3001` to the backend you point it at.

---

## 5. State you're inheriting

- Postgres currently has **no thread in `picking` / `voting` / `collecting`** — only `revealed` ×2,
  `funded` ×1, `refunded` ×4. Creating a fresh one in real mode costs ~25–30s of real LLM time. This
  is another reason to do design work in fast mode.
- Work lives on the `integration` branch. `origin/main` does **not** have the working Visa code yet.
  Branch off `integration`, not main.
- Untracked stray `pnpm-lock.yaml` / `pnpm-workspace.yaml` at repo root — artifacts of a package
  manager mixup. Harmless; don't commit them.
- There is no `CLAUDE.md` anywhere in the repo.

## 6. Open data gaps (owned by the schema teammate, not you)

Don't fix these in the frontend — design around them and flag if they block you:
`products.product_url` NULL ×3087 · `purchases.image_url` NULL ×202 · only 15/217 finds have images.
