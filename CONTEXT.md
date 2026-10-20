# Mind Palace — Project Context

> **The single source of truth for this repository.** Everything older (`DEV_NOTES.md`, `HANDOFF_SUMMARY.md`, `PROJECT_DOCUMENTATION.md`, `IMPLEMENTATION_PLAN.md`, `docs/production-readiness-status.md`, `docs/superpowers/**`, `todo.md`, …) describes earlier states of the project and is superseded by this file. Last updated: 2026-10-20 (v2.0 release, extension 1.2.0).
>
> This file is public (the repository is public). Account IDs, user lists, connection strings and other private details are deliberately **not** here; they live in the owner's private notes and in the Vercel / Neon / Cloudflare dashboards.

---

## 1. What this is

**Mind Palace** lets people build a personal "AI brain" from what they read online. A Chrome extension saves any highlighted text (shortcut `Ctrl+Shift+S`, right-click menu, or a floating Save button); a web dashboard stores, searches, tags, sorts and exports it. The export ("**AI Brain Pack**") is shaped for NotebookLM, ChatGPT / Claude Projects, Obsidian and private local AI (Ollama + AnythingLLM). Target users: students and researchers (it started as a Harvard Business School class project, DSAIL, and is shared with a small trusted group).

| | |
|---|---|
| Website | https://themindpalace.org (the old `*.vercel.app` addresses redirect here with HTTP 308) |
| Chrome Web Store | "Mind Palace", item id `hfjlflceaophbbeadanbpibaaidbjoao` (published 1.1.0; **1.2.0 is the current build**) |
| Repository | https://github.com/aman161upadhyay/mindpalace (public), branch `main` |
| Owner / contact | Aman Upadhyay — aupadhyay@mba2027.hbs.edu |

## 2. Infrastructure map

| Piece | Where | Notes |
|---|---|---|
| Hosting + API | **Vercel**, project `mindpalace`, **Hobby plan** (max 12 serverless functions; this app uses **1**) | Deployed with the Vercel CLI (`vercel deploy --prod`); the project is **not** connected to GitHub, so pushing to `main` does not deploy |
| Database | **Neon Postgres**, project "Mindpalace" (region us-east-2) | Plain SQL migrations in `drizzle/`, applied by hand in the Neon SQL editor |
| Domain / DNS | **Cloudflare** (DNS only; domain registered there) | `A @ → 76.76.21.21` and `CNAME www → cname.vercel-dns.com`, both **DNS-only (grey cloud)**, never proxied. Domains are attached to the Vercel project |
| Email | **Resend**, sandbox sender `onboarding@resend.dev` | Only delivers to the Resend account owner until a sending domain is verified (SPF/DKIM records in Cloudflare). Used only by the daily-highlights cron |
| Extension distribution | **Chrome Web Store** developer dashboard | Every update is re-reviewed by Google |

## 3. Architecture

```
Chrome extension (MV3) ──save/recent──▶ https://themindpalace.org/api/extension/*  ┐
React + Vite SPA  ───────cookie auth──▶ https://themindpalace.org/api/*            ├─▶ ONE Vercel function (api/index.ts)
Vercel Cron (13:00 UTC) ──Bearer secret─▶ /api/cron/daily-highlights               ┘        │ router → handler
                                                                                          ▼
                                                                              Neon Postgres (Drizzle ORM)
```

* **Single function.** `api/index.ts` is the only file in `api/`. `vercel.json` rewrites `/api/:path*` to `/api?__route=:path*`; `src/server/router.ts` maps the path to a handler in `src/server/**`. (Old URLs such as `/api/extension/save`, `/api/extension/recent`, `/api/tags/:id`, `/api/tokens/:id`, `/api/highlights/:id` are resolved by the router.) Handlers use **static imports** — lazy `import()` of extensionless paths failed on Vercel with `ERR_MODULE_NOT_FOUND`. The database client (`src/lib/db.ts`) and the Resend client are created on first use so one missing variable cannot crash every route.
* **Frontend:** React 19, Vite 8, TypeScript 6, Tailwind CSS 4, wouter (routing), sonner (toasts), lucide-react (icons). Routes: `/`, `/login`, `/register`, `/forgot-password`, `/mind-palace` (dashboard), `/settings`, `/faq`, `/privacy`, `/contact`, 404.
* **Auth:** JWT (HS256, 30 days) in the HttpOnly cookie `hc_session` (`SameSite=Lax`, `Secure` in production, host-only, so users sign in again on a new domain). The Chrome extension authenticates with a per-user **API token** (`hc_…`) instead of the cookie.
* **Topics:** the server auto-labels highlights with keyword "topics" (AI, Security, Design, Engineering, Business, Science, Writing, Health) via `src/lib/keyword-tags.ts`; user tags are separate.
* **Soft delete:** deleting a highlight sets `deleted_at`; Trash lists those rows. Every read path filters `deleted_at IS NULL`.

