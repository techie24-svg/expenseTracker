"use client";

import { useEffect, useMemo, useState } from "react";
import Papa from "papaparse";
import { Panel, Button, StatCard } from "@/components/ui";
import { MultiSelect } from "@/components/MultiSelect";
import { formatCurrency, formatDate } from "@/lib/utils";
import { parseAmount, parseDateFlexible } from "@/lib/csv";
import {
  Banknote,
  Plus,
  Check,
  Trash2,
  Upload,
  ClipboardPaste,
  Pencil,
  X,
  ArrowUp,
  ArrowDown,
  ArrowUpDown,
  Download,
} from "lucide-react";

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

interface ParsedCash {
  withdrawnAt: string;
  amount: number;
  person: string | null;
  bank: string;
  accountType: string;
  method: string;
  notes: string | null;
}

const BANKS = ["Chase", "BofA", "Fidelity", "Other"];
const ACCOUNT_TYPES = ["Checking", "Savings"];
const METHODS = ["Zelle", "Cash", "ACH", "Debit Card", "Other"];

type SortKey =
  | "withdrawnAt"
  | "person"
  | "bank"
  | "accountType"
  | "method"
  | "amount"
  | "notes";

/** Guess a known bank from free text (statement description / bank cell). */
function normalizeBank(text: string): string | null {
  const t = text.toLowerCase();
  if (t.includes("bofa") || t.includes("bank of america") || t.includes("bkofamerica"))
    return "BofA";
  if (t.includes("chase")) return "Chase";
  if (t.includes("fidelity")) return "Fidelity";
  return null;
}

/** Guess how the money moved from free text. */
function normalizeMethod(text: string): string | null {
  const t = text.toLowerCase();
  if (t.includes("zelle")) return "Zelle";
  if (t.includes("ach")) return "ACH";
  if (t.includes("debit")) return "Debit Card";
  if (t.includes("atm") || t.includes("withdrwl") || t.includes("withdrawal"))
    return "Cash";
  return null;
}

/** Ensure the current value is selectable even if it's not in the preset list. */
function optionsWith(list: string[], value: string | null): string[] {
  if (value && !list.includes(value)) return [value, ...list];
  return list;
}

