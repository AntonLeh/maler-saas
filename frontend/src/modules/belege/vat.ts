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
  category?: string | null;
};

/** Schweiz: effektive Methode oder Saldosteuersatz; Kleinunternehmer: keine Voranmeldung */
export type VatOptions = { chMethod?: "effective" | "saldo"; saldoRate?: number | null; smallBusiness?: boolean };

export type FormRow = { kz: string; label: string; value: number; wholeEuro?: boolean; strong?: boolean };
export type VatForm = { title: string; codeLabel: string; rows: FormRow[]; note: string };

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
  /** amtliche Kennzahlen/Ziffern des Landes (DE: ELSTER, AT: U30, CH: MWST-Abrechnung) */
  form: VatForm | null;
  /** Schweiz mit Saldosteuersatz: Steuer = Umsatz inkl. MWST × Satz, ohne Vorsteuer */
  saldo: { rate: number; grossSales: number; tax: number } | null;
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
  country: Country,
  opts: VatOptions = {}
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
  let inputTaxMaterial = 0; // Schweiz Ziffer 400: Material- und Dienstleistungsaufwand
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
    if (e.category === "material" || e.category === "subunternehmer") inputTaxMaterial += Number(e.tax_amount) || 0;
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
    form: null,
    saldo: null,
  };
  const net = (rate: number) => salesList.filter((l) => Math.abs((l.rate ?? -1) - rate) < 0.01).reduce((a, l) => a + l.net, 0);
  const tax = (rate: number) => salesList.filter((l) => Math.abs((l.rate ?? -1) - rate) < 0.01).reduce((a, l) => a + l.tax, 0);
  const note = "Die Werte stammen nur aus den in MalerSaaS erfassten Rechnungen und Belegen – bitte vor der Abgabe prüfen bzw. vom Steuerberater/Treuhänder prüfen lassen. Keine Steuerberatung.";

  if (opts.smallBusiness) {
    result.form = {
      title: country === "CH" ? "MWST-Abrechnung" : "Umsatzsteuer-Voranmeldung",
      codeLabel: "",
      rows: [],
      note:
        country === "CH"
          ? "Ihr Betrieb ist in den Einstellungen als „nicht MWST-pflichtig“ eingetragen – es ist keine MWST-Abrechnung nötig."
          : country === "AT"
          ? "Ihr Betrieb ist in den Einstellungen als Kleinunternehmer eingetragen – eine Umsatzsteuer-Voranmeldung ist in der Regel nicht nötig (bei Umsätzen bis 55.000 € im Jahr)."
          : "Ihr Betrieb ist in den Einstellungen als Kleinunternehmer eingetragen – eine Umsatzsteuer-Voranmeldung ist in der Regel nicht nötig.",
    };
    return result;
  }

  if (country === "AT") {
    result.form = {
      title: "Für die Umsatzsteuer-Voranmeldung (U30, FinanzOnline)",
      codeLabel: "KZ",
      rows: [
        { kz: "000", label: "Gesamtbetrag der Bemessungsgrundlagen (Lieferungen und sonstige Leistungen)", value: r2(result.salesNet + result.reverseChargeNet) },
        { kz: "021", label: "davon Umsätze mit Übergang der Steuerschuld (Bauleistungen § 19 Abs. 1a)", value: result.reverseChargeNet },
        { kz: "022", label: "Bemessungsgrundlage zu 20 %", value: r2(net(20)) },
        { kz: "", label: "Umsatzsteuer darauf", value: r2(tax(20)) },
        { kz: "006", label: "Bemessungsgrundlage zu 13 %", value: r2(net(13)) },
        { kz: "", label: "Umsatzsteuer darauf", value: r2(tax(13)) },
        { kz: "029", label: "Bemessungsgrundlage zu 10 %", value: r2(net(10)) },
        { kz: "", label: "Umsatzsteuer darauf", value: r2(tax(10)) },
        { kz: "060", label: "Gesamtbetrag der Vorsteuern", value: inputTax },
        { kz: "095", label: "Vorauszahlung (positiv) bzw. Überschuss (negativ)", value: result.balance, strong: true },
      ],
      note: `Beträge in Euro mit Cent. ${note}`,
    };
  }

  if (country === "CH") {
    const salesNetAll = result.salesNet;
    const salesGross = r2(result.salesNet + result.salesTax);
    if (opts.chMethod === "saldo") {
      const rate = Number(opts.saldoRate) || 0;
      const sTax = r2((salesGross * rate) / 100);
      result.saldo = { rate, grossSales: salesGross, tax: sTax };
      result.balance = sTax;
      result.form = {
        title: `Für die MWST-Abrechnung (Saldosteuersatz ${rate.toLocaleString("de-DE")} %)`,
        codeLabel: "Ziffer",
        rows: [
          { kz: "200", label: "Total der Entgelte (inkl. MWST)", value: salesGross },
          { kz: "299", label: "Steuerbarer Gesamtumsatz (inkl. MWST)", value: salesGross },
          { kz: "322", label: `Umsatz zum Saldosteuersatz ${rate.toLocaleString("de-DE")} % (inkl. MWST)`, value: salesGross },
          { kz: "323", label: "Steuer darauf", value: sTax },
          { kz: "399", label: "Total geschuldete Steuer", value: sTax },
          { kz: "500", label: "Zu bezahlender Betrag", value: sTax, strong: true },
        ],
        note: `Beim Saldosteuersatz wird keine Vorsteuer abgezogen – die Belege dienen nur der Buchhaltung. Massgebend ist der von der ESTV bewilligte Satz. ${note}`,
      };
    } else {
      const t400 = r2(inputTaxMaterial);
      const t405 = r2(inputTax - inputTaxMaterial);
      result.form = {
        title: "Für die MWST-Abrechnung (effektive Methode)",
        codeLabel: "Ziffer",
        rows: [
          { kz: "200", label: "Total der Entgelte (exkl. MWST)", value: salesNetAll },
          { kz: "", label: "zum Vergleich inkl. MWST", value: salesGross },
          { kz: "299", label: "Steuerbarer Gesamtumsatz (exkl. MWST)", value: salesNetAll },
          { kz: "302", label: "Leistungen zum Normalsatz 8,1 %", value: r2(net(8.1)) },
          { kz: "", label: "Steuer darauf", value: r2(tax(8.1)) },
          { kz: "312", label: "Leistungen zum reduzierten Satz 2,6 %", value: r2(net(2.6)) },
          { kz: "", label: "Steuer darauf", value: r2(tax(2.6)) },
          { kz: "342", label: "Leistungen zum Beherbergungssatz 3,8 %", value: r2(net(3.8)) },
          { kz: "", label: "Steuer darauf", value: r2(tax(3.8)) },
          { kz: "399", label: "Total geschuldete Steuer", value: result.salesTax },
          { kz: "400", label: "Vorsteuer auf Material- und Dienstleistungsaufwand", value: t400 },
          { kz: "405", label: "Vorsteuer auf Investitionen und übrigem Betriebsaufwand", value: t405 },
          { kz: "", label: "Total Vorsteuer (Ziffern 400 bis 420)", value: inputTax },
          result.balance >= 0
            ? { kz: "500", label: "Zu bezahlender Betrag", value: result.balance, strong: true }
            : { kz: "510", label: "Guthaben der steuerpflichtigen Person", value: -result.balance, strong: true },
        ],
        note: `Ob das ESTV-Portal die Umsätze in Ziffer 200/299 mit oder ohne MWST erwartet, bitte mit dem Treuhänder klären – die Steuerbeträge sind davon nicht betroffen. Ziffer 400: Belege der Kategorien Material und Subunternehmer, Ziffer 405: alle übrigen. ${note}`,
      };
    }
  }

  if (country === "DE") {
    result.elster = [
      { kz: "81", label: "Umsätze zu 19 % (Bemessungsgrundlage)", value: net(19), wholeEuro: true },
      { kz: "", label: "Steuer darauf", value: tax(19) },
      { kz: "86", label: "Umsätze zu 7 % (Bemessungsgrundlage)", value: net(7), wholeEuro: true },
      { kz: "", label: "Steuer darauf", value: tax(7) },
      { kz: "60", label: "Umsätze, für die der Leistungsempfänger die Steuer schuldet (§ 13b)", value: result.reverseChargeNet, wholeEuro: true },
      { kz: "66", label: "Vorsteuerbeträge aus Rechnungen", value: inputTax },
      { kz: "83", label: "Verbleibende Umsatzsteuer-Vorauszahlung (negativ = Erstattung)", value: result.balance },
    ];
    result.form = {
      title: "Für die Umsatzsteuer-Voranmeldung (ELSTER)",
      codeLabel: "Kz",
      rows: result.elster.map((e) => ({ ...e, strong: e.kz === "83" })),
      note: `Bemessungsgrundlagen (Kz 81, 86, 60) werden in ELSTER in vollen Euro eingetragen. ${note}`,
    };
  }
  return result;
}

/** Zeitraum aus Auswahl: Monat „2026-11“, Quartal „2026-Q4“, Jahr „2026“ */
export function periodRange(kind: "month" | "quarter" | "half" | "year", value: string): { from: string; to: string; label: string } {
  const pad = (n: number) => String(n).padStart(2, "0");
  const lastDay = (y: number, m: number) => new Date(y, m, 0).getDate();
  if (kind === "year") {
    const y = Number(value);
    return { from: `${y}-01-01`, to: `${y}-12-31`, label: `Jahr ${y}` };
  }
  if (kind === "half") {
    const [ys, hs] = value.split("-H");
    const y = Number(ys);
    return hs === "2" ? { from: `${y}-07-01`, to: `${y}-12-31`, label: `2. Halbjahr ${y}` } : { from: `${y}-01-01`, to: `${y}-06-30`, label: `1. Halbjahr ${y}` };
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
