"use client";

import { useEffect, useMemo, useState } from "react";
import { Panel, Badge, Button, StatCard } from "@/components/ui";
import { MultiSelect } from "@/components/MultiSelect";
import { formatCurrency, formatDate } from "@/lib/utils";
import { useCategories } from "@/lib/useCategories";
import { countsAsExpense, type TxnType } from "@/lib/classify";
import {
  Trash2,
  Archive,
  RotateCcw,
  ArrowUp,
  ArrowDown,
  ArrowUpDown,
  Download,
  X,
  Wand2,
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
  cardOwner?: string | null;
}

/** Card label with owner appended so same-named cards (e.g. two Amex
 * Platinums) are distinguishable: "Amex Platinum (Spouse)". */
function cardLabel(t: {
  cardName: string | null;
  cardOwner?: string | null;
  account?: string | null;
}): string {
  const base = t.cardName ?? t.account ?? "—";
  return t.cardOwner ? `${base} (${t.cardOwner})` : base;
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
  const { names: categoryNames } = useCategories();
  const [txns, setTxns] = useState<Txn[]>([]);
  const [loading, setLoading] = useState(true);
  const [typeFilter, setTypeFilter] = useState<string[]>([]);
  const [cardFilter, setCardFilter] = useState<string[]>([]);
  const [categoryFilter, setCategoryFilter] = useState<string[]>([]);
  const [dateFrom, setDateFrom] = useState("");
  const [dateTo, setDateTo] = useState("");
  const [search, setSearch] = useState("");
  const [sort, setSort] = useState<{ key: SortKey; dir: "asc" | "desc" }>({
    key: "txnDate",
    dir: "desc",
  });
  const [selected, setSelected] = useState<Set<number>>(new Set());
  const [bulkCategory, setBulkCategory] = useState("");
  const [bulkType, setBulkType] = useState("");
  const [view, setView] = useState<"active" | "removed">("active");
  const [recategorizing, setRecategorizing] = useState(false);

  function switchView(v: "active" | "removed") {
    setView(v);
    setSelected(new Set());
  }

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
    () => [...new Set(txns.map((t) => cardLabel(t)))].sort(),
    [txns],
  );

  const activeCount = useMemo(
    () => txns.filter((t) => !t.excludedFromExpenses).length,
    [txns],
  );
  const removedCount = useMemo(
    () => txns.filter((t) => t.excludedFromExpenses).length,
    [txns],
  );

  const filtered = useMemo(() => {
    return txns.filter((t) => {
      if (view === "active" && t.excludedFromExpenses) return false;
      if (view === "removed" && !t.excludedFromExpenses) return false;
      if (typeFilter.length && !typeFilter.includes(t.type)) return false;
      if (categoryFilter.length && !categoryFilter.includes(t.category))
        return false;
      if (cardFilter.length && !cardFilter.includes(cardLabel(t))) return false;
      // txnDate is ISO (yyyy-mm-dd), so lexical compare is a valid date compare.
      if (dateFrom && t.txnDate < dateFrom) return false;
      if (dateTo && t.txnDate > dateTo) return false;
      if (search && !t.description.toLowerCase().includes(search.toLowerCase()))
        return false;
      return true;
    });
  }, [txns, view, typeFilter, categoryFilter, cardFilter, dateFrom, dateTo, search]);

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
        av = cardLabel(a);
        bv = cardLabel(b);
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

  async function recategorize() {
    if (
      !confirm(
        "Re-apply auto-categories to all transactions using the latest rules? This may overwrite manual category changes.",
      )
    )
      return;
    setRecategorizing(true);
    try {
      const res = await fetch("/api/transactions/recategorize", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ onlyUncategorized: false }),
      });
      const data = await res.json();
      if (data.error) alert(data.error);
      else {
        load();
        alert(`Re-categorized ${data.updated} transaction(s).`);
      }
    } finally {
      setRecategorizing(false);
    }
  }

  function exportCsv() {
    const header = ["Date", "Description", "Card", "Amount", "Type", "Category", "Status"];
    const lines = sorted.map((t) =>
      [
        t.txnDate,
        `"${t.description.replace(/"/g, '""')}"`,
        `"${cardLabel(t).replace(/"/g, '""')}"`,
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

  // Summary stats reflect the current filters (type/category/card/date/search
  // and the active/removed tab) — i.e. exactly the rows visible in the table.
  const summaryStats = useMemo(() => {
    let trueExpenses = 0;
    let rawSpend = 0;
    let credits = 0;
    let refunds = 0;
    let annualFees = 0;
    for (const t of filtered) {
      const amt = Number(t.amount);
      const netted =
        t.nettingStatus === "auto" || t.nettingStatus === "confirmed";
      if (t.type === "purchase") rawSpend += amt;
      if (t.type === "credit") credits += Math.abs(amt);
      if (t.type === "refund") refunds += Math.abs(amt);
      const contributes =
        !netted &&
        (t.type === "purchase" ||
          t.type === "fee" ||
          t.type === "interest" ||
          t.type === "credit" ||
          t.type === "refund");
      if (contributes) {
        trueExpenses += amt;
        if (t.type === "fee") annualFees += amt;
      }
    }
    return { trueExpenses, rawSpend, credits, refunds, annualFees };
  }, [filtered]);

  const activeFilterCount =
    typeFilter.length +
    categoryFilter.length +
    cardFilter.length +
    (dateFrom || dateTo ? 1 : 0) +
    (search ? 1 : 0);
  const summaryScope =
    activeFilterCount === 0
      ? "All transactions"
      : `Filtered · ${filtered.length} shown`;
  // Total spend = all money-out (purchases + fees + interest), excluding
  // refunds & credits. Actual spend = Total − refunds − credits − fees.
  const totalSpend =
    summaryStats.trueExpenses + summaryStats.credits + summaryStats.refunds;
  const actualSpend =
    totalSpend -
    summaryStats.refunds -
    summaryStats.credits -
    summaryStats.annualFees;

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
          <MultiSelect
            label="Types"
            options={TYPES}
            selected={typeFilter}
            onChange={setTypeFilter}
          />
          <MultiSelect
            label="Categories"
            options={categoryNames}
            selected={categoryFilter}
            onChange={setCategoryFilter}
          />
          <MultiSelect
            label="Cards"
            options={cardNames}
            selected={cardFilter}
            onChange={setCardFilter}
          />
          <div className="flex items-center gap-1 rounded-lg border border-slate-300 bg-white px-2 py-1 text-sm">
            <input
              type="date"
              value={dateFrom}
              max={dateTo || undefined}
              onChange={(e) => setDateFrom(e.target.value)}
              title="From date"
              className="bg-transparent text-slate-700 outline-none"
            />
            <span className="text-slate-400">→</span>
            <input
              type="date"
              value={dateTo}
              min={dateFrom || undefined}
              onChange={(e) => setDateTo(e.target.value)}
              title="To date"
              className="bg-transparent text-slate-700 outline-none"
            />
            {dateFrom || dateTo ? (
              <button
                onClick={() => {
                  setDateFrom("");
                  setDateTo("");
                }}
                title="Clear dates"
                className="text-slate-400 hover:text-slate-600"
              >
                <X className="h-4 w-4" />
              </button>
            ) : null}
          </div>
          <Button
            variant="secondary"
            onClick={recategorize}
            disabled={recategorizing}
          >
            <Wand2 className="h-4 w-4" />{" "}
            {recategorizing ? "Re-categorizing…" : "Re-categorize"}
          </Button>
          <Button variant="secondary" onClick={exportCsv}>
            <Download className="h-4 w-4" /> Export
          </Button>
        </div>
      </div>

      <p className="text-xs font-medium uppercase tracking-wide text-slate-400">
        Summary · {summaryScope}
      </p>
      <div className="grid grid-cols-2 gap-3 lg:grid-cols-5">
        <StatCard
          label="Total Spend"
          value={formatCurrency(totalSpend)}
          sub="Excluding refunds & credits"
          accent="slate"
        />
        <StatCard
          label="Refunds"
          value={formatCurrency(summaryStats.refunds)}
          sub="Merchant refunds returned"
          accent="emerald"
        />
        <StatCard
          label="Credits"
          value={formatCurrency(summaryStats.credits)}
          sub="Statement / offset credits"
          accent="emerald"
        />
        <StatCard
          label="Fees"
          value={formatCurrency(summaryStats.annualFees)}
          sub="Annual / membership fees"
          accent="amber"
        />
        <StatCard
          label="Actual Spend"
          value={formatCurrency(actualSpend)}
          sub="Total − refunds − credits − fees"
          accent="indigo"
        />
      </div>

      <div className="flex gap-1 border-b border-slate-200">
        <TabButton
          label="Active"
          count={activeCount}
          active={view === "active"}
          onClick={() => switchView("active")}
        />
        <TabButton
          label="Removed"
          count={removedCount}
          active={view === "removed"}
          onClick={() => switchView("removed")}
        />
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
          {view === "active" ? (
            <>
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
                {categoryNames.map((c) => (
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
                <Archive className="h-4 w-4" /> Remove
              </Button>
            </>
          ) : (
            <Button onClick={() => bulkPatch({ excludedFromExpenses: false })}>
              <RotateCcw className="h-4 w-4" /> Restore
            </Button>
          )}
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
                    className={
                      isSel ? "bg-emerald-50/50" : "hover:bg-slate-50"
                    }
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
                      {cardLabel(t)}
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
                        {categoryNames.map((c) => (
                          <option key={c} value={c}>
                            {c}
                          </option>
                        ))}
                      </select>
                    </td>
                    <td className="px-4 py-2">
                      {t.excludedFromExpenses ? (
                        <Badge color="slate">removed</Badge>
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
                        {t.excludedFromExpenses ? (
                          <button
                            title="Restore to expenses"
                            onClick={() =>
                              patch(t.id, { excludedFromExpenses: false })
                            }
                            className="rounded-md p-1.5 text-slate-400 hover:bg-emerald-50 hover:text-emerald-600"
                          >
                            <RotateCcw className="h-4 w-4" />
                          </button>
                        ) : (
                          <button
                            title="Remove (moves to Removed tab)"
                            onClick={() =>
                              patch(t.id, { excludedFromExpenses: true })
                            }
                            className="rounded-md p-1.5 text-slate-400 hover:bg-slate-100 hover:text-slate-700"
                          >
                            <Archive className="h-4 w-4" />
                          </button>
                        )}
                        <button
                          title="Delete permanently"
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
              {view === "removed"
                ? "Nothing removed. Items you remove show up here to restore."
                : "No transactions found."}
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

function TabButton({
  label,
  count,
  active,
  onClick,
}: {
  label: string;
  count: number;
  active: boolean;
  onClick: () => void;
}) {
  return (
    <button
      onClick={onClick}
      className={`-mb-px border-b-2 px-4 py-2 text-sm font-medium transition-colors ${
        active
          ? "border-emerald-600 text-emerald-700"
          : "border-transparent text-slate-500 hover:text-slate-800"
      }`}
    >
      {label}
      <span
        className={`ml-2 rounded-full px-2 py-0.5 text-xs ${
          active ? "bg-emerald-100 text-emerald-700" : "bg-slate-100 text-slate-500"
        }`}
      >
        {count}
      </span>
    </button>
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
