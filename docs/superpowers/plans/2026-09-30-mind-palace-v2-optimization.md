# Mind Palace v2.0 — Optimization & Feature Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Consolidate Vercel functions (12→9), fix critical security vulnerabilities, add admin dashboard, improve password reset with email OTP, add PDF highlighting to Chrome extension, add account portability, and ship quality-of-life features.

**Architecture:** Vercel Serverless Functions (Node.js) with Drizzle ORM + Neon PostgreSQL. React 18 + TypeScript + Tailwind + Vite frontend with Wouter routing. Chrome MV3 extension. Functions are consolidated using `?action=` query param multiplexing to stay under the 12-function Hobby plan limit.

**Tech Stack:** TypeScript, React 18, Tailwind CSS, Vite, Drizzle ORM, Neon PostgreSQL, Vercel Serverless, Resend email, Chrome MV3, `@upstash/redis` + `@upstash/ratelimit`, `jose` (JWT), `bcryptjs`

**Repo:** `M:\AI\Knowledge_Area51` — GitHub: `https://github.com/aman161upadhyay/mindpalace.git`
**Live URL:** `https://mindpalace-amanupadhyay.vercel.app`

---

## Pre-Flight: Push to GitHub & Sync

Before starting any implementation work, the local repo is 2 commits ahead of GitHub (the v1.2 features and the playbook docs). Push these first.

- [ ] **Step 1: Push existing commits to GitHub**

```bash
cd M:\AI\Knowledge_Area51
git push origin main
```

Expected: 2 commits pushed (6c2c25f, d7b5633)

- [ ] **Step 2: Run the Notion migration on Neon**

Open https://console.neon.tech, select the Mind Palace project, open SQL Editor, and run:

```sql
ALTER TABLE users ADD COLUMN IF NOT EXISTS notion_token VARCHAR(255);
ALTER TABLE users ADD COLUMN IF NOT EXISTS notion_database_id VARCHAR(255);
ALTER TABLE users ADD COLUMN IF NOT EXISTS notion_last_sync TIMESTAMP;
```

This enables the Notion features that were deployed in v1.2 but never had their migration run.

---

## Phase 1: API Consolidation + Security Fixes

### Task 1: Consolidate Auth Endpoints (12→9 functions)

**Files:**
- Create: `api/auth/index.ts` (new consolidated handler)
- Delete: `api/auth/login.ts`
- Delete: `api/auth/logout.ts`
- Delete: `api/auth/register.ts`
- Delete: `api/auth/reset-password.ts`
- Modify: `vercel.json` (add rewrite for highlights path param)
- Delete: `api/highlights/[id].ts`
- Create: `api/extension/index.ts` (new consolidated handler)
- Delete: `api/extension/save.ts`
- Delete: `api/extension/recent.ts`

- [ ] **Step 1: Create consolidated `api/auth/index.ts`**

This file merges login, logout, register, and reset-password into a single function using `?action=` routing. All four are POST-only unauthenticated endpoints.

```typescript
import type { VercelRequest, VercelResponse } from "@vercel/node";
import bcrypt from "bcryptjs";
import { randomBytes } from "crypto";
import { eq, or, and } from "drizzle-orm";
import { db } from "../../src/lib/db";
import { users, apiTokens } from "../../src/schema";
import { signJwt, setSessionCookie, clearSessionCookie } from "../../src/lib/auth";
import { applyCors } from "../../src/lib/cors";
import { rateLimit, getClientIp } from "../../src/lib/rate-limit";

export default async function handler(req: VercelRequest, res: VercelResponse) {
  if (applyCors(req, res)) return;
  if (req.method !== "POST") return res.status(405).json({ error: "Method not allowed" });

  const action = (req.query.action as string) || "";
  const ip = getClientIp(req.headers);

  switch (action) {
    case "login": return handleLogin(req, res, ip);
    case "register": return handleRegister(req, res, ip);
    case "logout": return handleLogout(req, res);
    case "reset-password": return handleResetPassword(req, res, ip);
    default: return res.status(400).json({ error: "Invalid action. Use ?action=login|register|logout|reset-password" });
  }
}

async function handleLogin(req: VercelRequest, res: VercelResponse, ip: string) {
  const { allowed } = rateLimit(ip, { windowMs: 60_000, max: 10 });
  if (!allowed) return res.status(429).json({ error: "Too many requests, please try again later" });

  try {
    const { username, password } = req.body ?? {};
    if (!username || typeof username !== "string" || username.length > 255)
      return res.status(400).json({ error: "Username or email is required" });
    if (!password || typeof password !== "string" || password.length > 1024)
      return res.status(400).json({ error: "Password is required" });

    const trimmedLogin = username.trim().toLowerCase();
    const found = await db.select().from(users).where(or(eq(users.username, trimmedLogin), eq(users.email, trimmedLogin))).limit(1);
    if (found.length === 0) return res.status(401).json({ error: "Invalid username or password" });

    const user = found[0];
    const valid = await bcrypt.compare(password, user.passwordHash);
    if (!valid) return res.status(401).json({ error: "Invalid username or password" });
    // Added in Task 4 once the `disabled` column exists:
    // if (user.disabled) return res.status(403).json({ error: "This account has been disabled" });

    const existingTokens = await db.select().from(apiTokens).where(eq(apiTokens.userId, user.id)).limit(1);
    let apiToken: string;
    if (existingTokens.length === 0) {
      const tokenValue = `hc_${randomBytes(20).toString("hex")}`;
      await db.insert(apiTokens).values({ userId: user.id, token: tokenValue, label: "Chrome Extension" });
      apiToken = tokenValue;
    } else {
      apiToken = existingTokens[0].token;
    }

    const jwt = await signJwt({ userId: user.id, username: user.username });
    res.setHeader("Set-Cookie", setSessionCookie(jwt));
    return res.status(200).json({
      user: { id: user.id, username: user.username, email: user.email, theme: user.theme },
      apiToken,
    });
  } catch (err: unknown) {
    console.error("[auth/login] Error:", err);
    return res.status(500).json({ error: "Internal server error" });
  }
}

async function handleRegister(req: VercelRequest, res: VercelResponse, ip: string) {
  const { allowed } = rateLimit(ip, { windowMs: 60_000, max: 5 });
  if (!allowed) return res.status(429).json({ error: "Too many requests, please try again later" });

  try {
    const { username, email, password } = req.body ?? {};
    if (!username || typeof username !== "string" || username.length < 2 || username.length > 64)
      return res.status(400).json({ error: "Username must be 2-64 characters" });
    if (!email || typeof email !== "string" || !email.includes("@") || email.length > 255)
      return res.status(400).json({ error: "Valid email is required" });
    if (!password || typeof password !== "string" || password.length < 8)
      return res.status(400).json({ error: "Password must be at least 8 characters" });

    const trimmedUsername = username.trim().toLowerCase();
    const trimmedEmail = email.trim().toLowerCase();

    const existingByUsername = await db.select({ id: users.id }).from(users).where(eq(users.username, trimmedUsername)).limit(1);
    if (existingByUsername.length > 0) return res.status(409).json({ error: "Username already taken" });

    const existingByEmail = await db.select({ id: users.id }).from(users).where(eq(users.email, trimmedEmail)).limit(1);
    if (existingByEmail.length > 0) return res.status(409).json({ error: "Email already registered" });

    const passwordHash = await bcrypt.hash(password, 12);
    const inserted = await db.insert(users).values({ username: trimmedUsername, email: trimmedEmail, passwordHash, dailyEmailEnabled: false }).returning({ id: users.id, username: users.username, email: users.email, theme: users.theme });
    const user = inserted[0];

    const tokenValue = `hc_${randomBytes(20).toString("hex")}`;
    await db.insert(apiTokens).values({ userId: user.id, token: tokenValue, label: "Chrome Extension" });

    const jwt = await signJwt({ userId: user.id, username: user.username });
    res.setHeader("Set-Cookie", setSessionCookie(jwt));
    return res.status(201).json({ user: { id: user.id, username: user.username, email: user.email, theme: user.theme }, apiToken: tokenValue });
  } catch (err: unknown) {
    const errMsg = err instanceof Error ? err.message : String(err);
    if (errMsg.includes("unique") || errMsg.includes("duplicate") || errMsg.includes("23505")) {
      return res.status(409).json({ error: "Username or email already taken" });
    }
    console.error("[auth/register] Error:", err);
    return res.status(500).json({ error: "Internal server error" });
  }
}

async function handleLogout(_req: VercelRequest, res: VercelResponse) {
  res.setHeader("Set-Cookie", clearSessionCookie());
  return res.status(200).json({ success: true });
}

async function handleResetPassword(req: VercelRequest, res: VercelResponse, ip: string) {
  const { allowed } = rateLimit(ip, { windowMs: 60_000, max: 5 });
  if (!allowed) return res.status(429).json({ error: "Too many attempts. Please wait a minute and try again." });

  try {
    const { username, email, newPassword } = req.body ?? {};
    if (!username || typeof username !== "string" || username.length > 255)
      return res.status(400).json({ error: "Username is required" });
    if (!email || typeof email !== "string" || email.length > 255)
      return res.status(400).json({ error: "Email is required" });
    if (!newPassword || typeof newPassword !== "string" || newPassword.length < 8 || newPassword.length > 1024)
      return res.status(400).json({ error: "New password must be at least 8 characters" });

    const trimmedUsername = username.trim().toLowerCase();
    const trimmedEmail = email.trim().toLowerCase();

    const found = await db.select().from(users).where(and(eq(users.username, trimmedUsername), eq(users.email, trimmedEmail))).limit(1);
    if (found.length === 0) return res.status(400).json({ error: "Invalid credentials — please check your username and email" });

    const user = found[0];
    const newHash = await bcrypt.hash(newPassword, 12);
    await db.update(users).set({ passwordHash: newHash, updatedAt: new Date() }).where(eq(users.id, user.id));

    return res.status(200).json({ success: true, message: "Password has been reset. You can now sign in." });
  } catch (err: unknown) {
    console.error("[auth/reset-password] Error:", err);
    return res.status(500).json({ error: "Internal server error" });
  }
}
```

