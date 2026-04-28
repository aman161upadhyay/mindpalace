# Mind Palace — Master Project Status

**Project:** Mind Palace (Highlight Compendium)
**Version 1.0:** Complete — submitted to Chrome Web Store 2026-04-28
**Repo:** https://github.com/aman161upadhyay/mindpalace.git (branch: main)
**Live URL:** https://mindpalace-amanupadhyay.vercel.app
**Local path:** M:\AI\Knowledge_Area51

---

## What This Is

A two-part personal knowledge tool:

1. **Chrome Extension (MV3)** — sits in the browser, lets the user select any text on any webpage and save it instantly via `Ctrl+Shift+S` or right-click → Save to Mind Palace
2. **Web Dashboard (React + Vercel + Neon PostgreSQL)** — where all saved highlights live; searchable, taggable, exportable, with a daily email digest

**Target users:** Small trusted group (professor + 3 TAs). Not public yet.

---

## Tech Stack

| Layer | Technology |
|-------|-----------|
| Frontend | React 18, TypeScript, Tailwind CSS, Vite |
| Routing | Wouter |
| UI components | shadcn/ui (Radix primitives) |
| Icons | Lucide React |
| Fonts | Playfair Display, JetBrains Mono, IM Fell English |
| API | Vercel Serverless Functions (Node.js) |
| ORM | Drizzle ORM |
| Database | Neon PostgreSQL (hosted) |
| Auth | JWT in HttpOnly cookie (`hc_session`), 30-day expiry |
| Email | Resend (daily digest cron) |
| Extension | Chrome MV3 — content.js, background.js, popup.html/js |
| Hosting | Vercel (Hobby plan — 12 function limit) |
| Version control | GitHub |

---

## Database Schema

```
users            — id, username, email, passwordHash, theme, dailyEmailEnabled, createdAt, updatedAt
api_tokens       — id, userId, token, label, createdAt
tags             — id, userId, name, color, createdAt
highlights       — id, userId, text, sourceUrl, pageTitle, domain, notes, tagIds (JSON varchar), metadataTags (JSON varchar), createdAt, updatedAt
```

**Known limitation:** `tagIds` stored as JSON string in VARCHAR rather than a proper join table. Works at current scale, needs migration before any tag-count features.

---

## API Endpoints (12 functions — Vercel Hobby limit)

| File | Routes handled |
|------|---------------|
| `api/auth/register.ts` | POST /api/auth/register |
| `api/auth/login.ts` | POST /api/auth/login |
| `api/auth/logout.ts` | POST /api/auth/logout |
| `api/auth/me.ts` | GET, PATCH /api/auth/me |
| `api/auth/reset-password.ts` | POST /api/auth/reset-password |
| `api/highlights/index.ts` | GET, POST, PATCH, DELETE /api/highlights |
| `api/tags/index.ts` | GET, POST, DELETE /api/tags (DELETE via vercel.json rewrite from /api/tags/:id) |
| `api/tokens/index.ts` | GET, POST, DELETE /api/tokens (DELETE via vercel.json rewrite) |
| `api/extension/save.ts` | POST /api/extension/save |
| `api/extension/recent.ts` | GET /api/extension/recent |
| `api/cron/daily-highlights.ts` | GET /api/cron/daily-highlights (Vercel cron, 1pm UTC daily) |

**Note:** Routes are kept under 12 by using `vercel.json` rewrites to consolidate `/:id` routes into `?id=` query params on the index handlers.

---

## Pages

| Route | File | Auth required |
|-------|------|--------------|
| `/` | Home.tsx | No |
| `/login` | Login.tsx | No |
| `/register` | Register.tsx | No |
| `/forgot-password` | ForgotPassword.tsx | No |
| `/privacy` | Privacy.tsx | No |
| `/faq` | FAQ.tsx | No |
| `/contact` | Contact.tsx | No |
| `/mind-palace` | MindPalace.tsx | Yes |
| `/settings` | Settings.tsx | Yes |

---

## Chrome Extension

