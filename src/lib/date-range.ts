import { createContext, useContext } from "react";
import { addDays, startOfDay, startOfMonth, startOfWeek } from "date-fns";

export type Preset = "today" | "yesterday" | "week" | "month" | "custom";
export const PRESETS: { value: Preset; label: string }[] = [
  { value: "today", label: "Today" }, { value: "yesterday", label: "Yesterday" },
  { value: "week", label: "This Week" }, { value: "month", label: "This Month" }, { value: "custom", label: "Custom" },
];

/** Half-open [from, to) range for a preset. */
export function rangeFor(p: Preset, now: Date, custom?: { from: Date; to: Date }) {
  const today = startOfDay(now);
  switch (p) {
    case "yesterday": return { from: addDays(today, -1), to: today };
    case "week": return { from: startOfWeek(today, { weekStartsOn: 1 }), to: addDays(today, 1) };
    case "month": return { from: startOfMonth(today), to: addDays(today, 1) };
    case "custom": return custom ? { from: startOfDay(custom.from), to: addDays(startOfDay(custom.to), 1) } : { from: today, to: addDays(today, 1) };
    default: return { from: today, to: addDays(today, 1) };
  }
}

export const ymd = (d: Date) => `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;

export type DateRangeCtx = { preset: Preset; setPreset: (p: Preset) => void; from: Date; to: Date; setCustom: (c: { from: Date; to: Date }) => void };
export const DateRangeContext = createContext<DateRangeCtx | null>(null);
export function useDateRange() {
  const c = useContext(DateRangeContext);
  if (!c) throw new Error("useDateRange outside owner layout");
  return c;
}
