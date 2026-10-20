// Owner tool: prints SQL that sets a temporary password for one user.
// Usage: node scripts/make-reset-sql.mjs <username>
// Paste the printed SQL into the Neon SQL editor (project "Mindpalace"), then send the user the
// temporary password through the email thread they contacted you from, and ask them to change it.
import { createRequire } from "node:module";
import crypto from "node:crypto";

const require = createRequire(import.meta.url);
const bcrypt = require("bcryptjs");

const username = (process.argv[2] || "").trim().toLowerCase();
if (!/^[a-z0-9._@-]{2,64}$/.test(username)) {
  console.error("Usage: node scripts/make-reset-sql.mjs <username>");
  process.exit(1);
}

const temp = crypto.randomBytes(9).toString("base64url");
const hash = bcrypt.hashSync(temp, 12);

console.log(`Temporary password for ${username}: ${temp}\n`);
console.log("SQL to paste into the Neon SQL editor:\n");
console.log(`UPDATE users SET password_hash = '${hash}', updated_at = NOW() WHERE username = '${username}' RETURNING id, username, email;`);