| File | Purpose |
|------|---------|
| `manifest.json` | MV3 manifest — permissions, CSP, commands |
| `content.js` | Injected into every page — detects selections, shows tooltip, sends to background |
| `background.js` | Service worker — handles messages, calls API, stores settings |
| `popup.html/js` | Extension popup — shows recent highlights, settings form |
| `icons/` | 16, 32, 48, 128px icons |

**Keyboard shortcut:** `Ctrl+Shift+S` (Windows/Linux) / `Cmd+Shift+S` (Mac)
**API auth:** Token stored in `chrome.storage.sync`, sent as `Authorization: Bearer` header
**Permissions:** `storage`, `activeTab`, `scripting`, `contextMenus`, `tabs`, `host_permissions: <all_urls>`

---

## Environment Variables (Vercel)

| Variable | Purpose |
|----------|---------|
| `DATABASE_URL` | Neon PostgreSQL connection string |
| `JWT_SECRET` | 64-char random string for signing JWTs |
| `RESEND_API_KEY` | Resend API key for daily email digest |
| `CRON_SECRET` | Secret header value to authenticate Vercel cron calls |
| `CORS_ORIGIN` | `https://mindpalace-amanupadhyay.vercel.app` |

---

## Everything Done (Session 1 + Session 2)

### Security

| ID | Fix |
|----|-----|
| C1 | Removed hardcoded API token from `popup.js` — now uses `chrome.storage.sync` |
| C2 | Password reset requires username + email (intentional for trusted group) |
| C3 | CORS locked from `*` to specific origin — `cors.ts` + `vercel.json` |
| C4 | `GET /api/extension/recent` moved token from query string to `Authorization: Bearer` header |
| H2 | Password minimum unified to 8 chars across registration, reset backend, and reset frontend |
| H4 | `applyCors()` added to tag DELETE handler |
| H5 | `applyCors()` added to `me.ts` and `logout.ts` |
| H6 | Dead `handleRemoveTag` removed; stale closure fixed in `onRemove` lambda |
| M1 | Tag-deletion LIKE pattern fixed — exact JSON patterns `[id]`, `[id,%`, `%,id]`, `%,id,%` |
| M5 | Password reset error message normalised — same response whether account exists or not |
| M6 | bcrypt cost factor unified to 12 across all auth flows |
| M8 | Rate limiting added to `POST /api/highlights` (60/min per IP) |
| L3 | `esc()` in popup.js confirmed safe — uses throwaway DOM node |
| L4 | No `dangerouslySetInnerHTML` confirmed across all React components |
| L5 | No `VITE_` secrets exposed in frontend bundle confirmed |
| L6 | `useAuth` import consolidated to `@/contexts/AuthContext` everywhere |
| L8 | `dailyEmailEnabled` default changed to `false` — explicit opt-in required |
| CORS-credentials | `Access-Control-Allow-Credentials: true` added to `cors.ts` and `vercel.json` |

### Bug Fixes

| Fix | Detail |
|-----|--------|
| UX-1/UX-2 | Dead `handleRemoveTag` removed; stale closure in tag removal fixed |
| UX-4 | Debounce memory leak fixed — `useRef` stores timer, cleared before each new one |
| UX-13 | Browser `confirm()` dialogs replaced with styled `ConfirmDialog` modal component |
| UX-15 | API tokens masked in Settings (`hc_2e88056a•••3171`), delete button added |
| Search placeholder | Was rendering `\u2026` as literal text — fixed to real ellipsis |
| HighlightCard crash | `new URL(sourceUrl)` wrapped in try/catch — won't crash on invalid URLs |
| Password validation | ForgotPassword.tsx now enforces 8-char min (was 6) — matches backend |
| FAQ email display | Was showing `hello@mindpalace.app` but linking to HBS email — now shows `aupadhyay@mba2027.hbs.edu` |
| FAQ/Privacy mismatch | Account deletion timeline unified to 7 days in both pages |
| Manifest description | Shortened from 183 chars to 129 (CWS limit is 132) |
| Keyboard shortcut | FAQ corrected from `Ctrl+Space+S` to `Ctrl+Shift+S` |
| `<title>` | Changed from `tmp_vite` to `Mind Palace` |
| `package.json` name | Changed from `tmp_vite` to `mindpalace` |
| Migration file | `daily_email_enabled` column added to `0001_init.sql` |
| CORS origin | Updated to `mindpalace-amanupadhyay.vercel.app` (was `mindpalace-bice.vercel.app`) |

