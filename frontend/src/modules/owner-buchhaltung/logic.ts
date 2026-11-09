// Owner-Buchhaltung Spanien (autónomo, IVA régimen general, IRPF estimación directa simplificada)
// Reine Berechnung ohne Datenbank – testbar.

export type IncomeTreatment = "es" | "eu_b2b" | "eu_no_vat_id" | "oss" | "non_eu" | "other";
export type ExpenseTreatment = "es_iva" | "eu_isp" | "non_eu_isp" | "sin_iva";

export type Income = {
  id: number;
  stripe_id: string;
  kind: "invoice" | "credit_note";
  number: string | null;
  issue_date: string;
  paid_at: string | null;
  customer_name: string | null;
  customer_email: string | null;
  customer_country: string | null;
  customer_tax_id: string | null;
  currency: string;
  net: number;
  tax: number;
  total: number;
  net_eur: number;
  tax_eur: number;
  total_eur: number;
  tax_rate: number | null;
  treatment: IncomeTreatment;
  treatment_locked?: boolean;
  retencion: number;
  description: string | null;
  invoice_pdf: string | null;
};

export type Expense = {
  id: number;
  issue_date: string;
  supplier: string;
  supplier_country: string | null;
  supplier_tax_id: string | null;
  invoice_number: string | null;
  category: string;
  treatment: ExpenseTreatment;
  currency: string;
  amount_original: number | null;
  net: number;
  iva_rate: number;
  iva: number;
  total: number;
  iva_deductible: boolean;
  irpf_deductible: boolean;
  note: string | null;
  file_path: string | null;
};

export type Settings = {
  nif: string | null;
  full_name: string | null;
  address: string | null;
  difficult_pct: number;
  difficult_cap: number;
  minoracion: number;
  books_start: string;
  last_sync_at: string | null;
};

export const INCOME_LABELS: Record<IncomeTreatment, string> = {
  es: "Mit spanischer IVA (21 %)",
  eu_b2b: "EU-Firma – Steuerumkehr",
  eu_no_vat_id: "EU ohne USt-IdNr. – prüfen",
  oss: "EU-Ausland mit dortiger MwSt (OSS)",
  non_eu: "Außerhalb der EU – nicht steuerbar",
  other: "Bitte prüfen",
};

export const EXPENSE_LABELS: Record<ExpenseTreatment, string> = {
  es_iva: "Spanien mit IVA",
  eu_isp: "EU-Dienstleister ohne IVA (Steuerumkehr)",
  non_eu_isp: "Nicht-EU-Dienstleister (Steuerumkehr)",
  sin_iva: "Ohne IVA",
};

export const CATEGORY_LABELS: Record<string, string> = {
  software: "Server & Software",
  werbung: "Werbung",
  telefon: "Telefon & Internet",
  gestoria: "Gestoría",
  buero: "Büro",
  hardware: "Hardware",
  reisen: "Reisen",
  fortbildung: "Fortbildung",
  bank: "Bank- & Zahlungsgebühren",
  sozialversicherung: "Cuota de autónomos",
  sonstiges: "Sonstiges",
};

const r2 = (n: number) => Math.round((n + Number.EPSILON) * 100) / 100;
const num = (v: unknown) => Number(v ?? 0) || 0;

// ---------- Zeiträume ----------

export type Quarter = { year: number; q: 1 | 2 | 3 | 4 };

export const quarterRange = ({ year, q }: Quarter) => {
  const m = (q - 1) * 3;
  const pad = (n: number) => String(n).padStart(2, "0");
  const lastDay = new Date(Date.UTC(year, m + 3, 0)).getUTCDate();
  return { from: `${year}-${pad(m + 1)}-01`, to: `${year}-${pad(m + 3)}-${pad(lastDay)}` };
};

export const quarterOf = (date: string): Quarter => {
  const [y, mo] = date.split("-").map(Number);
  return { year: y, q: (Math.floor((mo - 1) / 3) + 1) as Quarter["q"] };
};

const MONTHS_ES = ["enero", "febrero", "marzo", "abril", "mayo", "junio", "julio", "agosto", "septiembre", "octubre", "noviembre", "diciembre"];
const MONTHS_DE = ["Januar", "Februar", "März", "April", "Mai", "Juni", "Juli", "August", "September", "Oktober", "November", "Dezember"];