### Repository map

| Path | What it is |
|---|---|
| `api/index.ts` | The single serverless function (entry + routing glue) |
| `src/server/router.ts` | Path → handler map and route resolver |
| `src/server/auth/` | `login`, `logout`, `register`, `reset-password`, `me` (profile, Notion settings) |
| `src/server/highlights/index.ts` | All highlight operations (list/sort/filter, CRUD, trash, export, import, Notion sync) |
| `src/server/highlights/export-format.ts` | Pure helpers: safe filenames, YAML/CSV/Markdown escaping, AI Brain Pack builder |
| `src/server/extension/index.ts` | Extension endpoints (`GET` recent, `POST` save) |
| `src/server/tags/`, `tokens/`, `cron/` | Tags, API tokens, daily-highlights email |
| `src/lib/` | `db.ts`, `auth.ts`, `cors.ts`, `rate-limit.ts`, `keyword-tags.ts`, `import-parsers.ts` (X/Reddit/CSV/JSON parsers) |
| `src/schema.ts` | Drizzle schema (source of truth for tables) |
| `src/pages/`, `src/components/`, `src/contexts/` | The SPA |
| `extension/` | The Chrome extension source (this folder is what gets zipped) |
| `drizzle/` | SQL migrations (`0001_init`, `0002_integrations`, `0003_soft_delete`) |
| `scripts/` | Checks and the local test rig (see §8), `make-reset-sql.mjs` |
| `vercel.json` | Cron, CORS header, 308 redirects from old hosts, rewrites |
| `Mind_Palace_Playbook/` | Business strategy research (not code) |

### Database schema (Postgres)

`users` (id, username, email, password_hash, theme, daily_email_enabled, notion_token, notion_database_id, notion_last_sync, timestamps) · `api_tokens` (user_id → users, token, label) · `tags` (user_id, name, color) · `highlights` (user_id, text, source_url, page_title ≤512, domain ≤255, notes, tag_ids JSON-in-varchar, metadata_tags JSON-in-varchar, created_at, updated_at, **deleted_at**). Foreign keys cascade on user delete. `tag_ids` is a JSON string, not a join table (known limitation; filters use exact LIKE patterns).

**Migrations** (run in the Neon SQL editor, in order, all idempotent): `0001_init.sql`, `0002_integrations.sql` (Notion columns), `0003_soft_delete.sql` (`highlights.deleted_at`). **Run migrations before deploying code that needs them** — code that selects a column that does not exist returns HTTP 500 on every query of that table.

## 4. Features

**Dashboard** — highlights as cards (Lexend, non-italic, one-click trash icon), wide two-column detail window (edit text, notes, tags), **sort** (Newest first — default, Oldest first, By website; remembered per browser) and **date filter** (Any time / Today / Last 7 / Last 30 days) with headings *Today / Yesterday / Earlier this week / Earlier this month / Month Year*, search (text, title, notes, domain; case-insensitive), filters by website, tag and topic, pagination (30 per page), **Trash** (restore, delete forever instantly, **Empty Trash** with one confirmation), phone layout (sidebar overlay), Escape closes windows.

**Export** (Export in the sidebar) — **AI Brain Pack** (ZIP: one Markdown note per source page in `sources/`, `sources.md` index, `highlights.jsonl`, `README.md` with NotebookLM / ChatGPT-Claude Projects / Obsidian / local-AI steps), JSON, Markdown, Obsidian (ZIP; group by topic/tag/domain/source/all), Notion CSV. Filenames are cross-platform safe; YAML and CSV are escaped; spreadsheet formulas are neutralised. Large libraries: serverless responses are limited to ~4.5 MB (≈4,500 highlights as JSON) — paginated export is a known future item.

**Import** (Import in the sidebar) — X/Twitter archive files (`like.js`, `bookmark.js`, `tweets.js`, as-is), Reddit data export CSV / JSON listings, Mind Palace JSON / JSONL / Notion CSV, generic CSV (real RFC-4180 parser; comma, semicolon or tab). Keeps tags and saved dates, skips duplicates (same URL + text), sends big files in batches of 500.

**Account** — sign-up/in (username or email), **show/hide password** on every password field, **password reset by username + email** (limited to 5 tries per account per hour), Settings: theme, daily highlights email toggle, API tokens (create/revoke), Notion connection (token validated with Notion before saving; manual "Sync All"), sign out.

**Chrome extension 1.2.0** — see §5.

