import Papa from "papaparse";
import { classifyTransaction, type TxnType } from "./classify";
import { categorize } from "./categorize";

export type AmountConvention =
  | "auto"
  | "positive_is_charge" // Amex-style: purchases are positive
  | "negative_is_charge"; // Chase-style: purchases are negative

export interface ParsedTransaction {
  txnDate: string; // ISO yyyy-mm-dd
  description: string;
  rawDescription: string;
  amount: number; // canonical: positive = spend, negative = money in
  rawAmount: number;
  type: TxnType;
  category: string;
}

export interface ParseResult {
  transactions: ParsedTransaction[];
  detectedConvention: Exclude<AmountConvention, "auto">;
  mapping: {
    date: string | null;
    description: string | null;
    amount: string | null;
    debit: string | null;
    credit: string | null;
  };
  skipped: number;
  warnings: string[];
}

const DATE_KEYS = ["transaction date", "trans date", "date", "posted date", "posting date"];
const DESC_KEYS = ["description", "details", "payee", "merchant", "memo", "name", "transaction"];
const AMOUNT_KEYS = ["amount", "amount (usd)", "transaction amount"];
const DEBIT_KEYS = ["debit", "charges", "withdrawal", "withdrawals"];
const CREDIT_KEYS = ["credit", "payments", "deposit", "deposits"];

function findColumn(headers: string[], candidates: string[]): string | null {
  const lower = headers.map((h) => h.trim().toLowerCase());
  // Exact match first.
  for (const cand of candidates) {
    const idx = lower.indexOf(cand);
    if (idx !== -1) return headers[idx];
  }
  // Fallback: contains.
  for (const cand of candidates) {
    const idx = lower.findIndex((h) => h.includes(cand));
    if (idx !== -1) return headers[idx];
  }
  return null;
}

export function parseAmount(raw: unknown): number | null {
  if (raw === null || raw === undefined) return null;
  let s = String(raw).trim();
  if (!s) return null;
  let negative = false;
  // Accounting-style negatives: (123.45)
  if (/^\(.*\)$/.test(s)) {
    negative = true;
    s = s.slice(1, -1);
  }
  if (s.includes("-")) negative = true;
  s = s.replace(/[^0-9.]/g, "");
  if (!s) return null;
  const n = parseFloat(s);
  if (Number.isNaN(n)) return null;
  return negative ? -n : n;
}

export function parseDateFlexible(raw: unknown): string | null {
  if (!raw) return null;
  const s = String(raw).trim();
  if (!s) return null;

  // ISO: yyyy-mm-dd (optionally with time)
  const iso = s.match(/^(\d{4})-(\d{2})-(\d{2})/);
  if (iso) return `${iso[1]}-${iso[2]}-${iso[3]}`;

  // US: mm/dd/yyyy or m/d/yy (also accepts - or .)
  const us = s.match(/^(\d{1,2})[/.-](\d{1,2})[/.-](\d{2,4})/);
  if (us) {
    let [, mm, dd, yy] = us;
    if (yy.length === 2) yy = `20${yy}`;
    return `${yy}-${mm.padStart(2, "0")}-${dd.padStart(2, "0")}`;
  }

  const parsed = new Date(s);
  if (!Number.isNaN(parsed.getTime())) {
    return parsed.toISOString().slice(0, 10);
  }
  return null;
}

function detectConvention(
  amounts: number[],
): Exclude<AmountConvention, "auto"> {
  // Most rows on a statement are purchases. If the majority of nonzero amounts
  // are negative, purchases are represented as negatives (Chase-style).
  let neg = 0;
  let pos = 0;
  for (const a of amounts) {
    if (a < 0) neg++;
    else if (a > 0) pos++;
  }
  return neg > pos ? "negative_is_charge" : "positive_is_charge";
}

export function parseCsv(
  text: string,
  convention: AmountConvention = "auto",
): ParseResult {
  const result = Papa.parse<Record<string, string>>(text, {
    header: true,
    skipEmptyLines: true,
    transformHeader: (h) => h.trim(),
  });

  const warnings: string[] = [];
  const headers = result.meta.fields ?? [];

  const dateCol = findColumn(headers, DATE_KEYS);
  const descCol = findColumn(headers, DESC_KEYS);
  const amountCol = findColumn(headers, AMOUNT_KEYS);
  const debitCol = findColumn(headers, DEBIT_KEYS);
  const creditCol = findColumn(headers, CREDIT_KEYS);

  const mapping = {
    date: dateCol,
    description: descCol,
    amount: amountCol,
    debit: debitCol,
    credit: creditCol,
  };

  if (!dateCol) warnings.push("Could not find a date column.");
  if (!descCol) warnings.push("Could not find a description column.");
  if (!amountCol && !(debitCol || creditCol))
    warnings.push("Could not find an amount (or debit/credit) column.");

  const rows = result.data;
  const usesDebitCredit = !amountCol && Boolean(debitCol || creditCol);

  // First pass: gather raw amounts to auto-detect sign convention.
  const rawAmounts: number[] = [];
  const staged: { date: string; desc: string; raw: number }[] = [];
  let skipped = 0;

  for (const row of rows) {
    const dateStr = dateCol ? parseDateFlexible(row[dateCol]) : null;
    const desc = descCol ? String(row[descCol] ?? "").trim() : "";

    let raw: number | null = null;
    if (usesDebitCredit) {
      const debit = debitCol ? parseAmount(row[debitCol]) : null;
      const credit = creditCol ? parseAmount(row[creditCol]) : null;
      if (debit) raw = Math.abs(debit); // debit = spend => positive
      else if (credit) raw = -Math.abs(credit); // credit = money in => negative
    } else if (amountCol) {
      raw = parseAmount(row[amountCol]);
    }

    if (dateStr === null || raw === null || (!desc && raw === 0)) {
      skipped++;
      continue;
    }
    rawAmounts.push(raw);
    staged.push({ date: dateStr, desc, raw });
  }

  // Debit/credit columns are already canonical (positive=spend); a single amount
  // column needs a convention.
  let detected: Exclude<AmountConvention, "auto">;
  if (usesDebitCredit) {
    detected = "positive_is_charge";
  } else {
    detected =
      convention === "auto" ? detectConvention(rawAmounts) : convention;
  }

  const flip = detected === "negative_is_charge";

  const transactions: ParsedTransaction[] = staged.map((s) => {
    // Canonical: positive = spend.
    const amount = usesDebitCredit ? s.raw : flip ? -s.raw : s.raw;
    const type = classifyTransaction(s.desc, amount);
    return {
      txnDate: s.date,
      description: s.desc,
      rawDescription: s.desc,
      amount: Math.round(amount * 100) / 100,
      rawAmount: s.raw,
      type,
      category: categorize(s.desc),
    };
  });

  return { transactions, detectedConvention: detected, mapping, skipped, warnings };
}

/** Stable hash for dedupe across re-imports of the same statement. */
export function importHash(
  cardId: number | null,
  txnDate: string,
  amount: number,
  description: string,
): string {
  const key = `${cardId ?? "none"}|${txnDate}|${amount.toFixed(2)}|${description
    .toLowerCase()
    .replace(/\s+/g, " ")
    .trim()}`;
  // djb2
  let h = 5381;
  for (let i = 0; i < key.length; i++) h = (h * 33) ^ key.charCodeAt(i);
  return (h >>> 0).toString(16);
}
