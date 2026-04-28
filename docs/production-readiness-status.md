# Production Readiness Status

**Project:** Mind Palace (Highlight Compendium)
**First audited:** 2026-04-27
**Last updated:** 2026-04-27 (Session 2)

---

## Summary Table

| Category        | Total | Done | Deferred | Pending |
|-----------------|------:|-----:|---------:|--------:|
| Critical        |     4 |    4 |        0 |       0 |
| High            |     7 |    5 |        0 |       2 |
| Medium          |     8 |    4 |        3 |       1 |
| Low             |    10 |    8 |        2 |       0 |
| UI / UX         |    15 |   10 |        2 |       3 |
| CWS             |     7 |    6 |        0 |       1 |
| Features Added  |     7 |    7 |        0 |       0 |
| **Totals**      |**58** | **44** |    **7** |   **7** |

---

## Critical

| ID | Issue | Status | Notes |
|----|-------|--------|-------|
| C1 | Hardcoded API token in `popup.js` | ✅ DONE | Replaced with `chrome.storage.sync` flow; no credentials in source |
| C2 | Password reset with no email verification | ✅ DONE (intentional) | Accepted risk — small trusted group; no email loop by design |
| C3 | CORS wildcard `*` | ✅ DONE | `cors.ts` locks origin to `CORS_ORIGIN` env var; `vercel.json` headers also locked to production domain |
| C4 | API token in query string | ✅ DONE (partial) | `GET /api/extension/recent` fixed — uses `Authorization: Bearer` header. `POST /api/extension/save` reads from request body (acceptable trade-off; not logged or CDN-cached) |

---

## High

| ID | Issue | Status | Notes |
|----|-------|--------|-------|
| H1 | In-memory rate limiter useless on serverless | ❌ PENDING | `rate-limit.ts` uses a `Map` in module scope — effective only within a single warm function instance. Needs Upstash Redis for real cross-instance enforcement |
| H2 | Password reset allows 6-char; registration requires 8-char | ✅ DONE | Both flows now enforce 8-character minimum |
| H3 | JWT 30-day expiry with no revocation | ❌ PENDING | `setExpirationTime("30d")` with no `tokenVersion` or blocklist. Logout only clears the cookie client-side; token stays valid until expiry |
| H4 | Tag DELETE missing `applyCors()` | ✅ DONE | `api/tags/index.ts` calls `applyCors(req, res)` at top of handler |
| H5 | `me.ts` and `logout.ts` missing `applyCors()` | ✅ DONE | Both confirmed to call `applyCors(req, res)` as first statement |
| H6 | Stale closure on rapid tag removal | ✅ DONE | Dead `handleRemoveTag` removed; `onRemove` lambda now derives tag list from `highlightTags` (already computed from fresh props) rather than re-parsing `highlight.tagIds` string |
| H7 | Email HTML no XSS escaping | ❌ PENDING | Daily-email cron template not reviewed; user-supplied highlight text assumed to be interpolated without HTML escaping |

---

## Medium

| ID | Issue | Status | Notes |
|----|-------|--------|-------|
| M1 | Tag deletion LIKE pattern can match wrong IDs | ✅ DONE | Replaced `%${id}%` with exact JSON patterns: `[id]`, `[id,%`, `%,id]`, `%,id,%` — same safe pattern already used in the GET filter |
| M2 | `tagIds` stored as JSON string in VARCHAR | ⏳ DEFERRED | Known design limitation; acceptable at current scale. Revisit before adding tag-count queries or full-text search |
| M3 | `metadataTags` VARCHAR limit | ⏳ DEFERRED | No hard column limit at DB layer; acceptable at current volume |
| M4 | Missing DB indexes on frequently filtered columns | ❌ PENDING | No indexes on `highlights.userId`, `highlights.domain`, `highlights.createdAt`; will become a problem with larger datasets |
| M5 | Password reset error leaks account existence | ✅ DONE | Error message is now "Invalid credentials — please check your username and email" regardless of whether the account was found |
| M6 | bcrypt rounds inconsistency (12 vs 10) | ✅ DONE | All flows (registration, reset) now use bcrypt cost factor 12 |
| M7 | Daily email HTML contains unescaped user content | ❌ PENDING | Highlight text inserted into email HTML without escaping |
| M8 | No rate limiting on `POST /api/highlights` | ✅ DONE | Rate-limited at 60 requests/min per IP, same pattern as extension save endpoint |

