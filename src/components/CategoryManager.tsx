"use client";

import { useState } from "react";
import { Panel, Button, Badge } from "@/components/ui";
import { useCategories } from "@/lib/useCategories";
import { Tags, Plus, Pencil, Trash2, Check, X } from "lucide-react";

export function CategoryManager() {
  const { categories, loading, refresh } = useCategories();
  const [newName, setNewName] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [editing, setEditing] = useState<string | null>(null);
  const [editValue, setEditValue] = useState("");

  async function addCategory() {
    const name = newName.trim();
    if (!name) return;
    setBusy(true);
    setError(null);
    try {
      const res = await fetch("/api/categories", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ name }),
      });
      const data = await res.json();
      if (data.error) setError(data.error);
      else {
        setNewName("");
        refresh();
      }
    } finally {
      setBusy(false);
    }
  }

  async function saveRename(oldName: string) {
    const newVal = editValue.trim();
    if (!newVal || newVal === oldName) {
      setEditing(null);
      return;
    }
    setBusy(true);
    setError(null);
    try {
      const res = await fetch("/api/categories", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ oldName, newName: newVal }),
      });
      const data = await res.json();
      if (data.error) setError(data.error);
      else {
        setEditing(null);
        refresh();
      }
    } finally {
      setBusy(false);
    }
  }

  async function remove(name: string) {
    if (
      !confirm(
        `Delete "${name}"? Any transactions using it will become "Uncategorized".`,
      )
    )
      return;
    setBusy(true);
    setError(null);
    try {
      const res = await fetch("/api/categories", {
        method: "DELETE",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ name }),
      });
      const data = await res.json();
      if (data.error) setError(data.error);
      else refresh();
    } finally {
      setBusy(false);
    }
  }

  const customCount = categories.filter((c) => c.custom).length;

  return (
    <Panel className="space-y-4">
      <div className="flex items-center gap-2">
        <Tags className="h-4 w-4 text-slate-600" />
        <h3 className="text-sm font-semibold text-slate-700">Categories</h3>
      </div>
      <p className="text-sm text-slate-500">
        Add your own categories (like &quot;Vacation&quot;) to organize spend.
        Built-in ones are locked; custom ones can be renamed or deleted.
      </p>

      <div className="flex flex-wrap items-center gap-2">
        <input
          value={newName}
          onChange={(e) => setNewName(e.target.value)}
          onKeyDown={(e) => e.key === "Enter" && addCategory()}
          placeholder="e.g. Vacation"
          maxLength={40}
          className="w-56 rounded-lg border border-slate-300 bg-white px-3 py-2 text-sm"
        />
        <Button onClick={addCategory} disabled={busy || !newName.trim()}>
          <Plus className="h-4 w-4" /> Add
        </Button>
      </div>
      {error ? <p className="text-sm text-rose-600">{error}</p> : null}

      <div className="overflow-hidden rounded-xl border border-slate-200">
        <div className="flex items-center justify-between border-b border-slate-100 bg-slate-50 px-4 py-2">
          <span className="text-xs font-medium uppercase tracking-wide text-slate-500">
            All categories
          </span>
          <span className="text-xs text-slate-500">
            {categories.length} total · {customCount} custom
          </span>
        </div>
        <ul className="max-h-72 divide-y divide-slate-100 overflow-auto">
          {categories.map((c) => (
            <li
              key={c.name}
              className="flex items-center gap-3 px-4 py-2 text-sm"
            >
              {editing === c.name ? (
                <>
                  <input
                    value={editValue}
                    onChange={(e) => setEditValue(e.target.value)}
                    onKeyDown={(e) => {
                      if (e.key === "Enter") saveRename(c.name);
                      if (e.key === "Escape") setEditing(null);
                    }}
                    autoFocus
                    maxLength={40}
                    className="w-56 rounded-md border border-slate-300 px-2 py-1 text-sm"
                  />
                  <button
                    onClick={() => saveRename(c.name)}
                    className="text-emerald-600 hover:text-emerald-700"
                    title="Save"
                  >
                    <Check className="h-4 w-4" />
                  </button>
                  <button
                    onClick={() => setEditing(null)}
                    className="text-slate-400 hover:text-slate-600"
                    title="Cancel"
                  >
                    <X className="h-4 w-4" />
                  </button>
                </>
              ) : (
                <>
                  <span className="font-medium text-slate-800">{c.name}</span>
                  {c.custom ? (
                    <Badge color="emerald">custom</Badge>
                  ) : (
                    <Badge color="slate">built-in</Badge>
                  )}
                  {c.custom ? (
                    <div className="ml-auto flex items-center gap-2">
                      <button
                        onClick={() => {
                          setEditing(c.name);
                          setEditValue(c.name);
                        }}
                        className="text-slate-400 hover:text-slate-700"
                        title="Rename"
                      >
                        <Pencil className="h-4 w-4" />
                      </button>
                      <button
                        onClick={() => remove(c.name)}
                        className="text-slate-400 hover:text-rose-600"
                        title="Delete"
                      >
                        <Trash2 className="h-4 w-4" />
                      </button>
                    </div>
                  ) : null}
                </>
              )}
            </li>
          ))}
        </ul>
        {loading ? (
          <p className="px-4 py-2 text-xs text-slate-400">Loading…</p>
        ) : null}
      </div>
    </Panel>
  );
}
