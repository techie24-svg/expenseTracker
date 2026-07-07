import { NextResponse } from "next/server";
import { db } from "@/db";
import { cashWithdrawals } from "@/db/schema";

/** Bulk-insert cash withdrawals parsed from a pasted / uploaded CSV. */
export async function POST(req: Request) {
  try {
    const body = await req.json();
    const items = Array.isArray(body.items) ? body.items : [];

    const values = items
      .map((it: Record<string, unknown>) => ({
        person: it.person ? String(it.person).trim() : null,
        bank: it.bank ? String(it.bank).trim() : null,
        accountType: it.accountType ? String(it.accountType).trim() : null,
        method: it.method ? String(it.method).trim() : null,
        amount: Number(it.amount),
        withdrawnAt: String(it.withdrawnAt ?? "").slice(0, 10),
        notes: it.notes ? String(it.notes).trim() : null,
      }))
      .filter(
        (v: { amount: number; withdrawnAt: string }) =>
          v.withdrawnAt && !Number.isNaN(v.amount),
      )
      .map((v: { amount: number } & Record<string, unknown>) => ({
        ...v,
        amount: v.amount.toFixed(2),
      }));

    if (values.length === 0) {
      return NextResponse.json(
        { error: "No valid rows to import" },
        { status: 400 },
      );
    }

    const rows = await db
      .insert(cashWithdrawals)
      .values(values)
      .returning({ id: cashWithdrawals.id });

    return NextResponse.json({ inserted: rows.length });
  } catch (e) {
    return NextResponse.json({ error: (e as Error).message }, { status: 500 });
  }
}
