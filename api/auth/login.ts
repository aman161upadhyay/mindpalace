import type { VercelRequest, VercelResponse } from "@vercel/node";
import bcrypt from "bcryptjs";
import { randomBytes } from "crypto";
import { eq, or } from "drizzle-orm";
import { db } from "../../src/lib/db";
import { users, apiTokens } from "../../src/schema";
import { signJwt, setSessionCookie } from "../../src/lib/auth";
import { applyCors } from "../../src/lib/cors";
import { rateLimit, getClientIp } from "../../src/lib/rate-limit";

export default async function handler(req: VercelRequest, res: VercelResponse) {
  if (applyCors(req, res)) return;
  if (req.method !== "POST") return res.status(405).json({ error: "Method not allowed" });

  const ip = getClientIp(req.headers);
  const { allowed } = rateLimit(ip, { windowMs: 60_000, max: 10 });
  if (!allowed) return res.status(429).json({ error: "Too many requests, please try again later" });

  try {
    const { username, password } = req.body ?? {};

    if (!username || typeof username !== "string" || username.length > 255)
      return res.status(400).json({ error: "Username or email is required" });
    if (!password || typeof password !== "string" || password.length > 1024)
      return res.status(400).json({ error: "Password is required" });

    const trimmedLogin = username.trim().toLowerCase();

    const found = await db
      .select()
      .from(users)
      .where(or(eq(users.username, trimmedLogin), eq(users.email, trimmedLogin)))
      .limit(1);

    if (found.length === 0)
      return res.status(401).json({ error: "Invalid username or password" });

    const user = found[0];
    const valid = await bcrypt.compare(password, user.passwordHash);
    if (!valid) return res.status(401).json({ error: "Invalid username or password" });

    const existingTokens = await db
      .select()
      .from(apiTokens)
      .where(eq(apiTokens.userId, user.id))
      .limit(1);

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
    console.error("[login] Error:", err);
    return res.status(500).json({ error: "Internal server error" });
  }
}
