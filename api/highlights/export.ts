import type { VercelRequest, VercelResponse } from "@vercel/node";
import { desc, eq } from "drizzle-orm";
import { db } from "../../src/lib/db";
import { highlights, tags } from "../../src/schema";
import { getAuthUserIdFromVercelReq } from "../../src/lib/auth";
import { applyCors } from "../../src/lib/cors";

export default async function handler(req: VercelRequest, res: VercelResponse) {
  if (applyCors(req, res)) return;
  if (req.method !== "GET") return res.status(405).json({ error: "Method not allowed" });

  const userId = await getAuthUserIdFromVercelReq(req);
  if (!userId) return res.status(401).json({ error: "Not authenticated" });

  const format = (req.query.format as string) || "json";
  if (format !== "json" && format !== "markdown")
    return res.status(400).json({ error: "Format must be 'json' or 'markdown'" });

  const [allHighlights, allTags] = await Promise.all([
    db.select().from(highlights).where(eq(highlights.userId, userId)).orderBy(desc(highlights.createdAt)),
    db.select().from(tags).where(eq(tags.userId, userId)),
  ]);

  const tagMap = Object.fromEntries(allTags.map((t) => [t.id, t]));

  if (format === "json") {
    const data = allHighlights.map((h) => ({
      id: h.id,
      text: h.text,
      sourceUrl: h.sourceUrl,
      pageTitle: h.pageTitle,
      domain: h.domain,
      notes: h.notes,
      tags: (JSON.parse(h.tagIds || "[]") as number[]).map((id) => tagMap[id]?.name).filter(Boolean),
      metadataTags: JSON.parse(h.metadataTags || "[]"),
      createdAt: h.createdAt,
    }));
    return res.status(200).json({ content: JSON.stringify(data, null, 2), filename: "highlights.json" });
  }

  const grouped: Record<string, typeof allHighlights> = {};
  for (const h of allHighlights) {
    const key = h.domain || "Unknown Source";
    if (!grouped[key]) grouped[key] = [];
    grouped[key].push(h);
  }

  let md = `# My Highlight Compendium\n\n*Exported ${new Date().toLocaleDateString()}*\n\n---\n\n`;
  for (const [domain, items] of Object.entries(grouped)) {
    md += `## ${domain}\n\n`;
    for (const h of items) {
      const tagNames = (JSON.parse(h.tagIds || "[]") as number[]).map((id) => tagMap[id]?.name).filter(Boolean);
      md += `> ${h.text}\n\n`;
      md += `**Source:** [${h.pageTitle || h.sourceUrl}](${h.sourceUrl})  \n`;
      md += `**Saved:** ${new Date(h.createdAt).toLocaleDateString()}  \n`;
      if (tagNames.length) md += `**Tags:** ${tagNames.join(", ")}  \n`;
      if (h.notes) md += `**Notes:** ${h.notes}  \n`;
      md += `\n---\n\n`;
    }
  }
  return res.status(200).json({ content: md, filename: "highlights.md" });
}