### Chrome Web Store

| ID | Item |
|----|------|
| CWS1 | Hardcoded token removed from extension |
| CWS2 | `<all_urls>` justification text written |
| CWS3 | `host_permissions` kept intentionally (background.js needs it for fetch) |
| CWS4 | Privacy Policy page built at `/privacy` |
| CWS5 | CSP declared in manifest |
| CWS6 | Manifest description updated to store-appropriate copy |
| CWS7 | Screenshots + promo tile created and uploaded |

### UI / UX Features Added

| Feature | Detail |
|---------|--------|
| UX-5 | Theme persisted to DB — `ThemeContext.toggleTheme` calls `PATCH /api/auth/me` |
| UX-11 | Collapsible sidebar — `‹/›` toggle in header with CSS transition |
| UX-12 | Mobile hamburger menu on landing nav |
| Landing page | Split layout, capture animation section, parchment cards in horizontal grid |
| Landing page | Theme toggle (light/dark) in nav, default light |
| Landing page | Settings button in nav (visible when logged in) |
| Settings | Token masking + delete button on every token row |
| MindPalace | Auto Topics section in sidebar — shows all auto-inferred metadata tags (AI, Business, etc.) |
| MindPalace | Multi-select filtering — user tags and Topics both support selecting multiple at once |
| MindPalace | Active filter chips in header — removable one at a time |
| MindPalace | "All Highlights" button clears all active filters |
| Pages | FAQ page at `/faq` — 18 accordion questions, linked from footer |
| Pages | Privacy Policy page at `/privacy` |
| API | `action=metadata-tags` endpoint returns unique auto-topic strings |
| API | Filter endpoint accepts `tagIds` (comma-separated multi) and `metadataTag` params |

---

## What Still Needs Doing

### Immediate (user action)

- [ ] **CWS review** — Google will email within 1–3 business days. If rejected, they'll cite a specific policy violation. Most likely cause: permission justification wording. Re-submit immediately after fixing.
- [ ] **Verify `CORS_ORIGIN` env var** is set to `https://mindpalace-amanupadhyay.vercel.app` in Vercel Settings → Environment Variables. The fallback in code now matches too, but explicit env var is safer.
- [ ] **Disable Vercel Password Protection** — Settings → Deployment Protection → set to "No protection". Required for the site to be publicly accessible.

### Before onboarding more than 5 users

| Priority | Item | Effort | Notes |
|----------|------|--------|-------|
| H1 | Replace in-memory rate limiter with Upstash Redis | ~2 hrs | Current `Map`-based limiter resets on every cold start — useless on serverless. Install `@upstash/redis`, replace `Map` in `rate-limit.ts` with atomic `INCR` |
| H3 | JWT session revocation | ~2 hrs | Currently logout only clears the cookie client-side. Add `tokenVersion` integer to `users` table, include in JWT payload, increment on logout or password change |
| H7/M7 | XSS-escape user content in email templates | ~1 hr | Audit `api/cron/daily-highlights.ts` — highlight text interpolated into HTML without escaping |
| M4 | Add DB indexes | ~30 min | Index `highlights(userId, createdAt DESC)` at minimum. Already have `userId` and `domain` indexes in migration |

### Before scaling beyond current user group

| Priority | Item | Effort | Notes |
|----------|------|--------|-------|
| UX-3 | Tag rename / recolor | ~3 hrs | PATCH endpoint in `api/tags/index.ts` + inline edit UI in sidebar |
| UX-6 | Manual "Add highlight" from dashboard | ~2 hrs | Modal form → POST `/api/highlights` |
| UX-8 | User profile editing (username, email) | ~3 hrs | Extend `me.ts` PATCH + Settings UI |
| UX-10 | Onboarding flow | ~4 hrs | First-login modal: extension install link, API token, keyboard shortcut |
| UX-14 | Keyboard navigation | ~3 hrs | `/` for search, `Esc` to close modals, arrow keys through highlights |
| M2 | Migrate `tagIds` to a proper join table | ~4 hrs | Required before tag-count queries or bulk tag operations |
| L7/UX-9 | Self-serve account deletion | ~3 hrs | "Delete my account" in Settings → cascade DB delete + confirmation email |
| L9 | Custom email domain for Resend | ~1 hr | DNS records for custom sending domain; currently using `onboarding@resend.dev` sandbox |
| H7 | Upgrade password reset to email OTP | ~4 hrs | Currently only requires username + email (both non-secret). Add Resend magic link |

