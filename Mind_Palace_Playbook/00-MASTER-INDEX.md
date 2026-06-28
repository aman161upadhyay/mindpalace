# Mind Palace Playbook — Master Index

**Product:** Mind Palace — a Chrome extension + web dashboard that lets you highlight/save text from any webpage into a private, searchable, resurfaced knowledge library.
**Live:** https://mindpalace-amanupadhyay.vercel.app · **CWS:** https://chromewebstore.google.com/detail/mind-palace/hfjlflceaophbbeadanbpibaaidbjoao
**Goal:** ~1,000 active users in 3 months, starting free with the HBS batch, then expanding to researchers & knowledge workers.
**Prepared:** May 2026, on Opus 4.8. All market/pricing facts verified via live web research (May 2026) — *re-verify pricing before committing money; it changes.*

---

## The thesis in 60 seconds

1. **The category just got handed to you.** Pocket (35M users) shut down July 2025; Omnivore was acqui-hired and deleted in 2024. Millions of read-later/highlight users are looking for a durable home. The lesson they learned — *durability and data-ownership beat features* — is your best marketing angle.
2. **Copy Readwise's structure, not its sprawl.** Readwise is profitable (~$5M ARR, ~11 people) because of the **daily-resurfacing habit loop + integration breadth**, not features. You already have the habit loop (the daily digest). Lean into it; stay *focused* where Readwise is "feature-choked."
3. **The extension is a funnel; the web app is the business.** Like Grammarly/Honey, the money is in the account/subscription. Extensions are weekend-cloneable — your moat is **accumulated, connected, queryable data + the daily habit + integrations + brand**.
4. **Win the researcher wedge with synthesis.** Every competitor stores; almost none *synthesize*. Tools like Zotero are "storage, not synthesis." Build **AI Q&A over your own highlights + citation export** — the antidote to the "highlight graveyard" and the killer feature for academics.
5. **Monetize freemium.** Free (capped) capture + library + digest; **Pro ~$6/mo or $48/yr** unlocks AI, export, unlimited, collections; **50% academic; free for the HBS cohort.** Infra for 1,000 users ≈ **$55/mo**, so ~10 payers break even — the free launch is a **distribution** play, not a revenue play.
6. **Your bottleneck isn't money or scale — it's four silent-failure config/architecture issues:** env-var parity (the bug that broke your sign-in), the in-memory rate limiter, non-revocable JWTs, and email-from-a-sandbox-domain. Fix those and the stack scales to 1,000 (and 10,000) comfortably.

---

## How to use this playbook

- **If you're deciding strategy / pricing / go-to-market:** read 01 → 02, backed by 03 + 04 + 09.
- **If you're building / scaling the product:** read 05 → 06 → 07, then hand 08 to your AI agents.
- **If you're an AI coding agent:** start with **08** (it points you to everything else).
- **For the original project state & backlog:** [`../docs/production-readiness-status.md`](../docs/production-readiness-status.md).

---

## The documents

| # | Doc | What's inside |
|---|---|---|
| 00 | **This index** | Executive summary + navigation |
| 01 | [Business Model & Monetization](01-business-model-and-monetization.md) | Freemium architecture, $6/mo Pro, what to gate, monetary sequencing, unit economics, defensibility |
| 02 | [Go-To-Market — HBS Launch](02-go-to-market-hbs-launch.md) | Why HBS-first, the 3-month launch timeline, channels, positioning, activation/retention, metrics |
| 03 | [Research — Competitors (Readwise, Pocket, …)](03-research-competitors-readwise-pocket.md) | What worked/died/loved/hated across the read-later & highlight market; the researcher gap; pricing benchmarks |
| 04 | [Research — Chrome Extension Businesses](04-research-chrome-extension-businesses.md) | What makes money, models, defensibility, pricing, distribution, CWS/MV3 policy risk; case studies |
| 05 | [Technical Infrastructure & Scaling](05-technical-infrastructure-scaling.md) | Architecture, the env-var-parity lesson, 4 silent-failure fixes, 400 vs 1,000, DB pooling, the launch checklist |
| 06 | [The 3-Month Roadmap](06-three-month-roadmap.md) | Sprint-by-sprint build plan, website/landing features, priority stack |
| 07 | [Risks & Challenges](07-risks-and-challenges.md) | Technical, product, platform, legal, business risks — likelihood/impact/mitigation |
| 08 | [AI Agent Build Manual (Cowork/Claude Code)](08-claude-cowork-agent-manual.md) | Project map, gotchas, workflow, definition-of-done, **copy-paste task prompts** for every roadmap item |
| 09 | [Research — Infra Cost & Pricing Benchmarks](09-research-infra-cost-and-pricing-benchmarks.md) | Live-verified Vercel/Neon/Resend/Upstash pricing, cost tables (5/400/1,000), freemium conversion math |

---

## The single priority stack (if you do nothing else, do these in order)

1. **Env-var parity + startup assertions** — you can't grow on a product strangers can't sign into. ([05](05-technical-infrastructure-scaling.md))
2. **Custom email sending domain** (SPF/DKIM/DMARC) — the digest is your retention engine; it must reach the inbox. ([05](05-technical-infrastructure-scaling.md), [09](09-research-infra-cost-and-pricing-benchmarks.md))
3. **Onboarding flow** — activation predicts retention. ([06](06-three-month-roadmap.md))
4. **Upstash rate limiter + JWT revocation + email XSS escape** — safe for strangers. ([05](05-technical-infrastructure-scaling.md))
5. **Export + citations** — trust (post-Pocket) + the academic wedge. ([06](06-three-month-roadmap.md))
6. **AI "Ask your library" + semantic related** — the differentiator that beats the graveyard. ([03 §6](03-research-competitors-readwise-pocket.md), [06](06-three-month-roadmap.md))
7. **Stripe + entitlements + OTP reset** — turn it into a business. ([01](01-business-model-and-monetization.md), [06](06-three-month-roadmap.md))
8. **Move to Vercel Pro before monetizing** (Hobby is non-commercial), ship **Edge/Firefox**, run the **launch checklist** every wave. ([05](05-technical-infrastructure-scaling.md), [07](07-risks-and-challenges.md))

---

## Key numbers to remember

- **Infra @ 1,000 users:** ~$55/mo (Vercel Pro $20 + Resend Pro $20 + Neon ~$15 + Upstash ~$0).
- **Break-even:** ~10 Pro users at $6/mo.
- **Productivity-tool freemium conversion:** plan on ~2–4%.
- **Pricing anchors:** Readwise $9.99/mo (50% student), Matter $60/yr, Raindrop ~$3/mo. Mind Palace Pro **$6/mo / $48/yr**.
- **The trigger to upgrade plans:** Vercel Pro the moment you monetize; Resend Pro at ~100 daily-active users (100/day free cap).
