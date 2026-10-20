// Turns files people already have (X/Twitter archive, Reddit data export, Mind Palace exports,
// spreadsheets) into highlight rows for POST /api/highlights?action=import. Pure functions.

export type ImportSource = "twitter" | "reddit" | "json" | "csv";

export interface ImportItem {
  text: string;
  sourceUrl: string;
  pageTitle?: string;
  domain?: string;
  notes?: string;
  tags?: string[];
  metadataTags?: string[];
  createdAt?: string;
}

export interface ParseResult {
  items: ImportItem[];
  error?: string;
}

/** RFC 4180 CSV: quoted fields, doubled quotes, line breaks inside quotes; delimiter auto-detected. */
export function parseCsv(input: string): string[][] {
  const text = input.replace(/^\uFEFF/, "");
  const firstLine = text.split(/\r?\n/, 1)[0] ?? "";
  const counts = { ",": 0, ";": 0, "\t": 0 } as Record<string, number>;
  let quoted = false;
  for (const ch of firstLine) {
    if (ch === '"') quoted = !quoted;
    else if (!quoted && ch in counts) counts[ch]++;
  }
  const delimiter = Object.entries(counts).sort((a, b) => b[1] - a[1])[0][1] > 0
    ? Object.entries(counts).sort((a, b) => b[1] - a[1])[0][0]
    : ",";

  const rows: string[][] = [];
  let row: string[] = [];
  let field = "";
  let inQuotes = false;
  for (let i = 0; i < text.length; i++) {
    const ch = text[i];
    if (inQuotes) {
      if (ch === '"') {
        if (text[i + 1] === '"') { field += '"'; i++; }
        else inQuotes = false;
      } else field += ch;
    } else if (ch === '"' && field === "") inQuotes = true;
    else if (ch === delimiter) { row.push(field); field = ""; }
    else if (ch === "\n" || ch === "\r") {
      if (ch === "\r" && text[i + 1] === "\n") i++;
      row.push(field); field = "";
      if (row.some((c) => c.trim() !== "")) rows.push(row);
      row = [];
    } else field += ch;
  }
  row.push(field);
  if (row.some((c) => c.trim() !== "")) rows.push(row);
  return rows;
}

const norm = (s: string) => s.toLowerCase().replace(/[^a-z0-9]/g, "");

/** Rows as objects keyed by normalised header ("Source URL" -> "sourceurl"). */
function csvObjects(text: string): Array<Record<string, string>> {
  const [header, ...rows] = parseCsv(text);
  if (!header) return [];
  const keys = header.map(norm);
  return rows.map((r) => Object.fromEntries(keys.map((k, i) => [k, (r[i] ?? "").trim()])));
}

const pick = (o: Record<string, string>, ...names: string[]) => {
  for (const n of names) if (o[n]) return o[n];
  return "";
};

const splitList = (s: string) => s.split(/[,;]/).map((t) => t.trim()).filter(Boolean);

/** X/Twitter `window.YTD.like.part0 = [...]` files and plain JSON arrays. */
function parseJsonLoose(text: string): unknown {
  const cleaned = text.replace(/^\uFEFF/, "").replace(/^\s*window\.YTD\.[\w.]+\s*=\s*/, "");
  return JSON.parse(cleaned);
}

export function parseTwitter(text: string): ParseResult {
  let data: unknown;
  try { data = parseJsonLoose(text); } catch { return { items: [], error: "This doesn't look like an X/Twitter archive file (like.js, bookmark.js or tweets.js)." }; }
  const list = Array.isArray(data) ? data : ((data as any)?.data ?? (data as any)?.bookmarks ?? (data as any)?.tweets ?? []);
  const items: ImportItem[] = [];
  for (const entry of Array.isArray(list) ? list : []) {
    const t = (entry && (entry.like || entry.bookmark || entry.tweet)) || entry || {};
    const body = String(t.fullText || t.full_text || t.text || t.content || "").trim();
    if (!body) continue;
    const id = t.tweetId || t.id_str || t.id;
    const author = t.user?.screen_name || t.author?.username || t.username || "";
    const linked = t.entities?.urls?.[0]?.expanded_url || "";
    items.push({
      text: body,
      sourceUrl: t.expandedUrl || (id ? `https://x.com/i/web/status/${id}` : "https://x.com"),
      pageTitle: author ? `@${author} on X` : "Post on X",
      domain: "x.com",
      notes: linked ? `Linked: ${linked}` : undefined,
      createdAt: t.created_at ? new Date(t.created_at).toISOString() : undefined,
    });
  }
  return items.length ? { items } : { items, error: "No posts found in this file." };
}

