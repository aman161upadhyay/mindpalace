import type { VercelRequest, VercelResponse } from "@vercel/node";

export type ApiHandler = (req: VercelRequest, res: VercelResponse) => unknown;
type Loader = () => Promise<{ default: ApiHandler }>;

// Handlers load on demand, so a cold start only pays for the route being called
// and a broken route cannot take the others down.
const LOADERS: Record<string, Loader> = {
  "auth/login": () => import("./auth/login"),
  "auth/logout": () => import("./auth/logout"),
  "auth/me": () => import("./auth/me"),
  "auth/register": () => import("./auth/register"),
  "auth/reset-password": () => import("./auth/reset-password"),
  "cron/daily-highlights": () => import("./cron/daily-highlights"),
  chat: () => import("./chat/index"),
  extension: () => import("./extension/index"),
  highlights: () => import("./highlights/index"),
  tags: () => import("./tags/index"),
  tokens: () => import("./tokens/index"),
};

// Routes that accept /api/<name>/<id> (the id is exposed as req.query.id).
const ID_ROUTES = new Set(["highlights", "tags", "tokens"]);

export interface ResolvedRoute {
  key: string;
  id?: string;
}

export function resolveRoute(rawPath: string): ResolvedRoute | null {
  const segments = rawPath.split("?")[0].split("/").filter(Boolean);
  if (segments[0] === "api") segments.shift();
  if (segments.length === 0) return null;

  const two = segments.slice(0, 2).join("/");
  if (segments.length === 2 && Object.hasOwn(LOADERS, two)) return { key: two };

  const [first, second] = segments;
  if (first === "extension" && (segments.length === 1 || (segments.length === 2 && (second === "save" || second === "recent")))) {
    return { key: "extension" };
  }
  if (!Object.hasOwn(LOADERS, first) || first.includes("/")) return null;
  if (segments.length === 1) return { key: first };
  if (segments.length === 2 && ID_ROUTES.has(first)) return { key: first, id: second };
  return null;
}

export function loadHandler(key: string): Promise<{ default: ApiHandler }> {
  return LOADERS[key]();
}
