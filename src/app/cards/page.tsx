"use client";

import { useEffect, useState } from "react";
import { Panel, Button } from "@/components/ui";
import { formatCurrency } from "@/lib/utils";
import { CATEGORIES } from "@/lib/categorize";
import { CreditCard, Plus, Check } from "lucide-react";

interface Card {
  id: number;
  name: string;
  issuer: string | null;
  owner: string | null;
  last4: string | null;
  annualFee: string | null;
  active: boolean;
}

export default function CardsPage() {
  const [cards, setCards] = useState<Card[]>([]);
  const [name, setName] = useState("");
  const [issuer, setIssuer] = useState("");
  const [owner, setOwner] = useState("Me");
  const [annualFee, setAnnualFee] = useState("");
  const [saving, setSaving] = useState(false);

  function load() {
    fetch("/api/cards")
      .then((r) => r.json())
      .then((d) => Array.isArray(d) && setCards(d));
  }
  useEffect(load, []);

  async function addCard(e: React.FormEvent) {
    e.preventDefault();
    if (!name.trim()) return;
    setSaving(true);
    try {
      await fetch("/api/cards", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          name,
          issuer: issuer || null,
          owner: owner || null,
          annualFee: annualFee || 0,
        }),
      });
      setName("");
      setIssuer("");
      setAnnualFee("");
      load();
    } finally {
      setSaving(false);
    }
  }

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold tracking-tight">Cards & manual entry</h1>
        <p className="text-sm text-slate-500">
          Add your cards (with annual fees) and log the ~5% of spend that runs
          through your checking account.
        </p>
      </div>

      <div className="grid gap-6 lg:grid-cols-2">
        <Panel className="space-y-4">
          <h3 className="flex items-center gap-2 text-sm font-semibold text-slate-700">
            <CreditCard className="h-4 w-4" /> Your cards
          </h3>

          <div className="space-y-4">
            {groupOwners(cards).map(([groupName, groupCards]) => (
              <div key={groupName} className="space-y-2">
                <div className="flex items-center justify-between">
                  <span className="text-xs font-semibold uppercase tracking-wide text-slate-400">
                    {groupName}
                  </span>
                  <span className="text-xs text-slate-400">
                    Fees{" "}
                    {formatCurrency(
                      groupCards.reduce(
                        (s, c) => s + Number(c.annualFee ?? 0),
                        0,
                      ),
                    )}
                    /yr
                  </span>
                </div>
                {groupCards.map((c) => (
                  <div
                    key={c.id}
                    className="flex items-center justify-between rounded-lg border border-slate-200 px-3 py-2"
                  >
                    <div>
                      <div className="flex items-center gap-2 text-sm font-medium">
                        {c.name}
                        {c.active === false ? (
                          <span className="rounded-full bg-slate-200 px-2 py-0.5 text-[10px] font-semibold uppercase text-slate-500">
                            Closed
                          </span>
                        ) : null}
                      </div>
                      <div className="text-xs text-slate-500">
                        {c.issuer ? `${c.issuer} · ` : ""}
                        Annual fee {formatCurrency(c.annualFee ?? 0)}
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            ))}
            {cards.length === 0 ? (
              <p className="text-sm text-slate-400">
                No cards yet — run <code>npm run db:seed</code> to load your
                cards, or add one below.
              </p>
            ) : null}
          </div>

          <form
            onSubmit={addCard}
            className="space-y-3 border-t border-slate-100 pt-4"
          >
            <div className="grid grid-cols-2 gap-3">
              <input
                placeholder="Card name (e.g. Amex Platinum)"
                value={name}
                onChange={(e) => setName(e.target.value)}
                className="col-span-2 rounded-lg border border-slate-300 px-3 py-2 text-sm"
              />
              <input
                placeholder="Issuer (Amex)"
                value={issuer}
                onChange={(e) => setIssuer(e.target.value)}
                className="rounded-lg border border-slate-300 px-3 py-2 text-sm"
              />
              <select
                value={owner}
                onChange={(e) => setOwner(e.target.value)}
                className="rounded-lg border border-slate-300 bg-white px-3 py-2 text-sm"
              >
                <option value="Me">Me</option>
                <option value="Spouse">Spouse</option>
              </select>
              <input
                placeholder="Annual fee"
                type="number"
                step="0.01"
                value={annualFee}
                onChange={(e) => setAnnualFee(e.target.value)}
                className="col-span-2 rounded-lg border border-slate-300 px-3 py-2 text-sm"
              />
            </div>
            <Button type="submit" disabled={saving}>
              <Plus className="h-4 w-4" /> Add card
            </Button>
          </form>
        </Panel>

        <ManualEntry cards={cards} />
      </div>
    </div>
  );
}

function groupOwners(cards: Card[]): [string, Card[]][] {
  const groups = new Map<string, Card[]>();
  for (const c of cards) {
    const key = c.owner ?? "Unassigned";
    if (!groups.has(key)) groups.set(key, []);
    groups.get(key)!.push(c);
  }
  const order = ["Me", "Spouse", "Unassigned"];
  return [...groups.entries()].sort(
    (a, b) => order.indexOf(a[0]) - order.indexOf(b[0]),
  );
}

function ManualEntry({ cards }: { cards: Card[] }) {
  const [txnDate, setTxnDate] = useState(() =>
    new Date().toISOString().slice(0, 10),
  );
  const [description, setDescription] = useState("");
  const [amount, setAmount] = useState("");
  const [category, setCategory] = useState("Uncategorized");
  const [cardId, setCardId] = useState("");
  const [saved, setSaved] = useState(false);
  const [saving, setSaving] = useState(false);

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    const amt = parseFloat(amount);
    if (!description.trim() || Number.isNaN(amt)) return;
    setSaving(true);
    try {
      await fetch("/api/transactions", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          txnDate,
          description,
          amount: amt,
          category,
          cardId: cardId || null,
          account: cardId ? undefined : "Checking",
        }),
      });
      setDescription("");
      setAmount("");
      setSaved(true);
      setTimeout(() => setSaved(false), 2000);
    } finally {
      setSaving(false);
    }
  }

  return (
    <Panel className="space-y-4">
      <h3 className="flex items-center gap-2 text-sm font-semibold text-slate-700">
        <Plus className="h-4 w-4" /> Add an expense manually
      </h3>
      <p className="text-xs text-slate-500">
        Use a positive amount for money spent (e.g. rent, utilities paid from
        checking). Use a negative amount for money received.
      </p>
      <form onSubmit={submit} className="space-y-3">
        <div className="grid grid-cols-2 gap-3">
          <label className="text-xs font-medium text-slate-500">
            Date
            <input
              type="date"
              value={txnDate}
              onChange={(e) => setTxnDate(e.target.value)}
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
        <input
          placeholder="Description (e.g. Rent, Water bill)"
          value={description}
          onChange={(e) => setDescription(e.target.value)}
          className="w-full rounded-lg border border-slate-300 px-3 py-2 text-sm"
        />
        <div className="grid grid-cols-2 gap-3">
          <select
            value={category}
            onChange={(e) => setCategory(e.target.value)}
            className="rounded-lg border border-slate-300 bg-white px-3 py-2 text-sm"
          >
            {CATEGORIES.map((c) => (
              <option key={c} value={c}>
                {c}
              </option>
            ))}
          </select>
          <select
            value={cardId}
            onChange={(e) => setCardId(e.target.value)}
            className="rounded-lg border border-slate-300 bg-white px-3 py-2 text-sm"
          >
            <option value="">Checking / cash</option>
            {cards.map((c) => (
              <option key={c.id} value={c.id}>
                {c.name}
              </option>
            ))}
          </select>
        </div>
        <Button type="submit" disabled={saving}>
          {saved ? (
            <>
              <Check className="h-4 w-4" /> Added
            </>
          ) : (
            <>
              <Plus className="h-4 w-4" /> Add expense
            </>
          )}
        </Button>
      </form>
    </Panel>
  );
}