- [ ] **Step 2: Update frontend to use new auth routes**

The frontend calls `/api/auth/login`, `/api/auth/register`, `/api/auth/logout`, and `/api/auth/reset-password`. These must change to `?action=` format.

In `src/pages/Login.tsx`, find the fetch call and change:
```typescript
// OLD:
const res = await fetch("/api/auth/login", { ... });
// NEW:
const res = await fetch("/api/auth?action=login", { ... });
```

In `src/pages/Register.tsx` (or wherever registration is handled):
```typescript
// OLD:
const res = await fetch("/api/auth/register", { ... });
// NEW:
const res = await fetch("/api/auth?action=register", { ... });
```

In `src/contexts/AuthContext.tsx` (or wherever logout is called):
```typescript
// OLD:
await fetch("/api/auth/logout", { ... });
// NEW:
await fetch("/api/auth?action=logout", { ... });
```

In `src/pages/ForgotPassword.tsx`:
```typescript
// OLD:
const res = await fetch("/api/auth/reset-password", { ... });
// NEW:
const res = await fetch("/api/auth?action=reset-password", { ... });
```

Search the entire `src/` directory for all occurrences:
```bash
grep -rn "/api/auth/login\|/api/auth/register\|/api/auth/logout\|/api/auth/reset-password" src/
```

Update every occurrence.

- [ ] **Step 3: Create consolidated `api/extension/index.ts`**

Merge `save.ts` (POST) and `recent.ts` (GET) into one file:

```typescript
import type { VercelRequest, VercelResponse } from "@vercel/node";
import { desc, eq } from "drizzle-orm";
import { db } from "../../src/lib/db";
import { apiTokens, highlights } from "../../src/schema";
import { inferTags } from "../../src/lib/keyword-tags";
import { applyCors } from "../../src/lib/cors";
import { rateLimit, getClientIp } from "../../src/lib/rate-limit";

export default async function handler(req: VercelRequest, res: VercelResponse) {
  if (applyCors(req, res)) return;

  if (req.method === "GET") return handleRecent(req, res);
  if (req.method === "POST") return handleSave(req, res);
  return res.status(405).json({ error: "Method not allowed" });
}

async function handleRecent(req: VercelRequest, res: VercelResponse) {
  try {
    const authHeader = req.headers.authorization || "";
    const apiToken = authHeader.startsWith("Bearer ") ? authHeader.slice(7) : "";
    if (!apiToken) return res.status(401).json({ error: "API token is required" });

    const tokenRows = await db.select().from(apiTokens).where(eq(apiTokens.token, apiToken)).limit(1);
    if (tokenRows.length === 0) return res.status(401).json({ error: "Invalid API token" });

    const userId = tokenRows[0].userId;
    const recent = await db.select().from(highlights).where(eq(highlights.userId, userId)).orderBy(desc(highlights.createdAt)).limit(5);
    return res.status(200).json(recent);
  } catch (err: unknown) {
    console.error("[extension/recent] Error:", err);
    return res.status(500).json({ error: "Internal server error" });
  }
}

async function handleSave(req: VercelRequest, res: VercelResponse) {
  const ip = getClientIp(req.headers);
  const { allowed } = rateLimit(ip, { windowMs: 60_000, max: 30 });
  if (!allowed) return res.status(429).json({ error: "Too many requests, please try again later" });

  try {
    const { apiToken, text, sourceUrl, pageTitle, domain } = req.body ?? {};
    if (!apiToken || typeof apiToken !== "string") return res.status(401).json({ error: "API token is required" });

    const tokenRows = await db.select().from(apiTokens).where(eq(apiTokens.token, apiToken)).limit(1);
    if (tokenRows.length === 0) return res.status(401).json({ error: "Invalid API token" });

    const userId = tokenRows[0].userId;
    if (!text || typeof text !== "string" || text.length === 0) return res.status(400).json({ error: "Text is required" });
    if (text.length > 50000) return res.status(400).json({ error: "Text exceeds 50,000 character limit" });

    const rawUrl = typeof sourceUrl === "string" ? sourceUrl : "";
    if (rawUrl && !/^https?:\/\//i.test(rawUrl)) return res.status(400).json({ error: "Source URL must start with http:// or https://" });

    const rawDomain = typeof domain === "string" ? domain : "";
    if (rawDomain.length > 255) return res.status(400).json({ error: "Domain must be 255 characters or fewer" });

    const metadataTags = inferTags(text);
    const inserted = await db.insert(highlights).values({
      userId, text, sourceUrl: rawUrl, pageTitle: (pageTitle as string) || "",
      domain: rawDomain, notes: null, tagIds: "[]", metadataTags: JSON.stringify(metadataTags),
    }).returning();

    return res.status(201).json(inserted[0]);
  } catch (err: unknown) {
    console.error("[extension/save] Error:", err);
    return res.status(500).json({ error: "Internal server error" });
  }
}
```

- [ ] **Step 4: Update extension `background.js` to use new API path**

In `extension/background.js`, find the save endpoint URL and update:
```javascript
// OLD: /api/extension/save
// NEW: /api/extension
// (POST method is the same, no query param needed — method dispatch handles it)
```

Also find the recent endpoint URL:
```javascript
// OLD: /api/extension/recent
// NEW: /api/extension
// (GET method is the same)
```

Search for all occurrences:
```bash
grep -n "extension/save\|extension/recent" extension/background.js
```

- [ ] **Step 5: Update `vercel.json` — add highlights rewrite, remove old routes**

Add a rewrite for `/api/highlights/:id` to the query param pattern (replacing the deleted `[id].ts`):

```json
{
  "crons": [
    { "path": "/api/cron/daily-highlights", "schedule": "0 13 * * *" }
  ],
  "headers": [
    {
      "source": "/api/(.*)",
      "headers": [
        { "key": "Access-Control-Allow-Origin", "value": "https://mindpalace-amanupadhyay.vercel.app" },
        { "key": "Access-Control-Allow-Credentials", "value": "true" },
        { "key": "Access-Control-Allow-Methods", "value": "GET, POST, PATCH, DELETE, OPTIONS" },
        { "key": "Access-Control-Allow-Headers", "value": "Content-Type, Authorization" }
      ]
    }
  ],
  "rewrites": [
    { "source": "/api/auth/login", "destination": "/api/auth?action=login" },
    { "source": "/api/auth/register", "destination": "/api/auth?action=register" },
    { "source": "/api/auth/logout", "destination": "/api/auth?action=logout" },
    { "source": "/api/auth/reset-password", "destination": "/api/auth?action=reset-password" },
    { "source": "/api/extension/save", "destination": "/api/extension" },
    { "source": "/api/extension/recent", "destination": "/api/extension" },
    { "source": "/api/highlights/:id(\\d+)", "destination": "/api/highlights?id=:id" },
    { "source": "/api/tags/:id", "destination": "/api/tags?id=:id" },
    { "source": "/api/tokens/:id", "destination": "/api/tokens?id=:id" },
    { "source": "/api/(.*)", "destination": "/api/$1" },
    { "source": "/(.*)", "destination": "/index.html" }
  ]
}
```

Note: The old path rewrites ensure backwards compatibility — any existing extension versions or bookmarked URLs still work.

- [ ] **Step 6: Delete old files**

```bash
rm api/auth/login.ts api/auth/logout.ts api/auth/register.ts api/auth/reset-password.ts
rm api/extension/save.ts api/extension/recent.ts
rm "api/highlights/[id].ts"
```