export type Period = { from: string; to: string; tag: string; label: string; quarter: Quarter | null };

/** Monate eines Quartals (nur ab Buchhaltungsbeginn und bis heute) */
export const monthsOfQuarter = ({ year, q }: Quarter, booksStart: string, today: string): Period[] => {
  const pad = (n: number) => String(n).padStart(2, "0");
  const out: Period[] = [];
  for (let m = (q - 1) * 3 + 1; m <= q * 3; m++) {
    const from = `${year}-${pad(m)}-01`;
    const to = `${year}-${pad(m)}-${pad(new Date(Date.UTC(year, m, 0)).getUTCDate())}`;
    if (to < booksStart || from > today) continue;
    out.push({ from, to, tag: `${year}-${pad(m)}_${MONTHS_ES[m - 1]}`, label: `${MONTHS_DE[m - 1]} ${year}`, quarter: null });
  }
  return out;
};

export const quarterPeriod = (qq: Quarter): Period => ({ ...quarterRange(qq), tag: `${qq.year}-${qq.q}T`, label: `${qq.q}. Quartal ${qq.year}`, quarter: qq });

export const quarterLabel = ({ year, q }: Quarter) => `${q}T ${year}`;

export const inQuarter = (date: string, qq: Quarter) => {
  const { from, to } = quarterRange(qq);
  return date >= from && date <= to;
};

/** Abgabefrist (Modelo 303, 130, 349): 1.–20. des Folgemonats, 4. Quartal bis 30. Januar */
export const deadline = ({ year, q }: Quarter) => {
  if (q === 4) return { from: `${year + 1}-01-01`, to: `${year + 1}-01-30` };
  const m = String(q * 3 + 1).padStart(2, "0");
  return { from: `${year}-${m}-01`, to: `${year}-${m}-20` };
};

export const quartersFrom = (start: string, until: string): Quarter[] => {
  const out: Quarter[] = [];
  let cur = quarterOf(start);
  const end = quarterOf(until);
  while (cur.year < end.year || (cur.year === end.year && cur.q <= end.q)) {
    out.push(cur);
    cur = cur.q === 4 ? { year: cur.year + 1, q: 1 } : { year: cur.year, q: (cur.q + 1) as Quarter["q"] };
  }
  return out;
};

// ---------- Ausgaben: Beträge ----------

/** IVA der Steuerumkehr (Autoliquidación): 21 % auf die Netto-Basis, wird geschuldet UND abgezogen */
export const ispQuota = (e: Expense) => r2(num(e.net) * (num(e.iva_rate) || 21) / 100);

/** Abziehbare Kosten für die IRPF (ohne abziehbare IVA) */
export const irpfCost = (e: Expense) => {
  if (!e.irpf_deductible) return 0;
  const base = num(e.net);
  // Nicht abziehbare spanische IVA wird Teil der Kosten
  if (e.treatment === "es_iva" && !e.iva_deductible) return r2(base + num(e.iva));
  // Ausländische MwSt ohne Abzug (z. B. deutsche 19 % auf der Rechnung) steckt in total
  if (e.treatment === "sin_iva") return r2(num(e.total) || base);
  return base;
};

// ---------- Modelo 303 ----------

export type Row = { c: string; label: string; value: number; strong?: boolean };

export type Result303 = {
  rows: Row[];
  devengado: number; // 27
  deducible: number; // 45
  resultado: number; // 46 / 66 / 69
  compensarPrev: number; // 110
  aplicado: number; // 78
  pendiente: number; // 87
  final: number; // 71 (> 0 a ingresar, < 0 a compensar)
  review: Income[]; // Rechnungen, die geprüft werden müssen
  oss: number;
};

