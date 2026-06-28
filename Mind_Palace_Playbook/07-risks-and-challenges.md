# Risks & Challenges — What to Watch, and How to Mitigate

> Organized by category, each with **likelihood**, **impact**, and a **concrete mitigation**. The highest-priority risks are flagged ⚠️. This is the "things that will bite you" reference — read it before each major decision and revisit before each launch wave.

---

## 1. Technical / implementation risks

| Risk | Likelihood | Impact | Mitigation |
|---|---|---|---|
| ⚠️ **Env-var parity failures** (the `JWT_SECRET`-on-Production-only bug that broke sign-in) | High (recurs) | High (users can't sign in) | Set all secrets across **Prod + Preview**; startup assertion that fails loud; `.env.example`; launch checklist ([05 §2, §8](05-technical-infrastructure-scaling.md)) |
| ⚠️ **In-memory state on serverless** (rate limiter, any cache) doesn't persist | High | Med–High (no real rate limiting → abuse/cost) | Upstash Redis (already specced) |
| ⚠️ **DB connection exhaustion** under load | Med | High (intermittent 500s) | Neon serverless HTTP driver + **pooled (PgBouncer)** connection string |
| ⚠️ **Email lands in spam** (sandbox sender) | High (until fixed) | High (retention engine dies silently) | Custom domain + SPF/DKIM/DMARC; monitor bounce/complaint |
| **Cron silently fails** → no digests | Med | High (silent churn) | Healthcheck/dead-man's-switch + alert after each run |
| **AI cost runaway** | Med | Med–High (surprise bill) | Pro-only, per-user quotas, caching, cheap models, AI Gateway cost tracking |
| **`tagIds` VARCHAR fragility** (LIKE false positives, no tag analytics) | Med | Med | Migrate to join table before tag-count/bulk features |
| **Extension breakage** on Chrome updates / MV3 changes | Med | Med | Monitor `chrome.runtime` errors; keep deps current; budget maintenance |
| **JWT can't be revoked** (logout is client-side only) | Low–Med | Med (stolen token valid 30d) | `tokenVersion` revocation |
| **Slow/timeout on long ops** (AI, big export) | Med | Med | Vercel Pro timeouts; offload to queue/background job |
| **Data loss / no backups** | Low | Critical | Confirm Neon PITR/branching; periodic export; test restore |

---

## 2. Product / market risks

| Risk | Likelihood | Impact | Mitigation |
|---|---|---|---|
| ⚠️ **"Highlight graveyard"** — users save, never return, churn | High | High (kills retention) | Daily digest (great, delivered) + AI synthesis + review mode + connections — *these are the product* ([03 §4](03-research-competitors-readwise-pocket.md)) |
| **Weak activation** — users sign up, never get to first value | High | High | Onboarding flow to first-save + first-digest; measure activation rate |
| **Low productivity-tool conversion (~2–4%)** | High (it's the baseline) | Med | Large free funnel + strong gating of AI/export; expand top-of-funnel beyond HBS |
| **Undifferentiated "another read-later app"** | Med | High | Position as research/synthesis tool; ship AI Q&A + citations (the wedge) |
| **Free tier too generous → nobody pays** | Med | Med | Gate AI, export, unlimited saves, collections; tune the save cap |
| **Cloned by a competitor** | Med | Med | Moat = data + habit + integrations + brand, not the extension code ([04 §3](04-research-chrome-extension-businesses.md)) |
| **Feature bloat** (becoming the "choked" Reader you should beat) | Med | Med | Stay focused; ship differentiators, resist everything else |

---

## 3. Platform / distribution risks

| Risk | Likelihood | Impact | Mitigation |
|---|---|---|---|
| ⚠️ **Google delists/rejects the extension** (your distribution is rented land) | Low–Med | Critical | **Web-app-first** (works without store); ship **Edge + Firefox**; documented out-of-store install path |
| **CWS rejection on permissions** (`<all_urls>` scrutiny) | Med | Med (delays launch) | Precise permission justification; prefer `activeTab`/on-demand injection where feasible; keep permission set minimal (continue v1.1.1 cleanup) |
| **MV3 remote-code ban** breaks AI plans | Low | Med | AI runs via *your API*, not remote scripts in the extension |
| **Manifest/Chrome migrations** | Med | Med | Track Chrome dev changelog; maintenance budget |
| **CWS review latency** stalls time-sensitive launches | Med | Low–Med | Don't gate launches on instant review; submit early |

---

## 4. Legal / compliance / privacy risks

| Risk | Likelihood | Impact | Mitigation |
|---|---|---|---|
| ⚠️ **Vercel Hobby is non-commercial** — running a paid product on Hobby violates ToS | High (if you monetize on Hobby) | High (takedown) | Move to **Vercel Pro** before charging/public commercial launch |
| **GDPR/CCPA** — right to access/delete, consent for email | Med | Med–High (esp. with EU/UK users) | Self-serve account deletion; export; email opt-in (already default-off); clear privacy policy (have `/privacy`) |
| **Weak password reset** (username+email only, both non-secret) — fine for trusted 5, **not** for the public | High (at public scale) | High (account takeover) | Email OTP / magic-link reset before public launch |
| **No email verification** → junk/abuse accounts | Med | Med | Add verification at signup |
| **Storing third-party copyrighted text** (highlights) | Low | Low–Med | Personal-use, user-generated, private library; provide takedown path; don't republish publicly without care (relevant if social/shared collections ship) |
| **Handling student/.edu data** | Med | Med | Minimize data collected; clear policy; secure storage |
| **AI data handling** (sending user highlights to an LLM) | Med | Med | Use zero-retention provider settings (e.g., via AI Gateway); disclose in privacy policy; let users opt out |

---

## 5. Business / operational risks (solo founder reality)

| Risk | Likelihood | Impact | Mitigation |
|---|---|---|---|
| **Solo-founder bandwidth** (you're an MBA student, not full-time eng) | High | High | Lean on AI coding agents ([08](08-claude-cowork-agent-manual.md)); ruthless prioritization (the [06](06-three-month-roadmap.md) stack); don't gold-plate |
| **Support load** as users grow | Med | Med | FAQ, in-app help, a support email/inbox; templated responses; build self-serve (deletion, reset) to cut tickets |
| **Scope creep / shiny-feature chasing** | High | Med | The roadmap is the contract; new ideas go to a backlog, not the current sprint |
| **Burnout / momentum loss** | Med | High | Ship small and often; celebrate the cohort wins; the free launch creates external accountability |
| **Underpricing / never monetizing** | Med | Med | Commit to the Phase-1 paywall timeline; grandfather the cohort, charge the rest |
| **Key-person/secrets hygiene** | Med | High | Secrets in Vercel env (not code), rotate `JWT_SECRET`/keys if leaked, 2FA on GitHub/Vercel/Neon/Stripe |

---

## 6. The "silent failure" class — special attention

Most of what will hurt you **fails silently** (no error to the user, no crash — it just doesn't work, and people quietly leave):
- Env var missing on Preview → sign-in fails on a branch deploy.
- CORS misconfigured for preview origin → "save failed" with no explanation.
- Digest in spam → users think the product does nothing.
- Cron broken → no digests, no alarm.
- Rate limiter ineffective → abuse/cost you don't notice until the bill.

**Counter-discipline:** loud startup assertions, healthchecks/alerts on the cron, monitoring (Sentry + PostHog), and a real **end-to-end smoke test from a fresh/incognito browser** before every launch wave ([05 §8](05-technical-infrastructure-scaling.md)). If a thing matters, alarm on its absence.

---

## 7. Risk-priority summary (do these mitigations first)

1. **Env-var parity + startup assertions** (sign-in reliability).
2. **Custom email domain** (deliverability = retention).
3. **Move to Vercel Pro before monetizing** (ToS compliance).
4. **Upstash rate limiter + JWT revocation + email XSS escape** (safe for strangers).
5. **Onboarding flow** (activation = retention).
6. **Email OTP reset + verification + self-serve deletion** (public-grade security/compliance).
7. **AI cost guardrails** (Pro-only, quota, cache).
8. **Edge/Firefox + web-app-first** (platform-risk hedge).
9. **Monitoring + cron healthcheck** (kill silent failures).
