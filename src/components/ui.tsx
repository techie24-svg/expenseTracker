import { cn } from "@/lib/utils";
import type { ReactNode } from "react";

export function Panel({
  className,
  children,
}: {
  className?: string;
  children: ReactNode;
}) {
  return (
    <div
      className={cn(
        "rounded-2xl border border-slate-200 bg-white p-5 shadow-sm",
        className,
      )}
    >
      {children}
    </div>
  );
}

export function StatCard({
  label,
  value,
  sub,
  accent = "slate",
}: {
  label: string;
  value: string;
  sub?: string;
  accent?: "slate" | "emerald" | "rose" | "amber" | "indigo";
}) {
  const accents: Record<string, string> = {
    slate: "text-slate-900",
    emerald: "text-emerald-600",
    rose: "text-rose-600",
    amber: "text-amber-600",
    indigo: "text-indigo-600",
  };
  return (
    <Panel className="flex flex-col gap-1">
      <span className="text-xs font-medium uppercase tracking-wide text-slate-500">
        {label}
      </span>
      <span className={cn("text-2xl font-semibold tabular-nums", accents[accent])}>
        {value}
      </span>
      {sub ? <span className="text-xs text-slate-500">{sub}</span> : null}
    </Panel>
  );
}

export function Button({
  children,
  variant = "primary",
  className,
  ...props
}: {
  variant?: "primary" | "secondary" | "ghost" | "danger";
} & React.ButtonHTMLAttributes<HTMLButtonElement>) {
  const variants = {
    primary:
      "bg-emerald-600 text-white hover:bg-emerald-700 disabled:bg-emerald-300",
    secondary:
      "bg-white text-slate-700 border border-slate-300 hover:bg-slate-50",
    ghost: "text-slate-600 hover:bg-slate-100",
    danger: "bg-rose-600 text-white hover:bg-rose-700",
  };
  return (
    <button
      className={cn(
        "inline-flex items-center justify-center gap-2 rounded-lg px-3.5 py-2 text-sm font-medium transition-colors disabled:cursor-not-allowed",
        variants[variant],
        className,
      )}
      {...props}
    >
      {children}
    </button>
  );
}

export function Badge({
  children,
  color = "slate",
}: {
  children: ReactNode;
  color?: "slate" | "emerald" | "rose" | "amber" | "indigo" | "sky";
}) {
  const colors: Record<string, string> = {
    slate: "bg-slate-100 text-slate-700",
    emerald: "bg-emerald-100 text-emerald-700",
    rose: "bg-rose-100 text-rose-700",
    amber: "bg-amber-100 text-amber-700",
    indigo: "bg-indigo-100 text-indigo-700",
    sky: "bg-sky-100 text-sky-700",
  };
  return (
    <span
      className={cn(
        "inline-flex items-center rounded-full px-2 py-0.5 text-xs font-medium",
        colors[color],
      )}
    >
      {children}
    </span>
  );
}
