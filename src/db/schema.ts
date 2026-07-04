import {
  pgTable,
  serial,
  text,
  numeric,
  date,
  timestamp,
  boolean,
  integer,
  pgEnum,
  index,
} from "drizzle-orm/pg-core";

/**
 * Transaction type. We classify every imported/manual row into one of these so
 * we can decide what actually counts as a real expense.
 *
 *  - purchase : normal spend (counts as an expense)
 *  - fee      : annual/membership fee (counts as an expense — this is the real cost of the card)
 *  - interest : interest charges (counts as an expense)
 *  - credit   : statement / offset credit (does NOT count — it's a reimbursement)
 *  - payment  : payment made to the card from checking (does NOT count — it's a transfer)
 *  - refund   : merchant refund / return (does NOT count as spend)
 *  - other    : anything we couldn't confidently classify
 */
export const txnTypeEnum = pgEnum("txn_type", [
  "purchase",
  "fee",
  "interest",
  "credit",
  "payment",
  "refund",
  "other",
]);

export const sourceEnum = pgEnum("txn_source", ["csv", "pdf", "manual"]);

/**
 * How a credit got netted against a purchase.
 *  - none      : not part of any netting pair
 *  - auto      : matched automatically with high confidence
 *  - suggested : a fuzzy match awaiting the user's one-click confirm
 *  - confirmed : user confirmed the match
 */
export const nettingStatusEnum = pgEnum("netting_status", [
  "none",
  "auto",
  "suggested",
  "confirmed",
  "rejected",
]);

export const cards = pgTable("cards", {
  id: serial("id").primaryKey(),
  name: text("name").notNull(),
  issuer: text("issuer"),
  // "Me" / "Spouse" — labels only; totals stay household-wide.
  owner: text("owner"),
  last4: text("last4"),
  annualFee: numeric("annual_fee", { precision: 12, scale: 2 }).default("0"),
  // Closed cards are kept for their historical statements but flagged.
  active: boolean("active").notNull().default(true),
  createdAt: timestamp("created_at").defaultNow().notNull(),
});

export const transactions = pgTable(
  "transactions",
  {
    id: serial("id").primaryKey(),
    source: sourceEnum("source").notNull().default("csv"),
    // Null cardId => a checking-account / manual entry not tied to a card.
    cardId: integer("card_id").references(() => cards.id, {
      onDelete: "set null",
    }),
    // Human-friendly account label ("Amex Platinum", "Checking", ...).
    account: text("account"),
    txnDate: date("txn_date").notNull(),
    description: text("description").notNull(),
    rawDescription: text("raw_description"),
    // Canonical sign: positive = money out (spend/charge), negative = money in.
    amount: numeric("amount", { precision: 12, scale: 2 }).notNull(),
    type: txnTypeEnum("type").notNull().default("purchase"),
    category: text("category").notNull().default("Uncategorized"),
    // User override to force-include/exclude from expense totals.
    excludedFromExpenses: boolean("excluded_from_expenses")
      .notNull()
      .default(false),
    // Netting linkage: points at the counterpart transaction (credit<->purchase).
    nettedWithId: integer("netted_with_id"),
    nettingStatus: nettingStatusEnum("netting_status")
      .notNull()
      .default("none"),
    person: text("person"),
    notes: text("notes"),
    // Dedupe key so re-importing the same statement doesn't double-count.
    importHash: text("import_hash"),
    createdAt: timestamp("created_at").defaultNow().notNull(),
  },
  (t) => ({
    dateIdx: index("txn_date_idx").on(t.txnDate),
    typeIdx: index("txn_type_idx").on(t.type),
    cardIdx: index("txn_card_idx").on(t.cardId),
    hashIdx: index("txn_hash_idx").on(t.importHash),
  }),
);

export type Card = typeof cards.$inferSelect;
export type NewCard = typeof cards.$inferInsert;
export type Transaction = typeof transactions.$inferSelect;
export type NewTransaction = typeof transactions.$inferInsert;