function findHeader(headers: string[], needles: string[]): string | null {
  const lower = headers.map((h) => h.trim().toLowerCase());
  for (const n of needles) {
    const i = lower.findIndex((h) => h.includes(n));
    if (i !== -1) return headers[i];
  }
  return null;
}

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

  // CSV import state.
  const [importMode, setImportMode] = useState<"upload" | "paste">("paste");
  const [pasteText, setPasteText] = useState("");
  const [parsedRows, setParsedRows] = useState<ParsedCash[]>([]);
  const [importing, setImporting] = useState(false);
  const [importMsg, setImportMsg] = useState("");
  // Defaults applied to imported rows that don't specify these columns.
  const [defPerson, setDefPerson] = useState("Me");
  const [defBank, setDefBank] = useState(BANKS[0]);
  const [defAccount, setDefAccount] = useState(ACCOUNT_TYPES[0]);
  const [defMethod, setDefMethod] = useState(METHODS[0]);

  // Inline row editing.
  const [editingId, setEditingId] = useState<number | null>(null);
  const [edit, setEdit] = useState({
    withdrawnAt: "",
    person: "",
    bank: "",
    accountType: "",
    method: "",
    amount: "",
    notes: "",
  });

  // Filtering & sorting for the table.
  const [search, setSearch] = useState("");
  const [personFilter, setPersonFilter] = useState<string[]>([]);
  const [bankFilter, setBankFilter] = useState<string[]>([]);
  const [accountFilter, setAccountFilter] = useState<string[]>([]);
  const [methodFilter, setMethodFilter] = useState<string[]>([]);
  const [dateFrom, setDateFrom] = useState("");
  const [dateTo, setDateTo] = useState("");
  const [sort, setSort] = useState<{ key: SortKey; dir: "asc" | "desc" }>({
    key: "withdrawnAt",
    dir: "desc",
  });

  function toggleSort(key: SortKey) {
    setSort((prev) =>
      prev.key === key
        ? { key, dir: prev.dir === "asc" ? "desc" : "asc" }
        : {
            key,
            dir: key === "withdrawnAt" || key === "amount" ? "desc" : "asc",
          },
    );
  }

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

  function startEdit(r: Withdrawal) {
    setEditingId(r.id);
    setEdit({
      withdrawnAt: r.withdrawnAt.slice(0, 10),
      person: r.person ?? "",
      bank: r.bank ?? "",
      accountType: r.accountType ?? "",
      method: r.method ?? "",
      amount: String(r.amount),
      notes: r.notes ?? "",
    });
  }

  async function saveEdit(id: number) {
    const amt = parseFloat(edit.amount);
    if (!edit.withdrawnAt || Number.isNaN(amt)) return;
    const payload = { ...edit, amount: amt };
    setRows((prev) =>
      prev.map((r) =>
        r.id === id
          ? {
              ...r,
              withdrawnAt: edit.withdrawnAt,
              person: edit.person || null,
              bank: edit.bank || null,
              accountType: edit.accountType || null,
              method: edit.method || null,
              amount: amt.toFixed(2),
              notes: edit.notes || null,
            }
          : r,
      ),
    );
    setEditingId(null);
    await fetch(`/api/cash/${id}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(payload),
    });
  }

  function parseCash(text: string): ParsedCash[] {
    const res = Papa.parse<Record<string, string>>(text, {
      header: true,
      skipEmptyLines: true,
      transformHeader: (h) => h.trim(),
    });
    const headers = res.meta.fields ?? [];
    const dateCol = findHeader(headers, ["date"]);
    const amountCol = findHeader(headers, [
      "amount",
      "debit",
      "withdrawal",
      "withdrawl",
    ]);
    const bankCol = findHeader(headers, ["bank"]);
    const personCol = findHeader(headers, ["who", "person", "name"]);
    const acctCol = findHeader(headers, ["account"]);
    const methodCol = findHeader(headers, ["method"]);
    const notesCol = findHeader(headers, [
      "note",
      "description",
      "details",
      "memo",
      "payee",
    ]);

    const out: ParsedCash[] = [];
    for (const row of res.data) {
      const date = dateCol ? parseDateFlexible(row[dateCol]) : null;
      const amtRaw = amountCol ? parseAmount(row[amountCol]) : null;
      if (!date || amtRaw === null) continue;
      const amount = Math.abs(amtRaw);
      if (amount === 0) continue;

      const notesText = notesCol ? String(row[notesCol] ?? "").trim() : "";
      const bankCell = bankCol ? String(row[bankCol] ?? "").trim() : "";
      const bank =
        normalizeBank(bankCell) ??
        normalizeBank(notesText) ??
        (bankCell || defBank);
      const method =
        (methodCol ? String(row[methodCol] ?? "").trim() : "") ||
        normalizeMethod(notesText) ||
        defMethod;
      const accountType =
        (acctCol ? String(row[acctCol] ?? "").trim() : "") || defAccount;
      const person =
        (personCol ? String(row[personCol] ?? "").trim() : "") || defPerson;

      out.push({
        withdrawnAt: date,
        amount,
        person,
        bank,
        accountType,
        method,
        notes: notesText || null,
      });
    }
    return out;
  }

  function runImportParse(text: string) {
    setImportMsg("");
    const parsed = parseCash(text);
    setParsedRows(parsed);
    if (parsed.length === 0)
      setImportMsg("No rows found. Need a header row with Date and Amount.");
  }

  async function onImportFile(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    if (!file) return;
    const text = await file.text();
    setPasteText(text);
    runImportParse(text);
  }

  async function doImport() {
    if (parsedRows.length === 0) return;
    setImporting(true);
    try {
      const res = await fetch("/api/cash/import", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ items: parsedRows }),
      });
      const data = await res.json().catch(() => ({}));
      if (data.error) {
        setImportMsg(data.error);
      } else {
        setImportMsg(`Imported ${data.inserted} withdrawal(s).`);
        setParsedRows([]);
        setPasteText("");
        load();
      }
    } finally {
      setImporting(false);
    }
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

  // Distinct values present in the data, used to populate the filters.
  const personOptions = useMemo(
    () =>
      [...new Set(rows.map((r) => r.person).filter(Boolean) as string[])].sort(),
    [rows],
  );
  const bankOptions = useMemo(
    () =>
      [...new Set(rows.map((r) => r.bank).filter(Boolean) as string[])].sort(),
    [rows],
  );
  const accountOptions = useMemo(
    () =>
      [
        ...new Set(rows.map((r) => r.accountType).filter(Boolean) as string[]),
      ].sort(),
    [rows],
  );
  const methodOptions = useMemo(
    () =>
      [...new Set(rows.map((r) => r.method).filter(Boolean) as string[])].sort(),
    [rows],
  );

  const filtered = useMemo(() => {
    return rows.filter((r) => {
      if (personFilter.length && !personFilter.includes(r.person ?? ""))
        return false;
      if (bankFilter.length && !bankFilter.includes(r.bank ?? "")) return false;
      if (accountFilter.length && !accountFilter.includes(r.accountType ?? ""))
        return false;
      if (methodFilter.length && !methodFilter.includes(r.method ?? ""))
        return false;
      const day = r.withdrawnAt.slice(0, 10);
      if (dateFrom && day < dateFrom) return false;
      if (dateTo && day > dateTo) return false;
      if (search) {
        const q = search.toLowerCase();
        const hay = [r.person, r.bank, r.accountType, r.method, r.notes]
          .filter(Boolean)
          .join(" ")
          .toLowerCase();
        if (!hay.includes(q)) return false;
      }
      return true;
    });
  }, [
    rows,
    personFilter,
    bankFilter,
    accountFilter,
    methodFilter,
    dateFrom,
    dateTo,
    search,
  ]);

  const sorted = useMemo(() => {
    const arr = [...filtered];
    const { key, dir } = sort;
    arr.sort((a, b) => {
      let av: string | number;
      let bv: string | number;
      if (key === "amount") {
        av = Number(a.amount);
        bv = Number(b.amount);
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

  const filteredTotal = useMemo(
    () => filtered.reduce((s, r) => s + Number(r.amount), 0),
    [filtered],
  );

  const activeFilterCount =
    personFilter.length +
    bankFilter.length +
    accountFilter.length +
    methodFilter.length +
    (dateFrom || dateTo ? 1 : 0) +
    (search ? 1 : 0);

  function exportCsv() {
    const header = ["Date", "Who", "Bank", "Account", "Method", "Amount", "Notes"];
    const lines = sorted.map((r) =>
      [
        r.withdrawnAt.slice(0, 10),
        `"${(r.person ?? "").replace(/"/g, '""')}"`,
        `"${(r.bank ?? "").replace(/"/g, '""')}"`,
        `"${(r.accountType ?? "").replace(/"/g, '""')}"`,
        `"${(r.method ?? "").replace(/"/g, '""')}"`,
        r.amount,
        `"${(r.notes ?? "").replace(/"/g, '""')}"`,
      ].join(","),
    );
    const csv = [header.join(","), ...lines].join("\n");
    const blob = new Blob([csv], { type: "text/csv" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = "cash-withdrawals.csv";
    a.click();
    URL.revokeObjectURL(url);
  }

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

      <div className="grid items-start gap-6 lg:grid-cols-2">
      <Panel className="space-y-4">
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

      <Panel className="space-y-4">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <h3 className="flex items-center gap-2 text-sm font-semibold text-slate-700">
            <Upload className="h-4 w-4" /> Import from CSV
          </h3>
          <div className="inline-flex rounded-lg border border-slate-300 p-0.5 text-sm">
            <button
              type="button"
              onClick={() => setImportMode("paste")}
              className={`flex items-center gap-1.5 rounded-md px-3 py-1.5 ${
                importMode === "paste"
                  ? "bg-emerald-600 text-white"
                  : "text-slate-600 hover:bg-slate-50"
              }`}
            >
              <ClipboardPaste className="h-4 w-4" /> Paste
            </button>
            <button
              type="button"
              onClick={() => setImportMode("upload")}
              className={`flex items-center gap-1.5 rounded-md px-3 py-1.5 ${
                importMode === "upload"
                  ? "bg-emerald-600 text-white"
                  : "text-slate-600 hover:bg-slate-50"
              }`}
            >
              <Upload className="h-4 w-4" /> Upload
            </button>
          </div>
        </div>

        <p className="text-xs text-slate-500">
          Paste or upload rows with a header line. Only <strong>Date</strong> and{" "}
          <strong>Amount</strong> are required; optional columns:
          Who/Person, Bank, Account, Method, Notes/Description. Missing fields
          use the defaults below (bank &amp; method are also auto-detected from
          the description, e.g. &quot;BKOFAMERICA ATM WITHDRWL&quot; → BofA /
          Cash).
        </p>

        <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
          <label className="text-xs font-medium text-slate-500">
            Default who
            <select
              value={defPerson}
              onChange={(e) => setDefPerson(e.target.value)}
              className="mt-1 w-full rounded-lg border border-slate-300 bg-white px-2 py-1.5 text-sm"
            >
              <option value="Me">Me</option>
              <option value="Spouse">Spouse</option>
            </select>
          </label>
          <label className="text-xs font-medium text-slate-500">
            Default bank
            <select
              value={defBank}
              onChange={(e) => setDefBank(e.target.value)}
              className="mt-1 w-full rounded-lg border border-slate-300 bg-white px-2 py-1.5 text-sm"
            >
              {BANKS.map((b) => (
                <option key={b} value={b}>
                  {b}
                </option>
              ))}
            </select>
          </label>
          <label className="text-xs font-medium text-slate-500">
            Default account
            <select
              value={defAccount}
              onChange={(e) => setDefAccount(e.target.value)}
              className="mt-1 w-full rounded-lg border border-slate-300 bg-white px-2 py-1.5 text-sm"
            >
              {ACCOUNT_TYPES.map((a) => (
                <option key={a} value={a}>
                  {a}
                </option>
              ))}
            </select>
          </label>
          <label className="text-xs font-medium text-slate-500">
            Default method
            <select
              value={defMethod}
              onChange={(e) => setDefMethod(e.target.value)}
              className="mt-1 w-full rounded-lg border border-slate-300 bg-white px-2 py-1.5 text-sm"
            >
              {METHODS.map((m) => (
                <option key={m} value={m}>
                  {m}
                </option>
              ))}
            </select>
          </label>
        </div>

        {importMode === "paste" ? (
          <div className="space-y-2">
            <textarea
              value={pasteText}
              onChange={(e) => setPasteText(e.target.value)}
              rows={6}
              placeholder={
                "Date,Description,Amount\n2/17/26,BKOFAMERICA ATM WITHDRWL JOURNAL SQUARE,-1500\n6/23/26,BKOFAMERICA ATM WITHDRWL,-2000"
              }
              className="w-full rounded-lg border border-slate-300 px-3 py-2 font-mono text-xs"
            />
            <Button
              type="button"
              variant="secondary"
              onClick={() => runImportParse(pasteText)}
              disabled={!pasteText.trim()}
            >
              <ClipboardPaste className="h-4 w-4" /> Parse pasted rows
            </Button>
          </div>
        ) : (
          <label className="flex cursor-pointer items-center gap-2 rounded-lg border border-dashed border-slate-300 px-3 py-2 text-sm text-slate-600 hover:bg-slate-50">
            <Upload className="h-4 w-4" />
            Choose CSV file
            <input
              type="file"
              accept=".csv,text/csv"
              className="hidden"
              onChange={onImportFile}
            />
          </label>
        )}

        {importMsg ? (
          <p className="text-sm text-slate-600">{importMsg}</p>
        ) : null}

        {parsedRows.length > 0 ? (
          <div className="space-y-2">
            <div className="flex items-center justify-between">
              <span className="text-sm font-medium text-slate-700">
                Preview — {parsedRows.length} withdrawal
                {parsedRows.length === 1 ? "" : "s"} ·{" "}
                {formatCurrency(
                  parsedRows.reduce((s, r) => s + r.amount, 0),
                )}
              </span>
              <Button type="button" onClick={doImport} disabled={importing}>
                <Check className="h-4 w-4" />
                {importing
                  ? "Importing…"
                  : `Import ${parsedRows.length} withdrawal${
                      parsedRows.length === 1 ? "" : "s"
                    }`}
              </Button>
            </div>
            <div className="max-h-64 overflow-auto rounded-lg border border-slate-200">
              <table className="w-full text-sm">
                <thead className="sticky top-0 bg-slate-50 text-left text-xs uppercase tracking-wide text-slate-500">
                  <tr>
                    <th className="px-3 py-2 font-medium">Date</th>
                    <th className="px-3 py-2 font-medium">Who</th>
                    <th className="px-3 py-2 font-medium">Bank</th>
                    <th className="px-3 py-2 font-medium">Account</th>
                    <th className="px-3 py-2 font-medium">Method</th>
                    <th className="px-3 py-2 text-right font-medium">Amount</th>
                    <th className="px-3 py-2 font-medium">Notes</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100">
                  {parsedRows.map((r, i) => (
                    <tr key={i}>
                      <td className="whitespace-nowrap px-3 py-1.5 text-slate-500">
                        {formatDate(r.withdrawnAt)}
                      </td>
                      <td className="px-3 py-1.5">{r.person || "—"}</td>
                      <td className="px-3 py-1.5 text-slate-600">{r.bank}</td>
                      <td className="px-3 py-1.5 text-slate-600">
                        {r.accountType}
                      </td>
                      <td className="px-3 py-1.5 text-slate-600">{r.method}</td>
                      <td className="whitespace-nowrap px-3 py-1.5 text-right tabular-nums">
                        {formatCurrency(r.amount)}
                      </td>
                      <td className="max-w-xs truncate px-3 py-1.5 text-slate-400">
                        {r.notes || "—"}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        ) : null}
      </Panel>
      </div>

      <div className="flex flex-wrap items-center justify-between gap-3">
        <p className="text-sm text-slate-500">
          {activeFilterCount === 0
            ? `${rows.length} withdrawal${rows.length === 1 ? "" : "s"}`
            : `${filtered.length} of ${rows.length} shown`}{" "}
          ·{" "}
          <span className="font-medium text-slate-700">
            {formatCurrency(filteredTotal)}
          </span>
        </p>
        <div className="flex flex-wrap gap-2">
          <input
            placeholder="Search…"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            className="rounded-lg border border-slate-300 bg-white px-3 py-2 text-sm"
          />
          <MultiSelect
            label="Who"
            options={personOptions}
            selected={personFilter}
            onChange={setPersonFilter}
          />
          <MultiSelect
            label="Bank"
            options={bankOptions}
            selected={bankFilter}
            onChange={setBankFilter}
          />
          <MultiSelect
            label="Account"
            options={accountOptions}
            selected={accountFilter}
            onChange={setAccountFilter}
          />
          <MultiSelect
            label="Method"
            options={methodOptions}
            selected={methodFilter}
            onChange={setMethodFilter}
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
            onClick={exportCsv}
            disabled={sorted.length === 0}
          >
            <Download className="h-4 w-4" /> Export
          </Button>
        </div>
      </div>

      <Panel className="overflow-hidden p-0">
          <div className="overflow-auto">
            <table className="w-full text-sm">
              <thead className="bg-slate-50 text-left text-xs uppercase tracking-wide text-slate-500">
                <tr>
                  <SortTh label="Date" k="withdrawnAt" sort={sort} onSort={toggleSort} />
                  <SortTh label="Who" k="person" sort={sort} onSort={toggleSort} />
                  <SortTh label="Bank" k="bank" sort={sort} onSort={toggleSort} />
                  <SortTh
                    label="Account"
                    k="accountType"
                    sort={sort}
                    onSort={toggleSort}
                  />
                  <SortTh label="Method" k="method" sort={sort} onSort={toggleSort} />
                  <SortTh
                    label="Amount"
                    k="amount"
                    sort={sort}
                    onSort={toggleSort}
                    align="right"
                  />
                  <SortTh label="Notes" k="notes" sort={sort} onSort={toggleSort} />
                  <th className="px-4 py-2.5"></th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {sorted.map((r) =>
                  editingId === r.id ? (
                    <tr key={r.id} className="bg-emerald-50/40">
                      <td className="px-3 py-1.5">
                        <input
                          type="date"
                          value={edit.withdrawnAt}
                          onChange={(e) =>
                            setEdit((s) => ({ ...s, withdrawnAt: e.target.value }))
                          }
                          className="w-full rounded-md border border-slate-300 px-2 py-1 text-xs"
                        />
                      </td>
                      <td className="px-3 py-1.5">
                        <select
                          value={edit.person}
                          onChange={(e) =>
                            setEdit((s) => ({ ...s, person: e.target.value }))
                          }
                          className="w-full rounded-md border border-slate-300 bg-white px-1.5 py-1 text-xs"
                        >
                          {optionsWith(["Me", "Spouse"], edit.person).map((p) => (
                            <option key={p} value={p}>
                              {p || "—"}
                            </option>
                          ))}
                        </select>
                      </td>
                      <td className="px-3 py-1.5">
                        <select
                          value={edit.bank}
                          onChange={(e) =>
                            setEdit((s) => ({ ...s, bank: e.target.value }))
                          }
                          className="w-full rounded-md border border-slate-300 bg-white px-1.5 py-1 text-xs"
                        >
                          {optionsWith(BANKS, edit.bank).map((b) => (
                            <option key={b} value={b}>
                              {b || "—"}
                            </option>
                          ))}
                        </select>
                      </td>
                      <td className="px-3 py-1.5">
                        <select
                          value={edit.accountType}
                          onChange={(e) =>
                            setEdit((s) => ({
                              ...s,
                              accountType: e.target.value,
                            }))
                          }
                          className="w-full rounded-md border border-slate-300 bg-white px-1.5 py-1 text-xs"
                        >
                          {optionsWith(ACCOUNT_TYPES, edit.accountType).map(
                            (a) => (
                              <option key={a} value={a}>
                                {a || "—"}
                              </option>
                            ),
                          )}
                        </select>
                      </td>
                      <td className="px-3 py-1.5">
                        <select
                          value={edit.method}
                          onChange={(e) =>
                            setEdit((s) => ({ ...s, method: e.target.value }))
                          }
                          className="w-full rounded-md border border-slate-300 bg-white px-1.5 py-1 text-xs"
                        >
                          {optionsWith(METHODS, edit.method).map((m) => (
                            <option key={m} value={m}>
                              {m || "—"}
                            </option>
                          ))}
                        </select>
                      </td>
                      <td className="px-3 py-1.5">
                        <input
                          type="number"
                          step="0.01"
                          value={edit.amount}
                          onChange={(e) =>
                            setEdit((s) => ({ ...s, amount: e.target.value }))
                          }
                          className="w-24 rounded-md border border-slate-300 px-2 py-1 text-right text-xs tabular-nums"
                        />
                      </td>
                      <td className="px-3 py-1.5">
                        <input
                          value={edit.notes}
                          onChange={(e) =>
                            setEdit((s) => ({ ...s, notes: e.target.value }))
                          }
                          className="w-full rounded-md border border-slate-300 px-2 py-1 text-xs"
                        />
                      </td>
                      <td className="px-3 py-1.5">
                        <div className="flex items-center justify-end gap-1">
                          <button
                            title="Save"
                            onClick={() => saveEdit(r.id)}
                            className="rounded-md p-1.5 text-emerald-600 hover:bg-emerald-100"
                          >
                            <Check className="h-4 w-4" />
                          </button>
                          <button
                            title="Cancel"
                            onClick={() => setEditingId(null)}
                            className="rounded-md p-1.5 text-slate-400 hover:bg-slate-100 hover:text-slate-600"
                          >
                            <X className="h-4 w-4" />
                          </button>
                        </div>
                      </td>
                    </tr>
                  ) : (
                    <tr key={r.id} className="hover:bg-slate-50">
                      <td className="whitespace-nowrap px-4 py-2 text-slate-500">
                        {formatDate(r.withdrawnAt)}
                      </td>
                      <td className="px-4 py-2">{r.person || "—"}</td>
                      <td className="px-4 py-2 text-slate-600">
                        {r.bank || "—"}
                      </td>
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
                        <div className="flex items-center justify-end gap-1">
                          <button
                            title="Edit"
                            onClick={() => startEdit(r)}
                            className="rounded-md p-1.5 text-slate-400 hover:bg-slate-100 hover:text-slate-700"
                          >
                            <Pencil className="h-4 w-4" />
                          </button>
                          <button
                            title="Delete"
                            onClick={() => remove(r.id)}
                            className="rounded-md p-1.5 text-slate-400 hover:bg-rose-50 hover:text-rose-600"
                          >
                            <Trash2 className="h-4 w-4" />
                          </button>
                        </div>
                      </td>
                    </tr>
                  ),
                )}
              </tbody>
              {sorted.length > 0 ? (
                <tfoot className="border-t border-slate-200 text-sm font-semibold">
                  <tr>
                    <td className="px-4 py-2.5" colSpan={5}>
                      Total
                    </td>
                    <td className="px-4 py-2.5 text-right tabular-nums">
                      {formatCurrency(filteredTotal)}
                    </td>
                    <td colSpan={2} />
                  </tr>
                </tfoot>
              ) : null}
            </table>
            {!loading && sorted.length === 0 ? (
              <p className="p-8 text-center text-sm text-slate-400">
                {rows.length === 0
                  ? "No cash withdrawals logged yet."
                  : "No withdrawals match your filters."}
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
    <th
      className={`px-4 py-2.5 font-medium ${align === "right" ? "text-right" : ""}`}
    >
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
