import type { VercelRequest, VercelResponse } from "@vercel/node";
import { and, eq } from "drizzle-orm";
import { db } from "../../src/lib/db";
import { apiTokens } from "../../src/schema";
import { getAuthUserIdFromVercelReq } from "../../src/lib/auth";
import { applyCors } from "../../src/lib/cors";

export default async function handler(req: VercelRequest, res: VercelResponse) {
  if (applyCors(req, res)) return;
  if (req.method !== "DELETE") return res.status(405).json({ error: "Method not allowed" });

  const userId = await getAuthUserIdFromVercelReq(req);
  if (!userId) return res.status(401).json({ error: "Not authenticated" });

  const id = Number(req.query.id);
  if (!id || isNaN(id)) return res.status(400).json({ error: "Invalid token ID" });

  await db.delete(apiTokens).where(and(eq(apiTokens.id, id), eq(apiTokens.userId, userId)));
  return res.status(200).json({ success: true });
}
