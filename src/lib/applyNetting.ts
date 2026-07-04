import { db } from "@/db";
import { transactions } from "@/db/schema";
import { eq, inArray } from "drizzle-orm";
import { suggestMatches, type NettableTxn } from "@/lib/netting";

/**
 * Recompute netting suggestions across all not-yet-decided transactions and
 * persist them: confident matches as "auto" (removed from expenses), fuzzy ones
 * as "suggested" (still counted until the user confirms). Rows already
 * confirmed/rejected/auto are left untouched.
 */
export async function rescanNetting() {
  const rows = await db
    .select({
      id: transactions.id,
      txnDate: transactions.txnDate,
      description: transactions.description,
      amount: transactions.amount,
      type: transactions.type,
      cardId: transactions.cardId,
      nettingStatus: transactions.nettingStatus,
    })
    .from(transactions);

  const pending: NettableTxn[] = rows
    .filter((r) => r.nettingStatus === "none")
    .map((r) => ({
      id: r.id,
      txnDate: r.txnDate,
      description: r.description,
      amount: Number(r.amount),
      type: r.type,
      cardId: r.cardId,
    }));

  const matches = suggestMatches(pending);

  let auto = 0;
  let suggested = 0;
  for (const m of matches) {
    await db
      .update(transactions)
      .set({ nettingStatus: m.status, nettedWithId: m.purchaseId })
      .where(eq(transactions.id, m.creditId));
    await db
      .update(transactions)
      .set({ nettingStatus: m.status, nettedWithId: m.creditId })
      .where(eq(transactions.id, m.purchaseId));
    if (m.status === "auto") auto++;
    else suggested++;
  }

  return { auto, suggested, total: matches.length };
}

export async function setMatchStatus(
  creditId: number,
  purchaseId: number,
  status: "confirmed" | "rejected",
) {
  if (status === "confirmed") {
    await db
      .update(transactions)
      .set({ nettingStatus: "confirmed", nettedWithId: purchaseId })
      .where(eq(transactions.id, creditId));
    await db
      .update(transactions)
      .set({ nettingStatus: "confirmed", nettedWithId: creditId })
      .where(eq(transactions.id, purchaseId));
  } else {
    // Rejected: unlink so they behave as independent transactions, and mark so
    // a future rescan won't re-suggest the same pair.
    await db
      .update(transactions)
      .set({ nettingStatus: "rejected", nettedWithId: null })
      .where(inArray(transactions.id, [creditId, purchaseId]));
  }
}
