"use client";

import { useEffect, useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import { Panel, Button } from "@/components/ui";
import { formatCurrency, formatDate } from "@/lib/utils";
import {
  parseCsv,
  type ParseResult,
  type AmountConvention,
  type ParsedTransaction,
} from "@/lib/csv";
import { CATEGORIES } from "@/lib/categorize";
import type { TxnType } from "@/lib/classify";
import { Upload, FileText, CheckCircle2, RefreshCw } from "lucide-react";

interface Card {
  id: number;
  name: string;
  owner: string | null;
}

const TYPES: TxnType[] = [
  "purchase",
  "fee",
  "interest",
  "credit",
  "payment",
  "refund",
  "other",
];

export default function ImportPage() {
  const router = useRouter();
  const [cards, setCards] = useState<Card[]>([]);
  const [cardId, setCardId] = useState<string>("");
  const [fileName, setFileName] = useState("");
  const [rawText, setRawText] = useState("");
  const [convention, setConvention] = useState<AmountConvention>("auto");
  const [rows, setRows] = useState<ParsedTransaction[]>([]);
  const [result, setResult] = useState<ParseResult | null>(null);
  const [committing, setCommitting] = useState(false);
  const [done, setDone] = useState<{ inserted: number; duplicates: number } | null>(
    null,
  );

  useEffect(() => {
    fetch("/api/cards")
      .then((r) => r.json())
      .then((d) => Array.isArray(d) && setCards(d))
      .catch(() => {});
  }, []);

  function runParse(text: string, conv: AmountConvention) {
    const res = parseCsv(text, conv);
    setResult(res);
    setRows(res.transactions);
    if (conv === "auto") setConvention(res.detectedConvention);
  }

  async function onFile(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    if (!file) return;
    setFileName(file.name);
    setDone(null);
    const text = await file.text();
    setRawText(text);
    runParse(text, "auto");
  }

  function changeConvention(conv: AmountConvention) {
    setConvention(conv);
    if (rawText) runParse(rawText, conv);
  }

  function setRowType(idx: number, type: TxnType) {
    setRows((prev) =>
      prev.map((r, i) => (i === idx ? { ...r, type } : r)),
    );
  }

  function setRowCategory(idx: number, category: string) {
    setRows((prev) =>
      prev.map((r, i) => (i === idx ? { ...r, category } : r)),
    );
  }

  const summary = useMemo(() => {
    const s = { expenses: 0, credits: 0, payments: 0, fees: 0 };
    for (const r of rows) {
      if (r.type === "purchase") s.expenses += r.amount;
      else if (r.type === "credit" || r.type === "refund")
        s.credits += Math.abs(r.amount);
      else if (r.type === "payment") s.payments += Math.abs(r.amount);
      else if (r.type === "fee" || r.type === "interest") s.fees += r.amount;
    }
    return s;
  }, [rows]);

  async function commit() {
    setCommitting(true);
    try {
      const res = await fetch("/api/import", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          cardId: cardId || null,
          source: "csv",
          transactions: rows,
        }),
      });
      const data = await res.json();
      if (data.error) {
        alert(data.error);
      } else {
        setDone({ inserted: data.inserted, duplicates: data.duplicates });
        setRows([]);
        setResult(null);
        setRawText("");
        setFileName("");
      }
    } finally {
      setCommitting(false);
    }
  }

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold tracking-tight">Import statement</h1>
        <p className="text-sm text-slate-500">
          Upload a credit card statement CSV. We&apos;ll auto-classify fees,
          credits, and payments so only real spend counts.
        </p>
      </div>

      {done ? (
        <Panel className="border-emerald-200 bg-emerald-50">
          <div className="flex items-center gap-3">
            <CheckCircle2 className="h-6 w-6 text-emerald-600" />
            <div>
              <p className="font-semibold text-emerald-800">
                Imported {done.inserted} transaction
                {done.inserted === 1 ? "" : "s"}
              </p>
              <p className="text-sm text-emerald-700">
                {done.duplicates > 0
                  ? `${done.duplicates} duplicate(s) skipped. `
                  : ""}
                Credits were auto-netted where confident.
              </p>
            </div>
            <div className="ml-auto flex gap-2">
              <Button variant="secondary" onClick={() => setDone(null)}>
                Import another
              </Button>
              <Button onClick={() => router.push("/")}>View dashboard</Button>
            </div>
          </div>
        </Panel>
      ) : null}

      {!done ? (
        <Panel className="space-y-4">
          <div className="grid gap-4 sm:grid-cols-2">
            <label className="block">
              <span className="mb-1 block text-sm font-medium text-slate-700">
                Card
              </span>
              <select
                value={cardId}
                onChange={(e) => setCardId(e.target.value)}
                className="w-full rounded-lg border border-slate-300 bg-white px-3 py-2 text-sm"
              >
                <option value="">Unassigned</option>
                {cards.map((c) => (
                  <option key={c.id} value={c.id}>
                    {c.name}
                    {c.owner ? ` (${c.owner})` : ""}
                  </option>
                ))}
              </select>
              {cards.length === 0 ? (
                <span className="mt-1 block text-xs text-slate-400">
                  Tip: add your cards on the Cards page first.
                </span>
              ) : null}
            </label>

            <label className="block">
              <span className="mb-1 block text-sm font-medium text-slate-700">
                Statement file (.csv)
              </span>
              <div className="flex items-center gap-2">
                <label className="flex cursor-pointer items-center gap-2 rounded-lg border border-dashed border-slate-300 px-3 py-2 text-sm text-slate-600 hover:bg-slate-50">
                  <Upload className="h-4 w-4" />
                  {fileName || "Choose CSV file"}
                  <input
                    type="file"
                    accept=".csv,text/csv"
                    className="hidden"
                    onChange={onFile}
                  />
                </label>
              </div>
            </label>
          </div>

          <div className="rounded-lg border border-slate-200 bg-slate-50 p-3 text-xs text-slate-500">
            <FileText className="mr-1 inline h-3.5 w-3.5" />
            PDF statements are coming per-card — for now export CSV from your
            bank (works with Amex, Chase, Citi, Capital One, etc.).
          </div>
        </Panel>
      ) : null}

      {result && rows.length > 0 ? (
        <>
          <Panel className="space-y-4">
            <div className="flex flex-wrap items-center justify-between gap-3">
              <h3 className="text-sm font-semibold text-slate-700">
                Preview — {rows.length} transactions
              </h3>
              <div className="flex items-center gap-2 text-sm">
                <span className="text-slate-500">Sign convention:</span>
                <select
                  value={convention}
                  onChange={(e) =>
                    changeConvention(e.target.value as AmountConvention)
                  }
                  className="rounded-lg border border-slate-300 bg-white px-2 py-1.5 text-sm"
                >
                  <option value="positive_is_charge">
                    Positive = charge (Amex-style)
                  </option>
                  <option value="negative_is_charge">
                    Negative = charge (Chase-style)
                  </option>
                </select>
                <button
                  onClick={() =>
                    changeConvention(
                      convention === "positive_is_charge"
                        ? "negative_is_charge"
                        : "positive_is_charge",
                    )
                  }
                  className="flex items-center gap-1 rounded-lg border border-slate-300 px-2 py-1.5 text-slate-600 hover:bg-slate-50"
                  title="Flip if the amounts look inverted"
                >
                  <RefreshCw className="h-3.5 w-3.5" /> Flip
                </button>
              </div>
            </div>

            <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
              <MiniStat label="Purchases" value={formatCurrency(summary.expenses)} />
              <MiniStat
                label="Fees / interest"
                value={formatCurrency(summary.fees)}
              />
              <MiniStat
                label="Credits"
                value={formatCurrency(summary.credits)}
                good
              />
              <MiniStat
                label="Payments"
                value={formatCurrency(summary.payments)}
                muted
              />
            </div>

            {result.warnings.length > 0 ? (
              <div className="rounded-lg border border-amber-200 bg-amber-50 p-3 text-xs text-amber-700">
                {result.warnings.join(" ")} Detected columns:{" "}
                {Object.entries(result.mapping)
                  .filter(([, v]) => v)
                  .map(([k, v]) => `${k}=${v}`)
                  .join(", ")}
              </div>
            ) : null}

            <Button onClick={commit} disabled={committing}>
              {committing ? "Importing…" : `Import ${rows.length} transactions`}
            </Button>
          </Panel>

          <Panel className="overflow-hidden p-0">
            <div className="max-h-[28rem] overflow-auto">
              <table className="w-full text-sm">
                <thead className="sticky top-0 bg-slate-50 text-left text-xs uppercase tracking-wide text-slate-500">
                  <tr>
                    <th className="px-4 py-2 font-medium">Date</th>
                    <th className="px-4 py-2 font-medium">Description</th>
                    <th className="px-4 py-2 text-right font-medium">Amount</th>
                    <th className="px-4 py-2 font-medium">Type</th>
                    <th className="px-4 py-2 font-medium">Category</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100">
                  {rows.map((r, i) => (
                    <tr key={i} className="hover:bg-slate-50">
                      <td className="whitespace-nowrap px-4 py-2 text-slate-500">
                        {formatDate(r.txnDate)}
                      </td>
                      <td className="px-4 py-2">{r.description}</td>
                      <td
                        className={`whitespace-nowrap px-4 py-2 text-right tabular-nums ${
                          r.amount < 0 ? "text-emerald-600" : "text-slate-800"
                        }`}
                      >
                        {formatCurrency(r.amount, true)}
                      </td>
                      <td className="px-4 py-2">
                        <select
                          value={r.type}
                          onChange={(e) =>
                            setRowType(i, e.target.value as TxnType)
                          }
                          className="rounded-md border border-slate-200 bg-white px-1.5 py-1 text-xs"
                        >
                          {TYPES.map((t) => (
                            <option key={t} value={t}>
                              {t}
                            </option>
                          ))}
                        </select>
                      </td>
                      <td className="px-4 py-2">
                        <select
                          value={r.category}
                          onChange={(e) => setRowCategory(i, e.target.value)}
                          className="rounded-md border border-slate-200 bg-white px-1.5 py-1 text-xs"
                        >
                          {CATEGORIES.map((c) => (
                            <option key={c} value={c}>
                              {c}
                            </option>
                          ))}
                        </select>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </Panel>
        </>
      ) : null}
    </div>
  );
}

function MiniStat({
  label,
  value,
  good,
  muted,
}: {
  label: string;
  value: string;
  good?: boolean;
  muted?: boolean;
}) {
  return (
    <div className="rounded-lg border border-slate-200 bg-slate-50 px-3 py-2">
      <div className="text-xs text-slate-500">{label}</div>
      <div
        className={`text-lg font-semibold tabular-nums ${
          good ? "text-emerald-600" : muted ? "text-slate-400" : "text-slate-800"
        }`}
      >
        {value}
      </div>
    </div>
  );
}
