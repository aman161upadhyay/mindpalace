import type { VercelRequest, VercelResponse } from "@vercel/node";
import bcrypt from "bcryptjs";
import { eq, and } from "drizzle-orm";
import { db } from "../../lib/db";
import { users } from "../../schema";
import { applyCors } from "../../lib/cors";
import { rateLimit, getClientIp } from "../../lib/rate-limit";

// Reset by username + email (no emailed code yet). Attempts are limited per network and per
// account so the pair can't be guessed by brute force.
export default async function handler(req: VercelRequest, res: VercelResponse) {
  if (applyCors(req, res)) return;
  if (req.method !== "POST") return res.status(405).json({ error: "Method not allowed" });

  const ip = getClientIp(req.headers);
  if (!rateLimit(`reset-ip:${ip}`, { windowMs: 60_000, max: 10 }).allowed)
    return res.status(429).json({ error: "Too many attempts. Please wait a minute and try again." });

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

    if (!rateLimit(`reset-user:${trimmedUsername}`, { windowMs: 60 * 60_000, max: 5 }).allowed)
      return res.status(429).json({ error: "Too many reset attempts for this account. Please try again in an hour." });

    const found = await db
      .select({ id: users.id })
      .from(users)
      .where(and(eq(users.username, trimmedUsername), eq(users.email, trimmedEmail)))
      .limit(1);

    if (found.length === 0) {
      return res.status(400).json({ error: "That username and email don't match an account. Check both and try again." });
    }

    const newHash = await bcrypt.hash(newPassword, 12);
    await db.update(users).set({ passwordHash: newHash, updatedAt: new Date() }).where(eq(users.id, found[0].id));

    return res.status(200).json({ success: true, message: "Password has been reset. You can now sign in." });
  } catch (err: unknown) {
    console.error("[reset-password] Error:", err);
    return res.status(500).json({ error: "Internal server error" });
  }
}
