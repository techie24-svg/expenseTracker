import { NextResponse } from "next/server";
import { db } from "@/db";
import { transactions } from "@/db/schema";
import { inArray } from "drizzle-orm";

/** Apply the same updates (type / category / excluded) to many transactions. */
export async function PATCH(req: Request) {
  try {
    const body = await req.json();
    const ids: number[] = (body.ids ?? []).map(Number).filter(Boolean);
    if (ids.length === 0) {
      return NextResponse.json({ error: "No ids provided" }, { status: 400 });
    }

    const updates: Record<string, unknown> = {};
    if (body.type !== undefined) updates.type = body.type;
    if (body.category !== undefined) updates.category = body.category;
    if (body.excludedFromExpenses !== undefined)
      updates.excludedFromExpenses = Boolean(body.excludedFromExpenses);
    if (body.duplicateReview !== undefined)
      updates.duplicateReview = Boolean(body.duplicateReview);

    if (Object.keys(updates).length === 0) {
      return NextResponse.json({ error: "No updates provided" }, { status: 400 });
    }

    await db
      .update(transactions)
      .set(updates)
      .where(inArray(transactions.id, ids));

    return NextResponse.json({ ok: true, updated: ids.length });
  } catch (e) {
    return NextResponse.json({ error: (e as Error).message }, { status: 500 });
  }
}

/** Delete many transactions, unlinking any netting counterparts first. */
export async function DELETE(req: Request) {
  try {
    const body = await req.json();
    const ids: number[] = (body.ids ?? []).map(Number).filter(Boolean);
    if (ids.length === 0) {
      return NextResponse.json({ error: "No ids provided" }, { status: 400 });
    }

    const rows = await db
      .select({ id: transactions.id, nettedWithId: transactions.nettedWithId })
      .from(transactions)
      .where(inArray(transactions.id, ids));

    const idSet = new Set(ids);
    const counterparts = rows
      .map((r) => r.nettedWithId)
      .filter((x): x is number => Boolean(x) && !idSet.has(x!));

    if (counterparts.length > 0) {
      await db
        .update(transactions)
        .set({ nettedWithId: null, nettingStatus: "none" })
        .where(inArray(transactions.id, counterparts));
    }

    await db.delete(transactions).where(inArray(transactions.id, ids));

    return NextResponse.json({ ok: true, deleted: ids.length });
  } catch (e) {
    return NextResponse.json({ error: (e as Error).message }, { status: 500 });
  }
}
