// Regeln für Tarifwechsel bei bestehendem Abo (monatlich / jährlich)
export type Interval = "month" | "year";
export const PLANS = ["starter", "professional", "business", "enterprise"] as const;
const rank = (p: string) => PLANS.indexOf(p as (typeof PLANS)[number]);

export const normInterval = (v: unknown): Interval => (v === "year" ? "year" : "month");

/** null = Wechsel erlaubt, sonst Fehlertext (für den Kunden verständlich) */
export function changeError(cur: { plan: string; interval: Interval }, next: { plan: string; interval: Interval }): string | null {
  if (cur.plan === next.plan && cur.interval === next.interval) return "Das ist bereits Ihr aktueller Tarif.";
  if (cur.interval === "year") {
    // im Jahresabo: nur größerer Tarif (weiterhin jährlich), sonst erst zum Laufzeitende
    if (next.interval === "month" || rank(next.plan) <= rank(cur.plan)) return "JAHRESABO_WECHSEL";
  }
  return null;
}

// ---------- Zusatzmitarbeiter und Einführungsrabatt (ab 20.11.2026) ----------
/** Stripe-Gutschein: 40 % auf das erste Jahresabo (11 Monate, damit auch anteilige Upgrades im 1. Jahr rabattiert sind) */
export const FIRST_YEAR_COUPON = "ERSTESJAHR";
export const SEAT_PRICES: Record<Interval, string> = {
  month: "price_1Udqx52QOB8iolrWn7FkS322",
  year: "price_1UdqzZ2QOB8iolrWYIWhMqvq",
};
export const isSeatPrice = (id: unknown) => id === SEAT_PRICES.month || id === SEAT_PRICES.year;
export const BASE_USERS: Record<string, number> = { starter: 3, professional: 6, business: 9, enterprise: 12 };
export const MAX_EXTRA_SEATS = 500;

type Item = { id: string; quantity?: number; price?: { id?: string; recurring?: { interval?: string } } };
/** Abo-Positionen aufteilen: Tarif und Zusatzplätze */
export function splitItems(items: Item[]): { plan: Item | null; seats: Item | null } {
  return {
    plan: items.find((i) => !isSeatPrice(i.price?.id)) ?? null,
    seats: items.find((i) => isSeatPrice(i.price?.id)) ?? null,
  };
}

/** Prüft die gewünschte Anzahl Zusatzplätze; null = in Ordnung, sonst Fehlercode */
export function seatsError(plan: string, wanted: number, usedWithAccess: number): string | null {
  if (!Number.isInteger(wanted) || wanted < 0 || wanted > MAX_EXTRA_SEATS) return "SEATS_UNGUELTIG";
  if (usedWithAccess > (BASE_USERS[plan] ?? 3) + wanted) return "SEATS_BELEGT";
  return null;
}
