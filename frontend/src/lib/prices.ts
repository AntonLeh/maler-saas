// Tarifpreise (netto, EUR) – monatlich und jährlich („2 Monate geschenkt“ = 10 Monatspreise)
// Ab 20.11.2026: Einführungsrabatt im ersten Jahresabo (40 % auf den Jahrespreis = halber Monatspreis),
// Zusatzmitarbeiter mit App-Zugang 19 € im Monat bzw. 190 € im Jahr.
export type BillingInterval = "month" | "year";
export const MONTHLY: Record<string, number> = { starter: 79, professional: 149, business: 220, enterprise: 349 };
/** Mitarbeiter mit App-Zugang, die im Tarif enthalten sind (Inhaber/Admin zählt nicht mit) */
export const BASE_USERS: Record<string, number> = { starter: 3, professional: 6, business: 9, enterprise: 12 };
export const SEAT_MONTHLY = 19;
export const YEAR_MONTHS = 10;
/** Anteil, der im ersten Jahresabo bezahlt wird (Stripe-Gutschein ERSTESJAHR: 40 % Rabatt) */
export const FIRST_YEAR_FACTOR = 0.6;

export const yearlyPrice = (plan: string) => (MONTHLY[plan] ?? 0) * YEAR_MONTHS;
/** Preis des ersten Jahresabos (mit Einführungsrabatt) */
export const firstYearPrice = (plan: string) => Math.round(yearlyPrice(plan) * FIRST_YEAR_FACTOR * 100) / 100;
/** erstes Jahr umgerechnet auf einen Monat (= halber Monatspreis) */
export const firstYearMonthly = (plan: string) => Math.round((firstYearPrice(plan) / 12) * 100) / 100;
export const seatPriceFor = (interval: BillingInterval) => (interval === "year" ? SEAT_MONTHLY * YEAR_MONTHS : SEAT_MONTHLY);

/** Preis je Abrechnungszeitraum */
export const planPriceFor = (plan: string, interval: BillingInterval) => (interval === "year" ? yearlyPrice(plan) : MONTHLY[plan] ?? 0);
/** umgerechnet auf einen Monat (für Umsatz pro Monat) */
export const monthlyEquivalent = (plan: string, interval: BillingInterval) =>
  interval === "year" ? Math.round((yearlyPrice(plan) / 12) * 100) / 100 : MONTHLY[plan] ?? 0;
export const euro = (n: number) => n.toLocaleString("de-DE", { minimumFractionDigits: Number.isInteger(n) ? 0 : 2, maximumFractionDigits: 2 }) + " €";
