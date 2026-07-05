import { NextResponse } from "next/server";
import { db } from "@/db";
import { transactions, cards } from "@/db/schema";
import { eq } from "drizzle-orm";
import { type TxnType } from "@/lib/classify";

export async function GET(req: Request) {
  try {
    const { searchParams } = new URL(req.url);
    const month = searchParams.get("month"); // yyyy-mm, optional

    const rows = await db
      .select({
        id: transactions.id,
        cardId: transactions.cardId,
        txnDate: transactions.txnDate,
        amount: transactions.amount,
        type: transactions.type,
        category: transactions.category,
        excludedFromExpenses: transactions.excludedFromExpenses,
        nettingStatus: transactions.nettingStatus,
        cardName: cards.name,
      })
      .from(transactions)
      .leftJoin(cards, eq(transactions.cardId, cards.id));

    const inMonth = (d: string) => !month || d.slice(0, 7) === month;

    let trueExpenses = 0;
    let annualFees = 0;
    let interest = 0;
    let creditsCaptured = 0; // total value of offset/statement credits received
    let rawSpend = 0; // all purchases before netting
    let needsReview = 0;

    const byCategory: Record<string, number> = {};
    const byCard: Record<string, number> = {};
    const byMonth: Record<string, number> = {};
    // Per-category breakdowns for stacked bar charts.
    const monthCat: Record<string, Record<string, number>> = {};
    const cardCat: Record<string, Record<string, number>> = {};
    const catTotals: Record<string, number> = {}; // all-time, for stable ordering/colors

    for (const r of rows) {
      const amt = Number(r.amount);
      const type = r.type as TxnType;
      const netted =
        r.nettingStatus === "auto" || r.nettingStatus === "confirmed";

      // A row contributes to the true-expense total when it isn't excluded and
      // isn't netted out. Purchases/fees/interest add (positive); credits and
      // refunds subtract (they're stored negative). Payments never count.
      //
      // Because un-netted credits count negatively, a partial/unmatched credit
      // still reduces the total — and netting a pair (removing both) yields the
      // same total, so the number is always correct regardless of netting state.
      const contributes =
        !r.excludedFromExpenses &&
        !netted &&
        (type === "purchase" ||
          type === "fee" ||
          type === "interest" ||
          type === "credit" ||
          type === "refund");

      // Month trend is computed across all months regardless of the filter.
      if (contributes) {
        const mk = r.txnDate.slice(0, 7);
        byMonth[mk] = (byMonth[mk] ?? 0) + amt;
        if (!monthCat[mk]) monthCat[mk] = {};
        monthCat[mk][r.category] = (monthCat[mk][r.category] ?? 0) + amt;
        catTotals[r.category] = (catTotals[r.category] ?? 0) + amt;
      }

      if (r.nettingStatus === "suggested" && type === "credit") needsReview++;

      if (!inMonth(r.txnDate)) continue;

      if (type === "purchase" && !r.excludedFromExpenses) rawSpend += amt;
      if (type === "credit" && !r.excludedFromExpenses) {
        creditsCaptured += Math.abs(amt);
      }

      if (contributes) {
        trueExpenses += amt;
        byCategory[r.category] = (byCategory[r.category] ?? 0) + amt;
        const cardKey = r.cardName ?? "Checking / Manual";
        byCard[cardKey] = (byCard[cardKey] ?? 0) + amt;
        if (!cardCat[cardKey]) cardCat[cardKey] = {};
        cardCat[cardKey][r.category] = (cardCat[cardKey][r.category] ?? 0) + amt;
        if (type === "fee") annualFees += amt;
        if (type === "interest") interest += amt;
      }
    }

    const toSorted = (obj: Record<string, number>) =>
      Object.entries(obj)
        .map(([name, value]) => ({ name, value: Math.round(value * 100) / 100 }))
        .sort((a, b) => b.value - a.value);

    const round = (n: number) => Math.round(n * 100) / 100;

    // Category order (highest all-time spend first) drives stacking order,
    // colors, and the legend across both charts.
    const categoryKeys = Object.entries(catTotals)
      .sort((a, b) => b[1] - a[1])
      .map(([name]) => name);

    // Turn a {key: {cat: amt}} map into rows: { name, <cat>: amt, ... } with a
    // zero for every category key so stacked bars line up.
    const stack = (
      map: Record<string, Record<string, number>>,
      order: string[],
    ) =>
      order.map((name) => {
        const row: Record<string, string | number> = { name };
        for (const cat of categoryKeys) row[cat] = round(map[name]?.[cat] ?? 0);
        return row;
      });

    const monthsAsc = Object.keys(byMonth).sort((a, b) => a.localeCompare(b));
    const cardsByTotal = toSorted(byCard).map((c) => c.name);

    return NextResponse.json({
      month: month ?? "all",
      trueExpenses: Math.round(trueExpenses * 100) / 100,
      rawSpend: Math.round(rawSpend * 100) / 100,
      annualFees: Math.round(annualFees * 100) / 100,
      interest: Math.round(interest * 100) / 100,
      creditsCaptured: Math.round(creditsCaptured * 100) / 100,
      needsReview,
      byCategory: toSorted(byCategory),
      byCard: toSorted(byCard),
      byMonth: Object.entries(byMonth)
        .map(([name, value]) => ({ name, value: Math.round(value * 100) / 100 }))
        .sort((a, b) => a.name.localeCompare(b.name)),
      categoryKeys,
      byMonthStacked: stack(monthCat, monthsAsc),
      byCardStacked: stack(cardCat, cardsByTotal),
    });
  } catch (e) {
    return NextResponse.json({ error: (e as Error).message }, { status: 500 });
  }
}
