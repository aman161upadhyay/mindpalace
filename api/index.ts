import type { VercelRequest, VercelResponse } from "@vercel/node";
import { loadHandler, resolveRoute } from "../src/server/router";

// The only serverless function in this project. vercel.json rewrites every /api/* request here
// (as ?__route=<path>) and the router loads the matching handler from src/server/.
export default async function handler(req: VercelRequest, res: VercelResponse) {
  const fromRewrite = typeof req.query.__route === "string" ? req.query.__route : undefined;
  const route = resolveRoute(fromRewrite ?? req.url ?? "");
  if (!route) return res.status(404).json({ error: "Not found" });

  const { __route: _ignored, ...rest } = req.query;
  const query: Record<string, string | string[] | undefined> = route.id ? { ...rest, id: route.id } : rest;
  Object.defineProperty(req, "query", { value: query, configurable: true, writable: true, enumerable: true });

  try {
    const mod = await loadHandler(route.key);
    return await mod.default(req, res);
  } catch (err) {
    console.error(`[api] ${route.key} failed:`, err);
    if (!res.headersSent) return res.status(500).json({ error: "Internal server error" });
  }
}