- [ ] **Step 7: Verify build succeeds**

```bash
npx tsc --noEmit
npx vite build
```

Expected: No TypeScript errors, Vite build succeeds.

- [ ] **Step 8: Verify function count**

```bash
find api -name "*.ts" | wc -l
```

Expected: exactly **7** at this point (auth/index.ts, auth/me.ts, highlights/index.ts, tags/index.ts, tokens/index.ts, extension/index.ts, cron/daily-highlights.ts). It becomes 9 after Tasks 6 and 10 add admin and account. Never put helper `.ts` files under `api/` — Vercel counts every file there as a function; helpers go in `src/lib/`.

- [ ] **Step 9: Commit**

```bash
git add -A
git commit -m "refactor: consolidate API functions 12→7 for Vercel Hobby limit

Merge login/register/logout/reset-password into api/auth/index.ts
Merge extension save/recent into api/extension/index.ts
Delete duplicate api/highlights/[id].ts (handled by ?id= param)
Add vercel.json rewrites for backwards compatibility

Co-Authored-By: Claude Opus 4.6 <noreply@anthropic.com>"
```

---

### Task 2: Fix XSS in Email Templates

**Files:**
- Create: `src/lib/html-escape.ts`
- Modify: `api/cron/daily-highlights.ts`

- [ ] **Step 1: Create HTML escape utility**

```typescript
// src/lib/html-escape.ts
export function escapeHtml(str: string): string {
  return str
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#39;");
}
```

- [ ] **Step 2: Update email template in `api/cron/daily-highlights.ts`**

Add import at line 1 area:
```typescript
import { escapeHtml } from "../../src/lib/html-escape";
```

In `buildEmailHtml()`, escape all interpolated user content. Replace lines 17-32:

```typescript
function buildEmailHtml(username: string, items: any[]): string {
  const highlightCards = items
    .map(
      (h) => `
    <div style="margin-bottom:20px;padding:16px 20px;background:#f8f7f4;border-left:3px solid #6366f1;border-radius:6px;">
      <p style="margin:0 0 8px;font-style:italic;color:#1a1a2e;line-height:1.6;font-size:15px;">
        "${escapeHtml(h.text)}"
      </p>
      <p style="margin:0;font-size:12px;color:#666;">
        ${h.pageTitle ? `<span>${escapeHtml(h.pageTitle)}</span>` : ""}
        ${h.domain ? `<span style="color:#999;"> · ${escapeHtml(h.domain)}</span>` : ""}
      </p>
      ${h.notes ? `<p style="margin:8px 0 0;font-size:13px;color:#555;background:#fff;padding:8px 12px;border-radius:4px;">📝 ${escapeHtml(h.notes)}</p>` : ""}
    </div>
  `
    )
    .join("");
```

And escape `username` on line 49:
```typescript
      Good morning, <strong>${escapeHtml(username)}</strong>. Here are 5 highlights from your collection to revisit today:
```

Also fix the hardcoded fallback URL on line 56-57. Replace:
```typescript
      <a href="${process.env.DASHBOARD_URL || 'https://mindpalace-bice.vercel.app'}"
```
with:
```typescript
      <a href="${process.env.CORS_ORIGIN || 'https://mindpalace-amanupadhyay.vercel.app'}"
```

Both occurrences (the link and the Settings link).

- [ ] **Step 3: Commit**

```bash
git add src/lib/html-escape.ts api/cron/daily-highlights.ts
git commit -m "fix: escape user content in email templates to prevent XSS

Co-Authored-By: Claude Opus 4.6 <noreply@anthropic.com>"
```

---

### Task 3: Replace In-Memory Rate Limiter with Upstash Redis

**Files:**
- Modify: `package.json` (add dependencies)
- Modify: `src/lib/rate-limit.ts` (rewrite)

**Prerequisites:** Create an Upstash Redis instance via the Vercel Marketplace:
1. Go to https://vercel.com/amanupadhyay/mindpalace/integrations
2. Click "Browse Marketplace" → search "Upstash Redis"
3. Create a free-tier instance (10K commands/day)
4. It auto-adds `UPSTASH_REDIS_REST_URL` and `UPSTASH_REDIS_REST_TOKEN` env vars

- [ ] **Step 1: Install Upstash dependencies**

```bash
npm install @upstash/redis @upstash/ratelimit
```

- [ ] **Step 2: Rewrite `src/lib/rate-limit.ts`**

```typescript
import { Ratelimit } from "@upstash/ratelimit";
import { Redis } from "@upstash/redis";

export interface RateLimitConfig {
  windowMs: number;
  max: number;
}

export interface RateLimitResult {
  allowed: boolean;
  remaining: number;
}

let redis: Redis | null = null;

function getRedis(): Redis | null {
  if (redis) return redis;
  const url = process.env.UPSTASH_REDIS_REST_URL;
  const token = process.env.UPSTASH_REDIS_REST_TOKEN;
  if (!url || !token) return null;
  redis = new Redis({ url, token });
  return redis;
}

// In-memory fallback for local dev (when Redis env vars aren't set)
const memStore = new Map<string, number[]>();

function memRateLimit(ip: string, config: RateLimitConfig): RateLimitResult {
  const now = Date.now();
  const windowStart = now - config.windowMs;
  const timestamps = (memStore.get(ip) ?? []).filter((t) => t > windowStart);
  const allowed = timestamps.length < config.max;
  if (allowed) timestamps.push(now);
  if (timestamps.length > 0) memStore.set(ip, timestamps);
  else memStore.delete(ip);
  return { allowed, remaining: Math.max(0, config.max - timestamps.length) };
}

export async function rateLimit(ip: string, config: RateLimitConfig): Promise<RateLimitResult> {
  const r = getRedis();
  if (!r) return memRateLimit(ip, config);

  const limiter = new Ratelimit({
    redis: r,
    limiter: Ratelimit.slidingWindow(config.max, `${Math.round(config.windowMs / 1000)} s`),
    // Prefix includes the config so endpoints with different limits don't share counters
    prefix: `rl:${config.max}:${config.windowMs}`,
  });

  const { success, remaining } = await limiter.limit(ip);
  return { allowed: success, remaining };
}

export function getClientIp(headers: Record<string, string | string[] | undefined>): string {
  const forwarded = headers["x-forwarded-for"];
  if (typeof forwarded === "string") return forwarded.split(",")[0]?.trim() ?? "unknown";
  if (Array.isArray(forwarded)) return forwarded[0]?.trim() ?? "unknown";
  return "unknown";
}
```

**IMPORTANT:** The `rateLimit` function is now **async**. Every caller must be updated to `await` it.

- [ ] **Step 3: Update all callers to await rateLimit**

Search for all callers:
```bash
grep -rn "rateLimit(" api/ src/
```

In every file that calls `rateLimit()`, change:
```typescript
// OLD:
const { allowed } = rateLimit(ip, { windowMs: 60_000, max: 10 });
// NEW:
const { allowed } = await rateLimit(ip, { windowMs: 60_000, max: 10 });
```

Files to update:
- `api/auth/index.ts` — 3 occurrences (login, register, reset-password)
- `api/highlights/index.ts` — search for `rateLimit(`
- `api/extension/index.ts` — 1 occurrence (save)

- [ ] **Step 4: Verify build**

```bash
npx tsc --noEmit
```

- [ ] **Step 5: Commit**

```bash
git add package.json package-lock.json src/lib/rate-limit.ts api/
git commit -m "fix: replace in-memory rate limiter with Upstash Redis

Falls back to in-memory for local dev when Redis env vars aren't set.

Co-Authored-By: Claude Opus 4.6 <noreply@anthropic.com>"
```

---

### Task 4: Add JWT Revocation via tokenVersion

**Files:**
- Modify: `src/schema.ts` (add `tokenVersion` column)
- Modify: `src/lib/auth.ts` (include tokenVersion in JWT, verify on check)
- Create: `drizzle/0003_admin_and_security.sql`
- Modify: `api/auth/index.ts` (increment on logout + password reset)
- Modify: `api/auth/me.ts` (verify tokenVersion)

- [ ] **Step 1: Create migration `drizzle/0003_admin_and_security.sql`**

```sql
-- Phase 1: Security + Admin
ALTER TABLE users ADD COLUMN IF NOT EXISTS role VARCHAR(16) DEFAULT 'user';
ALTER TABLE users ADD COLUMN IF NOT EXISTS token_version INTEGER DEFAULT 0;
ALTER TABLE users ADD COLUMN IF NOT EXISTS disabled BOOLEAN DEFAULT false;
ALTER TABLE users ADD COLUMN IF NOT EXISTS last_active TIMESTAMP;

-- Password reset tokens table
CREATE TABLE IF NOT EXISTS password_reset_tokens (
  id SERIAL PRIMARY KEY,
  user_id INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  code VARCHAR(6) NOT NULL,
  expires_at TIMESTAMP NOT NULL,
  used BOOLEAN DEFAULT false,
  created_at TIMESTAMP DEFAULT NOW()
);

-- Seed admin
UPDATE users SET role = 'admin' WHERE username = 'aupadhyay';
```

