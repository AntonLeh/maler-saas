// Gemeinsamer Zeitraum aller BI-Seiten (gekoppelt über den Browser-Speicher) und Geldformat
import { useState } from "react";
import { PERIODS } from "./logic";
import type { PeriodKey } from "./logic";

const STORE = "bi-zeitraum";

export function usePeriod(fallback: PeriodKey = "year") {
  const [period, setPeriod] = useState<PeriodKey>(() => {
    try {
      const v = localStorage.getItem(STORE) as PeriodKey | null;
      return v && PERIODS.some((p) => p.key === v) ? v : fallback;
    } catch {
      return fallback;
    }
  });
  const choose = (p: PeriodKey) => {
    setPeriod(p);
    try {
      localStorage.setItem(STORE, p);
    } catch {
      /* egal */
    }
  };
  return [period, choose] as const;
}

export function moneyFormatter(currency: string) {
  return (n: number, digits = 0) => {
    try {
      return n.toLocaleString("de-DE", { style: "currency", currency: currency || "EUR", minimumFractionDigits: digits, maximumFractionDigits: digits });
    } catch {
      return `${n.toLocaleString("de-DE", { minimumFractionDigits: digits, maximumFractionDigits: digits })} €`;
    }
  };
}
