import type { txnTypeEnum } from "@/db/schema";

export type TxnType = (typeof txnTypeEnum.enumValues)[number];

/**
 * Which transaction types actually count toward your "true expenses".
 * Credits, payments, and refunds never count.
 */
export const EXPENSE_TYPES: readonly TxnType[] = ["purchase", "fee", "interest"];

export function isExpenseType(type: TxnType): boolean {
  return EXPENSE_TYPES.includes(type);
}

/**
 * The single source of truth for "does this transaction count toward true
 * expenses". Credits/payments/refunds never count. A purchase that's been netted
 * against a credit (auto or confirmed) drops out. A user can force-exclude too.
 */
export function countsAsExpense(t: {
  type: TxnType;
  excludedFromExpenses: boolean;
  nettingStatus: string;
}): boolean {
  if (!isExpenseType(t.type)) return false;
  if (t.excludedFromExpenses) return false;
  if (t.nettingStatus === "auto" || t.nettingStatus === "confirmed")
    return false;
  return true;
}

const FEE_PATTERNS = [
  /\bannual fee\b/i,
  /\bmembership fee\b/i,
  /\bcard fee\b/i,
  /\bclub fee\b/i,
];

const PAYMENT_PATTERNS = [
  /\bpayment\b/i,
  /\bautopay\b/i,
  /\bthank you\b/i,
  /\bonline payment\b/i,
  /\bmobile payment\b/i,
  /\be-?payment\b/i,
  /\bpymt\b/i,
  /\bdirect debit\b/i,
];

const INTEREST_PATTERNS = [
  /\binterest charge\b/i,
  /\binterest charged\b/i,
  /\bpurchase interest\b/i,
  /\bfinance charge\b/i,
];

// Statement credits / offset credits from premium cards. These are the ones we
// want to net out rather than treat as spend. Tuned for the household's cards:
// Amex Platinum, Amex Marriott Brilliant, Chase Sapphire Reserve/Preferred,
// Marriott, United, etc.
const CREDIT_PATTERNS = [
  /\bstatement credit\b/i,
  /\bcredit\b/i,
  // Amex Platinum credits
  /\bairline\s*(fee)?\s*credit\b/i,
  /\bincidental\b/i,
  /\buber cash\b/i,
  /\bdigital entertainment\b/i,
  /\bclear\b/i,
  /\bsaks\b/i,
  /\bequinox\b/i,
  /\bwalmart\+?\b/i,
  /\bentertainment credit\b/i,
  /\bstreaming credit\b/i,
  // Amex Marriott Brilliant / Bonvoy
  /\bmarriott.*credit\b/i,
  /\bbonvoy.*credit\b/i,
  /\bdining credit\b/i,
  // Chase Sapphire Reserve / Preferred
  /\btravel credit\b/i,
  /\bannual travel\b/i,
  /\bhotel credit\b/i,
  /\bdoordash\b/i,
  /\bdashpass\b/i,
  /\blyft\b.*credit/i,
  /\binstacart\b/i,
  /\bresy\b/i,
  /\bpeloton\b/i,
  /\bstubhub\b/i,
  // United Quest / Capital One Venture X
  /\btravelbank\b/i,
  /\bunited.*credit\b/i,
  /\brideshare\b/i,
  /\bcapital one travel\b/i,
  /\bglobal entry\b/i,
  /\btsa pre\b/i,
  // Generic
  /\breimbursement\b/i,
  /\bcredit adjustment\b/i,
  /\bcash back\b/i,
  /\bcashback\b/i,
  /\bredemption\b/i,
  /\brebate\b/i,
];

const REFUND_PATTERNS = [/\brefund\b/i, /\breturn\b/i, /\breversal\b/i];

/**
 * Classify a transaction from its description + canonical amount.
 *
 * Amount convention here is canonical: positive = money out (spend/charge),
 * negative = money in (credit/payment/refund). CSV/PDF importers normalize to
 * this convention before calling classify().
 */
export function classifyTransaction(
  description: string,
  amount: number,
): TxnType {
  const desc = description || "";

  // Fees & interest are charges (positive) but must be caught before the generic
  // "purchase" fallback.
  if (FEE_PATTERNS.some((p) => p.test(desc))) return "fee";
  if (INTEREST_PATTERNS.some((p) => p.test(desc))) return "interest";

  // Money coming back (negative amounts).
  if (amount < 0) {
    if (PAYMENT_PATTERNS.some((p) => p.test(desc))) return "payment";
    if (REFUND_PATTERNS.some((p) => p.test(desc))) return "refund";
    // Any remaining credit-side line is a statement/offset credit.
    if (CREDIT_PATTERNS.some((p) => p.test(desc))) return "credit";
    // Unlabeled negative amounts are most often payments or credits; default to
    // credit so they don't accidentally count as spend.
    return "credit";
  }

  // Positive amount that reads like a payment reversal is rare; treat as purchase.
  return "purchase";
}
