"use client";

import { useEffect, useState } from "react";
import { Panel, Button } from "@/components/ui";
import { formatCurrency, formatDate } from "@/lib/utils";
import { Check, X, RefreshCw, GitMerge, ArrowRight } from "lucide-react";

interface Suggestion {
  creditId: number;
  creditDate: string;
  creditDescription: string;
  creditAmount: string;
  creditCardName: string | null;
  purchaseId: number;
  purchaseDate: string;
  purchaseDescription: string;
  purchaseAmount: string;
}

export default function ReviewPage() {
  const [items, setItems] = useState<Suggestion[]>([]);
  const [loading, setLoading] = useState(true);
  const [rescanning, setRescanning] = useState(false);

  function load() {
    setLoading(true);
    fetch("/api/netting")
      .then((r) => r.json())
      .then((d) => Array.isArray(d) && setItems(d))
      .finally(() => setLoading(false));
  }

  useEffect(load, []);

  async function act(
    creditId: number,
    purchaseId: number,
    action: "confirm" | "reject",
  ) {
    setItems((prev) => prev.filter((i) => i.creditId !== creditId));
    await fetch("/api/netting", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ action, creditId, purchaseId }),
    });
  }

  async function rescan() {
    setRescanning(true);
    try {
      await fetch("/api/netting", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ action: "rescan" }),
      });
      load();
    } finally {
      setRescanning(false);
    }
  }

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h1 className="text-2xl font-bold tracking-tight">Netting review</h1>
          <p className="text-sm text-slate-500">
            These credits look like they offset a purchase, but the merchant
            wasn&apos;t an obvious match. Confirm to net them out.
          </p>
        </div>
        <Button variant="secondary" onClick={rescan} disabled={rescanning}>
          <RefreshCw
            className={`h-4 w-4 ${rescanning ? "animate-spin" : ""}`}
          />
          Rescan for matches
        </Button>
      </div>

      {!loading && items.length === 0 ? (
        <Panel className="flex flex-col items-center gap-3 py-12 text-center">
          <div className="flex h-12 w-12 items-center justify-center rounded-2xl bg-emerald-50 text-emerald-600">
            <GitMerge className="h-6 w-6" />
          </div>
          <div>
            <h2 className="font-semibold">Nothing to review</h2>
            <p className="mt-1 text-sm text-slate-500">
              Confident matches are netted automatically. Anything ambiguous will
              show up here.
            </p>
          </div>
        </Panel>
      ) : null}

      <div className="space-y-3">
        {items.map((s) => (
          <Panel key={s.creditId} className="flex flex-wrap items-center gap-4">
            <div className="flex flex-1 flex-wrap items-center gap-4">
              <div className="min-w-[200px] flex-1 rounded-lg border border-emerald-200 bg-emerald-50 p-3">
                <div className="text-xs font-medium uppercase text-emerald-700">
                  Credit
                </div>
                <div className="mt-0.5 truncate text-sm font-medium">
                  {s.creditDescription}
                </div>
                <div className="flex items-center justify-between text-xs text-slate-500">
                  <span>{formatDate(s.creditDate)}</span>
                  <span className="font-semibold text-emerald-700">
                    {formatCurrency(s.creditAmount, true)}
                  </span>
                </div>
              </div>

              <ArrowRight className="h-5 w-5 shrink-0 text-slate-400" />

              <div className="min-w-[200px] flex-1 rounded-lg border border-slate-200 bg-slate-50 p-3">
                <div className="text-xs font-medium uppercase text-slate-500">
                  Purchase
                </div>
                <div className="mt-0.5 truncate text-sm font-medium">
                  {s.purchaseDescription}
                </div>
                <div className="flex items-center justify-between text-xs text-slate-500">
                  <span>{formatDate(s.purchaseDate)}</span>
                  <span className="font-semibold text-slate-700">
                    {formatCurrency(s.purchaseAmount, true)}
                  </span>
                </div>
              </div>
            </div>

            <div className="flex gap-2">
              <Button
                onClick={() => act(s.creditId, s.purchaseId, "confirm")}
              >
                <Check className="h-4 w-4" /> Net out
              </Button>
              <Button
                variant="secondary"
                onClick={() => act(s.creditId, s.purchaseId, "reject")}
              >
                <X className="h-4 w-4" /> Keep separate
              </Button>
            </div>
          </Panel>
        ))}
      </div>
    </div>
  );
}
