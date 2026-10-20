import type { VercelRequest, VercelResponse } from "@vercel/node";
import { and, asc, desc, eq, gte, ilike, isNotNull, isNull, like, or, sql } from "drizzle-orm";
import { db } from "../../lib/db";
import { highlights, tags, users } from "../../schema";
import { getAuthUserIdFromVercelReq } from "../../lib/auth";
import { applyCors } from "../../lib/cors";
import { rateLimit, getClientIp } from "../../lib/rate-limit";
import { buildAiPack, csvRow, isoDay, mdHighlight, mdLinkText, safeFilename, yamlStr, type ExportFile, type ExportHighlight } from "./export-format";
import { inferTags } from "../../lib/keyword-tags";

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

      if (req.method === "PATCH" && action === "restore") {
        const existing = await db
          .select({ id: highlights.id })
          .from(highlights)
          .where(and(eq(highlights.id, id), eq(highlights.userId, userId)))
          .limit(1);
        if (existing.length === 0) return res.status(404).json({ error: "Highlight not found" });
        await db.update(highlights)
          .set({ deletedAt: null })
          .where(and(eq(highlights.id, id), eq(highlights.userId, userId)));
        return res.status(200).json({ success: true });
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
        const purge = action === "purge";
        const existing = await db
          .select({ id: highlights.id })
          .from(highlights)
          .where(and(eq(highlights.id, id), eq(highlights.userId, userId)))
          .limit(1);
        if (existing.length === 0) return res.status(404).json({ error: "Highlight not found" });

        if (purge) {
          // Permanent delete: only rows already in the trash, so a stray request can't erase a live highlight.
          const removed = await db
            .delete(highlights)
            .where(and(eq(highlights.id, id), eq(highlights.userId, userId), isNotNull(highlights.deletedAt)))
            .returning({ id: highlights.id });
          if (removed.length === 0) return res.status(409).json({ error: "Highlight must be in the trash before it can be deleted permanently" });
        } else {
          // Soft delete — move to trash
          await db.update(highlights)
            .set({ deletedAt: new Date() })
            .where(and(eq(highlights.id, id), eq(highlights.userId, userId)));
        }
        return res.status(200).json({ success: true });
      }

      return res.status(405).json({ error: "Method not allowed for highlight ID endpoint" });
    }

    // ── GET ?action=trash ─────────────────────────────────────────────────
    if (req.method === "DELETE" && action === "empty-trash") {
      const removed = await db
        .delete(highlights)
        .where(and(eq(highlights.userId, userId), isNotNull(highlights.deletedAt)))
        .returning({ id: highlights.id });
      return res.status(200).json({ success: true, deleted: removed.length });
    }

    if (req.method === "GET" && action === "trash") {
      const items = await db
        .select()
        .from(highlights)
        .where(and(eq(highlights.userId, userId), isNotNull(highlights.deletedAt)))
        .orderBy(desc(highlights.deletedAt));
      return res.status(200).json(items);
    }

    // ── GET ?action=metadata-tags ─────────────────────────────────────────
    if (req.method === "GET" && action === "metadata-tags") {
      const rows = await db
        .select({ metadataTags: highlights.metadataTags })
        .from(highlights)
        .where(and(eq(highlights.userId, userId), isNull(highlights.deletedAt)));
      const tagSet = new Set<string>();
      for (const row of rows) {
        try {
          const parsed = JSON.parse(row.metadataTags || "[]");
          if (Array.isArray(parsed)) parsed.forEach((t: string) => tagSet.add(t));
        } catch {
          // skip rows whose stored topics are not valid JSON
        }
      }
      return res.status(200).json([...tagSet].sort());
    }

    // ── GET ?action=stats ──────────────────────────────────────────────────
    if (req.method === "GET" && action === "stats") {
      const stats = await db
        .select({ domain: highlights.domain, count: sql<number>`count(*)` })
        .from(highlights)
        .where(and(eq(highlights.userId, userId), isNull(highlights.deletedAt)))
        .groupBy(highlights.domain)
        .orderBy(desc(sql`count(*)`))
        .limit(20);
      return res.status(200).json(stats);
    }

    // ── GET ?action=export&format=json|markdown|obsidian|notion-csv|ai-pack ──
    if (req.method === "GET" && action === "export") {
      const format = (req.query.format as string) || "json";
      const groupBy = (req.query.groupBy as string) || "domain";
      const validFormats = ["json", "markdown", "obsidian", "notion-csv", "ai-pack"];
      if (!validFormats.includes(format))
        return res.status(400).json({ error: `Format must be one of: ${validFormats.join(", ")}` });

      const [allHighlights, allTags] = await Promise.all([
        db.select().from(highlights).where(and(eq(highlights.userId, userId), isNull(highlights.deletedAt))).orderBy(desc(highlights.createdAt)),
        db.select().from(tags).where(eq(tags.userId, userId)),
      ]);

      const tagMap = Object.fromEntries(allTags.map((t) => [t.id, t]));
      const parseList = <T,>(raw: string | null): T[] => {
        try { const v = JSON.parse(raw || "[]"); return Array.isArray(v) ? (v as T[]) : []; } catch { return []; }
      };
      const items: ExportHighlight[] = allHighlights.map((h) => ({
        id: h.id,
        text: h.text,
        sourceUrl: h.sourceUrl,
        pageTitle: h.pageTitle,
        domain: h.domain,
        notes: h.notes,
        tags: parseList<number>(h.tagIds).map((id) => tagMap[id]?.name).filter(Boolean) as string[],
        topics: parseList<string>(h.metadataTags),
        createdAt: h.createdAt,
      }));

      // ── JSON ──
      if (format === "json") {
        const data = items.map(({ topics, ...h }) => ({ ...h, metadataTags: topics }));
        return res.status(200).json({ content: JSON.stringify(data, null, 2), filename: "highlights.json" });
      }

      // ── Markdown (single file, grouped by domain) ──
      if (format === "markdown") {
        const grouped = new Map<string, ExportHighlight[]>();
        for (const h of items) {
          const key = h.domain || "Unknown Source";
          grouped.set(key, [...(grouped.get(key) ?? []), h]);
        }
        let md = `# My Mind Palace\n\n*Exported ${isoDay(new Date())} · ${items.length} highlights*\n\n---\n\n`;
        for (const [domain, group] of grouped) {
          md += `## ${mdLinkText(domain)}\n\n`;
          for (const h of group) md += mdHighlight(h);
        }
        return res.status(200).json({ content: md, filename: "highlights.md" });
      }

      // ── AI brain pack (ZIP built client-side from files[]) ──
      if (format === "ai-pack") {
        const files = buildAiPack(items);
        return res.status(200).json({ files, totalFiles: files.length, filename: "mind-palace-ai-brain.zip" });
      }

      // ── Obsidian (multiple MD files with YAML frontmatter, grouped by topic/tag/domain/source) ──
      if (format === "obsidian") {
        const validGroupBy = ["topic", "tag", "domain", "source", "all"];
        const gBy = validGroupBy.includes(groupBy) ? groupBy : "topic";

        const grouped = new Map<string, ExportHighlight[]>();
        for (const h of items) {
          let keys: string[];
          if (gBy === "topic") keys = h.topics.length ? h.topics : ["Uncategorized"];
          else if (gBy === "tag") keys = h.tags.length ? h.tags : ["Untagged"];
          else if (gBy === "domain") keys = [h.domain || "Unknown Source"];
          else if (gBy === "source") keys = [h.pageTitle || h.sourceUrl || "Unknown"];
          else keys = ["All Highlights"];
          for (const key of keys) grouped.set(key, [...(grouped.get(key) ?? []), h]);
        }

        const used = new Set<string>();
        const files: ExportFile[] = [];
        const exported = new Date().toISOString();
        for (const [groupName, group] of grouped) {
          const groupTags = [...new Set(group.flatMap((h) => h.tags))];
          const groupTopics = [...new Set(group.flatMap((h) => h.topics))];
          let md = `---\n`;
          md += `title: ${yamlStr(groupName)}\n`;
          md += `type: mind-palace-export\n`;
          md += `group_by: ${gBy}\n`;
          md += `exported: ${exported}\n`;
          md += `highlight_count: ${group.length}\n`;
          if (groupTags.length) md += `tags:\n${groupTags.map((t) => `  - ${yamlStr(t)}`).join("\n")}\n`;
          if (groupTopics.length) md += `topics:\n${groupTopics.map((t) => `  - ${yamlStr(t)}`).join("\n")}\n`;
          md += `---\n\n# ${mdLinkText(groupName)}\n\n> ${group.length} highlights from Mind Palace\n\n---\n\n`;
          for (const h of group) md += mdHighlight(h, { heading: `## ${mdLinkText(h.pageTitle || "Untitled")}` });
          files.push({ filename: safeFilename(`Mind Palace - ${groupName}`, used), content: md });
        }
        return res.status(200).json({ files, groupBy: gBy, totalFiles: files.length });
      }

      // ── Notion CSV ──
      if (format === "notion-csv") {
        const rows = [csvRow(["Title", "Highlight Text", "Source URL", "Domain", "Tags", "Topics", "Notes", "Date Saved"])];
        for (const h of items) {
          rows.push(csvRow([h.pageTitle || "Untitled", h.text, h.sourceUrl, h.domain, h.tags.join(", "), h.topics.join(", "), h.notes || "", isoDay(h.createdAt)]));
        }
        return res.status(200).json({ content: rows.join("\r\n"), filename: "mind-palace-notion.csv" });
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
      const conditions = [eq(highlights.userId, userId), isNull(highlights.deletedAt)];
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
          try { metaTags = JSON.parse(h.metadataTags || "[]"); } catch { /* keep an empty list */ }

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
      if (synced > 0) await db.update(users).set({ notionLastSync: new Date() }).where(eq(users.id, userId));

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
      const { allowed } = rateLimit(`import:${userId}`, { windowMs: 60_000, max: 30 });
      if (!allowed) return res.status(429).json({ error: "Too many imports in a minute. Please wait and try again." });

      const source = typeof req.body?.source === "string" ? req.body.source.replace(/[^a-z0-9-]/gi, "").slice(0, 32) || "manual" : "manual";
      const rawItems = req.body?.items;
      if (!Array.isArray(rawItems) || rawItems.length === 0)
        return res.status(400).json({ error: "Items array is required" });
      if (rawItems.length > 500)
        return res.status(400).json({ error: "Maximum 500 items per request" });

      // Skip highlights the user already has, so importing the same file twice is harmless.
      const existing = await db
        .select({ text: highlights.text, sourceUrl: highlights.sourceUrl })
        .from(highlights)
        .where(and(eq(highlights.userId, userId), isNull(highlights.deletedAt)));
      const seen = new Set(existing.map((r) => `${r.sourceUrl}\u0000${r.text}`));

      const userTags = await db.select({ id: tags.id, name: tags.name }).from(tags).where(eq(tags.userId, userId));
      const tagIdByName = new Map(userTags.map((t) => [t.name.toLowerCase(), t.id]));
      const tagIdsFor = async (names: unknown): Promise<number[]> => {
        if (!Array.isArray(names)) return [];
        const ids: number[] = [];
        for (const raw of names.slice(0, 20)) {
          const name = typeof raw === "string" ? raw.trim().slice(0, 64) : "";
          if (!name) continue;
          let id = tagIdByName.get(name.toLowerCase());
          if (id === undefined) {
            if (tagIdByName.size >= 500) continue;
            const [created] = await db.insert(tags).values({ userId, name }).returning({ id: tags.id });
            id = created.id;
            tagIdByName.set(name.toLowerCase(), id);
          }
          if (!ids.includes(id)) ids.push(id);
        }
        return ids;
      };
      const topicsJson = (topics: string[]) => {
        const list = [...topics];
        while (list.length && JSON.stringify(list).length > 1024) list.pop();
        return JSON.stringify(list);
      };

      const rows: Array<typeof highlights.$inferInsert> = [];
      let skipped = 0;
      let duplicates = 0;
      for (const raw of rawItems) {
        const item = (raw && typeof raw === "object" ? raw : {}) as Record<string, unknown>;
        const text = typeof item.text === "string" ? item.text.trim() : "";
        if (!text || text.length > 50000) { skipped++; continue; }

        const sourceUrl = typeof item.sourceUrl === "string" && /^https?:\/\//i.test(item.sourceUrl)
          ? item.sourceUrl.slice(0, 2048)
          : `https://import.mindpalace/${source}`;
        const key = `${sourceUrl}\u0000${text}`;
        if (seen.has(key)) { duplicates++; continue; }
        seen.add(key);

        const domain = typeof item.domain === "string" && item.domain
          ? item.domain
          : (() => { try { return new URL(sourceUrl).hostname.replace(/^www\./, ""); } catch { return source; } })();
        const givenTopics = Array.isArray(item.metadataTags) ? item.metadataTags : Array.isArray(item.topics) ? item.topics : null;
        const topics = givenTopics
          ? givenTopics.filter((t): t is string => typeof t === "string" && t.trim() !== "").map((t) => t.trim().slice(0, 64)).slice(0, 20)
          : inferTags(text);
        const when = typeof item.createdAt === "string" ? item.createdAt : typeof item.savedAt === "string" ? item.savedAt : "";
        const parsed = when ? new Date(when) : null;
        const createdAt = parsed && !Number.isNaN(parsed.getTime()) && parsed.getFullYear() >= 2000 && parsed.getTime() <= Date.now() + 86_400_000
          ? parsed
          : new Date();

        rows.push({
          userId,
          text,
          sourceUrl,
          pageTitle: typeof item.pageTitle === "string" ? item.pageTitle.slice(0, 512) : "",
          domain: domain.slice(0, 255),
          notes: typeof item.notes === "string" && item.notes.trim() ? item.notes.slice(0, 100_000) : null,
          tagIds: JSON.stringify(await tagIdsFor(item.tags)),
          metadataTags: topicsJson(topics),
          createdAt,
          updatedAt: createdAt,
        });
      }

      // Batched inserts keep large imports fast on the serverless database driver.
      for (let i = 0; i < rows.length; i += 100) await db.insert(highlights).values(rows.slice(i, i + 100));

      const imported = rows.length;
      const parts = [duplicates ? `${duplicates} already in your library` : "", skipped ? `${skipped} skipped` : ""].filter(Boolean);
      return res.status(201).json({
        success: true,
        imported,
        skipped,
        duplicates,
        total: rawItems.length,
        source,
        message: `Imported ${imported} highlights${parts.length ? ` (${parts.join(", ")})` : ""}`,
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

      const conditions = [eq(highlights.userId, userId), isNull(highlights.deletedAt)];

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

      const since = typeof req.query.since === "string" && req.query.since ? new Date(req.query.since) : null;
      if (since && !Number.isNaN(since.getTime())) conditions.push(gte(highlights.createdAt, since));

      const sort = req.query.sort === "oldest" || req.query.sort === "source" ? req.query.sort : "newest";
      const order =
        sort === "oldest" ? [asc(highlights.createdAt), asc(highlights.id)]
        : sort === "source" ? [asc(highlights.domain), desc(highlights.createdAt), desc(highlights.id)]
        : [desc(highlights.createdAt), desc(highlights.id)];

      const whereClause = and(...conditions);

      const [items, countResult] = await Promise.all([
        db.select().from(highlights).where(whereClause).orderBy(...order).limit(limit).offset(offset),
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
      const { allowed } = rateLimit(`hl-create:${ip}`, { windowMs: 60_000, max: 60 });
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
          pageTitle: typeof pageTitle === "string" ? pageTitle.slice(0, 512) : "",
          domain: typeof domain === "string" ? domain.slice(0, 255) : "",
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
