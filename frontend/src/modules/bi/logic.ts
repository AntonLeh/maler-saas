// Business Intelligence: Rechenregeln (ohne React, damit testbar)

export type InvoiceRow = {
  id?: number;
  customer_id?: number | null;
  order_id?: number | null;
  invoice_date?: string | null;
  created_at?: string | null;
  subtotal?: number | string | null;
  tax_rate?: number | string | null;
  tax_amount?: number | string | null;
  total_amount?: number | string | null;
  status?: string | null;
  document_type?: string | null;
};

const num = (v: unknown) => {
  const n = Number(v);
  return Number.isFinite(n) ? n : 0;
};

/** Offene (noch nicht bezahlte) Rechnungen – inkl. gemahnter; alte Statusnamen werden mitgezählt */
export const OPEN_STATUSES = ["open", "offen", "unpaid", "reminder1", "reminder2", "final_notice"];
export const DUNNED_STATUSES = ["reminder1", "reminder2", "final_notice"];

const isRealInvoice = (i: InvoiceRow) => (i.document_type ?? "invoice") === "invoice";

/** Zählt zum Umsatz: echte Rechnung (kein Storno-Beleg), nicht storniert, nicht in der Schlussrechnung verrechnet */
export function countsAsRevenue(i: InvoiceRow) {
  return isRealInvoice(i) && !["cancelled", "storniert", "credited", "draft", "entwurf"].includes(String(i.status ?? ""));
}

export function isOpenInvoice(i: InvoiceRow) {
  return isRealInvoice(i) && OPEN_STATUSES.includes(String(i.status ?? ""));
}

/** Nettobetrag einer Rechnung (ohne Mehrwertsteuer) */
export function netAmount(i: InvoiceRow) {
  if (i.subtotal != null && i.subtotal !== "") return num(i.subtotal);
  const total = num(i.total_amount);
  if (i.tax_amount != null && i.tax_amount !== "") return total - num(i.tax_amount);
  const rate = num(i.tax_rate);
  return rate > 0 ? Math.round((total / (1 + rate / 100)) * 100) / 100 : total;
}

/** Offener Betrag, den der Kunde zahlen muss (brutto) */
export const grossAmount = (i: InvoiceRow) => num(i.total_amount);

export const invoiceDay = (i: InvoiceRow) => String(i.invoice_date || i.created_at || "").slice(0, 10);

// ---------- Zeiträume ----------
export type PeriodKey = "month" | "lastMonth" | "year" | "lastYear" | "all";
export const PERIODS: { key: PeriodKey; label: string }[] = [
  { key: "month", label: "Dieser Monat" },
  { key: "lastMonth", label: "Letzter Monat" },
  { key: "year", label: "Dieses Jahr" },
  { key: "lastYear", label: "Letztes Jahr" },
  { key: "all", label: "Gesamt" },
];

export type Range = { from: string; to: string }; // beide inklusive, YYYY-MM-DD

