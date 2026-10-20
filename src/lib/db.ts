import { neon } from "@neondatabase/serverless";
import { drizzle, type NeonHttpDatabase } from "drizzle-orm/neon-http";
import * as schema from "../schema";

type Db = NeonHttpDatabase<typeof schema>;
let instance: Db | null = null;

// Connect on first use rather than at import, so a missing or malformed DATABASE_URL fails the
// request that needs the database with a clear error instead of crashing the whole function.
function getDb(): Db {
  if (instance) return instance;
  const raw = process.env.DATABASE_URL;
  if (!raw) throw new Error("DATABASE_URL environment variable is not set");
  // Accept the string even if it was pasted with quotes or as Neon's `psql '...'` command.
  const url = raw.match(/postgres(?:ql)?:\/\/[^\s'"]+/)?.[0];
  if (!url) {
    // Describe the value's shape without revealing it, so a bad paste is easy to diagnose.
    const shape = `length ${raw.length}, starts with "${raw.slice(0, 4).replace(/[A-Za-z0-9]/g, "x")}", contains "://": ${raw.includes("://")}, contains "@": ${raw.includes("@")}`;
    throw new Error(`DATABASE_URL must be a full postgresql:// connection string (got ${shape})`);
  }
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
