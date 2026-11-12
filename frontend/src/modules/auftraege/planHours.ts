// Geplante Stunden: Vorschlag aus dem Angebot, Soll-Ist-Anzeige
export type QuoteItemLite = { title: string; quantity: number; unit: string; unit_price: number; line_total: number; item_type?: string | null };

const HOUR_UNITS = /^(std\.?|stunde[n]?|h)$/i;
const MATERIAL_UNITS = /^(kg|l|liter|eimer|dose[n]?)$/i;

/**
 * Vorschlag: „Std.“-Positionen zählen direkt, Material-Einheiten (kg, l) gar nicht,
 * alle anderen Positionen: Betrag × Lohnanteil ÷ Kunden-Stundensatz.
 */
export function suggestHours(items: QuoteItemLite[], customerRate: number, laborPct: number) {
  let direct = 0;
  let fromAmount = 0;
  let amount = 0;
  for (const it of items) {
    const unit = String(it.unit ?? "").trim();
    const total = Number(it.line_total ?? Number(it.quantity) * Number(it.unit_price)) || 0;
    if (HOUR_UNITS.test(unit)) direct += Number(it.quantity) || 0;
    else if (MATERIAL_UNITS.test(unit)) continue;
    else amount += total;
  }
  if (customerRate > 0) fromAmount = (amount * (laborPct / 100)) / customerRate;
  const hours = Math.round((direct + fromAmount) * 2) / 2; // auf halbe Stunden
  return { hours, direct, fromAmount, amount };
}

export type HoursState = "ok" | "warn" | "over";
export function hoursState(planned: number | null | undefined, actual: number): HoursState | null {
  if (!planned || planned <= 0) return null;
  const r = actual / planned;
  return r > 1 ? "over" : r >= 0.9 ? "warn" : "ok";
}

export const fmtHours = (h: number) => h.toLocaleString("de-DE", { maximumFractionDigits: 1 });
