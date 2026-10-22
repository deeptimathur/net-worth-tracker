import { drizzle } from "drizzle-orm/postgres-js";
import postgres from "postgres";
import * as schema from "./schema";

type DB = ReturnType<typeof drizzle<typeof schema>>;

const globalForDb = globalThis as unknown as { __nwtDb?: DB };

export function getDb(): DB {
  if (!globalForDb.__nwtDb) {
    const url = process.env.DATABASE_URL;
    if (!url) throw new Error("DATABASE_URL is not set");
    // prepare:false keeps this compatible with transaction-mode poolers (Neon, Supabase).
    globalForDb.__nwtDb = drizzle(postgres(url, { max: 5, prepare: false }), { schema });
  }
  return globalForDb.__nwtDb;
}

export { schema };
