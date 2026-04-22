## App 2: Readwise's playbook reveals both the opportunity and the moat

Readwise, founded in 2017 by **Daniel Doyon and Tristan Homsi**, is a bootstrapped company with roughly **11 employees** generating an estimated **$3–5 million ARR** from approximately 40,000–50,000 paying subscribers. It charges $5.59/month (Lite) or $9.99/month (Full, including Readwise Reader), with a 50% student discount available. The core product aggregates highlights from Kindle, Apple Books, Instapaper, Pocket, Twitter, podcasts, and physical books (via OCR), then resurfaces them daily using spaced repetition principles.

The technical insight that makes this buildable is understanding exactly how Readwise accesses Kindle highlights. **There is no official Amazon API for Kindle highlights.** Readwise uses a Chrome browser extension that navigates to `read.amazon.com/notebook`, authenticates with the user's Amazon session, and scrapes the HTML DOM. This is the same approach used by Bookcision, an open-source JavaScript bookmarklet now maintained by Readwise (source code at github.com/TristanH/bookcision). The second access method is parsing the `My Clippings.txt` file from a physical Kindle connected via USB — a plain-text file with a well-documented format where entries are separated by `==========` and include book title, author, location, date, and highlighted text.

**For your MVP, start with My Clippings.txt file upload** — it's the most reliable method, fully within your control, and avoidable of any Amazon Terms of Service gray areas. Add the Chrome extension scraping approach in Phase 2. Both methods are well-documented with open-source parsers in JavaScript, Python, and Go.

The competitor landscape has shifted dramatically in your favor. **Pocket is shutting down (announced July 2025)** and **Omnivore was acqui-hired by ElevenLabs in October 2024** with the service going offline in November 2024 and all user data deleted. These two shutdowns displaced millions of users. The market is consolidating around Readwise Reader as the power-user choice and Matter as the design-forward option, but both have vulnerabilities: Readwise is expensive ($120/year, steep outside the US) and its Reader UI is "choked with features." Matter is iOS-only and costs $80/year. Glasp is the only player in social highlighting but has no mobile app. Weava is outdated with cluttered ads. Liner pivoted to AI search, alienating its original highlighting users.

### How the highlight app should be built

The recommended stack differs from the step challenge because this app doesn't need native health APIs — it starts as a **web app with a Chrome extension**, which is the most AI-tool-friendly combination possible.

**Next.js 14+ (App Router) + Supabase + TailwindCSS + shadcn/ui + TypeScript on Vercel** is the consensus "vibe coding" stack for 2026. Cursor has pre-built rules for this exact combination. Supabase provides an official MCP server that lets your AI coding agent directly read your database schema. Vercel offers free hosting with 100GB bandwidth. This stack has more AI training data than any other, meaning fewer hallucinations and better code suggestions from Claude Code and Cursor.

The database needs six core tables: `profiles` (extending Supabase auth), `sources` (books, articles, podcasts with source_type and source_origin tracking), `highlights` (the core entity with text, notes, color, location, review tracking), `tags`, `collections`, and `review_sessions` (tracking what was shown and engaged with). Full-text search uses PostgreSQL's built-in `to_tsvector` — no need for Elasticsearch. Row Level Security ensures users only see their own highlights. A trigger function automatically updates highlight counts on the sources table.

The Chrome extension for web highlighting follows a standard Manifest V3 architecture: a content script listens for `mouseup` events, captures `window.getSelection()`, wraps selected text in a styled `<span>`, and sends the data to your Supabase backend via the user's JWT token. A basic highlight capture extension is a **weekend project**. Adding persistent visual highlights that survive page reloads is a 1–2 week project. The key permissions needed are `storage`, `activeTab`, `contextMenus`, and `scripting`.

For daily review email delivery, **Resend** is the recommended email service — it has a permanent free tier of 3,000 emails/month (covering ~100 daily users), React Email templates written as JSX, and excellent Next.js integration. Supabase Edge Functions handle the cron job scheduling.

### Phased implementation and cost reality

| Phase | Timeline | What Ships |
|-------|----------|-----------|
| Weekend Sprint | 2–3 days | Auth, manual highlight input, basic list, deploy to Vercel |
| MVP | 2 weeks | Kindle file upload, CSV import, tags, daily review page |
| Core v1 | 2 months | Email delivery, Chrome extension, Notion/Obsidian export, PWA |
| Growth | 3–6 months | Push notifications, Kindle auto-sync, AI features, Stripe payments |

