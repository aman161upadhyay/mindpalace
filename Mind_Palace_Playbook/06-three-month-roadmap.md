# The 3-Month Roadmap — Build to 1,000 Users

> **Sequencing principle:** Blockers → Trust/Onboarding → Differentiation → Monetization. You cannot grow on a product strangers can't sign into, won't get value from on day one, that doesn't do anything competitors don't, or that you can't charge for. Build in that order. Each item below is sized and tagged so you can hand it to an AI coding agent (see [08-claude-cowork-agent-manual.md](08-claude-cowork-agent-manual.md)). Existing backlog IDs (e.g., H1, UX-10) reference `docs/production-readiness-status.md`.

---

## Month 1 — Foundations: "a stranger can sign up, get value, and trust it"

### Sprint 1.1 — Launch blockers (the things that stop sign-up today)
| Item | Why | Effort |
|---|---|---|
| **Env-var parity** — set every secret for **Production AND Preview** (`JWT_SECRET` same across envs, `DATABASE_URL`, `RESEND_API_KEY`, `CRON_SECRET`, `CORS_ORIGIN`) + add a **startup assertion** that fails loud on missing vars | This is *why sign-in broke*. Class of bug, not a one-off | 1–2h |
| **Disable Vercel deployment/password protection**; confirm CWS approval; **custom domain** (`mindpalace.app`) | Site must be publicly reachable | 1h + DNS |
| **Resend custom domain** (SPF/DKIM/DMARC) — kill the sandbox sender | Digest = retention engine; sandbox → spam | 1h + DNS |
| **CORS for preview envs** | Silent "save failed" on preview deploys | 1h |

### Sprint 1.2 — Harden for strangers (the "before >5 users" list)
| Item | ID | Effort |
|---|---|---|
| Upstash Redis rate limiter (replace in-memory `Map`) | H1 | 2h |
| JWT session revocation (`tokenVersion`) | H3 | 2h |
| XSS-escape user content in digest email | H7/M7 | 1h |
| DB indexes (`highlights(userId, createdAt DESC)`) | M4 | 0.5h |

### Sprint 1.3 — Onboarding & activation (the #1 retention lever)
| Item | ID | Effort |
|---|---|---|
| **First-run onboarding flow**: install extension → get API token → first save → "you'll get your first digest tomorrow" | UX-10 | 4h |
| **Manual "Add highlight"** from dashboard (so value exists before the extension habit forms) | UX-6 | 2h |
| Self-serve account deletion (privacy/trust + GDPR) | L7/UX-9 | 3h |
| Instrument analytics (PostHog) + error monitoring (Sentry) | — | 2h |

**Exit criteria for Month 1:** a stranger can sign up on the public domain, install the extension, save a highlight, see it, get a digest in their inbox (not spam), and you can see their behavior in analytics. Run the **[05 §8 launch checklist](05-technical-infrastructure-scaling.md)**.

---

## Month 2 — Differentiation: "do what competitors don't"

### Sprint 2.1 — Export & integrations (trust + stickiness; reduces "will it disappear?" fear)
| Item | Why | Effort |
|---|---|---|
| **Export to Markdown / Notion / Obsidian** | Post-Pocket, data portability is a *selling point*; deepens the user's pipeline | 4–6h |
| **Citation export (BibTeX / RIS / APA / MLA)** | The academic killer-feature; Zotero's gap | 3–4h |
| Tag rename/recolor; migrate `tagIds` → **join table** (prereq for tag analytics) | UX-3 / M2 | 3h + 4h |

### Sprint 2.2 — The flagship: AI synthesis over your library
| Item | Why | Effort |
|---|---|---|
| **"Ask your library"** — AI Q&A over a user's highlights with cited sources ("Summarize what I've saved on X", "Draft a lit-review paragraph from these, with citations") | The antidote to the highlight graveyard; the one thing no incumbent does well for researchers | 1–2 weeks |
| **`pgvector` + embeddings at save time** (cheap model) → **semantic "related highlights"** | Powers synthesis + "you saved something related" connections | 3–5d |
| **Auto-summary per source/collection** | Turns a pile into knowledge | 2–3d |

> AI infra discipline: route via **Vercel AI Gateway**; Haiku for tagging/summaries, Sonnet for synthesis; **Pro-only + per-user quota + caching**; precompute, don't recompute. See [09 §6](09-research-infra-cost-and-pricing-benchmarks.md).

