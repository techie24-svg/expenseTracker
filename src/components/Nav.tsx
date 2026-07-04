"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { cn } from "@/lib/utils";
import {
  LayoutDashboard,
  Upload,
  ListChecks,
  GitMerge,
  CreditCard,
  Database,
} from "lucide-react";

const links = [
  { href: "/", label: "Dashboard", icon: LayoutDashboard },
  { href: "/import", label: "Import", icon: Upload },
  { href: "/transactions", label: "Transactions", icon: ListChecks },
  { href: "/review", label: "Review", icon: GitMerge },
  { href: "/cards", label: "Cards", icon: CreditCard },
  { href: "/setup", label: "Setup", icon: Database },
];

export function Nav() {
  const pathname = usePathname();
  return (
    <header className="sticky top-0 z-20 border-b border-slate-200 bg-white/80 backdrop-blur">
      <div className="mx-auto flex w-full max-w-6xl items-center gap-1 px-4 sm:px-6">
        <Link href="/" className="mr-4 flex items-center gap-2 py-4">
          <span className="flex h-8 w-8 items-center justify-center rounded-lg bg-emerald-600 text-sm font-bold text-white">
            $
          </span>
          <span className="text-base font-semibold tracking-tight">
            Spend Tracker
          </span>
        </Link>
        <nav className="flex items-center gap-0.5 overflow-x-auto">
          {links.map((link) => {
            const active =
              link.href === "/"
                ? pathname === "/"
                : pathname.startsWith(link.href);
            const Icon = link.icon;
            return (
              <Link
                key={link.href}
                href={link.href}
                className={cn(
                  "flex items-center gap-2 rounded-lg px-3 py-2 text-sm font-medium transition-colors",
                  active
                    ? "bg-emerald-50 text-emerald-700"
                    : "text-slate-600 hover:bg-slate-100 hover:text-slate-900",
                )}
              >
                <Icon className="h-4 w-4" />
                <span className="hidden sm:inline">{link.label}</span>
              </Link>
            );
          })}
        </nav>
      </div>
    </header>
  );
}
