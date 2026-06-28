# Technical Infrastructure & Scaling — 5 → 400 → 1,000 Users

> **Read this first.** Your bottleneck to 1,000 users is **not** compute, storage, or money (~$55/mo at 1,000 users — see [09](09-research-infra-cost-and-pricing-benchmarks.md)). It's **four config/architecture issues that fail silently on serverless**: (1) **env vars not set across all environments** (this is exactly why you couldn't sign in — `JWT_SECRET` was Production-only, missing on Preview), (2) the **in-memory rate limiter** that doesn't persist on serverless, (3) **JWT sessions that can't be revoked**, and (4) **email sent from a sandbox domain** that will land in spam and kill your retention engine. Fix those and the current stack scales to 1,000 users comfortably. This doc is the architecture + the exact checklist.

---

## 1. Current architecture (as built)

```
┌─────────────────┐     Ctrl+Shift+S / right-click      ┌──────────────────────┐
│ Chrome Extension │ ──── POST /api/extension/save ────► │  Vercel Serverless    │
│ (MV3)            │      Authorization: Bearer <token>  │  Functions (Node)     │
│ content/bg/popup │                                     │  + Drizzle ORM        │
└─────────────────┘                                      └──────────┬───────────┘
                                                                     │
┌─────────────────┐     JWT cookie (hc_session)                      ▼
│ Web Dashboard    │ ──── /api/auth, /api/highlights ───►   ┌──────────────────┐
│ React/Vite/Tailwind                                       │ Neon PostgreSQL  │
│ (Vercel static)  │ ◄─────────── JSON ──────────────────   │ (serverless)     │
└─────────────────┘                                         └──────────────────┘
        ▲                                                            ▲
        │                          Vercel Cron (daily 1pm UTC)       │
        │                          /api/cron/daily-highlights ───────┘
        │                                   │
        └──── daily digest email ◄──── Resend ◄── (renders highlights → HTML)
```

**Stack:** React 18 + TS + Tailwind + Vite (frontend) · Vercel Serverless Functions (API) · Drizzle ORM · Neon Postgres · JWT in HttpOnly cookie (`hc_session`, 30-day) · Resend (email) · Chrome MV3 extension. **12-function limit** on Hobby worked around via `vercel.json` rewrites (`/:id` → `?id=`).

**DB schema:** `users`, `api_tokens`, `tags`, `highlights` (with `tagIds`/`metadataTags` stored as JSON-in-VARCHAR — a known scaling debt).

---

## 2. The single most important operational lesson: environment parity

**What happened:** sign-in failed in production because `JWT_SECRET` was set for the **Production** environment but **not for Preview** (and/or not consistently). JWT signing/verification silently failed where the secret was absent. **This is a class of bug, not a one-off.**

**The rule:** every secret must exist in **every environment that runs the code** — Production, **Preview**, and (via `.env`) Development. On Vercel, env vars are scoped per-environment; a var set only for Production is `undefined` on Preview deployments (which is what every PR/branch deploy uses).

**Required env vars (all must be set for Production AND Preview):**

| Variable | Purpose | Must match across env? |
|---|---|---|
| `DATABASE_URL` | Neon connection (use the **pooled** string) | Per-env DB ok; use a branch DB for Preview |
| `JWT_SECRET` | Signs/verifies JWTs | **Yes — same value, all envs** (or sessions break across envs) |
| `RESEND_API_KEY` | Email | Yes |
| `CRON_SECRET` | Authenticates cron calls | Yes |
| `CORS_ORIGIN` | Locks API CORS to the site origin | Per-env (Preview has different URLs!) — see §6 |

**Make it impossible to repeat:**
- Add a **startup assertion** that throws a clear error if any required env var is missing (fail loud at boot, not silently at request time). E.g., a `assertEnv(['JWT_SECRET','DATABASE_URL',...])` called from each handler or a shared init.
- Use **`vercel env pull`** to sync to local `.env` and keep a committed **`.env.example`** listing every required var.
- Document the full set in the launch checklist (§8) and run it before every onboarding wave.

---

## 3. The four "fails silently on serverless" fixes (do before >5 users)

These are already flagged in `docs/production-readiness-status.md` and specced in `docs/superpowers/specs/`. They are the real prerequisites to scaling.