function raw303(income: Income[], expenses: Expense[], qq: Quarter) {
  const inc = income.filter((i) => inQuarter(i.issue_date, qq));
  const exp = expenses.filter((e) => inQuarter(e.issue_date, qq));
  const byRate = (rate: number) => inc.filter((i) => i.treatment === "es" && Math.round(num(i.tax_rate)) === rate);
  const sum = (list: Income[], k: "net_eur" | "tax_eur") => r2(list.reduce((s, i) => s + num(i[k]), 0));

  const b4 = sum(byRate(4), "net_eur"), c4 = sum(byRate(4), "tax_eur");
  const b10 = sum(byRate(10), "net_eur"), c10 = sum(byRate(10), "tax_eur");
  const es21 = inc.filter((i) => i.treatment === "es" && ![4, 10].includes(Math.round(num(i.tax_rate))));
  const b21 = sum(es21, "net_eur"), c21 = sum(es21, "tax_eur");

  const eu = exp.filter((e) => e.treatment === "eu_isp");
  const nonEu = exp.filter((e) => e.treatment === "non_eu_isp");
  const b10x = r2(eu.reduce((s, e) => s + num(e.net), 0));
  const c11 = r2(eu.reduce((s, e) => s + ispQuota(e), 0));
  const b12 = r2(nonEu.reduce((s, e) => s + num(e.net), 0));
  const c13 = r2(nonEu.reduce((s, e) => s + ispQuota(e), 0));
  const dev = r2(c4 + c10 + c21 + c11 + c13);

  const dom = exp.filter((e) => e.treatment === "es_iva" && e.iva_deductible);
  const b28 = r2(dom.reduce((s, e) => s + num(e.net), 0) + b12);
  const c29 = r2(dom.reduce((s, e) => s + num(e.iva), 0) + c13);
  const b36 = b10x, c37 = c11;
  const ded = r2(c29 + c37);

  const c59 = sum(inc.filter((i) => i.treatment === "eu_b2b"), "net_eur");
  const c120 = sum(inc.filter((i) => i.treatment === "non_eu"), "net_eur");
  const c123 = sum(inc.filter((i) => i.treatment === "oss"), "net_eur");
  const review = inc.filter((i) => i.treatment === "eu_no_vat_id" || i.treatment === "other");

  return { b4, c4, b10, c10, b21, c21, b10x, c11, b12, c13, dev, b28, c29, b36, c37, ded, c59, c120, c123, review, result: r2(dev - ded) };
}

/**
 * Modelo 303 für ein Quartal. Negative Ergebnisse früherer Quartale (seit Buchhaltungsbeginn)
 * werden als „cuotas a compensar“ (Casilla 110 → 78) übertragen.
 */
export function modelo303(income: Income[], expenses: Expense[], qq: Quarter, booksStart: string): Result303 {
  let carry = 0;
  for (const p of quartersFrom(booksStart, quarterRange(qq).from)) {
    if (p.year === qq.year && p.q === qq.q) break;
    const r = raw303(income, expenses, p).result;
    const applied = r > 0 ? Math.min(carry, r) : 0;
    carry = r2(carry - applied + (r < 0 ? -r : 0));
  }
  const x = raw303(income, expenses, qq);
  const aplicado = x.result > 0 ? Math.min(carry, x.result) : 0;
  const final = r2(x.result - aplicado);
  const pendiente = r2(carry - aplicado + (x.result < 0 ? -x.result : 0));

  const rows: Row[] = [
    { c: "01", label: "Base imponible 4 %", value: x.b4 },
    { c: "03", label: "Cuota 4 %", value: x.c4 },
    { c: "04", label: "Base imponible 10 %", value: x.b10 },
    { c: "06", label: "Cuota 10 %", value: x.c10 },
    { c: "07", label: "Base imponible 21 % (Rechnungen mit spanischer IVA, z. B. Kunden ohne USt-IdNr.)", value: x.b21 },
    { c: "09", label: "Cuota 21 %", value: x.c21 },
    { c: "10", label: "Adquisiciones intracomunitarias de servicios – Base (EU-Dienstleister)", value: x.b10x },
    { c: "11", label: "Adquisiciones intracomunitarias – Cuota", value: x.c11 },
    { c: "12", label: "Otras operaciones con inversión del sujeto pasivo – Base (Nicht-EU)", value: x.b12 },
    { c: "13", label: "Inversión del sujeto pasivo – Cuota", value: x.c13 },
    { c: "27", label: "Total cuota devengada", value: x.dev, strong: true },
    { c: "28", label: "IVA deducible operaciones interiores corrientes – Base", value: x.b28 },
    { c: "29", label: "IVA deducible operaciones interiores corrientes – Cuota", value: x.c29 },
    { c: "36", label: "IVA deducible adquisiciones intracomunitarias de bienes y servicios corrientes – Base", value: x.b36 },
    { c: "37", label: "IVA deducible adquisiciones intracomunitarias – Cuota", value: x.c37 },
    { c: "45", label: "Total a deducir", value: x.ded, strong: true },
    { c: "46", label: "Resultado régimen general (27 − 45)", value: x.result, strong: true },
    { c: "59", label: "Entregas intracomunitarias de bienes y servicios (EU-Firmenkunden)", value: x.c59 },
    { c: "120", label: "Operaciones no sujetas por reglas de localización (z. B. Schweiz)", value: x.c120 },
    { c: "123", label: "Operaciones no sujetas por localización acogidas a la OSS", value: x.c123 },
    { c: "64", label: "Suma de resultados", value: x.result },
    { c: "65", label: "% atribuible a la Administración del Estado", value: 100 },
    { c: "66", label: "Atribuible a la Administración del Estado", value: x.result },
    { c: "110", label: "Cuotas a compensar pendientes de periodos previos", value: carry },
    { c: "78", label: "Cuotas a compensar aplicadas en este periodo", value: aplicado },
    { c: "87", label: "Cuotas a compensar pendientes para periodos posteriores", value: pendiente },
    { c: "69", label: "Resultado", value: final, strong: true },
    { c: "71", label: "Resultado de la liquidación", value: final, strong: true },
  ];

  return {
    rows,
    devengado: x.dev,
    deducible: x.ded,
    resultado: x.result,
    compensarPrev: carry,
    aplicado,
    pendiente,
    final,
    review: x.review,
    oss: x.c123,
  };
}

