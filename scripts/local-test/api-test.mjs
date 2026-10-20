import { createRequire } from "node:module";
import crypto from "node:crypto";
import fs from "node:fs";
const require = createRequire("M:/AI/Mind Palace/package.json");
const bcrypt = require("bcryptjs");
const BASE = "http://localhost:3100";
let pass = 0, fail = 0;
const ok = (name, cond, extra = "") => { (cond ? pass++ : fail++); console.log(`${cond ? "PASS" : "FAIL"}  ${name}${cond ? "" : "  <-- " + extra}`); };
const sql = async (q) => { const r = await fetch(BASE + "/__lt/sql", { method: "POST", body: q }); const j = await r.json(); if (j.error) throw new Error(j.error); return j.rows; };
const jar = () => { let c = ""; return { get: () => c, set: (r) => { const sc = r.headers.getSetCookie ? r.headers.getSetCookie() : []; if (sc.length) c = sc.map((x) => x.split(";")[0]).join("; "); } }; };
async function api(method, path, opts = {}) {
  const { body, cookie, bearer, headers = {} } = opts;
  const h = { ...headers }; if (body !== undefined) h["content-type"] = "application/json";
  if (cookie) h.cookie = cookie.get(); if (bearer) h.authorization = "Bearer " + bearer;
  const r = await fetch(BASE + path, { method, headers: h, body: body !== undefined ? JSON.stringify(body) : undefined, redirect: "manual" });
  if (cookie) cookie.set(r);
  let data; const t = await r.text(); try { data = JSON.parse(t); } catch { data = t; }
  return { status: r.status, data, headers: r.headers };
}

console.log("\n=== PHASE A: today's production schema (no notion columns, no deleted_at) ===");
const seedPw = "SeedPassw0rd!", hash = bcrypt.hashSync(seedPw, 4);
await sql("INSERT INTO users (username,email,password_hash) VALUES ('student_a','student_a@example.com','" + hash + "'),('owner_sim','owner_sim@example.com','" + hash + "')");
await sql("INSERT INTO api_tokens (user_id,token,label) VALUES (1,'hc_seed_a_token','Chrome Extension'),(2,'hc_seed_owner_token','Chrome Extension')");
await sql("INSERT INTO tags (user_id,name,color) VALUES (1,'research','#6366f1'),(2,'ideas','#10b981')");
for (let i = 1; i <= 33; i++) await sql("INSERT INTO highlights (user_id,text,source_url,page_title,domain,tag_ids,metadata_tags) VALUES (1,'Seed highlight " + i + " with unicode \u00fc\u00ef \u201cquotes\u201d and filler " + "x".repeat(i * 7) + "','https://example.com/p/" + i + "','Page " + i + "','example.com','" + (i % 3 === 0 ? "[1]" : "[]") + "','[\"AI\"]')");
for (let i = 1; i <= 20; i++) await sql("INSERT INTO highlights (user_id,text,source_url,page_title,domain) VALUES (2,'Owner seed " + i + "','https://example.org/" + i + "','Owner page " + i + "','example.org')");
const before = (await sql("SELECT count(*)::int c, md5(string_agg(text, '|' ORDER BY id)) h FROM highlights"))[0];
ok("seeded 53 highlights (33 + 20) in the old schema", before.c === 53, JSON.stringify(before));

let r = await api("POST", "/api/auth/login", { body: { username: "student_a", password: seedPw } });
ok("REPRODUCES THE OUTAGE: login is HTTP 500 on today's schema", r.status === 500, "got " + r.status);
r = await api("POST", "/api/extension/save", { body: { apiToken: "hc_seed_a_token", text: "x", sourceUrl: "https://a.com" } });
ok("new code BEFORE the migration breaks extension save (so migrate first)", r.status === 500, "got " + r.status);

console.log("\n=== PHASE B: run the exact production migration SQL (twice, to prove it is re-runnable) ===");
for (let k = 0; k < 2; k++) {
  await sql("ALTER TABLE users ADD COLUMN IF NOT EXISTS notion_token VARCHAR(255), ADD COLUMN IF NOT EXISTS notion_database_id VARCHAR(255), ADD COLUMN IF NOT EXISTS notion_last_sync TIMESTAMP");
  await sql("ALTER TABLE highlights ADD COLUMN IF NOT EXISTS deleted_at TIMESTAMP");
}
ok("migration is idempotent", true);
const after = (await sql("SELECT count(*)::int c, md5(string_agg(text, '|' ORDER BY id)) h FROM highlights"))[0];
ok("MIGRATION KEEPS ALL HIGHLIGHTS: count and content hash unchanged", after.c === before.c && after.h === before.h, JSON.stringify({ before, after }));