| # | Issue | Why it bites at scale | Fix | Effort |
|---|---|---|---|---|
| 1 | **In-memory rate limiter** (`src/lib/rate-limit.ts` uses a `Map`) | Each serverless instance has its own map and recycles on cold start → effectively no rate limiting → open to abuse/cost | Replace with **Upstash Redis** atomic sliding-window (`INCR` + TTL). Spec exists: `2026-04-29-upstash-rate-limiter-design.md` | ~2h |
| 2 | **No JWT revocation** | Logout only clears the cookie client-side; a stolen/old token stays valid 30 days | Add `tokenVersion` int to `users`, embed in JWT, bump on logout/password-change; verify match | ~2h |
| 3 | **Email template XSS** | Highlight text interpolated into digest HTML unescaped → stored-XSS via saved content | HTML-escape all user content in `api/cron/daily-highlights.ts` | ~1h |
| 4 | **Resend sandbox domain** | `onboarding@resend.dev` → spam folder → digest (your retention engine) fails | Custom domain + **SPF/DKIM/DMARC** DNS | ~1h + DNS propagation |
| 5 | **Missing DB indexes** | Slow queries as `highlights` grows | Index `highlights(userId, createdAt DESC)` at minimum | ~30m |

---

## 4. What changes at 400 vs 1,000 users

The honest answer: **architecturally, almost nothing changes between 400 and 1,000** — both are small for this stack. The step changes are about **plan tiers** and **two scaling mechanics**, not re-architecture.

