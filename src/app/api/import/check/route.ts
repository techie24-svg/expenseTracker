import { NextResponse } from "next/server";
import { db } from "@/db";
import { transactions, cards } from "@/db/schema";
import { and, eq, isNull, inArray, sql } from "drizzle-orm";

/**
 * Given a set of import hashes for a card, report how many transactions already
 * exist in the database for each hash. The client uses this to flag potential
 * duplicates in the import preview so the user can decide what to keep.
 */
export async function POST(req: Request) {
  try {
    const body = await req.json();
    const cardId: number | null = body.cardId ? Number(body.cardId) : null;
    const hashes: string[] = Array.isArray(body.hashes) ? body.hashes : [];

    if (hashes.length === 0) {
      return NextResponse.json({ counts: {}, matches: {} });
    }

    const cardFilter = cardId
      ? eq(transactions.cardId, cardId)
      : isNull(transactions.cardId);

    const rows = await db
      .select({
        importHash: transactions.importHash,
        txnDate: transactions.txnDate,
        description: transactions.description,
        amount: transactions.amount,
        cardName: cards.name,
        n: sql<number>`count(*)::int`,
      })
      .from(transactions)
      .leftJoin(cards, eq(transactions.cardId, cards.id))
      .where(and(cardFilter, inArray(transactions.importHash, hashes)))
      .groupBy(
        transactions.importHash,
        transactions.txnDate,
        transactions.description,
        transactions.amount,
        cards.name,
      );

    const counts: Record<string, number> = {};
    for (const r of rows) {
      if (r.importHash) counts[r.importHash] = (counts[r.importHash] ?? 0) + r.n;
    }

    return NextResponse.json({ counts });
  } catch (e) {
    return NextResponse.json({ error: (e as Error).message }, { status: 500 });
  }
}
