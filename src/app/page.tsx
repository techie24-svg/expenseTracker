"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import {
  BarChart,
  Bar,
  XAxis,
  YAxis,
  Tooltip,
  Legend,
  ResponsiveContainer,
} from "recharts";
import { Panel, StatCard, Button } from "@/components/ui";
import { formatCurrency } from "@/lib/utils";
import { AlertTriangle, Upload } from "lucide-react";

interface Stats {
  month: string;
  trueExpenses: number;
  rawSpend: number;
  annualFees: number;
  interest: number;
  creditsCaptured: number;
  refundsCaptured: number;
  needsReview: number;
  byCategory: { name: string; value: number }[];
  byCard: { name: string; value: number }[];
  byMonth: { name: string; value: number }[];
  categoryKeys: string[];
  byMonthStacked: Record<string, string | number>[];
  byCardStacked: Record<string, string | number>[];
  byCardLedger: {
    name: string;
    spend: number;
    credits: number;
    refunds: number;
    net: number;
  }[];
}

const CAT_COLORS = [
  "#10b981", "#6366f1", "#f59e0b", "#ec4899", "#06b6d4",
  "#8b5cf6", "#ef4444", "#14b8a6", "#f97316", "#0ea5e9",
  "#a855f7", "#84cc16", "#64748b",
];

function monthLabel(ym: string) {
  const [y, m] = ym.split("-").map(Number);
  return new Date(Date.UTC(y, m - 1, 1)).toLocaleDateString("en-US", {
    month: "short",
    year: "2-digit",
    timeZone: "UTC",
  });
}

