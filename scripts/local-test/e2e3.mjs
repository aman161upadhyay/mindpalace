// Sorting & date-filter checks. Needs the rig on :3100 (LT_PHASE=all).
import puppeteer from "puppeteer-core";
import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import crypto from "node:crypto";
import { fileURLToPath } from "node:url";

const HERE = path.dirname(fileURLToPath(import.meta.url));
const BASE = "http://localhost:3100";
let pass = 0, fail = 0;
const ok = (name, cond, extra = "") => { (cond ? pass++ : fail++); console.log((cond ? "PASS" : "FAIL") + "  " + name + (cond ? "" : "  <-- " + extra)); };
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
const sql = async (q) => { const r = await fetch(BASE + "/__lt/sql", { method: "POST", body: q }); const j = await r.json(); if (j.error) throw new Error(j.error); return j.rows; };

const browser = await puppeteer.launch({ executablePath: "C:/Program Files/Google/Chrome/Application/chrome.exe", headless: true, protocolTimeout: 60000, args: ["--no-first-run"], defaultViewport: { width: 1400, height: 900 } });
try {
  const page = await browser.newPage();
  const username = "sorter_" + crypto.randomBytes(3).toString("hex");
  const password = "Tst-" + crypto.randomBytes(8).toString("hex");
  await page.goto(BASE + "/register", { waitUntil: "networkidle0" });
  await page.type('input[type="text"]', username);
  await page.type('input[type="email"]', username + "@example.com");
  const pw = await page.$$('input[type="password"]');
  await pw[0].type(password); await pw[1].type(password);
  await Promise.all([page.waitForNavigation({ waitUntil: "networkidle0" }).catch(() => {}), page.click('button[type="submit"]')]);
  const uid = (await sql(`SELECT id FROM users WHERE username='${username}'`))[0].id;
  const rows = [
    ["TODAY-new", "z-site.com", "now() - interval '1 minute'"],
    ["TODAY-early", "a-site.com", "now() - interval '20 minutes'"],
    ["YESTERDAY", "m-site.com", "now() - interval '1 day'"],
    ["THREE-DAYS", "b-site.com", "now() - interval '3 days'"],
    ["TWENTY-DAYS", "c-site.com", "now() - interval '20 days'"],
    ["THREE-MONTHS", "a-site.com", "now() - interval '95 days'"],
  ];
  for (const [t, d, when] of rows)
    await sql(`INSERT INTO highlights (user_id,text,source_url,page_title,domain,created_at,updated_at) VALUES (${uid},'${t}','https://${d}/p','${t}','${d}',${when},${when})`);

  const order = async () => {
    await sleep(900);
    return page.evaluate(() => {
      const labels = ["TODAY-new", "TODAY-early", "YESTERDAY", "THREE-DAYS", "TWENTY-DAYS", "THREE-MONTHS"];
      const text = document.body.innerText;
      return labels.map((l) => [l, text.indexOf(`"${l}"`) >= 0 ? text.indexOf(`"${l}"`) : text.indexOf(l)]).filter(([, i]) => i >= 0).sort((a, b) => a[1] - b[1]).map(([l]) => l);
    });
  };
  const setSelect = async (label, value) => {
    await page.evaluate((label, value) => {
      const sel = Array.from(document.querySelectorAll("label")).find((l) => l.textContent.trim().startsWith(label))?.querySelector("select");
      const setter = Object.getOwnPropertyDescriptor(HTMLSelectElement.prototype, "value").set;
      setter.call(sel, value); sel.dispatchEvent(new Event("change", { bubbles: true }));
    }, label, value);
  };

  await page.goto(BASE + "/mind-palace", { waitUntil: "networkidle0" });
  let o = await order();
  ok("default is newest first (today's highlights at the top)", JSON.stringify(o) === JSON.stringify(["TODAY-new", "TODAY-early", "YESTERDAY", "THREE-DAYS", "TWENTY-DAYS", "THREE-MONTHS"]), JSON.stringify(o));
  const headings = await page.evaluate(() => Array.from(document.querySelectorAll("h2")).map((h) => h.textContent.trim()));
  ok("date headings: Today, Yesterday, Earlier this week, Earlier this month, <month year>", headings[0] === "Today" && headings[1] === "Yesterday" && headings[2] === "Earlier this week" && headings[3] === "Earlier this month" && /\d{4}$/.test(headings[4] || ""), JSON.stringify(headings));
  await page.screenshot({ path: path.join(HERE, "shots2", "sort-newest.png") });

  await setSelect("Sort", "oldest");
  o = await order();
  ok("oldest first reverses the order", o[0] === "THREE-MONTHS" && o[o.length - 1] === "TODAY-new", JSON.stringify(o));

  await setSelect("Sort", "source");
  o = await order();
  const srcHeadings = await page.evaluate(() => Array.from(document.querySelectorAll("h2")).map((h) => h.textContent.trim()));
  ok("by website groups alphabetically by site", srcHeadings[0] === "a-site.com" && srcHeadings.includes("z-site.com") && o.indexOf("TODAY-early") < o.indexOf("THREE-MONTHS"), JSON.stringify({ srcHeadings, o }));

  await page.reload({ waitUntil: "networkidle0" });
  const remembered = await page.evaluate(() => Array.from(document.querySelectorAll("label")).find((l) => l.textContent.trim().startsWith("Sort"))?.querySelector("select")?.value);
  ok("the sort choice is remembered after a reload", remembered === "source", String(remembered));
  await setSelect("Sort", "newest");

  await setSelect("Saved", "today");
  o = await order();
  ok("date filter 'Today' shows only today's highlights", JSON.stringify(o) === JSON.stringify(["TODAY-new", "TODAY-early"]), JSON.stringify(o));
  await setSelect("Saved", "7d");
  o = await order();
  ok("'Last 7 days' shows today, yesterday and 3 days ago", o.length === 4 && !o.includes("TWENTY-DAYS"), JSON.stringify(o));
  await setSelect("Saved", "30d");
  o = await order();
  ok("'Last 30 days' adds the 20-day-old one but not the 3-month-old one", o.length === 5 && !o.includes("THREE-MONTHS"), JSON.stringify(o));
  const count = await page.evaluate(() => (document.body.innerText.match(/(\d+) highlights?/) || [])[1]);
  ok("the count next to the filters matches", count === "5", String(count));
} catch (e) {
  fail++; console.log("FAIL  script error: " + (e && e.stack ? e.stack.split("\n").slice(0, 3).join(" / ") : e));
} finally {
  await browser.close().catch(() => {});
  console.log(`\nSUMMARY: ${pass} passed, ${fail} failed`);
  process.exit(fail ? 1 : 0);
}
