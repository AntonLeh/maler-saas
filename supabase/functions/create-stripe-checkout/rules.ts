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
