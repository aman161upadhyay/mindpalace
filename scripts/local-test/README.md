# Local test rig (no production access needed)

Runs the real API router and the built frontend on http://localhost:3100 against a throwaway
in-memory Postgres (PGlite). Only the database driver is swapped; nothing talks to Neon or Vercel.

Setup (once): `cd scripts/local-test && npm init -y && npm i @electric-sql/pglite puppeteer-core`
(paths in the scripts assume this repo lives at `M:\AI\Mind Palace`; adjust if it moves).

1. `npm run build` in the repo root, then `node build.cjs` here (bundles `server.ts` -> `server.mjs`).
2. Start with today's production schema: `LT_PHASE=old PORT=3100 DIST_DIR=<repo>/dist MIGRATIONS_DIR=<repo>/drizzle JWT_SECRET=x RESEND_API_KEY=re_test DATABASE_URL=unused node server.mjs`
3. `node api-test.mjs` seeds users, reproduces the missing-column outage, runs the migration SQL and tests everything.
4. For the browser test restart with `LT_PHASE=all`, then `node e2e.mjs` (needs Chrome; loads `extension/`).
