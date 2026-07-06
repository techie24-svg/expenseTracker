import { NextResponse } from "next/server";
import { db } from "@/db";
import { transactions, cards } from "@/db/schema";
import { and, desc, eq, gte, lte, sql } from "drizzle-orm";
import { classifyTransaction } from "@/lib/classify";
import { categorize } from "@/lib/categorize";
import { importHash } from "@/lib/csv";

export async function GET(req: Request) {
  try {
    const { searchParams } = new URL(req.url);
    const month = searchParams.get("month"); // yyyy-mm
    const type = searchParams.get("type");
    const cardId = searchParams.get("cardId");
    const nettingStatus = searchParams.get("nettingStatus");

    const filters = [];
    if (month) {
      filters.push(gte(transactions.txnDate, `${month}-01`));
      // exclusive upper bound: first day of next month
      const [y, m] = month.split("-").map(Number);
      const next = m === 12 ? `${y + 1}-01-01` : `${y}-${String(m + 1).padStart(2, "0")}-01`;
      filters.push(lte(transactions.txnDate, next));
    }
    if (type) filters.push(eq(transactions.type, type as never));
    if (cardId) filters.push(eq(transactions.cardId, Number(cardId)));
    if (nettingStatus)
      filters.push(eq(transactions.nettingStatus, nettingStatus as never));

    const rows = await db
      .select({
        id: transactions.id,
        source: transactions.source,
        cardId: transactions.cardId,
        account: transactions.account,
        txnDate: transactions.txnDate,
        description: transactions.description,
        amount: transactions.amount,
        type: transactions.type,
        category: transactions.category,
        excludedFromExpenses: transactions.excludedFromExpenses,
        duplicateReview: transactions.duplicateReview,
        nettedWithId: transactions.nettedWithId,
        nettingStatus: transactions.nettingStatus,
        person: transactions.person,
        notes: transactions.notes,
        importHash: transactions.importHash,
        cardName: cards.name,
        cardOwner: cards.owner,
      })
      .from(transactions)
      .leftJoin(cards, eq(transactions.cardId, cards.id))
      .where(filters.length ? and(...filters) : undefined)
      .orderBy(desc(transactions.txnDate), desc(transactions.id));

    return NextResponse.json(rows);
  } catch (e) {
    return NextResponse.json({ error: (e as Error).message }, { status: 500 });
  }
}

/** Manual transaction entry (e.g. checking-account expenses). */
export async function POST(req: Request) {
  try {
    const body = await req.json();
    const txnDate = String(body.txnDate ?? "").slice(0, 10);
    const description = String(body.description ?? "").trim();
    const amount = Number(body.amount);

    if (!txnDate || !description || Number.isNaN(amount)) {
      return NextResponse.json(
        { error: "txnDate, description and amount are required" },
        { status: 400 },
      );
    }

    const type = body.type || classifyTransaction(description, amount);
    const category = body.category || categorize(description);
    const cardId = body.cardId ? Number(body.cardId) : null;
    const account = body.account
      ? String(body.account).trim()
      : cardId
        ? null
        : "Checking";

    const [created] = await db
      .insert(transactions)
      .values({
        source: "manual",
        cardId,
        account,
        txnDate,
        description,
        rawDescription: description,
        amount: amount.toFixed(2),
        type,
        category,
        person: body.person ? String(body.person).trim() : null,
        notes: body.notes ? String(body.notes).trim() : null,
        importHash: importHash(cardId, txnDate, amount, description),
      })
      .returning();

    return NextResponse.json(created, { status: 201 });
  } catch (e) {
    return NextResponse.json({ error: (e as Error).message }, { status: 500 });
  }
}
