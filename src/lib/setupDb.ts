import { db } from "../db";
import { sql } from "drizzle-orm";
import { seedCards } from "./seedData";

// Idempotent DDL that mirrors src/db/schema.ts. Runs at runtime so the database
// can be initialized from the /setup page without the drizzle-kit CLI.
const STATEMENTS = [
  // Enums (Postgres has no CREATE TYPE IF NOT EXISTS, so guard with a DO block).
  `DO $$ BEGIN
     CREATE TYPE txn_type AS ENUM ('purchase','fee','interest','credit','payment','refund','other');
   EXCEPTION WHEN duplicate_object THEN null; END $$;`,
  `DO $$ BEGIN
     CREATE TYPE txn_source AS ENUM ('csv','pdf','manual');
   EXCEPTION WHEN duplicate_object THEN null; END $$;`,
  `DO $$ BEGIN
     CREATE TYPE netting_status AS ENUM ('none','auto','suggested','confirmed','rejected');
   EXCEPTION WHEN duplicate_object THEN null; END $$;`,

  `CREATE TABLE IF NOT EXISTS cards (
     id serial PRIMARY KEY,
     name text NOT NULL,
     issuer text,
     owner text,
     last4 text,
     annual_fee numeric(12,2) DEFAULT '0',
     active boolean NOT NULL DEFAULT true,
     created_at timestamp DEFAULT now() NOT NULL
   );`,

  `CREATE TABLE IF NOT EXISTS transactions (
     id serial PRIMARY KEY,
     source txn_source NOT NULL DEFAULT 'csv',
     card_id integer REFERENCES cards(id) ON DELETE SET NULL,
     account text,
     txn_date date NOT NULL,
     description text NOT NULL,
     raw_description text,
     amount numeric(12,2) NOT NULL,
     type txn_type NOT NULL DEFAULT 'purchase',
     category text NOT NULL DEFAULT 'Uncategorized',
     excluded_from_expenses boolean NOT NULL DEFAULT false,
     netted_with_id integer,
     netting_status netting_status NOT NULL DEFAULT 'none',
     person text,
     notes text,
     import_hash text,
     created_at timestamp DEFAULT now() NOT NULL
   );`,

  // In case an older cards table exists without the newer columns.
  `ALTER TABLE cards ADD COLUMN IF NOT EXISTS owner text;`,
  `ALTER TABLE cards ADD COLUMN IF NOT EXISTS active boolean NOT NULL DEFAULT true;`,

  `CREATE INDEX IF NOT EXISTS txn_date_idx ON transactions (txn_date);`,
  `CREATE INDEX IF NOT EXISTS txn_type_idx ON transactions (type);`,
  `CREATE INDEX IF NOT EXISTS txn_card_idx ON transactions (card_id);`,
  `CREATE INDEX IF NOT EXISTS txn_hash_idx ON transactions (import_hash);`,
];

export async function ensureSchema() {
  for (const stmt of STATEMENTS) {
    await db.execute(sql.raw(stmt));
  }
}

export async function setupDatabase() {
  await ensureSchema();
  const seed = await seedCards();
  return { schema: "ready", ...seed };
}
