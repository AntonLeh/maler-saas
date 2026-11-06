// DATEV-Format (EXTF, Buchungsstapel, Version 700 / Formatversion 13) – reine Erzeugung ohne Datenbank.
// Spaltenaufbau nach dem öffentlichen DATEV-Format (Kopfzeile + 125 Spalten), Kodierung Windows-1252, Trennzeichen „;“.
//
// Buchungslogik (Standard, vom Steuerberater anpassbar über die Kontenzuordnung):
//  Ausgangsrechnung:   Umsatz brutto, „S“, Konto = Debitor (Sammeldebitor), Gegenkonto = Erlöskonto (Automatikkonto je Steuersatz)
//  Stornorechnung:     wie die Rechnung, aber „H“
//  Abschlag, der in der Schlussrechnung aufgegangen ist („credited“): Umkehrbuchung („H“) am Datum der Schlussrechnung
//  Eingangsbeleg:      Umsatz brutto, „H“, Konto = Kreditor (bzw. Kasse bei Barzahlung), Gegenkonto = Aufwandskonto, BU-Schlüssel 9 (19 % VSt) / 8 (7 % VSt)

export type Skr = "SKR03" | "SKR04";

export type DatevAccounts = {
  debitor: string;
  kreditor: string;
  kasse: string;
  erloese19: string;
  erloese7: string;
  erloese0: string;
  erloese13b: string;
  material: string;
  werkzeug: string;
  fahrzeug: string;
  subunternehmer: string;
  miete: string;
  versicherung: string;
  buero: string;
  sonstiges: string;
};

export type DatevSettings = {
  berater: string;
  mandant: string;
  skr: Skr;
  wjStartMonth: number; // 1 = Januar
  accounts: DatevAccounts;
};

/** Übliche Standardkonten – müssen mit dem Steuerberater abgestimmt werden */
export const DEFAULT_ACCOUNTS: Record<Skr, DatevAccounts> = {
  SKR03: {
    debitor: "10000",
    kreditor: "70000",
    kasse: "1000",
    erloese19: "8400",
    erloese7: "8300",
    erloese0: "8200",
    erloese13b: "8337",
    material: "3200",
    werkzeug: "4985",
    fahrzeug: "4530",
    subunternehmer: "3100",
    miete: "4210",
    versicherung: "4360",
    buero: "4930",
    sonstiges: "4900",
  },
  SKR04: {
    debitor: "10000",
    kreditor: "70000",
    kasse: "1600",
    erloese19: "4400",
    erloese7: "4300",
    erloese0: "4200",
    erloese13b: "4337",
    material: "5200",
    werkzeug: "6845",
    fahrzeug: "6530",
    subunternehmer: "5900",
    miete: "6310",
    versicherung: "6400",
    buero: "6815",
    sonstiges: "6300",
  },
};

export const ACCOUNT_LABELS: Record<keyof DatevAccounts, string> = {
  debitor: "Debitor (Sammelkonto Kunden)",
  kreditor: "Kreditor (Sammelkonto Lieferanten)",
  kasse: "Kasse (Barzahlungen)",
  erloese19: "Erlöse 19 % USt",
  erloese7: "Erlöse 7 % USt",
  erloese0: "Erlöse ohne USt (0 %)",
  erloese13b: "Erlöse § 13b (Steuer schuldet Kunde)",
  material: "Aufwand: Material",
  werkzeug: "Aufwand: Werkzeug & Geräte",
  fahrzeug: "Aufwand: Fahrzeug & Tanken",
  subunternehmer: "Aufwand: Subunternehmer / Fremdleistungen",
  miete: "Aufwand: Miete",
  versicherung: "Aufwand: Versicherung",
  buero: "Aufwand: Büro & Telefon",
  sonstiges: "Aufwand: Sonstiges",
};

export const defaultSettings = (): DatevSettings => ({ berater: "", mandant: "", skr: "SKR03", wjStartMonth: 1, accounts: { ...DEFAULT_ACCOUNTS.SKR03 } });

