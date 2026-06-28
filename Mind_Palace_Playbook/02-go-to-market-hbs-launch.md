# Go-To-Market — The HBS Launch & Beyond

> **Strategy in one line:** Use your ~1,000-person HBS batch as a **free, high-credibility beachhead** to manufacture usage, testimonials, and word-of-mouth — then expand outward through adjacent academic and knowledge-worker communities on freemium. The goal for the next 3 months is **1,000 usable accounts**, not 1,000 dollars. Credibility ("the tool Harvard researchers/MBAs use") is the asset that solves the cold-start problem for everything after.

---

## 1. Why HBS-first is the right beachhead

- **Tight, trusted network** → word-of-mouth travels fast and credibly (the highest-ROI channel for niche prosumer tools — see [04 §5](04-research-chrome-extension-businesses.md)).
- **High-intent users:** MBAs and academics read, highlight, and synthesize constantly — exactly the "highlight graveyard" pain Mind Palace solves.
- **Credibility halo:** "built at HBS, used across the batch" is marketing you can't buy. It de-risks the product for the *next* audience (other grad programs, researchers, knowledge workers).
- **Free funnel is cheap:** serving 1,000 free users ≈ **$55/mo** ([09](09-research-infra-cost-and-pricing-benchmarks.md)). This is the cheapest, best-targeted marketing budget available.

---

## 2. The 3-month launch timeline (≈1,000 users)

> Sequenced to fix the **blockers first** (you literally couldn't sign in due to a missing preview `JWT_SECRET`), then onboarding, then growth. Engineering detail in [06-three-month-roadmap.md](06-three-month-roadmap.md).

### Month 1 — "Make it bulletproof for strangers" (private beta, ~20–50 users)
- **Fix the launch blockers:** every Vercel env var set across **Production *and* Preview** (`JWT_SECRET`, `DATABASE_URL`, `RESEND_API_KEY`, `CRON_SECRET`, `CORS_ORIGIN`); disable Vercel password protection; confirm CWS approval; custom domain (`mindpalace.app`) + Resend custom sending domain (SPF/DKIM/DMARC).
- **Ship onboarding** (extension install → API token → first save → first digest). Activation is the #1 retention predictor.
- **Harden:** Upstash rate limiter, JWT revocation, email-template XSS escape, DB indexes (all already specced/flagged).
- **Recruit 20–50 friendly beta users** (close friends, study group, a few professors). Watch them onboard *live* (or via session replay) and fix every point of confusion.

### Month 2 — "Section & club rollout" (~200–400 users)
- **Roll out section by section / club by club** (HBS sections ~90 people each; target a few sections + relevant clubs: Tech, VC/PE, Healthcare, Entrepreneurship, plus any research-heavy groups).
- **Seed champions:** find 5–10 enthusiastic users per section who'll demo it. Give them something to share (a 60-sec Loom, a one-pager).
- **Instrument everything** (PostHog): activation rate, D1/D7/D30 retention, saves/user, digest open rate, search usage. Let data tell you what to fix.
- **Engineer the review flywheel:** prompt for a Chrome Web Store review after a user's first "aha" (first digest they enjoyed, or 10th save).
- **Content:** publish 2–3 posts ("How I run my reading/research workflow," "Best Pocket alternatives in 2026," "Turning highlights into a literature review with AI") — ranks for the exact audience and gives champions something to link.

### Month 3 — "Whole batch + first expansion" (~1,000 users)
- **Open to the full batch** (email list, class Slack/Whatsapp/Canvas, club newsletters, an in-person demo at a club event).
- **Ship the AI synthesis MVP** (the differentiator) and **export** — the features that convert the graveyard into a research assistant and create shareable "wow."
- **Begin expansion seeding:** invite-a-friend; reach into adjacent communities (HKS, GSAS PhD students, other top MBA programs, research Twitter/Bluesky, r/PKM, r/Zettelkasten, Academic Twitter). Each new community is a fresh top-of-funnel.
- **Turn on Pro for non-cohort users** (grandfather the HBS cohort free; see [01 §3](01-business-model-and-monetization.md)).

---

## 3. Channels, ranked by ROI for this launch

1. **Direct word-of-mouth in the HBS network** (sections, clubs, study groups) — highest ROI.
2. **Champions / power users** demoing to peers.
3. **Chrome Web Store organic** (ratings flywheel — engineer the review ask).
4. **Content marketing** (workflow + "Pocket alternative" SEO; rides the post-Pocket displacement of millions of users).
5. **Adjacent communities** (PKM/research subreddits, Academic social media, other grad programs).
6. **Product Hunt / Hacker News launch** (Month 3+, once polished — good for a spike + backlinks, not a foundation).

---

## 4. Positioning & messaging

**Don't** position as "another read-later app." **Do** position as the **synthesis tool for people who read for a living.**

- **Tagline options:** "Turn everything you read into knowledge you'll actually use." / "Your research, remembered." / "Highlight the web. Synthesize anything."
- **Three pillars (lead with these):**
  1. **Capture anywhere, effortlessly** (the extension).
  2. **Never lose a thought — resurfaced daily** (the digest; the anti-graveyard).
  3. **Ask your own library** (AI synthesis/Q&A + citation export — the researcher killer feature).
- **Trust pillar (the post-Pocket dividend):** "A sustainable, independent product. Your data is always yours and always exportable. We won't disappear." Millions of Pocket/Omnivore refugees in 2025 care about this — say it explicitly.
- **For academics specifically:** "From scattered highlights to a citable literature review" — speaks directly to the Zotero "storage-not-synthesis" gap ([03 §6](03-research-competitors-readwise-pocket.md)).

---

## 5. Activation & retention (the part most launches get wrong)

- **Activation = first save → see it in dashboard → first useful digest.** Build onboarding to drive every new user to that within their first session. (No onboarding flow exists yet — top priority; UX-10 in the roadmap.)
- **Retention engine = the daily digest.** It must be (a) delivered (custom domain, not spam), (b) genuinely good (relevant, well-formatted, a pleasure to open), and (c) customizable (frequency, time). This is the single biggest retention lever and your closest analog to Readwise's moat.
- **The "aha" to engineer toward:** a user re-encountering something valuable they'd forgotten, or asking the AI a question and getting a synthesized, cited answer from their own saves.

---

## 6. Metrics to track (define success)

| Metric | Why | Target (rough) |
|---|---|---|
| **Installs / signups** | Funnel top | 1,000 in 3 months |
| **Activation rate** (first save + dashboard view) | Predicts retention | >60% of signups |
| **D7 / D30 retention** | Habit forming? | D30 >25% (good for PKM) |
| **Saves per active user / week** | Engagement depth | trending up |
| **Digest open rate** | Retention engine health | >35% |
| **CWS rating & review count** | Distribution flywheel | 4.5★+, growing |
| **Free→Pro conversion** (post-paywall) | Business viability | 2–4% |
| **NPS / qualitative testimonials** | Word-of-mouth fuel | collect actively |

---

## 7. The "I couldn't sign in" lesson — operational discipline for launch

The sign-in failure (missing `JWT_SECRET` on the **Preview** environment, only set for Production) is the archetype of what kills launches: **a config gap, not a code bug.** Before opening to each new wave of users, run the **launch checklist in [05 §8](05-technical-infrastructure-scaling.md)** — env vars across all environments, deployment protection off, custom domain + email domain verified, CORS correct, a real end-to-end sign-up/sign-in/save/digest test from a fresh browser and incognito. Treat every onboarding wave as a mini-launch with this checklist.