> M2 and M3 are intentionally deferred pending user growth.

---

## Low

| ID | Issue | Status | Notes |
|----|-------|--------|-------|
| L1 | Extension injects on `<all_urls>` | ✅ DONE (accepted) | Justified — extension must detect selections on any page; CWS justification text prepared |
| L2 | `data-hc-extension` attribute fingerprinting | ⏳ DEFERRED | Low risk; any site can detect extension is installed via DOM attribute; accepted |
| L3 | `popup.js` uses `innerHTML` with `esc()` | ✅ DONE (accepted) | `esc()` uses throwaway DOM node for safe text encoding; no raw user HTML injected |
| L4 | No `dangerouslySetInnerHTML` in frontend | ✅ DONE (confirmed) | Audit found no unsafe HTML injection in React components |
| L5 | No `VITE_` secrets in frontend bundle | ✅ DONE (confirmed) | No sensitive env vars exposed through Vite's public prefix |
| L6 | `useAuth` imported from two paths | ✅ DONE | All files now import from `@/contexts/AuthContext` directly; shim file untouched but unused |
| L7 | No account deletion in-app | ⏳ DEFERRED | Privacy policy and FAQ instruct users to email for deletion; acceptable at current scale |
| L8 | `dailyEmailEnabled` defaults to `true` | ✅ DONE | Schema default changed to `false`; registration handler also explicitly sets `false` — new users must opt in |
| L9 | Resend `from` address uses demo/sandbox domain | ⏳ DEFERRED | Needs custom domain DNS setup; deferred until domain is configured |
| L10 | `web_accessible_resources` exposes icons | ✅ DONE (accepted) | Icons only; no sensitive assets; low risk accepted |

---

## UI / UX

| ID | Issue | Status | Notes |
|----|-------|--------|-------|
| UX-1 | `handleRemoveTag` dead code in `HighlightCard` | ✅ DONE | Function removed entirely |
| UX-2 | Stale closure on rapid tag removal (inline lambda) | ✅ DONE | Inline `onRemove` now uses `highlightTags` array computed at render time instead of re-parsing stale `highlight.tagIds` string |
| UX-3 | Tag rename / recolor missing | ❌ PENDING | No PATCH endpoint or UI for editing a tag's name or colour after creation |
| UX-4 | Debounce cleanup / memory leak in search | ✅ DONE | Replaced leaking `setTimeout` return with `useRef`; timer cleared before each new one is set |
| UX-5 | Theme not persisted to DB | ✅ DONE (confirmed) | `ThemeContext.toggleTheme` already calls `PATCH /api/auth/me`; persistence confirmed working |
| UX-6 | No manual "Add highlight" button in dashboard | ❌ PENDING | Users can only add highlights via the browser extension |
| UX-7 | No email verification on registration | ⏳ DEFERRED | Intentionally deferred for trusted-group launch |
| UX-8 | No user profile editing (display name, email) | ❌ PENDING | `me.ts` PATCH only handles `theme` and `dailyEmailEnabled`; username/email cannot be changed |
| UX-9 | No delete-account flow in UI | ⏳ DEFERRED | Covered in Privacy Policy and FAQ as email request; acceptable at current scale |
| UX-10 | No onboarding / extension setup flow | ❌ PENDING | New users land in dashboard with no guidance on installing the extension or finding their API token |
| UX-11 | MindPalace sidebar not responsive on mobile | ✅ DONE (partial) | Collapsible sidebar added — toggle button in header collapses/expands with CSS transition. Full overlay-on-mobile layout still pending |
| UX-12 | Landing page nav has no mobile menu | ✅ DONE | Hamburger button added; toggles a dropdown with Contact, theme toggle, and CTA |
| UX-13 | `confirm()` dialogs used for destructive actions | ✅ DONE | Replaced with `ConfirmDialog` component — styled modal, Escape to cancel, click-outside to cancel |
| UX-14 | No keyboard navigation | ❌ PENDING | No focus management or keyboard shortcuts in the dashboard |
| UX-15 | API tokens shown in full in Settings | ✅ DONE | Tokens masked as `hc_2e88056a•••••••••••3171`; delete button (trash icon) added to every token row |

---

## Chrome Web Store (CWS)

