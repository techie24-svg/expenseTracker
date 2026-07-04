import { clsx, type ClassValue } from "clsx";
import { twMerge } from "tailwind-merge";

export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs));
}

export function formatCurrency(value: number | string, showSign = false) {
  const n = typeof value === "string" ? parseFloat(value) : value;
  const formatted = new Intl.NumberFormat("en-US", {
    style: "currency",
    currency: "USD",
  }).format(Math.abs(n));
  if (showSign) return `${n < 0 ? "-" : "+"}${formatted}`;
  return n < 0 ? `-${formatted}` : formatted;
}

export function formatDate(value: string | Date) {
  const d = typeof value === "string" ? new Date(value) : value;
  return new Intl.DateTimeFormat("en-US", {
    month: "short",
    day: "numeric",
    year: "numeric",
    timeZone: "UTC",
  }).format(d);
}