### Sprint 2.3 — Collections & polish
| Item | Why | Effort |
|---|---|---|
| **Collections / projects** (group highlights by paper/project/course) | Critical for lit reviews & dissertations | 4–6h |
| Keyboard navigation (`/` search, `Esc`, arrows) | Power-user delight | 3h |
| Profile editing (username/email) | UX-8 | 3h |
| Review/resurface mode in dashboard (not just email) | Reinforce the habit loop | 4h |

---

## Month 3 — Monetization & growth: "charge, and open the funnel"

### Sprint 3.1 — Payments & entitlements
| Item | Why | Effort |
|---|---|---|
| **Stripe** (Checkout + Customer Portal + webhooks); `plan`/`subscriptionStatus`/`stripeCustomerId` on `users` | Turn it into a business | 1 week |
| **Server-side feature gating** (`getUserPlan`) for AI/export/save-cap/collections | Never trust the client | 2–3d |
| **Free-tier save cap** + tasteful upgrade prompts at moments of value | Drives conversion without nagging | 2d |
| **Academic 50% coupon** + **HBS free-cohort grant** (flag/coupon) | Pricing model from [01](01-business-model-and-monetization.md) | 1d |
| Email OTP / magic-link reset + email verification on signup | Required before charging strangers | 4–6h |

### Sprint 3.2 — Public launch & expansion
| Item | Why | Effort |
|---|---|---|
| **Ship to Edge (+ Firefox)** | Reach + platform-risk hedge | 2–4h (Edge), more for FF |
| **Landing-page conversion pass** (see §"Website features" below) | Turn visitors into signups | 3–5d |
| **Invite-a-friend / referral** | Word-of-mouth engine | 3d |
| **CWS review-ask flow** (prompt after first "aha") | Ratings flywheel | 1d |
| Product Hunt / HN launch assets | Spike + backlinks | 2d |

---

## Website / landing-page features (specifically requested)

The current landing page is design-led (parchment/Playfair aesthetic). To convert the 1,000-user funnel, add/upgrade:

1. **Clear above-the-fold value prop + primary CTA** ("Start free — install for Chrome"). One job: get the install/signup.
2. **A 30–60s product demo** (GIF/Loom of select → save → digest → "ask your library"). Showing beats telling.
3. **Social proof** — testimonials from the HBS cohort, install count, CWS rating badge, "used by researchers at…".
4. **"Why we won't disappear" / data-ownership section** — the post-Pocket trust pillar. Link to easy export.
5. **Use-case pages** — "For researchers," "For students," "For knowledge workers" (SEO + targeted messaging).
6. **Comparison / alternatives content** — "Mind Palace vs Readwise," "Best Pocket alternatives 2026" (rides the displacement wave; ranks for high-intent searches).
7. **Pricing page** — Free / Pro / Academic, with the value clearly gated (see [01](01-business-model-and-monetization.md)).
8. **Onboarding/install guide** + FAQ (extend existing `/faq`).
9. **Robust auth pages** — the sign-in flow must be bulletproof (the `JWT_SECRET` lesson); add clear error states, "resend verification," and password-reset via OTP.
10. **SEO basics** — meta tags, OG images, sitemap, fast load (it's already on Vercel/Vite — keep Lighthouse green).
11. **Analytics + conversion events** wired on every CTA.

---

## Cross-cutting "other considerations" you asked about

- **Environment parity discipline** (the sign-in bug) — codify the launch checklist; never ship a wave without it. ([05 §2, §8](05-technical-infrastructure-scaling.md))
- **Email deliverability** is product-critical, not an afterthought — the digest *is* the retention engine.
- **AI cost control** — Pro-only, quota'd, cached, cheap-model-by-default.
- **Platform risk** — web-app-first; Edge/Firefox; documented out-of-store install path.
- **Privacy/trust as marketing** — loud policy, no data resale, easy export.
- **Don't over-build** — beat Readwise on *focus*. Ship the differentiators (synthesis, export, collections, citations) and resist feature bloat.
- **Measure** — activation, D30 retention, digest open rate, conversion. Let data pick the next sprint.

---

## One-glance priority stack (if you only do things in order)

1. Env-var parity + launch blockers (you can't grow without sign-in).
2. Custom email domain (retention engine must deliver).
3. Onboarding flow (activation = retention).
4. Upstash rate limiter + JWT revocation + email XSS escape (safe for strangers).
5. Export + citations (trust + academic wedge).
6. AI "ask your library" + semantic related (the differentiator).
7. Collections (academic workflow).
8. Stripe + gating + OTP reset (monetize).
9. Edge/Firefox + landing conversion + referral (open the funnel).
