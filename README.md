# Mind Palace

Save highlights from any web page with a Chrome extension, then search, tag, sort and export them from a web dashboard — including an **AI Brain Pack** you can load into NotebookLM, ChatGPT/Claude Projects, Obsidian or a private local AI.

**Website:** https://themindpalace.org · **Chrome extension:** [Mind Palace on the Chrome Web Store](https://chromewebstore.google.com/detail/mind-palace/hfjlflceaophbbeadanbpibaaidbjoao)

**Everything about how the project works — architecture, features, deployment, environment, tests, decisions — is in [`CONTEXT.md`](CONTEXT.md).**

## Quick start (development)

```bash
npm install
npm run build              # type-check + production bundle
npm run typecheck:api      # type-check the server code
npm run check:router       # routing checks (see CONTEXT.md for the env vars it needs)
npx tsx scripts/check-exports.mts
```

Full-stack browser tests run against a throwaway in-memory database and never touch production: see [`scripts/local-test/README.md`](scripts/local-test/README.md).

## Stack

React 19 · Vite · TypeScript · Tailwind CSS 4 · Vercel serverless (one function) · Neon Postgres · Drizzle ORM · Chrome Manifest V3 · Resend.

## Layout

`api/` the single serverless function · `src/` the web app and server handlers · `extension/` the Chrome extension · `drizzle/` SQL migrations · `scripts/` checks and the local test rig.
