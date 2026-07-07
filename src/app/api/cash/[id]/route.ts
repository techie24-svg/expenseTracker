import { NextResponse } from "next/server";
import { db } from "@/db";
import { cashWithdrawals } from "@/db/schema";
import { eq } from "drizzle-orm";

export async function PATCH(
  req: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  try {
    const { id } = await params;
    const rowId = Number(id);
    const body = await req.json();

    const updates: Record<string, unknown> = {};
    if (body.person !== undefined)
      updates.person = body.person ? String(body.person).trim() : null;
    if (body.bank !== undefined)
      updates.bank = body.bank ? String(body.bank).trim() : null;
    if (body.method !== undefined)
      updates.method = body.method ? String(body.method).trim() : null;
    if (body.amount !== undefined) updates.amount = Number(body.amount).toFixed(2);
    if (body.withdrawnAt !== undefined)
      updates.withdrawnAt = String(body.withdrawnAt).slice(0, 10);
    if (body.notes !== undefined)
      updates.notes = body.notes ? String(body.notes).trim() : null;

    if (Object.keys(updates).length === 0) {
      return NextResponse.json({ error: "No updates provided" }, { status: 400 });
    }

    const [updated] = await db
      .update(cashWithdrawals)
      .set(updates)
      .where(eq(cashWithdrawals.id, rowId))
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
    await db.delete(cashWithdrawals).where(eq(cashWithdrawals.id, Number(id)));
    return NextResponse.json({ ok: true });
  } catch (e) {
    return NextResponse.json({ error: (e as Error).message }, { status: 500 });
  }
}
