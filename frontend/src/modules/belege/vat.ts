// Umsatzsteuer-Übersicht – reine Berechnung (ohne Datenbank), damit sie sich testen lässt.
//
// Regeln:
//  Soll-Versteuerung: Rechnungen zählen nach Rechnungsdatum.
//    Ausnahme Abschlagsrechnungen: zählen erst, wenn sie bezahlt sind (Anzahlungen, „Mindest-Ist-Versteuerung“).
//    Unbezahlte Abschläge gehen in der Schlussrechnung auf (Status „credited“) und zählen nie selbst.
//  Ist-Versteuerung: Rechnungen zählen, wenn sie bezahlt sind (Zahlungsdatum).
//  Stornorechnungen zählen (negativ) am Storno-Datum – aber nur, wenn die stornierte Rechnung selbst gezählt hat
//    bzw. zählen würde (Soll: alles außer unbezahlte Abschläge; Ist: nur bezahlte Rechnungen).
//  § 13b: Umsatz ohne Steuer, eigene Zeile (Kennzahl 60).
//  Vorsteuer: Belege nach Belegdatum, nicht ungültig, nur inländische Steuersätze (oder „gemischt“).

export type VatInvoice = {
  id: number;
  invoice_number: string;
  invoice_date: string;
  paid_at: string | null;
  status: string;
  document_type?: string | null;
  invoice_type?: string | null;
  subtotal: number;
  tax_rate: number;
  tax_amount: number;
  total_amount: number;
  reverse_charge?: boolean | null;
  cancels_invoice_id?: number | null;
};

export type VatExpense = {
  id: number;
  receipt_date: string;
  supplier: string;
  net_amount: number;
  tax_amount: number;
  gross_amount: number;
  tax_rate: number | null;
  voided: boolean;
};

export type TaxMethod = "soll" | "ist";
export type Country = "DE" | "AT" | "CH";

export type RateLine = { key: string; label: string; rate: number | null; net: number; tax: number; count: number };
export type VatResult = {
  sales: RateLine[];
  salesNet: number;
  salesTax: number;
  reverseChargeNet: number;
  inputs: RateLine[];
  inputNet: number;
  inputTax: number;
  foreignTax: number;
  balance: number; // > 0: an das Finanzamt, < 0: Erstattung
  invoiceIds: number[];
  expenseIds: number[];
  elster: { kz: string; label: string; value: number; wholeEuro?: boolean }[] | null;
};

const r2 = (n: number) => Math.round(n * 100) / 100;
const day = (iso: string | null | undefined) => (iso ? String(iso).slice(0, 10) : "");
const inRange = (d: string, from: string, to: string) => !!d && d >= from && d <= to;

const DOMESTIC: Record<Country, number[]> = { DE: [19, 7, 0], AT: [20, 13, 10, 0], CH: [8.1, 3.8, 2.6, 0] };
const isDomestic = (rate: number | null, c: Country) => rate === null || DOMESTIC[c].some((r) => Math.abs(r - rate) < 0.01);

/** Zählt die Rechnung (Original) in dieser Versteuerungsart überhaupt? Und an welchem Tag? */
function countDay(inv: VatInvoice, method: TaxMethod): string | null {
  if (inv.status === "credited") return null; // in Schlussrechnung aufgegangen
  const isPartial = inv.invoice_type === "partial";
  if (method === "ist" || isPartial) return inv.paid_at ? day(inv.paid_at) : null;
  return day(inv.invoice_date);
}