**MVP hosting costs: approximately $15/year.** Supabase free tier gives you 500MB database (enough for ~500,000 highlights), 50K monthly active users, and unlimited API requests. Vercel's free tier provides 100GB bandwidth. Resend's free tier covers 3,000 emails/month. Chrome Web Store registration is a one-time $5 fee. At 500–1,000 users with daily emails, costs rise to roughly **$66/month** (Supabase Pro $25 + Vercel Pro $20 + Resend Pro $20). Even at 5,000 users, total costs stay under **$215/month**.

If you charge $5/month and convert just 200 users, that's $12,000/year in revenue against roughly $2,580/year in costs — a profitable business from a small user base.

---

## Claude Code is a genuine force multiplier, but requires the right workflow

Claude Code is Anthropic's agentic CLI tool that operates in your terminal, autonomously reading files, editing code, running commands, managing git, and handling multi-file workflows. It's not "Claude in a terminal" — it's closer to **an autonomous development agent** with persistent memory (via CLAUDE.md files), background task scheduling, MCP integrations for databases and external services, and the ability to spawn multiple sub-agents working simultaneously.

The practical cost for a solo developer is **$20/month on Claude Pro** for basic access, or $100/month on Max 5x for heavy use. Real-world data shows the average developer spends roughly $6/day, with 90% staying under $12/day. One documented power user consumed $15,000+ in API-equivalent compute over 8 months while paying only ~$800 total on the Max plan.

The critical workflow that separates successful Claude Code projects from frustrating ones follows a strict sequence: **plan first, then build incrementally**. Use `/plan` mode before writing any code. Create a CLAUDE.md file with `/init` that establishes your coding standards, preferred libraries, and architecture decisions — Claude reads this at the start of every session. Use Sonnet for 80% of tasks (cheaper, faster) and switch to Opus only for complex architecture decisions. Commit after every working feature. Manually run `/compact` before starting new features to prevent context contamination.

The comparison landscape as of early 2026 shows meaningful differentiation across tools:

**Cursor** ($20/month Pro) is the most popular AI IDE with 500K+ developers and an estimated $2B+ ARR. It's a VS Code fork with the best autocomplete in the industry (via Supermaven) and powerful agent mode for multi-file editing. It recently moved to a credit-based system that can be confusing. Best for developers who want AI integrated directly into their editor.

**Replit Agent** ($25/month) is best for absolute beginners — zero-setup, browser-based, goes from idea to deployed app without local installation. It hit $100M ARR with a 10x growth surge after launching its Agent feature. The trade-off is vendor lock-in and unpredictable effort-based pricing.

**GitHub Copilot** ($10/month Pro) remains the best value — it works in any editor, has 20M+ developers, and recently launched agentic capabilities including autonomous issue-to-PR coding agents. The $10 price point makes it a no-brainer complement to any other tool.

**v0.dev** (Vercel, $20/month) produces the highest-quality React/Next.js UI code of any AI builder, with one-click Vercel deployment and Figma import. It's frontend-only — no backend, database, or auth — but excellent for prototyping UI components.

**Lovable** ($25/month) deserves special mention for its trajectory: **$20M ARR in 2 months, $200M ARR in 8 months, and a $6.6B valuation** — possibly the fastest-growing startup in history. It handles full-stack generation with built-in Supabase integration and is specifically designed for non-coders building MVPs.

### The optimal $50/month AI development stack

The recommended approach for an MBA builder: **Claude Code Pro ($20/month) for primary development + Cursor Pro ($20/month) for daily editing + GitHub Copilot ($10/month) for always-on autocomplete**. Use v0.dev's free tier for UI prototyping and Lovable's free tier for rapid full-stack prototyping when you need quick validation. This $50/month investment gives you capabilities that would have required a $150K+/year developer salary just two years ago.

Prerequisite knowledge you'll need: Git basics (2–3 hours to learn), terminal navigation (1–2 hours), JavaScript/TypeScript fundamentals (10–20 hours), and React basics (10–15 hours). Supabase's quickstart guide and Vercel's Next.js tutorial at nextjs.org/learn are the fastest paths to competency.
