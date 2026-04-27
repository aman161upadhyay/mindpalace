import type { VercelRequest, VercelResponse } from "@vercel/node";
import { and, eq, like } from "drizzle-orm";
import { db } from "../../src/lib/db";
import { highlights, tags } from "../../src/schema";
import { getAuthUserIdFromVercelReq } from "../../src/lib/auth";
import { applyCors } from "../../src/lib/cors";

export default async function handler(req: VercelRequest, res: VercelResponse) {
  if (applyCors(req, res)) return;
  if (req.method !== "DELETE") return res.status(405).json({ error: "Method not allowed" });

  const userId = await getAuthUserIdFromVercelReq(req);
  if (!userId) return res.status(401).json({ error: "Not authenticated" });

  const id = Number(req.query.id);
  if (!id || isNaN(id)) return res.status(400).json({ error: "Invalid tag ID" });

  // 1. Delete the tag
  const deleted = await db
    .delete(tags)
    .where(and(eq(tags.id, id), eq(tags.userId, userId)))
    .returning();

  if (deleted.length > 0) {
    // 2. Clean up highlights that used this tag
    // Since tagIds is a JSON string in a varchar, we'll fetch highlights that might have it and update them.
    // We use simple string matching to find potential matches first.
    const searchPattern = `%${id}%`;
    const highlightsToUpdate = await db
      .select({ id: highlights.id, tagIds: highlights.tagIds })
      .from(highlights)
      .where(and(eq(highlights.userId, userId), like(highlights.tagIds, searchPattern)));

    for (const h of highlightsToUpdate) {
      try {
        const tagIds = JSON.parse(h.tagIds || "[]");
        if (Array.isArray(tagIds) && tagIds.includes(id)) {
          const updatedTagIds = tagIds.filter((tid) => tid !== id);
          await db
            .update(highlights)
            .set({ tagIds: JSON.stringify(updatedTagIds) })
            .where(eq(highlights.id, h.id));
        }
      } catch (e) {
        console.error(`Failed to cleanup tag ${id} from highlight ${h.id}:`, e);
      }
    }
  }

  return res.status(200).json({ success: true });
}