export function parseReddit(text: string): ParseResult {
  const trimmed = text.trim();
  if (trimmed.startsWith("{") || trimmed.startsWith("[")) {
    let data: any;
    try { data = JSON.parse(trimmed); } catch { return { items: [], error: "Invalid JSON file." }; }
    const listings = Array.isArray(data) ? data : [data];
    const things: any[] = [];
    for (const l of listings) {
      if (Array.isArray(l?.data?.children)) things.push(...l.data.children);
      else if (Array.isArray(l?.children)) things.push(...l.children);
      else if (Array.isArray(l?.data)) things.push(...l.data);
      else things.push(l);
    }
    const items: ImportItem[] = [];
    for (const thing of things) {
      const p = thing?.data ?? thing ?? {};
      const permalink = p.permalink ? `https://www.reddit.com${p.permalink}` : p.url || "";
      const body = String(p.body || p.selftext || p.title || "").trim();
      if (!body) continue;
      const sub = p.subreddit || "";
      items.push({
        text: body,
        sourceUrl: permalink || "https://www.reddit.com",
        pageTitle: p.title || p.link_title || (sub ? `r/${sub}` : "Reddit"),
        domain: "reddit.com",
        notes: sub ? `Subreddit: r/${sub}` : undefined,
        createdAt: p.created_utc ? new Date(p.created_utc * 1000).toISOString() : undefined,
      });
    }
    return items.length ? { items } : { items, error: "No Reddit posts or comments found in this file." };
  }

  // Reddit data export CSVs: saved_posts.csv / saved_comments.csv (id, permalink[, body, ...])
  const rows = csvObjects(text);
  const items: ImportItem[] = [];
  for (const r of rows) {
    const link = pick(r, "permalink", "url", "link");
    const url = link && !/^https?:/i.test(link) ? `https://www.reddit.com${link.startsWith("/") ? "" : "/"}${link}` : link;
    const body = pick(r, "body", "selftext", "text", "title");
    if (!url && !body) continue;
    items.push({
      text: body || url,
      sourceUrl: url || "https://www.reddit.com",
      pageTitle: pick(r, "title", "linktitle") || (body ? "Reddit comment" : "Saved Reddit post"),
      domain: "reddit.com",
      createdAt: pick(r, "date", "createdutc", "created") || undefined,
    });
  }
  return items.length ? { items } : { items, error: "No rows found. Upload saved_posts.csv or saved_comments.csv from your Reddit data export." };
}

/** Mind Palace JSON / JSONL exports and generic arrays of {text, url, ...}. */
export function parseJsonItems(text: string): ParseResult {
  const trimmed = text.replace(/^\uFEFF/, "").trim();
  let records: any[] = [];
  try {
    const data = JSON.parse(trimmed);
    records = Array.isArray(data) ? data : data.items || data.highlights || [data];
  } catch {
    // JSON Lines (e.g. highlights.jsonl from the AI Brain Pack)
    try { records = trimmed.split(/\r?\n/).filter((l) => l.trim()).map((l) => JSON.parse(l)); }
    catch { return { items: [], error: "This file isn't valid JSON or JSON Lines." }; }
  }
  const items: ImportItem[] = [];
  for (const r of records) {
    const body = typeof r?.text === "string" ? r.text.trim() : typeof r?.highlight === "string" ? r.highlight.trim() : "";
    if (!body) continue;
    items.push({
      text: body,
      sourceUrl: r.sourceUrl || r.url || r.source_url || r.link || "",
      pageTitle: r.pageTitle || r.title || r.page_title || "",
      domain: r.domain || "",
      notes: typeof r.notes === "string" ? r.notes : typeof r.note === "string" ? r.note : "",
      tags: Array.isArray(r.tags) ? r.tags.filter((t: unknown) => typeof t === "string") : undefined,
      metadataTags: Array.isArray(r.metadataTags) ? r.metadataTags : Array.isArray(r.topics) ? r.topics : undefined,
      createdAt: r.createdAt || r.savedAt || r.created_at || undefined,
    });
  }
  return items.length ? { items } : { items, error: "No items with a \"text\" field were found." };
}

/** Spreadsheets, including Mind Palace's own Notion CSV export. */
export function parseCsvItems(text: string): ParseResult {
  const rows = csvObjects(text);
  const items: ImportItem[] = [];
  for (const r of rows) {
    const body = pick(r, "text", "highlighttext", "highlight", "quote", "content");
    if (!body) continue;
    const tags = pick(r, "tags");
    const topics = pick(r, "topics");
    items.push({
      text: body,
      sourceUrl: pick(r, "sourceurl", "url", "link", "source"),
      pageTitle: pick(r, "pagetitle", "title"),
      domain: pick(r, "domain"),
      notes: pick(r, "notes", "note"),
      tags: tags ? splitList(tags) : undefined,
      metadataTags: topics ? splitList(topics) : undefined,
      createdAt: pick(r, "datesaved", "createdat", "date", "saved") || undefined,
    });
  }
  return items.length
    ? { items }
    : { items, error: "No rows with a text column found. The first row must be a header such as: text, sourceUrl, pageTitle, notes." };
}

export function parseImportFile(source: ImportSource, text: string): ParseResult {
  if (source === "twitter") return parseTwitter(text);
  if (source === "reddit") return parseReddit(text);
  if (source === "json") return parseJsonItems(text);
  return parseCsvItems(text);
}
