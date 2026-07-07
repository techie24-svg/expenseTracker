import { NextResponse } from "next/server";
import { db } from "@/db";
import { cashWithdrawals } from "@/db/schema";
import { desc } from "drizzle-orm";

export async function GET() {
  try {
    const rows = await db
      .select()
      .from(cashWithdrawals)
      .orderBy(desc(cashWithdrawals.withdrawnAt), desc(cashWithdrawals.id));
    return NextResponse.json(rows);
  } catch (e) {
    return NextResponse.json({ error: (e as Error).message }, { status: 500 });
  }
}

export async function POST(req: Request) {
  try {
    const body = await req.json();
    const withdrawnAt = String(body.withdrawnAt ?? "").slice(0, 10);
    const amount = Number(body.amount);

    if (!withdrawnAt || Number.isNaN(amount)) {
      return NextResponse.json(
        { error: "withdrawnAt and amount are required" },
        { status: 400 },
      );
    }

    const [created] = await db
      .insert(cashWithdrawals)
      .values({
        person: body.person ? String(body.person).trim() : null,
        bank: body.bank ? String(body.bank).trim() : null,
        method: body.method ? String(body.method).trim() : null,
        amount: amount.toFixed(2),
        withdrawnAt,
        notes: body.notes ? String(body.notes).trim() : null,
      })
      .returning();

    return NextResponse.json(created, { status: 201 });
  } catch (e) {
    return NextResponse.json({ error: (e as Error).message }, { status: 500 });
  }
}
