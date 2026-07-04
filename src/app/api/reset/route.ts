import { NextResponse } from "next/server";
import { db } from "@/db";
import { transactions, cards } from "@/db/schema";
import { seedCards } from "@/lib/seedData";

/**
 * Destructive reset.
 *  - scope "transactions": delete all transactions, keep cards.
 *  - scope "all": delete all transactions and cards, then re-seed the household
 *    cards from scratch.
 */
export async function POST(req: Request) {
  try {
    const body = await req.json().catch(() => ({}));
    const scope = body.scope === "all" ? "all" : "transactions";

    await db.delete(transactions);
    const result: { scope: string; reseeded?: number } = { scope };

    if (scope === "all") {
      await db.delete(cards);
      const seed = await seedCards();
      result.reseeded = seed.inserted;
    }

    return NextResponse.json({ ok: true, ...result });
  } catch (e) {
    return NextResponse.json({ error: (e as Error).message }, { status: 500 });
  }
}
