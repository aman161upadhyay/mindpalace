import type { VercelRequest, VercelResponse } from "@vercel/node";
import { applyCors } from "../../lib/cors";

// Self-service reset is disabled: the old flow let anyone who knew a username and email set a
// new password. It comes back once one-time codes can be emailed (verified Resend domain).
// Until then the owner resets passwords manually (see scripts/make-reset-sql.mjs).
export default async function handler(req: VercelRequest, res: VercelResponse) {
  if (applyCors(req, res)) return;
  return res.status(410).json({
    error: "Self-service password reset is turned off for security. Email aupadhyay@mba2027.hbs.edu from your sign-up address and we'll reset it for you.",
  });
}
