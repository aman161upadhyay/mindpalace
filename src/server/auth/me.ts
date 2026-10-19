import type { VercelRequest, VercelResponse } from "@vercel/node";
import { eq } from "drizzle-orm";
import { db } from "../../lib/db";
import { users, apiTokens } from "../../schema";
import { verifyJwt } from "../../lib/auth";
import { applyCors } from "../../lib/cors";

function parseCookies(cookieHeader: string): Record<string, string> {
  const cookies: Record<string, string> = {};
  for (const pair of cookieHeader.split(";")) {
    const [key, ...rest] = pair.split("=");
    const k = key?.trim();
    if (k) {
      cookies[k] = decodeURIComponent(rest.join("=").trim());
    }
  }
  return cookies;
}

export default async function handler(req: VercelRequest, res: VercelResponse) {
  if (applyCors(req, res)) return;
  const cookieHeader = (req.headers.cookie as string) ?? "";
  const cookies = parseCookies(cookieHeader);
  const token = cookies["hc_session"];

  if (!token) {
    return res.status(401).json({ error: "Not authenticated" });
  }

  const payload = await verifyJwt(token);
  if (!payload) {
    return res.status(401).json({ error: "Invalid or expired session" });
  }

  if (req.method === "GET") {
    // Core user fields (always available)
    const found = await db
      .select({
        id: users.id,
        username: users.username,
        email: users.email,
        theme: users.theme,
        dailyEmailEnabled: users.dailyEmailEnabled,
      })
      .from(users)
      .where(eq(users.id, payload.userId))
      .limit(1);

    if (found.length === 0) {
      return res.status(401).json({ error: "User not found" });
    }

    const tokenRows = await db
      .select({ token: apiTokens.token })
      .from(apiTokens)
      .where(eq(apiTokens.userId, payload.userId))
      .limit(1);

    // Notion integration fields (may not exist if migration hasn't run)
    let notionData: { notionToken: string | null; notionDatabaseId: string | null; notionLastSync: Date | null } = {
      notionToken: null, notionDatabaseId: null, notionLastSync: null,
    };
    try {
      const notionRow = await db
        .select({ notionToken: users.notionToken, notionDatabaseId: users.notionDatabaseId, notionLastSync: users.notionLastSync })
        .from(users)
        .where(eq(users.id, payload.userId))
        .limit(1);
      if (notionRow[0]) notionData = notionRow[0];
    } catch {
      // Migration not yet run — Notion columns don't exist; gracefully skip
    }

    return res.status(200).json({
      ...found[0],
      notionToken: notionData.notionToken ? `${notionData.notionToken.slice(0, 8)}•••${notionData.notionToken.slice(-4)}` : null,
      notionDatabaseId: notionData.notionDatabaseId || null,
      notionLastSync: notionData.notionLastSync || null,
      notionConnected: !!notionData.notionToken && !!notionData.notionDatabaseId,
      apiToken: tokenRows[0]?.token ?? null,
    });
  }

  if (req.method === "PATCH") {
    const { theme, dailyEmailEnabled, notionToken, notionDatabaseId } = req.body ?? {};

    const updates: Record<string, any> = { updatedAt: new Date() };

    if (theme !== undefined) {
      if (theme !== "dark" && theme !== "light") {
        return res.status(400).json({ error: "Theme must be 'dark' or 'light'" });
      }
      updates.theme = theme;
    }

    if (dailyEmailEnabled !== undefined) {
      if (typeof dailyEmailEnabled !== "boolean") {
        return res.status(400).json({ error: "dailyEmailEnabled must be a boolean" });
      }
      updates.dailyEmailEnabled = dailyEmailEnabled;
    }

    // Notion integration settings — separate so core updates still work if migration hasn't run
    const notionUpdates: Record<string, any> = {};
    if (notionToken !== undefined) {
      if (notionToken === null || notionToken === "") {
        notionUpdates.notionToken = null;
        notionUpdates.notionDatabaseId = null;
        notionUpdates.notionLastSync = null;
      } else if (typeof notionToken === "string" && notionToken.length > 10) {
        notionUpdates.notionToken = notionToken;
      } else {
        return res.status(400).json({ error: "Invalid Notion token" });
      }
    }
    if (notionDatabaseId !== undefined) {
      if (typeof notionDatabaseId === "string" || notionDatabaseId === null) {
        notionUpdates.notionDatabaseId = notionDatabaseId;
      }
    }

    if (Object.keys(updates).length > 1) {
      await db.update(users).set(updates).where(eq(users.id, payload.userId));
    }

    // Apply Notion updates separately (graceful if columns don't exist yet)
    if (Object.keys(notionUpdates).length > 0) {
      try {
        await db.update(users).set({ ...notionUpdates, updatedAt: new Date() }).where(eq(users.id, payload.userId));
      } catch (e) {
        console.error("[me.ts] Notion column update failed (migration may not have run):", e);
        // Don't fail the request — core updates already applied
      }
    }

    // Fetch updated user
    const found = await db
      .select({
        id: users.id,
        username: users.username,
        email: users.email,
        theme: users.theme,
        dailyEmailEnabled: users.dailyEmailEnabled,
      })
      .from(users)
      .where(eq(users.id, payload.userId))
      .limit(1);

    // Fetch Notion fields separately (graceful)
    let notionData: { notionToken: string | null; notionDatabaseId: string | null; notionLastSync: Date | null } = {
      notionToken: null, notionDatabaseId: null, notionLastSync: null,
    };
    try {
      const nr = await db
        .select({ notionToken: users.notionToken, notionDatabaseId: users.notionDatabaseId, notionLastSync: users.notionLastSync })
        .from(users).where(eq(users.id, payload.userId)).limit(1);
      if (nr[0]) notionData = nr[0];
    } catch { /* migration not run yet */ }

    return res.status(200).json({
      ...found[0],
      notionToken: notionData.notionToken ? `${notionData.notionToken.slice(0, 8)}•••${notionData.notionToken.slice(-4)}` : null,
      notionDatabaseId: notionData.notionDatabaseId || null,
      notionLastSync: notionData.notionLastSync || null,
      notionConnected: !!notionData.notionToken && !!notionData.notionDatabaseId,
    });
  }

  return res.status(405).json({ error: "Method not allowed" });
}
