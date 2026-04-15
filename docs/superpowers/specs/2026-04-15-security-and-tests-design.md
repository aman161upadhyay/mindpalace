---
title: Security Hardening & Test Rewrite
date: 2026-04-15
status: approved
---

# Security Hardening & Test Rewrite

## Overview

Two parallel goals: (1) fix the broken Vitest test suite (currently failing because it imports tRPC artifacts that no longer exist), and (2) add the security protocols from the project's security reference document — rate limiting, CORS, input validation improvements, and auth centralization.

---

## 1. Test Rewrite

### Problem

`highlights.test.ts` imports `./routers` (a tRPC `appRouter`) and `./_core/context` (`TrpcContext`). Both were removed when the backend was migrated to Vercel serverless handlers. All 12 tests currently fail with `Cannot find module '/routers'`.

### Approach

Rewrite `highlights.test.ts` to test the Vercel handler functions directly.

**Test helpers:**
- `makeReq(overrides)` — returns a plain object typed as `VercelRequest` (`{ method, headers, query, body }`)
- `makeRes()` — returns a mock response object with `.status(code)` and `.json(data)` that record the last-called values for assertion

**Mocks:**
- `vi.mock("../../src/lib/db", ...)` — mock the Drizzle `db` object's `.select()`, `.insert()`, `.update()`, `.delete()` chain
- `vi.mock("../../src/lib/auth", ...)` — mock `verifyJwt` to return a valid payload (`{ userId: 1, username: "testuser" }`) by default, or `null` to simulate unauthenticated requests

**Test coverage (16 tests total):**

*Existing 12 (rewritten):*
1. `POST /api/highlights` — creates highlight and returns it
2. `POST /api/highlights` — rejects empty text (400)
3. `POST /api/highlights` — rejects invalid URL (400)
4. `GET /api/highlights` — returns paginated list
5. `GET /api/highlights?search=supabase` — filters by search term
6. `GET /api/highlights?search=zzznomatch` — returns empty result
7. `GET /api/highlights/export?format=json` — JSON with correct structure
8. `GET /api/highlights/export?format=markdown` — Markdown with correct headings
9. `POST /api/tags` — creates tag with name and color
10. `POST /api/tags` — rejects invalid hex color
11. `POST /api/auth/logout` — clears cookie and returns `{ success: true }`
12. `POST /api/auth/login` — rejects wrong password (401)

*New security tests (4):*
13. `POST /api/highlights` — unauthenticated request returns 401
14. `POST /api/highlights` — rejects sourceUrl without http/https scheme (400)
15. `POST /api/auth/login` — 11th request from same IP within window returns 429
16. `GET /api/highlights` — response includes `Access-Control-Allow-Origin` header

---

## 2. Security Additions

### 2a. Rate Limiting — `src/lib/rate-limit.ts`

In-memory sliding window rate limiter using a `Map<string, number[]>` keyed by IP address. Each entry stores an array of timestamps; stale entries outside the window are pruned on each check.

```
interface RateLimitConfig {
  windowMs: number;   // window size in milliseconds
  max: number;        // max requests per window
}

function rateLimit(ip: string, config: RateLimitConfig): { allowed: boolean; remaining: number }
```

Applied limits:
- `POST /api/auth/login` — 10 requests per 60 seconds per IP
- `POST /api/auth/register` — 5 requests per 60 seconds per IP
- `POST /api/extension/save` — 30 requests per 60 seconds per IP

IP is read from `req.headers['x-forwarded-for']` (Vercel sets this) falling back to `'unknown'`.

Handlers return `429 Too Many Requests` with `{ error: "Too many requests, please try again later" }` when the limit is exceeded.

### 2b. CORS — `src/lib/cors.ts`

Helper function `applyCors(req, res)` that:
- Sets `Access-Control-Allow-Origin` to `process.env.CORS_ORIGIN ?? '*'`
- Sets `Access-Control-Allow-Methods: GET, POST, PATCH, DELETE, OPTIONS`
- Sets `Access-Control-Allow-Headers: Content-Type, Authorization`
- If `req.method === 'OPTIONS'`, responds immediately with 204 and returns `true` (caller should return early)

Applied to: all API handlers.

### 2c. Auth Centralization — `src/lib/auth.ts`

Add `getAuthUserIdFromReq(req: VercelRequest): Promise<number | null>` to the existing auth lib. This consolidates the `parseCookies` + `verifyJwt` pattern that is currently duplicated across 5 handler files (`api/highlights/index.ts`, `api/highlights/[id].ts`, `api/highlights/export.ts`, `api/tags/index.ts`, `api/tokens/index.ts`).

Each of those 5 files will be updated to import and call this helper instead.

### 2d. Input Validation Improvements

| Endpoint | Field | Current | Fix |
|---|---|---|---|
| `POST /api/highlights` | `sourceUrl` | string check only | must start with `http://` or `https://` |
| `POST /api/extension/save` | `sourceUrl` | not validated | must start with `http://` or `https://` (or empty string allowed since extension may not always have URL) |
| `POST /api/extension/save` | `domain` | not validated | max 255 chars |
| `POST /api/tokens` | `label` | not validated | max 128 chars |
| `POST /api/auth/login` | `username` | string check only | max 255 chars |
| `POST /api/auth/login` | `password` | string check only | max 1024 chars |

---

## Files Changed

**New files:**
- `src/lib/rate-limit.ts`
- `src/lib/cors.ts`

**Modified files:**
- `src/lib/auth.ts` — add `getAuthUserIdFromReq`
- `highlights.test.ts` — full rewrite
- `api/highlights/index.ts` — use shared auth helper, add CORS, add URL validation
- `api/highlights/[id].ts` — use shared auth helper, add CORS
- `api/highlights/export.ts` — use shared auth helper, add CORS
- `api/tags/index.ts` — use shared auth helper, add CORS
- `api/tokens/index.ts` — use shared auth helper, add CORS, add label length validation
- `api/auth/login.ts` — add rate limiting, add CORS, add input length limits
- `api/auth/register.ts` — add rate limiting, add CORS, add input length limits
- `api/extension/save.ts` — add rate limiting, add CORS, add URL/domain validation
- `api/extension/recent.ts` — add CORS

---

## Out of Scope

- Redis-based persistent rate limiting (future upgrade path)
- Supabase RLS (not applicable — project uses Neon + Drizzle with userId-scoped queries)
- File upload security (no file uploads in this app)
- Package audit (no hallucinated/deprecated packages found)
