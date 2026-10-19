import * as router from "../src/server/router";
const resolveRoute: (p: string) => unknown = (router as any).resolveRoute ?? (router as any).default?.resolveRoute;
const cases: [string, any][] = [
  ["auth/login", { key: "auth/login" }],
  ["/api/auth/login", { key: "auth/login" }],
  ["auth/reset-password", { key: "auth/reset-password" }],
  ["cron/daily-highlights", { key: "cron/daily-highlights" }],
  ["extension/save", { key: "extension" }],
  ["extension/recent", { key: "extension" }],
  ["extension", { key: "extension" }],
  ["highlights", { key: "highlights" }],
  ["highlights/42", { key: "highlights", id: "42" }],
  ["tags/7", { key: "tags", id: "7" }],
  ["tokens/9", { key: "tokens", id: "9" }],
  ["tags", { key: "tags" }],
  ["chat", { key: "chat" }],
  ["/api/highlights?id=5", { key: "highlights" }],
  ["", null], ["nope", null], ["auth", null], ["auth/nope", null], ["chat/1", null],
  ["highlights/1/2", null], ["extension/other", null], ["__proto__", null], ["constructor", null], ["auth/login/extra", null],
];
let bad = 0;
for (const [input, want] of cases) {
  const got = resolveRoute(input);
  const ok = JSON.stringify(got) === JSON.stringify(want);
  if (!ok) { bad++; console.log("FAIL", JSON.stringify(input), "=>", JSON.stringify(got), "expected", JSON.stringify(want)); }
}
console.log(bad === 0 ? `all ${cases.length} route cases pass` : `${bad} failures`);

// 2) every handler module loads, and the real entry point routes requests
const keys = ["auth/login","auth/logout","auth/me","auth/register","auth/reset-password","cron/daily-highlights","chat","extension","highlights","tags","tokens"];
for (const k of keys) {
  try { const m = await ((router as any).loadHandler ?? (router as any).default.loadHandler)(k); if (typeof m.default !== "function") throw new Error("no default export"); }
  catch (e) { bad++; console.log("LOAD FAIL", k, String(e).slice(0, 200)); }
}
const entry: any = await import("../api/index");
const entryHandler = entry.default?.default ?? entry.default;
function fake(query: Record<string, string>, method = "GET", url = "/api/x") {
  const out: any = { status: 0, body: undefined, headers: {} };
  const res: any = {
    setHeader: (k: string, v: string) => { out.headers[k] = v; }, getHeader: () => undefined,
    status(c: number) { out.status = c; return res; }, json(b: unknown) { out.body = b; return res; },
    end() { return res; }, send(b: unknown) { out.body = b; return res; }, headersSent: false,
  };
  const req: any = { query, method, url, headers: {}, cookies: {}, body: {} };
  return { req, res, out };
}
const checks: [string, Record<string, string>, number][] = [
  ["unknown route", { __route: "nope" }, 404],
  ["empty route", { __route: "" }, 404],
  ["auth/me without cookie", { __route: "auth/me" }, 401],
  ["tags/7 without cookie", { __route: "tags/7" }, 401],
  ["highlights without cookie", { __route: "highlights" }, 401],
];
for (const [name, q, want] of checks) {
  const { req, res, out } = fake({ ...q });
  await entryHandler(req, res);
  if (out.status !== want) { bad++; console.log("ENTRY FAIL", name, "got", out.status, "want", want, JSON.stringify(out.body)); }
}
{ const { req, res } = fake({ __route: "tags/7", keep: "1" }); await entryHandler(req, res);
  if (req.query.id !== "7" || req.query.__route !== undefined || req.query.keep !== "1") { bad++; console.log("QUERY FAIL", JSON.stringify(req.query)); } }
console.log(bad === 0 ? "handlers load + entry point routes correctly" : `${bad} total failures`);
process.exit(bad ? 1 : 0);
