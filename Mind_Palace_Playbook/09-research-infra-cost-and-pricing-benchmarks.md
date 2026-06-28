# Research — Infrastructure Cost & Pricing Benchmarks (5 → 400 → 1,000 users)

> **Executive summary.** Running Mind Palace for **1,000 users costs roughly $50–65/month** on the current stack — trivial. The expensive line items are not compute or storage (highlights are ~1 KB each; 1,000 users storing 500 each is ~0.5 GB). The real triggers are: **(1) Vercel Hobby prohibits commercial use** — the moment you monetize you *must* move to **Pro ($20/mo)**, and **(2) Resend's free tier caps at 100 emails/day**, so the daily digest forces **Resend Pro ($20/mo)** once you have ~100+ daily-active users. Add **Neon Launch (~$5–19/mo)** and you're done. The genuinely variable cost is **AI features** (synthesis/Q&A) — usage-based LLM spend that must be gated behind the paid tier and/or rate-limited. The scaling *failures* on this stack are not about money — they're **serverless connection exhaustion, in-memory state that doesn't persist (your rate limiter), cron reliability, and email deliverability.** All verified May 2026. **Always confirm live pricing before committing — these change (Resend doubled some tiers overnight in Oct 2024).**

---

## 1. Consolidated monthly cost table

| Service | Tier needed | 5 users (now) | 400 users | 1,000 users | Notes |
|---|---|---|---|---|---|
| **Vercel** | Hobby (free) → **Pro $20** | $0 *(Hobby, non-commercial only)* | **$20** (Pro, required to monetize) | **$20** (Pro) | Pro includes $20 usage credit, 1 seat, 1 TB transfer, 10M edge requests |
| **Neon Postgres** | Free → **Launch ($5 min)** | $0 (Free: 100 CU-h, 0.5 GB) | **~$5–10** (Launch) | **~$10–19** (Launch) | $0.14/CU-h compute, $0.30/GB-mo storage (first 50 GB) |
| **Resend** | Free → **Pro $20** | $0 (Free: 3k/mo, **100/day cap**) | **$20** (Pro: 50k/mo, no daily cap) | **$20** (Pro) | Daily digest blows past the 100/day free cap at ~100 DAU |
| **Upstash Redis** | Free | $0 (256 MB, 500k cmds/mo) | $0 | **$0–2** (pay-as-you-go $0.20/100k cmds) | For distributed rate limiter + session revocation |
| **Error monitoring (Sentry)** | Free (Developer) | $0 | $0 | $0 | 5k errors/mo free; plenty |
| **Product analytics (PostHog)** | Free | $0 | $0 | $0 | 1M events/mo free |
| **Custom domain** | — | ~$1/mo ($12/yr) | ~$1 | ~$1 | e.g. mindpalace.app via Cloudflare/registrar |
| **Cloudflare (DNS/CDN)** | Free | $0 | $0 | $0 | |
| **AI features (Claude API)** | Usage-based | $0 (not built) | *variable* | *variable* | **Gate behind Pro; see §6.** Can be $0 or hundreds depending on usage |
| **TOTAL (excl. AI)** | | **~$1/mo** | **~$46–51/mo** | **~$52–63/mo** | |

This matches the project's earlier internal estimate (~$66/mo at 500–1,000 users). **Infra is not your constraint — your time and the business model are.**

