import type { VercelRequest, VercelResponse } from "@vercel/node";
import { and, eq } from "drizzle-orm";
import { db } from "../../src/lib/db";
import { highlights } from "../../src/schema";
import { getAuthUserIdFromVercelReq } from "../../src/lib/auth";
import { applyCors } from "../../src/lib/cors";

export default async function handler(req: VercelRequest, res: VercelResponse) {
  if (applyCors(req, res)) return;

  const userId = await getAuthUserIdFromVercelReq(req);
  if (!userId) return res.status(401).json({ error: "Not authenticated" });

  const id = Number(req.query.id);
  if (!id || isNaN(id)) return res.status(400).json({ error: "Invalid highlight ID" });

  if (req.method === "PATCH") {
    const { notes, tagIds } = req.body ?? {};
    const updateData: Record<string, unknown> = { updatedAt: new Date() };
    if (notes !== undefined) updateData.notes = notes;
    if (tagIds !== undefined) {
      if (!Array.isArray(tagIds)) return res.status(400).json({ error: "tagIds must be an array" });
      updateData.tagIds = JSON.stringify(tagIds);
    }

    const existing = await db
      .select({ id: highlights.id })
      .from(highlights)
      .where(and(eq(highlights.id, id), eq(highlights.userId, userId)))
      .limit(1);
    if (existing.length === 0) return res.status(404).json({ error: "Highlight not found" });

    await db.update(highlights).set(updateData).where(and(eq(highlights.id, id), eq(highlights.userId, userId)));
    const updated = await db.select().from(highlights).where(eq(highlights.id, id)).limit(1);
    return res.status(200).json(updated[0]);
  }

  if (req.method === "DELETE") {
    const existing = await db
      .select({ id: highlights.id })
      .from(highlights)
      .where(and(eq(highlights.id, id), eq(highlights.userId, userId)))
      .limit(1);
    if (existing.length === 0) return res.status(404).json({ error: "Highlight not found" });
    await db.delete(highlights).where(and(eq(highlights.id, id), eq(highlights.userId, userId)));
    return res.status(200).json({ success: true });
  }

  return res.status(405).json({ error: "Method not allowed" });
}
