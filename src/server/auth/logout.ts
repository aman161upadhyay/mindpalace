import type { VercelRequest, VercelResponse } from "@vercel/node";
import { clearSessionCookie } from "../../lib/auth";
import { applyCors } from "../../lib/cors";

export default async function handler(req: VercelRequest, res: VercelResponse) {
  if (applyCors(req, res)) return;
  if (req.method !== "POST") {
    return res.status(405).json({ error: "Method not allowed" });
  }

  res.setHeader("Set-Cookie", clearSessionCookie());
  return res.status(200).json({ success: true });
}