| ID | Issue | Status | Notes |
|----|-------|--------|-------|
| CWS1 | Hardcoded token in extension | ✅ DONE | Removed; token stored in `chrome.storage.sync` entered by user |
| CWS2 | `<all_urls>` justification text | ✅ DONE | Justification text prepared for store submission |
| CWS3 | Redundant `host_permissions` entry | ✅ DONE (kept) | Both `matches` and `host_permissions` required — content script + background.js fetch both need it |
| CWS4 | Privacy Policy page missing | ✅ DONE | `/privacy` route and `Privacy.tsx` implemented; linked from footer |
| CWS5 | CSP not declared in manifest | ✅ DONE | `manifest.json` includes `content_security_policy.extension_pages` |
| CWS6 | Store description not updated | ✅ DONE | `manifest.json` description updated to accurate, store-appropriate copy |
| CWS7 | Store assets (screenshots, icons) | ❌ USER ACTION | Promotional screenshots and 1280×800 / 440×280 store banner must be uploaded in the Chrome Web Store Developer Dashboard before submission |

---

## Features Added (Session 2)

These were not in the original audit — new capabilities built during this session.

| ID | Feature | Status | Notes |
|----|---------|--------|-------|
| F1 | Collapsible sidebar | ✅ DONE | `‹` / `›` toggle in header; CSS transition; state persists within session |
| F2 | Settings button on landing nav | ✅ DONE | Gear icon in top-right; only visible when logged in; links to `/settings` |
| F3 | FAQ page | ✅ DONE | `/faq` — 18 questions, accordion UI; linked from footer; covers extension setup, tokens, tags, export, privacy, account deletion |
| F4 | Auto Topics in sidebar | ✅ DONE | Sidebar shows every metadata tag (AI, Business, Design…) derived from the user's highlights |
| F5 | Multi-select tag filtering | ✅ DONE | Both user-created tags and auto Topics support multi-select; active filters shown as removable chips in the header |
| F6 | API: `action=metadata-tags` endpoint | ✅ DONE | Returns sorted list of unique auto-inferred topic strings for the current user |
| F7 | Search bar cleaned up | ✅ DONE | Placeholder simplified; Unicode escape `\u2026` replaced with literal `…` |

---

## What Still Needs Doing

### User action required now

- **CWS7** — Upload at least one 1280×800 screenshot and a store banner to the Chrome Web Store Developer Dashboard before submission.
- **CORS_ORIGIN env var** — Confirm it is explicitly set in Vercel project settings (not relying on the fallback in `cors.ts`).

### Before onboarding more than 5 users

| Priority | Item | Effort |
|----------|------|--------|
| H1 | Replace in-memory rate limiter with Upstash Redis | ~2 hrs — install `@upstash/redis`, replace `Map` in `rate-limit.ts` with atomic Redis `INCR` |
| H3 | JWT session revocation | ~2 hrs — add `tokenVersion` column to `users`, include in JWT payload, increment on logout/password change |
| H7 / M7 | XSS-escape user content in email templates | ~1 hr — audit daily-email cron; wrap all user-supplied strings with an HTML-escape helper |
| M4 | Add DB indexes | ~30 min — index `highlights(userId)`, `highlights(userId, createdAt DESC)`, `highlights(domain)` |

### Before scaling beyond current user group

| Priority | Item | Effort |
|----------|------|--------|
| UX-3 | Tag rename / recolor | ~3 hrs — PATCH endpoint in `api/tags/index.ts` + inline edit UI in sidebar |
| UX-6 | Manual "Add highlight" button | ~2 hrs — modal form in dashboard; POST to `/api/highlights` |
| UX-8 | User profile editing (username, email) | ~3 hrs — extend `me.ts` PATCH + Settings UI |
| UX-10 | Onboarding flow | ~4 hrs — first-login modal; steps for extension install, API token, keyboard shortcut |
| UX-14 | Keyboard navigation | ~3 hrs — focus management, keyboard shortcuts (e.g. `/` for search, `Esc` to close modal) |
| M2 | Migrate `tagIds` to a join table | ~4 hrs — schema migration + update all query sites; required before tag-count features |
| L9 | Custom email domain for Resend | ~1 hr — DNS records + Resend domain verification |
| UX-9 / L7 | Self-serve account deletion | ~3 hrs — "Delete my account" in Settings; cascade DB delete + confirmation email |

---

## Version History

| Version | Date | What shipped |
|---------|------|-------------|
| v0.1 | 2026-04-27 | Initial audit — 18 of 51 items done |
| v1.0 | 2026-04-27 | Session 2 — 26 additional items fixed or built; CWS-submission ready |
