import { neon } from "@neondatabase/serverless";
import { drizzle, type NeonHttpDatabase } from "drizzle-orm/neon-http";
import * as schema from "./schema";

type DB = NeonHttpDatabase<typeof schema>;

let _db: DB | null = null;

function init(): DB {
  if (_db) return _db;
  const databaseUrl = process.env.DATABASE_URL;
  if (!databaseUrl) {
    throw new Error(
      "DATABASE_URL is not set. Create a Neon database and add its connection string to .env.local (see .env.example).",
    );
  }
  const sql = neon(databaseUrl);
  _db = drizzle(sql, { schema });
  return _db;
}

// Lazy proxy: the connection (and the DATABASE_URL check) only happens on first
// actual query, so importing this module during build never throws.
export const db = new Proxy({} as DB, {
  get(_target, prop) {
    const instance = init();
    const value = instance[prop as keyof DB];
    return typeof value === "function" ? value.bind(instance) : value;
  },
});

export { schema };
