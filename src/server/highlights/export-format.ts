// Pure helpers for export formats (no database access), so they can be tested in isolation.

export interface ExportHighlight {
  id: number;
  text: string;
  sourceUrl: string;
  pageTitle: string;
  domain: string;
  notes: string | null;
  tags: string[];
  topics: string[];
  createdAt: Date | string;
}

export interface ExportFile {
  filename: string;
  content: string;
}

const RESERVED_WINDOWS_NAMES = /^(con|prn|aux|nul|com[1-9]|lpt[1-9])$/i;

/** A filename that is valid on Windows, macOS and Linux and unique (case-insensitively) within `used`. */
export function safeFilename(name: string, used: Set<string>, ext = ".md", maxLength = 80): string {
  let base = String(name ?? "")
    .replace(/[\u0000-\u001f\u007f<>:"/\\|?*]/g, "-")
    .replace(/\s+/g, " ")
    .trim()
    .replace(/[. ]+$/g, "");
  if (base.length > maxLength) base = base.slice(0, maxLength).replace(/[. ]+$/g, "");
  if (!base) base = "Untitled";
  if (RESERVED_WINDOWS_NAMES.test(base)) base = `_${base}`;
  let candidate = base;
  for (let n = 2; used.has((candidate + ext).toLowerCase()); n++) candidate = `${base} (${n})`;
  used.add((candidate + ext).toLowerCase());
  return candidate + ext;
}

/** A YAML double-quoted scalar (JSON strings are valid YAML). */
export const yamlStr = (s: unknown) => JSON.stringify(String(s ?? ""));

/** Quote every line, so multi-line highlights stay inside the blockquote. */
export const mdQuote = (text: string) =>
  String(text ?? "").split(/\r?\n/).map((line) => (line.trim() ? `> ${line}` : ">")).join("\n");

/** Text that will not be read as a heading, rule, list or quote when placed at the start of a line. */
export const mdPlain = (text: string) =>
  String(text ?? "")
    .split(/\r?\n/)
    .map((line) => (/^\s*(#|>|[-*_]{3,}\s*$|[-*+]\s|\d+\.\s|=+\s*$)/.test(line) ? `\\${line.trimStart()}` : line))
    .join("  \n");

export const mdLinkText = (s: string) => String(s ?? "").replace(/([\[\]\\])/g, "\\$1").replace(/\s+/g, " ").trim();

export const mdUrl = (u: string) => `<${String(u ?? "").replace(/[<>\s]/g, (c) => encodeURIComponent(c))}>`;

export const isoDay = (d: Date | string) => {
  const date = new Date(d);
  return Number.isNaN(date.getTime()) ? "" : date.toISOString().slice(0, 10);
};

/** One CSV cell: always quoted, quotes doubled, and spreadsheet formulas neutralised. */
export function csvCell(value: unknown): string {
  let s = String(value ?? "");
  if (/^[=+\-@\t\r]/.test(s)) s = `'${s}`;
  return `"${s.replace(/"/g, '""')}"`;
}

export const csvRow = (cells: unknown[]) => cells.map(csvCell).join(",");

/** A highlight rendered as a Markdown section, shared by the Markdown, Obsidian and AI-pack exports. */
export function mdHighlight(h: ExportHighlight, opts: { heading?: string } = {}): string {
  let md = opts.heading ? `${opts.heading}\n\n` : "";
  md += `${mdQuote(h.text)}\n\n`;
  if (h.sourceUrl) md += `- **Source:** [${mdLinkText(h.pageTitle || h.sourceUrl)}](${mdUrl(h.sourceUrl)})\n`;
  if (h.domain) md += `- **Domain:** ${h.domain}\n`;
  md += `- **Saved:** ${isoDay(h.createdAt)}\n`;
  if (h.tags.length) md += `- **Tags:** ${h.tags.map((t) => `#${t.replace(/\s+/g, "-")}`).join(" ")}\n`;
  if (h.topics.length) md += `- **Topics:** ${h.topics.join(", ")}\n`;
  if (h.notes) md += `- **Notes:**\n\n${mdPlain(h.notes)}\n`;
  return md + `\n---\n\n`;
}

const AI_PACK_README = (count: number, sources: number, exported: string) => `# My Mind Palace — AI Brain Pack

Exported ${exported} · ${count} highlights from ${sources} sources.

This folder is your personal knowledge base, ready to plug into AI tools.

## What's inside

| File | Use it for |
|---|---|
| \`sources/\` | One Markdown note per web page or document you highlighted. Best for Obsidian, NotebookLM and local AI tools. |
| \`sources.md\` | Index of every source with how many highlights you saved from it. |
| \`highlights.jsonl\` | One highlight per line (JSON). Best for scripts, embeddings and custom RAG pipelines. |

Every note has a YAML header (title, url, domain, tags, topics, dates), so tools can filter by them.

## Use it with…

- **NotebookLM** — create a notebook, then *Add sources → Upload* and select the files in \`sources/\` (up to 50 per notebook; pick the most relevant ones if you have more). Ask questions across everything you read.
- **ChatGPT or Claude Projects** — create a project and upload \`sources.md\` plus the most relevant files from \`sources/\` as project knowledge. Ask: *"Using my highlights, summarise what I've learned about …"*.
- **Obsidian** — copy the \`sources/\` folder into your vault. Tags and topics become searchable properties; plugins such as Smart Connections or Copilot can chat with them.
- **Local AI (private, offline)** — install Ollama, then a front end such as AnythingLLM or Open WebUI, create a workspace and upload the \`sources/\` folder (or \`highlights.jsonl\`). Nothing leaves your computer.

## Field reference (highlights.jsonl)

\`id\`, \`text\`, \`notes\`, \`tags\` (your tags), \`topics\` (detected automatically), \`sourceUrl\`, \`pageTitle\`, \`domain\`, \`savedAt\` (ISO 8601).

Exported from Mind Palace — https://themindpalace.org
`;

/** The "AI brain pack": per-source Markdown notes, a JSONL file, an index and a README. */
export function buildAiPack(items: ExportHighlight[], now = new Date()): ExportFile[] {
  const bySource = new Map<string, ExportHighlight[]>();
  for (const h of items) {
    const key = h.sourceUrl || `untitled:${h.pageTitle || h.domain || "Unknown"}`;
    const list = bySource.get(key);
    if (list) list.push(h);
    else bySource.set(key, [h]);
  }

  const used = new Set<string>(); // names inside sources/ (top-level files live outside it)
  const files: ExportFile[] = [];
  const index: string[] = [];

  for (const [, group] of bySource) {
    const first = group[0];
    const title = first.pageTitle || first.domain || first.sourceUrl || "Untitled";
    const filename = safeFilename(title, used);
    const tags = [...new Set(group.flatMap((h) => h.tags))];
    const topics = [...new Set(group.flatMap((h) => h.topics))];
    const dates = group.map((h) => isoDay(h.createdAt)).filter(Boolean).sort();

    let md = `---\n`;
    md += `title: ${yamlStr(title)}\n`;
    if (first.sourceUrl) md += `url: ${yamlStr(first.sourceUrl)}\n`;
    if (first.domain) md += `domain: ${yamlStr(first.domain)}\n`;
    md += `highlights: ${group.length}\n`;
    if (dates.length) md += `first_saved: ${dates[0]}\nlast_saved: ${dates[dates.length - 1]}\n`;
    if (tags.length) md += `tags:\n${tags.map((t) => `  - ${yamlStr(t)}`).join("\n")}\n`;
    if (topics.length) md += `topics:\n${topics.map((t) => `  - ${yamlStr(t)}`).join("\n")}\n`;
    md += `source: mind-palace\n---\n\n`;
    md += `# ${mdLinkText(title)}\n\n`;
    if (first.sourceUrl) md += `Source: ${mdUrl(first.sourceUrl)}\n\n`;
    for (const h of group) md += mdHighlight({ ...h, sourceUrl: "", domain: "" }, {});
    files.push({ filename: `sources/${filename}`, content: md });
    index.push(`| [${mdLinkText(title)}](${mdUrl(`sources/${filename}`)}) | ${first.domain || ""} | ${group.length} |`);
  }

  const jsonl = items
    .map((h) =>
      JSON.stringify({
        id: h.id,
        text: h.text,
        notes: h.notes || "",
        tags: h.tags,
        topics: h.topics,
        sourceUrl: h.sourceUrl,
        pageTitle: h.pageTitle,
        domain: h.domain,
        savedAt: new Date(h.createdAt).toISOString(),
      })
    )
    .join("\n");

  const exported = isoDay(now);
  return [
    { filename: "README.md", content: AI_PACK_README(items.length, bySource.size, exported) },
    { filename: "sources.md", content: `# Sources\n\n| Source | Domain | Highlights |\n|---|---|---|\n${index.join("\n")}\n` },
    { filename: "highlights.jsonl", content: jsonl + (jsonl ? "\n" : "") },
    ...files,
  ];
}
