# Mind Palace — Domain Migration: Running Context File

> Living document. Append to it every time something is learned or done. Newest log entries go at the bottom of section 9.
> Started: 2026-10-19. Author: Claude (Sonnet 5.5 session). Owner: Aman Upadhyay (aupadhyay@mba2027.hbs.edu).
> Ground rule from the user: **Claude does NOT make changes. Claude audits, then writes an implementation plan that Sonnet 5.5 can follow.**

---

## 0. Where we are

| Step | Status |
|---|---|
| Step 1 — audit local folders vs GitHub vs Vercel vs Cloudflare, report discrepancies | **DONE (this file). Waiting on user decisions in section 7.** |
| Step 2 — write the implementation plan for Sonnet 5.5 | **NOT STARTED** (blocked on the decisions in section 7) |
| Step 3 — execution (Vercel domain, code changes, git push, Cloudflare DNS) | NOT STARTED. Nothing has been modified anywhere. |

**Nothing has been changed** in Vercel, GitHub, Cloudflare, the Neon DBs, or any project file. Side effects of the audit, all harmless:
- `git fetch origin` in `M:\AI\Knowledge_Area51` (updated remote-tracking refs only).
- A scratch clone of `mindpalace_advanced` and two unzipped extension packages in the session scratchpad.
- One Chrome tab opened on Cloudflare (read-only browsing).
- This file.

---

## 1. THE HEADLINE FINDINGS (read these first)

1. **The domain you own is `themindpalace.org`, not `mindpalace.org`.** Cloudflare holds `themindpalace.org` (Active, Free plan, full DNS, 0 records). `mindpalace.org` belongs to someone else (GoDaddy nameservers, parked page). Every instruction must use `themindpalace.org` unless the user says otherwise.
2. **There are TWO separate Mind Palace products**, with separate Vercel projects, GitHub repos, Neon databases and user bases (section 2). "The Vercel domain" is ambiguous: `mindpalace-bice.vercel.app` or `mind-palace-v2.vercel.app`.
3. **The folder `M:\AI\01MindPalace` (root) is NOT a git repo and is the OLDEST of the v2 copies** (April 26 snapshot). The newest v2 code is in `M:\AI\01MindPalace\.worktrees\v2-updates` and it matches GitHub `mindpalace_advanced@main` almost exactly.
4. **The extension in the root folder is NOT the one on the Chrome Web Store.** CWS shows "Mind Palace" v1.1.0 (updated May 4, 2026, 5 users). The root folder's extension is "mind palace v2" v2.1.0. The CWS build matches the extension in `Knowledge_Area51` / the worktree / GitHub, and it **hardcodes `https://mindpalace-bice.vercel.app`** as its default server.
5. **Nothing is connected to any domain yet.** `vercel domains ls` returns 0 domains. No Vercel project has `themindpalace.org`.
6. **Production (`mindpalace` project) is running code that exists on no GitHub branch** (the v1.2 deploy of Jun 27 was CLI-only and never pushed).

---

## 2. Inventory: what exists where

### 2.1 Two products

