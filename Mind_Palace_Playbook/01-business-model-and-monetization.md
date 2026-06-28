# Business Model & Monetization Strategy

> **TL;DR.** Run **freemium subscription** where the **web app is the product and the extension is the free capture funnel**. Free tier: frictionless capture + searchable library + daily digest, **capped**. **Pro at $6/mo or $48/yr** unlocks AI synthesis, unlimited saves, export, and advanced collections. **50% academic discount; free for the HBS launch cohort.** Infra for 1,000 users is **~$55/mo**, so you reach profitability on infra with **~10 paying users** — the free launch is a *distribution and word-of-mouth* play, not a revenue play. The defensible business is the **accumulated, connected, queryable knowledge base + the daily-resurfacing habit**, not the highlight button (which anyone can clone). Evidence: [03 competitors](03-research-competitors-readwise-pocket.md), [04 extension businesses](04-research-chrome-extension-businesses.md), [09 infra & benchmarks](09-research-infra-cost-and-pricing-benchmarks.md).

---

## 1. What kind of product makes money here

From the research (full detail in [04](04-research-chrome-extension-businesses.md)):

- **Freemium subscription is the dominant winning model** for prosumer browser tools. Premium tiers cluster at **$4.99–$20/mo**; freemium gets **~5–7× more installs** than paid-only; margins are **70–85%**.
- **The extension is never the business** — it's the funnel. Grammarly ($13B), Readwise ($5M ARR, profitable), and Bardeen/Save-to-Notion all win because the **backend/account/subscription** is the value. Mind Palace already has this exact architecture.
- **The moat is the data + habit**, not the code. (Extensions are weekend-cloneable.)

**Conclusion:** Mind Palace should be a freemium SaaS. The extension is free forever. The money is in the Pro account on the web app.

---

## 2. The recommended pricing architecture

| Tier | Price | Who | What they get |
|---|---|---|---|
| **Free** | $0 | Everyone (the funnel) | Extension capture (all sites), web dashboard, search, tags, **auto-topics**, **daily email digest**, manual highlights. **Capped:** e.g. up to ~200 active highlights *or* unlimited saves but **no AI / no export**. |
| **Pro** | **$6/mo or $48/yr** (2 mo free annual) | Power users, researchers, knowledge workers | Everything in Free, **unlimited highlights**, **AI synthesis & Q&A over your library**, **export (Markdown/Notion/Obsidian/BibTeX/RIS)**, **Collections/projects**, **"related highlights"/semantic search**, priority digest customization. |
| **Academic / Student** | **$3/mo or $24/yr (50% off)** | Verified .edu | Same as Pro. Standard in the category (Readwise does 50%). |
| **HBS Launch Cohort** | **Free Pro (e.g., 1 year)** | Your ~1,000-person batch | Full Pro, gratis — the marketing engine. See [02](02-go-to-market-hbs-launch.md). |
| **Teams / Labs** *(Phase 3)* | ~$5/seat/mo | Research labs, reading groups, departments | Shared collections, seat management, later. |

**Why $6/mo:** undercuts Readwise's $9.99 (positioning as the cleaner, cheaper, research-focused alternative), sits above Raindrop's ~$3 (you do more), and is a frictionless price for the academic/professional wallet. **Annual billing is the default ask** (better cash flow + churn).

