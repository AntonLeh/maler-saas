// Belege & Ausgaben – Typen und feste Listen

export type ExpenseCategory = "material" | "werkzeug" | "fahrzeug" | "subunternehmer" | "miete" | "versicherung" | "buero" | "sonstiges";
export type PaymentMethod = "bar" | "karte" | "ueberweisung" | "lastschrift" | "paypal";

export type Expense = {
  id: number;
  tenant_id: number;
  receipt_date: string;
  supplier: string;
  description: string | null;
  category: ExpenseCategory;
  gross_amount: number;
  tax_rate: number | null;
  tax_amount: number;
  net_amount: number;
  paid: boolean;
  payment_method: PaymentMethod | null;
  order_id: number | null;
  file_path: string | null;
  file_name: string | null;
  file_type: string | null;
  ai_extracted: boolean;
  voided: boolean;
  void_reason: string | null;
  locked: boolean;
  notes: string | null;
  created_at: string;
  original_currency?: string | null;
  original_amount?: number | null;
  exchange_rate?: number | null;
};

export type ExpenseInput = {
  receipt_date: string;
  supplier: string;
  description: string | null;
  category: ExpenseCategory;
  gross_amount: number;
  tax_rate: number | null;
  tax_amount: number;
  paid: boolean;
  payment_method: PaymentMethod | null;
  order_id: number | null;
  notes: string | null;
  original_currency?: string | null;
  original_amount?: number | null;
  exchange_rate?: number | null;
};

/** Zusätzliche Angabe der KI (nicht in der Tabelle als Spalte gleichen Namens) */
export type AiResult = Partial<ExpenseInput> & { currency?: string };

export const CURRENCIES = ["EUR", "CHF", "USD", "GBP", "PLN", "CZK", "HUF", "DKK", "SEK", "NOK"];
export const homeCurrency = (country: Country) => (country === "CH" ? "CHF" : "EUR");

export type ExpensePeriod = { period_year: number; period_month: number; locked_at: string };
export type OrderOption = { id: number; title: string };

export const CATEGORY_LABELS: Record<ExpenseCategory, string> = {
  material: "Material",
  werkzeug: "Werkzeug & Geräte",
  fahrzeug: "Fahrzeug & Tanken",
  subunternehmer: "Subunternehmer",
  miete: "Miete",
  versicherung: "Versicherung",
  buero: "Büro & Telefon",
  sonstiges: "Sonstiges",
};

export const PAYMENT_LABELS: Record<PaymentMethod, string> = {
  bar: "Bar",
  karte: "Karte",
  ueberweisung: "Überweisung",
  lastschrift: "Lastschrift",
  paypal: "PayPal",
};

export type Country = "DE" | "AT" | "CH";

/** Steuersätze je Land (Vorsteuer auf Belegen) */
export const TAX_RATES: Record<Country, number[]> = {
  DE: [19, 7, 0],
  AT: [20, 13, 10, 0],
  CH: [8.1, 3.8, 2.6, 0],
};

export const COUNTRY_NAMES: Record<Country, string> = { DE: "Deutschland", AT: "Österreich", CH: "der Schweiz" };

/** Satz gehört nicht zum Firmenland (z. B. 21 % aus Spanien) -> keine inländische Vorsteuer */
export const isForeignRate = (rate: number | null, country: Country) =>
  rate !== null && !TAX_RATES[country].some((r) => Math.abs(r - Number(rate)) < 0.01);

export function countryCode(value: unknown): Country {
  const v = String(value ?? "").trim().toLowerCase();
  if (["at", "aut", "österreich", "oesterreich", "austria"].includes(v)) return "AT";
  if (["ch", "che", "schweiz", "switzerland", "suisse", "svizzera"].includes(v)) return "CH";
  return "DE";
}

/** Netto/Steuer so berechnen wie die Datenbank (für die Vorschau im Formular) */
export function splitAmount(gross: number, rate: number | null, mixedTax: number): { net: number; tax: number } {
  const g = Math.round((Number(gross) || 0) * 100) / 100;
  if (rate === null) {
    const tax = Math.round((Number(mixedTax) || 0) * 100) / 100;
    return { net: Math.round((g - tax) * 100) / 100, tax };
  }
  const net = Math.round((g / (1 + rate / 100)) * 100) / 100;
  return { net, tax: Math.round((g - net) * 100) / 100 };
}