// ---------- Modelo 349 ----------

export type Row349 = { clave: "S" | "I"; nif: string; name: string; country: string; base: number; missingId: boolean };

export function modelo349(income: Income[], expenses: Expense[], qq: Quarter): Row349[] {
  const map = new Map<string, Row349>();
  const add = (clave: "S" | "I", nif: string | null, name: string, country: string | null, base: number) => {
    const id = (nif || "").replace(/\s+/g, "").toUpperCase();
    const key = `${clave}|${id || name}`;
    const cur = map.get(key) ?? { clave, nif: id, name, country: (country || "").toUpperCase(), base: 0, missingId: !id };
    cur.base = r2(cur.base + base);
    map.set(key, cur);
  };
  for (const i of income) if (i.treatment === "eu_b2b" && inQuarter(i.issue_date, qq)) add("S", i.customer_tax_id, i.customer_name || i.customer_email || "Kunde", i.customer_country, num(i.net_eur));
  for (const e of expenses) if (e.treatment === "eu_isp" && inQuarter(e.issue_date, qq)) add("I", e.supplier_tax_id, e.supplier, e.supplier_country, num(e.net));
  return [...map.values()].filter((r) => r.base !== 0).sort((a, b) => a.clave.localeCompare(b.clave) || b.base - a.base);
}

// ---------- Modelo 130 ----------

export type Result130 = { rows: Row[]; result: number; ingresos: number; gastos: number; rendimiento: number };

function ytd(income: Income[], expenses: Expense[], qq: Quarter, s: Settings) {
  const from = `${qq.year}-01-01`;
  const to = quarterRange(qq).to;
  const start = s.books_start > from ? s.books_start : from;
  const ingresos = r2(income.filter((i) => i.issue_date >= start && i.issue_date <= to).reduce((a, i) => a + num(i.net_eur), 0));
  const retenciones = r2(income.filter((i) => i.issue_date >= start && i.issue_date <= to).reduce((a, i) => a + num(i.retencion), 0));
  const gastosReal = r2(expenses.filter((e) => e.issue_date >= start && e.issue_date <= to).reduce((a, e) => a + irpfCost(e), 0));
  const pre = r2(ingresos - gastosReal);
  const dificil = pre > 0 ? r2(Math.min(pre * num(s.difficult_pct) / 100, num(s.difficult_cap))) : 0;
  return { ingresos, gastosReal, dificil, gastos: r2(gastosReal + dificil), retenciones };
}

