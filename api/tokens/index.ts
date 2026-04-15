import type { VercelRequest, VercelResponse } from "@vercel/node";
import { desc, eq } from "drizzle-orm";
import { nanoid } from "nanoid";
import { db } from "../../src/lib/db";
import { apiTokens } from "../../src/schema";
import { getAuthUserIdFromVercelReq } from "../../src/lib/auth";
import { applyCors } from "../../src/lib/cors";

export default async function handler(req: VercelRequest, res: VercelResponse) {
  if (applyCors(req, res)) return;

  const userId = await getAuthUserIdFromVercelReq(req);
  if (!userId) return res.status(401).json({ error: "Not authenticated" });

  if (req.method === "GET") {
    const tokens = await db.select().from(apiTokens).where(eq(apiTokens.userId, userId)).orderBy(desc(apiTokens.createdAt));
    return res.status(200).json(tokens);
  }

  if (req.method === "POST") {
    const { label } = req.body ?? {};
    const rawLabel = typeof label === "string" ? label.trim() : "";
    if (rawLabel.length > 128)
      return res.status(400).json({ error: "Label must be 128 characters or fewer" });
    const tokenLabel = rawLabel || "Chrome Extension";
    const tokenValue = `hc_${nanoid(40)}`;
    const inserted = await db.insert(apiTokens).values({ userId, token: tokenValue, label: tokenLabel }).returning();
    return res.status(201).json(inserted[0]);
  }

  return res.status(405).json({ error: "Method not allowed" });
}
