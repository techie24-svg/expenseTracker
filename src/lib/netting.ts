export interface NettableTxn {
  id: number;
  txnDate: string;
  description: string;
  amount: number; // canonical: positive = spend, negative = money in
  type: string;
  cardId: number | null;
}

export interface MatchSuggestion {
  creditId: number;
  purchaseId: number;
  status: "auto" | "suggested";
  score: number;
  reason: string;
  creditAmount: number;
  purchaseAmount: number;
}

const STOP_WORDS = new Set([
  "the", "and", "inc", "llc", "co", "com", "credit", "statement", "payment",
  "purchase", "charge", "fee", "cash", "usa", "us", "pos", "debit", "card",
  "autopay", "recurring", "monthly", "annual", "of", "for", "to", "at",
]);

function tokens(desc: string): Set<string> {
  return new Set(
    desc
      .toLowerCase()
      .replace(/[^a-z0-9 ]/g, " ")
      .split(/\s+/)
      .filter((w) => w.length > 2 && !STOP_WORDS.has(w)),
  );
}

export function merchantOverlap(a: string, b: string): number {
  const ta = tokens(a);
  const tb = tokens(b);
  if (ta.size === 0 || tb.size === 0) return 0;
  let shared = 0;
  for (const t of ta) if (tb.has(t)) shared++;
  return shared / Math.min(ta.size, tb.size);
}

function daysBetween(a: string, b: string): number {
  const da = new Date(a).getTime();
  const db = new Date(b).getTime();
  return Math.abs(da - db) / (1000 * 60 * 60 * 24);
}

/** High vs medium confidence for a credit<->purchase pair, for the review UI. */
export function matchConfidence(
  creditDescription: string,
  purchaseDescription: string,
): "high" | "medium" {
  return merchantOverlap(creditDescription, purchaseDescription) >= 0.34
    ? "high"
    : "medium";
}

const AMOUNT_TOLERANCE = 0.01; // exact match (allow rounding)
const DATE_WINDOW_DAYS = 62; // credits often post a cycle or two later

/**
 * Suggest netting matches between statement credits and the purchases they
 * offset. Greedy: each credit matches at most one purchase and vice versa.
 *
 * Confidence:
 *  - auto: exact amount + within date window + clear merchant overlap
 *  - suggested: exact amount + within date window, but weak/no merchant overlap
 *
 * Anything without an exact amount match within the window is left alone (so we
 * never silently guess).
 */
export function suggestMatches(txns: NettableTxn[]): MatchSuggestion[] {
  const credits = txns
    .filter((t) => t.type === "credit" && t.amount < 0)
    .sort((a, b) => a.txnDate.localeCompare(b.txnDate));
  const purchases = txns.filter((t) => t.type === "purchase" && t.amount > 0);

  const usedPurchases = new Set<number>();
  const matches: MatchSuggestion[] = [];

  for (const credit of credits) {
    const target = Math.abs(credit.amount);
    let best: { purchase: NettableTxn; score: number; overlap: number } | null =
      null;

    for (const purchase of purchases) {
      if (usedPurchases.has(purchase.id)) continue;
      // Only net within the same card (or both card-less).
      if ((credit.cardId ?? null) !== (purchase.cardId ?? null)) continue;
      if (Math.abs(purchase.amount - target) > AMOUNT_TOLERANCE) continue;
      const dist = daysBetween(credit.txnDate, purchase.txnDate);
      if (dist > DATE_WINDOW_DAYS) continue;

      const overlap = merchantOverlap(credit.description, purchase.description);
      // Prefer closer dates and higher merchant overlap.
      const score = overlap * 2 + (1 - dist / DATE_WINDOW_DAYS);
      if (!best || score > best.score) best = { purchase, score, overlap };
    }

    if (best) {
      usedPurchases.add(best.purchase.id);
      const status: "auto" | "suggested" =
        best.overlap >= 0.34 ? "auto" : "suggested";
      const reason =
        status === "auto"
          ? "Exact amount + matching merchant"
          : "Exact amount, verify merchant";
      matches.push({
        creditId: credit.id,
        purchaseId: best.purchase.id,
        status,
        score: best.score,
        reason,
        creditAmount: credit.amount,
        purchaseAmount: best.purchase.amount,
      });
    }
  }

  return matches;
}