## 5. The Chrome extension

* **Files:** `manifest.json`, `background.js` (service worker), `content.js` (page script: Shadow-DOM tooltip, floating Save button, shortcut, dashboard bridge), `popup.html/js` (recent highlights + settings), `icons/`. Build the upload zip with forward-slash paths (e.g. Python `zipfile`, **not** PowerShell `Compress-Archive`).
* **Manifest:** MV3, permissions **`storage`, `contextMenus`** only; host permission `<all_urls>` (content script on every page); command `save-highlight` = `Ctrl+Shift+S` (`Command+Shift+S` on Mac). Version 1.2.0 adds no permissions over 1.1.0 (it removed `tabs`/`activeTab`), so existing users get no new warning.
* **Connecting:** signing in on the dashboard hands the API token to the extension automatically through a DOM-event bridge (`HC_GET_SETTINGS` / `HC_SAVE_SETTINGS`). The bridge answers **only** trusted origins: `themindpalace.org`, `www`, the old `*.vercel.app` hosts, and `localhost`/`127.0.0.1` for unpacked developer installs. Signing out of the dashboard clears the token. Changing the theme no longer touches it.
* **Saving:** shortcut, right-click "Save to Mind Palace" (uses the menu's own `selectionText`, so it works in PDFs and iframes), or the floating button. The default server is `https://themindpalace.org`; if a saved server address now redirects, the extension remembers the new address.
* **PDFs:** Chrome keeps PDF selections inside its viewer, invisible to extensions. Workaround: select text, **copy it (Ctrl+C)**, then press the shortcut — the page script reads the clipboard (Chrome asks once to allow it) and shows what was saved. Right-click → Save works without copying. A future option is a built-in PDF.js viewer.
* **Errors users see:** "Not connected yet…", "sign-in has expired…", "Too many saves…", "Can't reach Mind Palace…" (no raw JSON).
* **Local testing:** `chrome://extensions` → Developer mode → Load unpacked → pick the unzipped folder; switch the store version off while testing.
* **Updating the store item:** Chrome Web Store developer dashboard → the item → **Package → Upload new package** → bump `version` first → Submit for review (new review each time; unchanged permissions usually clear in days). Keep the Store listing / Privacy tab URLs on `https://themindpalace.org` and `https://themindpalace.org/privacy`.

## 6. Environment variables (Vercel project `mindpalace`)

| Name | Environments | Purpose / failure mode |
|---|---|---|
| `DATABASE_URL` | Production | **Full** Neon connection string starting `postgresql://` (the code also accepts it pasted with quotes or as `psql '…'`). A bare password makes every database route fail with HTTP 500. Not set for Preview (preview deployments cannot reach the database) |
| `JWT_SECRET` | Development, Production, Preview | Signs session cookies. Changing it signs everyone out |
| `RESEND_API_KEY` | Production | Daily email; missing = cron fails, nothing else |
| `CRON_SECRET` | Production | Authenticates Vercel Cron (`Authorization: Bearer`) |
| `CORS_ORIGIN` | *(unset)* | Optional override; default `https://themindpalace.org` |
| `DASHBOARD_URL` | *(unset)* | Optional link target in the daily email; default the same domain |

**Vercel gotchas:** environment variables are captured **per deployment** — after changing one, redeploy. Variables marked Sensitive cannot be read back with the CLI. Never paste secrets into chat or commit them; `.env*` is git-ignored and `.vercelignore` keeps local secrets out of uploads.

## 7. Deploy, verify, roll back (runbook)

1. Typecheck/tests locally (§8), then `vercel deploy --prod --yes` from the repo root (uploads the working tree, builds on Vercel).
2. **Test the new deployment at its own `*.vercel.app` URL before relying on the domain:** `GET /api/auth/me` → 401; `POST /api/auth/login` with a fake user → **401 "Invalid username or password"** (a 500 means database trouble); `POST /api/extension/save` with a bad token → 401.
3. After a **rollback** Vercel stops auto-assigning the domain to new deployments: run `vercel promote <deployment-url>` to move `themindpalace.org` onto it.
4. Rollback: `vercel rollback <previous-deployment-url>`. Migrations are additive, so rolling back code is safe. Check which deployment serves the domain with `vercel inspect themindpalace.org`.
5. Old hosts must redirect (308 keeps POST) to the domain and **not** redirect `/api/cron/` (Vercel Cron does not follow redirects).

Smoke commands (read-only): `curl -s https://themindpalace.org/api/auth/me` (401), `curl -sI https://www.themindpalace.org/x` (308 → apex), `curl -s -o /dev/null -w "%{http_code}" https://themindpalace.org/api/cron/daily-highlights` (401).

## 8. Testing

Commands (repo root): `npm run build` (tsc + vite), `npm run typecheck:api`, `npm run check:router` (24 route cases + every handler loads; needs `DATABASE_URL=postgres://u:p@localhost/db JWT_SECRET=x RESEND_API_KEY=re_x`), `npx tsx scripts/check-exports.mts` (26 checks of export formatters and import parsers), `npm run lint` (0 errors; 32 warnings, mostly `any`).

**Local test rig** — `scripts/local-test/` (see its README): the real API router and the built frontend on `http://localhost:3100` against an in-memory Postgres (PGlite), no network or production access. `api-test.mjs` (54 checks, including a rehearsal of the production migration on today's schema and cross-user isolation), `e2e.mjs`, `e2e2.mjs`, `e2e3.mjs` (sorting), `pdf-e2e.mjs` (PDF shortcut) drive real Chrome with the real extension via puppeteer-core; `pdf-debug.mjs` explains PDF behaviour. Setup: `cd scripts/local-test && npm init -y && npm i @electric-sql/pglite puppeteer-core`; paths assume `M:\AI\Mind Palace`.

## 9. Security model and known gaps

Done: HttpOnly Secure cookies; bcrypt (cost 12); every query scoped by user id; no `dangerouslySetInnerHTML`; email HTML escaped; spreadsheet-formula guard in CSV; per-route and per-account rate limits (login 100/min per network + 10/min per account, register 30/min, reset 10/min per network + 5/hour per account, extension save 300/min per network + 30/min per token, import 30/min per user); bridge restricted to trusted origins; `.gitignore` + `.vercelignore` for secrets; extension permissions minimal.

Known gaps (accepted for now): password reset needs only username + email (no emailed code — needs a verified Resend domain); rate limits are in memory per function instance (use Upstash/Redis for real enforcement); no session revocation (JWT lives 30 days; logout only clears the cookie); API and Notion tokens stored in plaintext; register reveals whether a username/email exists; `npm audit` reports build-time issues via `@vercel/node`; the daily email only reaches the Resend account owner (sandbox sender).

**Incident note (Oct 2026):** a test script once contained a live database connection string and was public on GitHub from April; it was removed and the database password was rotated. If it ever recurs: rotate in Neon (Roles → reset password), update `DATABASE_URL` in Vercel with the **full** string, redeploy.

## 10. Decisions and why

* **No AI chat.** An "Ask AI" feature (Google Vertex) was built in a sibling prototype and removed on purpose: the owner doesn't want an LLM connected, and the Google project had billing disabled. Nothing is sent to any AI service; the Privacy page says so.
* **One serverless function** instead of 11 — frees function slots on the Hobby plan; handlers load statically, clients lazily.
* **Password reset by username + email** kept by owner's choice for ease of use, with strict per-account limits; upgrade path = emailed one-time codes.
* **PDF saving via clipboard** because Chrome exposes no PDF selection to extensions; adds no permissions.
* **Redirect, don't delete, the old URLs** so installed 1.1.0 extensions (default server `mindpalace-bice.vercel.app`) keep saving (POST body survives a 308). Remove the old domains only after users update.
* **Two earlier products existed** (`mindpalace`, and a sibling `mind-palace-v2` with AI chat/trash). `mindpalace` is the real one; the v2 features (trash, cards, modal) were ported into it and the sibling is to be deleted.

## 11. History

Apr 2026 v1.0 submitted for the DSAIL final (Vercel `*.vercel.app` URLs, Chrome Web Store submission). May–Jun v1.1.0 published; v1.2 added Obsidian/Notion/Twitter-Reddit import. Oct 2026 **v2.0**: custom domain `themindpalace.org`, trash, sorting, AI Brain Pack, rewritten import/export, single-function API, per-account limits, password show/hide, PDF clipboard shortcut, extension 1.2.0 (fewer permissions, secure bridge), council review (extension, web QA, export/import, security) and a full local test rig.

## 12. Open items / roadmap

1. Verify a Resend sending domain (Cloudflare DNS) → daily email for everyone and emailed reset codes.
2. Shared rate limiting (Upstash Redis), session revocation (`token_version`), hash API/Notion tokens.
3. Paginated export + streaming for very large libraries; Notion sync dedupe/batching.
4. Built-in PDF viewer (PDF.js) so Ctrl+Shift+S needs no copy step; highlight persistence on pages (`PERSISTENT_HIGHLIGHTS_PLAN.md` describes an approach).
5. Connect Vercel to GitHub for automatic deploys; remove old `*.vercel.app` domains after 1.2.0 adoption.
6. Delete the sibling project (GitHub repo, Vercel project, Neon database) once nothing needs it.