- [ ] **Step 2: Update `src/schema.ts`**

Add the new columns to the users table definition (after `notionLastSync`):

```typescript
  // Admin & security
  role: varchar("role", { length: 16 }).notNull().default("user"),
  tokenVersion: integer("token_version").notNull().default(0),
  disabled: boolean("disabled").notNull().default(false),
  lastActive: timestamp("last_active"),
```

Add password_reset_tokens table:

```typescript
// ─── Password Reset Tokens ────────────────────────────────────────────────

export const passwordResetTokens = pgTable("password_reset_tokens", {
  id: serial("id").primaryKey(),
  userId: integer("user_id").notNull().references(() => users.id, { onDelete: "cascade" }),
  code: varchar("code", { length: 6 }).notNull(),
  expiresAt: timestamp("expires_at").notNull(),
  used: boolean("used").notNull().default(false),
  createdAt: timestamp("created_at").defaultNow().notNull(),
});

export type PasswordResetToken = typeof passwordResetTokens.$inferSelect;
```

- [ ] **Step 3: Update `src/lib/auth.ts` — include tokenVersion in JWT**

Update the JwtPayload interface:
```typescript
interface JwtPayload {
  userId: number;
  username: string;
  tokenVersion?: number;
}
```

Update `signJwt`:
```typescript
export async function signJwt(payload: JwtPayload): Promise<string> {
  return new SignJWT({
    userId: payload.userId,
    username: payload.username,
    tv: payload.tokenVersion ?? 0,
  })
    .setProtectedHeader({ alg: "HS256" })
    .setIssuedAt()
    .setExpirationTime("30d")
    .sign(getSecret());
}
```

Update `verifyJwt` to return tokenVersion:
```typescript
export async function verifyJwt(token: string): Promise<JwtPayload | null> {
  try {
    const { payload } = await jwtVerify(token, getSecret());
    if (typeof payload.userId === "number" && typeof payload.username === "string") {
      return {
        userId: payload.userId,
        username: payload.username,
        tokenVersion: typeof payload.tv === "number" ? payload.tv : 0,
      };
    }
    return null;
  } catch {
    return null;
  }
}
```

Add a `verifyTokenVersion` helper that callers use after `verifyJwt`:
```typescript
import { eq } from "drizzle-orm";
import { db } from "./db";
import { users } from "../schema";

export async function verifyTokenVersion(payload: JwtPayload): Promise<boolean> {
  try {
    const found = await db.select({ tokenVersion: users.tokenVersion }).from(users).where(eq(users.id, payload.userId)).limit(1);
    if (found.length === 0) return false;
    return found[0].tokenVersion === (payload.tokenVersion ?? 0);
  } catch {
    // Column doesn't exist yet (migration not run) — accept all tokens
    return true;
  }
}
```

- [ ] **Step 4: Update `api/auth/me.ts` to verify tokenVersion**

After the existing `verifyJwt` call (around line 33), add:
```typescript
  const { verifyTokenVersion } = await import("../../src/lib/auth");
  const validVersion = await verifyTokenVersion(payload);
  if (!validVersion) {
    return res.status(401).json({ error: "Session expired — please sign in again" });
  }
```

Note: use try/catch or the graceful pattern already in me.ts so this doesn't break if the migration hasn't been run yet.

- [ ] **Step 5: Update `api/auth/index.ts` — increment tokenVersion on logout and password reset**

In `handleLogout`, before clearing the cookie, increment the user's tokenVersion:
```typescript
async function handleLogout(req: VercelRequest, res: VercelResponse) {
  // Increment tokenVersion to invalidate all existing sessions
  const cookieHeader = (req.headers.cookie as string) ?? "";
  const cookies: Record<string, string> = {};
  for (const pair of cookieHeader.split(";")) {
    const [key, ...rest] = pair.split("=");
    const k = key?.trim();
    if (k) cookies[k] = decodeURIComponent(rest.join("=").trim());
  }
  const token = cookies["hc_session"];
  if (token) {
    const payload = await verifyJwt(token);
    if (payload) {
      try {
        await db.update(users).set({ tokenVersion: sql`COALESCE(token_version, 0) + 1` }).where(eq(users.id, payload.userId));
      } catch { /* migration not run yet */ }
    }
  }

  res.setHeader("Set-Cookie", clearSessionCookie());
  return res.status(200).json({ success: true });
}
```

Add `import { sql } from "drizzle-orm";` and `import { verifyJwt } from "../../src/lib/auth";` at the top.

In `handleResetPassword`, after updating the password hash:
```typescript
    // Invalidate all existing sessions
    try {
      await db.update(users).set({ tokenVersion: sql`COALESCE(token_version, 0) + 1` }).where(eq(users.id, user.id));
    } catch { /* migration not run yet */ }
```

In `handleLogin`, include tokenVersion in the JWT:
```typescript
    // Fetch tokenVersion for JWT
    let tokenVersion = 0;
    try {
      const tv = await db.select({ tokenVersion: users.tokenVersion }).from(users).where(eq(users.id, user.id)).limit(1);
      if (tv[0]?.tokenVersion != null) tokenVersion = tv[0].tokenVersion;
    } catch { /* migration not run */ }

    const jwt = await signJwt({ userId: user.id, username: user.username, tokenVersion });
```

- [ ] **Step 6: Enforce `disabled` on login and in `verifyTokenVersion`**

In `handleLogin`, uncomment the line `if (user.disabled) return res.status(403)...`.

In `src/lib/auth.ts`, change `verifyTokenVersion` so disabled users are rejected everywhere:
```typescript
    const found = await db.select({ tokenVersion: users.tokenVersion, disabled: users.disabled }).from(users).where(eq(users.id, payload.userId)).limit(1);
    if (found.length === 0 || found[0].disabled) return false;
    return found[0].tokenVersion === (payload.tokenVersion ?? 0);
```

Also call `verifyTokenVersion` in `src/lib/auth.ts`'s `getAuthUserIdFromVercelReq()` (used by highlights/tags/tokens handlers) so revoked sessions are rejected on every endpoint, not just `/me`. Return `null` when it fails.

- [ ] **Step 7: Build and commit**

```bash
npx tsc --noEmit
git add -A
git commit -m "feat: add JWT revocation via tokenVersion

Logout and password reset now invalidate all existing sessions.
Gracefully degrades if migration hasn't been run yet.

Co-Authored-By: Claude Opus 4.6 <noreply@anthropic.com>"
```

---

### Task 5: Deploy Phase 1

- [ ] **Step 1: Run migration on Neon**

Open https://console.neon.tech, SQL Editor, and run the contents of `drizzle/0003_admin_and_security.sql`.

- [ ] **Step 2: Add Upstash Redis via Vercel Marketplace**

Go to https://vercel.com/amanupadhyay/mindpalace/integrations, add Upstash Redis (free tier). This auto-sets `UPSTASH_REDIS_REST_URL` and `UPSTASH_REDIS_REST_TOKEN`.

- [ ] **Step 3: Deploy**

```bash
git push origin main
# OR: vercel deploy --prod --yes
```

- [ ] **Step 4: Smoke test**

Visit https://mindpalace-amanupadhyay.vercel.app, test:
1. Login works (`/api/auth?action=login`)
2. Logout works (`/api/auth?action=logout`)
3. Registration works
4. Forgot password flow works
5. Highlights load
6. Export works

---

## Phase 2: Admin Dashboard + Password Reset OTP

### Task 6: Admin API Endpoint

**Files:**
- Create: `api/admin/index.ts`
- Modify: `src/schema.ts` (already done in Task 4)

- [ ] **Step 1: Create `api/admin/index.ts`**