/** Die 125 Spaltenüberschriften des Buchungsstapels (DATEV-Format 700, Formatversion 13) */
export const COLUMNS: string[] = (() => {
  const a = [
    "Umsatz (ohne Soll/Haben-Kz)", "Soll/Haben-Kennzeichen", "WKZ Umsatz", "Kurs", "Basisumsatz", "WKZ Basisumsatz", "Konto",
    "Gegenkonto (ohne BU-Schlüssel)", "BU-Schlüssel", "Belegdatum", "Belegfeld 1", "Belegfeld 2", "Skonto", "Buchungstext",
    "Postensperre", "Diverse Adressnummer", "Geschäftspartnerbank", "Sachverhalt", "Zinssperre", "Beleglink",
  ];
  for (let i = 1; i <= 8; i++) a.push(`Beleginfo – Art ${i}`, `Beleginfo – Inhalt ${i}`);
  a.push(
    "KOST1 – Kostenstelle", "KOST2 – Kostenstelle", "Kost Menge", "EU-Land u. USt-IdNr.", "EU-Steuersatz", "Abw. Versteuerungsart",
    "Sachverhalt L+L", "Funktionsergänzung L+L", "BU 49 Hauptfunktionstyp", "BU 49 Hauptfunktionsnummer", "BU 49 Funktionsergänzung"
  );
  for (let i = 1; i <= 20; i++) a.push(`Zusatzinformation – Art ${i}`, `Zusatzinformation – Inhalt ${i}`);
  a.push(
    "Stück", "Gewicht", "Zahlweise", "Forderungsart", "Veranlagungsjahr", "Zugeordnete Fälligkeit", "Skontotyp", "Auftragsnummer",
    "Buchungstyp", "USt-Schlüssel (Anzahlungen)", "EU-Mitgliedstaat (Anzahlungen)", "Sachverhalt L+L (Anzahlungen)",
    "EU-Steuersatz (Anzahlungen)", "Erlöskonto (Anzahlungen)", "Herkunft-Kz", "Leerfeld", "KOST-Datum", "SEPA-Mandatsreferenz",
    "Skontosperre", "Gesellschaftername", "Beteiligtennummer", "Identifikationsnummer", "Zeichnernummer", "Postensperre bis",
    "Bezeichnung", "Kennzeichen", "Festschreibung", "Leistungsdatum", "Datum Zuord.",
    "Fälligkeit", "Generalumkehr", "Steuersatz", "Land", "Abrechnungsreferent", "BVV-Position",
    "EU-Mitgliedstaat u. UStID (Ursprung)", "EU-Steuersatz (Ursprung)", "Abw. Skontokonto"
  );
  return a;
})();
const COL = (name: string) => COLUMNS.indexOf(name);

export type DatevInvoice = {
  id: number;
  invoice_number: string;
  invoice_date: string;
  status: string;
  document_type?: string | null;
  invoice_type?: string | null;
  order_id?: number | null;
  total_amount: number;
  tax_rate: number;
  reverse_charge?: boolean | null;
  cancels_invoice_id?: number | null;
  service_period_end?: string | null;
  customer_name?: string;
};

export type DatevExpense = {
  id: number;
  receipt_date: string;
  supplier: string;
  description: string | null;
  category: string;
  gross_amount: number;
  tax_rate: number | null;
  payment_method: string | null;
  voided: boolean;
};

export type DatevRow = {
  amount: number;
  sh: "S" | "H";
  konto: string;
  gegenkonto: string;
  bu: string;
  date: string; // ISO
  beleg: string;
  text: string;
  leistungsdatum?: string | null;
};

const r2 = (n: number) => Math.round(n * 100) / 100;
const day = (iso: string | null | undefined) => String(iso ?? "").slice(0, 10);
const inRange = (d: string, from: string, to: string) => !!d && d >= from && d <= to;
/** Belegfeld 1: nur A–Z, 0–9 und $ & % * + - / – höchstens 36 Zeichen */
export const belegfeld = (v: string) => String(v ?? "").replace(/[^a-zA-Z0-9$&%*+\-/]/g, "").slice(0, 36);

function revenueAccount(inv: DatevInvoice, a: DatevAccounts) {
  if (inv.reverse_charge) return a.erloese13b;
  const r = Number(inv.tax_rate) || 0;
  if (Math.abs(r - 19) < 0.01) return a.erloese19;
  if (Math.abs(r - 7) < 0.01) return a.erloese7;
  return a.erloese0;
}

