// Tarifpreise (netto, EUR) – monatlich und jährlich („2 Monate geschenkt“ = 10 Monatspreise)
export type BillingInterval = "month" | "year";
export const MONTHLY: Record<string, number> = { starter: 79, professional: 149, business: 399, enterprise: 799 };
export const YEAR_MONTHS = 10;
export const yearlyPrice = (plan: string) => (MONTHLY[plan] ?? 0) * YEAR_MONTHS;
/** Preis je Abrechnungszeitraum */
export const planPriceFor = (plan: string, interval: BillingInterval) => (interval === "year" ? yearlyPrice(plan) : MONTHLY[plan] ?? 0);
/** umgerechnet auf einen Monat (für Umsatz pro Monat) */
export const monthlyEquivalent = (plan: string, interval: BillingInterval) =>
  interval === "year" ? Math.round((yearlyPrice(plan) / 12) * 100) / 100 : MONTHLY[plan] ?? 0;
export const euro = (n: number) => n.toLocaleString("de-DE", { minimumFractionDigits: Number.isInteger(n) ? 0 : 2, maximumFractionDigits: 2 }) + " €";