export default function DashboardPage() {
  const [all, setAll] = useState<Stats | null>(null);
  const [current, setCurrent] = useState<Stats | null>(null);
  const [month, setMonth] = useState<string>("all");
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    fetch("/api/stats?month=all")
      .then((r) => r.json())
      .then((d) => {
        if (d.error) setError(d.error);
        else setAll(d);
      })
      .catch((e) => setError(String(e)));
  }, []);

  useEffect(() => {
    const q = month === "all" ? "all" : month;
    fetch(`/api/stats?month=${q}`)
      .then((r) => r.json())
      .then((d) => !d.error && setCurrent(d))
      .catch(() => {});
  }, [month]);

  const stats = current ?? all;
  // Shared category order/colors so both stacked charts and the legend match.
  const categoryKeys = all?.categoryKeys ?? stats?.categoryKeys ?? [];
  const catColor = (cat: string) => {
    const idx = categoryKeys.indexOf(cat);
    return CAT_COLORS[(idx < 0 ? 0 : idx) % CAT_COLORS.length];
  };
  const months = all?.byMonth.map((m) => m.name) ?? [];
  const netCardValue = stats
    ? stats.creditsCaptured - stats.annualFees
    : 0;

  if (error) {
    return (
      <Panel className="border-rose-200 bg-rose-50">
        <h2 className="mb-2 font-semibold text-rose-800">
          Couldn&apos;t load data
        </h2>
        <p className="text-sm text-rose-700">{error}</p>
        <p className="mt-3 text-sm text-rose-700">
          Make sure your Neon <code>DATABASE_URL</code> is set in{" "}
          <code>.env.local</code> and you&apos;ve run <code>npm run db:push</code>.
        </p>
      </Panel>
    );
  }

  const isEmpty = all && all.byMonth.length === 0 && all.trueExpenses === 0;

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h1 className="text-2xl font-bold tracking-tight">Dashboard</h1>
          <p className="text-sm text-slate-500">
            Your true household expenses — credits &amp; refunds reduce the
            total, fees kept in.
          </p>
        </div>
        <select
          value={month}
          onChange={(e) => setMonth(e.target.value)}
          className="rounded-lg border border-slate-300 bg-white px-3 py-2 text-sm font-medium"
        >
          <option value="all">All time</option>
          {months.map((m) => (
            <option key={m} value={m}>
              {monthLabel(m)}
            </option>
          ))}
        </select>
      </div>

      {isEmpty ? (
        <Panel className="flex flex-col items-center gap-4 py-12 text-center">
          <div className="flex h-14 w-14 items-center justify-center rounded-2xl bg-emerald-50 text-emerald-600">
            <Upload className="h-7 w-7" />
          </div>
          <div>
            <h2 className="text-lg font-semibold">No transactions yet</h2>
            <p className="mt-1 text-sm text-slate-500">
              Import a credit card statement CSV to get started.
            </p>
          </div>
          <Link href="/import">
            <Button>
              <Upload className="h-4 w-4" /> Import a statement
            </Button>
          </Link>
        </Panel>
      ) : null}

      {stats && stats.needsReview > 0 ? (
        <Link href="/review" className="block">
          <div className="flex items-center gap-3 rounded-xl border border-amber-200 bg-amber-50 px-4 py-3 text-amber-800 transition-colors hover:bg-amber-100">
            <AlertTriangle className="h-5 w-5 shrink-0" />
            <span className="text-sm font-medium">
              {stats.needsReview} credit
              {stats.needsReview > 1 ? "s" : ""} need review to net out against a
              purchase.
            </span>
            <span className="ml-auto text-sm font-semibold underline">
              Review now
            </span>
          </div>
        </Link>
      ) : null}

      {stats && !isEmpty ? (
        <>
          <div className="grid grid-cols-2 gap-4 lg:grid-cols-5">
            <StatCard
              label="True expenses"
              value={formatCurrency(stats.trueExpenses)}
              sub={month === "all" ? "All time" : monthLabel(month)}
              accent="slate"
            />
            <StatCard
              label="Raw card spend"
              value={formatCurrency(stats.rawSpend)}
              sub="Before netting credits"
              accent="indigo"
            />
            <StatCard
              label="Credits captured"
              value={formatCurrency(stats.creditsCaptured)}
              sub="Statement / offset credits received"
              accent="emerald"
            />
            <StatCard
              label="Refunds captured"
              value={formatCurrency(stats.refundsCaptured)}
              sub="Merchant refunds returned"
              accent="emerald"
            />
            <StatCard
              label="Annual fees paid"
              value={formatCurrency(stats.annualFees)}
              sub={`Net card value ${formatCurrency(netCardValue, true)}`}
              accent={netCardValue >= 0 ? "emerald" : "rose"}
            />
          </div>

          <div className="grid gap-6 lg:grid-cols-5">
            <Panel className="lg:col-span-3">
              <h3 className="mb-4 text-sm font-semibold text-slate-700">
                Monthly true expenses
              </h3>
              <div className="h-64">
                <ResponsiveContainer width="100%" height="100%">
                  <BarChart data={all?.byMonthStacked ?? []}>
                    <XAxis
                      dataKey="name"
                      tickFormatter={monthLabel}
                      tick={{ fontSize: 12, fill: "#64748b" }}
                      axisLine={false}
                      tickLine={false}
                    />
                    <YAxis
                      tick={{ fontSize: 12, fill: "#64748b" }}
                      axisLine={false}
                      tickLine={false}
                      tickFormatter={(v) => `$${(v / 1000).toFixed(0)}k`}
                    />
                    <Tooltip
                      formatter={(v, n) => [formatCurrency(v as number), n as string]}
                      labelFormatter={(l) => monthLabel(l as string)}
                    />
                    {categoryKeys.map((cat, i) => (
                      <Bar
                        key={cat}
                        dataKey={cat}
                        stackId="cat"
                        fill={catColor(cat)}
                        radius={
                          i === categoryKeys.length - 1 ? [6, 6, 0, 0] : undefined
                        }
                      />
                    ))}
                  </BarChart>
                </ResponsiveContainer>
              </div>
            </Panel>

            <Panel className="lg:col-span-2">
              <h3 className="mb-4 text-sm font-semibold text-slate-700">
                By category
              </h3>
              <div className="space-y-2">
                {stats.byCategory.slice(0, 8).map((c) => {
                  const max = stats.byCategory[0]?.value || 1;
                  return (
                    <div key={c.name} className="space-y-1">
                      <div className="flex justify-between text-sm">
                        <span className="text-slate-600">{c.name}</span>
                        <span className="font-medium tabular-nums">
                          {formatCurrency(c.value)}
                        </span>
                      </div>
                      <div className="h-2 overflow-hidden rounded-full bg-slate-100">
                        <div
                          className="h-full rounded-full"
                          style={{
                            width: `${Math.max(3, (c.value / max) * 100)}%`,
                            backgroundColor: catColor(c.name),
                          }}
                        />
                      </div>
                    </div>
                  );
                })}
                {stats.byCategory.length === 0 ? (
                  <p className="text-sm text-slate-400">No expenses in range.</p>
                ) : null}
              </div>
            </Panel>
          </div>

          <Panel>
            <h3 className="mb-4 text-sm font-semibold text-slate-700">
              By card / account
            </h3>
            <div className="h-72">
              <ResponsiveContainer width="100%" height="100%">
                <BarChart
                  data={stats.byCardStacked}
                  layout="vertical"
                  margin={{ left: 20 }}
                >
                  <XAxis
                    type="number"
                    tick={{ fontSize: 11, fill: "#94a3b8" }}
                    axisLine={false}
                    tickLine={false}
                    tickFormatter={(v) => `$${(v / 1000).toFixed(0)}k`}
                  />
                  <YAxis
                    type="category"
                    dataKey="name"
                    width={130}
                    tick={{ fontSize: 12, fill: "#334155" }}
                    axisLine={false}
                    tickLine={false}
                  />
                  <Tooltip
                    formatter={(v, n) => [formatCurrency(v as number), n as string]}
                  />
                  <Legend
                    wrapperStyle={{ fontSize: 12 }}
                    iconType="circle"
                    iconSize={9}
                  />
                  {categoryKeys.map((cat) => (
                    <Bar
                      key={cat}
                      dataKey={cat}
                      stackId="cat"
                      fill={catColor(cat)}
                    />
                  ))}
                </BarChart>
              </ResponsiveContainer>
            </div>
          </Panel>

          <Panel className="p-0">
            <h3 className="border-b border-slate-100 px-5 py-3 text-sm font-semibold text-slate-700">
              Credits &amp; refunds by card
            </h3>
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead className="text-left text-xs uppercase tracking-wide text-slate-500">
                  <tr>
                    <th className="px-5 py-2 font-medium">Card / account</th>
                    <th className="px-4 py-2 text-right font-medium">Spend</th>
                    <th className="px-4 py-2 text-right font-medium">Credits</th>
                    <th className="px-4 py-2 text-right font-medium">Refunds</th>
                    <th className="px-5 py-2 text-right font-medium">Net</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100">
                  {stats.byCardLedger.map((c) => (
                    <tr key={c.name} className="hover:bg-slate-50">
                      <td className="px-5 py-2 font-medium text-slate-800">
                        {c.name}
                      </td>
                      <td className="px-4 py-2 text-right tabular-nums text-slate-700">
                        {formatCurrency(c.spend)}
                      </td>
                      <td className="px-4 py-2 text-right tabular-nums text-emerald-600">
                        {c.credits ? `−${formatCurrency(c.credits)}` : "—"}
                      </td>
                      <td className="px-4 py-2 text-right tabular-nums text-emerald-600">
                        {c.refunds ? `−${formatCurrency(c.refunds)}` : "—"}
                      </td>
                      <td className="px-5 py-2 text-right font-semibold tabular-nums text-slate-900">
                        {formatCurrency(c.net)}
                      </td>
                    </tr>
                  ))}
                  {stats.byCardLedger.length === 0 ? (
                    <tr>
                      <td
                        colSpan={5}
                        className="px-5 py-4 text-center text-slate-400"
                      >
                        No activity in range.
                      </td>
                    </tr>
                  ) : null}
                </tbody>
                {stats.byCardLedger.length > 0 ? (
                  <tfoot className="border-t border-slate-200 text-sm font-semibold">
                    <tr>
                      <td className="px-5 py-2.5">Total</td>
                      <td className="px-4 py-2.5 text-right tabular-nums">
                        {formatCurrency(
                          stats.byCardLedger.reduce((s, c) => s + c.spend, 0),
                        )}
                      </td>
                      <td className="px-4 py-2.5 text-right tabular-nums text-emerald-600">
                        −
                        {formatCurrency(
                          stats.byCardLedger.reduce((s, c) => s + c.credits, 0),
                        )}
                      </td>
                      <td className="px-4 py-2.5 text-right tabular-nums text-emerald-600">
                        −
                        {formatCurrency(
                          stats.byCardLedger.reduce((s, c) => s + c.refunds, 0),
                        )}
                      </td>
                      <td className="px-5 py-2.5 text-right tabular-nums">
                        {formatCurrency(
                          stats.byCardLedger.reduce((s, c) => s + c.net, 0),
                        )}
                      </td>
                    </tr>
                  </tfoot>
                ) : null}
              </table>
            </div>
          </Panel>
        </>
      ) : null}
    </div>
  );
}
