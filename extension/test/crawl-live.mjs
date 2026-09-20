// Highest-fidelity crawler: a real headful Chrome, driven over CDP, evaluating the shipped
// extract.js inside the live page — which is exactly what chrome.scripting.executeScript does.
// Headless Chrome gets bot-walled by half the retail web; this does not.
//
//   node extension/test/crawl-live.mjs [url ...]
//
// Not part of the test suite: it opens a browser and hits the real internet.
import { spawn } from "node:child_process";
import { mkdtempSync, readFileSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";

const CHROME = "/Applications/Google Chrome.app/Contents/MacOS/Google Chrome";
const PORT = 9333;
const source = readFileSync(new URL("../src/extract.js", import.meta.url), "utf8");

const URLS = process.argv.slice(2).length
  ? process.argv.slice(2)
  : [
      "https://www.uniqlo.com/us/en/products/E465185-000",
      "https://www.nike.com/t/air-force-1-07-mens-shoes-5QFp5Z/CW2288-111",
      "https://www.ikea.com/us/en/p/billy-bookcase-white-00263850/",
      "https://www.johnlewis.com/le-creuset-signature-cast-iron-round-casserole-dish-24cm/volcanic/p231536138",
      "https://www.rei.com/product/224913/hydro-flask-wide-mouth-vacuum-water-bottle-32-fl-oz",
      "https://www.etsy.com/listing/1063340672/",
      "https://www.zara.com/us/en/oversized-cotton-t-shirt-p00761400.html",
    ];

const profile = mkdtempSync(join(tmpdir(), "sw-crawl-"));
const chrome = spawn(CHROME, [
  `--remote-debugging-port=${PORT}`,
  `--user-data-dir=${profile}`,
  "--no-first-run",
  "--no-default-browser-check",
  "--window-size=1280,900",
  "about:blank",
]);

const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

async function targets() {
  for (let i = 0; i < 40; i += 1) {
    try {
      const res = await fetch(`http://127.0.0.1:${PORT}/json/list`);
      const list = await res.json();
      if (list.some((t) => t.type === "page")) return list;
    } catch {
      /* not up yet */
    }
    await sleep(250);
  }
  throw new Error("Chrome never exposed a CDP page target");
}

class Session {
  constructor(ws) {
    this.ws = ws;
    this.id = 0;
    this.pending = new Map();
    ws.addEventListener("message", (ev) => {
      const msg = JSON.parse(ev.data);
      const slot = this.pending.get(msg.id);
      if (!slot) return;
      this.pending.delete(msg.id);
      msg.error ? slot.reject(new Error(msg.error.message)) : slot.resolve(msg.result);
    });
  }
  send(method, params = {}) {
    const id = (this.id += 1);
    this.ws.send(JSON.stringify({ id, method, params }));
    return new Promise((resolve, reject) => this.pending.set(id, { resolve, reject }));
  }
}

const list = await targets();
const page = list.find((t) => t.type === "page");
const ws = new WebSocket(page.webSocketDebuggerUrl);
await new Promise((r) => ws.addEventListener("open", r, { once: true }));
const cdp = new Session(ws);

const rows = [];
for (const url of URLS) {
  const host = new URL(url).hostname.replace(/^www\./, "");
  try {
    await cdp.send("Page.navigate", { url });
    // Retail SPAs hydrate well after load; the extension reads whenever the user hits save.
    await sleep(6000);
    const { result, exceptionDetails } = await cdp.send("Runtime.evaluate", {
      expression: source,
      returnByValue: true,
      awaitPromise: true,
    });
    if (exceptionDetails) throw new Error(exceptionDetails.text);
    const { result: finalUrl } = await cdp.send("Runtime.evaluate", {
      expression: "location.href",
      returnByValue: true,
    });
    rows.push({ host, landed: finalUrl.value, ...result.value });
  } catch (err) {
    rows.push({ host, error: String(err.message ?? err).slice(0, 140) });
  }
}

ws.close();
chrome.kill();

let usable = 0;
for (const r of rows) {
  if (r.error) {
    console.log(`\n### ${r.host}\n  FAILED: ${r.error}`);
    continue;
  }
  const ok = r.confident && r.imageUrl && r.title;
  if (ok) usable += 1;
  console.log(`\n### ${r.host}  ${ok ? "[complete]" : "[partial]"}`);
  console.log(`  title     ${r.title}`);
  console.log(`  price     ${r.priceCents === null ? "null" : `${(r.priceCents / 100).toFixed(2)} ${r.currency ?? ""}`}`);
  console.log(`  image     ${r.imageUrl ? r.imageUrl.slice(0, 90) : "null"}`);
  console.log(`  merchant  ${r.merchant}`);
  console.log(`  category  ${r.category}`);
  console.log(`  confident ${r.confident}`);
}
console.log(`\n${usable}/${rows.length} pages yielded a complete tile (title + image + price).`);

// Chrome needs a moment to let go of the profile before it can be removed.
await sleep(1500);
rmSync(profile, { recursive: true, force: true });
