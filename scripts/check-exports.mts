// Checks the export formatters and import parsers with hostile inputs. Run: npx tsx scripts/check-exports.mts
import * as fmtMod from "../src/server/highlights/export-format";
import * as parsersMod from "../src/lib/import-parsers";

const fmt: any = (fmtMod as any).safeFilename ? fmtMod : (fmtMod as any).default;
const parsers: any = (parsersMod as any).parseCsv ? parsersMod : (parsersMod as any).default;

let pass = 0, fail = 0;
const ok = (name: string, cond: boolean, extra = "") => { cond ? pass++ : fail++; console.log(`${cond ? "PASS" : "FAIL"}  ${name}${cond ? "" : "  <-- " + extra}`); };

// ── filenames ──
const used = new Set<string>();
const names = ["README", "Readme", "readme", 'Title with "quotes" / slashes \\ and : * ? < > |', "CON", "a".repeat(600), "   ", "Économie", "trailing dots..."]
  .map((n) => fmt.safeFilename(n, used));
ok("case-insensitive collisions get unique names", new Set(names.map((n: string) => n.toLowerCase())).size === names.length, names.join(" | "));
ok("no illegal filename characters", names.every((n: string) => !/[<>:"/\\|?*\u0000-\u001f]/.test(n)), names.join(" | "));
ok("names are at most ~90 chars", names.every((n: string) => n.length <= 90), String(Math.max(...names.map((n: string) => n.length))));
ok("Windows reserved names are prefixed", names.includes("_CON.md"), names.join(" | "));
ok("blank names fall back to Untitled", names.includes("Untitled.md"), names.join(" | "));
ok("no trailing dot before the extension", !names.some((n: string) => /\.\.md$|\. \.md$/.test(n)), names.join(" | "));

// ── YAML / Markdown ──
const nasty = {
  id: 1, text: "line one\n---\n# not a heading\n> quoted", sourceUrl: "https://ex.com/a b)(c", pageTitle: 'He said "hi" \\ [x]',
  domain: "ex.com", notes: "note line 1\n---\nnote line 3", tags: ['AI "quoted" tag', "Économie"], topics: ["AI"], createdAt: "2026-05-01T10:00:00Z",
};
const pack = fmt.buildAiPack([nasty, { ...nasty, id: 2, text: "second" }, { ...nasty, id: 3, sourceUrl: "https://other.org/x", pageTitle: "README", text: "third" }], new Date("2026-10-19T00:00:00Z"));
const names2 = pack.map((f: any) => f.filename);
ok("AI pack has README, sources.md, highlights.jsonl", ["README.md", "sources.md", "highlights.jsonl"].every((n) => names2.includes(n)), names2.join(", "));
ok("AI pack groups highlights by source page (2 source notes)", names2.filter((n: string) => n.startsWith("sources/")).length === 2, names2.join(", "));
ok("a page titled README does not overwrite the top-level README", names2.filter((n: string) => n.toLowerCase().endsWith("readme.md")).length === 2 && names2.includes("sources/README.md"), names2.join(", "));
const jsonl = pack.find((f: any) => f.filename === "highlights.jsonl").content.trim().split("\n").map((l: string) => JSON.parse(l));
ok("JSONL has one valid JSON object per highlight with tags and savedAt", jsonl.length === 3 && jsonl[0].tags.length === 2 && jsonl[0].savedAt === "2026-05-01T10:00:00.000Z", JSON.stringify(jsonl[0]).slice(0, 120));
const note = pack.find((f: any) => f.filename.startsWith("sources/He said")).content as string;
const front = note.split("\n---\n")[0].replace(/^---\n/, "");
const scalarsOk = front.split("\n").every((l) => {
  const m = l.match(/^(?:\s+- |[a-z_]+: )(".*")$/);
  if (!m) return /^[a-z_]+:( \d+| \d{4}-\d\d-\d\d| mind-palace)?$/.test(l);
  try { JSON.parse(m[1]); return true; } catch { return false; }
});
ok("YAML frontmatter values are valid quoted strings (quotes/backslashes escaped)", scalarsOk, front);
ok("multi-line highlight stays inside the blockquote", note.includes("> line one\n> ---\n> # not a heading\n> > quoted"), note.slice(0, 300));
ok("notes lines that look like rules/headings are escaped", note.includes("\\---"), note);
ok("URLs with spaces/parentheses use <...> link form", note.includes("<https://ex.com/a%20b)(c>"), note.slice(0, 400));

// ── CSV ──
const row = fmt.csvRow(['=HYPERLINK("http://evil")', "+cmd|' /C calc'!A0", "-2+3", "@SUM(A1)", 'Title with "quotes", commas\nand newline', "plain"]);
const parsed = parsers.parseCsv(row)[0];
ok("CSV round-trips through a real CSV parser (6 cells)", parsed.length === 6, JSON.stringify(parsed));
ok("formula cells are neutralised with a leading apostrophe", parsed.slice(0, 4).every((c: string) => c.startsWith("'")), JSON.stringify(parsed));
ok("quotes, commas and newlines survive", parsed[4] === 'Title with "quotes", commas\nand newline', JSON.stringify(parsed[4]));

// ── import parsers ──
const likeJs = 'window.YTD.like.part0 = [ { "like" : { "tweetId" : "123", "fullText" : "A liked tweet about memory", "expandedUrl" : "https://twitter.com/i/web/status/123" } } ]';
const tw = parsers.parseTwitter(likeJs);
ok("X like.js imports as-is (no manual editing)", tw.items.length === 1 && tw.items[0].text.includes("memory") && tw.items[0].sourceUrl.includes("123"), JSON.stringify(tw));
const tweetsJs = 'window.YTD.tweets.part0 = [ { "tweet" : { "id_str" : "9", "full_text" : "My own tweet", "created_at" : "Wed Oct 10 20:19:24 +0000 2018" } } ]';
const tw2 = parsers.parseTwitter(tweetsJs);
ok("X tweets.js imports with date", tw2.items.length === 1 && tw2.items[0].createdAt?.startsWith("2018-10-10"), JSON.stringify(tw2));
ok("garbage .js is rejected with a message (no line-by-line junk)", parsers.parseTwitter("var x = 1;\nfoo();").items.length === 0);
const redditCsv = "id,permalink\r\nabc,https://www.reddit.com/r/learnprogramming/comments/abc/title/\r\ndef,https://www.reddit.com/r/AskHistorians/comments/def/x/\r\n";
const rc = parsers.parseReddit(redditCsv);
ok("Reddit saved_posts.csv: 2 rows, clean URLs (no \\r)", rc.items.length === 2 && rc.items.every((i: any) => !/\r/.test(i.text + i.sourceUrl)), JSON.stringify(rc.items));
const redditApi = JSON.stringify({ kind: "Listing", data: { children: [{ kind: "t3", data: { title: "Great post", selftext: "Body text here", permalink: "/r/x/comments/1/great/", subreddit: "x", created_utc: 1700000000 } }, { kind: "t1", data: { body: "A saved comment", permalink: "/r/y/comments/2/z/c1/", subreddit: "y" } }] } });
const ra = parsers.parseReddit(redditApi);
ok("Reddit API JSON listing: posts and comments", ra.items.length === 2 && ra.items[0].sourceUrl.startsWith("https://www.reddit.com/r/x"), JSON.stringify(ra.items).slice(0, 200));
const genericCsv = 'text,sourceUrl,pageTitle,notes\n"Multi\nline ""quoted"" text",https://a.test/1,Title A,Note A\nSecond,https://a.test/2,Title B,\n';
const gc = parsers.parseCsvItems(genericCsv);
ok("generic CSV: multi-line quoted field, columns not shifted", gc.items.length === 2 && gc.items[0].sourceUrl === "https://a.test/1" && gc.items[0].text === 'Multi\nline "quoted" text', JSON.stringify(gc.items));
const semi = "text;sourceUrl\nHello;https://b.test\n";
ok("semicolon CSV detected", parsers.parseCsvItems(semi).items[0]?.sourceUrl === "https://b.test", JSON.stringify(parsers.parseCsvItems(semi)));
const notionCsv = [fmt.csvRow(["Title", "Highlight Text", "Source URL", "Domain", "Tags", "Topics", "Notes", "Date Saved"]), fmt.csvRow(["T", "Exported text", "https://c.test", "c.test", "a, b", "AI", "n", "2026-01-02"])].join("\r\n");
const nc = parsers.parseCsvItems("﻿" + notionCsv);
ok("Mind Palace's own Notion CSV re-imports (text, url, tags, date)", nc.items.length === 1 && nc.items[0].text === "Exported text" && nc.items[0].tags?.join("|") === "a|b" && nc.items[0].createdAt === "2026-01-02", JSON.stringify(nc.items));
const jsonlImport = parsers.parseJsonItems(pack.find((f: any) => f.filename === "highlights.jsonl").content);
ok("AI pack highlights.jsonl re-imports (3 items with tags + savedAt)", jsonlImport.items.length === 3 && jsonlImport.items[0].tags?.length === 2 && !!jsonlImport.items[0].createdAt, JSON.stringify(jsonlImport.items[0]).slice(0, 150));

console.log(`\nSUMMARY: ${pass} passed, ${fail} failed`);
process.exit(fail ? 1 : 0);
