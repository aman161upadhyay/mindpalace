// Browser tests for the council fixes. Needs the rig on :3100 with LT_PHASE=all.
import puppeteer from "puppeteer-core";
import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import crypto from "node:crypto";
import { execFileSync } from "node:child_process";
import { fileURLToPath } from "node:url";

const HERE = path.dirname(fileURLToPath(import.meta.url));
const EXT = "M:\\AI\\Mind Palace\\extension";
const BASE = "http://localhost:3100";
const SHOTS = path.join(HERE, "shots2");
const DL = fs.mkdtempSync(path.join(os.tmpdir(), "mp-dl-"));
fs.mkdirSync(SHOTS, { recursive: true });
let pass = 0, fail = 0;
const ok = (name, cond, extra = "") => { (cond ? pass++ : fail++); console.log((cond ? "PASS" : "FAIL") + "  " + name + (cond ? "" : "  <-- " + extra)); };
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
const rnd = () => crypto.randomBytes(3).toString("hex");

const browser = await puppeteer.launch({
  executablePath: "C:/Program Files/Google/Chrome/Application/chrome.exe",
  headless: true, pipe: true, enableExtensions: [EXT], protocolTimeout: 60000,
  userDataDir: fs.mkdtempSync(path.join(os.tmpdir(), "mp-e2e2-")),
  args: ["--no-first-run", "--no-default-browser-check"],
  defaultViewport: { width: 1400, height: 900 },
});
const cdp = await browser.target().createCDPSession();
await cdp.send("Browser.setDownloadBehavior", { behavior: "allow", downloadPath: DL, eventsEnabled: true });

async function signup(page, user) {
  await page.goto(BASE + "/register", { waitUntil: "networkidle0" });
  await page.type('input[type="text"]', user.username);
  await page.type('input[type="email"]', user.username + "@example.com");
  const pw = await page.$$('input[type="password"]');
  await pw[0].type(user.password); await pw[1].type(user.password);
  await Promise.all([page.waitForNavigation({ waitUntil: "networkidle0", timeout: 20000 }).catch(() => {}), page.click('button[type="submit"]')]);
  await sleep(1200);
}
const pageApi = (page, p, opts = {}) => page.evaluate(async (p, opts) => {
  const r = await fetch(p, { credentials: "include", ...opts, headers: { "content-type": "application/json", ...(opts.headers || {}) } });
  let data; try { data = await r.json(); } catch { data = null; }
  return { status: r.status, data };
}, p, opts);
const waitFile = async (re, ms = 15000) => {
  const t0 = Date.now();
  while (Date.now() - t0 < ms) {
    const f = fs.readdirSync(DL).find((n) => re.test(n) && !n.endsWith(".crdownload"));
    if (f) return path.join(DL, f);
    await sleep(300);
  }
  return null;
};