```typescript
import type { VercelRequest, VercelResponse } from "@vercel/node";
import bcrypt from "bcryptjs";
import { eq, sql, desc, count } from "drizzle-orm";
import { db } from "../../src/lib/db";
import { users, highlights, tags, apiTokens } from "../../src/schema";
import { verifyJwt, verifyTokenVersion } from "../../src/lib/auth";
import { applyCors } from "../../src/lib/cors";

function parseCookies(cookieHeader: string): Record<string, string> {
  const cookies: Record<string, string> = {};
  for (const pair of cookieHeader.split(";")) {
    const [key, ...rest] = pair.split("=");
    const k = key?.trim();
    if (k) cookies[k] = decodeURIComponent(rest.join("=").trim());
  }
  return cookies;
}

async function requireAdmin(req: VercelRequest, res: VercelResponse): Promise<number | null> {
  const cookies = parseCookies((req.headers.cookie as string) ?? "");
  const token = cookies["hc_session"];
  if (!token) { res.status(401).json({ error: "Not authenticated" }); return null; }

  const payload = await verifyJwt(token);
  if (!payload) { res.status(401).json({ error: "Invalid session" }); return null; }

  try {
    const valid = await verifyTokenVersion(payload);
    if (!valid) { res.status(401).json({ error: "Session expired" }); return null; }
  } catch { /* migration not run */ }

  // Check admin role
  let role = "user";
  try {
    const found = await db.select({ role: users.role }).from(users).where(eq(users.id, payload.userId)).limit(1);
    if (found[0]) role = found[0].role;
  } catch { /* role column doesn't exist yet */ }

  if (role !== "admin") { res.status(403).json({ error: "Admin access required" }); return null; }
  return payload.userId;
}

export default async function handler(req: VercelRequest, res: VercelResponse) {
  if (applyCors(req, res)) return;

  const adminId = await requireAdmin(req, res);
  if (adminId === null) return;

  const action = (req.query.action as string) || "";

  switch (action) {
    case "users": return handleUsers(req, res);
    case "stats": return handleStats(req, res);
    case "user": return handleUser(req, res, adminId);
    default: return res.status(400).json({ error: "Invalid action. Use ?action=users|stats|user" });
  }
}

async function handleUsers(_req: VercelRequest, res: VercelResponse) {
  try {
    const allUsers = await db
      .select({
        id: users.id,
        username: users.username,
        email: users.email,
        role: users.role,
        disabled: users.disabled,
        theme: users.theme,
        dailyEmailEnabled: users.dailyEmailEnabled,
        createdAt: users.createdAt,
        updatedAt: users.updatedAt,
        lastActive: users.lastActive,
      })
      .from(users)
      .orderBy(desc(users.createdAt));

    // Get highlight counts per user
    const hlCounts = await db
      .select({ userId: highlights.userId, count: count() })
      .from(highlights)
      .groupBy(highlights.userId);

    const hlMap = new Map(hlCounts.map(h => [h.userId, Number(h.count)]));

    // Get tag counts per user
    const tagCounts = await db
      .select({ userId: tags.userId, count: count() })
      .from(tags)
      .groupBy(tags.userId);

    const tagMap = new Map(tagCounts.map(t => [t.userId, Number(t.count)]));

    const enriched = allUsers.map(u => ({
      ...u,
      highlightCount: hlMap.get(u.id) || 0,
      tagCount: tagMap.get(u.id) || 0,
    }));

    return res.status(200).json(enriched);
  } catch (err: unknown) {
    console.error("[admin/users] Error:", err);
    return res.status(500).json({ error: "Internal server error" });
  }
}

async function handleStats(_req: VercelRequest, res: VercelResponse) {
  try {
    const totalUsers = await db.select({ count: count() }).from(users);
    const totalHighlights = await db.select({ count: count() }).from(highlights);
    const totalTags = await db.select({ count: count() }).from(tags);

    // Top domains
    const topDomains = await db
      .select({ domain: highlights.domain, count: count() })
      .from(highlights)
      .where(sql`${highlights.domain} IS NOT NULL AND ${highlights.domain} != ''`)
      .groupBy(highlights.domain)
      .orderBy(desc(count()))
      .limit(20);

    // Highlights by month
    const monthly = await db.execute(
      sql`SELECT TO_CHAR(created_at, 'YYYY-MM') as month, COUNT(*) as count FROM highlights GROUP BY month ORDER BY month`
    );

    // Users by month
    const userGrowth = await db.execute(
      sql`SELECT TO_CHAR(created_at, 'YYYY-MM') as month, COUNT(*) as count FROM users GROUP BY month ORDER BY month`
    );

    return res.status(200).json({
      totalUsers: Number(totalUsers[0].count),
      totalHighlights: Number(totalHighlights[0].count),
      totalTags: Number(totalTags[0].count),
      topDomains,
      highlightsByMonth: monthly.rows || monthly,
      userGrowthByMonth: userGrowth.rows || userGrowth,
    });
  } catch (err: unknown) {
    console.error("[admin/stats] Error:", err);
    return res.status(500).json({ error: "Internal server error" });
  }
}

async function handleUser(req: VercelRequest, res: VercelResponse, _adminId: number) {
  const userId = Number(req.query.id);
  if (!userId || isNaN(userId)) return res.status(400).json({ error: "User ID required (?id=N)" });

  if (req.method === "PATCH") {
    const { role, disabled } = req.body ?? {};
    const updates: Record<string, any> = { updatedAt: new Date() };

    if (userId === _adminId) return res.status(400).json({ error: "You cannot change your own role/status" });
    if (role !== undefined) {
      if (role !== "user" && role !== "admin") return res.status(400).json({ error: "Role must be 'user' or 'admin'" });
      updates.role = role;
    }
    if (disabled !== undefined) {
      if (typeof disabled !== "boolean") return res.status(400).json({ error: "disabled must be boolean" });
      updates.disabled = disabled;
      // Disabling must also kick out existing sessions
      if (disabled) updates.tokenVersion = sql`COALESCE(token_version, 0) + 1`;
    }

    await db.update(users).set(updates).where(eq(users.id, userId));
    return res.status(200).json({ success: true });
  }

  if (req.method === "DELETE") {
    if (userId === _adminId) return res.status(400).json({ error: "You cannot delete your own admin account here" });
    // Cascade delete — FK constraints handle highlights, tags, tokens
    const found = await db.select({ id: users.id }).from(users).where(eq(users.id, userId)).limit(1);
    if (found.length === 0) return res.status(404).json({ error: "User not found" });

    await db.delete(users).where(eq(users.id, userId));
    return res.status(200).json({ success: true, message: "User and all data deleted" });
  }

  if (req.method === "POST") {
    // Force password reset — generate a random password, send via email
    const found = await db.select({ email: users.email }).from(users).where(eq(users.id, userId)).limit(1);
    if (found.length === 0) return res.status(404).json({ error: "User not found" });

    // crypto-secure; Math.random is predictable. Add `import { randomBytes } from "crypto";` at top.
    const tempPassword = `mp_${randomBytes(9).toString("base64url")}`;
    const hash = await bcrypt.hash(tempPassword, 12);
    await db.update(users).set({
      passwordHash: hash,
      tokenVersion: sql`COALESCE(token_version, 0) + 1`,
      updatedAt: new Date(),
    }).where(eq(users.id, userId));

    return res.status(200).json({
      success: true,
      message: `Password reset for user ${userId}. New temporary password: ${tempPassword}`,
      tempPassword,
    });
  }

  return res.status(405).json({ error: "Use PATCH (update), DELETE (remove), or POST (reset password)" });
}
```

- [ ] **Step 2: Commit**

```bash
git add api/admin/index.ts
git commit -m "feat: add admin API — user management, stats, force password reset

Co-Authored-By: Claude Opus 4.6 <noreply@anthropic.com>"
```

---

### Task 7: Admin Dashboard Frontend

**Files:**
- Create: `src/pages/Admin.tsx`
- Modify: `src/App.tsx` (add route)
- Modify: `src/contexts/AuthContext.tsx` (expose role)

This is a large UI task. The admin page should display:
1. Stats cards (total users, total highlights, total tags)
2. User table with columns: username, email, highlights, tags, role, status, created, actions
3. Per-user action buttons: reset password, disable/enable, delete (with confirm)
4. Top domains chart (simple bar list)
5. Growth over time (highlights by month)

The implementation should follow the existing design system — Playfair Display headings, JetBrains Mono labels, same color tokens, same card/border patterns as MindPalace.tsx.

- [ ] **Step 1: Update AuthContext to expose role**

In the user state / GET `/api/auth/me` response, the role field should be included. In `api/auth/me.ts` GET handler, add role to the query (with try/catch for migration):

```typescript
    let role = "user";
    try {
      const roleRow = await db.select({ role: users.role }).from(users).where(eq(users.id, payload.userId)).limit(1);
      if (roleRow[0]?.role) role = roleRow[0].role;
    } catch { /* migration not run */ }

    return res.status(200).json({
      ...found[0],
      role,
      // ... rest of existing fields
    });
```

In `src/contexts/AuthContext.tsx`, add `role` to the user type and state. Add an `isAdmin` derived boolean.

- [ ] **Step 2: Create `src/pages/Admin.tsx`**

Build the admin page. It should:
- Fetch `/api/admin?action=stats` and `/api/admin?action=users` on mount
- Display stats cards at the top
- Display user table with sort and search
- Each row has action buttons: Reset Password, Disable/Enable, Delete
- Actions call the admin API and refresh the list
- Use the same UI patterns as MindPalace.tsx (Tailwind classes, Lucide icons, existing card/modal patterns)