const iso = (d: Date) => `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
const lastDayOfMonth = (y: number, m: number) => new Date(y, m + 1, 0).getDate();

/** Zeitraum und Vergleichszeitraum (gleich lang: laufender Monat/Jahr bis zum gleichen Tag) */
export function periodRanges(key: PeriodKey, today = new Date()): { cur: Range | null; prev: Range | null; prevLabel: string } {
  const y = today.getFullYear();
  const m = today.getMonth();
  const d = today.getDate();
  switch (key) {
    case "month": {
      const pm = m === 0 ? 11 : m - 1;
      const py = m === 0 ? y - 1 : y;
      const pd = Math.min(d, lastDayOfMonth(py, pm));
      return { cur: { from: iso(new Date(y, m, 1)), to: iso(today) }, prev: { from: iso(new Date(py, pm, 1)), to: iso(new Date(py, pm, pd)) }, prevLabel: "Vormonat bis zum gleichen Tag" };
    }
    case "lastMonth": {
      const a = new Date(y, m - 1, 1);
      const b = new Date(y, m - 2, 1);
      return {
        cur: { from: iso(a), to: iso(new Date(a.getFullYear(), a.getMonth(), lastDayOfMonth(a.getFullYear(), a.getMonth()))) },
        prev: { from: iso(b), to: iso(new Date(b.getFullYear(), b.getMonth(), lastDayOfMonth(b.getFullYear(), b.getMonth()))) },
        prevLabel: "Monat davor",
      };
    }
    case "year": {
      const pd = Math.min(d, lastDayOfMonth(y - 1, m));
      return { cur: { from: `${y}-01-01`, to: iso(today) }, prev: { from: `${y - 1}-01-01`, to: iso(new Date(y - 1, m, pd)) }, prevLabel: "Vorjahr bis zum gleichen Tag" };
    }
    case "lastYear":
      return { cur: { from: `${y - 1}-01-01`, to: `${y - 1}-12-31` }, prev: { from: `${y - 2}-01-01`, to: `${y - 2}-12-31` }, prevLabel: "Jahr davor" };
    default:
      return { cur: null, prev: null, prevLabel: "" };
  }
}

export const inRange = (day: string, r: Range | null) => !r || (!!day && day >= r.from && day <= r.to);

// ---------- Kennzahlen ----------
export type TimeRow = { work_date?: string | null; labor_cost?: number | string | null };
export type ExternalRow = { invoice_date?: string | null; created_at?: string | null; amount_net?: number | string | null };
export type MaterialLog = { action?: string | null; quantity?: number | string | null; created_at?: string | null; material_price_at_use?: number | string | null; material_id?: number | null };

/** Diese Buchungen sind verbrauchtes Material (Kosten) */
export const MATERIAL_COST_ACTIONS = ["used", "left_on_site", "damaged"];

export type Figures = { revenue: number; labor: number; material: number; external: number; margin: number; marginPct: number | null; invoices: number };

export function figures(
  data: { invoices: InvoiceRow[]; time: TimeRow[]; external: ExternalRow[]; material: MaterialLog[]; prices: Map<number, number> },
  r: Range | null,
): Figures {
  const inv = data.invoices.filter((i) => countsAsRevenue(i) && inRange(invoiceDay(i), r));
  const revenue = round2(inv.reduce((s, i) => s + netAmount(i), 0));
  const labor = round2(data.time.filter((t) => inRange(String(t.work_date ?? "").slice(0, 10), r)).reduce((s, t) => s + num(t.labor_cost), 0));
  const external = round2(data.external.filter((x) => inRange(String(x.invoice_date || x.created_at || "").slice(0, 10), r)).reduce((s, x) => s + num(x.amount_net), 0));
  const material = round2(
    data.material
      .filter((l) => MATERIAL_COST_ACTIONS.includes(String(l.action ?? "")) && inRange(String(l.created_at ?? "").slice(0, 10), r))
      .reduce((s, l) => {
        const price = l.material_price_at_use != null && l.material_price_at_use !== "" ? num(l.material_price_at_use) : data.prices.get(Number(l.material_id)) ?? 0;
        return s + num(l.quantity) * price;
      }, 0),
  );
  const margin = round2(revenue - labor - material - external);
  return { revenue, labor, material, external, margin, marginPct: revenue > 0 ? (margin / revenue) * 100 : null, invoices: inv.length };
}

export function receivables(invoices: InvoiceRow[]) {
  const open = invoices.filter(isOpenInvoice);
  return {
    amount: round2(open.reduce((s, i) => s + grossAmount(i), 0)),
    count: open.length,
    dunned: open.filter((i) => DUNNED_STATUSES.includes(String(i.status))).length,
  };
}

/** Nettoumsatz der letzten 12 Monate (ältester zuerst) */
export function monthlyRevenue(invoices: InvoiceRow[], today = new Date()) {
  const out: { key: string; label: string; revenue: number }[] = [];
  for (let k = 11; k >= 0; k--) {
    const d = new Date(today.getFullYear(), today.getMonth() - k, 1);
    out.push({ key: iso(d).slice(0, 7), label: d.toLocaleDateString("de-DE", { month: "short" }).replace(".", ""), revenue: 0 });
  }
  const idx = new Map(out.map((x, i) => [x.key, i]));
  for (const i of invoices) {
    if (!countsAsRevenue(i)) continue;
    const at = idx.get(invoiceDay(i).slice(0, 7));
    if (at != null) out[at].revenue += netAmount(i);
  }
  return out.map((x) => ({ ...x, revenue: round2(x.revenue) }));
}

/** Veränderung in % (null, wenn kein sinnvoller Vergleich möglich) */
export function change(cur: number, prev: number) {
  if (!prev) return null;
  return ((cur - prev) / Math.abs(prev)) * 100;
}

// ---------- Automatische Einschätzung (feste Regeln, keine KI) ----------
export type Level = "green" | "yellow" | "red";
export type Hint = { level: Level | "info"; text: string };

export function assessment(f: Figures, rec: { amount: number; dunned: number }, avgMonthRevenueGross: number, fmt: (n: number) => string): { level: Level; hints: Hint[] } {
  const hints: Hint[] = [];
  let level: Level = "green";
  const worse = (l: Level) => {
    if (l === "red" || (l === "yellow" && level === "green")) level = l;
  };

  if (f.revenue <= 0) {
    hints.push({ level: "info", text: "Im gewählten Zeitraum gibt es noch keine Rechnungen – deshalb lässt sich die Rentabilität nicht beurteilen." });
  } else {
    const pct = f.marginPct ?? 0;
    if (pct < 10) {
      worse("red");
      hints.push({ level: "red", text: `Der Deckungsbeitrag liegt nur bei ${pct1(pct)} % des Umsatzes. Davon müssen noch Miete, Fahrzeuge, Versicherungen und Ihr eigenes Gehalt bezahlt werden – bitte Preise und Nachkalkulation prüfen.` });
    } else if (pct < 20) {
      worse("yellow");
      hints.push({ level: "yellow", text: `Der Deckungsbeitrag liegt bei ${pct1(pct)} % des Umsatzes – eher knapp. Die Auftragsanalyse zeigt, welche Aufträge wenig bringen.` });
    } else {
      hints.push({ level: "green", text: `Der Deckungsbeitrag liegt bei ${pct1(pct)} % des Umsatzes.` });
    }
    const laborPct = (f.labor / f.revenue) * 100;
    const matPct = (f.material / f.revenue) * 100;
    if (laborPct > 50) {
      worse("yellow");
      hints.push({ level: "yellow", text: `Die Lohnkosten liegen bei ${pct1(laborPct)} % des Umsatzes – recht hoch. Stimmen Stundensätze und geplante Stunden?` });
    }
    if (matPct > 30) {
      worse("yellow");
      hints.push({ level: "yellow", text: `Das Material liegt bei ${pct1(matPct)} % des Umsatzes – wird es mit Aufschlag weiterberechnet?` });
    }
    if (f.labor === 0) {
      hints.push({ level: "info", text: "Für diesen Zeitraum sind keine Arbeitszeiten erfasst. Der Deckungsbeitrag ist deshalb zu hoch – Zeiten über die Stechuhr erfassen." });
    }
  }

  if (rec.amount > 0 && avgMonthRevenueGross > 0) {
    const months = rec.amount / avgMonthRevenueGross;
    if (months > 2) {
      worse("red");
      hints.push({ level: "red", text: `Offene Rechnungen über ${fmt(rec.amount)} – das sind mehr als zwei Monatsumsätze. Das bindet viel Geld; bitte nachfassen.` });
    } else if (months > 1) {
      worse("yellow");
      hints.push({ level: "yellow", text: `Offene Rechnungen über ${fmt(rec.amount)} – mehr als ein Monatsumsatz.` });
    }
  }
  if (rec.dunned > 0) {
    worse("yellow");
    hints.push({ level: "yellow", text: `${rec.dunned === 1 ? "1 Rechnung ist" : `${rec.dunned} Rechnungen sind`} bereits gemahnt.` });
  }
  return { level, hints };
}

const round2 = (n: number) => Math.round(n * 100) / 100;

/** Prozentzahl mit einer Nachkommastelle, deutsches Format (12,5) */
export const pct1 = (n: number) => n.toLocaleString("de-DE", { minimumFractionDigits: 1, maximumFractionDigits: 1 });
