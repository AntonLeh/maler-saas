// Kundenanalyse: Rechenregeln (ohne React, testbar)
import { DUNNED_STATUSES, countsAsRevenue, grossAmount, inRange, invoiceDay, isOpenInvoice, netAmount } from "./logic";
import type { InvoiceRow, Range } from "./logic";

export type CustomerRow = { id: number; first_name?: string | null; last_name?: string | null; company_name?: string | null };
export type CInvoice = InvoiceRow & { due_date?: string | null; paid_at?: string | null };

export type Abc = "A" | "B" | "C" | "–";
export type CustomerStat = {
  id: number;
  name: string;
  invoices: number;
  revenue: number;
  share: number; // Anteil am Umsatz im Zeitraum, 0–100
  open: number;
  openCount: number;
  dunned: number;
  payDays: number | null; // Ø Tage von Rechnungsdatum bis Zahlung
  lateDays: number | null; // Ø Tage nach Fälligkeit (bezahlte + überfällige offene)
  lastInvoice: string | null; // letzte gültige Rechnung überhaupt
  lifetime: number; // Umsatz seit Beginn
  abc: Abc;
};

export const customerName = (c: CustomerRow) =>
  (c.company_name || `${c.first_name ?? ""} ${c.last_name ?? ""}`).trim() || `Kunde #${c.id}`;

const DAY = 86400000;
const day = (s: string | null | undefined) => String(s ?? "").slice(0, 10);
export function daysBetween(from: string, to: string) {
  const a = Date.parse(`${day(from)}T12:00:00Z`);
  const b = Date.parse(`${day(to)}T12:00:00Z`);
  return Number.isFinite(a) && Number.isFinite(b) ? Math.round((b - a) / DAY) : null;
}
const avg = (xs: number[]) => (xs.length ? xs.reduce((s, x) => s + x, 0) / xs.length : null);
const isoToday = (t: Date) => `${t.getFullYear()}-${String(t.getMonth() + 1).padStart(2, "0")}-${String(t.getDate()).padStart(2, "0")}`;

export function customerStats(customers: CustomerRow[], invoices: CInvoice[], range: Range | null, today = new Date()): CustomerStat[] {
  const now = isoToday(today);
  const byCustomer = new Map<number, CInvoice[]>();
  for (const i of invoices) {
    const id = Number(i.customer_id);
    if (!id) continue;
    if (!byCustomer.has(id)) byCustomer.set(id, []);
    byCustomer.get(id)!.push(i);
  }

  const rows: CustomerStat[] = customers.map((c) => {
    const all = byCustomer.get(c.id) ?? [];
    const valid = all.filter(countsAsRevenue);
    const inPeriod = valid.filter((i) => inRange(invoiceDay(i), range));
    const open = all.filter(isOpenInvoice);
    const paid = valid.filter((i) => i.status === "paid" && i.paid_at);
    const payDays = avg(paid.filter((i) => inRange(invoiceDay(i), range)).map((i) => daysBetween(invoiceDay(i), day(i.paid_at))).filter((d): d is number => d != null && d >= 0));
    const late = [
      ...paid.filter((i) => i.due_date).map((i) => daysBetween(day(i.due_date), day(i.paid_at))),
      ...open.filter((i) => i.due_date && day(i.due_date) < now).map((i) => daysBetween(day(i.due_date), now)),
    ]
      .filter((d): d is number => d != null)
      .map((d) => Math.max(0, d));
    const dates = valid.map(invoiceDay).filter(Boolean).sort();
    return {
      id: c.id,
      name: customerName(c),
      invoices: inPeriod.length,
      revenue: round2(inPeriod.reduce((s, i) => s + netAmount(i), 0)),
      share: 0,
      open: round2(open.reduce((s, i) => s + grossAmount(i), 0)),
      openCount: open.length,
      dunned: open.filter((i) => DUNNED_STATUSES.includes(String(i.status))).length,
      payDays: payDays == null ? null : Math.round(payDays),
      lateDays: late.length ? Math.round(avg(late)!) : null,
      lastInvoice: dates.length ? dates[dates.length - 1] : null,
      lifetime: round2(valid.reduce((s, i) => s + netAmount(i), 0)),
      abc: "–",
    };
  });

  // A/B/C nach 80/15/5: A-Kunden bringen zusammen 80 % des Umsatzes, B die nächsten 15 %, C den Rest
  const total = rows.reduce((s, r) => s + Math.max(r.revenue, 0), 0);
  let before = 0;
  for (const r of [...rows].filter((x) => x.revenue > 0).sort((a, b) => b.revenue - a.revenue)) {
    r.share = total > 0 ? (r.revenue / total) * 100 : 0;
    r.abc = before < 80 ? "A" : before < 95 ? "B" : "C";
    before += r.share;
  }
  return rows.sort((a, b) => b.revenue - a.revenue || b.open - a.open || a.name.localeCompare(b.name, "de"));
}

export function summary(rows: CustomerStat[], invoices: CInvoice[], range: Range | null) {
  const withRevenue = rows.filter((r) => r.revenue > 0);
  const revenue = round2(withRevenue.reduce((s, r) => s + r.revenue, 0));
  const open = invoices.filter(isOpenInvoice);
  const paidDays = invoices
    .filter((i) => countsAsRevenue(i) && i.status === "paid" && i.paid_at && inRange(invoiceDay(i), range))
    .map((i) => daysBetween(invoiceDay(i), day(i.paid_at)))
    .filter((d): d is number => d != null && d >= 0);
  const a = withRevenue.filter((r) => r.abc === "A").length;
  return {
    revenue,
    customers: withRevenue.length,
    perCustomer: withRevenue.length ? round2(revenue / withRevenue.length) : 0,
    open: round2(open.reduce((s, i) => s + grossAmount(i), 0)),
    openCount: open.length,
    dunned: open.filter((i) => DUNNED_STATUSES.includes(String(i.status))).length,
    payDays: paidDays.length ? Math.round(avg(paidDays)!) : null,
    aCount: a,
    aShare: withRevenue.filter((r) => r.abc === "A").reduce((s, r) => s + r.share, 0),
  };
}

/** Zahlt im Schnitt mehr als 3 Tage nach Fälligkeit */
export const latePayers = (rows: CustomerStat[], limit = 5) =>
  rows
    .filter((r) => (r.lateDays ?? 0) > 3)
    .sort((a, b) => (b.lateDays ?? 0) - (a.lateDays ?? 0))
    .slice(0, limit);

/** Gute Kunden, deren letzte Rechnung über 12 Monate her ist */
export function sleeping(rows: CustomerStat[], today = new Date(), limit = 5) {
  const cut = new Date(today);
  cut.setFullYear(cut.getFullYear() - 1);
  const c = isoToday(cut);
  return rows
    .filter((r) => r.lastInvoice && r.lastInvoice < c && r.lifetime > 0)
    .sort((a, b) => b.lifetime - a.lifetime)
    .slice(0, limit);
}

const round2 = (n: number) => Math.round(n * 100) / 100;
