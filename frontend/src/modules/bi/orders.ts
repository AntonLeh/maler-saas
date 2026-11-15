// Auftragsanalyse / Nachkalkulation: Rechenregeln (ohne React, testbar)
import { MATERIAL_COST_ACTIONS, countsAsRevenue, inRange, netAmount } from "./logic";
import type { InvoiceRow, Range } from "./logic";

export type OrderRow = {
  id: number;
  title?: string | null;
  status?: string | null;
  start_date?: string | null;
  created_at?: string | null;
  planned_hours?: number | string | null;
  quote_id?: number | null;
  customer_id?: number | null;
};
export type QuoteRow = { id: number; subtotal?: number | string | null; tax_rate?: number | string | null; tax_amount?: number | string | null; total_amount?: number | string | null };
export type OTime = { order_id?: number | null; net_hours?: number | string | null; labor_cost?: number | string | null };
export type OExternal = { order_id?: number | null; amount_net?: number | string | null };
export type OMaterial = { order_id?: number | null; material_id?: number | null; action?: string | null; quantity?: number | string | null; material_price_at_use?: number | string | null };

export const DONE_STATUSES = ["fertig", "abgerechnet"];
export type OrderFilter = "all" | "running" | "done";

export type OrderStat = {
  id: number;
  title: string;
  status: string;
  done: boolean;
  start: string;
  quote: number | null; // Angebot netto
  billed: number; // abgerechnet netto
  labor: number;
  material: number;
  external: number;
  cost: number;
  margin: number | null; // nur wenn abgerechnet
  marginPct: number | null;
  costOfQuotePct: number | null; // laufend & noch nicht abgerechnet: Kosten bisher in % vom Angebot
  hours: number;
  planned: number | null;
  hoursPct: number | null;
};

const num = (v: unknown) => {
  const n = Number(v);
  return Number.isFinite(n) ? n : 0;
};
const r2 = (n: number) => Math.round(n * 100) / 100;
const sumBy = <T,>(xs: T[], f: (x: T) => number) => xs.reduce((s, x) => s + f(x), 0);
function group<T extends { order_id?: number | null }>(xs: T[]) {
  const m = new Map<number, T[]>();
  for (const x of xs) {
    const id = Number(x.order_id);
    if (!id) continue;
    if (!m.has(id)) m.set(id, []);
    m.get(id)!.push(x);
  }
  return m;
}

export function orderStats(
  d: { orders: OrderRow[]; quotes: QuoteRow[]; invoices: InvoiceRow[]; time: OTime[]; external: OExternal[]; material: OMaterial[]; prices: Map<number, number> },
  range: Range | null,
  filter: OrderFilter = "all",
): OrderStat[] {
  const quotes = new Map(d.quotes.map((q) => [q.id, q]));
  const inv = group(d.invoices.filter(countsAsRevenue));
  const time = group(d.time);
  const ext = group(d.external);
  const mat = group(d.material.filter((l) => MATERIAL_COST_ACTIONS.includes(String(l.action ?? ""))));

  return d.orders
    .map((o) => {
      const status = String(o.status ?? "");
      const done = DONE_STATUSES.includes(status);
      const q = o.quote_id != null ? quotes.get(Number(o.quote_id)) : undefined;
      const quote = q ? r2(netAmount(q)) : null;
      const billed = r2(sumBy(inv.get(o.id) ?? [], netAmount));
      const t = time.get(o.id) ?? [];
      const labor = r2(sumBy(t, (x) => num(x.labor_cost)));
      const hours = r2(sumBy(t, (x) => num(x.net_hours)));
      const external = r2(sumBy(ext.get(o.id) ?? [], (x) => num(x.amount_net)));
      const material = r2(
        sumBy(mat.get(o.id) ?? [], (l) => num(l.quantity) * (l.material_price_at_use != null && l.material_price_at_use !== "" ? num(l.material_price_at_use) : d.prices.get(Number(l.material_id)) ?? 0)),
      );
      const cost = r2(labor + material + external);
      const planned = o.planned_hours != null && o.planned_hours !== "" && num(o.planned_hours) > 0 ? num(o.planned_hours) : null;
      const margin = billed > 0 ? r2(billed - cost) : null;
      return {
        id: o.id,
        title: (o.title || "").trim() || `Auftrag #${o.id}`,
        status,
        done,
        start: String(o.start_date || o.created_at || "").slice(0, 10),
        quote,
        billed,
        labor,
        material,
        external,
        cost,
        margin,
        marginPct: margin != null ? (margin / billed) * 100 : null,
        costOfQuotePct: billed === 0 && quote && quote > 0 ? (cost / quote) * 100 : null,
        hours,
        planned,
        hoursPct: planned ? (hours / planned) * 100 : null,
      };
    })
    .filter((o) => inRange(o.start, range) && (filter === "all" || (filter === "done" ? o.done : !o.done)))
    .sort((a, b) => b.billed - a.billed || b.cost - a.cost);
}

export function orderSummary(rows: OrderStat[]) {
  const billedRows = rows.filter((r) => r.margin != null);
  const billed = r2(sumBy(billedRows, (r) => r.billed));
  const margin = r2(sumBy(billedRows, (r) => r.margin ?? 0));
  return {
    billed,
    margin,
    marginPct: billed > 0 ? (margin / billed) * 100 : null,
    billedCount: billedRows.length,
    overPlan: rows.filter((r) => (r.hoursPct ?? 0) > 110).length,
    withPlan: rows.filter((r) => r.planned != null).length,
  };
}

export const lowestMargin = (rows: OrderStat[], limit = 5) =>
  rows
    .filter((r) => r.marginPct != null)
    .sort((a, b) => (a.marginPct ?? 0) - (b.marginPct ?? 0))
    .slice(0, limit);

export const overHours = (rows: OrderStat[], limit = 5) =>
  rows
    .filter((r) => (r.hoursPct ?? 0) > 110)
    .sort((a, b) => (b.hoursPct ?? 0) - (a.hoursPct ?? 0))
    .slice(0, limit);

/** Ampel: grün bis 100 %, orange bis 110 %, rot darüber */
export const hoursTone = (pct: number | null) => (pct == null ? "" : pct <= 100 ? "green" : pct <= 110 ? "yellow" : "red");
export const marginTone = (pct: number | null) => (pct == null ? "" : pct < 10 ? "red" : pct < 20 ? "yellow" : "green");
