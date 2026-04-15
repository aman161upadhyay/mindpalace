import type { VercelRequest, VercelResponse } from "@vercel/node";
import { eq } from "drizzle-orm";
import { db } from "../../src/lib/db";
import { apiTokens, highlights } from "../../src/schema";
import { inferTags } from "../../src/lib/keyword-tags";
import { applyCors } from "../../src/lib/cors";
import { rateLimit, getClientIp } from "../../src/lib/rate-limit";

export default async function handler(req: VercelRequest, res: VercelResponse) {
  if (applyCors(req, res)) return;
  if (req.method !== "POST") return res.status(405).json({ error: "Method not allowed" });

  const ip = getClientIp(req.headers);
  const { allowed } = rateLimit(ip, { windowMs: 60_000, max: 30 });
  if (!allowed) return res.status(429).json({ error: "Too many requests, please try again later" });

  try {
    const { apiToken, text, sourceUrl, pageTitle, domain } = req.body ?? {};

    if (!apiToken || typeof apiToken !== "string")
      return res.status(401).json({ error: "API token is required" });

    const tokenRows = await db.select().from(apiTokens).where(eq(apiTokens.token, apiToken)).limit(1);
    if (tokenRows.length === 0) return res.status(401).json({ error: "Invalid API token" });

    const userId = tokenRows[0].userId;

    if (!text || typeof text !== "string" || text.length === 0)
      return res.status(400).json({ error: "Text is required" });
    if (text.length > 50000)
      return res.status(400).json({ error: "Text exceeds 50,000 character limit" });

    const rawUrl = typeof sourceUrl === "string" ? sourceUrl : "";
    if (rawUrl && !/^https?:\/\//i.test(rawUrl))
      return res.status(400).json({ error: "Source URL must start with http:// or https://" });

    const rawDomain = typeof domain === "string" ? domain : "";
    if (rawDomain.length > 255)
      return res.status(400).json({ error: "Domain must be 255 characters or fewer" });

    const metadataTags = inferTags(text);
    const inserted = await db
      .insert(highlights)
      .values({
        userId,
        text,
        sourceUrl: rawUrl,
        pageTitle: (pageTitle as string) || "",
        domain: rawDomain,
        notes: null,
        tagIds: "[]",
        metadataTags: JSON.stringify(metadataTags),
      })
      .returning();

    return res.status(201).json(inserted[0]);
  } catch (err: unknown) {
    console.error("[extension/save] Error:", err);
    return res.status(500).json({ error: "Internal server error" });
  }
}
