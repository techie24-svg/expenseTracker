"use client";

import { useEffect, useMemo, useState } from "react";
import { Panel, Badge, Button } from "@/components/ui";
import { formatCurrency, formatDate } from "@/lib/utils";
import { CATEGORIES } from "@/lib/categorize";
import { countsAsExpense, type TxnType } from "@/lib/classify";
import {
  Trash2,
  EyeOff,
  Eye,
  ArrowUp,
  ArrowDown,
  ArrowUpDown,
  Download,
  X,
} from "lucide-react";

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

type SortKey =
  | "txnDate"
  | "description"
  | "cardName"
  | "amount"
  | "type"
  | "category"
  | "status";

function statusRank(t: Txn): string {
  if (t.excludedFromExpenses) return "excluded";
  if (t.nettingStatus === "auto" || t.nettingStatus === "confirmed")
    return "netted";
  if (t.nettingStatus === "suggested") return "review";
  if (t.type === "credit" || t.type === "refund") return "reduces";
  return countsAsExpense({
    type: t.type,
    excludedFromExpenses: t.excludedFromExpenses,
    nettingStatus: t.nettingStatus,
  })
    ? "expense"
    : "not counted";
}

export default function TransactionsPage() {
  const [txns, setTxns] = useState<Txn[]>([]);
  const [loading, setLoading] = useState(true);
  const [typeFilter, setTypeFilter] = useState("");
  const [cardFilter, setCardFilter] = useState("");
  const [categoryFilter, setCategoryFilter] = useState("");
  const [search, setSearch] = useState("");
  const [sort, setSort] = useState<{ key: SortKey; dir: "asc" | "desc" }>({
    key: "txnDate",
    dir: "desc",
  });
  const [selected, setSelected] = useState<Set<number>>(new Set());
  const [bulkCategory, setBulkCategory] = useState("");
  const [bulkType, setBulkType] = useState("");

  function load() {
    setLoading(true);
    fetch("/api/transactions")
      .then((r) => r.json())
      .then((d) => Array.isArray(d) && setTxns(d))
      .finally(() => setLoading(false));
  }

  useEffect(load, []);

  async function patch(id: number, updates: Partial<Txn>) {
    setTxns((prev) => prev.map((t) => (t.id === id ? { ...t, ...updates } : t)));
    await fetch(`/api/transactions/${id}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(updates),
    });
  }

  async function remove(id: number) {
    if (!confirm("Delete this transaction?")) return;
    setTxns((prev) => prev.filter((t) => t.id !== id));
    setSelected((prev) => {
      const n = new Set(prev);
      n.delete(id);
      return n;
    });
    await fetch(`/api/transactions/${id}`, { method: "DELETE" });
  }

  const cardNames = useMemo(
    () =>
      [...new Set(txns.map((t) => t.cardName ?? t.account ?? "—"))].sort(),
    [txns],
  );

  const filtered = useMemo(() => {
    return txns.filter((t) => {
      if (typeFilter && t.type !== typeFilter) return false;
      if (categoryFilter && t.category !== categoryFilter) return false;
      if (cardFilter && (t.cardName ?? t.account ?? "—") !== cardFilter)
        return false;
      if (search && !t.description.toLowerCase().includes(search.toLowerCase()))
        return false;
      return true;
    });
  }, [txns, typeFilter, categoryFilter, cardFilter, search]);

  const sorted = useMemo(() => {
    const arr = [...filtered];
    const { key, dir } = sort;
    arr.sort((a, b) => {
      let av: string | number;
      let bv: string | number;
      if (key === "amount") {
        av = Number(a.amount);
        bv = Number(b.amount);
      } else if (key === "status") {
        av = statusRank(a);
        bv = statusRank(b);
      } else if (key === "cardName") {
        av = a.cardName ?? a.account ?? "";
        bv = b.cardName ?? b.account ?? "";
      } else {
        av = (a[key] ?? "") as string;
        bv = (b[key] ?? "") as string;
      }
      if (av < bv) return dir === "asc" ? -1 : 1;
      if (av > bv) return dir === "asc" ? 1 : -1;
      return a.id - b.id;
    });
    return arr;
  }, [filtered, sort]);

  function toggleSort(key: SortKey) {
    setSort((prev) =>
      prev.key === key
        ? { key, dir: prev.dir === "asc" ? "desc" : "asc" }
        : { key, dir: key === "txnDate" || key === "amount" ? "desc" : "asc" },
    );
  }

  // Selection over the currently visible (filtered) rows.
  const visibleIds = sorted.map((t) => t.id);
  const allVisibleSelected =
    visibleIds.length > 0 && visibleIds.every((id) => selected.has(id));

  function toggleSelectAll() {
    setSelected((prev) => {
      if (allVisibleSelected) {
        const n = new Set(prev);
        visibleIds.forEach((id) => n.delete(id));
        return n;
      }
      return new Set([...prev, ...visibleIds]);
    });
  }

  function toggleSelect(id: number) {
    setSelected((prev) => {
      const n = new Set(prev);
      if (n.has(id)) n.delete(id);
      else n.add(id);
      return n;
    });
  }

  const selectedList = useMemo(
    () => sorted.filter((t) => selected.has(t.id)),
    [sorted, selected],
  );

  async function bulkPatch(updates: Partial<Txn>) {
    const ids = selectedList.map((t) => t.id);
    if (ids.length === 0) return;
    setTxns((prev) =>
      prev.map((t) => (selected.has(t.id) ? { ...t, ...updates } : t)),
    );
    await fetch("/api/transactions/bulk", {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ ids, ...updates }),
    });
  }

  async function bulkDelete() {
    const ids = selectedList.map((t) => t.id);
    if (ids.length === 0) return;
    if (!confirm(`Delete ${ids.length} selected transaction(s)?`)) return;
    setTxns((prev) => prev.filter((t) => !selected.has(t.id)));
    setSelected(new Set());
    await fetch("/api/transactions/bulk", {
      method: "DELETE",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ ids }),
    });
  }

  function exportCsv() {
    const header = ["Date", "Description", "Card", "Amount", "Type", "Category", "Status"];
    const lines = sorted.map((t) =>
      [
        t.txnDate,
        `"${t.description.replace(/"/g, '""')}"`,
        `"${(t.cardName ?? t.account ?? "").replace(/"/g, '""')}"`,
        t.amount,
        t.type,
        t.category,
        statusRank(t),
      ].join(","),
    );
    const csv = [header.join(","), ...lines].join("\n");
    const blob = new Blob([csv], { type: "text/csv" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = "transactions.csv";
    a.click();
    URL.revokeObjectURL(url);
  }

  const filteredTotal = filtered.reduce((s, t) => {
    return (
      s +
      (countsAsExpense({
        type: t.type,
        excludedFromExpenses: t.excludedFromExpenses,
        nettingStatus: t.nettingStatus,
      }) ||
      ((t.type === "credit" || t.type === "refund") &&
        !t.excludedFromExpenses &&
        t.nettingStatus !== "auto" &&
        t.nettingStatus !== "confirmed")
        ? Number(t.amount)
        : 0)
    );
  }, 0);
  const selectedTotal = selectedList.reduce(
    (s, t) => s + Number(t.amount),
    0,
  );

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-end justify-between gap-3">
        <div>
          <h1 className="text-2xl font-bold tracking-tight">Transactions</h1>
          <p className="text-sm text-slate-500">
            {filtered.length} shown · true expenses in view{" "}
            <span className="font-medium text-slate-700">
              {formatCurrency(filteredTotal)}
            </span>
          </p>
        </div>
        <div className="flex flex-wrap gap-2">
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
          <select
            value={categoryFilter}
            onChange={(e) => setCategoryFilter(e.target.value)}
            className="rounded-lg border border-slate-300 bg-white px-3 py-2 text-sm"
          >
            <option value="">All categories</option>
            {CATEGORIES.map((c) => (
              <option key={c} value={c}>
                {c}
              </option>
            ))}
          </select>
          <select
            value={cardFilter}
            onChange={(e) => setCardFilter(e.target.value)}
            className="rounded-lg border border-slate-300 bg-white px-3 py-2 text-sm"
          >
            <option value="">All cards</option>
            {cardNames.map((c) => (
              <option key={c} value={c}>
                {c}
              </option>
            ))}
          </select>
          <Button variant="secondary" onClick={exportCsv}>
            <Download className="h-4 w-4" /> Export
          </Button>
        </div>
      </div>

      {selected.size > 0 ? (
        <div className="sticky top-16 z-10 flex flex-wrap items-center gap-3 rounded-xl border border-emerald-200 bg-emerald-50 px-4 py-3 shadow-sm">
          <span className="text-sm font-semibold text-emerald-800">
            {selected.size} selected
          </span>
          <span className="text-xs text-emerald-700">
            ({formatCurrency(selectedTotal, true)})
          </span>
          <div className="mx-1 h-5 w-px bg-emerald-200" />
          <select
            value={bulkCategory}
            onChange={(e) => {
              const v = e.target.value;
              setBulkCategory("");
              if (v) bulkPatch({ category: v });
            }}
            className="rounded-lg border border-emerald-300 bg-white px-2 py-1.5 text-sm"
          >
            <option value="">Set category…</option>
            {CATEGORIES.map((c) => (
              <option key={c} value={c}>
                {c}
              </option>
            ))}
          </select>
          <select
            value={bulkType}
            onChange={(e) => {
              const v = e.target.value;
              setBulkType("");
              if (v) bulkPatch({ type: v as TxnType });
            }}
            className="rounded-lg border border-emerald-300 bg-white px-2 py-1.5 text-sm"
          >
            <option value="">Set type…</option>
            {TYPES.map((t) => (
              <option key={t} value={t}>
                {t}
              </option>
            ))}
          </select>
          <Button
            variant="secondary"
            onClick={() => bulkPatch({ excludedFromExpenses: true })}
          >
            <EyeOff className="h-4 w-4" /> Exclude
          </Button>
          <Button
            variant="secondary"
            onClick={() => bulkPatch({ excludedFromExpenses: false })}
          >
            <Eye className="h-4 w-4" /> Include
          </Button>
          <Button variant="danger" onClick={bulkDelete}>
            <Trash2 className="h-4 w-4" /> Delete
          </Button>
          <button
            onClick={() => setSelected(new Set())}
            className="ml-auto flex items-center gap-1 text-sm text-emerald-700 hover:underline"
          >
            <X className="h-4 w-4" /> Clear
          </button>
        </div>
      ) : null}

      <Panel className="overflow-hidden p-0">
        <div className="overflow-auto">
          <table className="w-full text-sm">
            <thead className="bg-slate-50 text-left text-xs uppercase tracking-wide text-slate-500">
              <tr>
                <th className="px-3 py-2.5">
                  <input
                    type="checkbox"
                    checked={allVisibleSelected}
                    onChange={toggleSelectAll}
                    title="Select all"
                  />
                </th>
                <SortTh label="Date" k="txnDate" sort={sort} onSort={toggleSort} />
                <SortTh
                  label="Description"
                  k="description"
                  sort={sort}
                  onSort={toggleSort}
                />
                <SortTh label="Card" k="cardName" sort={sort} onSort={toggleSort} />
                <SortTh
                  label="Amount"
                  k="amount"
                  sort={sort}
                  onSort={toggleSort}
                  align="right"
                />
                <SortTh label="Type" k="type" sort={sort} onSort={toggleSort} />
                <SortTh
                  label="Category"
                  k="category"
                  sort={sort}
                  onSort={toggleSort}
                />
                <SortTh label="Status" k="status" sort={sort} onSort={toggleSort} />
                <th className="px-4 py-2.5"></th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {sorted.map((t) => {
                const netted =
                  t.nettingStatus === "auto" || t.nettingStatus === "confirmed";
                const counts = countsAsExpense({
                  type: t.type,
                  excludedFromExpenses: t.excludedFromExpenses,
                  nettingStatus: t.nettingStatus,
                });
                const isCredit = t.type === "credit" || t.type === "refund";
                const isSel = selected.has(t.id);
                return (
                  <tr
                    key={t.id}
                    className={`${t.excludedFromExpenses ? "opacity-50" : ""} ${
                      isSel ? "bg-emerald-50/50" : "hover:bg-slate-50"
                    }`}
                  >
                    <td className="px-3 py-2">
                      <input
                        type="checkbox"
                        checked={isSel}
                        onChange={() => toggleSelect(t.id)}
                      />
                    </td>
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
          {!loading && sorted.length === 0 ? (
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

function SortTh({
  label,
  k,
  sort,
  onSort,
  align = "left",
}: {
  label: string;
  k: SortKey;
  sort: { key: SortKey; dir: "asc" | "desc" };
  onSort: (k: SortKey) => void;
  align?: "left" | "right";
}) {
  const active = sort.key === k;
  return (
    <th className={`px-4 py-2.5 font-medium ${align === "right" ? "text-right" : ""}`}>
      <button
        onClick={() => onSort(k)}
        className={`inline-flex items-center gap-1 hover:text-slate-800 ${
          active ? "text-slate-800" : ""
        } ${align === "right" ? "flex-row-reverse" : ""}`}
      >
        {label}
        {active ? (
          sort.dir === "asc" ? (
            <ArrowUp className="h-3 w-3" />
          ) : (
            <ArrowDown className="h-3 w-3" />
          )
        ) : (
          <ArrowUpDown className="h-3 w-3 opacity-40" />
        )}
      </button>
    </th>
  );
}