| | **Product A: "mindpalace"** | **Product B: "mind-palace-v2"** |
|---|---|---|
| Vercel project | `mindpalace` (`prj_tpme9lgbqKTXdd1JGiauh549nkw9`) | `mind-palace-v2` (`prj_vkd0kPhicNXdmXBviMKj7AW6IpQm`) |
| Vercel team/scope | `amanupadhyay` (`team_UyArKBno0vbE5plgKpePtnNC`) | same |
| Primary URL | `https://mindpalace-bice.vercel.app` | `https://mind-palace-v2.vercel.app` |
| Other aliases | `mindpalace-amanrupadhyay-2976-amanupadhyay.vercel.app`; `mindpalace-amanupadhyay.vercel.app` also answers HTTP 200 | `mind-palace-v2-amanupadhyay.vercel.app`, `-git-main-`, `-git-v2-updates-` |
| Git-connected? | **NO** (no `-git-` aliases; deployed with `vercel deploy --prod`) | **YES** (`-git-main-` and `-git-v2-updates-` aliases exist; `main` auto-deploys) |
| GitHub repo | `aman161upadhyay/mindpalace` (public) | `aman161upadhyay/mindpalace_advanced` (public) |
| Local folder | `M:\AI\Knowledge_Area51` (real git repo, `origin` = `mindpalace`) | `M:\AI\01MindPalace` (root, no git) and `M:\AI\01MindPalace\.worktrees\v2-updates` (broken worktree) |
| Last prod update | ~Jun 28 (113 days ago; the v1.2 CLI deploy) | ~Jun 1 (140 days ago) |
| Chrome extension | "Mind Palace" 1.1.0 — **the CWS listing** | "mind palace v2" 2.1.0 — zip only, **not on CWS as far as we can see** |
| Extension default server | hardcoded `https://mindpalace-bice.vercel.app` | none; user types the URL in the popup |
| Distinct features | Daily-digest cron (Resend), v1.2 Obsidian/Notion/Twitter+Reddit import, ForgotPassword (username+email), landing page redesign, FAQ/Privacy/Contact | AI chat (Vertex AI Gemini), soft-delete/trash, Notion/Obsidian/CSV import (separate implementation), ForgotPassword (Resend token), no cron |
| Env vars (names only) | `CORS_ORIGIN` (Prod+Preview), `JWT_SECRET` (Dev; Prod+Preview), `RESEND_API_KEY` (Prod), `CRON_SECRET` (Prod), `DATABASE_URL` (**Prod only**) | `DATABASE_URL` + all Neon/PG vars (all envs), `JWT_SECRET` (all envs), `GOOGLE_SERVICE_ACCOUNT_JSON` (all envs). **No `RESEND_API_KEY`, no `CORS_ORIGIN`.** |
| Neon DB | its own (users incl. the 5 CWS users, the professor, TAs per memory notes) | its own separate Neon project (per `STATUS_AND_ROADMAP_2026-04.md`) |
| Function count | `api/` was brought to 12 then grew (see plan 2026-09-30) | exactly 12 (the Hobby limit) |

### 2.2 Local folder facts

**`M:\AI\Knowledge_Area51`** (Product A)
- Branch `main`, **ahead 3 / behind 1** of `origin/main`.
  - Ahead (never pushed): `bb74612` (v2.0 plan doc), `6c2c25f` (scaling playbook), `d7b5633` (v1.2 features).
  - Behind: `1113935` "Add files via upload" (Apr 29) = adds `mind-palace-v1.1.1.zip.zip`.
- Uncommitted: `.claude/settings.local.json`, `.gitignore`; untracked: two Apr-29 plan/spec docs, `extension/mind-palace-v1.1.1.zip.zip`.
- `.git/worktrees` does not exist (no worktrees registered).

**`M:\AI\01MindPalace`** (root; Product B, oldest snapshot)
- Not a git repo. File dates Apr 12–26, 2026 (plus `.gitignore` May 30, agent key May 31).
- API is the OLD layout: `extension/save.ts` + `extension/recent.ts` + `highlights/[id].ts` separate (12 functions), no `chat`, no `reset-password`, no `cron`, no soft-delete.
- No `ForgotPassword/FAQ/Privacy/Contact` pages, no `vertex.ts`.
- `vercel.json`: `"name": "mindpalace"` (deprecated key) + CORS `*` + only the SPA rewrite.
- `.vercel/project.json` → `mind-palace-v2`.
- Contains: `.env.local` (live secrets, values not read), `agentlanggraph-54f9a0f59d89.json` (GCP service-account key), `dist-extension/V2MindPalace-V2.1.zip` (byte-identical to root `extension/`), `docs/STATUS_AND_ROADMAP_2026-04.md`.

