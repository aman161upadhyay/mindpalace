import { neon } from "@neondatabase/serverless";
import { drizzle, type NeonHttpDatabase } from "drizzle-orm/neon-http";
import * as schema from "../schema";

type Db = NeonHttpDatabase<typeof schema>;
let instance: Db | null = null;

// Connect on first use rather than at import, so a missing or malformed DATABASE_URL fails the
// request that needs the database with a clear error instead of crashing the whole function.
function getDb(): Db {
  if (instance) return instance;
  const url = process.env.DATABASE_URL;
  if (!url) throw new Error("DATABASE_URL environment variable is not set");
  if (!/^postgres(ql)?:\/\//.test(url)) throw new Error("DATABASE_URL must be a full postgresql:// connection string");
  instance = drizzle(neon(url), { schema });
  return instance;
}

export const db = new Proxy({} as Db, {
  get(_target, prop) {
    const real = getDb() as unknown as Record<string | symbol, unknown>;
    const value = real[prop];
    return typeof value === "function" ? (value as (...a: unknown[]) => unknown).bind(real) : value;
  },
});
