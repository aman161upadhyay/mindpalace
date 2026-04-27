# Mind Palace — Developer Notes & Technical Documentation

> **Living document.** Updated automatically as new technical context, gotchas, or decisions are discovered during development. Always check here before making architectural changes.

---

## 📋 Table of Contents
1. [Project Overview](#project-overview)
2. [Tech Stack](#tech-stack)
3. [Environment Variables](#environment-variables)
4. [Local Development](#local-development)
5. [Deployment](#deployment)
6. [Known Limitations & Gotchas](#known-limitations--gotchas)
7. [Feature Notes](#feature-notes)
8. [Security Checklist](#security-checklist)
9. [Future Roadmap](#future-roadmap)

---

## Project Overview

Mind Palace is a personal knowledge management platform. Users capture text highlights from any webpage via a Chrome extension (Ctrl+Shift+S), then view, search, tag, and annotate them in a web dashboard.

- **Frontend:** React + Vite + TailwindCSS v4 + Wouter (routing) + Sonner (toasts) + Lucide (icons)
- **Backend:** Vercel Serverless Functions (TypeScript) in `api/`
- **Database:** Neon (PostgreSQL), accessed via Drizzle ORM
- **Auth:** JWT stored as an HttpOnly cookie (`hc_session`), 30-day expiry
- **Email:** Resend API
- **Deployment:** Vercel (auto-deploys from GitHub `main` branch)

---

## Tech Stack

| Layer | Technology | Notes |
|-------|-----------|-------|
| Frontend | React 19 + Vite 8 | `npm run dev` for local UI only |
| Styling | TailwindCSS v4 | Uses `@tailwindcss/vite` plugin, not PostCSS |
| Routing | Wouter | Lightweight React Router alternative |
| Toasts | Sonner | `toast.success()`, `toast.error()` |
| Icons | Lucide React | |
| ORM | Drizzle ORM | Schema in `src/schema.ts` |
| Database | Neon (serverless PostgreSQL) | Uses `@neondatabase/serverless` driver |
| Auth | Jose (JWT) + bcryptjs | |
| Email | Resend | |
| Hosting | Vercel (Hobby plan) | ~100 deployments/day limit |

---

## Environment Variables

### Required Variables

| Variable | Where | Notes |
|----------|-------|-------|
| `DATABASE_URL` | Vercel (Production only) + `.env.local` | Neon connection string |
| `JWT_SECRET` | Vercel (All environments) + `.env.local` | 64-char hex string, used to sign session JWTs |
| `RESEND_API_KEY` | Vercel (All environments) + `.env.local` | For daily highlights email cron |
| `CRON_SECRET` | Vercel (All environments) + `.env.local` | Used to authenticate Vercel Cron requests to `/api/cron/*` |

### Vercel-specific Notes
- `DATABASE_URL` is set for **Production only** on Vercel — it must be manually added to `.env.local` for local development (it won't be pulled by `vercel env pull`)
- `JWT_SECRET` should be marked **Sensitive** in Vercel dashboard; the Development value can be the same but Vercel warns it is decryptable
- `VERCEL_OIDC_TOKEN` is auto-injected by Vercel CLI into `.env.local` — it is **not needed** in the codebase and can be removed from `.env.local` safely

### `.env.local` Template
```dotenv
DATABASE_URL="postgresql://..."
JWT_SECRET="<64-char hex>"
RESEND_API_KEY="re_..."
CRON_SECRET="<random hex>"
```

---

## Local Development

### Important: `npm run dev` vs `vercel dev`

| Command | What it does | API calls |
|---------|-------------|-----------|
| `npm run dev` | Vite frontend only on `:5173` | Proxied to Vercel production via `vite.config.ts` |
| `vercel dev` | Full stack locally | Works in theory, but conflicts with Vite's catch-all rewrite in `vercel.json` causing HTML parse errors |

**Recommended workflow:** Use `npm run dev` for frontend iteration. API calls proxy to `https://mindpalace-bice.vercel.app` via the proxy in `vite.config.ts`. Push to GitHub for backend/API changes.

### Proxy Config (`vite.config.ts`)
```ts
server: {
  proxy: {
    "/api": {
      target: "https://mindpalace-bice.vercel.app",
      changeOrigin: true,
      secure: true,
    },
  },
},
```
> ⚠️ This means local frontend changes are tested against the **live production API**. Be careful with destructive operations while testing locally.

---

## Deployment

- Push to `main` branch on GitHub → Vercel auto-deploys
- **Production URL:** `https://mindpalace-bice.vercel.app`
- Vercel Hobby plan: ~100 deployments/day — do not push for every minor change; batch changes together
- The `dist/` folder (Vite build output) should NOT be committed — it is built by Vercel on deploy

### Vercel Rewrites (`vercel.json`)
```json
{ "source": "/(.*)", "destination": "/index.html" }
```
This SPA catch-all causes `vercel dev` to serve `index.html` for asset requests, breaking Vite's dev server. Known issue — use `npm run dev` instead.

---

## Known Limitations & Gotchas

### 🔴 Resend Sender Domain Restriction
- **Issue:** The `onboarding@resend.dev` sender address can **only send to the email address registered with Resend** (currently `aman.r.upadhyay@gmail.com`).
- **Impact:** The daily highlights cron email works for the registered user only. If other users sign up, their emails will be silently blocked by Resend.
- **Fix when needed:** Verify a custom domain in the [Resend dashboard](https://resend.com/domains) and update the `from` field in `api/cron/daily-highlights.ts`. Cost: Free if you own a domain.

### 🔴 CORS Too Permissive
- **Issue:** `vercel.json` sets `Access-Control-Allow-Origin: *` for all `/api/*` routes.
- **Impact:** Any website can make requests to your API. Not critical for a personal app but a real risk for a public product.
- **Fix when needed:** Change `"value": "*"` to `"value": "https://mindpalace-bice.vercel.app"` in `vercel.json`.

### 🟡 `vercel env pull` Removes `DATABASE_URL`
- **Issue:** Running `vercel env pull` overwrites `.env.local` and removes `DATABASE_URL` because it's only set for Production in Vercel (not Development environment).
- **Workaround:** After running `vercel env pull`, manually re-add `DATABASE_URL` to `.env.local`.

### 🟡 Database Schema Migrations Are Manual
- **Issue:** There is no `drizzle.config.json` file in the project, so `npx drizzle-kit push` doesn't work.
- **Workaround:** Use a Node.js script with the Neon driver's tagged-template syntax to run raw `ALTER TABLE` statements directly. Example:
  ```js
  const { neon } = require('@neondatabase/serverless');
  const sql = neon(process.env.DATABASE_URL);
  await sql`ALTER TABLE users ADD COLUMN IF NOT EXISTS my_column BOOLEAN DEFAULT true`;
  ```
- **Fix when needed:** Add a `drizzle.config.ts` pointing to `src/schema.ts` and the `DATABASE_URL`.

### 🟡 No Email Verification on Registration
- Users can sign up with any email address without proving they own it.
- **Impact:** Low risk for personal use; important to fix before public launch.

### 🟡 Password Reset Uses Username + Email (Not Email Link)
- The "Forgot Password" flow verifies identity by matching username + email in the DB, then lets the user set a new password directly — **no email link is sent**.
- **Why:** No email service was configured at the time of building the feature.
- **Implication:** Slightly less secure than a token-based reset link (anyone who knows both your username and email can reset your password).
- **Fix when needed:** Generate a time-limited reset token, store in DB, send via Resend, verify on the reset page.

### 🟡 `dailyEmailEnabled` Field Not Returned by `AuthContext`
- The `useAuth()` hook's `user` type doesn't include `dailyEmailEnabled` in its TypeScript interface.
- **Workaround:** Settings.tsx accesses it via `(user as any).dailyEmailEnabled`.
- **Fix when needed:** Update the `AuthUser` interface in `src/contexts/AuthContext.tsx`.

---

## Feature Notes

### Authentication
- Session stored as `hc_session` HttpOnly cookie; 30-day expiry
- JWT payload: `{ userId: number, username: string }`
- Helper: `getAuthUserIdFromVercelReq(req)` — use in all protected API endpoints

### Search (Highlights)
- Backend: case-insensitive `ILIKE` on `text`, `pageTitle`, `notes`, `domain`
- Frontend: 300ms debounce before API call
- Tag filtering uses exact substring match on the JSON `tag_ids` column

### Daily Highlights Cron
- Endpoint: `GET /api/cron/daily-highlights`
- Schedule: `0 13 * * *` (daily at 13:00 UTC = 9:00 AM EST)
- Secured with `Authorization: Bearer <CRON_SECRET>` header (Vercel injects this automatically for cron triggers)
- Sends 5 random highlights per user (`ORDER BY RANDOM() LIMIT 5`)
- Users can opt out via the toggle in Settings → **Daily Highlights Email**

### Forgot Password
- Route: `/forgot-password` → `src/pages/ForgotPassword.tsx`
- API: `POST /api/auth/reset-password`
- Requires both `username` AND `email` to match a DB record
- Rate-limited: 5 requests/minute per IP

### Theme
- Persisted to DB via `PATCH /api/auth/me` `{ theme: "dark" | "light" }`
- Controlled by `ThemeContext` — use `useTheme()` hook

---

## Security Checklist

| Item | Status | Notes |
|------|--------|-------|
| Passwords hashed with bcrypt | ✅ | 10 salt rounds |
| JWT sessions (HttpOnly cookie) | ✅ | `SameSite=Lax`, `Secure` in production |
| SQL injection protection | ✅ | Drizzle ORM parameterized queries |
| Rate limiting (login/register/reset) | ✅ | In-memory, per IP |
| CORS locked to own domain | ❌ | Currently `*` — fix before public launch |
| Email verification on signup | ❌ | Not implemented |
| Sensitive env vars encrypted | ⚠️ | `JWT_SECRET` rotated to Sensitive; `DATABASE_URL` only in Production |
| No secrets in Git history | ⚠️ | DB password appeared in chat logs; **rotate Neon password before public launch** |
| Custom domain for Resend | ❌ | Required for multi-user emails |

---

## Future Roadmap

### Before Chrome Web Store Launch
- [ ] Verify custom domain in Resend → update `from` address in cron
- [ ] Lock CORS to production domain in `vercel.json`
- [ ] Add email verification on registration (use Resend)
- [ ] Upgrade forgot password to email-link-based token flow
- [ ] Rotate Neon database password (was exposed in plain text)
- [ ] Add `drizzle.config.ts` for proper migration support

### Planned Features
- [ ] Persistent on-page highlighting (DOM path serialization)
- [ ] Chrome Web Store listing
- [ ] Multi-user support (with proper domain-verified emails)
- [ ] Public/shareable highlight collections

### Directional Ideas

#### Obsidian Integration
Obsidian exposes two useful API surfaces for potential Mind Palace integration:
- **Local REST API plugin** (`github.com/coddingtonbear/obsidian-local-rest-api`) — HTTP server on localhost that can create/update/search markdown notes programmatically. Could sync highlights/marginalia directly into a user's Obsidian vault as markdown files.
- **Plugin API** (TypeScript, `obsidian` npm package) — build a native Obsidian plugin that pulls from Mind Palace and surfaces highlights inside Obsidian's graph/editor.
- **URI scheme** (`obsidian://open?vault=X&file=Y`) — lightweight deep-linking, no plugin required.

**Most viable path:** a Vercel cron or on-demand endpoint that writes new highlights to a user's local Obsidian vault via the Local REST API plugin. Positions Mind Palace as the capture layer, Obsidian as the thinking layer.

---

*Last updated: 2026-04-27*
