import puppeteer from "puppeteer-core";
import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import crypto from "node:crypto";
import { fileURLToPath } from "node:url";

const HERE = path.dirname(fileURLToPath(import.meta.url));
const EXT = "M:\\AI\\Mind Palace\\extension";
const BASE = "http://localhost:3100";
const SHOTS = path.join(HERE, "shots");
fs.mkdirSync(SHOTS, { recursive: true });
let pass = 0, fail = 0;
const ok = (name, cond, extra = "") => { (cond ? pass++ : fail++); console.log((cond ? "PASS" : "FAIL") + "  " + name + (cond ? "" : "  <-- " + extra)); };
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

const username = "claude_ui_" + crypto.randomBytes(3).toString("hex");
const password = "Tst-" + crypto.randomBytes(9).toString("base64url");
fs.writeFileSync(path.join(HERE, "test-account-ui.txt"), "LOCAL UI TEST ACCOUNT (throwaway in-memory DB, localhost only)\nusername: " + username + "\npassword: " + password + "\n");

const userDataDir = fs.mkdtempSync(path.join(os.tmpdir(), "mp-e2e-"));
const browser = await puppeteer.launch({
  executablePath: "C:\\Program Files\\Google\\Chrome\\Application\\chrome.exe",
  headless: true,
  pipe: true,
  enableExtensions: [EXT],
  userDataDir,
  args: ["--no-first-run", "--no-default-browser-check", "--window-size=1400,900"],
  defaultViewport: { width: 1400, height: 900 },
});