**What to gate (the decision that makes or breaks freemium):**
- **Keep free:** capture, basic searchable library, daily digest, auto-topics, manual add. (These create the habit and the word-of-mouth. *Never* cripple capture — it's the funnel.)
- **Gate behind Pro:** **AI features** (the genuinely costly + genuinely valuable layer), **export**, **unlimited saves above the cap**, **Collections**, **semantic "related" search**. These are exactly the power-user/researcher needs and they scale with willingness to pay.

---

## 3. The monetary policy / sequencing

You asked specifically whether giving it free to HBS first is the right monetary policy. **Yes — with structure.** The logic:

1. **Phase 0 — Free everything to the HBS cohort (now → ~month 3).** Goal: usage, feedback, testimonials, word-of-mouth, and a base of real engaged users. No paywall yet. This is customer development + distribution, not charity. *(Infra cost to serve 1,000 free users ≈ $55/mo — a rounding error and the best marketing budget you'll ever spend.)*
2. **Phase 1 — Introduce Pro while grandfathering the cohort.** Once AI/export/collections exist and the digest is solid, turn on Pro for *new* users beyond the cohort. Give the original HBS cohort free Pro for a year (or for life as founders) — they become evangelists, not churned free-riders.
3. **Phase 2 — Expand beyond HBS** (other grad programs, researchers, knowledge workers) on the standard freemium + 50% academic pricing. Word-of-mouth from a credible Harvard base does the cold-start work.
4. **Phase 3 — Teams/labs** and possibly social/shared collections (a network-effect moat).

**Why not charge HBS from day one?** A ~2–4% conversion on 1,000 users is ~$180/mo — not worth jeopardizing the word-of-mouth flywheel and the "everyone in my batch uses it" social proof. The strategic asset is **distribution and credibility**, which a free launch buys far more efficiently than $2k/yr of early revenue. (This mirrors how freemium tools — and Readwise's large engaged base under a small paid base — actually compound.)

---

## 4. Unit economics & break-even

(Full math in [09 §1, §7](09-research-infra-cost-and-pricing-benchmarks.md).)

- **Infra @ 1,000 users ≈ $55/mo** (Vercel Pro $20 + Resend Pro $20 + Neon ~$15 + Upstash ~$0 + domain ~$1), excluding AI (which is Pro-only and quota'd to stay a fraction of Pro revenue).
- **Break-even ≈ 10 Pro users** at $6/mo.
- **At 3% conversion of 1,000 → ~30 payers ≈ ~$180/mo ≈ ~$2,160/yr** — profitable on infra, funds AI usage, not yet a salary. The growth comes from expanding the *top* of the funnel beyond HBS (Phase 2+).
- **Sensitivity:** the business becomes meaningful at **scale of the free funnel**, not at a higher price. 10,000 engaged free users at 3% = ~$21k/yr; 50,000 = ~$108k/yr — all on ~$215/mo infra. This is why distribution (not pricing) is the lever.

---

## 5. Defensibility / moat (so you don't get cloned to death)

Extensions are trivially cloneable; protect the *business*, not the code. In priority order (detail in [04 §3](04-research-chrome-extension-businesses.md)):

1. **Accumulated, connected user data** — the switching cost grows with use.
2. **Daily resurfacing habit** — recurring reason to return; can't be cloned without the data + habit.
3. **Integrations** (Kindle import, Notion/Obsidian/BibTeX export) — each is work for a cloner and deepens the user's pipeline.
4. **Cross-device sync via account** — turns a tool into infrastructure.
5. **Brand & niche distribution** — "the tool Harvard researchers use."
6. **Trust & durability** — post-Pocket, "we're a sustainable paid business, your data is always exportable, we won't disappear" is a real differentiator. Make it a marketing pillar.
7. *(Optional, Phase 3)* **Network effects** via shared/social collections.

---

## 6. Monetization mechanics to build (engineering implications)

These translate the model into a build list (cross-referenced in [06-three-month-roadmap.md](06-three-month-roadmap.md)):

- **Payments:** integrate **Stripe** (Checkout + Customer Portal + webhooks). Add `plan`/`subscriptionStatus`/`stripeCustomerId` to the `users` table. Handle the academic-discount coupon and the HBS free-cohort grant (a flag or coupon).
- **Entitlements/feature gating:** a server-side check (`getUserPlan(userId)`) enforced in API handlers (never trust the client) for AI, export, save-cap, collections.
- **Save cap enforcement** on the free tier (count active highlights; soft-block + upgrade prompt at the cap).
- **AI quota metering** per user per month (Pro), to keep LLM cost bounded.
- **Upgrade prompts** at the moments of value (hitting the cap, clicking export, opening AI) — not nagging popups.
- **Academic verification** (simple .edu check, or manual for now).

---

## 7. Risks to the model (see [07-risks-and-challenges.md](07-risks-and-challenges.md))

- **Free tier too generous → no conversions.** Tune the cap and gate AI/export firmly.
- **AI cost runaway.** Pro-only, quota'd, cheap models, caching.
- **Platform dependency** (Google can delist). Web-app-first; ship Edge/Firefox.
- **Low productivity-tool conversion (~2–4%).** Compensate with funnel size + the daily-habit retention engine.
- **"Highlight graveyard" churn.** The daily digest + AI synthesis are the countermeasures — they *are* the product, not features.