export function computeVat(
  invoices: VatInvoice[],
  expenses: VatExpense[],
  from: string,
  to: string,
  method: TaxMethod,
  country: Country
): VatResult {
  const byId = new Map(invoices.map((i) => [i.id, i]));
  const sales = new Map<string, RateLine>();
  const inputs = new Map<string, RateLine>();
  const invoiceIds: number[] = [];
  const expenseIds: number[] = [];
  let reverseChargeNet = 0;

  const addSale = (inv: VatInvoice, sign: number) => {
    const net = sign * Math.abs(Number(inv.subtotal) || 0);
    const tax = sign * Math.abs(Number(inv.tax_amount) || 0);
    if (inv.reverse_charge) {
      reverseChargeNet += net;
      return;
    }
    const rate = Number(inv.tax_rate) || 0;
    const key = String(rate);
    const line = sales.get(key) ?? { key, label: `${rate.toLocaleString("de-DE")} %`, rate, net: 0, tax: 0, count: 0 };
    line.net += net;
    line.tax += tax;
    line.count += 1;
    sales.set(key, line);
  };

  for (const inv of invoices) {
    if (inv.document_type === "cancellation") {
      const orig = inv.cancels_invoice_id ? byId.get(inv.cancels_invoice_id) : undefined;
      // ohne Original: wie eine normale Rechnung behandeln (sicherer, als sie zu verlieren)
      const origCounts = orig ? (method === "ist" || orig.invoice_type === "partial" ? !!orig.paid_at : true) : true;
      if (origCounts && inRange(day(inv.invoice_date), from, to)) {
        addSale(inv, -1);
        invoiceIds.push(inv.id);
      }
      continue;
    }
    // stornierte Originale zählen trotzdem (am eigenen Tag) – die Stornorechnung gleicht sie aus
    const original = inv.status === "cancelled" ? { ...inv, status: inv.paid_at ? "paid" : "open" } : inv;
    const d = countDay(original, method);
    if (d && inRange(d, from, to)) {
      addSale(inv, 1);
      invoiceIds.push(inv.id);
    }
  }

  let foreignTax = 0;
  for (const e of expenses) {
    if (e.voided || !inRange(day(e.receipt_date), from, to)) continue;
    expenseIds.push(e.id);
    const rate = e.tax_rate === null ? null : Number(e.tax_rate);
    if (!isDomestic(rate, country)) {
      foreignTax += Number(e.tax_amount) || 0;
      continue;
    }
    const key = rate === null ? "mixed" : String(rate);
    const line = inputs.get(key) ?? { key, label: rate === null ? "gemischt" : `${rate.toLocaleString("de-DE")} %`, rate, net: 0, tax: 0, count: 0 };
    line.net += Number(e.net_amount) || 0;
    line.tax += Number(e.tax_amount) || 0;
    line.count += 1;
    inputs.set(key, line);
  }

  const order = (a: RateLine, b: RateLine) => (b.rate ?? -1) - (a.rate ?? -1);
  const salesList = [...sales.values()].map((l) => ({ ...l, net: r2(l.net), tax: r2(l.tax) })).sort(order);
  const inputList = [...inputs.values()].map((l) => ({ ...l, net: r2(l.net), tax: r2(l.tax) })).sort(order);
  const salesTax = r2(salesList.reduce((a, l) => a + l.tax, 0));
  const inputTax = r2(inputList.reduce((a, l) => a + l.tax, 0));
  const result: VatResult = {
    sales: salesList,
    salesNet: r2(salesList.reduce((a, l) => a + l.net, 0)),
    salesTax,
    reverseChargeNet: r2(reverseChargeNet),
    inputs: inputList,
    inputNet: r2(inputList.reduce((a, l) => a + l.net, 0)),
    inputTax,
    foreignTax: r2(foreignTax),
    balance: r2(salesTax - inputTax),
    invoiceIds,
    expenseIds,
    elster: null,
  };

  if (country === "DE") {
    const net = (rate: number) => salesList.find((l) => l.rate === rate)?.net ?? 0;
    const tax = (rate: number) => salesList.find((l) => l.rate === rate)?.tax ?? 0;
    result.elster = [
      { kz: "81", label: "Umsätze zu 19 % (Bemessungsgrundlage)", value: net(19), wholeEuro: true },
      { kz: "", label: "Steuer darauf", value: tax(19) },
      { kz: "86", label: "Umsätze zu 7 % (Bemessungsgrundlage)", value: net(7), wholeEuro: true },
      { kz: "", label: "Steuer darauf", value: tax(7) },
      { kz: "60", label: "Umsätze, für die der Leistungsempfänger die Steuer schuldet (§ 13b)", value: result.reverseChargeNet, wholeEuro: true },
      { kz: "66", label: "Vorsteuerbeträge aus Rechnungen", value: inputTax },
      { kz: "83", label: "Verbleibende Umsatzsteuer-Vorauszahlung (negativ = Erstattung)", value: result.balance },
    ];
  }
  return result;
}

/** Zeitraum aus Auswahl: Monat „2026-11“, Quartal „2026-Q4“, Jahr „2026“ */
export function periodRange(kind: "month" | "quarter" | "year", value: string): { from: string; to: string; label: string } {
  const pad = (n: number) => String(n).padStart(2, "0");
  const lastDay = (y: number, m: number) => new Date(y, m, 0).getDate();
  if (kind === "year") {
    const y = Number(value);
    return { from: `${y}-01-01`, to: `${y}-12-31`, label: `Jahr ${y}` };
  }
  if (kind === "quarter") {
    const [ys, qs] = value.split("-Q");
    const y = Number(ys);
    const q = Number(qs);
    const m1 = (q - 1) * 3 + 1;
    return { from: `${y}-${pad(m1)}-01`, to: `${y}-${pad(m1 + 2)}-${pad(lastDay(y, m1 + 2))}`, label: `${q}. Quartal ${y}` };
  }
  const [y, m] = value.split("-").map(Number);
  return {
    from: `${y}-${pad(m)}-01`,
    to: `${y}-${pad(m)}-${pad(lastDay(y, m))}`,
    label: new Date(y, m - 1, 1).toLocaleDateString("de-DE", { month: "long", year: "numeric" }),
  };
}
