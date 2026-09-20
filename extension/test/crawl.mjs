// Live crawler harness. Not part of the test suite: it hits the real internet.
//   node extension/test/crawl.mjs
// Renders each URL in headless Chrome (JS executed, same DOM the content script sees), then runs
// the shipped extract.js over it exactly as chrome.scripting.executeScript would.
import { execFile } from "node:child_process";
import { readFileSync } from "node:fs";
import { promisify } from "node:util";
import { JSDOM, VirtualConsole } from "jsdom";

const run = promisify(execFile);
const CHROME = "/Applications/Google Chrome.app/Contents/MacOS/Google Chrome";
const source = readFileSync(new URL("../src/extract.js", import.meta.url), "utf8");

const URLS = process.argv.slice(2).length
  ? process.argv.slice(2)
  : [
      "https://www.uniqlo.com/us/en/products/E465185-000",
      "https://www.nike.com/t/air-force-1-07-mens-shoes-5QFp5Z/CW2288-111",
      "https://www.ikea.com/us/en/p/billy-bookcase-white-00263850/",
      "https://www.muji.com/us/products/cmdty/detail/4550344572412",
      "https://www.johnlewis.com/le-creuset-signature-cast-iron-round-casserole-dish-24cm/volcanic/p231536138",
      "https://www.zara.com/us/en/oversized-cotton-t-shirt-p00761400.html",
    ];

async function dumpDom(url) {
  const { stdout } = await run(
    CHROME,
    [
      "--headless=new",
      "--disable-gpu",
      "--no-sandbox",
      "--virtual-time-budget=8000",
      "--run-all-compositor-stages-before-draw",
      `--user-agent=Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/131.0.0.0 Safari/537.36`,
      "--dump-dom",
      url,
    ],
    { maxBuffer: 200 * 1024 * 1024, timeout: 90_000 },
  );
  return stdout;
}

function extract(html, url) {
  const virtualConsole = new VirtualConsole();
  const dom = new JSDOM(html, { url, virtualConsole, runScripts: "outside-only" });
  return dom.window.eval(source);
}

const rows = [];
for (const url of URLS) {
  const host = new URL(url).hostname.replace(/^www\./, "");
  try {
    const html = await dumpDom(url);
    const out = extract(html, url);
    rows.push({ host, bytes: html.length, ...out });
  } catch (err) {
    rows.push({ host, error: String(err.message ?? err).slice(0, 120) });
  }
}

for (const r of rows) {
  if (r.error) {
    console.log(`\n### ${r.host}\n  CRAWL FAILED: ${r.error}`);
    continue;
  }
  console.log(`\n### ${r.host}  (${(r.bytes / 1024) | 0} KB rendered)`);
  console.log(`  title     ${r.title}`);
  console.log(`  price     ${r.priceCents === null ? "null" : `${r.priceCents} (${(r.priceCents / 100).toFixed(2)} ${r.currency ?? "?"})`}`);
  console.log(`  image     ${r.imageUrl ? r.imageUrl.slice(0, 96) : "null"}`);
  console.log(`  merchant  ${r.merchant}`);
  console.log(`  category  ${r.category}`);
  console.log(`  confident ${r.confident}`);
  console.log(`  desc      ${r.description ? r.description.slice(0, 90) : "null"}`);
}