The full component is ~300-400 lines. Key UI elements:
- Stats: `Users`, `Highlights`, `Tags` with large numbers
- Table: responsive, sortable columns
- Modals: confirm dialogs for destructive actions (reuse existing `ConfirmDialog` if available)
- Top domains list
- Monthly activity sparkline or simple list

- [ ] **Step 3: Add route in `src/App.tsx`**

```typescript
import Admin from "./pages/Admin";

// In the router:
<Route path="/admin" component={Admin} />
```

Add admin link to the nav (visible only when `role === "admin"`).

- [ ] **Step 4: Commit**

```bash
git add src/pages/Admin.tsx src/App.tsx src/contexts/AuthContext.tsx api/auth/me.ts
git commit -m "feat: add admin dashboard — user management, stats, top domains

Co-Authored-By: Claude Opus 4.6 <noreply@anthropic.com>"
```

---

### Task 8: Password Reset with Email OTP

**Files:**
- Modify: `api/auth/index.ts` (replace reset-password with OTP flow)
- Modify: `src/pages/ForgotPassword.tsx` (two-step form)
- Modify: `src/schema.ts` (already done — password_reset_tokens)

- [ ] **Step 1: Update `handleResetPassword` in `api/auth/index.ts`**

Replace the existing single-step flow with a two-action OTP flow:

**Action `request-reset`:** User submits email → backend generates 6-digit code, stores in `password_reset_tokens`, sends via Resend.

```typescript
async function handleRequestReset(req: VercelRequest, res: VercelResponse, ip: string) {
  const { allowed } = await rateLimit(ip, { windowMs: 60_000, max: 3 });
  if (!allowed) return res.status(429).json({ error: "Too many attempts. Please wait." });

  const { email } = req.body ?? {};
  if (!email || typeof email !== "string") return res.status(400).json({ error: "Email is required" });

  const trimmedEmail = email.trim().toLowerCase();
  const found = await db.select({ id: users.id, username: users.username }).from(users).where(eq(users.email, trimmedEmail)).limit(1);

  // Always return success to prevent email enumeration
  if (found.length === 0) return res.status(200).json({ success: true, message: "If an account exists with that email, a reset code has been sent." });

  const user = found[0];
  // crypto.randomInt — Math.random is predictable. Add `import { randomInt } from "crypto";` at top.
  const code = String(randomInt(100000, 1000000));
  const expiresAt = new Date(Date.now() + 10 * 60 * 1000); // 10 minutes

  const { passwordResetTokens } = await import("../../src/schema");
  // Invalidate any earlier unused codes so only the newest one works
  await db.update(passwordResetTokens).set({ used: true }).where(and(eq(passwordResetTokens.userId, user.id), eq(passwordResetTokens.used, false)));
  await db.insert(passwordResetTokens).values({ userId: user.id, code, expiresAt, used: false });

  // Send email via Resend
  try {
    const { Resend } = await import("resend");
    const resend = new Resend(process.env.RESEND_API_KEY);
    await resend.emails.send({
      from: "Mind Palace <onboarding@resend.dev>",
      to: trimmedEmail,
      subject: "Mind Palace — Password Reset Code",
      html: `<p>Hi ${escapeHtml(user.username)},</p><p>Your password reset code is: <strong style="font-size:24px;letter-spacing:4px;">${code}</strong></p><p>This code expires in 10 minutes. If you didn't request this, ignore this email.</p>`,
    });
  } catch (err) {
    console.error("[auth/request-reset] Email send failed:", err);
    // Don't fail the request — user should retry
  }

  return res.status(200).json({ success: true, message: "If an account exists with that email, a reset code has been sent." });
}
```

**Action `verify-reset`:** User submits email + code + new password → backend verifies, resets password, increments tokenVersion.

```typescript
async function handleVerifyReset(req: VercelRequest, res: VercelResponse, ip: string) {
  const { allowed } = await rateLimit(ip, { windowMs: 60_000, max: 5 });
  if (!allowed) return res.status(429).json({ error: "Too many attempts." });

  const { email, code, newPassword } = req.body ?? {};
  if (!email || !code || !newPassword) return res.status(400).json({ error: "Email, code, and new password required" });
  if (newPassword.length < 8) return res.status(400).json({ error: "Password must be at least 8 characters" });

  const trimmedEmail = email.trim().toLowerCase();
  const found = await db.select().from(users).where(eq(users.email, trimmedEmail)).limit(1);
  if (found.length === 0) return res.status(400).json({ error: "Invalid code" });

  const user = found[0];
  const { passwordResetTokens } = await import("../../src/schema");

  const tokens = await db.select().from(passwordResetTokens)
    .where(and(
      eq(passwordResetTokens.userId, user.id),
      eq(passwordResetTokens.code, code.trim()),
      eq(passwordResetTokens.used, false),
    ))
    .orderBy(desc(passwordResetTokens.createdAt))
    .limit(1);

  if (tokens.length === 0) return res.status(400).json({ error: "Invalid or expired code" });

  const tokenRow = tokens[0];
  if (new Date() > tokenRow.expiresAt) {
    await db.update(passwordResetTokens).set({ used: true }).where(eq(passwordResetTokens.id, tokenRow.id));
    return res.status(400).json({ error: "Code has expired. Please request a new one." });
  }

  // Reset password
  const newHash = await bcrypt.hash(newPassword, 12);
  await db.update(users).set({ passwordHash: newHash, updatedAt: new Date() }).where(eq(users.id, user.id));

  // Invalidate all sessions
  try {
    await db.update(users).set({ tokenVersion: sql`COALESCE(token_version, 0) + 1` }).where(eq(users.id, user.id));
  } catch { /* migration not run */ }

  // Mark token as used
  await db.update(passwordResetTokens).set({ used: true }).where(eq(passwordResetTokens.id, tokenRow.id));

  return res.status(200).json({ success: true, message: "Password has been reset. You can now sign in." });
}
```

Update the switch statement to add new actions and keep backwards compat:
```typescript
    case "request-reset": return handleRequestReset(req, res, ip);
    case "verify-reset": return handleVerifyReset(req, res, ip);
    case "reset-password": return handleResetPassword(req, res, ip); // keep old flow as fallback
```

Add to imports in `api/auth/index.ts`: `desc` from `"drizzle-orm"`, `randomInt` from `"crypto"`, and `import { escapeHtml } from "../../src/lib/html-escape";`.

**Remove the old `reset-password` case once the new ForgotPassword page ships** — leaving it lets anyone who knows a username+email take over the account, which defeats the point of OTP. Delete `handleResetPassword` and its `case` line, and delete the `/api/auth/reset-password` rewrite from `vercel.json`.

**Brute-force guard:** a 6-digit code has 1M combinations; IP rate limiting alone isn't enough because attackers rotate IPs. Also rate-limit by email: at the top of `handleVerifyReset` add
```typescript
  const { allowed: emailAllowed } = await rateLimit(`verify:${String(email).trim().toLowerCase()}`, { windowMs: 10 * 60_000, max: 5 });
  if (!emailAllowed) return res.status(429).json({ error: "Too many attempts. Request a new code." });
```

- [ ] **Step 2: Rewrite `src/pages/ForgotPassword.tsx` as two-step form**

Step 1: User enters email → calls `?action=request-reset` → shows "Check your email"
Step 2: User enters 6-digit code + new password + confirm → calls `?action=verify-reset` → shows success

The frontend should have `step` state: `"email" | "code" | "success"`.

Key changes:
- Remove username field (OTP flow uses email only)
- Add 6-digit code input (large centered digits)
- Add "Resend code" button with 60-second cooldown
- Step transitions with smooth animations

- [ ] **Step 3: Commit**

```bash
git add api/auth/index.ts src/pages/ForgotPassword.tsx
git commit -m "feat: password reset with email OTP (6-digit code, 10-min expiry)

Replaces username+email direct reset with email verification.
Old endpoint kept as fallback for backwards compatibility.

Co-Authored-By: Claude Opus 4.6 <noreply@anthropic.com>"
```

---

## Phase 3: Chrome Extension PDF Support + Account Portability

### Task 9: Chrome Extension PDF Support

**Files:**
- Modify: `extension/manifest.json`
- Modify: `extension/content.js`

- [ ] **Step 1: Update `extension/manifest.json`**

Change `all_frames` to `true`:
```json
  "content_scripts": [
    {
      "matches": ["<all_urls>"],
      "js": ["content.js"],
      "run_at": "document_idle",
      "all_frames": true
    }
  ]