/** Buchungszeilen für einen Zeitraum (nach Rechnungs- bzw. Belegdatum) */
export function buildRows(invoices: DatevInvoice[], expenses: DatevExpense[], from: string, to: string, s: DatevSettings): DatevRow[] {
  const a = s.accounts;
  const rows: DatevRow[] = [];
  const byId = new Map(invoices.map((i) => [i.id, i]));
  // Schlussrechnung je Auftrag (für verrechnete Abschläge)
  const finals = new Map<number, DatevInvoice>();
  for (const i of invoices) {
    if (i.invoice_type === "final" && i.document_type !== "cancellation" && i.order_id && i.status !== "cancelled") finals.set(Number(i.order_id), i);
  }

  for (const inv of [...invoices].sort((x, y) => day(x.invoice_date).localeCompare(day(y.invoice_date)) || x.id - y.id)) {
    const amount = r2(Math.abs(Number(inv.total_amount) || 0));
    if (amount === 0) continue;
    const name = (inv.customer_name || "").trim();
    if (inv.document_type === "cancellation") {
      if (!inRange(day(inv.invoice_date), from, to)) continue;
      const orig = inv.cancels_invoice_id ? byId.get(inv.cancels_invoice_id) : undefined;
      rows.push({
        amount,
        sh: "H",
        konto: a.debitor,
        gegenkonto: revenueAccount(orig ?? inv, a),
        bu: "",
        date: day(inv.invoice_date),
        beleg: belegfeld(inv.invoice_number),
        text: `Storno ${orig?.invoice_number ?? ""} ${name}`.replace(/\s+/g, " ").trim(),
      });
      continue;
    }
    if (inRange(day(inv.invoice_date), from, to)) {
      rows.push({
        amount,
        sh: "S",
        konto: a.debitor,
        gegenkonto: revenueAccount(inv, a),
        bu: "",
        date: day(inv.invoice_date),
        beleg: belegfeld(inv.invoice_number),
        text: `${inv.invoice_type === "partial" ? "Abschlag " : ""}${name || inv.invoice_number}`,
        leistungsdatum: inv.service_period_end ?? null,
      });
    }
    // in der Schlussrechnung aufgegangener (unbezahlter) Abschlag -> am Datum der Schlussrechnung umkehren
    if (inv.invoice_type === "partial" && inv.status === "credited" && inv.order_id) {
      const fin = finals.get(Number(inv.order_id));
      if (fin && inRange(day(fin.invoice_date), from, to)) {
        rows.push({
          amount,
          sh: "H",
          konto: a.debitor,
          gegenkonto: revenueAccount(inv, a),
          bu: "",
          date: day(fin.invoice_date),
          beleg: belegfeld(inv.invoice_number),
          text: `Abschlag verrechnet in ${fin.invoice_number}`,
        });
      }
    }
  }

  const catAccount = (c: string) => (a as Record<string, string>)[c] ?? a.sonstiges;
  for (const e of [...expenses].sort((x, y) => day(x.receipt_date).localeCompare(day(y.receipt_date)) || x.id - y.id)) {
    if (e.voided || !inRange(day(e.receipt_date), from, to)) continue;
    const amount = r2(Number(e.gross_amount) || 0);
    if (amount <= 0) continue;
    const rate = e.tax_rate === null ? null : Number(e.tax_rate);
    const bu = rate !== null && Math.abs(rate - 19) < 0.01 ? "9" : rate !== null && Math.abs(rate - 7) < 0.01 ? "8" : "";
    const note = rate === null ? " (USt gemischt – aufteilen)" : rate !== 0 && !bu ? ` (ausl. USt ${rate.toLocaleString("de-DE")} %)` : "";
    rows.push({
      amount,
      sh: "H",
      konto: e.payment_method === "bar" ? a.kasse : a.kreditor,
      gegenkonto: catAccount(e.category),
      bu,
      date: day(e.receipt_date),
      beleg: belegfeld(`B${e.id}`),
      text: `${e.supplier}${e.description ? ` ${e.description}` : ""}`.slice(0, 60 - note.length) + note,
    });
  }
  return rows;
}

