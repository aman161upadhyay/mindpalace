# AI Agent Build Manual — Building Mind Palace with Claude (Cowork / Claude Code)

> **Purpose.** This is the operating manual for any AI coding agent (Claude Code, Cowork, Cursor, etc.) working on Mind Palace. It gives the agent everything it needs to build features correctly the first time: the project context, conventions, the non-obvious gotchas (especially the env-var parity bug that broke sign-in), the workflow to follow, and copy-paste task prompts for the roadmap. **If you are an AI agent reading this: read §1–§5 fully before touching code.**

---

## 1. What Mind Palace is (so you don't guess)

A two-part personal-knowledge tool:
1. **Chrome extension (MV3)** — select text on any page, save it via `Ctrl+Shift+S` or right-click. Files: `extension/manifest.json`, `content.js`, `background.js`, `popup.html/js`.
2. **Web dashboard** — React 18 + TypeScript + Tailwind + Vite, where highlights live (search, tags, auto-topics, export, daily email digest).

**Backend:** Vercel Serverless Functions (Node) + Drizzle ORM + Neon PostgreSQL. **Auth:** JWT in HttpOnly cookie `hc_session` (30-day) + Bearer API tokens for the extension. **Email:** Resend (daily digest cron). **Hosting:** Vercel.

**The business model frames every decision:** the **web app is the product**, the extension is a free funnel, money comes from a **Pro subscription** gating AI/export/unlimited/collections. The **daily digest is the retention engine.** Build accordingly. (See [01](01-business-model-and-monetization.md), [03](03-research-competitors-readwise-pocket.md), [04](04-research-chrome-extension-businesses.md).)

**Authoritative current state:** [`docs/production-readiness-status.md`](../docs/production-readiness-status.md) — read it for the schema, endpoints, what's done, and what's deferred.

---

## 2. Tech stack & key files (the map)

| Concern | File(s) | Notes |
|---|---|---|
| DB schema | `src/schema.ts` | Drizzle; `users`, `api_tokens`, `tags`, `highlights` |
| DB client | `src/lib/db.ts` | Neon + Drizzle — **must use pooled connection string** |
| Auth | `src/lib/auth.ts`, `api/auth/*.ts` | JWT (`jose`), bcrypt cost 12 |
| Rate limiting | `src/lib/rate-limit.ts` | **In-memory — must migrate to Upstash** |
| CORS | `src/lib/cors.ts`, `vercel.json` | Locked to origin; handle preview envs |
| Highlights API | `api/highlights/index.ts` | GET/POST/PATCH/DELETE; `?id=` via rewrite |
| Extension save | `api/extension/save.ts` | Bearer token auth |
| Digest cron | `api/cron/daily-highlights.ts` | 1pm UTC; **escape HTML**; batch sends |
| Types | `src/types.ts` | Note: missing `metadataTags` (uses `any` workaround) |
| Constants | `src/const.ts` | |
| Auth hook | `src/_core/hooks/useAuth.ts`, `@/contexts/AuthContext` | |
| Pages | `src/pages/*` (Home, Login, Register, MindPalace, Settings, FAQ, Privacy, Contact, ForgotPassword) | Wouter routing |
| Extension | `extension/*` | MV3; `<all_urls>`; no remote code allowed |

**Constraints that are easy to violate:**
- **12-function limit on Vercel Hobby** — routes consolidated via `vercel.json` rewrites (`/:id` → `?id=`). Don't add a new top-level API file without checking the count. (On Pro this relaxes.)
- **MV3 forbids remotely-hosted code** — the extension can't load remote JS. AI/network logic calls **your API**.
- **bcrypt cost 12, JWT in `hc_session`, HttpOnly+Secure+SameSite** — keep these.

---

## 3. ⚠️ Non-obvious gotchas (the ones that already bit, or will)

