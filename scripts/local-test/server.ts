import http from "node:http";
import fs from "node:fs";
import path from "node:path";
import apiHandler from "M:/AI/Mind Palace/api/index.ts";
import { client } from "./db.local.ts";

const PORT = Number(process.env.PORT || 3100);
const DIST = path.resolve(process.env.DIST_DIR!);
const MIG = process.env.MIGRATIONS_DIR!;
const MIME: Record<string, string> = { ".html": "text/html", ".js": "text/javascript", ".css": "text/css", ".svg": "image/svg+xml", ".png": "image/png", ".json": "application/json", ".ico": "image/x-icon" };

// Apply migrations the same way the owner will in Neon (plain SQL files, in order).
const phase = process.env.LT_PHASE || "all"; // "old" = only 0001 (today's production), "all" = 0001..0003
for (const f of fs.readdirSync(MIG).filter((x) => x.endsWith(".sql")).sort()) {
  if (phase === "old" && !f.startsWith("0001")) continue;
  await client.exec(fs.readFileSync(path.join(MIG, f), "utf8"));
  console.log("applied", f);
}

function readBody(req: http.IncomingMessage): Promise<Buffer> {
  return new Promise((resolve) => { const c: Buffer[] = []; req.on("data", (d) => c.push(d)); req.on("end", () => resolve(Buffer.concat(c))); });
}

const server = http.createServer(async (req, res: any) => {
  const url = new URL(req.url || "/", `http://localhost:${PORT}`);

  // test-only helper, loopback only: run SQL (setup/seed/migrate/inspect)
  if (url.pathname === "/__lt/sql" && req.method === "POST") {
    const sql = (await readBody(req)).toString("utf8");
    try {
      const r: any = await client.query(sql);
      res.setHeader("content-type", "application/json"); res.end(JSON.stringify({ rows: r.rows ?? [] }));
    } catch (e: any) { res.statusCode = 400; res.end(JSON.stringify({ error: String(e.message) })); }
    return;
  }

  if (url.pathname === "/__lt/article") {
    res.setHeader("content-type", "text/html; charset=utf-8");
    res.end(`<!doctype html><html><head><title>Test Article: Spaced Repetition</title></head><body style="font:18px/1.6 Georgia;max-width:680px;margin:40px auto">
<h1>Why spaced repetition works</h1>
<p id="p1">Memory fades on a predictable curve, and reviewing material just before you would forget it flattens that curve dramatically.</p>
<p id="p2">The most valuable highlights are the ones you revisit; a quote you never see again is a quote you never learned.</p>
<p id="p3">Knowledge compounds when ideas from different sources are stored together and can be searched later.</p></body></html>`);
    return;
  }

  if (url.pathname === "/api" || url.pathname.startsWith("/api/")) {
    const raw = await readBody(req);
    const query: Record<string, any> = {};
    url.searchParams.forEach((v, k) => { query[k] = k in query ? ([] as string[]).concat(query[k], v) : v; });
    // same thing the vercel.json rewrite does: /api/:path* -> /api?__route=:path*
    query.__route = url.pathname.replace(/^\/api\/?/, "");
    const ct = String(req.headers["content-type"] || "");
    let body: any = raw.length ? raw.toString("utf8") : undefined;
    if (body && ct.includes("application/json")) { try { body = JSON.parse(body); } catch { body = undefined; } }
    const cookies: Record<string, string> = {};
    String(req.headers.cookie || "").split(";").forEach((p) => { const i = p.indexOf("="); if (i > 0) cookies[p.slice(0, i).trim()] = decodeURIComponent(p.slice(i + 1).trim()); });
    Object.assign(req, { query, body, cookies });
    res.status = (c: number) => { res.statusCode = c; return res; };
    res.json = (o: unknown) => { res.setHeader("content-type", "application/json; charset=utf-8"); res.end(JSON.stringify(o)); return res; };
    res.send = (b: any) => { if (typeof b === "object" && !Buffer.isBuffer(b)) return res.json(b); res.end(b); return res; };
    res.redirect = (a: any, b?: any) => { res.statusCode = typeof a === "number" ? a : 307; res.setHeader("location", typeof a === "number" ? b : a); res.end(); return res; };
    try { await (apiHandler as any)(req, res); } catch (e) { console.error("api error", e); if (!res.headersSent) { res.statusCode = 500; res.end('{"error":"Internal server error"}'); } }
    return;
  }

  let file = path.join(DIST, decodeURIComponent(url.pathname));
  if (!file.startsWith(DIST) || !fs.existsSync(file) || fs.statSync(file).isDirectory()) file = path.join(DIST, "index.html");
  res.setHeader("content-type", MIME[path.extname(file)] || "application/octet-stream");
  res.end(fs.readFileSync(file));
});
server.listen(PORT, "127.0.0.1", () => console.log(`LOCAL TEST SERVER http://localhost:${PORT} (phase=${phase})`));