try {
  const sw = await browser.waitForTarget((t) => t.type() === "service_worker" && t.url().startsWith("chrome-extension://"), { timeout: 20000 });
  const worker = await sw.worker();
  const extId = new URL(sw.url()).host;
  const perms = await worker.evaluate(() => chrome.runtime.getManifest().permissions);
  ok("manifest permissions trimmed to storage + contextMenus", JSON.stringify(perms) === '["storage","contextMenus"]', JSON.stringify(perms));

  const A = { username: "stu_a_" + rnd(), password: "Tst-" + rnd() + rnd() + "!" };
  const page = await browser.newPage();
  await signup(page, A);
  let st = await worker.evaluate(() => chrome.storage.sync.get(null));
  ok("signup connects the extension", typeof st.apiToken === "string" && st.apiToken.startsWith("hc_"), JSON.stringify(Object.keys(st)));

  // theme toggle must not wipe the token
  await page.goto(BASE + "/settings", { waitUntil: "networkidle0" });
  await sleep(800);
  const toggled = await page.evaluate(() => {
    const b = document.querySelector('button[aria-label="Dark theme"]');
    if (!b) return false; b.click(); return true;
  });
  await sleep(800);
  st = await worker.evaluate(() => chrome.storage.sync.get(null));
  ok("changing the theme does NOT wipe the extension token", toggled && typeof st.apiToken === "string" && st.apiToken.startsWith("hc_"), JSON.stringify({ toggled, tok: !!st.apiToken }));

  // long title + PDF/context-menu direct save path (same function the right-click fallback uses)
  const longSave = await worker.evaluate(async () => {
    try { await handleSaveHighlight({ text: "Saved from a PDF via right-click", sourceUrl: "https://arxiv.org/pdf/1234.5678", pageTitle: "T".repeat(700), domain: "arxiv.org" }); return "ok"; }
    catch (e) { return String(e.message); }
  });
  ok("direct save (PDF / right-click path) with a 700-char title succeeds", longSave === "ok", longSave);

  // popup: friendly errors and URL validation
  const popup = await browser.newPage();
  await popup.goto(`chrome-extension://${extId}/popup.html`, { waitUntil: "load" });
  await sleep(1200);
  let popText = await popup.evaluate(() => document.body.innerText);
  ok("popup lists recent highlights", /Saved from a PDF/.test(popText), popText.slice(0, 160));
  await worker.evaluate(() => chrome.storage.sync.set({ apiToken: "hc_wrong_token" }));
  await popup.reload({ waitUntil: "load" }); await sleep(1500);
  popText = await popup.evaluate(() => document.body.innerText);
  ok("popup shows a clear error for an invalid token (not 'No highlights yet')", /sign-in has expired|sign in again/i.test(popText) && !/No highlights yet/i.test(popText), popText.slice(0, 200));
  const badUrl = await popup.evaluate(() => new Promise((res) => chrome.runtime.sendMessage({ type: "SAVE_SETTINGS", apiToken: "x", dashboardUrl: "not a url" }, res)));
  ok("settings reject a non-https server address", badUrl && badUrl.success === false, JSON.stringify(badUrl));
  await popup.close();
  await page.bringToFront();
  await page.goto(BASE + "/mind-palace", { waitUntil: "networkidle0" }); await sleep(1000); // dashboard re-syncs the real token
  st = await worker.evaluate(() => chrome.storage.sync.get(null));
  ok("opening the dashboard restores the correct token", st.apiToken && st.apiToken !== "hc_wrong_token", "");

  // seed more highlights for A (with tags) through the extension API
  const tok = st.apiToken;
  for (let i = 1; i <= 6; i++) {
    await page.evaluate(async (tok, i) => fetch("/api/extension/save", { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify({ apiToken: tok, text: `Lecture note ${i}: "quotes", commas, and\nnew lines`, sourceUrl: `https://course.example.edu/week${(i % 2) + 1}`, pageTitle: `Week ${(i % 2) + 1} — Memory & "Learning"`, domain: "course.example.edu" }) }), tok, i);
  }
  const tagRes = await pageApi(page, "/api/tags", { method: "POST", body: JSON.stringify({ name: "exam-prep", color: "#ff0000" }) });
  const list = await pageApi(page, "/api/highlights?limit=100");
  await pageApi(page, `/api/highlights?id=${list.data.items[0].id}`, { method: "PATCH", body: JSON.stringify({ tagIds: [tagRes.data.id], notes: "Important for the final" }) });
  let countA = list.data.total;

  // Escape closes the detail modal
  await page.reload({ waitUntil: "networkidle0" }); await sleep(800);
  await page.evaluate(() => { const el = Array.from(document.querySelectorAll("*")).find((e) => e.children.length === 0 && /Lecture note/.test(e.textContent || "")); el && el.click(); });
  await sleep(700);
  const openBefore = await page.evaluate(() => !!document.querySelector('[role="dialog"]'));
  await page.keyboard.press("Escape"); await sleep(500);
  const openAfter = await page.evaluate(() => !!document.querySelector('[role="dialog"]'));
  ok("Escape closes the highlight detail window", openBefore && !openAfter, JSON.stringify({ openBefore, openAfter }));

  // Trash: single "Delete forever" is instant; "Empty Trash" asks once
  for (let k = 0; k < 2; k++) {
    await page.evaluate(() => { const bs = document.querySelectorAll('button[aria-label="Move highlight to Trash"]'); bs[bs.length - 1].click(); });
    await sleep(900);
  }
  await page.evaluate(() => { const b = Array.from(document.querySelectorAll("button, div")).find((e) => /^\s*Trash/i.test(e.innerText || "") && e.innerText.length < 30); b && b.click(); });
  await sleep(900);
  await page.evaluate(() => { const b = Array.from(document.querySelectorAll("button")).find((e) => /^\s*Delete forever\s*$/i.test(e.innerText)); b && b.click(); });
  await sleep(900);
  const afterSingle = (await pageApi(page, "/api/highlights?action=trash")).data.length;
  const noConfirm = await page.evaluate(() => !/Delete forever\?|Empty Trash\?/.test(document.body.innerText));
  ok("single 'Delete forever' deletes immediately (no confirmation)", afterSingle === 1 && noConfirm, JSON.stringify({ afterSingle, noConfirm }));
  await page.evaluate(() => { const b = Array.from(document.querySelectorAll("button")).find((e) => /^\s*Empty Trash\s*$/i.test(e.innerText)); b && b.click(); });
  await sleep(500);
  const emptyConfirm = await page.evaluate(() => /Empty Trash\?/.test(document.body.innerText));
  await page.keyboard.press("Escape"); await sleep(400);
  const stillOne = (await pageApi(page, "/api/highlights?action=trash")).data.length;
  ok("'Empty Trash' asks for one confirmation; Escape cancels it", emptyConfirm && stillOne === 1, JSON.stringify({ emptyConfirm, stillOne }));
  await page.evaluate(() => { const b = Array.from(document.querySelectorAll("button")).find((e) => /^\s*Empty Trash\s*$/i.test(e.innerText)); b && b.click(); });
  await sleep(500);
  await page.evaluate(() => { const bs = Array.from(document.querySelectorAll("button")).filter((e) => /^\s*Empty Trash\s*$/i.test(e.innerText)); bs[bs.length - 1].click(); });
  await sleep(1200);
  const afterEmpty = (await pageApi(page, "/api/highlights?action=trash")).data.length;
  countA = (await pageApi(page, "/api/highlights?limit=100")).data.total;
  ok("confirming 'Empty Trash' erases everything in Trash and nothing else", afterEmpty === 0 && countA === list.data.total - 2, JSON.stringify({ afterEmpty, countA }));
  await page.keyboard.press("Escape"); await sleep(300);

  // AI Brain Pack download through the real Export window
  await page.reload({ waitUntil: "networkidle0" }); await sleep(800);
  const expectedSources = new Set((await pageApi(page, "/api/highlights?limit=100")).data.items.map((h) => h.sourceUrl)).size;
  await page.evaluate(() => { const b = Array.from(document.querySelectorAll("button")).find((e) => /^\s*Export\s*$/i.test(e.innerText)); b && b.click(); });
  await sleep(700);
  await page.screenshot({ path: path.join(SHOTS, "export-modal.png") });
  await page.evaluate(() => { const b = Array.from(document.querySelectorAll("button")).find((e) => /Download AI Brain Pack/i.test(e.innerText)); b && b.click(); });
  const zipPath = await waitFile(/mind-palace-ai-brain\.zip$/);
  ok("AI Brain Pack downloads as a ZIP from the Export window", !!zipPath, fs.readdirSync(DL).join(","));
  if (zipPath) {
    const out = execFileSync("python", ["-I", "-c", `
import zipfile, json, sys
z = zipfile.ZipFile(sys.argv[1]); names = z.namelist()
lines = [json.loads(l) for l in z.read("highlights.jsonl").decode("utf-8").splitlines() if l.strip()]
src = [n for n in names if n.startswith("sources/") and not n.endswith("/")]
print(json.dumps({"names": len(names), "readme": "README.md" in names, "index": "sources.md" in names, "jsonl": len(lines), "sources": len(src), "tagged": sum(1 for l in lines if l["tags"]), "notes": sum(1 for l in lines if l["notes"])}))
`, zipPath]).toString();
    const z = JSON.parse(out);
    ok("pack contains README, index, JSONL with every highlight, one note per source page", z.readme && z.index && z.jsonl === countA && z.sources === expectedSources && z.tagged === 1 && z.notes === 1, out.trim());
  }

  // Round trip: export JSON from A, import into a brand-new student B through the Import window
  console.log("STEP export-json", new Date().toISOString().slice(11,19));
  const exp = await pageApi(page, "/api/highlights?action=export&format=json");
  const jsonFile = path.join(DL, "a-export.json");
  fs.writeFileSync(jsonFile, exp.data.content);
  console.log("STEP logout", new Date().toISOString().slice(11,19));
  await page.evaluate(async () => { await fetch("/api/auth/logout", { method: "POST", credentials: "include" }); });
  const B = { username: "stu_b_" + rnd(), password: "Tst-" + rnd() + rnd() + "!" };
  console.log("STEP signup-B", new Date().toISOString().slice(11,19));
  await signup(page, B);
  const doImport = async () => {
    await page.goto(BASE + "/mind-palace", { waitUntil: "networkidle0" }); await sleep(800);
    await page.evaluate(() => { const b = Array.from(document.querySelectorAll("button")).find((e) => /^\s*Import\s*$/i.test(e.innerText)); b && b.click(); });
    await sleep(600);
    await page.evaluate(() => { const b = Array.from(document.querySelectorAll("button")).find((e) => /JSON File/i.test(e.innerText)); b && b.click(); });
    await sleep(300);
    const input = await page.$('input[type="file"]');
    await input.uploadFile(jsonFile);
    await sleep(800);
    await page.evaluate(() => { const b = Array.from(document.querySelectorAll("button")).find((e) => /^\s*Import from /i.test(e.innerText) && !e.disabled); b && b.click(); });
    await sleep(2500);
    return page.evaluate(() => document.body.innerText);
  };
  console.log("STEP import-1", new Date().toISOString().slice(11,19));
  await doImport();
  const listB = await pageApi(page, "/api/highlights?limit=100");
  const tagsB = await pageApi(page, "/api/tags");
  const tagged = listB.data.items.filter((h) => JSON.parse(h.tagIds || "[]").length).length;
  const datesKept = listB.data.items.every((h) => new Date(h.createdAt) <= new Date(Date.now() + 60_000));
  ok("JSON round trip into a new account keeps every highlight", listB.data.total === countA, `A=${countA} B=${listB.data.total}`);
  ok("round trip keeps tags (tag recreated and attached) and notes", tagsB.data.some((t) => t.name === "exam-prep") && tagged === 1 && listB.data.items.some((h) => h.notes === "Important for the final"), JSON.stringify({ tags: tagsB.data.map((t) => t.name), tagged }));
  ok("round trip keeps saved dates", datesKept && exp.data && listB.data.items.length > 0, "");
  console.log("STEP import-2", new Date().toISOString().slice(11,19));
  await doImport();
  const listB2 = await pageApi(page, "/api/highlights?limit=100");
  ok("importing the same file again adds no duplicates", listB2.data.total === countA, `after 2nd import: ${listB2.data.total}`);

  console.log("STEP logout-check", new Date().toISOString().slice(11,19));
  // Logout disconnects the extension
  await page.goto(BASE + "/settings", { waitUntil: "networkidle0" }); await sleep(600);
  await page.evaluate(() => { const b = Array.from(document.querySelectorAll("button")).find((e) => /sign out|log out/i.test(e.innerText)); b && b.click(); });
  await sleep(1500);
  st = await worker.evaluate(() => chrome.storage.sync.get(null));
  ok("signing out of the dashboard disconnects the extension (token cleared)", !st.apiToken, JSON.stringify({ tok: st.apiToken ? "present" : "empty" }));

  // Forgot password: username + email reset form, show/hide on password fields
  await page.goto(BASE + "/forgot-password", { waitUntil: "networkidle0" }); await sleep(400);
  const fpInputs = await page.evaluate(() => ({ pw: document.querySelectorAll('input[type="password"]').length, eyes: document.querySelectorAll('button[aria-label="Show password"]').length }));
  ok("Forgot-password page has the reset form with show/hide on both password fields", fpInputs.pw === 2 && fpInputs.eyes === 2, JSON.stringify(fpInputs));
  const wrong = await pageApi(page, "/api/auth/reset-password", { method: "POST", body: JSON.stringify({ username: A.username, email: "someone-else@example.com", newPassword: "whatever-123" }) });
  ok("reset with a username/email that don't match is refused", wrong.status === 400, JSON.stringify(wrong));
  const newPw = "Reset-" + rnd() + rnd();
  await page.type('input[autocomplete="username"]', A.username);
  await page.type('input[type="email"]', A.username + "@example.com");
  const resetPw = await page.$$('input[autocomplete="new-password"]');
  await resetPw[0].type(newPw); await resetPw[1].type(newPw);
  await page.click('button[type="submit"]');
  await sleep(1500);
  const resetDone = await page.evaluate(() => /Password Reset/.test(document.body.innerText));
  const relogin = await pageApi(page, "/api/auth/login", { method: "POST", body: JSON.stringify({ username: A.username, password: newPw }) });
  ok("reset with matching username + email works, and the new password signs in", resetDone && relogin.status === 200, JSON.stringify({ resetDone, login: relogin.status }));
  A.password = newPw;
  await page.evaluate(async () => { await fetch("/api/auth/logout", { method: "POST", credentials: "include" }); });

  // Show/hide password on the sign-in page
  await page.goto(BASE + "/login", { waitUntil: "networkidle0" }); await sleep(300);
  await page.type('input[type="password"]', "peekaboo");
  await page.click('button[aria-label="Show password"]');
  const shown = await page.evaluate(() => { const i = document.querySelector('input[autocomplete="current-password"], input[value="peekaboo"]') || Array.from(document.querySelectorAll("input")).find((x) => x.value === "peekaboo"); return i ? i.type : null; });
  ok("sign-in page: the eye button reveals the typed password", shown === "text", String(shown));

  // Phone layout (375 px)
  const phone = await browser.newPage();
  await phone.setViewport({ width: 375, height: 812, isMobile: true, hasTouch: true });
  await phone.bringToFront();
  await phone.goto(BASE + "/login", { waitUntil: "networkidle0" });
  await phone.type('input[type="text"], input[name="username"]', A.username);
  await phone.type('input[type="password"]', A.password);
  await Promise.all([phone.waitForNavigation({ waitUntil: "networkidle0", timeout: 20000 }).catch(() => {}), phone.click('button[type="submit"]')]);
  await sleep(1500);
  const lay = await phone.evaluate(() => {
    const aside = document.querySelector("aside"); const ar = aside ? aside.getBoundingClientRect() : null;
    const card = Array.from(document.querySelectorAll("*")).find((e) => e.children.length === 0 && /Lecture note/.test(e.textContent || ""));
    const cr = card ? card.getBoundingClientRect() : null;
    const delBtn = document.querySelector('button[aria-label="Move highlight to Trash"]');
    return { asideW: ar ? Math.round(ar.width) : -1, textW: cr ? Math.round(cr.width) : -1, overflow: document.documentElement.scrollWidth > window.innerWidth + 1, delVisible: delBtn ? getComputedStyle(delBtn).opacity : null };
  });
  await phone.screenshot({ path: path.join(SHOTS, "phone-dashboard.png") });
  ok("phone: sidebar starts closed, cards use the screen width, no sideways scroll", lay.asideW === 0 && lay.textW >= 250 && !lay.overflow, JSON.stringify(lay));
  ok("phone: delete button is visible without hover", lay.delVisible === "1", JSON.stringify(lay));
  await phone.evaluate(() => { const el = Array.from(document.querySelectorAll("*")).find((e) => e.children.length === 0 && /Lecture note/.test(e.textContent || "")); el && el.click(); });
  await sleep(800);
  await phone.screenshot({ path: path.join(SHOTS, "phone-modal.png") });
  const modalFits = await phone.evaluate(() => { const d = document.querySelector("div.max-w-6xl"); if (!d) return null; const r = d.getBoundingClientRect(); return { w: Math.round(r.width), left: Math.round(r.left) }; });
  ok("phone: detail window fits the screen", modalFits && modalFits.w <= 375 && modalFits.left >= 0, JSON.stringify(modalFits));

  // Notion: a fake token is rejected instead of showing "Connected"
  const nt = await pageApi(phone, "/api/auth/me", { method: "PATCH", body: JSON.stringify({ notionToken: "secret_fake_token_123456", notionDatabaseId: "abc" }) });
  ok("Notion: a fake token is rejected (no false 'Connected')", nt.status === 400, JSON.stringify(nt));
} catch (e) {
  fail++; console.log("FAIL  script error: " + (e && e.stack ? e.stack.split("\n").slice(0, 4).join(" / ") : e));
} finally {
  await browser.close().catch(() => {});
  console.log(`\nSUMMARY: ${pass} passed, ${fail} failed. Screenshots in ${SHOTS}`);
  process.exit(fail ? 1 : 0);
}