1. **Environment-variable parity (THE bug).** Sign-in broke because `JWT_SECRET` was set for **Production but not Preview**. Every secret must exist in **Production AND Preview** (and local `.env`). When you add a feature needing a new secret (Stripe, Upstash, AI key), **set it in all environments** and add it to `.env.example` and the launch checklist. Add/maintain a **startup assertion** that throws if a required var is missing — fail loud.
2. **CORS on preview deployments.** `CORS_ORIGIN` is locked to prod; preview deploys have different URLs → saves fail silently. Handle preview origins ([05 §6](05-technical-infrastructure-scaling.md)).
3. **In-memory state doesn't persist on serverless.** The rate limiter `Map` resets every cold start. Never store state in module memory expecting persistence — use Neon or Upstash.
4. **Neon connections.** Use the serverless HTTP driver / pooled string; don't hold connections across requests.
5. **Email deliverability.** Sandbox sender → spam. Custom domain + SPF/DKIM/DMARC is mandatory before any real send volume.
6. **`tagIds`/`metadataTags` are JSON-in-VARCHAR.** Don't build tag-count/bulk-tag features on this — migrate to a join table first.
7. **Vercel Hobby is non-commercial.** Don't launch paid on Hobby — move to Pro.
8. **AI cost.** Gate AI behind Pro, quota per user, cache, use cheap models by default, route via Vercel AI Gateway.

---

## 4. The workflow every agent must follow

Mind Palace's repo uses a **spec → plan → build → verify** discipline (see existing `docs/superpowers/specs/` and `docs/superpowers/plans/`). Follow it:

