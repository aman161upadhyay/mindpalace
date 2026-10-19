const path = require("path");
const REPO = "M:/AI/Mind Palace";
const { build } = require(require.resolve("esbuild", { paths: [REPO] }));
const here = __dirname;
build({
  entryPoints: [path.join(here, "server.ts")],
  outfile: path.join(here, "server.mjs"),
  bundle: true, platform: "node", format: "esm", target: "node20",
  nodePaths: [path.join(REPO, "node_modules"), path.join(here, "node_modules")],
  external: ["@electric-sql/pglite"],
  banner: { js: "import { createRequire as __cr } from 'module'; const require = __cr(import.meta.url);" },
  plugins: [{ name: "alias-db", setup(b) { b.onResolve({ filter: /\/lib\/db$/ }, () => ({ path: path.join(here, "db.local.ts") })); } }],
  logLevel: "warning",
}).then(() => console.log("bundled")).catch((e) => { console.error(e.message); process.exit(1); });
