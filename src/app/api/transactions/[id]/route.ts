import { NextResponse } from "next/server";
import { db } from "@/db";
import { transactions } from "@/db/schema";
import { eq } from "drizzle-orm";

export async function PATCH(
  req: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  try {
    const { id } = await params;
    const txnId = Number(id);
    const body = await req.json();

    const updates: Record<string, unknown> = {};
    if (body.type !== undefined) updates.type = body.type;
    if (body.category !== undefined) updates.category = body.category;
    if (body.excludedFromExpenses !== undefined)
      updates.excludedFromExpenses = Boolean(body.excludedFromExpenses);
    if (body.duplicateReview !== undefined)
      updates.duplicateReview = Boolean(body.duplicateReview);
    if (body.description !== undefined)
      updates.description = String(body.description);
    if (body.person !== undefined) updates.person = body.person;
    if (body.notes !== undefined) updates.notes = body.notes;

    if (Object.keys(updates).length === 0) {
      return NextResponse.json({ error: "No updates provided" }, { status: 400 });
    }

    const [updated] = await db
      .update(transactions)
      .set(updates)
      .where(eq(transactions.id, txnId))
      .returning();

    return NextResponse.json(updated);
  } catch (e) {
    return NextResponse.json({ error: (e as Error).message }, { status: 500 });
  }
}

export async function DELETE(
  _req: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  try {
    const { id } = await params;
    const txnId = Number(id);

    // Clean up any netting linkage before deleting.
    const [row] = await db
      .select()
      .from(transactions)
      .where(eq(transactions.id, txnId));
    if (row?.nettedWithId) {
      await db
        .update(transactions)
        .set({ nettedWithId: null, nettingStatus: "none" })
        .where(eq(transactions.id, row.nettedWithId));
    }

    await db.delete(transactions).where(eq(transactions.id, txnId));
    return NextResponse.json({ ok: true });
  } catch (e) {
    return NextResponse.json({ error: (e as Error).message }, { status: 500 });
  }
}