1. **Understand before coding.** Read `docs/production-readiness-status.md` + the relevant files in §2 + the relevant playbook doc. Don't guess at conventions — match the surrounding code.
2. **Write a short spec/plan for non-trivial work.** What changes, which files, the data-model impact, the env vars needed, the test plan. Put it in `docs/superpowers/specs/` / `plans/` (dated) like the existing ones.
3. **Build incrementally & match existing patterns.** Use Drizzle for DB, `jose` for JWT, existing `cors.ts`/`auth.ts` helpers, Tailwind + shadcn/ui + Lucide for UI. Reuse, don't reinvent.
4. **Test-driven where it fits** (there's a security-and-tests spec already). At minimum, write the test plan and verify behavior — don't claim "done" without running it.
5. **Verify end-to-end before claiming done.** Run the relevant part of the [05 §8 launch checklist](05-technical-infrastructure-scaling.md). For auth/CORS/email/cron changes, test from a **fresh + incognito browser**. Evidence before assertions.
6. **Security review for anything touching auth, payments, or user data.** Use the `/security-review` skill.
7. **Commit per working feature** with clear messages. Branch off `main`; don't push/commit unless asked. End commit messages with the project's co-author trailer.
8. **Update `docs/production-readiness-status.md`** when you change what's done/deferred, so the next agent has current truth.

**Model selection (cost discipline):** Sonnet for ~80% of build tasks; Opus for hard architecture/migration/security reasoning; Haiku for routine/cheap automation. For the *product's* AI features, default to the latest efficient Claude models via the AI Gateway (Haiku for tagging/summaries, Sonnet for synthesis).

**Parallelism:** independent tasks (e.g., "add export" and "add OTP reset") can be dispatched as parallel agents/worktrees; anything sharing schema or the same files must be sequential.

---

## 5. Definition of done (every task)

- [ ] Matches existing conventions; no new top-level API file pushing past the function limit without a plan.
- [ ] Any new env var set in **Prod + Preview + `.env.example`**, covered by startup assertion.
- [ ] Server-side authz/entitlement checks (never trust the client) for gated features.
- [ ] User input escaped/validated (Zod is a dependency; use it).
- [ ] Tested end-to-end; verified in a fresh browser for auth/CORS/email/cron.
- [ ] No secrets in client bundle (no `VITE_`-exposed secrets).
- [ ] `docs/production-readiness-status.md` updated if status changed.
- [ ] Security review run if auth/payments/user-data touched.

---

## 6. Copy-paste task prompts (hand these to an agent, one at a time)

Each prompt assumes the agent has read §1–§5. Adjust paths if the repo evolved.

### 6.1 — Env-var parity + startup assertion
```
Read docs/production-readiness-status.md and Mind_Palace_Playbook/05-technical-infrastructure-scaling.md §2.
Add a shared `assertEnv()` utility that, at function/init time, throws a clear error listing any
missing required env vars: JWT_SECRET, DATABASE_URL, RESEND_API_KEY, CRON_SECRET, CORS_ORIGIN.
Call it from a shared init path used by the API handlers. Create/update .env.example with all required
vars (no values). Do NOT hardcode secrets. Then write a short note in docs on setting every var for
BOTH Production and Preview in Vercel. Verify by temporarily unsetting a var locally and confirming the loud error.
```

### 6.2 — Upstash Redis rate limiter (replaces in-memory Map)
```
Implement the spec in docs/superpowers/specs/2026-04-29-upstash-rate-limiter-design.md.
Install @upstash/redis. Replace the in-memory Map in src/lib/rate-limit.ts with an atomic
sliding-window limiter (INCR + TTL) keyed by IP (and by user where available). Keep the same
RateLimitResult interface so callers don't change. Add UPSTASH_REDIS_REST_URL and
UPSTASH_REDIS_REST_TOKEN to .env.example and assertEnv, and instruct setting them in Prod+Preview.
Apply to POST /api/highlights, POST /api/extension/save, and the auth endpoints. Test that limits
persist across (simulated) cold starts.
```

### 6.3 — JWT session revocation
```
Add a `tokenVersion` integer (default 0) to the users table (Drizzle migration). Embed it in the JWT
payload on login. On verify, reject if the token's version != the user's current version. Increment
tokenVersion on logout and on password change/reset. Update src/lib/auth.ts and api/auth/*. Test:
log in, copy cookie, log out, confirm the old cookie is rejected.
```

### 6.4 — Email digest: escape HTML + custom domain + batching
```
In api/cron/daily-highlights.ts: HTML-escape ALL user-supplied content (highlight text, notes,
page titles) before interpolating into the email HTML. Switch the `from` address to a custom domain
(env: RESEND_FROM). Batch sends to respect Resend limits and avoid timeouts. Add a post-run healthcheck
ping (env: CRON_HEALTHCHECK_URL, optional). Document the SPF/DKIM/DMARC DNS setup steps in docs.
Test the rendered email with adversarial highlight text containing <script> and HTML entities.
```

### 6.5 — Onboarding flow
```
Build a first-run onboarding flow (see roadmap UX-10). After first login, show a 3-step guided modal:
(1) install the extension (link to CWS), (2) copy your API token (link to Settings), (3) save your first
highlight + "your first daily digest arrives tomorrow." Track completion in analytics. Make it dismissible
and resumable. Match the existing parchment/shadcn aesthetic.
```

### 6.6 — Export (Markdown / Notion / Obsidian / BibTeX/RIS)
```
Add export from the dashboard: selected/all highlights to (a) Markdown file, (b) Obsidian-friendly
Markdown with frontmatter, (c) Notion via copy/CSV, (d) citation formats BibTeX and RIS using the
stored sourceUrl/pageTitle/domain/createdAt. Escape user content. Add an /api/highlights export action
or a new endpoint (mind the function-count limit; prefer an action param on the existing handler).
Gate full export behind Pro (server-side check); allow a small free export. Test round-trip into Obsidian.
```

### 6.7 — AI "Ask your library" (flagship)
```
Read Mind_Palace_Playbook/03 §6, 06 Sprint 2.2, and 09 §6. Add pgvector to Neon; compute an embedding
for each highlight at save time using a cheap model (store the vector). Build an "Ask your library"
endpoint: given a user question, retrieve top-k relevant highlights via vector search, then call a
Claude model (via Vercel AI Gateway) to answer WITH inline citations to the source highlights.
Gate behind Pro with a per-user monthly quota (store usage). Cache embeddings; never recompute unchanged
highlights. Add a chat UI in the dashboard. Add AI provider env vars to .env.example + assertEnv + Prod/Preview.
Disclose AI data handling in the privacy policy; use zero-retention provider settings.
```

### 6.8 — Stripe payments + entitlements
```
Integrate Stripe: Checkout for Pro ($6/mo, $48/yr), Customer Portal, and webhooks. Add plan,
subscriptionStatus, stripeCustomerId to users (Drizzle migration). Implement getUserPlan(userId) and
enforce it server-side for AI, export, save-cap, and collections. Add a free-tier save cap with a tasteful
upgrade prompt at the cap and at moments of value (export click, AI open). Support a 50% academic coupon
and an "HBS cohort" free-Pro grant flag. Add STRIPE_SECRET_KEY, STRIPE_WEBHOOK_SECRET, price IDs to
.env.example + assertEnv + Prod/Preview. Run /security-review. Test the full purchase + webhook + downgrade flow.
```

### 6.9 — Public-grade auth (OTP reset + verification + deletion)
```
Replace the username+email password reset with an email magic-link/OTP flow via Resend. Add email
verification on registration (verified flag; gate sensitive actions until verified). Add self-serve
account deletion in Settings (cascade-delete user data + confirmation email). Run /security-review.
Test all flows end-to-end including expired/invalid tokens.
```

### 6.10 — `tagIds` → join table migration
```
Migrate highlights.tagIds (JSON-in-VARCHAR) to a proper highlight_tags join table (Drizzle migration +
data backfill). Update all read/write/filter queries (api/highlights, api/tags) to use the join table.
Remove the fragile LIKE-pattern matching. Verify existing tag filters still work and add a test for
multi-tag filtering. This unblocks tag-count and bulk-tag features.
```

---

## 7. How to use Cowork / parallel agents effectively

- **One feature per agent/branch.** Give each agent a single §6 prompt + "read §1–§5 of this manual first."
- **Sequence schema-touching work.** 6.3 (tokenVersion), 6.8 (Stripe fields), 6.10 (join table) all alter `users`/`highlights` — do them in series or coordinate migrations to avoid conflicts.
- **Parallelize independent work.** 6.5 (onboarding UI), 6.6 (export), 6.4 (email) can run concurrently.
- **Always review agent output** against §5 Definition of Done before merging. Agents make systematic mistakes — spot-check auth/entitlement checks and env-var handling especially.
- **Keep `docs/production-readiness-status.md` as the shared source of truth** so parallel agents don't diverge.
- **Use `/security-review` and an end-to-end smoke test** as the merge gate for anything user-facing.

---

## 8. Where to look for more context (in this repo)

- [`docs/production-readiness-status.md`](../docs/production-readiness-status.md) — current state, schema, endpoints, done/deferred.
- `docs/superpowers/specs/` & `plans/` — existing dated specs/plans to mirror in style.
- `Mind_Palace_Playbook/` — this strategy suite: [00 index](00-MASTER-INDEX.md), [01 business model](01-business-model-and-monetization.md), [02 GTM](02-go-to-market-hbs-launch.md), [03 competitors](03-research-competitors-readwise-pocket.md), [04 extension businesses](04-research-chrome-extension-businesses.md), [05 infra/scaling](05-technical-infrastructure-scaling.md), [06 roadmap](06-three-month-roadmap.md), [07 risks](07-risks-and-challenges.md), [09 infra cost & benchmarks](09-research-infra-cost-and-pricing-benchmarks.md).
- `ReadWise_Introduction.md` — original competitive/stack research that seeded the project.
