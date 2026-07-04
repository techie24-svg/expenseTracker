import { NextResponse } from "next/server";
import { db } from "@/db";
import { transactions, cards } from "@/db/schema";
import { eq, and } from "drizzle-orm";
import { rescanNetting, setMatchStatus } from "@/lib/applyNetting";
import { alias } from "drizzle-orm/pg-core";

/** Return the "needs review" queue: suggested credit<->purchase pairs. */
export async function GET() {
  try {
    const purchase = alias(transactions, "purchase");
    const rows = await db
      .select({
        creditId: transactions.id,
        creditDate: transactions.txnDate,
        creditDescription: transactions.description,
        creditAmount: transactions.amount,
        creditCardName: cards.name,
        purchaseId: purchase.id,
        purchaseDate: purchase.txnDate,
        purchaseDescription: purchase.description,
        purchaseAmount: purchase.amount,
      })
      .from(transactions)
      .innerJoin(purchase, eq(transactions.nettedWithId, purchase.id))
      .leftJoin(cards, eq(transactions.cardId, cards.id))
      .where(
        and(
          eq(transactions.nettingStatus, "suggested"),
          eq(transactions.type, "credit"),
        ),
      );

    return NextResponse.json(rows);
  } catch (e) {
    return NextResponse.json({ error: (e as Error).message }, { status: 500 });
  }
}

export async function POST(req: Request) {
  try {
    const body = await req.json();
    const action = body.action as string;

    if (action === "rescan") {
      const result = await rescanNetting();
      return NextResponse.json(result);
    }

    if (action === "confirm" || action === "reject") {
      const creditId = Number(body.creditId);
      const purchaseId = Number(body.purchaseId);
      if (!creditId || !purchaseId) {
        return NextResponse.json(
          { error: "creditId and purchaseId required" },
          { status: 400 },
        );
      }
      await setMatchStatus(
        creditId,
        purchaseId,
        action === "confirm" ? "confirmed" : "rejected",
      );
      return NextResponse.json({ ok: true });
    }

    return NextResponse.json({ error: "Unknown action" }, { status: 400 });
  } catch (e) {
    return NextResponse.json({ error: (e as Error).message }, { status: 500 });
  }
}
