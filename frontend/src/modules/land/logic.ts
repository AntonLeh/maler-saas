// Land des Betriebs: Voreinstellungen und Prüfung, ob Währung/Steuersatz zum Land passen (ohne Datenbank, testbar)

export type Country = "Deutschland" | "Österreich" | "Schweiz";
export const COUNTRIES: Country[] = ["Deutschland", "Österreich", "Schweiz"];

export const COUNTRY_PRESET: Record<Country, { tax: number; currency: string; symbol: string }> = {
  Deutschland: { tax: 19, currency: "EUR", symbol: "€" },
  Österreich: { tax: 20, currency: "EUR", symbol: "€" },
  Schweiz: { tax: 8.1, currency: "CHF", symbol: "CHF" },
};

export function normalizeCountry(value: unknown): Country {
  const v = String(value ?? "").trim().toLowerCase();
  if (["at", "aut", "österreich", "oesterreich", "austria"].includes(v)) return "Österreich";
  if (["ch", "che", "schweiz", "switzerland", "suisse", "svizzera"].includes(v)) return "Schweiz";
  return "Deutschland";
}

export type CountrySettings = { country?: string | null; currency?: string | null; tax_rate_default?: number | string | null; small_business?: boolean | null };

/** Was passt nicht? Leere Liste = alles stimmig. Kleinunternehmer: Steuersatz wird nicht geprüft. */
export function countryMismatch(s: CountrySettings | null | undefined): string[] {
  if (!s) return [];
  const c = normalizeCountry(s.country);
  const p = COUNTRY_PRESET[c];
  const out: string[] = [];
  if ((s.currency ?? "").toUpperCase() !== p.currency) out.push(`Währung ${s.currency || "–"} statt ${p.currency}`);
  const tax = Number(s.tax_rate_default);
  if (!s.small_business && Math.abs(tax - p.tax) > 0.001) out.push(`Mehrwertsteuer ${Number.isFinite(tax) ? tax.toLocaleString("de-DE") : "–"} % statt ${p.tax.toLocaleString("de-DE")} %`);
  return out;
}