/**
 * Modelo 130 (estimación directa simplificada), Beträge kumuliert vom 1. Januar bis Quartalsende.
 * Casilla 05 = Summe der positiven Casilla 07 der Vorquartale; Casilla 15 = nicht genutzte negative 19 der Vorquartale.
 */
export function modelo130(income: Income[], expenses: Expense[], qq: Quarter, s: Settings): Result130 {
  const quarters = ([1, 2, 3, 4] as const).filter((q) => q <= qq.q).map((q) => ({ year: qq.year, q }));
  let prev07 = 0;
  let negCarry = 0; // nicht genutzte negative Ergebnisse (Casilla 19) aus Vorquartalen
  let last: Result130 | null = null;
  for (const p of quarters) {
    const pEnd = quarterRange(p).to;
    if (pEnd < s.books_start) continue;
    const y = ytd(income, expenses, p, s);
    const c03 = r2(y.ingresos - y.gastos);
    const c04 = c03 > 0 ? r2(c03 * 0.2) : 0;
    const c05 = prev07;
    const c06 = y.retenciones;
    const c07 = r2(c04 - c05 - c06);
    const c12 = c07 > 0 ? c07 : 0;
    const c13 = num(s.minoracion);
    const c14 = r2(c12 - c13);
    const c15 = c14 > 0 ? Math.min(negCarry, c14) : 0;
    const c17 = r2(c14 - c15);
    const c19 = c17;
    last = {
      ingresos: y.ingresos,
      gastos: y.gastos,
      rendimiento: c03,
      result: c19,
      rows: [
        { c: "01", label: "Ingresos computables (seit 1. Januar)", value: y.ingresos },
        { c: "02", label: `Gastos fiscalmente deducibles (inkl. ${num(s.difficult_pct)} % difícil justificación: ${y.dificil.toFixed(2)} €)`, value: y.gastos },
        { c: "03", label: "Rendimiento neto (01 − 02)", value: c03, strong: true },
        { c: "04", label: "20 % de la casilla 03", value: c04 },
        { c: "05", label: "Pagos fraccionados de trimestres anteriores", value: c05 },
        { c: "06", label: "Retenciones e ingresos a cuenta", value: c06 },
        { c: "07", label: "Diferencia (04 − 05 − 06)", value: c07 },
        { c: "12", label: "Suma (07 + 11), mindestens 0", value: c12 },
        { c: "13", label: "Minoración (Rendimiento Vorjahr ≤ 12.000 €)", value: c13 },
        { c: "14", label: "Diferencia (12 − 13)", value: c14 },
        { c: "15", label: "Resultados negativos de trimestres anteriores", value: c15 },
        { c: "17", label: "Total (14 − 15 − 16)", value: c17 },
        { c: "19", label: "Resultado de la declaración", value: c19, strong: true },
      ],
    };
    if (c07 > 0) prev07 = r2(prev07 + c07);
    if (c19 < 0) negCarry = r2(negCarry - c19);
    else negCarry = r2(negCarry - c15);
  }
  return last ?? { rows: [], result: 0, ingresos: 0, gastos: 0, rendimiento: 0 };
}

// ---------- Libros registro (CSV für die Gestoría) ----------

