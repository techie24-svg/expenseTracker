"use client";

import { useEffect, useMemo, useState } from "react";
import { Panel, Button, StatCard } from "@/components/ui";
import { formatCurrency, formatDate } from "@/lib/utils";
import { Banknote, Plus, Check, Trash2 } from "lucide-react";

interface Withdrawal {
  id: number;
  person: string | null;
  bank: string | null;
  accountType: string | null;
  method: string | null;
  amount: string;
  withdrawnAt: string;
  notes: string | null;
}

const BANKS = ["Chase", "BofA", "Fidelity", "Other"];
const ACCOUNT_TYPES = ["Checking", "Savings"];
const METHODS = ["Zelle", "Cash", "Other"];

export default function CashPage() {
  const [rows, setRows] = useState<Withdrawal[]>([]);
  const [loading, setLoading] = useState(true);

  const [person, setPerson] = useState("Me");
  const [bank, setBank] = useState(BANKS[0]);
  const [accountType, setAccountType] = useState(ACCOUNT_TYPES[0]);
  const [method, setMethod] = useState(METHODS[0]);
  const [amount, setAmount] = useState("");
  const [withdrawnAt, setWithdrawnAt] = useState(() =>
    new Date().toISOString().slice(0, 10),
  );
  const [notes, setNotes] = useState("");
  const [saving, setSaving] = useState(false);
  const [saved, setSaved] = useState(false);

  function load() {
    setLoading(true);
    fetch("/api/cash")
      .then((r) => r.json())
      .then((d) => Array.isArray(d) && setRows(d))
      .finally(() => setLoading(false));
  }
  useEffect(load, []);

  async function add(e: React.FormEvent) {
    e.preventDefault();
    const amt = parseFloat(amount);
    if (Number.isNaN(amt) || amt <= 0) return;
    setSaving(true);
    try {
      const res = await fetch("/api/cash", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          person,
          bank,
          accountType,
          method,
          amount: amt,
          withdrawnAt,
          notes,
        }),
      });
      const data = await res.json().catch(() => ({}));
      if (data.error) {
        alert(data.error);
      } else {
        setAmount("");
        setNotes("");
        setSaved(true);
        setTimeout(() => setSaved(false), 2000);
        load();
      }
    } finally {
      setSaving(false);
    }
  }

  async function remove(id: number) {
    if (!confirm("Delete this withdrawal?")) return;
    setRows((prev) => prev.filter((r) => r.id !== id));
    await fetch(`/api/cash/${id}`, { method: "DELETE" });
  }

  const total = useMemo(
    () => rows.reduce((s, r) => s + Number(r.amount), 0),
    [rows],
  );
  const thisMonth = useMemo(() => {
    const mk = new Date().toISOString().slice(0, 7);
    return rows
      .filter((r) => r.withdrawnAt.slice(0, 7) === mk)
      .reduce((s, r) => s + Number(r.amount), 0);
  }, [rows]);
  const byPerson = useMemo(() => {
    const m: Record<string, number> = {};
    for (const r of rows) {
      const k = r.person || "Unspecified";
      m[k] = (m[k] ?? 0) + Number(r.amount);
    }
    return Object.entries(m).sort((a, b) => b[1] - a[1]);
  }, [rows]);

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold tracking-tight">Cash withdrawals</h1>
        <p className="text-sm text-slate-500">
          Track cash taken out of your bank accounts — who withdrew it, from
          which bank, how much, and when.
        </p>
      </div>

      <div className="grid grid-cols-2 gap-4 lg:grid-cols-3">
        <StatCard
          label="Total withdrawn"
          value={formatCurrency(total)}
          sub={`${rows.length} withdrawal${rows.length === 1 ? "" : "s"}`}
          accent="slate"
        />
        <StatCard
          label="This month"
          value={formatCurrency(thisMonth)}
          sub={new Date().toLocaleString("en-US", { month: "long" })}
          accent="indigo"
        />
        <Panel className="flex flex-col gap-1">
          <span className="text-xs font-medium uppercase tracking-wide text-slate-500">
            By person
          </span>
          {byPerson.length === 0 ? (
            <span className="text-sm text-slate-400">No withdrawals yet</span>
          ) : (
            <div className="mt-1 space-y-1">
              {byPerson.map(([name, amt]) => (
                <div
                  key={name}
                  className="flex items-center justify-between text-sm"
                >
                  <span className="text-slate-600">{name}</span>
                  <span className="font-medium tabular-nums">
                    {formatCurrency(amt)}
                  </span>
                </div>
              ))}
            </div>
          )}
        </Panel>
      </div>

      <div className="grid gap-6 lg:grid-cols-3">
        <Panel className="space-y-4 lg:col-span-1">
          <h3 className="flex items-center gap-2 text-sm font-semibold text-slate-700">
            <Banknote className="h-4 w-4" /> Log a withdrawal
          </h3>
          <form onSubmit={add} className="space-y-3">
            <div className="grid grid-cols-2 gap-3">
              <label className="text-xs font-medium text-slate-500">
                Date
                <input
                  type="date"
                  value={withdrawnAt}
                  onChange={(e) => setWithdrawnAt(e.target.value)}
                  className="mt-1 w-full rounded-lg border border-slate-300 px-3 py-2 text-sm"
                />
              </label>
              <label className="text-xs font-medium text-slate-500">
                Amount
                <input
                  type="number"
                  step="0.01"
                  placeholder="0.00"
                  value={amount}
                  onChange={(e) => setAmount(e.target.value)}
                  className="mt-1 w-full rounded-lg border border-slate-300 px-3 py-2 text-sm"
                />
              </label>
            </div>
            <div className="grid grid-cols-2 gap-3">
              <label className="text-xs font-medium text-slate-500">
                Who
                <select
                  value={person}
                  onChange={(e) => setPerson(e.target.value)}
                  className="mt-1 w-full rounded-lg border border-slate-300 bg-white px-3 py-2 text-sm"
                >
                  <option value="Me">Me</option>
                  <option value="Spouse">Spouse</option>
                </select>
              </label>
              <label className="text-xs font-medium text-slate-500">
                Bank
                <select
                  value={bank}
                  onChange={(e) => setBank(e.target.value)}
                  className="mt-1 w-full rounded-lg border border-slate-300 bg-white px-3 py-2 text-sm"
                >
                  {BANKS.map((b) => (
                    <option key={b} value={b}>
                      {b}
                    </option>
                  ))}
                </select>
              </label>
            </div>
            <div className="grid grid-cols-2 gap-3">
              <label className="text-xs font-medium text-slate-500">
                Account
                <select
                  value={accountType}
                  onChange={(e) => setAccountType(e.target.value)}
                  className="mt-1 w-full rounded-lg border border-slate-300 bg-white px-3 py-2 text-sm"
                >
                  {ACCOUNT_TYPES.map((a) => (
                    <option key={a} value={a}>
                      {a}
                    </option>
                  ))}
                </select>
              </label>
              <label className="text-xs font-medium text-slate-500">
                Method
                <select
                  value={method}
                  onChange={(e) => setMethod(e.target.value)}
                  className="mt-1 w-full rounded-lg border border-slate-300 bg-white px-3 py-2 text-sm"
                >
                  {METHODS.map((m) => (
                    <option key={m} value={m}>
                      {m}
                    </option>
                  ))}
                </select>
              </label>
            </div>
            <input
              placeholder="Notes (optional, e.g. groceries, rent to landlord)"
              value={notes}
              onChange={(e) => setNotes(e.target.value)}
              className="w-full rounded-lg border border-slate-300 px-3 py-2 text-sm"
            />
            <Button type="submit" disabled={saving}>
              {saved ? (
                <>
                  <Check className="h-4 w-4" /> Added
                </>
              ) : (
                <>
                  <Plus className="h-4 w-4" /> Add withdrawal
                </>
              )}
            </Button>
          </form>
        </Panel>

        <Panel className="overflow-hidden p-0 lg:col-span-2">
          <div className="overflow-auto">
            <table className="w-full text-sm">
              <thead className="bg-slate-50 text-left text-xs uppercase tracking-wide text-slate-500">
                <tr>
                  <th className="px-4 py-2.5 font-medium">Date</th>
                  <th className="px-4 py-2.5 font-medium">Who</th>
                  <th className="px-4 py-2.5 font-medium">Bank</th>
                  <th className="px-4 py-2.5 font-medium">Account</th>
                  <th className="px-4 py-2.5 font-medium">Method</th>
                  <th className="px-4 py-2.5 text-right font-medium">Amount</th>
                  <th className="px-4 py-2.5 font-medium">Notes</th>
                  <th className="px-4 py-2.5"></th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {rows.map((r) => (
                  <tr key={r.id} className="hover:bg-slate-50">
                    <td className="whitespace-nowrap px-4 py-2 text-slate-500">
                      {formatDate(r.withdrawnAt)}
                    </td>
                    <td className="px-4 py-2">{r.person || "—"}</td>
                    <td className="px-4 py-2 text-slate-600">{r.bank || "—"}</td>
                    <td className="px-4 py-2 text-slate-600">
                      {r.accountType || "—"}
                    </td>
                    <td className="px-4 py-2 text-slate-600">
                      {r.method || "—"}
                    </td>
                    <td className="whitespace-nowrap px-4 py-2 text-right font-medium tabular-nums">
                      {formatCurrency(r.amount)}
                    </td>
                    <td className="max-w-xs truncate px-4 py-2 text-slate-500">
                      {r.notes || "—"}
                    </td>
                    <td className="px-4 py-2 text-right">
                      <button
                        title="Delete"
                        onClick={() => remove(r.id)}
                        className="rounded-md p-1.5 text-slate-400 hover:bg-rose-50 hover:text-rose-600"
                      >
                        <Trash2 className="h-4 w-4" />
                      </button>
                    </td>
                  </tr>
                ))}
              </tbody>
              {rows.length > 0 ? (
                <tfoot className="border-t border-slate-200 text-sm font-semibold">
                  <tr>
                    <td className="px-4 py-2.5" colSpan={5}>
                      Total
                    </td>
                    <td className="px-4 py-2.5 text-right tabular-nums">
                      {formatCurrency(total)}
                    </td>
                    <td colSpan={2} />
                  </tr>
                </tfoot>
              ) : null}
            </table>
            {!loading && rows.length === 0 ? (
              <p className="p-8 text-center text-sm text-slate-400">
                No cash withdrawals logged yet.
              </p>
            ) : null}
            {loading ? (
              <p className="p-8 text-center text-sm text-slate-400">Loading…</p>
            ) : null}
          </div>
        </Panel>
      </div>
    </div>
  );
}