console.log("\n=== PHASE C: an existing user can sign in and sees every highlight ===");
const studentA = jar();
r = await api("POST", "/api/auth/login", { body: { username: "student_a", password: seedPw }, cookie: studentA });
ok("login works after migration (200)", r.status === 200, "got " + r.status + " " + JSON.stringify(r.data));
ok("login returns the SAME extension token as before (installed extension keeps working)", r.data && r.data.apiToken === "hc_seed_a_token", JSON.stringify(r.data));
r = await api("GET", "/api/auth/me", { cookie: studentA });
ok("/api/auth/me works", r.status === 200 && r.data.username === "student_a", "got " + r.status);
r = await api("GET", "/api/highlights?limit=100", { cookie: studentA });
ok("dashboard list shows all 33 of this user's highlights", r.data.total === 33, "total=" + (r.data && r.data.total));
r = await api("GET", "/api/highlights?action=stats", { cookie: studentA });
ok("stats endpoint works", r.status === 200, "got " + r.status);
r = await api("GET", "/api/highlights?action=metadata-tags", { cookie: studentA });
ok("metadata-tags endpoint works", r.status === 200, "got " + r.status);

console.log("\n=== PHASE D: Chrome-extension contract (old and new URL shapes) ===");
r = await api("POST", "/api/extension/save", { body: { apiToken: "hc_seed_a_token", text: "Saved by extension 1.1.0 style call", sourceUrl: "https://news.example.com/a", pageTitle: "A", domain: "news.example.com" } });
ok("POST /api/extension/save (legacy URL used by installed 1.1.0) -> 201", r.status === 201, "got " + r.status + " " + JSON.stringify(r.data));
r = await api("POST", "/api/extension", { body: { apiToken: "hc_seed_a_token", text: "Second save, new URL", sourceUrl: "https://news.example.com/b" } });
ok("POST /api/extension (new URL) -> 201", r.status === 201, "got " + r.status);
r = await api("GET", "/api/extension/recent", { bearer: "hc_seed_a_token" });
ok("GET /api/extension/recent with Bearer header -> 5 newest", r.status === 200 && r.data.length === 5, "got " + r.status + " len=" + (r.data && r.data.length));
r = await api("GET", "/api/extension/recent?apiToken=hc_seed_a_token");
ok("token in the query string is NOT accepted any more (401)", r.status === 401, "got " + r.status);
r = await api("POST", "/api/extension/save", { body: { apiToken: "bad", text: "x", sourceUrl: "https://a.com" } });
ok("bad token -> 401", r.status === 401, "got " + r.status);
r = await api("POST", "/api/extension/save", { body: { apiToken: "hc_seed_a_token", text: "x", sourceUrl: "javascript:alert(1)" } });
ok("non-http source URL rejected (400)", r.status === 400, "got " + r.status);

console.log("\n=== PHASE E: trash, restore, purge ===");
r = await api("GET", "/api/highlights?limit=100", { cookie: studentA });
const ids = r.data.items.map((x) => x.id); const target = ids[0];
r = await api("DELETE", "/api/highlights?id=" + target, { cookie: studentA });
ok("one-click delete moves to trash (200)", r.status === 200, "got " + r.status);
r = await api("GET", "/api/highlights?limit=100", { cookie: studentA });
ok("trashed highlight disappears from the main list", !r.data.items.some((x) => x.id === target), "still listed");
r = await api("GET", "/api/highlights?action=trash", { cookie: studentA });
ok("trash lists exactly that highlight", r.data.length === 1 && r.data[0].id === target, JSON.stringify(r.data).slice(0, 120));
r = await api("GET", "/api/extension/recent", { bearer: "hc_seed_a_token" });
ok("extension recent excludes trashed", !r.data.some((x) => x.id === target), "trashed row leaked");
r = await api("GET", "/api/highlights?action=export&format=json", { cookie: studentA });
ok("JSON export excludes trashed", r.status === 200 && JSON.stringify(r.data).indexOf("\"id\":" + target + ",") === -1, "got " + r.status);
r = await api("PATCH", "/api/highlights?id=" + target + "&action=restore", { cookie: studentA });
ok("restore brings it back (200)", r.status === 200, "got " + r.status);
r = await api("GET", "/api/highlights?action=trash", { cookie: studentA });
ok("trash is empty after restore", r.data.length === 0, "len=" + r.data.length);
r = await api("DELETE", "/api/highlights?id=" + ids[1] + "&action=purge", { cookie: studentA });
ok("PURGE OF A LIVE HIGHLIGHT IS REFUSED (409): no accidental permanent delete", r.status === 409, "got " + r.status);
const still = (await sql("SELECT count(*)::int c FROM highlights WHERE id=" + ids[1]))[0].c;
ok("...and that row is still in the database", still === 1);
await api("DELETE", "/api/highlights?id=" + ids[1], { cookie: studentA });
r = await api("DELETE", "/api/highlights?id=" + ids[1] + "&action=purge", { cookie: studentA });
ok("purge from the trash works (200)", r.status === 200, "got " + r.status);
const gone = (await sql("SELECT count(*)::int c FROM highlights WHERE id=" + ids[1]))[0].c;
ok("...and only that one row is gone", gone === 0);
r = await api("GET", "/api/highlights/" + ids[2], { cookie: studentA });
ok("GET /api/highlights/:id path form works", r.status === 200 && r.data.id === ids[2], "got " + r.status);

