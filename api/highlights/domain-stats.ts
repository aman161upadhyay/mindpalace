import type { VercelRequest, VercelResponse } from "@vercel/node";
import { desc, eq, sql } from "drizzle-orm";
import { db } from "../../src/lib/db";
import { highlights } from "../../src/schema";
import { verifyJwt } from "../../src/lib/auth";

function parseCookies(cookieHeader: string): Record<string, string> {
  const cookies: Record<string, string> = {};
  for (const pair of cookieHeader.split(";")) {
    const [key, ...rest] = pair.split("=");
    const k = key?.trim();
    if (k) cookies[k] = decodeURIComponent(rest.join("=").trim());
  }
  return cookies;
}

export default async function handler(req: VercelRequest, res: VercelResponse) {
  if (req.method !== "GET") return res.status(405).json({ error: "Method not allowed" });

  const cookieHeader = (req.headers.cookie as string) ?? "";
  const cookies = parseCookies(cookieHeader);
  const token = cookies["hc_session"];
  if (!token) return res.status(401).json({ error: "Not authenticated" });
  const payload = await verifyJwt(token);
  if (!payload) return res.status(401).json({ error: "Invalid session" });

  const stats = await db
    .select({ domain: highlights.domain, count: sql<number>`count(*)` })
    .from(highlights)
    .where(eq(highlights.userId, payload.userId))
    .groupBy(highlights.domain)
    .orderBy(desc(sql`count(*)`))
    .limit(20);

  return res.status(200).json(stats);
}
