import { db } from "../db";
import { cards } from "../db/schema";
import { and, eq } from "drizzle-orm";

// Annual fees are best-guesses for typical versions of each product — edit any
// of them on the Cards page after seeding. Owner is just a label; totals stay
// household-wide.
export const SEED_CARDS: {
  name: string;
  issuer: string;
  owner: "Me" | "Spouse";
  annualFee: number;
  active?: boolean;
}[] = [
  // ---- Me ----
  { name: "Discover", issuer: "Discover", owner: "Me", annualFee: 0 },
  { name: "Amex Platinum", issuer: "Amex", owner: "Me", annualFee: 895 },
  { name: "Amex Magnet", issuer: "Amex", owner: "Me", annualFee: 0 },
  { name: "Amex Marriott Brilliant", issuer: "Amex", owner: "Me", annualFee: 650 },
  { name: "Kohl's", issuer: "Kohl's", owner: "Me", annualFee: 0 },
  { name: "Chase Sapphire Preferred", issuer: "Chase", owner: "Me", annualFee: 95 },
  { name: "Chase Freedom Flex", issuer: "Chase", owner: "Me", annualFee: 0 },
  { name: "Chase Quest", issuer: "Chase", owner: "Me", annualFee: 350 },
  { name: "Chase Marriott", issuer: "Chase", owner: "Me", annualFee: 95, active: false },

  // ---- Spouse ----
  { name: "Amex Platinum", issuer: "Amex", owner: "Spouse", annualFee: 895 },
  { name: "Amex Blue Cash", issuer: "Amex", owner: "Spouse", annualFee: 0 },
  { name: "Chase Marriott", issuer: "Chase", owner: "Spouse", annualFee: 0 },
  { name: "Chase United", issuer: "Chase", owner: "Spouse", annualFee: 350 },
  { name: "Amazon Prime", issuer: "Chase", owner: "Spouse", annualFee: 0 },
  { name: "Capital One", issuer: "Capital One", owner: "Spouse", annualFee: 395 },
  { name: "Chase Sapphire Reserve", issuer: "Chase", owner: "Spouse", annualFee: 795 },
  { name: "Macy's", issuer: "Macy's", owner: "Spouse", annualFee: 0 },
];

/** Idempotently insert the household's cards. Skips ones that already exist. */
export async function seedCards() {
  let inserted = 0;
  let skipped = 0;
  for (const c of SEED_CARDS) {
    const existing = await db
      .select({ id: cards.id })
      .from(cards)
      .where(and(eq(cards.name, c.name), eq(cards.owner, c.owner)));
    if (existing.length) {
      skipped++;
      continue;
    }
    await db.insert(cards).values({
      name: c.name,
      issuer: c.issuer,
      owner: c.owner,
      annualFee: c.annualFee.toFixed(2),
      active: c.active ?? true,
    });
    inserted++;
  }
  return { inserted, skipped };
}