| Dimension | ~5 users (now) | ~400 users | ~1,000 users | Action |
|---|---|---|---|---|
| **Vercel plan** | Hobby ($0, non-commercial) | **Pro ($20)** — required to monetize | Pro ($20) | Upgrade before public/commercial launch |
| **Neon** | Free | Launch ~$5–10 | Launch ~$10–19 | Switch to Launch; use pooled connections |
| **Resend** | Free (100/day cap) | **Pro ($20)** | Pro ($20) | Daily digest exceeds 100/day at ~100 DAU |
| **Rate limiter** | in-memory "ok" | **must be Redis** | Redis | Upstash (fix #1) |
| **DB connections** | fine | watch pooling | **pooling required** | Neon serverless HTTP driver + PgBouncer string |
| **Digest send** | trivial | batch sends | **batch + monitor** | Send in batches, add success healthcheck/alert |
| **Monitoring** | none | add Sentry+PostHog | required | Free tiers suffice |
| **Monthly cost** | ~$1 | ~$46–51 | ~$52–63 (+AI) | See [09](09-research-infra-cost-and-pricing-benchmarks.md) |

### The two mechanics that actually matter at 400–1,000:

**(a) Database connection management (the classic serverless killer).**
Vercel functions can each open a Postgres connection; concurrent requests can exhaust Neon's connection limit → intermittent 500s. **Mitigations:**
- Use the **Neon serverless driver over HTTP** (`@neondatabase/serverless`, already a dependency) for one-shot queries — no persistent connection.
- For any pooled access, use **Neon's pooled (PgBouncer) connection string**, not the direct one.
- Never hold a connection across requests; open/close within the handler.
- *Verify which connection string `src/lib/db.ts` uses — switch to pooled if not.*

**(b) Digest fan-out & reliability.**
At 1,000 opted-in users the cron sends ~1,000 emails in one run. **Mitigations:**
- **Batch** sends (Resend supports batch endpoints / chunk into N-at-a-time) to respect rate limits and avoid timeouts.
- Keep the cron function within Pro's timeout, or offload to a **queue/background job** if it grows (Vercel Queues / a job runner) — relevant once the digest does per-user AI summarization.
- Add a **dead-man's-switch**: ping a healthcheck (e.g., a free uptime monitor) after each successful run; alert if it's missed. A silently-broken digest = silent churn.

---

## 5. Architecture decisions to make as you scale

- **Stay on the current stack.** It's the right one (well-supported, AI-tool-friendly, cheap). Don't rewrite. Vercel + Neon + Resend comfortably handle 1,000 — and 10,000 — users.
- **`tagIds`/`metadataTags` VARCHAR → join table.** Fine now; migrate **before** any tag-count/analytics/bulk-tag features. The current LIKE-pattern matching is fragile (false positives already partially patched).
- **Add `pgvector` in Neon** when you build semantic "related highlights"/AI search — keeps vectors in your existing DB, no new service.
- **AI calls go through your API** (MV3 forbids remote code in the extension) and ideally the **Vercel AI Gateway** for cost tracking/failover. Precompute embeddings/summaries at save time with a cheap model; cache aggressively. (See [09 §6](09-research-infra-cost-and-pricing-benchmarks.md).)
- **Background work** (AI summarization, large exports, Kindle import) should move off the request path to a queue/cron as it grows — don't block API responses on slow LLM calls.
- **Split the consolidated `?id=` handlers back out** once on Vercel Pro (higher function limit) if it aids maintainability — the `vercel.json` rewrites were a Hobby workaround.

---

## 6. CORS across environments (a sibling of the JWT_SECRET bug)

`CORS_ORIGIN` is locked to the production origin. But **Preview deployments have different URLs** (`*-git-branch-*.vercel.app`), so the extension/dashboard on a preview will be **blocked by CORS** unless handled. Options:
- Set `CORS_ORIGIN` appropriately per-environment, **or**
- Allow a small allowlist (prod domain + a pattern for your preview deployments) in `cors.ts`, **or**
- Use the custom domain (`mindpalace.app`) as the stable origin and test against production-like deploys.
Whatever you choose, **test the extension against a fresh deploy** — CORS failures are silent to the user (just "save failed").

---

## 7. Security posture as you go public (summary; see [07](07-risks-and-challenges.md))

Going from a trusted group of 5 to 1,000 strangers raises the bar:
- **Email OTP / magic-link password reset** (current reset only needs username+email, both non-secret — acceptable for a trusted group, **not** for the public). ~4h.
- **Email verification on registration** (prevents junk/abuse accounts).
- **Self-serve account deletion** (GDPR/CCPA; currently email-only).
- **Rate limiting that actually works** (Upstash) on auth + save endpoints.
- **Custom domain for email** (deliverability + anti-spoofing).
- **Bot protection** on signup (Vercel BotID or a captcha) if abuse appears.
- Keep **bcrypt cost 12**, **HttpOnly+Secure+SameSite cookies**, **CSP** (already in place).

---

## 8. The pre-launch checklist (run before every onboarding wave)

> This checklist exists because the sign-in failure was a config gap, not a code bug. Treat each wave as a mini-launch.

**Environment & deployment**
- [ ] All env vars set for **Production AND Preview**: `DATABASE_URL` (pooled), `JWT_SECRET` (same value across envs), `RESEND_API_KEY`, `CRON_SECRET`, `CORS_ORIGIN`.
- [ ] Startup env assertion in place (fails loud if any var missing).
- [ ] Vercel **Deployment Protection / password protection = OFF** for the public site.
- [ ] On **Vercel Pro** (required for commercial use) before charging/public launch.
- [ ] Custom domain (`mindpalace.app`) live + SSL; `CORS_ORIGIN` matches it.

**Email**
- [ ] Resend **custom sending domain** verified (SPF, DKIM, DMARC).
- [ ] Test digest renders + lands in inbox (not spam) for Gmail + Outlook.
- [ ] Cron healthcheck/alert wired.

**Data & security**
- [ ] Upstash rate limiter live on auth + save endpoints.
- [ ] JWT revocation (`tokenVersion`) working — logout invalidates token.
- [ ] Email-template user content escaped.
- [ ] DB indexes added; using Neon **pooled** connection string.
- [ ] (Public) Email OTP reset + email verification + self-serve deletion shipped.

**End-to-end smoke test (from a fresh browser AND incognito)**
- [ ] Register → verify → log in → log out → log back in.
- [ ] Install extension → sign in/token → select text → save → appears in dashboard.
- [ ] Search, tag, filter, export.
- [ ] Trigger/await daily digest → arrives, looks good, links work.
- [ ] Test on Chrome + Edge (+ Firefox if ported).

---

## 9. Quick reference — what each file/service does (for AI agents)

| Area | Where | Notes |
|---|---|---|
| Rate limiting | `src/lib/rate-limit.ts` | **Replace with Upstash** |
| Auth | `src/lib/auth.ts`, `api/auth/*` | JWT in `hc_session` cookie; add `tokenVersion` |
| DB | `src/lib/db.ts`, `src/schema.ts` | Neon + Drizzle; verify pooled connection |
| CORS | `src/lib/cors.ts`, `vercel.json` | Handle preview-env origins |
| Extension save | `api/extension/save.ts` | Bearer token; rate-limit this |
| Digest | `api/cron/daily-highlights.ts` | Escape HTML; batch sends; custom domain |
| Highlights API | `api/highlights/index.ts` | `?id=` consolidation via rewrites |
| Extension | `extension/` (manifest, content, background, popup) | MV3; `<all_urls>` justified; no remote code |

Full current status, done-items, and deferred items live in [`docs/production-readiness-status.md`](../docs/production-readiness-status.md).
