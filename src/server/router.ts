import type { VercelRequest, VercelResponse } from "@vercel/node";
import login from "./auth/login";
import logout from "./auth/logout";
import me from "./auth/me";
import register from "./auth/register";
import resetPassword from "./auth/reset-password";
import dailyHighlights from "./cron/daily-highlights";
import extension from "./extension/index";
import highlights from "./highlights/index";
import tags from "./tags/index";
import tokens from "./tokens/index";

export type ApiHandler = (req: VercelRequest, res: VercelResponse) => unknown;

// Static imports: Vercel compiles and bundles these reliably. (Lazy import() of extensionless
// paths failed at runtime with ERR_MODULE_NOT_FOUND on Vercel.)
const HANDLERS: Record<string, ApiHandler> = {
  "auth/login": login,
  "auth/logout": logout,
  "auth/me": me,
  "auth/register": register,
  "auth/reset-password": resetPassword,
  "cron/daily-highlights": dailyHighlights,
  extension,
  highlights,
  tags,
  tokens,
};
const LOADERS = HANDLERS;

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
  return Promise.resolve({ default: HANDLERS[key] });
}