```

- [ ] **Step 2: Update `extension/content.js` — add PDF detection and support**

Add PDF detection at the top of the IIFE (after the `__hcLoaded` check):

```javascript
  // ─── PDF Detection ───────────────────────────────────────────────────────────
  const isPdfViewer = (function() {
    try {
      const url = window.location.href;
      // Chrome's built-in PDF viewer URL
      if (url.startsWith("chrome-extension://mhjfbmdgcfjbbpaeojofohoefgiehjai/")) return true;
      // Direct PDF URLs
      if (url.toLowerCase().endsWith(".pdf")) return true;
      // PDF viewer embedded content type
      if (document.contentType === "application/pdf") return true;
      return false;
    } catch { return false; }
  })();

  // For PDFs, we need to capture the actual PDF URL for sourceUrl
  function getPdfSourceUrl() {
    try {
      const url = window.location.href;
      // Chrome PDF viewer wraps the actual URL
      if (url.startsWith("chrome-extension://mhjfbmdgcfjbbpaeojofohoefgiehjai/")) {
        const params = new URLSearchParams(url.split("?")[1] || "");
        return params.get("url") || url;
      }
      return url;
    } catch { return window.location.href; }
  }

  function getPdfTitle() {
    // Try to extract filename from URL
    try {
      const url = getPdfSourceUrl();
      const pathname = new URL(url).pathname;
      const filename = pathname.split("/").pop() || "";
      return decodeURIComponent(filename.replace(/\.pdf$/i, "")) || document.title || "PDF Document";
    } catch { return document.title || "PDF Document"; }
  }
```

Update `saveHighlight()` to use PDF-aware URL and title:
```javascript
  async function saveHighlight() {
    const text = getSelectedText();
    const rect = getSelectionRect();
    const tipX = rect ? rect.right : window.innerWidth / 2;
    const tipY = rect ? rect.bottom : window.innerHeight / 2;

    if (!text) {
      if (isPdfViewer) {
        showTooltip("Select text in the PDF first (Chrome 128+ required)", "error", tipX, tipY);
      } else {
        showTooltip("Select some text first", "error", tipX, tipY);
      }
      return;
    }

    // ... rest unchanged until payload ...

    const payload = {
      text,
      sourceUrl: isPdfViewer ? getPdfSourceUrl() : window.location.href,
      pageTitle: isPdfViewer ? getPdfTitle() : (document.title || ""),
      domain: (() => {
        try {
          const url = isPdfViewer ? getPdfSourceUrl() : window.location.href;
          return new URL(url).hostname.replace(/^www\./, "");
        } catch (_) { return ""; }
      })(),
    };

    // ... rest unchanged ...
  }
```

- [ ] **Step 3: Update extension version in `manifest.json`**

```json
  "version": "1.2.0",
```

- [ ] **Step 4: Commit**

```bash
git add extension/manifest.json extension/content.js
git commit -m "feat: Chrome extension PDF support (all_frames + PDF detection)

Co-Authored-By: Claude Opus 4.6 <noreply@anthropic.com>"
```

---

### Task 10: Account Export/Import & Portability

**Files:**
- Create: `api/account/index.ts`

- [ ] **Step 1: Create `api/account/index.ts`**

```typescript
import type { VercelRequest, VercelResponse } from "@vercel/node";
import bcrypt from "bcryptjs";
import { and, eq, sql } from "drizzle-orm";
import { db } from "../../src/lib/db";
import { users, highlights, tags } from "../../src/schema";
import { verifyJwt, verifyTokenVersion } from "../../src/lib/auth";
import { applyCors } from "../../src/lib/cors";

function parseCookies(cookieHeader: string): Record<string, string> {
  const cookies: Record<string, string> = {};
  for (const pair of cookieHeader.split(";")) {
    const [key, ...rest] = pair.split("=");
    const k = key?.trim();
    if (k) cookies[k] = decodeURIComponent(rest.join("=").trim());
  }
  return cookies;
}

export default async function handler(req: VercelRequest, res: VercelResponse) {
  if (applyCors(req, res)) return;

  const cookies = parseCookies((req.headers.cookie as string) ?? "");
  const token = cookies["hc_session"];
  if (!token) return res.status(401).json({ error: "Not authenticated" });

  const payload = await verifyJwt(token);
  if (!payload) return res.status(401).json({ error: "Invalid session" });
  if (!(await verifyTokenVersion(payload))) return res.status(401).json({ error: "Session expired" });

  const action = (req.query.action as string) || "";

  switch (action) {
    case "export": return handleExport(req, res, payload.userId);
    case "import": return handleImport(req, res, payload.userId);
    case "delete": return handleDelete(req, res, payload.userId);
    case "change-password": return handleChangePassword(req, res, payload.userId);
    default: return res.status(400).json({ error: "Invalid action" });
  }
}

async function handleExport(_req: VercelRequest, res: VercelResponse, userId: number) {
  try {
    const user = await db.select({
      username: users.username,
      email: users.email,
      theme: users.theme,
      dailyEmailEnabled: users.dailyEmailEnabled,
    }).from(users).where(eq(users.id, userId)).limit(1);

    if (user.length === 0) return res.status(404).json({ error: "User not found" });

    const userTags = await db.select({ id: tags.id, name: tags.name, color: tags.color }).from(tags).where(eq(tags.userId, userId));
    const tagMap = new Map(userTags.map(t => [t.id, t.name]));

    const userHighlights = await db.select().from(highlights).where(eq(highlights.userId, userId));

    const exportData = {
      exportVersion: 1,
      exportedAt: new Date().toISOString(),
      user: user[0],
      tags: userTags.map(t => ({ name: t.name, color: t.color })),
      highlights: userHighlights.map(h => {
        let tagNames: string[] = [];
        try {
          const ids = JSON.parse(h.tagIds || "[]");
          tagNames = ids.map((id: number) => tagMap.get(id)).filter(Boolean);
        } catch {}

        let metaTags: string[] = [];
        try { metaTags = JSON.parse(h.metadataTags || "[]"); } catch {}

        return {
          text: h.text,
          sourceUrl: h.sourceUrl,
          pageTitle: h.pageTitle,
          domain: h.domain,
          notes: h.notes,
          tagNames,
          metadataTags: metaTags,
          createdAt: h.createdAt,
        };
      }),
    };

    res.setHeader("Content-Disposition", `attachment; filename="mind-palace-export-${new Date().toISOString().slice(0,10)}.json"`);
    res.setHeader("Content-Type", "application/json");
    return res.status(200).json(exportData);
  } catch (err) {
    console.error("[account/export] Error:", err);
    return res.status(500).json({ error: "Internal server error" });
  }
}

