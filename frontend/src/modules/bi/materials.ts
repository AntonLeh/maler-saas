// Materialanalyse: Rechenregeln (ohne React, testbar)
import { MATERIAL_COST_ACTIONS, inRange } from "./logic";
import type { Range } from "./logic";

export type MatRow = {
  id: number;
  name?: string | null;
  unit?: string | null;
  category?: string | null;
  purchase_price?: number | string | null;
  stock_quantity?: number | string | null;
  minimum_quantity?: number | string | null;
  is_active?: boolean | null;
};
export type MatLog = { material_id?: number | null; action?: string | null; quantity?: number | string | null; material_price_at_use?: number | string | null; created_at?: string | null };

export type MatStat = {
  id: number;
  name: string;
  unit: string;
  category: string;
  price: number;
  qty: number; // verbraucht + gelassen + beschädigt
  cost: number;
  share: number;
  damagedQty: number;
  damagedCost: number;
  stock: number;
  minimum: number;
  low: boolean;
  stockValue: number;
};

const num = (v: unknown) => {
  const n = Number(v);
  return Number.isFinite(n) ? n : 0;
};
const r2 = (n: number) => Math.round(n * 100) / 100;
export const NO_CATEGORY = "Ohne Kategorie";

export function materialStats(materials: MatRow[], logs: MatLog[], range: Range | null): MatStat[] {
  const byId = new Map<number, MatLog[]>();
  for (const l of logs) {
    if (!MATERIAL_COST_ACTIONS.includes(String(l.action ?? ""))) continue;
    if (!inRange(String(l.created_at ?? "").slice(0, 10), range)) continue;
    const id = Number(l.material_id);
    if (!byId.has(id)) byId.set(id, []);
    byId.get(id)!.push(l);
  }
  const rows = materials.map((m) => {
    const price = num(m.purchase_price);
    const ls = byId.get(m.id) ?? [];
    const unitPrice = (l: MatLog) => (l.material_price_at_use != null && l.material_price_at_use !== "" ? num(l.material_price_at_use) : price);
    const damaged = ls.filter((l) => l.action === "damaged");
    const stock = num(m.stock_quantity);
    const minimum = num(m.minimum_quantity);
    return {
      id: m.id,
      name: (m.name || "").trim() || `Material #${m.id}`,
      unit: (m.unit || "").trim(),
      category: (m.category || "").trim() || NO_CATEGORY,
      price,
      qty: r2(ls.reduce((s, l) => s + num(l.quantity), 0)),
      cost: r2(ls.reduce((s, l) => s + num(l.quantity) * unitPrice(l), 0)),
      share: 0,
      damagedQty: r2(damaged.reduce((s, l) => s + num(l.quantity), 0)),
      damagedCost: r2(damaged.reduce((s, l) => s + num(l.quantity) * unitPrice(l), 0)),
      stock,
      minimum,
      low: minimum > 0 && stock <= minimum,
      stockValue: r2(Math.max(stock, 0) * price),
    };
  });
  const total = rows.reduce((s, r) => s + r.cost, 0);
  for (const r of rows) r.share = total > 0 ? (r.cost / total) * 100 : 0;
  return rows.sort((a, b) => b.cost - a.cost || a.name.localeCompare(b.name, "de"));
}

export function materialSummary(rows: MatStat[], revenue: number) {
  const cost = r2(rows.reduce((s, r) => s + r.cost, 0));
  return {
    cost,
    revenueShare: revenue > 0 ? (cost / revenue) * 100 : null,
    damaged: r2(rows.reduce((s, r) => s + r.damagedCost, 0)),
    stockValue: r2(rows.reduce((s, r) => s + r.stockValue, 0)),
    low: rows.filter((r) => r.low).length,
  };
}

export function byCategory(rows: MatStat[]) {
  const m = new Map<string, number>();
  for (const r of rows) if (r.cost > 0) m.set(r.category, (m.get(r.category) ?? 0) + r.cost);
  const total = [...m.values()].reduce((s, x) => s + x, 0);
  return [...m.entries()].map(([category, cost]) => ({ category, cost: r2(cost), share: total > 0 ? (cost / total) * 100 : 0 })).sort((a, b) => b.cost - a.cost);
}

export const toReorder = (rows: MatStat[], limit = 6) =>
  rows
    .filter((r) => r.low)
    .sort((a, b) => a.stock / (a.minimum || 1) - b.stock / (b.minimum || 1))
    .slice(0, limit);

export const mostDamaged = (rows: MatStat[], limit = 5) =>
  rows
    .filter((r) => r.damagedCost > 0)
    .sort((a, b) => b.damagedCost - a.damagedCost)
    .slice(0, limit);

/** Menge mit Einheit, deutsches Zahlenformat */
export const qtyText = (n: number, unit: string) => `${n.toLocaleString("de-DE", { maximumFractionDigits: 2 })}${unit ? ` ${unit}` : ""}`;
