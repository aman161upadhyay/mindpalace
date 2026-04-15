import type { VercelRequest, VercelResponse } from "@vercel/node";
import { and, desc, eq, like, or, sql } from "drizzle-orm";
import { db } from "../../src/lib/db";
import { highlights } from "../../src/schema";
import { getAuthUserIdFromVercelReq } from "../../src/lib/auth";
import { applyCors } from "../../src/lib/cors";
import { inferTags } from "../../src/lib/keyword-tags";

export default async function handler(req: VercelRequest, res: VercelResponse) {
  if (applyCors(req, res)) return;

  const userId = await getAuthUserIdFromVercelReq(req);
  if (!userId) return res.status(401).json({ error: "Not authenticated" });

  if (req.method === "GET") {
    const search = (req.query.search as string) || "";
    const tagId = req.query.tagId ? Number(req.query.tagId) : undefined;
    const domain = (req.query.domain as string) || "";
    const page = Math.max(1, Number(req.query.page) || 1);
    const limit = 30;
    const offset = (page - 1) * limit;

    const conditions = [eq(highlights.userId, userId)];

    if (search) {
      const pattern = `%${search}%`;
      conditions.push(
        or(
          like(highlights.text, pattern),
          like(highlights.pageTitle, pattern),
          like(highlights.notes, pattern),
          like(highlights.domain, pattern)
        )!
      );
    }

    if (domain) conditions.push(eq(highlights.domain, domain));

    if (tagId) {
      conditions.push(
        or(
          like(highlights.tagIds, `[${tagId}]`),
          like(highlights.tagIds, `[${tagId},%`),
          like(highlights.tagIds, `%,${tagId}]`),
          like(highlights.tagIds, `%,${tagId},%`)
        )!
      );
    }

    const whereClause = and(...conditions);

    const [items, countResult] = await Promise.all([
      db.select().from(highlights).where(whereClause).orderBy(desc(highlights.createdAt)).limit(limit).offset(offset),
      db.select({ count: sql<number>`count(*)` }).from(highlights).where(whereClause),
    ]);

    return res.status(200).json({
      items,
      total: Number(countResult[0]?.count ?? 0),
      page,
      limit,
    });
  }

  if (req.method === "POST") {
    const { text, sourceUrl, pageTitle, domain } = req.body ?? {};

    if (!text || typeof text !== "string" || text.length === 0)
      return res.status(400).json({ error: "Text is required" });
    if (text.length > 50000)
      return res.status(400).json({ error: "Text exceeds 50,000 character limit" });
    if (!sourceUrl || typeof sourceUrl !== "string")
      return res.status(400).json({ error: "Source URL is required" });
    if (!/^https?:\/\//i.test(sourceUrl))
      return res.status(400).json({ error: "Source URL must start with http:// or https://" });

    const metadataTags = inferTags(text);
    const inserted = await db
      .insert(highlights)
      .values({
        userId,
        text,
        sourceUrl,
        pageTitle: (pageTitle as string) || "",
        domain: (domain as string) || "",
        notes: null,
        tagIds: "[]",
        metadataTags: JSON.stringify(metadataTags),
      })
      .returning();

    return res.status(201).json(inserted[0]);
  }

  return res.status(405).json({ error: "Method not allowed" });
}
