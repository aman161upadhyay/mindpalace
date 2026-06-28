import type { VercelRequest, VercelResponse } from "@vercel/node";
import { and, desc, eq, ilike, like, or, sql } from "drizzle-orm";
import { db } from "../../src/lib/db";
import { highlights, tags, users } from "../../src/schema";
import { getAuthUserIdFromVercelReq } from "../../src/lib/auth";
import { applyCors } from "../../src/lib/cors";
import { rateLimit, getClientIp } from "../../src/lib/rate-limit";
import { inferTags } from "../../src/lib/keyword-tags";

export default async function handler(req: VercelRequest, res: VercelResponse) {
  if (applyCors(req, res)) return;

  try {
    const userId = await getAuthUserIdFromVercelReq(req);
    if (!userId) return res.status(401).json({ error: "Not authenticated" });

    const action = (req.query.action as string) || "";
    const idParam = req.query.id as string | undefined;

    // ── Individual Highlight Handlers (?id=...) ────────────────────────────
    if (idParam) {
      const id = Number(idParam);
      if (!id || isNaN(id)) return res.status(400).json({ error: "Invalid highlight ID" });

      if (req.method === "GET") {
        const existing = await db
          .select()
          .from(highlights)
          .where(and(eq(highlights.id, id), eq(highlights.userId, userId)))
          .limit(1);
        if (existing.length === 0) return res.status(404).json({ error: "Highlight not found" });
        return res.status(200).json(existing[0]);
      }

      if (req.method === "PATCH") {
        const { notes, tagIds, text } = req.body ?? {};
        if (notes !== undefined && notes !== null && (typeof notes !== "string" || notes.length > 100000)) {
          return res.status(400).json({ error: "Notes must be a string of 100,000 characters or fewer" });
        }
        if (text !== undefined && (typeof text !== "string" || text.length === 0 || text.length > 50000)) {
          return res.status(400).json({ error: "Text must be a valid string of 50,000 characters or fewer" });
        }

        const updateData: Record<string, unknown> = { updatedAt: new Date() };
        if (notes !== undefined) updateData.notes = notes;
        if (text !== undefined) updateData.text = text;
        if (tagIds !== undefined) {
          if (!Array.isArray(tagIds) || !tagIds.every((t) => typeof t === "number" && Number.isInteger(t) && t > 0)) {
            return res.status(400).json({ error: "tagIds must be an array of positive integers" });
          }
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

      return res.status(405).json({ error: "Method not allowed for highlight ID endpoint" });
    }

    // ── GET ?action=metadata-tags ─────────────────────────────────────────
    if (req.method === "GET" && action === "metadata-tags") {
      const rows = await db
        .select({ metadataTags: highlights.metadataTags })
        .from(highlights)
        .where(eq(highlights.userId, userId));
      const tagSet = new Set<string>();
      for (const row of rows) {
        try {
          const parsed = JSON.parse(row.metadataTags || "[]");
          if (Array.isArray(parsed)) parsed.forEach((t: string) => tagSet.add(t));
        } catch {}
      }
      return res.status(200).json([...tagSet].sort());
    }

    // ── GET ?action=stats ──────────────────────────────────────────────────
    if (req.method === "GET" && action === "stats") {
      const stats = await db
        .select({ domain: highlights.domain, count: sql<number>`count(*)` })
        .from(highlights)
        .where(eq(highlights.userId, userId))
        .groupBy(highlights.domain)
        .orderBy(desc(sql`count(*)`))
        .limit(20);
      return res.status(200).json(stats);
    }

    // ── GET ?action=export&format=json|markdown|obsidian|notion-csv ─────────
    if (req.method === "GET" && action === "export") {
      const format = (req.query.format as string) || "json";
      const groupBy = (req.query.groupBy as string) || "domain";
      const validFormats = ["json", "markdown", "obsidian", "notion-csv"];
      if (!validFormats.includes(format))
        return res.status(400).json({ error: `Format must be one of: ${validFormats.join(", ")}` });

      const [allHighlights, allTags] = await Promise.all([
        db.select().from(highlights).where(eq(highlights.userId, userId)).orderBy(desc(highlights.createdAt)),
        db.select().from(tags).where(eq(tags.userId, userId)),
      ]);

      const tagMap = Object.fromEntries(allTags.map((t) => [t.id, t]));

      // Helper: resolve tag names for a highlight
      const getTagNames = (h: typeof allHighlights[0]) =>
        (JSON.parse(h.tagIds || "[]") as number[]).map((id) => tagMap[id]?.name).filter(Boolean) as string[];
      const getMetadataTags = (h: typeof allHighlights[0]) => {
        try { return JSON.parse(h.metadataTags || "[]") as string[]; } catch { return []; }
      };

      // ── JSON ──
      if (format === "json") {
        const data = allHighlights.map((h) => ({
          id: h.id,
          text: h.text,
          sourceUrl: h.sourceUrl,
          pageTitle: h.pageTitle,
          domain: h.domain,
          notes: h.notes,
          tags: getTagNames(h),
          metadataTags: getMetadataTags(h),
          createdAt: h.createdAt,
        }));
        return res.status(200).json({ content: JSON.stringify(data, null, 2), filename: "highlights.json" });
      }

      // ── Markdown (single file, grouped by domain) ──
      if (format === "markdown") {
        const grouped: Record<string, typeof allHighlights> = {};
        for (const h of allHighlights) {
          const key = h.domain || "Unknown Source";
          if (!grouped[key]) grouped[key] = [];
          grouped[key].push(h);
        }

        let md = `# My Mind Palace\n\n*Exported ${new Date().toLocaleDateString()}*\n\n---\n\n`;
        for (const [domain, items] of Object.entries(grouped)) {
          md += `## ${domain}\n\n`;
          for (const h of items) {
            const tagNames = getTagNames(h);
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

      // ── Obsidian (multiple MD files with YAML frontmatter, grouped by topic/tag/domain) ──
      if (format === "obsidian") {
        const validGroupBy = ["topic", "tag", "domain", "source", "all"];
        const gBy = validGroupBy.includes(groupBy) ? groupBy : "topic";

        // Group highlights
        const grouped: Record<string, typeof allHighlights> = {};
        for (const h of allHighlights) {
          let keys: string[] = [];
          if (gBy === "topic") {
            keys = getMetadataTags(h);
            if (keys.length === 0) keys = ["Uncategorized"];
          } else if (gBy === "tag") {
            keys = getTagNames(h);
            if (keys.length === 0) keys = ["Untagged"];
          } else if (gBy === "domain") {
            keys = [h.domain || "Unknown Source"];
          } else if (gBy === "source") {
            keys = [h.pageTitle || h.sourceUrl || "Unknown"];
          } else {
            keys = ["All Highlights"];
          }
          for (const key of keys) {
            if (!grouped[key]) grouped[key] = [];
            grouped[key].push(h);
          }
        }

        // Generate files array
        const files: Array<{ filename: string; content: string }> = [];
        for (const [groupName, items] of Object.entries(grouped)) {
          const safeFilename = groupName.replace(/[<>:"/\\|?*]/g, "-").trim();
          // Collect all tags/topics for this group
          const allGroupTags = new Set<string>();
          const allGroupTopics = new Set<string>();
          for (const h of items) {
            getTagNames(h).forEach((t) => allGroupTags.add(t));
            getMetadataTags(h).forEach((t) => allGroupTopics.add(t));
          }

          let md = `---\n`;
          md += `title: "${groupName}"\n`;
          md += `type: mind-palace-export\n`;
          md += `group_by: ${gBy}\n`;
          md += `exported: ${new Date().toISOString()}\n`;
          md += `highlight_count: ${items.length}\n`;
          if (allGroupTags.size > 0) md += `tags:\n${[...allGroupTags].map((t) => `  - "${t}"`).join("\n")}\n`;
          if (allGroupTopics.size > 0) md += `topics:\n${[...allGroupTopics].map((t) => `  - "${t}"`).join("\n")}\n`;
          md += `---\n\n`;
          md += `# ${groupName}\n\n`;
          md += `> ${items.length} highlights from Mind Palace\n\n---\n\n`;

          for (const h of items) {
            const tagNames = getTagNames(h);
            const metaTags = getMetadataTags(h);
            md += `## ${h.pageTitle || "Untitled"}\n\n`;
            md += `> ${h.text}\n\n`;
            md += `- **Source:** [${h.pageTitle || h.sourceUrl}](${h.sourceUrl})\n`;
            md += `- **Domain:** ${h.domain || "N/A"}\n`;
            md += `- **Saved:** ${new Date(h.createdAt).toISOString().split("T")[0]}\n`;
            if (tagNames.length) md += `- **Tags:** ${tagNames.map((t) => `#${t.replace(/\s+/g, "-")}`).join(" ")}\n`;
            if (metaTags.length) md += `- **Topics:** ${metaTags.join(", ")}\n`;
            if (h.notes) md += `- **Notes:** ${h.notes}\n`;
            md += `\n---\n\n`;
          }

          files.push({ filename: `Mind Palace - ${safeFilename}.md`, content: md });
        }

        return res.status(200).json({ files, groupBy: gBy, totalFiles: files.length });
      }

      // ── Notion CSV ──
      if (format === "notion-csv") {
        const rows = [["Title", "Highlight Text", "Source URL", "Domain", "Tags", "Topics", "Notes", "Date Saved"]];
        for (const h of allHighlights) {
          const tagNames = getTagNames(h);
          const metaTags = getMetadataTags(h);
          rows.push([
            h.pageTitle || "Untitled",
            h.text.replace(/"/g, '""'),
            h.sourceUrl,
            h.domain,
            tagNames.join(", "),
            metaTags.join(", "),
            (h.notes || "").replace(/"/g, '""'),
            new Date(h.createdAt).toISOString().split("T")[0],
          ]);
        }
        const csv = rows.map((r) => r.map((c) => `"${c}"`).join(",")).join("\n");
        return res.status(200).json({ content: csv, filename: "mind-palace-notion.csv" });
      }

      return res.status(400).json({ error: "Unknown format" });
    }

    // ── POST ?action=notion-sync — Push highlights to Notion ────────────────
    if (req.method === "POST" && action === "notion-sync") {
      const { Client: NotionClient } = await import("@notionhq/client");
      const user = await db.select().from(users).where(eq(users.id, userId)).limit(1);
      if (!user[0]?.notionToken || !user[0]?.notionDatabaseId)
        return res.status(400).json({ error: "Notion not connected. Add your Notion integration token and database ID in Settings." });

      const notion = new NotionClient({ auth: user[0].notionToken });
      const dbId = user[0].notionDatabaseId;

      // Fetch highlights to sync (all, or could be filtered)
      const filterMetadataTag = req.body?.metadataTag as string | undefined;
      const filterTagId = req.body?.tagId as number | undefined;
      const conditions = [eq(highlights.userId, userId)];
      if (filterMetadataTag) conditions.push(like(highlights.metadataTags, `%"${filterMetadataTag}"%`));
      if (filterTagId) {
        conditions.push(
          or(
            like(highlights.tagIds, `[${filterTagId}]`),
            like(highlights.tagIds, `[${filterTagId},%`),
            like(highlights.tagIds, `%,${filterTagId}]`),
            like(highlights.tagIds, `%,${filterTagId},%`)
          )!
        );
      }

      const allTags = await db.select().from(tags).where(eq(tags.userId, userId));
      const tagMap = Object.fromEntries(allTags.map((t) => [t.id, t]));

      const toSync = await db.select().from(highlights).where(and(...conditions)).orderBy(desc(highlights.createdAt));

      let synced = 0;
      let errors = 0;
      for (const h of toSync) {
        try {
          const tagNames = (JSON.parse(h.tagIds || "[]") as number[]).map((id) => tagMap[id]?.name).filter(Boolean);
          let metaTags: string[] = [];
          try { metaTags = JSON.parse(h.metadataTags || "[]"); } catch {}

          await notion.pages.create({
            parent: { database_id: dbId },
            properties: {
              "Title": { title: [{ text: { content: h.pageTitle || "Untitled Highlight" } }] },
              "Source URL": { url: h.sourceUrl || null },
              "Domain": { rich_text: [{ text: { content: h.domain || "" } }] },
              "Tags": { multi_select: tagNames.map((n) => ({ name: n })) },
              "Topics": { multi_select: metaTags.map((t) => ({ name: t })) },
              "Date Saved": { date: { start: new Date(h.createdAt).toISOString().split("T")[0] } },
            },
            children: [
              {
                object: "block",
                type: "quote",
                quote: { rich_text: [{ type: "text", text: { content: h.text.slice(0, 2000) } }] },
              },
              ...(h.notes ? [{
                object: "block" as const,
                type: "paragraph" as const,
                paragraph: { rich_text: [{ type: "text" as const, text: { content: `Notes: ${h.notes.slice(0, 2000)}` } }] },
              }] : []),
            ],
          });
          synced++;
        } catch (e) {
          console.error(`[notion-sync] Failed to sync highlight ${h.id}:`, e);
          errors++;
        }
      }

      // Update last sync timestamp
      await db.update(users).set({ notionLastSync: new Date() }).where(eq(users.id, userId));

      return res.status(200).json({
        success: true,
        synced,
        errors,
        total: toSync.length,
        message: `Synced ${synced} highlights to Notion${errors > 0 ? ` (${errors} failed)` : ""}`,
      });
    }

    // ── POST ?action=import — Bulk import highlights from Twitter/Reddit/JSON ──
    if (req.method === "POST" && action === "import") {
      const ip = getClientIp(req.headers);
      const { allowed } = rateLimit(ip, { windowMs: 60_000, max: 10 });
      if (!allowed) return res.status(429).json({ error: "Too many requests" });

      const source = (req.body?.source as string) || "manual";
      const items = req.body?.items as Array<{ text: string; sourceUrl: string; pageTitle?: string; domain?: string; notes?: string }>;

      if (!Array.isArray(items) || items.length === 0)
        return res.status(400).json({ error: "Items array is required" });
      if (items.length > 500)
        return res.status(400).json({ error: "Maximum 500 items per import" });

      let imported = 0;
      let skipped = 0;
      for (const item of items) {
        if (!item.text || typeof item.text !== "string" || item.text.length === 0) { skipped++; continue; }
        if (item.text.length > 50000) { skipped++; continue; }

        const sourceUrl = item.sourceUrl && /^https?:\/\//i.test(item.sourceUrl)
          ? item.sourceUrl
          : `https://import.mindpalace/${source}`;
        const domain = item.domain || (() => { try { return new URL(sourceUrl).hostname; } catch { return source; } })();
        const metadataTags = inferTags(item.text);

        try {
          await db.insert(highlights).values({
            userId,
            text: item.text.slice(0, 50000),
            sourceUrl,
            pageTitle: (item.pageTitle || "").slice(0, 512),
            domain: domain.slice(0, 255),
            notes: item.notes || null,
            tagIds: "[]",
            metadataTags: JSON.stringify(metadataTags),
          });
          imported++;
        } catch (e) {
          console.error("[import] Insert error:", e);
          skipped++;
        }
      }

      return res.status(201).json({
        success: true,
        imported,
        skipped,
        total: items.length,
        source,
        message: `Imported ${imported} highlights from ${source}${skipped > 0 ? ` (${skipped} skipped)` : ""}`,
      });
    }

    // ── GET (list with search/filter/pagination) ───────────────────────────
    if (req.method === "GET") {
      const search = (req.query.search as string) || "";
      const tagIdsParam = (req.query.tagIds as string) || "";
      const metadataTagParam = (req.query.metadataTag as string) || "";
      const domain = (req.query.domain as string) || "";
      const page = Math.max(1, Number(req.query.page) || 1);
      const limit = 30;
      const offset = (page - 1) * limit;

      const conditions = [eq(highlights.userId, userId)];

      if (search) {
        const escapedSearch = search.replace(/[%_\\]/g, (c) => `\\${c}`);
        const pattern = `%${escapedSearch}%`;
        conditions.push(
          or(
            ilike(highlights.text, pattern),
            ilike(highlights.pageTitle, pattern),
            ilike(highlights.notes, pattern),
            ilike(highlights.domain, pattern)
          )!
        );
      }

      if (domain) conditions.push(eq(highlights.domain, domain));

      if (tagIdsParam) {
        const ids = tagIdsParam.split(",").map(Number).filter((n) => !isNaN(n) && n > 0);
        if (ids.length > 0) {
          conditions.push(
            or(
              ...ids.flatMap((id) => [
                like(highlights.tagIds, `[${id}]`),
                like(highlights.tagIds, `[${id},%`),
                like(highlights.tagIds, `%,${id}]`),
                like(highlights.tagIds, `%,${id},%`),
              ])
            )!
          );
        }
      }

      if (metadataTagParam) {
        const mTags = metadataTagParam.split(",").filter(Boolean);
        if (mTags.length > 0) {
          conditions.push(
            or(...mTags.map((mt) => like(highlights.metadataTags, `%"${mt}"%`)))!
          );
        }
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

    // ── POST (create) ──────────────────────────────────────────────────────
    if (req.method === "POST") {
      const ip = getClientIp(req.headers);
      const { allowed } = rateLimit(ip, { windowMs: 60_000, max: 60 });
      if (!allowed) return res.status(429).json({ error: "Too many requests, please try again later" });
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
  } catch (err: unknown) {
    console.error("[highlights/index] Error:", err);
    return res.status(500).json({ error: "Internal server error" });
  }
}