console.log("\n=== PHASE F: other users cannot touch someone else's data ===");
const owner = jar();
await api("POST", "/api/auth/login", { body: { username: "owner_sim", password: seedPw }, cookie: owner });
const attacks = [["read", "GET", "/api/highlights?id=" + ids[3]], ["delete", "DELETE", "/api/highlights?id=" + ids[3]], ["restore", "PATCH", "/api/highlights?id=" + ids[3] + "&action=restore"], ["purge", "DELETE", "/api/highlights?id=" + ids[3] + "&action=purge"], ["edit", "PATCH", "/api/highlights?id=" + ids[3]]];
for (const [label, m, p] of attacks) {
  const x = await api(m, p, { cookie: owner, body: m === "PATCH" ? { notes: "hacked" } : undefined });
  ok("other user cannot " + label + " it (404/409, never 200)", x.status === 404 || x.status === 409, "got " + x.status);
}
const intact = (await sql("SELECT count(*)::int c FROM highlights WHERE id=" + ids[3] + " AND deleted_at IS NULL AND notes IS NULL"))[0].c;
ok("the highlight is untouched", intact === 1);
r = await api("GET", "/api/highlights?limit=100", { cookie: owner });
ok("second user sees only their own 20", r.data.total === 20, "total=" + r.data.total);
r = await api("GET", "/api/highlights");
ok("anonymous request gets 401", r.status === 401, "got " + r.status);

console.log("\n=== PHASE G: exports, tags, tokens ===");
for (const f of ["json", "markdown", "obsidian", "notion-csv"]) { r = await api("GET", "/api/highlights?action=export&format=" + f, { cookie: studentA }); ok("export " + f + " -> 200", r.status === 200, "got " + r.status + " " + String(r.data).slice(0, 80)); }
r = await api("POST", "/api/tags", { cookie: studentA, body: { name: "t-new", color: "#ff0000" } }); const tagId = r.data && r.data.id;
ok("create tag", r.status === 201 || r.status === 200, "got " + r.status);
r = await api("GET", "/api/tags", { cookie: studentA }); ok("list tags", r.status === 200 && r.data.length >= 2, "len=" + (r.data && r.data.length));
r = await api("DELETE", "/api/tags/" + tagId, { cookie: studentA }); ok("delete tag via /api/tags/:id", r.status === 200, "got " + r.status);
r = await api("POST", "/api/tokens", { cookie: studentA, body: { label: "test" } }); const tokId = r.data && r.data.id; ok("create token", r.status === 201 || r.status === 200, "got " + r.status);
r = await api("DELETE", "/api/tokens/" + tokId, { cookie: studentA }); ok("delete token via /api/tokens/:id", r.status === 200, "got " + r.status);

console.log("\n=== PHASE H: new sign-up, AI chat removed, router, CORS, rate limits ===");
const pw = "Tst-" + crypto.randomBytes(9).toString("base64url");
const claude = jar();
r = await api("POST", "/api/auth/register", { body: { username: "claude_test", email: "claude_test@example.com", password: pw }, cookie: claude });
ok("register a brand-new account (201)", r.status === 201, "got " + r.status + " " + JSON.stringify(r.data));
fs.writeFileSync(new URL("./test-account.txt", import.meta.url), "LOCAL TEST ACCOUNT (throwaway in-memory DB, localhost only)\nusername: claude_test\npassword: " + pw + "\nextension token: " + (r.data && r.data.apiToken) + "\n");
r = await api("GET", "/api/chat", { cookie: claude });
ok("AI chat endpoint no longer exists (404)", r.status === 404, "got " + r.status);
r = await api("GET", "/api/nope"); ok("unknown API path -> 404", r.status === 404, "got " + r.status);
r = await api("OPTIONS", "/api/highlights", { headers: { origin: "https://themindpalace.org", "access-control-request-method": "GET" } });
ok("CORS preflight answered (2xx)", r.status >= 200 && r.status < 300, "got " + r.status);
r = await api("GET", "/api/auth/me");
ok("CORS header uses the new domain", (r.headers.get("access-control-allow-origin") || "") === "https://themindpalace.org", String(r.headers.get("access-control-allow-origin")));
let last;
for (let i = 0; i < 40; i++) last = await api("POST", "/api/extension/save", { body: { apiToken: "hc_seed_owner_token", text: "burst " + i, sourceUrl: "https://burst.example.com" } });
ok("an extension burst is eventually rate-limited (429)", last.status === 429, "last=" + last.status);
r = await api("POST", "/api/auth/login", { body: { username: "student_a", password: seedPw } });
ok("...but sign-in is NOT blocked by that burst (separate buckets)", r.status === 200, "got " + r.status);
let l429 = 0; for (let i = 0; i < 14; i++) { const x = await api("POST", "/api/auth/login", { body: { username: "student_a", password: "wrong-password" } }); if (x.status === 429) l429++; }
ok("repeated wrong passwords get rate-limited", l429 > 0, "429s=" + l429);

const total = (await sql("SELECT count(*)::int c FROM highlights WHERE user_id=1"))[0].c;
console.log("\nSUMMARY: " + pass + " passed, " + fail + " failed. First seeded user rows now: " + total);
process.exit(fail ? 1 : 0);