async function handleImport(req: VercelRequest, res: VercelResponse, userId: number) {
  if (req.method !== "POST") return res.status(405).json({ error: "POST required" });

  try {
    const data = req.body;
    if (!data || !Array.isArray(data.tags) || !Array.isArray(data.highlights)) return res.status(400).json({ error: "Invalid export format" });
    if (data.highlights.length > 10000) return res.status(400).json({ error: "Max 10,000 highlights per import" });

    let tagsImported = 0;
    let highlightsImported = 0;
    const tagNameToId = new Map<string, number>();

    // Import tags
    for (const tag of data.tags) {
      if (!tag.name) continue;
      // MUST scope by userId — otherwise another user's tag ID gets attached
      const existing = await db.select({ id: tags.id }).from(tags).where(and(eq(tags.userId, userId), eq(tags.name, tag.name))).limit(1);
      if (existing.length > 0) {
        tagNameToId.set(tag.name, existing[0].id);
      } else {
        const inserted = await db.insert(tags).values({ userId, name: tag.name, color: tag.color || "#6366f1" }).returning({ id: tags.id });
        tagNameToId.set(tag.name, inserted[0].id);
        tagsImported++;
      }
    }

    // Import highlights
    for (const h of data.highlights) {
      if (!h.text || typeof h.text !== "string" || h.text.length > 50000) continue;
      if (h.sourceUrl && !/^https?:\/\//i.test(h.sourceUrl)) h.sourceUrl = "";
      const tagIds = (h.tagNames || []).map((n: string) => tagNameToId.get(n)).filter(Boolean);

      await db.insert(highlights).values({
        userId,
        text: h.text,
        sourceUrl: h.sourceUrl || "",
        pageTitle: h.pageTitle || "",
        domain: h.domain || "",
        notes: h.notes || null,
        tagIds: JSON.stringify(tagIds),
        metadataTags: JSON.stringify(h.metadataTags || []),
      });
      highlightsImported++;
    }

    return res.status(200).json({ success: true, tagsImported, highlightsImported });
  } catch (err) {
    console.error("[account/import] Error:", err);
    return res.status(500).json({ error: "Internal server error" });
  }
}

async function handleDelete(req: VercelRequest, res: VercelResponse, userId: number) {
  if (req.method !== "DELETE") return res.status(405).json({ error: "DELETE required" });

  try {
    // FK cascade handles highlights, tags, api_tokens
    await db.delete(users).where(eq(users.id, userId));
    return res.status(200).json({ success: true, message: "Account and all data permanently deleted" });
  } catch (err) {
    console.error("[account/delete] Error:", err);
    return res.status(500).json({ error: "Internal server error" });
  }
}

async function handleChangePassword(req: VercelRequest, res: VercelResponse, userId: number) {
  if (req.method !== "POST") return res.status(405).json({ error: "POST required" });

  const { currentPassword, newPassword } = req.body ?? {};
  if (!currentPassword || !newPassword) return res.status(400).json({ error: "Current and new password required" });
  if (newPassword.length < 8) return res.status(400).json({ error: "New password must be at least 8 characters" });

  try {
    const user = await db.select({ passwordHash: users.passwordHash }).from(users).where(eq(users.id, userId)).limit(1);
    if (user.length === 0) return res.status(404).json({ error: "User not found" });

    const valid = await bcrypt.compare(currentPassword, user[0].passwordHash);
    if (!valid) return res.status(401).json({ error: "Current password is incorrect" });

    const newHash = await bcrypt.hash(newPassword, 12);
    await db.update(users).set({ passwordHash: newHash, updatedAt: new Date() }).where(eq(users.id, userId));

    // Invalidate all sessions
    try {
      await db.update(users).set({ tokenVersion: sql`COALESCE(token_version, 0) + 1` }).where(eq(users.id, userId));
    } catch { /* migration not run */ }

    return res.status(200).json({ success: true, message: "Password changed. Please sign in again." });
  } catch (err) {
    console.error("[account/change-password] Error:", err);
    return res.status(500).json({ error: "Internal server error" });
  }
}
```

- [ ] **Step 2: Commit**

```bash
git add api/account/index.ts
git commit -m "feat: account portability — export, import, delete, change password

Full JSON export with tags mapped to names for cross-instance portability.
Import recreates tags and remaps IDs. Self-serve account deletion.

Co-Authored-By: Claude Opus 4.6 <noreply@anthropic.com>"
```

---

## Phase 4: Settings Enhancements + Polish

### Task 11: Add Password Change & Account Deletion to Settings

**Files:**
- Modify: `src/pages/Settings.tsx`

- [ ] **Step 1: Add Password Change section**

In Settings.tsx, add a new section after the theme/email settings:

- 3 fields: current password, new password, confirm new password
- Submit calls `POST /api/account?action=change-password`
- On success, redirect to login (session invalidated)

- [ ] **Step 2: Add Account Export button**

A "Download My Data" button that calls `GET /api/account?action=export` and triggers a JSON file download.

- [ ] **Step 3: Add Account Deletion section**

A red "Delete My Account" button at the bottom of Settings:
- Shows a confirmation dialog with text "This action cannot be undone. Type DELETE to confirm."
- Calls `DELETE /api/account?action=delete`
- Redirects to landing page

- [ ] **Step 4: Commit**

```bash
git add src/pages/Settings.tsx
git commit -m "feat: Settings — password change, data export, account deletion

Co-Authored-By: Claude Opus 4.6 <noreply@anthropic.com>"
```

---

### Task 12: Add Manual "Add Highlight" from Dashboard

**Files:**
- Modify: `src/pages/MindPalace.tsx`

- [ ] **Step 1: Add "Add Highlight" button and modal**

Add a `+` button in the sidebar (or top bar) that opens a modal with:
- Text field (required, textarea)
- Source URL (optional)
- Notes (optional)
- Tag selector (reuse existing tag UI)
- Submit calls `POST /api/highlights`

Follow the existing modal pattern in MindPalace.tsx (ExportModal, ImportModal).

- [ ] **Step 2: Commit**

```bash
git add src/pages/MindPalace.tsx
git commit -m "feat: add manual highlight from dashboard

Co-Authored-By: Claude Opus 4.6 <noreply@anthropic.com>"
```

---

### Task 13: Final Deploy + Smoke Test

- [ ] **Step 1: Verify build**

```bash
npx tsc --noEmit
npx vite build
```

- [ ] **Step 2: Run migration if not already done**

```sql
-- drizzle/0003_admin_and_security.sql — run on Neon
```

- [ ] **Step 3: Verify function count**

```bash
find api -name "*.ts" | wc -l
```

Expected: 9 functions (auth/index, auth/me, highlights/index, tags/index, tokens/index, extension/index, cron/daily-highlights, admin/index, account/index). 3 slots remaining.

- [ ] **Step 4: Push and deploy**

```bash
git push origin main
# Vercel auto-deploys on push, OR:
vercel deploy --prod --yes
```

- [ ] **Step 5: End-to-end smoke test**

Test each feature on the live site:
1. Login / logout / register
2. Forgot password OTP flow (request code → enter code → new password)
3. Save highlight via extension
4. Save highlight from PDF in Chrome
5. Export (JSON, Markdown, Obsidian ZIP, Notion CSV)
6. Import (Twitter, Reddit, JSON, CSV)
7. Settings: change password, download data, Notion connection
8. Admin dashboard (login as aupadhyay): view users, stats, force password reset
9. Account deletion (create test account, delete it)

- [ ] **Step 6: Update production-readiness-status.md**

Add v2.0 entry to the version history table.

- [ ] **Step 7: Final commit**

```bash
git add docs/production-readiness-status.md
git commit -m "docs: v2.0 status — consolidated API, admin, OTP, PDF, portability

Co-Authored-By: Claude Opus 4.6 <noreply@anthropic.com>"
git push origin main
```

---

## Deferred (deliberately not in this plan)

- **Hashing API tokens at rest** — Settings currently re-displays the token, so hashing requires a "show once, then regenerate" UX change in Settings and the extension. Do it as a separate small plan after v2.0 ships.
- **Custom Resend domain** — OTP emails from `onboarding@resend.dev` only reach the Resend account owner's address until a domain is verified. **The OTP reset flow will not work for other users until this DNS setup is done.** Do it before removing the old reset flow.

## Appendix: File Changes Summary

### New Files (7)
| File | Purpose |
|------|---------|
| `api/auth/index.ts` | Consolidated auth (login, register, logout, reset) |
| `api/extension/index.ts` | Consolidated extension (save, recent) |
| `api/admin/index.ts` | Admin dashboard API |
| `api/account/index.ts` | Account export/import/delete/password-change |
| `src/lib/html-escape.ts` | HTML escaping utility |
| `src/pages/Admin.tsx` | Admin dashboard frontend |
| `drizzle/0003_admin_and_security.sql` | Migration: role, tokenVersion, disabled, lastActive, password_reset_tokens |

### Deleted Files (7)
| File | Reason |
|------|--------|
| `api/auth/login.ts` | Merged into `api/auth/index.ts` |
| `api/auth/logout.ts` | Merged into `api/auth/index.ts` |
| `api/auth/register.ts` | Merged into `api/auth/index.ts` |
| `api/auth/reset-password.ts` | Merged into `api/auth/index.ts` |
| `api/extension/save.ts` | Merged into `api/extension/index.ts` |
| `api/extension/recent.ts` | Merged into `api/extension/index.ts` |
| `api/highlights/[id].ts` | Duplicate — handled by `?id=` in index.ts |

### Modified Files (12)
| File | Changes |
|------|---------|
| `vercel.json` | Add rewrites for backwards compat |
| `package.json` | Add `@upstash/redis`, `@upstash/ratelimit` |
| `src/schema.ts` | Add role, tokenVersion, disabled, lastActive, passwordResetTokens table |
| `src/lib/auth.ts` | Include tokenVersion in JWT, add verifyTokenVersion |
| `src/lib/rate-limit.ts` | Rewrite to use Upstash Redis (async) |
| `api/auth/me.ts` | Verify tokenVersion, expose role |
| `api/cron/daily-highlights.ts` | Escape HTML, fix dashboard URL |
| `src/pages/ForgotPassword.tsx` | Two-step OTP flow |
| `src/pages/Settings.tsx` | Password change, data export, account deletion |
| `src/pages/MindPalace.tsx` | Manual "Add highlight" modal |
| `src/App.tsx` | Add /admin route |
| `extension/manifest.json` | all_frames: true, version 1.2.0 |
| `extension/content.js` | PDF detection + support |

### Function Count: 12 → 9
| Slot | Function |
|------|----------|
| 1 | `api/auth/index.ts` |
| 2 | `api/auth/me.ts` |
| 3 | `api/highlights/index.ts` |
| 4 | `api/tags/index.ts` |
| 5 | `api/tokens/index.ts` |
| 6 | `api/extension/index.ts` |
| 7 | `api/cron/daily-highlights.ts` |
| 8 | `api/admin/index.ts` |
| 9 | `api/account/index.ts` |
| 10-12 | *Available for future features* |
