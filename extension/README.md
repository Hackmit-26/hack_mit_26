# Unwrap — Chrome extension

Save any product page to your wishlist, or share it with your group as a find, without leaving the
page you found it on.

Manifest V3, no build step. The files in `src/` are what Chrome loads.

## Install

1. `chrome://extensions` → enable **Developer mode** → **Load unpacked** → pick this `extension/`
   folder.
2. Click the extension icon → **⚙** (or `chrome://extensions` → Details → Extension options).
3. Set the **API base URL** and hit **Test connection**:
   - `http://localhost:8081` for the fast demo backend (`DB_MODE=memory DEMO_MODE=true`)
   - `http://localhost:8080` for the real one
4. Pick a viewer. In demo mode the chips (`esh`, `kristina`, `madhav`, `sabina` — the personas in
   `backend/fixtures/seed-personas.json`) work with one click; otherwise type a real user id and
   hit **Verify**.
5. Choose a default group (`The Tea Party` in demo mode) and hit **Save settings**.

## Using it

| Entry point | What happens |
| --- | --- |
| Toolbar icon | Reads the page, shows an editable card, you pick the destination and save |
| `⌘⇧U` / `Ctrl+Shift+U` | Saves the page immediately with your default destination, confirms with an in-page toast |
| Right-click → *Save to my Unwrap wishlist* | Same, private |
| Right-click → *Share with &lt;group&gt;* | Same, as a group find |
| Right-click **a link** → either item | Saves the link's target, previewed server-side |

Destinations map onto `items.visibility`:

- **Just me** → `private`. Only ever on your own `GET /wishlist`.
- **Group** → `shared`. Appears in `GET /groups/:id/finds` with your name on it.
- **Anon** → `anonymous`. Appears in finds with no owner attached.

Every save also writes a `wishlist` reaction, which is what actually puts the item on
`GET /wishlist` — the item row alone is not enough.

## Why it scrapes in the page

`backend/src/products/linkPreview.ts` fetches the URL server-side with a bot user-agent. The
retailers worth saving from answer that with a 503, a consent interstitial, or a login wall. The
browser already has the rendered, cookied page, so `src/extract.js` reads it in place —
schema.org JSON-LD first, then Open Graph, then the DOM. The server-side preview is still the
fallback for right-clicked links and for pages Chrome will not let an extension touch
(`chrome://`, the Web Store, the PDF viewer).

## Why every request goes through the service worker

The backend sets CORS to `FRONTEND_ORIGIN` only. An extension *page* would be blocked by that, but
an MV3 service worker fetching a host listed in `host_permissions` is exempt from CORS — so
`src/background.js` owns every request and the backend needs no change to accept the extension.

Only `http://localhost/*` and `http://127.0.0.1/*` are in the manifest. Point the extension at
anything else (a tunnel, a deployed API) and the options page asks Chrome for that host at the
moment you hit **Test connection**.

## Verifying it

```bash
npx vitest run extension/test/extract.test.js   # the extractor, against fixed DOM fixtures
node extension/test/live-api.mjs                # extract.js -> itemBodyFrom -> a running backend
node extension/test/crawl-live.mjs [url ...]    # a real Chrome, real retailer pages
node extension/test/integration.mjs             # ...and out the other side, into the web app
```

`integration.mjs` is the end-to-end one: it saves through the shipped extension path, then drives
a browser to `/wishlist` and `/wrapped` and checks the item is actually on the page with its
scraped image, price and product link — and that the `private` save never reaches the group.

`live-api.mjs` lifts `itemBodyFrom` verbatim out of `background.js` rather than reimplementing it,
so it fails if the shipped save body ever stops matching `POST /items`. It needs the fast backend
on `:8081` and resets the demo world first.

`crawl-live.mjs` launches a headful Chrome on a throwaway profile and evaluates `src/extract.js`
inside the live page over CDP — the same thing `chrome.scripting.executeScript` does. What it
found on a real run:

| Site | Result |
| --- | --- |
| uniqlo, nike, ikea | complete tile — title, image, price, merchant, category |
| rei | title, image, merchant, category; **no price** — prices sit in hashed CSS-module classes with no `itemprop`, no Product JSON-LD |
| stale/404 URLs | the error page's own title and image, `confident: false` where there is no price |

Two things worth knowing. **Headless Chrome is bot-walled** by REI, Patagonia, Best Buy and others —
their DOM comes back with no product in it at all. That is a property of headless, not of the
extractor: the extension runs in the user's own signed-in tab, which is why `crawl-live.mjs` is
headful. And **a site can simply not expose its price**; `confident: false` is the honest signal,
and the popup leaves the field editable for exactly that case.

## Layout

```
manifest.json
icons/                generated PNGs, cream + coral to match the app
src/
  background.js       service worker: the only code that talks to the backend
  api.js              typed-ish wrapper over the Fastify routes
  settings.js         chrome.storage.sync, defaults, host-permission helpers
  extract.js          injected into the page; returns one product guess
  popup.html/.css/.js the editable save card
  options.html/.css/.js
```

## Endpoints used

| Call | Route |
| --- | --- |
| Who am I | `GET /me`, `GET /me/groups` |
| Duplicate check | `GET /items/mine` |
| Save | `POST /items` then `POST /reactions` |
| Link fallback | `POST /wishlist/link`, then `PATCH /items/:id` when sharing |
| Connection test | `GET /health` |

No new backend surface — everything above already existed.
