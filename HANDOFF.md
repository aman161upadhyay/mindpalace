# Handoff Document — Mind Palace Extension Debugging

## User Frustration Note
The previous assistant (Claude) repeatedly suggested refreshing tabs and reloading the extension despite the user explicitly confirming they already understood and performed those steps every single time. This was a major failure of the session. Do NOT repeat this advice unless specifically asked. The user knows how Chrome extension development works.

---

## Project State

### What Works
- App deployed at: `https://mindpalace-bice.vercel.app`
- Login, register, dashboard all work
- API endpoints confirmed working: `/api/extension/recent` returns 401 (correct), `/api/extension/save` returns 405 for GET (correct)
- Extension tooltip is NOW VISIBLE on Gemini (position:fixed fix worked)
- Content script injects correctly — `document.documentElement.getAttribute('data-hc-extension')` returns `"true"` on pages

### What Does NOT Work
1. **Ctrl+Shift+S on BBC does nothing** — content script is confirmed running (returns "true"), but the shortcut produces zero response. Not a stale tab issue. Unknown root cause.
2. **Save to Mind Palace (context menu) returns 404** — API call is made but gets 404. Likely because `chrome.storage.sync` has no saved settings (background service worker was dead during all previous save attempts), so extension uses default placeholder URL `https://your-app.vercel.app`. User needs to verify what URL is stored. Check by opening popup → gear icon → read Dashboard URL field.
3. **"Go to Mind Palace" in popup doesn't open tab** — was caused by missing `"tabs"` permission, now fixed in manifest. May still require settings to be re-saved.

---

## All Code Changes Made This Session

### Backend / Vercel API
| File | Change |
|------|--------|
| `src/lib/rate-limit.ts` | Created — sliding-window in-memory rate limiter |
| `src/lib/cors.ts` | Created — `applyCors()` helper, handles OPTIONS preflight |
| `src/lib/auth.ts` | Added `getAuthUserIdFromVercelReq()` — centralized cookie auth |
| `api/highlights/index.ts` | Added CORS, auth helper, LIKE escaping, merged export+domain-stats via `?action=` param |
| `api/highlights/export.ts` | Deleted — merged into index.ts |
| `api/highlights/domain-stats.ts` | Deleted — merged into index.ts |
| `api/highlights/[id].ts` | Added validation, try/catch |
| `api/auth/login.ts` | Rate limiting, CORS, input validation, replaced nanoid with crypto.randomBytes |
| `api/auth/register.ts` | Rate limiting, CORS, unique constraint error handling |
| `api/tokens/index.ts` | CORS, label validation, replaced nanoid |
| `api/extension/save.ts` | Rate limiting, CORS, URL/domain validation |
| `api/extension/recent.ts` | CORS added |
| `src/pages/MindPalace.tsx` | Updated fetch URLs for merged endpoints |
| `vercel.json` | CORS headers at edge level, rewrite rules (see issues below) |
| `package.json` | Removed `"type": "module"`, downgraded jose to v4, removed nanoid |
| `tsconfig.app.json` | Added baseUrl, paths alias, ignoreDeprecations |

### Extension
| File | Change |
|------|--------|
| `extension/manifest.json` | Removed `"type": "module"` from background (was silently crashing service worker), added `"tabs"` permission |
| `extension/content.js` | Fixed tooltip host from `position:absolute` to `position:fixed` (was rendering off-screen on long pages), added try/catch around chrome.runtime calls in HC_GET_SETTINGS and HC_SAVE_SETTINGS handlers |
| `extension/background.js` | Added try/catch around `response.json()` in handleSaveHighlight, wrapped handleGetRecent in try/catch |

---

## Unresolved Issues

### Issue 1: Ctrl+Shift+S does nothing on BBC (and possibly other pages)
- Content script IS running (attribute confirmed "true")
- Simulated keydown via `document.dispatchEvent(new KeyboardEvent(...))` DID fire the handler (returned false, triggering BBC's own loader.js error)
- But real physical Ctrl+Shift+S produces zero response — no tooltip at all
- Hypothesis: Chrome may be intercepting Ctrl+Shift+S at browser level on some pages before it reaches the content script's keydown listener. The Chrome `commands` shortcut in manifest should take priority, but the background's `TRIGGER_SAVE` message to the tab may not be reaching the content script.
- Things NOT yet tried: Testing if the Chrome `commands` shortcut itself fires at all (background.js `onCommand` listener). Could add a `chrome.notifications` or `chrome.action.setBadgeText` call in `onCommand` to confirm it fires.
- Alternative: Change shortcut to something less likely to conflict (e.g., Alt+Shift+S)

### Issue 2: 404 on save
- API endpoint confirmed working at server level
- 404 most likely caused by extension using default placeholder URL `https://your-app.vercel.app` because settings were never saved to `chrome.storage.sync` (background service worker was dead/crashing during all previous configuration attempts)
- Fix: After confirming background is running (no errors in chrome://extensions), open popup → gear → enter `https://mindpalace-bice.vercel.app` + API token → Save → verify "Settings saved!" confirmation appears
- If still 404: add console.log to handleSaveHighlight to log the actual URL being called

### Issue 3: vercel.json rewrite complexity
- Multiple iterations of vercel.json CORS/rewrite changes were made
- Current state uses negative lookahead `/((?!api/).*)` — support in Vercel path-to-regexp is unverified
- If API routing breaks again, revert to: `{ "source": "/(.*)", "destination": "/index.html" }` — Vercel resolves serverless functions before applying rewrites so this is safe

---

## Production URLs
- App: `https://mindpalace-bice.vercel.app`
- GitHub: `https://github.com/aman161upadhyay/mindpalace`
- Neon DB: configured via `DATABASE_URL` env var in Vercel

## Extension Location
- Local folder: `M:\AI\Knowledge_Area51\extension\`
- Loaded as unpacked extension in Chrome

## Tech Stack
- Frontend: React + Vite + Tailwind + Wouter
- Backend: Vercel serverless functions (TypeScript)
- DB: Neon PostgreSQL + Drizzle ORM
- Auth: JWT in httpOnly cookie (`hc_session`)
- Extension: Chrome MV3
