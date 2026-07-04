"use client";

import { useEffect, useMemo, useState } from "react";
import { Panel, Badge } from "@/components/ui";
import { formatCurrency, formatDate } from "@/lib/utils";
import { CATEGORIES } from "@/lib/categorize";
import { countsAsExpense, type TxnType } from "@/lib/classify";
import { Trash2, EyeOff, Eye } from "lucide-react";

interface Txn {
  id: number;
  cardId: number | null;
  account: string | null;
  txnDate: string;
  description: string;
  amount: string;
  type: TxnType;
  category: string;
  excludedFromExpenses: boolean;
  nettingStatus: string;
  cardName: string | null;
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

const TYPE_COLOR: Record<
  string,
  "slate" | "emerald" | "rose" | "amber" | "indigo" | "sky"
> = {
  purchase: "slate",
  fee: "amber",
  interest: "amber",
  credit: "emerald",
  payment: "sky",
  refund: "emerald",
  other: "slate",
};

export default function TransactionsPage() {
  const [txns, setTxns] = useState<Txn[]>([]);
  const [loading, setLoading] = useState(true);
  const [typeFilter, setTypeFilter] = useState("");
  const [search, setSearch] = useState("");

  function load() {
    setLoading(true);
    fetch("/api/transactions")
      .then((r) => r.json())
      .then((d) => Array.isArray(d) && setTxns(d))
      .finally(() => setLoading(false));
  }

  useEffect(load, []);

  async function patch(id: number, updates: Partial<Txn>) {
    setTxns((prev) =>
      prev.map((t) => (t.id === id ? { ...t, ...updates } : t)),
    );
    await fetch(`/api/transactions/${id}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(updates),
    });
  }

  async function remove(id: number) {
    if (!confirm("Delete this transaction?")) return;
    setTxns((prev) => prev.filter((t) => t.id !== id));
    await fetch(`/api/transactions/${id}`, { method: "DELETE" });
  }

  const filtered = useMemo(() => {
    return txns.filter((t) => {
      if (typeFilter && t.type !== typeFilter) return false;
      if (
        search &&
        !t.description.toLowerCase().includes(search.toLowerCase())
      )
        return false;
      return true;
    });
  }, [txns, typeFilter, search]);

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-end justify-between gap-3">
        <div>
          <h1 className="text-2xl font-bold tracking-tight">Transactions</h1>
          <p className="text-sm text-slate-500">
            {txns.length} total. Correct any misclassified rows — changes update
            your totals instantly.
          </p>
        </div>
        <div className="flex gap-2">
          <input
            placeholder="Search…"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            className="rounded-lg border border-slate-300 bg-white px-3 py-2 text-sm"
          />
          <select
            value={typeFilter}
            onChange={(e) => setTypeFilter(e.target.value)}
            className="rounded-lg border border-slate-300 bg-white px-3 py-2 text-sm"
          >
            <option value="">All types</option>
            {TYPES.map((t) => (
              <option key={t} value={t}>
                {t}
              </option>
            ))}
          </select>
        </div>
      </div>

      <Panel className="overflow-hidden p-0">
        <div className="overflow-auto">
          <table className="w-full text-sm">
            <thead className="bg-slate-50 text-left text-xs uppercase tracking-wide text-slate-500">
              <tr>
                <th className="px-4 py-2.5 font-medium">Date</th>
                <th className="px-4 py-2.5 font-medium">Description</th>
                <th className="px-4 py-2.5 font-medium">Card</th>
                <th className="px-4 py-2.5 text-right font-medium">Amount</th>
                <th className="px-4 py-2.5 font-medium">Type</th>
                <th className="px-4 py-2.5 font-medium">Category</th>
                <th className="px-4 py-2.5 font-medium">Status</th>
                <th className="px-4 py-2.5"></th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {filtered.map((t) => {
                const netted =
                  t.nettingStatus === "auto" || t.nettingStatus === "confirmed";
                const counts = countsAsExpense({
                  type: t.type,
                  excludedFromExpenses: t.excludedFromExpenses,
                  nettingStatus: t.nettingStatus,
                });
                const isCredit = t.type === "credit" || t.type === "refund";
                return (
                  <tr
                    key={t.id}
                    className={t.excludedFromExpenses ? "opacity-50" : ""}
                  >
                    <td className="whitespace-nowrap px-4 py-2 text-slate-500">
                      {formatDate(t.txnDate)}
                    </td>
                    <td className="max-w-xs truncate px-4 py-2">
                      {t.description}
                    </td>
                    <td className="whitespace-nowrap px-4 py-2 text-slate-500">
                      {t.cardName ?? t.account ?? "—"}
                    </td>
                    <td
                      className={`whitespace-nowrap px-4 py-2 text-right tabular-nums ${
                        Number(t.amount) < 0
                          ? "text-emerald-600"
                          : "text-slate-800"
                      }`}
                    >
                      {formatCurrency(t.amount, true)}
                    </td>
                    <td className="px-4 py-2">
                      <select
                        value={t.type}
                        onChange={(e) =>
                          patch(t.id, { type: e.target.value as TxnType })
                        }
                        className="rounded-md border border-slate-200 bg-white px-1.5 py-1 text-xs"
                      >
                        {TYPES.map((ty) => (
                          <option key={ty} value={ty}>
                            {ty}
                          </option>
                        ))}
                      </select>
                    </td>
                    <td className="px-4 py-2">
                      <select
                        value={t.category}
                        onChange={(e) =>
                          patch(t.id, { category: e.target.value })
                        }
                        className="rounded-md border border-slate-200 bg-white px-1.5 py-1 text-xs"
                      >
                        {CATEGORIES.map((c) => (
                          <option key={c} value={c}>
                            {c}
                          </option>
                        ))}
                      </select>
                    </td>
                    <td className="px-4 py-2">
                      {t.excludedFromExpenses ? (
                        <Badge color="slate">excluded</Badge>
                      ) : netted ? (
                        <Badge color="emerald">netted</Badge>
                      ) : t.nettingStatus === "suggested" ? (
                        <Badge color="amber">review</Badge>
                      ) : isCredit ? (
                        <Badge color="emerald">reduces total</Badge>
                      ) : counts ? (
                        <Badge color={TYPE_COLOR[t.type]}>expense</Badge>
                      ) : (
                        <Badge color="slate">not counted</Badge>
                      )}
                    </td>
                    <td className="px-4 py-2">
                      <div className="flex items-center justify-end gap-1">
                        <button
                          title={
                            t.excludedFromExpenses
                              ? "Include in expenses"
                              : "Exclude from expenses"
                          }
                          onClick={() =>
                            patch(t.id, {
                              excludedFromExpenses: !t.excludedFromExpenses,
                            })
                          }
                          className="rounded-md p-1.5 text-slate-400 hover:bg-slate-100 hover:text-slate-700"
                        >
                          {t.excludedFromExpenses ? (
                            <Eye className="h-4 w-4" />
                          ) : (
                            <EyeOff className="h-4 w-4" />
                          )}
                        </button>
                        <button
                          title="Delete"
                          onClick={() => remove(t.id)}
                          className="rounded-md p-1.5 text-slate-400 hover:bg-rose-50 hover:text-rose-600"
                        >
                          <Trash2 className="h-4 w-4" />
                        </button>
                      </div>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
          {!loading && filtered.length === 0 ? (
            <p className="p-8 text-center text-sm text-slate-400">
              No transactions found.
            </p>
          ) : null}
          {loading ? (
            <p className="p-8 text-center text-sm text-slate-400">Loading…</p>
          ) : null}
        </div>
      </Panel>
    </div>
  );
}