Sources: [Vercel pricing](https://vercel.com/pricing) · [Vercel Pro plan](https://vercel.com/docs/plans/pro-plan) · [Neon pricing](https://neon.com/pricing) · [Resend pricing](https://resend.com/pricing) · [Upstash pricing](https://upstash.com/pricing).

---

## 2. Vercel — the commercial-use trap

- **Hobby is free but explicitly non-commercial.** "The Hobby plan is for personal, non-commercial use." **The instant Mind Palace charges money (or arguably even runs as a real business), you must be on Pro.** Don't risk a Terms-of-Service takedown of your production deployment. **Action: budget Pro ($20/mo) from the moment you onboard paying users or run a public commercial launch.**
- **Pro = $20/user/mo**, includes $20 monthly usage credit, 1 TB fast data transfer, 10M edge requests, 1M+ function invocations. At 400–1,000 users with light API traffic, you stay within included usage → effectively flat $20.
- **The "12 serverless functions" limit** (which the project worked around via `vercel.json` rewrites consolidating `/:id` into `?id=` query params) is a **Hobby** constraint; **Pro raises function limits substantially**, so on Pro you can split those consolidated handlers back out if it improves maintainability. Re-evaluate the rewrite hacks once on Pro.
- **Function timeout:** Hobby caps function duration (historically tight); Pro allows longer (default execution timeouts are now far higher platform-wide). Relevant if you add **AI synthesis** (LLM calls can take many seconds) or heavy export jobs — those need Pro-level timeouts or should be offloaded to a queue/background job.
- **Crons:** Hobby restricts cron frequency/count; Pro is needed for reliable daily (and more frequent) crons. The daily digest cron is fine on either, but Pro removes worry.

Sources: [Vercel Pro plan docs](https://vercel.com/docs/plans/pro-plan), [Vercel pricing 2026 breakdown](https://www.fencode.dev/en/blog/vercel-free-vs-pro-2026-official-limits-pricing).

---

## 3. Neon Postgres — cheap, but mind the connections

- **Free:** 100 CU-hours/project/mo (doubled from 50 in Oct 2025), 0.5 GB/project (5 GB aggregate). Fine for now and even a few hundred light users if compute autosuspends.
- **Launch:** **$5/mo minimum**, usage-based: **$0.14/CU-hour compute**, **$0.30/GB-mo storage** (first 50 GB, then $0.15). Storage 2026 prices fell dramatically (from ~$1.75 to ~$0.35/GB-mo) after the **Databricks acquisition (May 2025)**.
- **Storage math:** a highlight row is ~0.5–2 KB. **1,000 users × 500 highlights × ~1 KB ≈ 0.5 GB** → **~$0.15/mo of storage.** Storage will never be your cost driver.
- **Compute** depends on query volume and how aggressively Neon autosuspends. With the serverless driver + autosuspend, an app this size lands in the **single-digit-to-~$19/mo** range on Launch.
- **⚠️ The real risk — connection exhaustion.** Vercel serverless functions can each open a DB connection; under load you exhaust Postgres connections. **Mitigations (do these):** use the **Neon serverless driver over HTTP** (already in `package.json`: `@neondatabase/serverless`) for one-shot queries, and/or use **Neon's pooled connection string (PgBouncer)** for any persistent-connection paths. Verify the app uses the pooled endpoint. This is the #1 way this stack falls over at scale, and it's a config fix, not a cost.
- **Cold starts:** autosuspend means the first query after idle is slow. Acceptable for this app; if the digest cron or first-request latency matters, consider keeping a minimum compute or accept the cold start.

Sources: [Neon pricing](https://neon.com/pricing), [Neon plans](https://neon.com/docs/introduction/plans), [Neon pricing 2026 breakdown](https://vela.simplyblock.io/articles/neon-serverless-postgres-pricing-2026/).

---

## 4. Resend — the daily digest forces Pro early

- **Free:** 3,000 emails/mo **but capped at 100/day**. The daily digest sends **1 email per opted-in daily-active user per day** → you blow past 100/day at ~**100 DAU**, well before 400 users.
- **Pro: $20/mo = 50,000 emails/mo, no daily cap, 10 domains.** Covers **1,000 daily emails (30,000/mo)** comfortably; headroom to ~1,600 daily users.
- **Scale:** $90 (100k) → $1,150 (2.5M). Not needed until well beyond 1,000 users. *(Note Resend doubled several Scale-tier prices in Oct 2024 — re-verify before relying on a tier.)*
- **⚠️ Deliverability — fix the sandbox domain NOW.** The app currently sends from Resend's **sandbox/`onboarding@resend.dev`** address. At any real volume this lands in spam and erodes the digest (your retention engine). **Action: set up a custom sending domain with SPF, DKIM, and DMARC DNS records** (e.g., `digest@mindpalace.app`). This is the single highest-leverage infra task for retention. Warm up gradually; monitor bounce/complaint rates.

Sources: [Resend pricing](https://resend.com/pricing), [Resend pricing 2026](https://nuntly.com/resend-pricing), [email pricing at scale comparison](https://blog.vibecoder.me/email-service-pricing-resend-sendgrid-postmark).

---

## 5. Upstash Redis — fixes two real bugs cheaply

- **Free:** 256 MB, **500k commands/mo**, no card required. **Pay-as-you-go: $0.20/100k commands**, 200 GB bandwidth free.
- **Why you need it (it's not optional at scale):**
  1. **Distributed rate limiter.** The current `rate-limit.ts` is an **in-memory `Map` that resets on every serverless cold start** — meaning it provides *almost no real protection* on Vercel (each function instance has its own map, and they recycle constantly). Replace with Upstash atomic `INCR`/sliding-window. This is already specced in `docs/superpowers/specs/2026-04-29-upstash-rate-limiter-design.md`.
  2. **JWT session revocation.** Store a `tokenVersion` or a denylist so logout/password-change actually invalidates sessions (currently logout only clears the cookie client-side).
- **Volume:** even at 1,000 users, rate-limit + session checks are well under 500k commands/mo → likely **$0**, occasionally a dollar or two.

Source: [Upstash pricing](https://upstash.com/pricing).

---

## 6. AI features — the one genuinely variable cost

The flagship differentiator (AI synthesis / Q&A over a user's highlights — see [03](03-research-competitors-readwise-pocket.md) and [06-three-month-roadmap.md](06-three-month-roadmap.md)) introduces **usage-based LLM cost**, the only line item that can balloon.

- **Default to the latest efficient Claude models** (Haiku for cheap summarization/tagging; Sonnet for synthesis/Q&A; reserve Opus for rare heavy reasoning). Route through the **Vercel AI Gateway** for provider flexibility, observability, and cost tracking.
- **Control cost:** gate AI behind **Pro only**; impose per-user monthly AI quotas; cache embeddings and summaries (don't re-summarize unchanged highlights); use **prompt caching** for repeated context; precompute auto-tags/summaries at save time (cheap model) rather than on every read.
- **Embeddings for "related highlights"/semantic search:** compute once per highlight, store the vector (pgvector in Neon, or a small vector store), and reuse. Embeddings are cheap; storage in Neon via `pgvector` keeps it in your existing DB.
- **Budgeting rule:** make AI Pro-only and quota'd so that AI cost is *always* a fraction of the Pro subscription revenue that unlocked it. Never offer unlimited AI on a free tier.

---

## 7. Freemium economics — how many payers you need

- **Free→paid conversion for prosumer/productivity tools: plan on ~2–4%** (median freemium 2–5%; productivity skews low; top performers 5–10%). ([First Page Sage 2026](https://firstpagesage.com/seo-blog/saas-freemium-conversion-rates/))
- **Break-even math (infra ~$60/mo, Pro at $6/mo):** you need only **~10 paying users to cover infra.** At a 3% conversion, that's ~330 free users. **Your 1,000-user HBS base, at 3% conversion to a $6/mo Pro, ≈ 30 payers ≈ ~$180/mo ≈ ~$2,160/yr** — already comfortably profitable on infra, though not yet a salary. The point of the free launch is **distribution, word-of-mouth, testimonials, and the funnel**, not immediate revenue. (Mirror Readwise's logic: a small paid base on top of a large engaged free base is a real, durable business.)
- **Free-tier design tradeoff:** too generous → no reason to pay; too stingy → kills the funnel and word-of-mouth. Gate on **AI + unlimited saves + export + advanced collections**, keep **capture + basic searchable library + daily digest** free. (See [01-business-model-and-monetization.md](01-business-model-and-monetization.md).)

---

## 8. Scaling gotchas specific to this stack (the non-cost risks)

| Risk | Symptom | Mitigation |
|---|---|---|
| **DB connection exhaustion** | Random 500s under load, "too many connections" | Use Neon serverless HTTP driver + pooled (PgBouncer) connection string; never hold connections across requests |
| **In-memory state doesn't persist** | Rate limiter ineffective; any in-memory cache lost | Move to Upstash Redis (atomic ops) — already specced |
| **Cron reliability** | Digest silently doesn't send | On Vercel Pro for reliable crons; add logging + a dead-man's-switch alert (e.g., ping a healthcheck after each successful run) |
| **Email deliverability** | Digest lands in spam → retention collapses | Custom domain + SPF/DKIM/DMARC; monitor bounce/complaint rates; warm up |
| **Vercel Hobby commercial-use ToS** | Production deployment could be flagged/removed | Move to Pro before monetizing/public launch |
| **AI cost runaway** | LLM bill spikes | Pro-only, per-user quotas, caching, cheap models for routine tasks |
| **Cold starts** | First request/query slow | Acceptable here; keep functions warm only if UX demands |
| **`tagIds` in VARCHAR** | Can't do tag-count/bulk-tag queries; LIKE false-positives | Migrate to a proper join table before tag-analytics features (already flagged) |

---

### Sources
- [Vercel pricing](https://vercel.com/pricing) · [Vercel Pro plan](https://vercel.com/docs/plans/pro-plan) · [Vercel free vs Pro 2026](https://www.fencode.dev/en/blog/vercel-free-vs-pro-2026-official-limits-pricing)
- [Neon pricing](https://neon.com/pricing) · [Neon plans](https://neon.com/docs/introduction/plans) · [Neon pricing 2026 breakdown](https://vela.simplyblock.io/articles/neon-serverless-postgres-pricing-2026/)
- [Resend pricing](https://resend.com/pricing) · [Resend pricing 2026](https://nuntly.com/resend-pricing)
- [Upstash pricing](https://upstash.com/pricing)
- [First Page Sage — SaaS freemium conversion rates 2026](https://firstpagesage.com/seo-blog/saas-freemium-conversion-rates/)
- Internal: `docs/production-readiness-status.md`, `docs/superpowers/specs/2026-04-29-upstash-rate-limiter-design.md`, `ReadWise_Introduction.md`.
