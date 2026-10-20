// PDF shortcut tests (real Chrome + real extension + local server on :3100 with LT_PHASE=all).
import puppeteer from "puppeteer-core";
import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import crypto from "node:crypto";

const EXT = "M:\\AI\\Mind Palace\\extension";
const BASE = "http://localhost:3100";
const ORIGIN = "https://pdf.example";
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
let pass = 0, fail = 0;
const ok = (name, cond, extra = "") => { (cond ? pass++ : fail++); console.log((cond ? "PASS" : "FAIL") + "  " + name + (cond ? "" : "  <-- " + extra)); };
const sql = async (q) => { const r = await fetch(BASE + "/__lt/sql", { method: "POST", body: q }); const j = await r.json(); if (j.error) throw new Error(j.error); return j.rows; };
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

// a student account + token on the local rig
const reg = await fetch(BASE + "/api/auth/register", { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify({ username: "pdfuser_" + crypto.randomBytes(3).toString("hex"), email: crypto.randomBytes(3).toString("hex") + "@example.com", password: "Tst-" + crypto.randomBytes(8).toString("hex") }) });
const { apiToken } = await reg.json();

const browser = await puppeteer.launch({
  executablePath: "C:/Program Files/Google/Chrome/Application/chrome.exe",
  headless: false, pipe: true, enableExtensions: [EXT], protocolTimeout: 60000,
  userDataDir: fs.mkdtempSync(path.join(os.tmpdir(), "mp-pdfe2e-")),
  args: ["--no-first-run", "--window-position=-2400,0", "--window-size=1000,700"],
});
try {
  const sw = await browser.waitForTarget((t) => t.type() === "service_worker" && t.url().startsWith("chrome-extension://"), { timeout: 20000 });
  const worker = await sw.worker();
  await worker.evaluate((tok, base) => new Promise((r) => chrome.storage.sync.set({ apiToken: tok, dashboardUrl: base }, r)), apiToken, BASE);

  const page = await browser.newPage();
  await page.setRequestInterception(true);
  page.on("request", (r) => (r.url().startsWith(ORIGIN + "/") ? r.respond({ status: 200, contentType: "application/pdf", body: pdf }) : r.continue()));
  await page.goto(ORIGIN + "/papers/spaced-repetition.pdf").catch(() => {});
  await sleep(3500);
  await page.mouse.click(450, 250); // focus the PDF viewer like a reader would
  await sleep(300);

  const tipText = () => page.evaluate(() => Array.from(document.querySelectorAll("div")).map((d) => d.shadowRoot && d.shadowRoot.querySelector("#tip")).filter(Boolean).map((t) => t.innerText.replace(/\s+/g, " ").trim()).pop() || "");
  const pressShortcut = () => worker.evaluate(async () => {
    const [tab] = await chrome.tabs.query({ url: "https://pdf.example/*" });
    return await new Promise((res) => chrome.tabs.sendMessage(tab.id, { type: "TRIGGER_SAVE" }, { frameId: 0 }, (r) => res({ response: r ?? null, lastError: chrome.runtime.lastError ? chrome.runtime.lastError.message : null })));
  });
  const count = async () => (await sql("SELECT count(*)::int c FROM highlights"))[0].c;
  const setPermission = (setting) => browser.target().createCDPSession().then((c) => c.send("Browser.setPermission", { origin: ORIGIN, permission: { name: "clipboard-read" }, setting }).then(() => c.send("Browser.setPermission", { origin: ORIGIN, permission: { name: "clipboard-write" }, setting })));

  // 0) the message is now answered, so the background can tell "script present" from "no script"
  await setPermission("granted");
  await page.evaluate(() => navigator.clipboard.writeText(""));
  const r0 = await pressShortcut();
  ok("page script answers the shortcut message on a PDF (no 'port closed' error)", r0.response && r0.response.ok === true && !r0.lastError, JSON.stringify(r0));

  // 1) empty clipboard -> clear instructions, nothing saved
  const before = await count();
  await sleep(600);
  const tip1 = await tipText();
  ok("empty clipboard: shows how to save from a PDF (not 'Select some text first')", /Ctrl\+C/.test(tip1) && /Ctrl\+Shift\+S/.test(tip1) && !/^.?\s*Select some text first/.test(tip1), tip1);
  ok("empty clipboard: nothing is saved", (await count()) === before);

  // 2) copy from the PDF, press the shortcut -> saved with the PDF's address and title
  await page.evaluate(() => navigator.clipboard.writeText("Hello PDF text"));
  await pressShortcut();
  await sleep(1500);
  const tip2 = await tipText();
  const rows = await sql("SELECT text, source_url, page_title, domain FROM highlights ORDER BY id DESC LIMIT 1");
  ok("copy + shortcut saves the copied text", (await count()) === before + 1 && rows[0].text === "Hello PDF text", JSON.stringify(rows[0]));
  ok("saved highlight points back to the PDF address and domain", rows[0].source_url === ORIGIN + "/papers/spaced-repetition.pdf" && rows[0].domain === "pdf.example", JSON.stringify(rows[0]));
  ok("confirmation shows what was saved", /Saved from clipboard/.test(tip2) && /Hello PDF text/.test(tip2), tip2);
  await page.screenshot({ path: path.join(path.dirname(new URL(import.meta.url).pathname.replace(/^\//, "")), "pdf-saved.png") });

  // 3) right-click menu path hands over the selection the menu already has
  await worker.evaluate(async () => {
    const [tab] = await chrome.tabs.query({ url: "https://pdf.example/*" });
    await new Promise((res) => chrome.tabs.sendMessage(tab.id, { type: "TRIGGER_SAVE", selectionText: "Text chosen via right-click menu" }, { frameId: 0 }, () => res()));
  });
  await sleep(1500);
  const rows3 = await sql("SELECT text FROM highlights ORDER BY id DESC LIMIT 1");
  ok("right-click on selected PDF text saves exactly that text", rows3[0].text === "Text chosen via right-click menu", JSON.stringify(rows3[0]));

  // 4) clipboard blocked -> actionable message, nothing saved
  await setPermission("denied");
  const before4 = await count();
  await pressShortcut();
  await sleep(1200);
  const tip4 = await tipText();
  ok("clipboard blocked: explains how to allow it or use right-click", /clipboard/i.test(tip4) && /right-click/i.test(tip4), tip4);
  ok("clipboard blocked: nothing is saved", (await count()) === before4);

  // 5) ordinary web page still works exactly as before
  const art = await browser.newPage();
  await art.goto(BASE + "/__lt/article", { waitUntil: "networkidle0" });
  await sleep(800);
  await art.evaluate(() => { const el = document.getElementById("p1"); const r = document.createRange(); r.selectNodeContents(el); const s = getSelection(); s.removeAllRanges(); s.addRange(r); });
  const before5 = await count();
  await art.keyboard.down("Control"); await art.keyboard.down("Shift"); await art.keyboard.press("KeyS"); await art.keyboard.up("Shift"); await art.keyboard.up("Control");
  await sleep(1500);
  ok("normal web page: Ctrl+Shift+S still saves the selection", (await count()) === before5 + 1);
  const r6 = await worker.evaluate(async () => {
    const [tab] = await chrome.tabs.query({ url: "http://localhost:3100/__lt/article" });
    await chrome.tabs.sendMessage(tab.id, { type: "TRIGGER_SAVE" }, { frameId: 0 }).catch(() => {});
    return "sent";
  });
} catch (e) {
  fail++; console.log("FAIL  script error: " + (e && e.stack ? e.stack.split("\n").slice(0, 3).join(" / ") : e));
} finally {
  await browser.close().catch(() => {});
  console.log(`\nSUMMARY: ${pass} passed, ${fail} failed`);
  process.exit(fail ? 1 : 0);
}
