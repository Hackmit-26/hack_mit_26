// Proves an extension save lands in the app the design loop is building — not just in the API.
// Saves through the real extract.js + background.js body builder, then renders the actual Next
// pages in a headless browser and looks for the item.
//
//   node extension/test/integration.mjs                  backend :8081, frontend :3000
//   APP=http://localhost:3001 node .../integration.mjs    when 3000 is already taken
//
// If the frontend is not on :3000, the backend needs `FRONTEND_ORIGIN` to match it or every
// browser fetch is CORS-blocked and every page renders empty. The extension itself is immune —
// an MV3 service worker is exempt from CORS — so this only bites the harness, never the user.
import { spawn } from "node:child_process";
import { mkdtempSync, readFileSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { JSDOM, VirtualConsole } from "jsdom";

const CHROME = "/Applications/Google Chrome.app/Contents/MacOS/Google Chrome";
const PORT = 9335;
const API = process.env.API ?? "http://localhost:8081";
const APP = process.env.APP ?? "http://localhost:3000";
// The frontend's DEFAULT_VIEWER_ID, so the pages render as the same person we save as.
const VIEWER = "kristina";

const extractSrc = readFileSync(new URL("../src/extract.js", import.meta.url), "utf8");
const bgSrc = readFileSync(new URL("../src/background.js", import.meta.url), "utf8");
const start = bgSrc.indexOf("function itemBodyFrom");
const itemBodyFrom = new Function(
  `${bgSrc.slice(start, bgSrc.indexOf("\n}", start) + 2)}; return itemBodyFrom;`,
)();

let failures = 0;
const check = (label, ok, detail = "") => {
  console.log(`  ${ok ? "PASS" : "FAIL"}  ${label}${detail ? ` — ${detail}` : ""}`);
  if (!ok) failures += 1;
};

const call = async (path, { method = "GET", body, user = VIEWER } = {}) => {
  const res = await fetch(`${API}${path}`, {
    method,
    headers: { authorization: `Bearer dev:${user}`, ...(body ? { "content-type": "application/json" } : {}) },
    ...(body ? { body: JSON.stringify(body) } : {}),
  });
  const text = await res.text();
  return { status: res.status, json: text ? JSON.parse(text) : null };
};

// The pages fetch their data in a client `useEffect`, so `--dump-dom` snapshots the empty shell.
// Drive a real browser over CDP instead and read the DOM once the fetch has landed.
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
const profile = mkdtempSync(join(tmpdir(), "sw-int-"));
const chrome = spawn(CHROME, [
  `--remote-debugging-port=${PORT}`,
  `--user-data-dir=${profile}`,
  "--no-first-run",
  "--no-default-browser-check",
  "--headless=new",
  "about:blank",
]);

let targets;
for (let i = 0; i < 40; i += 1) {
  try {
    targets = await (await fetch(`http://127.0.0.1:${PORT}/json/list`)).json();
    if (targets.some((t) => t.type === "page")) break;
  } catch {
    /* not up yet */
  }
  await sleep(250);
}
const ws = new WebSocket(targets.find((t) => t.type === "page").webSocketDebuggerUrl);
await new Promise((r) => ws.addEventListener("open", r, { once: true }));

let msgId = 0;
const pending = new Map();
ws.addEventListener("message", (ev) => {
  const msg = JSON.parse(ev.data);
  const slot = pending.get(msg.id);
  if (!slot) return;
  pending.delete(msg.id);
  msg.error ? slot.reject(new Error(msg.error.message)) : slot.resolve(msg.result);
});
const cdp = (method, params = {}) => {
  const id = (msgId += 1);
  ws.send(JSON.stringify({ id, method, params }));
  return new Promise((resolve, reject) => pending.set(id, { resolve, reject }));
};

const render = async (path, awaitText) => {
  await cdp("Page.navigate", { url: `${APP}${path}` });
  for (let i = 0; i < 40; i += 1) {
    await sleep(500);
    const { result } = await cdp("Runtime.evaluate", {
      expression: "document.documentElement.outerHTML",
      returnByValue: true,
    });
    const html = result.value ?? "";
    if (!awaitText || html.includes(awaitText)) return html;
  }
  const { result } = await cdp("Runtime.evaluate", {
    expression: "document.documentElement.outerHTML",
    returnByValue: true,
  });
  return result.value ?? "";
};

// A product page that looks like the ones the live crawl handled well.
const PAGE = `<!doctype html><html><head>
<title>Kyoto Hojicha Roasted Green Tea | Ippodo</title>
<meta property="og:site_name" content="Ippodo Tea"/>
<script type="application/ld+json">{"@context":"https://schema.org","@type":"Product",
"name":"Kyoto Hojicha Roasted Green Tea","image":"https://cdn.ippodo.example/hojicha.jpg",
"description":"Charcoal-roasted hojicha, 100g caddy.","brand":{"name":"Ippodo Tea"},
"offers":{"@type":"Offer","price":"32.50","priceCurrency":"USD"}}</script>
</head><body><h1>Kyoto Hojicha</h1></body></html>`;

await fetch(`${API}/demo/reset`, { method: "POST" });

const dom = new JSDOM(PAGE, {
  url: "https://ippodo.example/products/hojicha?utm_campaign=x",
  virtualConsole: new VirtualConsole(),
  runScripts: "outside-only",
});
const product = dom.window.eval(extractSrc);

console.log("\n== saved through the shipped extension path ==");
const groupId = (await call("/me/groups")).json[0].id;
const saved = {};
for (const visibility of ["private", "shared"]) {
  const created = await call("/items", {
    method: "POST",
    body: itemBodyFrom(product, { visibility, groupId: visibility === "private" ? "" : groupId }),
  });
  await call("/reactions", { method: "POST", body: { itemId: created.json.id, type: "wishlist" } });
  saved[visibility] = created.json;
  check(`${visibility} saved`, created.status === 200, created.json.id);
}
check("the scrape survived the round trip", saved.private.priceCents === 3250 && saved.private.category === "food_drink");

console.log("\n== the app the design loop is building renders it ==");
const wishlist = await render("/wishlist", "Kyoto Hojicha Roasted Green Tea");
check("/wishlist renders", wishlist.length > 5000, `${(wishlist.length / 1024) | 0} KB`);
check("/wishlist shows the extension's item", wishlist.includes("Kyoto Hojicha Roasted Green Tea"));
check("/wishlist keeps the scraped image", wishlist.includes("cdn.ippodo.example/hojicha.jpg"));
check("/wishlist keeps the scraped price", /32\.50|\$32/.test(wishlist));
check("/wishlist links back to the product page", wishlist.includes("ippodo.example/products/hojicha"));

const wrapped = await render("/wrapped");
check("/wrapped renders", wrapped.length > 5000, `${(wrapped.length / 1024) | 0} KB`);
check("/wrapped does not leak the private save", !wrapped.includes(saved.private.id));

console.log("\n== the endpoint the design loop added this session ==");
const roster = await call(`/groups/${groupId}/wishlists`, { user: "esh" });
const mine = roster.json.find((r) => r.itemId === saved.shared.id);
check("the shared save has a roster", Boolean(mine), JSON.stringify(mine?.users.map((u) => u.id)));
check("the roster names the saver", mine?.users.some((u) => u.id === VIEWER));

console.log(failures === 0 ? "\nALL PASS" : `\n${failures} FAILURES`);

ws.close();
chrome.kill();
await sleep(1500);
rmSync(profile, { recursive: true, force: true });
process.exit(failures === 0 ? 0 : 1);