### Intentionally deferred (acceptable at current scale)

| ID | Item | Reason |
|----|------|--------|
| M2/M3 | `tagIds`/`metadataTags` in VARCHAR | Fine for 5 users; revisit before tag-count features |
| L2 | `data-hc-extension` DOM fingerprinting | Low risk; accepted |
| L7 | No in-app account deletion | Privacy policy covers it via email |
| L9 | Resend sandbox domain | Needs custom domain DNS setup |
| UX-7 | No email verification on registration | Trusted group only |

---

## Audit Items Summary (from external audit 2026-04-28)

Items fixed from the Antigravity audit:

| # | Item | Status |
|---|------|--------|
| 1 | `Access-Control-Allow-Credentials` missing | ✅ Fixed |
| 2 | `daily_email_enabled` missing from migration | ✅ Fixed |
| 4 | Password validation mismatch frontend/backend | ✅ Fixed |
| 8 | `<title>` was `tmp_vite` | ✅ Fixed |
| 20 | HighlightCard crashes on invalid `sourceUrl` | ✅ Fixed |
| 22 | FAQ email display mismatch | ✅ Fixed |
| 23 | Privacy/FAQ deletion timeline inconsistency | ✅ Fixed |
| 32 | `package.json` name was `tmp_vite` | ✅ Fixed |

Items still open from audit (not quick wins):

| # | Item | Why deferred |
|---|------|-------------|
| 3 | Password reset has no real identity verification | Intentional for trusted group; fix = email OTP (~4 hrs) |
| 7 | In-memory rate limiter | Needs Upstash Redis (~2 hrs) |
| 9 | Duplicate `[id].ts` handler for highlights | Low risk; `vercel.json` rewrite means only `index.ts` runs |
| 10 | Tag IDs in VARCHAR / LIKE false positives | Partially fixed; full fix = join table migration |
| 11 | Resend sandbox `from` address | Needs custom domain |
| 12 | Markdown export doesn't escape user content | Low risk for personal tool |
| 13 | CORS origin hardcoded | Fixed in code; env var also set |
| 16 | `types.ts` missing `metadataTags` field | Cosmetic; `any` used as workaround |
| 17 | ErrorBoundary has no styling | Cosmetic |
| 18 | Theme default inconsistency (light in context, dark in DB) | Acceptable flash |
| 24 | Settings.tsx initialises email toggle as `true` before data loads | Visual flash only |

---

## Version History

| Version | Date | What shipped |
|---------|------|-------------|
| v0.1 | 2026-04-15 | Initial build — full stack working locally |
| v0.9 | 2026-04-27 | Deployed to Vercel + Neon; extension tested; security audit session 1 |
| v1.0 | 2026-04-28 | CWS submitted — all critical/high security fixed, UX polish complete, audit fixes applied |

---

## Key Decisions Made

- **Password reset without email OTP** — accepted risk for small trusted group. Will need email OTP before any public launch.
- **`tagIds` as JSON VARCHAR** — pragmatic choice at current scale. Documented for future migration.
- **12 Vercel function limit** — worked around by consolidating `/:id` routes via `vercel.json` rewrites into `?id=` query params on index handlers.
- **No account deletion UI** — covered via email in Privacy Policy and FAQ. Acceptable at scale of 5.
- **`dailyEmailEnabled` default false** — changed from `true` to require explicit opt-in. GDPR best practice.
- **bcrypt cost 12 everywhere** — unified; adds ~300ms per login/register but appropriate security.
- **CORS locked to single origin** — `mindpalace-amanupadhyay.vercel.app` only. Must update `CORS_ORIGIN` env var if domain changes.
