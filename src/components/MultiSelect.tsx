"use client";

import { useEffect, useRef, useState } from "react";
import { ChevronDown, Check } from "lucide-react";

/**
 * Compact multi-select dropdown with checkboxes. Empty selection means "all".
 */
export function MultiSelect({
  label,
  options,
  selected,
  onChange,
}: {
  label: string;
  options: string[];
  selected: string[];
  onChange: (next: string[]) => void;
}) {
  const [open, setOpen] = useState(false);
  const ref = useRef<HTMLDivElement>(null);

  useEffect(() => {
    function onDocClick(e: MouseEvent) {
      if (ref.current && !ref.current.contains(e.target as Node)) {
        setOpen(false);
      }
    }
    document.addEventListener("mousedown", onDocClick);
    return () => document.removeEventListener("mousedown", onDocClick);
  }, []);

  function toggle(opt: string) {
    onChange(
      selected.includes(opt)
        ? selected.filter((s) => s !== opt)
        : [...selected, opt],
    );
  }

  const summary =
    selected.length === 0
      ? `All ${label.toLowerCase()}`
      : selected.length === 1
        ? selected[0]
        : `${selected.length} ${label.toLowerCase()}`;

  return (
    <div ref={ref} className="relative">
      <button
        type="button"
        onClick={() => setOpen((v) => !v)}
        className="flex items-center gap-2 rounded-lg border border-slate-300 bg-white px-3 py-2 text-sm text-slate-700 hover:bg-slate-50"
      >
        <span className="max-w-[10rem] truncate">{summary}</span>
        <ChevronDown className="h-4 w-4 shrink-0 text-slate-400" />
      </button>
      {open ? (
        <div className="absolute z-20 mt-1 max-h-72 w-56 overflow-auto rounded-lg border border-slate-200 bg-white p-1 shadow-lg">
          <div className="flex items-center justify-between px-2 py-1">
            <span className="text-xs font-medium uppercase tracking-wide text-slate-400">
              {label}
            </span>
            {selected.length > 0 ? (
              <button
                type="button"
                onClick={() => onChange([])}
                className="text-xs text-emerald-600 hover:text-emerald-700"
              >
                Clear
              </button>
            ) : null}
          </div>
          {options.length === 0 ? (
            <p className="px-2 py-2 text-xs text-slate-400">No options</p>
          ) : (
            options.map((opt) => {
              const checked = selected.includes(opt);
              return (
                <button
                  key={opt}
                  type="button"
                  onClick={() => toggle(opt)}
                  className="flex w-full items-center gap-2 rounded-md px-2 py-1.5 text-left text-sm hover:bg-slate-50"
                >
                  <span
                    className={`flex h-4 w-4 shrink-0 items-center justify-center rounded border ${
                      checked
                        ? "border-emerald-600 bg-emerald-600 text-white"
                        : "border-slate-300"
                    }`}
                  >
                    {checked ? <Check className="h-3 w-3" /> : null}
                  </span>
                  <span className="truncate text-slate-700">{opt}</span>
                </button>
              );
            })
          )}
        </div>
      ) : null}
    </div>
  );
}