**`M:\AI\01MindPalace\.worktrees\v2-updates`** (Product B, newest local copy)
- `.git` file points to `M:/AI/01MindPalace/Knowledge_Area51/.git/worktrees/v2-updates` — **that path does not exist**, so this is a dead worktree. `git status` fails here.
- Versus a fresh clone of `mindpalace_advanced@main` (`bd507c7`) the ONLY differences are: empty dir `api/cron/`, plan doc `2026-05-31-mind-palace-chat-agent.md`, and `test-pem2.mjs` (a PEM debugging script).
- Has `.env.preview` / `.env.production` (secret values, not read).
- Has `CONTEXT.md` (the v2 team's own context file; read it, it is accurate for Product B). Note: it says the CWS listing `hfjlfl…` belongs to this product, which is contradicted by the listing's actual content (1.1.0).

### 2.3 GitHub (account `aman161upadhyay`)

| Repo | Visibility | Branches | Head | Notes |
|---|---|---|---|---|
| `mindpalace` | public | `main` | `1113935` (Apr 29) | 3 local commits never pushed; `v1.2` is live in prod but not here |
| `mindpalace_advanced` | public | `main`, `v2-updates` (both `bd507c7`, Jun 1) | `bd507c7` | 65 commits; wired to Vercel `mind-palace-v2`; **does not track** the GCP key JSON (verified) |
- `gh` is logged in as `aman161upadhyay` (keyring). A `git push` to `main` was blocked earlier by the auto-mode classifier; the user has to push or explicitly permit it.
- Both repos track `.claude/settings.local.json`; a pattern scan (db URLs, `gho_`, `ghp_`, `re_`, private-key header, `npg_`) found no secrets in it.

### 2.4 Cloudflare (account `Aman.r.upadhyay@gmail.com`, id `a3f9483622fe8729df184a0f3f56fd76`)

| Domain | Status | Plan | DNS records | Notes |
|---|---|---|---|---|
| `themindpalace.org` | Active | Free | **0** | NS = `gabe.ns.cloudflare.com`, `hadlee.ns.cloudflare.com`. No A/CNAME, no MX/SPF/DKIM/DMARC. Cloudflare recommends adding records for apex and `www`. Public DNS: no A record, `www` NXDOMAIN, HTTP unreachable. |
| `shreejisecurity.com` | Active | Free | (not inspected) | Unrelated project. Do not touch. |

- `mindpalace.org` (NOT owned): NS `ns27/ns28.domaincontrol.com` (GoDaddy), A `3.33.130.190, 15.197.148.33` (parking). Not in the Cloudflare account.
- Cloudflare "Recents" also shows a sidebar entry for `shreejisecurity.co…/DNS`, so the user was in that zone earlier.

### 2.5 Chrome Web Store
- Listing: `https://chromewebstore.google.com/detail/mind-palace/hfjlflceaophbbeadanbpibaaidbjoao`
- Name "Mind Palace", **version 1.1.0, last updated May 4, 2026**, 5 users, developer "Aman Upadhyay (aman.r.upadhyay)".
- The CWS dashboard cannot be opened by the browser tools (blocked earlier), so uploaded-but-unpublished versions (e.g. a draft of 2.1.0) cannot be seen.

### 2.6 Extension builds compared

| Build | Name / version | Default server | Located in |
|---|---|---|---|
| Root `extension/` and `dist-extension/V2MindPalace-V2.1.zip` (identical) | "mind palace v2" **2.1.0**, perms incl. `scripting` | none (popup input, placeholder `https://your-mind-palace-v2.vercel.app`) | `M:\AI\01MindPalace` |
| `Knowledge_Area51/extension/` | "Mind Palace" **1.1.0** (no `scripting`, has CSP) | `https://mindpalace-bice.vercel.app` in `background.js:3` and `popup.js:4` | `M:\AI\Knowledge_Area51` |
| Worktree `extension/` and GitHub `mindpalace_advanced` | "Mind Palace" **1.1.0** | same hardcoded `-bice` URL | worktree, GitHub |
| `mind-palace-v1.1.1.zip.zip` (137 KB) | contents say 1.1.0 despite the filename | `-bice` URL | KA51, worktree, GitHub `mindpalace` (commit `1113935`) |

Both builds use `host_permissions: ["<all_urls>"]`, so **the manifest does not need a new host entry for any new domain**. Both send `apiToken` in body/query rather than an `Authorization` header (v1.1.0 `recent` sends it per its own code; verify before relying on it).
Users of v1.1.0 already have `dashboardUrl` saved or default to `-bice`; the default is only used if they never saved a custom one. Changing the default in a new CWS release does not change users who already saved one in `chrome.storage.sync`.

---

## 3. DISCREPANCY REGISTER

Severity: **H** = would break the migration or users; **M** = confusing or risky; **L** = hygiene.

| # | Sev | Discrepancy | Evidence | Why it matters for the domain move |
|---|---|---|---|---|
| D1 | H | User says `mindpalace.org`; owned domain is `themindpalace.org` | Cloudflare domain list; public NS lookup | Wrong domain in every command/config would point at a stranger's parked domain |
| D2 | H | Two products, two Vercel projects, two DBs, two repos; "the Vercel domain" is ambiguous | Section 2.1 | Domain must be attached to the correct project, and each has different users and data |
| D3 | H | Root folder is the oldest snapshot, not a git repo; newest v2 code lives in the broken worktree | Section 2.2 | Editing the root folder and pushing would deploy OLD code (no chat, trash, reset, etc.) and wipe features |
| D4 | H | Root extension (2.1.0 "mind palace v2") ≠ CWS listing (1.1.0 "Mind Palace") | WebFetch of CWS page; manifests | Changing the wrong extension folder will not change what the 5 CWS users run |
| D5 | H | Production `mindpalace` runs v1.2 code present on no GitHub branch; local repo is ahead 3 / behind 1 | `git rev-list`, `gh api` | Pushing without reconciling can overwrite or conflict; production code is not recoverable from GitHub |
| D6 | M | Domain strings are inconsistent inside Product A: CORS default + `vercel.json` use `mindpalace-amanupadhyay.vercel.app`; extension default, cron fallback and `vite.config.ts` proxy use `mindpalace-bice.vercel.app`; docs say `-amanupadhyay` | Greps in KA51 and worktree | Every one of these has to be found and updated; a half-done rename causes CORS failures and wrong links in digest emails |
| D7 | M | Same features implemented twice (Notion, Obsidian, import), different migrations: KA51 `0002_integrations.sql` vs advanced `0002_soft_delete.sql` + `0003_integrations.sql` | drizzle folders | The products cannot simply be merged; schemas diverge (`deleted_at` and chat only in B; cron and v1.2 importers only in A) |
| D8 | M | `mindpalace` prod env: `DATABASE_URL` set for **Production only**; `CORS_ORIGIN` exists for Prod+Preview (value unreadable) | `vercel env ls` | Preview/Dev builds will fail DB access; the `CORS_ORIGIN` value must be changed with the domain |
| D9 | M | `mind-palace-v2` has **no `RESEND_API_KEY`** and no `CORS_ORIGIN`, but its docs say password-reset email uses Resend | `vercel env ls`; `CONTEXT.md` §3 | Reset emails likely do not send in B; independent of the domain but should be known |
| D10 | M | `CONTEXT.md` says one original deployment is used by the professor and must not be touched, without naming which one | worktree `CONTEXT.md` §2 | Adding a domain is additive, but changing `CORS_ORIGIN`/redeploying could disturb a live class. Needs the user's confirmation |
| D11 | M | `.gitignore` in the root ignores `.env.local` and `*.local` but NOT `agentlanggraph-*.json` | root `.gitignore` | A GCP service-account key sits in the project root; one `git add -A` away from leaking |
| D12 | M | Neon password reportedly leaked to a tool log on Apr 25; no evidence it was rotated | `STATUS_AND_ROADMAP_2026-04.md` finding #4 | Do before sharing a branded public domain more widely |
| D13 | L | Worktree `.git` pointer broken; `.worktrees/` is gitignored; `api/cron/` empty dir; `test-pem2.mjs` stray | Section 2.2 | Tooling confusion only |
| D14 | L | `package.json` name is `tmp_vite` in the root; `mindpalace` project has `Framework: Vite` while `mind-palace-v2` has `Other` | `vercel project inspect` | Build settings differ; keep when attaching the domain |
| D15 | L | `README`, `STATUS`, plan docs reference `*.vercel.app` URLs | greps | Documentation refresh after the move |
| D16 | L | `mindpalace-amanupadhyay.vercel.app` responds but is not in `vercel alias ls` | HTTP probe vs alias list | Likely a default project domain; harmless, just confirm before relying on it |

---

## 4. What a domain move touches (inventory of hardcoded references)

To be turned into exact edit steps in the Step 2 plan **after the target project is chosen**. Confirmed hits so far:

Product A (`M:\AI\Knowledge_Area51`): `src/lib/cors.ts` (fallback origin), `vercel.json` (`Access-Control-Allow-Origin`), `api/cron/daily-highlights.ts` (dashboard URL fallback, `mindpalace-bice`), `vite.config.ts` (dev proxy target `-bice`), `extension/background.js:3` and `extension/popup.js:4` (default dashboard URL), Vercel env `CORS_ORIGIN`, `extension/LandingPage.html` (a saved copy; ignore), docs (`production-readiness-status.md`, playbook, memory notes).

Product B (`.worktrees/v2-updates` / GitHub `mindpalace_advanced`): `vercel.json` (CORS `*`), `src/lib/cors.ts` (fallback `-amanupadhyay`), `vite.config.ts` (proxy `-bice`), `extension/popup.html` placeholder, `CONTEXT.md` URLs. Env: no `CORS_ORIGIN` exists.

Non-code: Vercel domain assignment, Cloudflare DNS (apex + `www`), Cloudflare proxy mode (must be DNS-only/grey cloud for Vercel unless configured otherwise), CWS listing URL fields and privacy-policy URL, Resend sender domain (optional), Search Console (optional).

**Rule for the plan:** ADD the new domain; do NOT remove the `*.vercel.app` URLs. Every existing extension install and the professor's bookmarks keep working only if the old URLs keep serving the same deployment. CORS must allow BOTH origins during the transition.

---

## 5. Cloudflare ↔ Vercel facts the plan will rely on (verify at execution time)

- Vercel recommended records for an apex on Hobby/Pro: `A  @  76.76.21.21` and `CNAME www → cname.vercel-dns.com`. Vercel may show project-specific values in the project's Domains tab; use those if they differ.
- Cloudflare records for Vercel must be **DNS only** (grey cloud). Orange-cloud proxying commonly breaks Vercel certificate issuance/validation.
- Domain add order: add domain in Vercel first (it shows the exact records), then create DNS in Cloudflare, then wait for "Valid Configuration".
- `www` → redirect to apex (or the reverse); pick one canonical host.
- Cloudflare currently suggests SPF/DKIM/DMARC; only relevant if the domain will send email (Resend). Optional and separate.

---

## 6. Things deliberately NOT done / constraints

- No edits to project files, no commits, no pushes, no deploys, no DNS or Vercel changes.
- `.env.local`, `.env.preview`, `.env.production` and the GCP key file were not opened (key names only were listed for `.env.local`, `.env.preview`, `.env.production`; the values were masked).
- Cloudflare: no records created, `shreejisecurity.com` not opened beyond the domain list.
- Production DB not read.

---

## 7. DECISIONS NEEDED FROM THE USER (blocking Step 2)

1. **Domain:** confirm it is `themindpalace.org` (assumed).
2. **Which product gets the domain?**
   - **A `mindpalace`** — the one behind the CWS listing and the 5 users (and likely the professor). Code is local-only/unpushed; not Git-connected.
   - **B `mind-palace-v2`** — newest code (AI chat, trash), Git-connected auto-deploy, but no CWS listing visible.
   - Or **split**: apex → one product, `v2.themindpalace.org` (or similar) → the other.
3. **Which extension is the real CWS one?** Please confirm in the CWS developer dashboard (https://chrome.google.com/webstore/devconsole) what package version is uploaded/published and whether there are TWO items (one "Mind Palace" 1.1.0 and one "mind palace v2" 2.1.0).
4. **Is the professor's deployment `mindpalace` (bice)?** If yes, CORS/env/redeploy steps there need to be careful and add-only.
5. **Code consolidation:** keep two separate products, or merge into one repo? (Recommended for the plan: NOT in this task. Do the domain first; consolidation is a separate project because of the divergent schemas, D7.)
6. **Git permissions:** OK for the executing agent to `git push` to `main` (it was blocked before)? Or will the user push?
7. **Repo to be the source of truth** after the move, and whether to initialize `M:\AI\01MindPalace` as a proper clone of that repo (recommended: archive the root folder and the dead worktree, then clone fresh).

---

## 8. Draft shape of the Step 2 plan (for Sonnet 5.5; to be written after section 7 is answered)

0. Safety: snapshots (`git bundle`, copy of both local folders), confirm DB backups (Neon branch/restore point), freeze list of "do not touch".
1. Reconcile git: for the chosen product, make the local folder a true clone; resolve ahead-3/behind-1 (`git pull --rebase` then push), or clone fresh and copy unpushed commits.
2. Vercel: add `themindpalace.org` + `www` to the chosen project; read the exact DNS values Vercel shows.
3. Cloudflare: add the A/CNAME records as DNS-only; verify propagation; wait for the certificate.
4. Env vars: set/update `CORS_ORIGIN` (allow old + new origin) for Production AND Preview; add missing parity vars.
5. Code edits (exact file/line list from section 4), build, test.
6. Deploy (git push for B; `vercel deploy --prod` or Git connection for A) and smoke-test both the new and the old URLs, login, save from the extension, export, cron link.
7. Extension: new CWS release only if the default URL should change; bump version; keep `<all_urls>`; update listing and privacy-policy URL.
8. Docs and memory updates; rotate leaked secrets (D11/D12); add the GCP key pattern to `.gitignore`.
9. Rollback section: how to remove the domain and revert the DNS if something fails.

---

## 9. Activity log (append only)

- 2026-10-19 — Session cwd switched by the user to `M:\AI\01MindPalace`. Read every directory listing (excluding `node_modules`, `dist`).
- 2026-10-19 — Compared: root vs `Knowledge_Area51`; root vs worktree; worktree vs fresh clone of `mindpalace_advanced@bd507c7`; root vs the same clone. Unzipped both extension packages and diffed against source folders.
- 2026-10-19 — Vercel CLI (read-only): whoami, projects ls, domains ls (0), alias ls, project inspect ×2, env ls ×2 (first env ls run was mis-targeted and was discarded; redone from the right folders).
- 2026-10-19 — HTTP probes: all five `*.vercel.app` URLs OK; both APIs return `{"error":"Not authenticated"}` 401 on `/api/auth/me`; `mindpalace.org` is a parked GoDaddy page.
- 2026-10-19 — Cloudflare (via the user's Chrome): account has `themindpalace.org` and `shreejisecurity.com`; `themindpalace.org` has 0 DNS records, Full DNS setup, Free plan.
- 2026-10-19 — CWS listing re-read: "Mind Palace" v1.1.0, May 4, 2026, 5 users.
- 2026-10-19 — This context file created. Awaiting the user's answers to section 7.

- 2026-10-19 — USER DECISIONS (supersede section 7 where they conflict):
  - Domain is `themindpalace.org` (the user's dictated message was garbled; Claude read it as: "themindpalace.org is right, mindpalace.org is wrong". Reconfirm if in doubt).
  - The REAL product is Product A: Vercel `mindpalace`, GitHub `mindpalace`, local folder `M:\AI\Knowledge_Area51`, CWS "Mind Palace" 1.1.0. This is what the professor used and what was submitted for the final exam (DSAIL).
  - The professor's-site "do not touch" note is obsolete: exams are graded; work may proceed.
  - Product B (Vercel `mind-palace-v2`, GitHub `mindpalace_advanced`, folder `M:\AI\01MindPalace`) is considered a mistaken duplicate and the user wants it deleted. NOTHING DELETED YET. Pending: user's exam document (to confirm the real URL) and CWS dashboard access.
  - This file was copied from `M:\AI\01MindPalace\docs\` into `M:\AI\Knowledge_Area51\docs\` because the old folder is slated for deletion. Treat THIS copy as canonical.

- 2026-10-19 (session 2) — Working folder renamed: `M:\AI\Knowledge_Area51` is now `M:\AI\Mind Palace` (same repo, HEAD bb74612, ahead 3/behind 1). Treat this as the canonical folder.
- 2026-10-19 — EXAM DOC CONFIRMS PRODUCT A. `DSAIL Exam/SP26 DSAIL Final Project...pdf` cites `https://mindpalace-amanupadhyay.vercel.app`, repo `aman161upadhyay/mindpalace`, zip `mind-palace-v1.1.1.zip.zip`. `vercel inspect` shows that exact URL is an alias of the `mindpalace` project's production deployment (created Jun 27 22:00 EDT, 1 minute after local commit d7b5633 => prod runs v1.2 code, which is NOT on GitHub). The exam text also states the known limits: Resend sandbox sender only emails the owner; password reset = username+email only.
- 2026-10-19 — Vercel facts (dashboard, logged in): `mindpalace` has NO Vercel-linked DB (its DATABASE_URL was set manually, so its Neon project was created directly in Neon, outside the Vercel marketplace). Team DBs on Vercel Storage: `neon-indigo-yacht` (Apr 26 = v2's DB) and `nexus-db` (May 30, unrelated project). Vercel Observability (Hobby) = last 12h only; account-wide 30-day Usage = 321 function invocations, 1K CDN requests, 90 cron invocations across ALL 7 projects => very low recent traffic.
- 2026-10-19 — Neon console is NOT signed in in the Claude Chrome tab group. User must sign in (Google was last-used) before DB user/highlight counts can be read. Only read-only SELECT aggregates will be run; never password_hash or api token values.

- 2026-10-19 (session 2, later) — DATABASE FINDINGS (read-only SELECTs via the user's logged-in Neon console; no writes; emails reduced to domain):
  - Neon account aman.r.upadhyay@gmail.com has TWO orgs. Org "Aman" (`org-still-smoke-04960104`): project **"Mindpalace" (Ohio, `red-cake-29141470`) = Product A's LIVE DB**, and an older project "mindpalace" (N. Virginia, `still-cell-60492818`) whose only branch is ARCHIVED (created ~Apr 16; NOT queried, because querying would un-archive it). Org "Vercel: Aman" (`org-lucky-frog-06108389`): `neon-indigo-yacht` (`flat-scene-88570872`) = Product B's DB, and `nexus-db` (unrelated).
  - **Product A DB: 6 users, 55 highlights.** aupadhyay (mba2027.hbs.edu) 20 hl / 4 tags, Apr 22-May 25, digest ON; **gigi** (gmail) **33 hl** / 1 tag, May 21-Jul 12; cwsctstest 1 hl (May 4); princebhu786@gmail.com 0 hl, 1 tag (joined May 28); professorkl 0 hl (joined May 31); mr6749 1 hl (Jun 19).
  - **Product B DB: 1 user** (aupadhyay), 18 highlights, May 31-Sep 29, 0 tags. No other real users.
  - A's `users` table has NO `notion_token`, `notion_database_id`, `notion_last_sync` columns (migration `drizzle/0002_integrations.sql` was never run), but the deployed v1.2 code does `db.select().from(users)` (login.ts:31, me.ts, register.ts, reset-password.ts, cron, highlights/index.ts:270) => Postgres error => **HTTP 500 "Internal server error" on login/register/me/reset for ALL users on all three A URLs**. Verified by `curl` (fake login: A=500, B=401). Probable start: Jun 27 22:00 deploy. gigi's last save Jul 12 is consistent with extension save (uses only api_tokens+highlights) still working while the dashboard was broken.
  - Extension endpoints save/recent return clean 401 for invalid tokens on A, bice, B (healthy). The user's reported extension "internal server error" is unexplained yet (the extension popup could not be opened via the browser tool).
  - Cosmetic changes the user mentions (Lexend highlight font, non-italic cards, landscape detail modal, trash/restore, AI chat) exist ONLY in Product B / `mindpalace_advanced` (0 hits in A's src).
  - PROPOSED FIX (needs user's explicit OK; additive, reversible): on A's Neon DB run `ALTER TABLE users ADD COLUMN IF NOT EXISTS notion_token VARCHAR(255); ... notion_database_id VARCHAR(255); ... notion_last_sync TIMESTAMP;`.
  - Nothing deleted. DO NOT delete Product B until the user decides (B has the newest UI + the owner's 18 recent highlights; A has the 5 external users + the CWS identity).

- 2026-10-19 (session 2, build phase) — USER DECISION: keep Product A as the home; port B's cosmetic changes/features into A; move A to themindpalace.org and stop hosting on the old *.vercel.app URLs; list B items to delete.
  - CODE (branch `feature/merge-v2-features`, pushed to GitHub as a branch; NOT merged to main, NOT deployed): ported via 3-way patches from B: Lexend non-italic cards + one-click delete, landscape detail modal, trash/restore/purge (soft delete, `highlights.deleted_at`), AI chat panel + `api/chat` + `src/lib/vertex.ts` (error text sanitized). Merged `api/extension/{save,recent}` into `api/extension/index.ts` (A's own validation kept, GET also accepts `?apiToken=`), deleted duplicate `api/highlights/[id].ts`; rewrites added in vercel.json. Functions: 12 -> 11. Trashed rows excluded from list/stats/exports/Notion sync/cron/extension. `npx tsc -b` and `vite build` pass. Commits 7cb9260, 615265e, 6641184.
  - DOMAIN: `vercel domains add themindpalace.org mindpalace` and `www.themindpalace.org` done (project `mindpalace`, verified). Cloudflare DNS (DNS only, not proxied): `A @ 76.76.21.21`, `CNAME www cname.vercel-dns.com`. `https://themindpalace.org` returns HTTP 200 (still the OLD, pre-fix deployment). `www` was still propagating.
  - CODE REFERENCES updated to https://themindpalace.org: cors.ts fallback, vercel.json CORS header, cron email fallback, vite proxy, extension default URL. Extension 1.2.0 zip: `dist-extension/mind-palace-v1.2.0.zip` (forward-slash paths; self-heals when the saved URL redirects). NOT uploaded to CWS.
  - BLOCKED/PENDING (needs the user's explicit OK): (1) production DB migration on Neon project `red-cake-29141470` (see SQL below); (2) merge to main + `vercel deploy --prod`; (3) GOOGLE_SERVICE_ACCOUNT_JSON env var on `mindpalace` (user must set; key file is in M:\AI\01MindPalace — copy it out before deleting that folder); (4) CORS_ORIGIN env var update; (5) turn old *.vercel.app domains into redirects to themindpalace.org (do AFTER the deploy); (6) copy B's 18 highlights (user aupadhyay) into A, then delete B.
  - MIGRATION SQL (run in this order on A's DB, additive):
      ALTER TABLE users ADD COLUMN IF NOT EXISTS notion_token VARCHAR(255), ADD COLUMN IF NOT EXISTS notion_database_id VARCHAR(255), ADD COLUMN IF NOT EXISTS notion_last_sync TIMESTAMP;
      ALTER TABLE highlights ADD COLUMN IF NOT EXISTS deleted_at TIMESTAMP;
    IMPORTANT ORDER: run the migration BEFORE deploying the new code; the new code queries deleted_at.
  - DELETE LIST for Product B (only after B's 18 highlights are copied and the GCP key is saved elsewhere): GitHub repo `aman161upadhyay/mindpalace_advanced`; Vercel project `mind-palace-v2`; Neon project `neon-indigo-yacht` (org "Vercel: Aman"); local folder `M:\AI\01MindPalace`. Keep: GitHub `mindpalace`, Vercel `mindpalace`, Neon "Mindpalace" (Ohio) in org "Aman", `M:\AI\Mind Palace`. Undecided: the archived Neon "mindpalace" (N. Virginia) in org "Aman".

- 2026-10-19 (session 2, optimization) — SINGLE-FUNCTION API. Handlers moved `api/**` -> `src/server/**`; `api/index.ts` is the ONLY function (1 of 12 slots used); `src/server/router.ts` maps path -> lazily imported handler; vercel.json rewrites `/api/:path*` -> `/api?__route=:path*`. Old URLs (/api/extension/save, /api/extension/recent, /api/tags/:id, /api/tokens/:id, /api/highlights/:id) are resolved by the router. `npm run typecheck:api` and `npm run check:router` (24 route cases + all handlers load + entry-point smoke test) pass; `npm run build` passes. Commit a519503 on branch `feature/merge-v2-features` (pushed). Preview deploy proved routing on Vercel (unknown route -> router 404; handlers load lazily); preview DB routes 500 only because `DATABASE_URL` exists for Production only (verified: db.ts throws "DATABASE_URL environment variable is not set").
  - Trade-offs accepted: all routes share one function's memory/timeout settings; Vercel per-function metrics collapse into one function (request-path logs still work); a bug in router/entry file would affect every route (mitigated: tiny file, handlers lazy + isolated by try/catch, check script).
  - DB migration was BLOCKED AGAIN by the auto-mode classifier (production DB write). The USER must paste the two ALTER statements into the Neon SQL editor for project "Mindpalace" (Ohio) themselves, or explicitly grant permission in the permission prompt.
  - Chrome Web Store dashboard needs the user to sign in (Google "verify it's you" prompt); not accessible to Claude.
