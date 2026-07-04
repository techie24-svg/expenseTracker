import { NextResponse } from "next/server";
import { db } from "@/db";
import { transactions } from "@/db/schema";
import { inArray } from "drizzle-orm";
import { categorize } from "@/lib/categorize";

/**
 * Re-apply the auto-categorization rules to existing transactions.
 *  - body.onlyUncategorized (default false): if true, only touch rows currently
 *    "Uncategorized" so manual category edits are preserved.
 */
export async function POST(req: Request) {
  try {
    const body = await req.json().catch(() => ({}));
    const onlyUncategorized = Boolean(body.onlyUncategorized);

    const rows = await db
      .select({
        id: transactions.id,
        description: transactions.description,
        category: transactions.category,
      })
      .from(transactions);

    // Group ids by the new category so we can update in a few batches.
    const byNewCategory = new Map<string, number[]>();
    for (const r of rows) {
      if (onlyUncategorized && r.category !== "Uncategorized") continue;
      const next = categorize(r.description);
      if (next === r.category) continue;
      if (!byNewCategory.has(next)) byNewCategory.set(next, []);
      byNewCategory.get(next)!.push(r.id);
    }

    let updated = 0;
    for (const [category, ids] of byNewCategory) {
      if (ids.length === 0) continue;
      await db
        .update(transactions)
        .set({ category })
        .where(inArray(transactions.id, ids));
      updated += ids.length;
    }

    return NextResponse.json({ ok: true, updated });
  } catch (e) {
    return NextResponse.json({ error: (e as Error).message }, { status: 500 });
  }
}
