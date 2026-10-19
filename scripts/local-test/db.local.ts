// Test-only replacement for src/lib/db.ts: same drizzle schema, in-memory Postgres.
import { PGlite } from "@electric-sql/pglite";
import { drizzle } from "drizzle-orm/pglite";
import * as schema from "M:/AI/Mind Palace/src/schema.ts";

export const client = new PGlite();
export const db = drizzle(client, { schema });
