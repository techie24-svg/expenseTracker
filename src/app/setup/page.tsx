"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { Panel, Button } from "@/components/ui";
import { CategoryManager } from "@/components/CategoryManager";
import {
  Database,
  CheckCircle2,
  AlertTriangle,
  Loader2,
  Trash2,
} from "lucide-react";

interface Status {
  ready: boolean;
  cardCount?: number;
  txnCount?: number;
  error?: string;
}

export default function SetupPage() {
  const [status, setStatus] = useState<Status | null>(null);
  const [running, setRunning] = useState(false);
  const [result, setResult] = useState<{
    inserted: number;
    skipped: number;
  } | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [resetting, setResetting] = useState<"transactions" | "all" | null>(
    null,
  );
  const [resetMsg, setResetMsg] = useState<string | null>(null);

  function refresh() {
    fetch("/api/setup")
      .then((r) => r.json())
      .then(setStatus)
      .catch((e) => setStatus({ ready: false, error: String(e) }));
  }

  useEffect(refresh, []);

  async function initialize() {
    setRunning(true);
    setError(null);
    setResult(null);
    try {
      const res = await fetch("/api/setup", { method: "POST" });
      const data = await res.json();
      if (!data.ok) {
        setError(data.error || "Setup failed");
      } else {
        setResult({ inserted: data.inserted, skipped: data.skipped });
        refresh();
      }
    } catch (e) {
      setError(String(e));
    } finally {
      setRunning(false);
    }
  }

  async function reset(scope: "transactions" | "all") {
    const msg =
      scope === "all"
        ? "Delete ALL transactions AND cards, then re-seed your cards? This cannot be undone."
        : "Delete ALL transactions? Your cards stay. This cannot be undone.";
    if (!confirm(msg)) return;
    setResetting(scope);
    setResetMsg(null);
    setError(null);
    try {
      const res = await fetch("/api/reset", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ scope }),
      });
      const data = await res.json();
      if (data.error) {
        setError(data.error);
      } else {
        setResetMsg(
          scope === "all"
            ? `Everything cleared and ${data.reseeded ?? 0} cards re-seeded.`
            : "All transactions cleared.",
        );
        refresh();
      }
    } catch (e) {
      setError(String(e));
    } finally {
      setResetting(null);
    }
  }

  const dbError = status?.error;

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold tracking-tight">Database setup</h1>
        <p className="text-sm text-slate-500">
          One-click initialize: creates the tables in your Neon database and
          loads your household&apos;s cards. Safe to run again — it never
          duplicates or deletes anything.
        </p>
      </div>

      <Panel className="space-y-4">
        <div className="flex items-center gap-3">
          <div
            className={`flex h-10 w-10 items-center justify-center rounded-xl ${
              status?.ready
                ? "bg-emerald-50 text-emerald-600"
                : "bg-slate-100 text-slate-500"
            }`}
          >
            <Database className="h-5 w-5" />
          </div>
          <div>
            <div className="text-sm font-semibold">
              {status === null
                ? "Checking connection…"
                : dbError
                  ? "Not connected"
                  : status.ready
                    ? "Database ready"
                    : "Connected — not initialized yet"}
            </div>
            <div className="text-xs text-slate-500">
              {status?.ready
                ? `${status.cardCount ?? 0} cards · ${status.txnCount ?? 0} transactions`
                : "Neon Postgres"}
            </div>
          </div>
        </div>

        {dbError ? (
          <div className="flex items-start gap-2 rounded-lg border border-rose-200 bg-rose-50 p-3 text-sm text-rose-700">
            <AlertTriangle className="mt-0.5 h-4 w-4 shrink-0" />
            <div>
              <p className="font-medium">Can&apos;t reach the database.</p>
              <p className="mt-1 text-xs">
                Set <code>DATABASE_URL</code> in <code>.env.local</code> (local)
                or in your Vercel project&apos;s Environment Variables
                (production), then reload this page. Details: {dbError}
              </p>
            </div>
          </div>
        ) : null}

        {result ? (
          <div className="flex items-center gap-2 rounded-lg border border-emerald-200 bg-emerald-50 p-3 text-sm text-emerald-700">
            <CheckCircle2 className="h-4 w-4 shrink-0" />
            <span>
              Done — {result.inserted} card{result.inserted === 1 ? "" : "s"}{" "}
              added
              {result.skipped > 0 ? `, ${result.skipped} already existed` : ""}.
            </span>
          </div>
        ) : null}

        {error ? (
          <div className="rounded-lg border border-rose-200 bg-rose-50 p-3 text-sm text-rose-700">
            {error}
          </div>
        ) : null}

        <div className="flex flex-wrap items-center gap-3">
          <Button onClick={initialize} disabled={running || Boolean(dbError)}>
            {running ? (
              <>
                <Loader2 className="h-4 w-4 animate-spin" /> Initializing…
              </>
            ) : status?.ready ? (
              "Re-run setup (safe)"
            ) : (
              "Initialize database"
            )}
          </Button>
          {status?.ready ? (
            <Link href="/import">
              <Button variant="secondary">Go import a statement</Button>
            </Link>
          ) : null}
        </div>
      </Panel>

      <Panel className="space-y-2 text-sm text-slate-600">
        <h3 className="font-semibold text-slate-700">What this does</h3>
        <ul className="list-inside list-disc space-y-1 text-slate-500">
          <li>Creates the <code>cards</code> and <code>transactions</code> tables (if they don&apos;t exist).</li>
          <li>Seeds your 17 household cards with their annual fees.</li>
          <li>Skips anything already there, so re-running is harmless.</li>
        </ul>
      </Panel>

      <CategoryManager />

      <Panel className="space-y-4 border-rose-200">
        <div className="flex items-center gap-2">
          <AlertTriangle className="h-4 w-4 text-rose-600" />
          <h3 className="text-sm font-semibold text-rose-700">Danger zone</h3>
        </div>
        <p className="text-sm text-slate-500">
          Reset your data to start fresh. This permanently deletes rows from the
          database and can&apos;t be undone.
        </p>

        {resetMsg ? (
          <div className="flex items-center gap-2 rounded-lg border border-emerald-200 bg-emerald-50 p-3 text-sm text-emerald-700">
            <CheckCircle2 className="h-4 w-4 shrink-0" />
            <span>{resetMsg}</span>
          </div>
        ) : null}

        <div className="flex flex-wrap gap-3">
          <Button
            variant="secondary"
            onClick={() => reset("transactions")}
            disabled={Boolean(resetting) || Boolean(dbError)}
          >
            {resetting === "transactions" ? (
              <>
                <Loader2 className="h-4 w-4 animate-spin" /> Clearing…
              </>
            ) : (
              <>
                <Trash2 className="h-4 w-4" /> Clear transactions (keep cards)
              </>
            )}
          </Button>
          <Button
            variant="danger"
            onClick={() => reset("all")}
            disabled={Boolean(resetting) || Boolean(dbError)}
          >
            {resetting === "all" ? (
              <>
                <Loader2 className="h-4 w-4 animate-spin" /> Resetting…
              </>
            ) : (
              <>
                <Trash2 className="h-4 w-4" /> Reset everything &amp; re-seed cards
              </>
            )}
          </Button>
        </div>
      </Panel>
    </div>
  );
}