// ---------- CSV ----------
const q = (v: string) => `"${String(v).replace(/"/g, '""')}"`;
const money = (n: number) => r2(n).toFixed(2).replace(".", ",");
const ddmm = (iso: string) => `${iso.slice(8, 10)}${iso.slice(5, 7)}`;
const ddmmyyyy = (iso: string) => `${iso.slice(8, 10)}${iso.slice(5, 7)}${iso.slice(0, 4)}`;
const ymd = (iso: string) => iso.replace(/-/g, "").slice(0, 8);

export function wjStart(from: string, startMonth: number): string {
  const y = Number(from.slice(0, 4));
  const m = Number(from.slice(5, 7));
  const year = m >= startMonth ? y : y - 1;
  return `${year}-${String(startMonth).padStart(2, "0")}-01`;
}

/** Prüft, ob der Zeitraum in einem Wirtschaftsjahr liegt (DATEV-Vorgabe) */
export function sameFiscalYear(from: string, to: string, startMonth: number) {
  return wjStart(from, startMonth) === wjStart(to, startMonth);
}

export function buildCsv(rows: DatevRow[], from: string, to: string, s: DatevSettings, createdAt = new Date()): string {
  const p = (n: number) => String(n).padStart(2, "0");
  const stamp = `${createdAt.getFullYear()}${p(createdAt.getMonth() + 1)}${p(createdAt.getDate())}${p(createdAt.getHours())}${p(createdAt.getMinutes())}${p(
    createdAt.getSeconds()
  )}${String(createdAt.getMilliseconds()).padStart(3, "0")}`;
  const header = [
    q("EXTF"), "700", "21", q("Buchungsstapel"), "13", stamp, "", q("RE"), q("MalerSaaS"), "",
    String(Number(s.berater) || ""), String(Number(s.mandant) || ""), ymd(wjStart(from, s.wjStartMonth)), "4", ymd(from), ymd(to),
    q(`MalerSaaS ${from.slice(0, 7)}`), "", "1", "0", "0", q("EUR"), "", "", "", "", "", "", "", "", "",
  ];
  const lines = [header.join(";"), COLUMNS.join(";")];
  for (const r of rows) {
    const f = new Array(COLUMNS.length).fill("");
    f[COL("Umsatz (ohne Soll/Haben-Kz)")] = money(r.amount);
    f[COL("Soll/Haben-Kennzeichen")] = q(r.sh);
    f[COL("Konto")] = r.konto;
    f[COL("Gegenkonto (ohne BU-Schlüssel)")] = r.gegenkonto;
    f[COL("BU-Schlüssel")] = r.bu ? q(r.bu) : "";
    f[COL("Belegdatum")] = ddmm(r.date);
    f[COL("Belegfeld 1")] = r.beleg ? q(r.beleg) : "";
    f[COL("Buchungstext")] = q(r.text.replace(/[\r\n;]+/g, " ").slice(0, 60));
    if (r.leistungsdatum) f[COL("Leistungsdatum")] = ddmmyyyy(day(r.leistungsdatum));
    lines.push(f.join(";"));
  }
  return lines.join("\r\n") + "\r\n";
}

// ---------- Windows-1252 ----------
const CP1252: Record<number, number> = {
  0x20ac: 0x80, 0x201a: 0x82, 0x0192: 0x83, 0x201e: 0x84, 0x2026: 0x85, 0x2020: 0x86, 0x2021: 0x87, 0x02c6: 0x88, 0x2030: 0x89,
  0x0160: 0x8a, 0x2039: 0x8b, 0x0152: 0x8c, 0x017d: 0x8e, 0x2018: 0x91, 0x2019: 0x92, 0x201c: 0x93, 0x201d: 0x94, 0x2022: 0x95,
  0x2013: 0x96, 0x2014: 0x97, 0x02dc: 0x98, 0x2122: 0x99, 0x0161: 0x9a, 0x203a: 0x9b, 0x0153: 0x9c, 0x017e: 0x9e, 0x0178: 0x9f,
};
export function encodeCp1252(text: string): Uint8Array {
  const out: number[] = [];
  for (const ch of text) {
    const c = ch.codePointAt(0)!;
    if (c < 0x80 || (c >= 0xa0 && c <= 0xff)) out.push(c);
    else out.push(CP1252[c] ?? 0x3f);
  }
  return new Uint8Array(out);
}
