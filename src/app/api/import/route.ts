import { NextResponse } from "next/server";
import { db } from "@/db";
import { transactions, cards } from "@/db/schema";
import { eq } from "drizzle-orm";
import { importHash, type ParsedTransaction } from "@/lib/csv";
import { rescanNetting } from "@/lib/applyNetting";

export async function POST(req: Request) {
  try {
    const body = await req.json();
    const cardId: number | null = body.cardId ? Number(body.cardId) : null;
    const source = (body.source as "csv" | "pdf") || "csv";
    const parsed = (body.transactions ?? []) as ParsedTransaction[];

    if (!Array.isArray(parsed) || parsed.length === 0) {
      return NextResponse.json(
        { error: "No transactions to import" },
        { status: 400 },
      );
    }

    let account: string | null = body.account ?? null;
    if (cardId && !account) {
      const [card] = await db.select().from(cards).where(eq(cards.id, cardId));
      account = card?.name ?? null;
    }

    // The client has already reviewed duplicates and only sends rows the user
    // approved, so we insert exactly what we receive — no silent skipping.
    const toInsert = parsed.map((t) => ({
      source,
      cardId,
      account,
      txnDate: t.txnDate,
      description: t.description,
      rawDescription: t.rawDescription ?? t.description,
      amount: t.amount.toFixed(2),
      type: t.type,
      category: t.category,
      importHash: importHash(cardId, t.txnDate, t.amount, t.description),
    }));

    let inserted = 0;
    if (toInsert.length) {
      const rows = await db.insert(transactions).values(toInsert).returning({
        id: transactions.id,
      });
      inserted = rows.length;
    }

    const netting = await rescanNetting();

    return NextResponse.json({
      inserted,
      netting,
    });
  } catch (e) {
    return NextResponse.json({ error: (e as Error).message }, { status: 500 });
  }
}
