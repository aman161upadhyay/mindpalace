// Diagnoses why Ctrl+Shift+S does nothing on a PDF opened in Chrome. Read-only; local only.
import puppeteer from "puppeteer-core";
import fs from "node:fs";
import os from "node:os";
import path from "node:path";

const EXT = process.argv[2] || "M:\\AI\\Mind Palace\\extension";
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
const pdf = `%PDF-1.4
1 0 obj<</Type/Catalog/Pages 2 0 R>>endobj
2 0 obj<</Type/Pages/Kids[3 0 R]/Count 1>>endobj
3 0 obj<</Type/Page/Parent 2 0 R/MediaBox[0 0 300 200]/Contents 4 0 R/Resources<</Font<</F1 5 0 R>>>>>>endobj
4 0 obj<</Length 44>>stream
BT /F1 18 Tf 20 100 Td (Hello PDF text) Tj ET
endstream endobj
5 0 obj<</Type/Font/Subtype/Type1/BaseFont/Helvetica>>endobj
trailer<</Root 1 0 R>>
%%EOF`;

const browser = await puppeteer.launch({
  executablePath: "C:/Program Files/Google/Chrome/Application/chrome.exe",
  headless: false, pipe: true, enableExtensions: [EXT], protocolTimeout: 60000,
  userDataDir: fs.mkdtempSync(path.join(os.tmpdir(), "mp-pdfdbg-")),
  args: ["--no-first-run", "--window-position=-2400,0", "--window-size=1000,700"],
});
const out = {};
try {
  const swTarget = await browser.waitForTarget((t) => t.type() === "service_worker" && t.url().startsWith("chrome-extension://"), { timeout: 20000 });
  const worker = await swTarget.worker();
  const manifest = await worker.evaluate(() => chrome.runtime.getManifest());
  out.extension = `${manifest.name} ${manifest.version}`;
  out.commands = await worker.evaluate(() => new Promise((res) => chrome.commands.getAll(res)));

  const page = await browser.newPage();
  await page.setRequestInterception(true);
  page.on("request", (r) => (r.url().startsWith("https://pdf.example/") ? r.respond({ status: 200, contentType: "application/pdf", body: pdf }) : r.continue()));
  const cdp = await page.createCDPSession();
  const contexts = [];
  cdp.on("Runtime.executionContextCreated", (e) => contexts.push({ origin: e.context.origin, name: e.context.name, type: e.context.auxData && e.context.auxData.type, frameId: !!(e.context.auxData && e.context.auxData.frameId) }));
  await cdp.send("Runtime.enable");
  await page.goto("https://pdf.example/doc.pdf").catch(() => {});
  await sleep(3500);

  out.pageFrames = page.frames().map((f) => f.url());
  out.targets = browser.targets().map((t) => `${t.type()} ${t.url().slice(0, 90)}`);
  out.contentScriptContexts = contexts.filter((c) => c.name && /mind palace/i.test(c.name) || c.type === "isolated");
  out.allContextOrigins = [...new Set(contexts.map((c) => `${c.type || "?"}:${c.origin}`))];
  try { out.marker = await page.evaluate(() => document.documentElement.getAttribute("data-hc-extension")); } catch (e) { out.marker = "n/a: " + e.message.slice(0, 60); }
  try { out.hcLoaded = await page.evaluate(() => !!window.__hcLoaded); } catch (e) { out.hcLoaded = "n/a"; }

  // What the keyboard-command handler does: ask the page's content script to save.
  out.sendMessageResult = await worker.evaluate(async () => {
    const tabs = await chrome.tabs.query({ url: "https://pdf.example/*" });
    const tab = tabs[0];
    if (!tab) return { error: "PDF tab not found by URL", all: (await chrome.tabs.query({})).map((t) => t.url) };
    return await new Promise((res) => {
      chrome.tabs.sendMessage(tab.id, { type: "TRIGGER_SAVE" }, { frameId: 0 }, (r) => res({ tabUrl: tab.url, response: r ?? null, lastError: chrome.runtime.lastError ? chrome.runtime.lastError.message : null }));
    });
  });

  // After the shortcut: did the content script show its tooltip, in which frame, and is it painted over the PDF?
  await sleep(600);
  out.tooltipHostPerFrame = [];
  for (const f of page.frames()) {
    try {
      out.tooltipHostPerFrame.push({ frame: f.url().slice(0, 60), hosts: await f.evaluate(() => Array.from(document.querySelectorAll("div")).filter((d) => d.shadowRoot && d.shadowRoot.querySelector("#tip")).map((d) => ({ text: d.shadowRoot.querySelector("#tip").innerText, rect: JSON.stringify(d.shadowRoot.querySelector("#tip").getBoundingClientRect()), visible: getComputedStyle(d.shadowRoot.querySelector("#tip")).opacity }))) });
    } catch (e) { out.tooltipHostPerFrame.push({ frame: f.url().slice(0, 60), error: e.message.slice(0, 50) }); }
  }
  await page.screenshot({ path: path.join(path.dirname(new URL(import.meta.url).pathname.replace(/^\//, "")), "pdf-after-shortcut.png") });
  // Can an extension read the selection some other way? (needs "scripting"; the manifest has no such permission)
  out.hasScriptingApi = await worker.evaluate(() => typeof chrome.scripting);
  out.permissions = manifest.permissions;
} catch (e) {
  out.error = String(e && e.stack ? e.stack.split("\n").slice(0, 3).join(" / ") : e);
} finally {
  console.log(JSON.stringify(out, null, 2));
  await browser.close().catch(() => {});
  process.exit(0);
}