try {
  // ---- the extension service worker is running
  let sw = await browser.waitForTarget((t) => t.type() === "service_worker" && t.url().startsWith("chrome-extension://"), { timeout: 20000 }).catch(() => null);
  ok("Chrome loaded the Mind Palace extension (service worker running)", !!sw);
  const swWorker = sw ? await sw.worker() : null;
  const manifest = swWorker ? await swWorker.evaluate(() => chrome.runtime.getManifest()) : {};
  ok("extension version is 1.2.0", manifest.version === "1.2.0", JSON.stringify(manifest.version));

  // ---- sign up through the real page
  const page = await browser.newPage();
  const consoleErrors = [];
  page.on("pageerror", (e) => consoleErrors.push(String(e).slice(0, 160)));
  await page.goto(BASE + "/register", { waitUntil: "networkidle0" });
  await page.type('input[type="text"]', username);
  await page.type('input[type="email"]', username + "@example.com");
  const pw = await page.$$('input[type="password"]');
  await pw[0].type(password); await pw[1].type(password);
  await page.screenshot({ path: path.join(SHOTS, "01-register.png") });
  await Promise.all([page.waitForNavigation({ waitUntil: "networkidle0", timeout: 20000 }).catch(() => {}), page.click('button[type="submit"]')]);
  await sleep(1500);
  ok("sign-up succeeds and lands on the dashboard", page.url().includes("/mind-palace"), page.url());

  // ---- the dashboard bridge handed the extension its token + server address
  const stored = swWorker ? await swWorker.evaluate(() => chrome.storage.sync.get(null)) : {};
  ok("extension received an API token from the dashboard (bridge works on a trusted origin)", typeof stored.apiToken === "string" && stored.apiToken.startsWith("hc_"), Object.keys(stored).join(","));
  ok("extension server address is the dashboard origin", stored.dashboardUrl === BASE, String(stored.dashboardUrl));
  await page.screenshot({ path: path.join(SHOTS, "02-dashboard-empty.png") });
  const emptyText = await page.evaluate(() => document.body.innerText);
  ok("no 'Ask AI' button anywhere on the dashboard", !/Ask AI/i.test(emptyText), "found Ask AI");

  // ---- save highlights with the extension from a real web page (Ctrl+Shift+S)
  const art = await browser.newPage();
  await art.goto(BASE + "/__lt/article", { waitUntil: "networkidle0" });
  await sleep(800);
  const saveSel = async (id) => {
    await art.evaluate((pid) => {
      const el = document.getElementById(pid); const r = document.createRange(); r.selectNodeContents(el);
      const s = window.getSelection(); s.removeAllRanges(); s.addRange(r);
    }, id);
    await art.keyboard.down("Control"); await art.keyboard.down("Shift"); await art.keyboard.press("KeyS");
    await art.keyboard.up("Shift"); await art.keyboard.up("Control");
    await sleep(1500);
  };
  await saveSel("p1"); await saveSel("p2"); await saveSel("p3");
  await art.screenshot({ path: path.join(SHOTS, "03-article-after-save.png") });

  const dash = await browser.newPage();
  await dash.goto(BASE + "/mind-palace", { waitUntil: "networkidle0" });
  await sleep(1200);
  const body1 = await dash.evaluate(() => document.body.innerText);
  ok("3 highlights saved by the extension appear on the dashboard", /Memory fades/.test(body1) && /most valuable highlights/.test(body1) && /Knowledge compounds/.test(body1), body1.slice(0, 200).replace(/\n/g, " "));
  const cardFont = await dash.evaluate(() => {
    const el = Array.from(document.querySelectorAll("*")).find((e) => e.children.length === 0 && /Memory fades/.test(e.textContent || ""));
    if (!el) return null; const cs = getComputedStyle(el); return { family: cs.fontFamily, style: cs.fontStyle, weight: cs.fontWeight };
  });
  ok("highlight text is NOT italic", cardFont && cardFont.style !== "italic", JSON.stringify(cardFont));
  ok("highlight text uses the Lexend font", cardFont && /Lexend/i.test(cardFont.family), JSON.stringify(cardFont));
  await dash.screenshot({ path: path.join(SHOTS, "04-dashboard-with-highlights.png") });

  // ---- open a highlight (detail modal)
  await dash.evaluate(() => { const el = Array.from(document.querySelectorAll("*")).find((e) => e.children.length === 0 && /Memory fades/.test(e.textContent || "")); el && el.click(); });
  await sleep(900);
  await dash.screenshot({ path: path.join(SHOTS, "05-detail-modal.png") });
  const dlg = await dash.evaluate(() => { const d = document.querySelector("div.max-w-6xl"); if (!d) return null; const r = d.getBoundingClientRect(); return { w: Math.round(r.width), h: Math.round(r.height), text: d.innerText.slice(0, 400) }; });
  ok("page title is recorded and shown in the detail modal", dlg && /Spaced Repetition/.test(dlg.text), dlg && dlg.text.slice(0, 120));
  ok("detail modal opens and is wide (landscape layout, >= 900px)", dlg && dlg.w >= 900, JSON.stringify(dlg && { w: dlg.w, h: dlg.h }));
  await dash.keyboard.press("Escape"); await sleep(400);

  // ---- one-click delete -> trash -> restore
  const delClicked = await dash.evaluate(() => { const b = document.querySelector('button[title="Delete highlight"]'); if (!b) return false; b.click(); return true; });
  await sleep(1200);
  ok("one-click delete button exists on cards", delClicked);
  const body2 = await dash.evaluate(() => document.body.innerText);
  const remaining = ["Memory fades", "most valuable highlights", "Knowledge compounds"].filter((t) => body2.includes(t)).length;
  ok("deleted highlight leaves the list (2 of 3 remain)", remaining === 2, "remaining=" + remaining);
  await dash.screenshot({ path: path.join(SHOTS, "06-after-delete.png") });
  const recent = await swWorker.evaluate(async (base) => { const { apiToken } = await chrome.storage.sync.get("apiToken"); const r = await fetch(base + "/api/extension/recent", { headers: { Authorization: "Bearer " + apiToken } }); return (await r.json()).length; }, BASE);
  ok("extension's recent list also hides the trashed highlight (2)", recent === 2, "recent=" + recent);
  const trashBtn = await dash.evaluate(() => { const b = Array.from(document.querySelectorAll("button, a, div")).find((e) => /^\s*Trash/i.test(e.innerText || "") && e.innerText.length < 30); if (!b) return false; b.click(); return true; });
  await sleep(1000);
  await dash.screenshot({ path: path.join(SHOTS, "07-trash.png") });
  const trashTxt = await dash.evaluate(() => document.body.innerText);
  ok("Trash view opens and shows the deleted highlight with Restore / Delete Forever", trashBtn && /Restore/i.test(trashTxt) && /Delete Forever|Delete forever|Permanently/i.test(trashTxt), trashTxt.slice(0, 160).replace(/\n/g, " "));
  const restored = await dash.evaluate(() => { const b = Array.from(document.querySelectorAll("button")).find((e) => /Restore/i.test(e.innerText)); if (!b) return false; b.click(); return true; });
  await sleep(1200);
  await dash.keyboard.press("Escape"); await sleep(500);
  const body3 = await dash.evaluate(() => document.body.innerText);
  ok("Restore brings it back (all 3 visible again)", restored && ["Memory fades", "most valuable highlights", "Knowledge compounds"].every((t) => body3.includes(t)));

  // ---- other pages
  await dash.goto(BASE + "/settings", { waitUntil: "networkidle0" }); await sleep(800);
  await dash.screenshot({ path: path.join(SHOTS, "08-settings.png") });
  const st = await dash.evaluate(() => document.body.innerText);
  ok("Settings page renders (API token section present)", /token/i.test(st), st.slice(0, 100));
  await dash.goto(BASE + "/privacy", { waitUntil: "networkidle0" }); await sleep(500);
  const pr = await dash.evaluate(() => document.body.innerText);
  ok("Privacy page: says nothing is sent to an AI service, no Google/Vertex mention", /do not send your highlights to any AI service/i.test(pr) && !/Vertex|Google/i.test(pr), "privacy text mismatch");

  // ---- security: a random web page must NOT be able to read the token through the extension bridge
  const evil = await browser.newPage();
  await evil.setRequestInterception(true);
  evil.on("request", (req) => {
    if (req.url().startsWith("https://evil.example/")) req.respond({ status: 200, contentType: "text/html", body: "<!doctype html><title>evil</title><script>document.addEventListener('HC_SETTINGS_RESPONSE',e=>{document.title='STOLEN:'+JSON.stringify(e.detail).slice(0,40)});setTimeout(()=>document.dispatchEvent(new CustomEvent('HC_GET_SETTINGS')),1500);setTimeout(()=>document.dispatchEvent(new CustomEvent('HC_SAVE_SETTINGS',{detail:{apiToken:'hc_attacker',dashboardUrl:'https://attacker.example'}})),1600);</script>" });
    else req.continue();
  });
  await evil.goto("https://evil.example/", { waitUntil: "load" });
  await sleep(3500);
  const evilTitle = await evil.title();
  ok("SECURITY: an untrusted website cannot read the API token via the extension", !evilTitle.startsWith("STOLEN"), evilTitle);
  const after = await swWorker.evaluate(() => chrome.storage.sync.get(null));
  ok("SECURITY: an untrusted website cannot overwrite the token or server address", after.apiToken !== "hc_attacker" && after.dashboardUrl === BASE, JSON.stringify({ d: after.dashboardUrl }));

  ok("no uncaught JavaScript errors on the pages visited", consoleErrors.length === 0, consoleErrors.join(" | "));
} catch (e) {
  fail++; console.log("FAIL  script error: " + (e && e.stack ? e.stack.split("\n").slice(0, 4).join(" / ") : e));
} finally {
  await browser.close().catch(() => {});
  console.log("\nSUMMARY: " + pass + " passed, " + fail + " failed. Screenshots in " + SHOTS);
  process.exit(fail ? 1 : 0);
}
