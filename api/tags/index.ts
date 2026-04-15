import type { VercelRequest, VercelResponse } from "@vercel/node";
import { eq } from "drizzle-orm";
import { db } from "../../src/lib/db";
import { tags } from "../../src/schema";
import { getAuthUserIdFromVercelReq } from "../../src/lib/auth";
import { applyCors } from "../../src/lib/cors";

export default async function handler(req: VercelRequest, res: VercelResponse) {
  if (applyCors(req, res)) return;

  const userId = await getAuthUserIdFromVercelReq(req);
  if (!userId) return res.status(401).json({ error: "Not authenticated" });

  if (req.method === "GET") {
    const userTags = await db.select().from(tags).where(eq(tags.userId, userId)).orderBy(tags.name);
    return res.status(200).json(userTags);
  }

  if (req.method === "POST") {
    const { name, color } = req.body ?? {};
    if (!name || typeof name !== "string" || name.length === 0 || name.length > 64)
      return res.status(400).json({ error: "Tag name must be 1-64 characters" });
    const tagColor = color || "#6366f1";
    if (!/^#[0-9a-fA-F]{6}$/.test(tagColor))
      return res.status(400).json({ error: "Color must be a valid hex color (e.g. #6366f1)" });
    const inserted = await db.insert(tags).values({ userId, name, color: tagColor }).returning();
    return res.status(201).json(inserted[0]);
  }

  return res.status(405).json({ error: "Method not allowed" });
}