const esNum = (n: number) => r2(n).toFixed(2).replace(".", ",");
const cell = (v: unknown) => {
  const s = String(v ?? "");
  return /[;"\n]/.test(s) ? `"${s.replace(/"/g, '""')}"` : s;
};
const csv = (rows: unknown[][]) => "﻿" + rows.map((r) => r.map(cell).join(";")).join("\r\n");
const esDate = (d: string) => `${d.slice(8, 10)}/${d.slice(5, 7)}/${d.slice(0, 4)}`;

const OP_EMITIDA: Record<IncomeTreatment, string> = {
  es: "Sujeta y no exenta",
  eu_b2b: "Prestación intracomunitaria de servicios (ISP, art. 69 LIVA)",
  eu_no_vat_id: "Cliente UE sin NIF-IVA – revisar",
  oss: "No sujeta – OSS (ventanilla única)",
  non_eu: "No sujeta por reglas de localización (art. 69 LIVA)",
  other: "Revisar",
};

const OP_RECIBIDA: Record<ExpenseTreatment, string> = {
  es_iva: "Operación interior",
  eu_isp: "Adquisición intracomunitaria de servicios (ISP)",
  non_eu_isp: "Inversión del sujeto pasivo (proveedor extracomunitario)",
  sin_iva: "Sin IVA",
};

export function libroEmitidas(income: Income[], from: string, to: string) {
  const rows: unknown[][] = [[
    "Fecha expedición", "Número", "Tipo", "Destinatario", "NIF / NIF-IVA", "País", "Base imponible (EUR)", "Tipo IVA %", "Cuota IVA (EUR)",
    "Total (EUR)", "Retención IRPF (EUR)", "Tipo de operación", "Moneda original", "Total moneda original", "Fecha cobro",
  ]];
  for (const i of income.filter((x) => x.issue_date >= from && x.issue_date <= to).sort((a, b) => a.issue_date.localeCompare(b.issue_date))) {
    rows.push([
      esDate(i.issue_date), i.number ?? i.stripe_id, i.kind === "credit_note" ? "Rectificativa" : "Factura",
      i.customer_name ?? i.customer_email ?? "", i.customer_tax_id ?? "", i.customer_country ?? "",
      esNum(i.net_eur), i.treatment === "es" ? esNum(num(i.tax_rate)) : "0,00", esNum(i.treatment === "es" ? i.tax_eur : 0),
      esNum(i.total_eur), esNum(num(i.retencion)), OP_EMITIDA[i.treatment], i.currency, esNum(i.total), i.paid_at ? esDate(i.paid_at.slice(0, 10)) : "",
    ]);
  }
  return csv(rows);
}

export function libroRecibidas(expenses: Expense[], from: string, to: string) {
  const rows: unknown[][] = [[
    "Fecha", "Nº factura", "Proveedor", "NIF / NIF-IVA", "País", "Base imponible (EUR)", "Tipo IVA %", "Cuota IVA soportada (EUR)",
    "Cuota autoliquidada ISP (EUR)", "Total (EUR)", "Deducible IVA", "Gasto deducible IRPF", "Tipo de operación", "Categoría", "Moneda original", "Importe original", "Archivo",
  ]];
  for (const e of expenses.filter((x) => x.issue_date >= from && x.issue_date <= to).sort((a, b) => a.issue_date.localeCompare(b.issue_date))) {
    const isp = e.treatment === "eu_isp" || e.treatment === "non_eu_isp";
    rows.push([
      esDate(e.issue_date), e.invoice_number ?? "", e.supplier, e.supplier_tax_id ?? "", e.supplier_country ?? "",
      esNum(e.net), esNum(e.treatment === "sin_iva" ? 0 : num(e.iva_rate)), esNum(e.treatment === "es_iva" ? e.iva : 0),
      esNum(isp ? ispQuota(e) : 0), esNum(e.total), e.treatment === "es_iva" ? (e.iva_deductible ? "Sí" : "No") : isp ? "Sí" : "–",
      e.irpf_deductible ? "Sí" : "No", OP_RECIBIDA[e.treatment], CATEGORY_LABELS[e.category] ?? e.category, e.currency,
      e.amount_original != null ? esNum(e.amount_original) : "", e.file_path ? e.file_path.split("/").pop() : "",
    ]);
  }
  return csv(rows);
}

export function resumenCsv(qq: Quarter, r303: Result303, r130: Result130, r349: Row349[]) {
  const rows: unknown[][] = [[`Resumen ${quarterLabel(qq)} – valores preparados, revisar por la gestoría`], [], ["Modelo 303", "Casilla", "Concepto", "Importe (EUR)"]];
  for (const r of r303.rows) rows.push(["303", r.c, r.label, esNum(r.value)]);
  rows.push([], ["Modelo 130", "Casilla", "Concepto", "Importe (EUR)"]);
  for (const r of r130.rows) rows.push(["130", r.c, r.label, esNum(r.value)]);
  rows.push([], ["Modelo 349", "Clave", "NIF-IVA", "Nombre", "País", "Base (EUR)"]);
  for (const r of r349) rows.push(["349", r.clave, r.nif, r.name, r.country, esNum(r.base)]);
  return csv(rows);
}
