// Live end-to-end seam check against a running backend (fast mode, :8081).
//   node extension/test/live-api.mjs
// Lifts the REAL itemBodyFrom out of background.js and the REAL extract.js, so this proves the
// shipped code is API-compatible rather than testing a reimplementation of it.
import { readFileSync } from "node:fs";
import { JSDOM, VirtualConsole } from "jsdom";

const API = process.env.API ?? "http://localhost:8081";
const extractSrc = readFileSync(new URL("../src/extract.js", import.meta.url), "utf8");
const bgSrc = readFileSync(new URL("../src/background.js", import.meta.url), "utf8");

// Pull itemBodyFrom verbatim out of the service worker.
const start = bgSrc.indexOf("function itemBodyFrom");
const end = bgSrc.indexOf("\n}", start) + 2;
const itemBodyFrom = new Function(`${bgSrc.slice(start, end)}; return itemBodyFrom;`)();

const PAGE = `<!doctype html><html><head>
<title>Hario V60 Ceramic Dripper 02 — White | Blue Bottle</title>
<meta property="og:title" content="Hario V60 Ceramic Dripper 02"/>
<meta property="og:image" content="/img/v60.jpg"/>
<meta property="og:site_name" content="Blue Bottle Coffee"/>
<meta name="description" content="The cone that made pourover pourover."/>
<script type="application/ld+json">{"@context":"https://schema.org","@type":"Product",
"name":"Hario V60 Ceramic Dripper 02","image":"https://cdn.example.com/v60.jpg",
"description":"Ceramic cone, size 02.","brand":{"name":"Hario"},
"offers":{"@type":"Offer","price":"28.00","priceCurrency":"USD"}}</script>
</head><body><h1>Hario V60</h1><span class="price">$28.00</span></body></html>`;

let failures = 0;
const check = (label, ok, detail = "") => {
  console.log(`  ${ok ? "PASS" : "FAIL"}  ${label}${detail ? ` — ${detail}` : ""}`);
  if (!ok) failures += 1;
};

const call = async (path, { method = "GET", body, user = "esh" } = {}) => {
  const res = await fetch(`${API}${path}`, {
    method,
    headers: { authorization: `Bearer dev:${user}`, ...(body ? { "content-type": "application/json" } : {}) },
    ...(body ? { body: JSON.stringify(body) } : {}),
  });
  const text = await res.text();
  return { status: res.status, json: text ? JSON.parse(text) : null };
};

await fetch(`${API}/demo/reset`, { method: "POST" });

const dom = new JSDOM(PAGE, {
  url: "https://bluebottlecoffee.com/store/v60?utm_source=x",
  virtualConsole: new VirtualConsole(),
  runScripts: "outside-only",
});
const product = dom.window.eval(extractSrc);

console.log("\n== extract.js on a representative product page ==");
check("title", product.title === "Hario V60 Ceramic Dripper 02", product.title);
check("price", product.priceCents === 2800, String(product.priceCents));
check("currency USD", product.currency === "USD", String(product.currency));
check("image absolute", product.imageUrl === "https://cdn.example.com/v60.jpg", String(product.imageUrl));
check("confident", product.confident === true);

console.log("\n== POST /items with the real itemBodyFrom ==");
const groups = await call("/me/groups");
const groupId = groups.json[0].id;

for (const visibility of ["private", "shared", "anonymous"]) {
  const body = itemBodyFrom(product, { visibility, groupId: visibility === "private" ? "" : groupId });
  const created = await call("/items", { method: "POST", body });
  check(`${visibility} create -> 200`, created.status === 200, JSON.stringify(created.json).slice(0, 140));
  if (created.status !== 200) continue;

  const reacted = await call("/reactions", { method: "POST", body: { itemId: created.json.id, type: "wishlist" } });
  check(`${visibility} wishlist reaction -> 204`, reacted.status === 204, String(reacted.status));
  created.json.__v = visibility;
  globalThis[`item_${visibility}`] = created.json;
}

console.log("\n== reads back ==");
const wishlist = await call("/wishlist");
const ids = new Set(wishlist.json.map((i) => i.id));
for (const v of ["private", "shared", "anonymous"]) {
  check(`${v} item is in GET /wishlist`, ids.has(globalThis[`item_${v}`]?.id));
}

const finds = await call(`/groups/${groupId}/finds`, { user: "kristina" });
const byId = new Map(finds.json.map((f) => [f.id, f]));
check("shared find visible to another member", byId.has(globalThis.item_shared.id));
check("shared find names the owner", byId.get(globalThis.item_shared.id)?.ownerId === "esh");
check("anonymous find visible to another member", byId.has(globalThis.item_anonymous.id));
check("anonymous find hides the owner", byId.get(globalThis.item_anonymous.id)?.ownerId === null);
check("private item never leaves /wishlist", !byId.has(globalThis.item_private.id));

// The endpoint the design loop added this session: does an extension save show up on the roster?
const rosters = await call(`/groups/${groupId}/wishlists`, { user: "kristina" });
check("GET /groups/:id/wishlists -> 200", rosters.status === 200, String(rosters.status));
const roster = new Map(rosters.json.map((r) => [r.itemId, r.users.map((u) => u.id)]));
check("extension's shared save appears on the roster", roster.get(globalThis.item_shared.id)?.includes("esh"));
check("anonymous save does not unmask its owner", !(roster.get(globalThis.item_anonymous.id) ?? []).includes("esh"));

console.log("\n== POST /wishlist/link fallback path ==");
const linked = await call("/wishlist/link", { method: "POST", body: { url: "https://example.com/thing" } });
check("link save -> 200", linked.status === 200, JSON.stringify(linked.json).slice(0, 120));
const patched = await call(`/items/${linked.json.id}`, { method: "PATCH", body: { visibility: "shared" } });
check("PATCH visibility -> 200", patched.status === 200, String(patched.status));

console.log(failures === 0 ? "\nALL PASS" : `\n${failures} FAILURES`);
process.exit(failures === 0 ? 0 : 1);
