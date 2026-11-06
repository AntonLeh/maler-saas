// Steuerberater-Paket: ZIP mit Rechnungsausgangsbuch, Belegliste, Umsatzsteuer-Übersicht, allen PDFs/Belegdateien
// und (Deutschland) der DATEV-Datei. Alles wird im Browser zusammengestellt – nichts verlässt das Konto außer dem Download.
import { zipSync, strToU8 } from "fflate";
import jsPDF from "jspdf";
import autoTable from "jspdf-autotable";
import { supabase } from "../../lib/supabase";
import { loadInvoicePdfSources } from "../../lib/invoiceSources";
import { CATEGORY_LABELS, PAYMENT_LABELS } from "./types";
import type { Country, Expense, ExpenseCategory, PaymentMethod } from "./types";
import { computeVat } from "./vat";
import type { TaxMethod } from "./vat";
import { buildCsv, buildRows, encodeCp1252 } from "./datev";
import type { DatevSettings } from "./datev";

/* eslint-disable @typescript-eslint/no-explicit-any */

const num = (n: unknown) => (Math.round((Number(n) || 0) * 100) / 100).toFixed(2).replace(".", ",");
const deDate = (iso: unknown) => (iso ? `${String(iso).slice(8, 10)}.${String(iso).slice(5, 7)}.${String(iso).slice(0, 4)}` : "");
const cell = (v: unknown) => {
  const t = String(v ?? "");
  return /[;"\r\n]/.test(t) ? `"${t.replace(/"/g, '""')}"` : t;
};
const csv = (rows: unknown[][]) => "﻿" + rows.map((r) => r.map(cell).join(";")).join("\r\n") + "\r\n";
export const safeName = (v: string) =>
  String(v ?? "")
    .normalize("NFKD")
    .replace(/[̀-ͯ]/g, "")
    .replace(/ß/g, "ss")
    .replace(/[^a-zA-Z0-9._-]+/g, "_")
    .replace(/_+/g, "_")
    .replace(/^_|_$/g, "")
    .slice(0, 60) || "Datei";

export type PackageOptions = {
  tenantId: number;
  from: string;
  to: string;
  label: string;
  country: Country;
  method: TaxMethod;
  datev: DatevSettings | null;
  currencySymbol: string;
  onProgress?: (msg: string) => void;
};

export async function loadAllInvoices(tenantId: number): Promise<any[]> {
  const { data, error } = await supabase.from("invoices").select("*").eq("tenant_id", tenantId).order("invoice_date", { ascending: true }).limit(20000);
  if (error) throw new Error(error.message || "Rechnungen konnten nicht geladen werden.");
  return data ?? [];
}

export async function loadCustomers(tenantId: number): Promise<Map<number, string>> {
  const { data } = await supabase.from("customers").select("id, company_name, first_name, last_name").eq("tenant_id", tenantId).limit(10000);
  const m = new Map<number, string>();
  for (const c of (data ?? []) as any[]) m.set(Number(c.id), (c.company_name || "").trim() || `${c.first_name ?? ""} ${c.last_name ?? ""}`.trim() || `Kunde #${c.id}`);
  return m;
}

export async function loadExpensesRange(tenantId: number, from: string, to: string): Promise<Expense[]> {
  const { data, error } = await supabase
    .from("expenses")
    .select("*")
    .eq("tenant_id", tenantId)
    .gte("receipt_date", from)
    .lte("receipt_date", to)
    .order("receipt_date", { ascending: true })
    .order("id", { ascending: true });
  if (error) throw new Error(error.message || "Belege konnten nicht geladen werden.");
  return (data ?? []) as Expense[];
}

const customerName = (inv: any, names: Map<number, string>) => {
  const snap = inv?.snapshot?.customer;
  if (snap) return (snap.company_name || "").trim() || `${snap.first_name ?? ""} ${snap.last_name ?? ""}`.trim();
  return names.get(Number(inv.customer_id)) ?? "";
};

export const receiptFileName = (e: Expense) => {
  const ext = (e.file_path ?? "").split(".").pop() || "pdf";
  return `${e.receipt_date}_B${e.id}_${safeName(e.supplier)}.${ext}`;
};

/** DATEV-Datei (Windows-1252) für einen Zeitraum */
export function datevFile(invoices: any[], names: Map<number, string>, expenses: Expense[], from: string, to: string, s: DatevSettings): Uint8Array {
  const rows = buildRows(
    invoices.map((i) => ({ ...i, customer_name: customerName(i, names) })),
    expenses as any,
    from,
    to,
    s
  );
  return encodeCp1252(buildCsv(rows, from, to, s));
}

function vatPdf(result: ReturnType<typeof computeVat>, o: PackageOptions, company: string): Uint8Array {
  const doc = new jsPDF("p", "mm", "a4");
  const money = (n: number) => `${num(n)} ${o.currencySymbol}`;
  doc.setFontSize(16);
  doc.text(`Umsatzsteuer-Übersicht ${o.label}`, 14, 20);
  doc.setFontSize(10);
  doc.text(`${company} · ${o.method === "ist" ? "Ist-Versteuerung (nach Zahlungseingang)" : "Soll-Versteuerung (nach Rechnungsdatum)"}`, 14, 27);
  doc.text(`Zeitraum ${deDate(o.from)} – ${deDate(o.to)} · erstellt am ${new Date().toLocaleDateString("de-DE")} mit MalerSaaS`, 14, 32);
  autoTable(doc, {
    startY: 40,
    head: [["Umsatzsteuer aus Rechnungen", "Anzahl", "Netto", "Steuer"]],
    body: [
      ...result.sales.map((l) => [l.label, String(l.count), money(l.net), money(l.tax)]),
      ...(result.reverseChargeNet ? [["§ 13b (Steuer schuldet Kunde)", "", money(result.reverseChargeNet), "–"]] : []),
      ["Summe", "", money(result.salesNet + result.reverseChargeNet), money(result.salesTax)],
    ],
    styles: { fontSize: 9 },
  });
  autoTable(doc, {
    startY: (doc as any).lastAutoTable.finalY + 8,
    head: [["Vorsteuer aus Belegen", "Anzahl", "Netto", "Vorsteuer"]],
    body: [
      ...result.inputs.map((l) => [l.label, String(l.count), money(l.net), money(l.tax)]),
      ["Summe", "", money(result.inputNet), money(result.inputTax)],
      ...(result.foreignTax ? [["Nicht abgezogen: ausländische USt", "", "", money(result.foreignTax)]] : []),
    ],
    styles: { fontSize: 9 },
  });
  let y = (doc as any).lastAutoTable.finalY + 10;
  doc.setFontSize(12);
  doc.text(`${result.balance >= 0 ? "Zahllast" : "Erstattung"}: ${money(Math.abs(result.balance))}`, 14, y);
  if (result.elster) {
    autoTable(doc, {
      startY: y + 6,
      head: [["Kz", "ELSTER (Umsatzsteuer-Voranmeldung)", "Wert"]],
      body: result.elster.map((e) => [e.kz, e.label, e.wholeEuro ? `${Math.trunc(e.value)} €` : money(e.value)]),
      styles: { fontSize: 9 },
    });
    y = (doc as any).lastAutoTable.finalY + 8;
  }
  doc.setFontSize(8);
  doc.text(
    doc.splitTextToSize("Erstellt aus den in MalerSaaS erfassten Rechnungen und Belegen. Bitte vor der Abgabe prüfen. Keine Steuerberatung.", 180),
    14,
    y + 4
  );
  return new Uint8Array(doc.output("arraybuffer"));
}

export async function buildPackage(o: PackageOptions): Promise<{ blob: Blob; warnings: string[] }> {
  const say = o.onProgress ?? (() => {});
  const warnings: string[] = [];
  say("Rechnungen und Belege werden geladen …");
  const [invoices, names, expenses, cs] = await Promise.all([
    loadAllInvoices(o.tenantId),
    loadCustomers(o.tenantId),
    loadExpensesRange(o.tenantId, o.from, o.to),
    supabase.from("company_settings").select("company_name").eq("tenant_id", o.tenantId).maybeSingle(),
  ]);
  const company = (cs.data as any)?.company_name || "Unternehmen";
  const inPeriod = invoices.filter((i) => String(i.invoice_date).slice(0, 10) >= o.from && String(i.invoice_date).slice(0, 10) <= o.to);
  const byId = new Map(invoices.map((i) => [i.id, i]));
  const files: Record<string, Uint8Array | [Uint8Array, { level: 0 }]> = {};
  const p = safeName(`${company}_${o.label}`);

  // ---------- Rechnungsausgangsbuch ----------
  const kind = (i: any) => (i.document_type === "cancellation" ? "Stornorechnung" : i.invoice_type === "partial" ? "Abschlagsrechnung" : "Rechnung");
  const status = (i: any) =>
    i.document_type === "cancellation" ? "Storno" : i.status === "paid" ? "bezahlt" : i.status === "cancelled" ? "storniert" : i.status === "credited" ? "in Schlussrechnung verrechnet" : "offen";
  files[`${p}/Rechnungsausgangsbuch.csv`] = strToU8(
    csv([
      ["Rechnungsnummer", "Art", "Rechnungsdatum", "Leistung von", "Leistung bis", "Kunde", "Netto", "USt-Satz", "USt", "Brutto", "§ 13b", "Lohnanteil § 35a", "Status", "Bezahlt am", "Bezug", "PDF-Datei"],
      ...inPeriod.map((i) => [
        i.invoice_number,
        kind(i),
        deDate(i.invoice_date),
        deDate(i.service_period_start),
        deDate(i.service_period_end),
        customerName(i, names),
        num(i.subtotal),
        num(i.tax_rate),
        num(i.tax_amount),
        num(i.total_amount),
        i.reverse_charge ? "ja" : "",
        i.labor_amount != null ? num(i.labor_amount) : "",
        status(i),
        deDate(i.paid_at),
        i.cancels_invoice_id ? `Storno zu ${byId.get(i.cancels_invoice_id)?.invoice_number ?? ""}` : i.cancelled_by_invoice_id ? `storniert durch ${byId.get(i.cancelled_by_invoice_id)?.invoice_number ?? ""}` : "",
        `Rechnungen/${safeName(i.invoice_number)}.pdf`,
      ]),
    ])
  );

  // ---------- Belegliste ----------
  const orderTitle = new Map<number, string>();
  {
    const ids = [...new Set(expenses.map((e) => e.order_id).filter(Boolean))] as number[];
    if (ids.length) {
      const { data } = await supabase.from("orders").select("id, title").in("id", ids);
      for (const r of (data ?? []) as any[]) orderTitle.set(Number(r.id), r.title || `Auftrag #${r.id}`);
    }
  }
  files[`${p}/Belege.csv`] = strToU8(
    csv([
      ["Beleg-Nr.", "Belegdatum", "Lieferant", "Beschreibung", "Kategorie", "Netto", "Steuersatz", "Steuer", "Brutto", "Originalwährung", "Originalbetrag", "Kurs", "Bezahlt", "Zahlungsart", "Auftrag", "Ungültig", "Grund", "Datei"],
      ...expenses.map((e) => [
        `B${e.id}`,
        deDate(e.receipt_date),
        e.supplier,
        e.description ?? "",
        CATEGORY_LABELS[e.category as ExpenseCategory] ?? e.category,
        num(e.net_amount),
        e.tax_rate === null ? "gemischt" : num(e.tax_rate),
        num(e.tax_amount),
        num(e.gross_amount),
        e.original_currency ?? "",
        e.original_amount != null ? num(e.original_amount) : "",
        e.exchange_rate != null ? String(e.exchange_rate).replace(".", ",") : "",
        e.paid ? "ja" : "nein",
        e.payment_method ? PAYMENT_LABELS[e.payment_method as PaymentMethod] : "",
        e.order_id ? orderTitle.get(Number(e.order_id)) ?? `#${e.order_id}` : "",
        e.voided ? "ja" : "",
        e.void_reason ?? "",
        e.file_path ? `Belege/${receiptFileName(e)}` : "",
      ]),
    ])
  );

  // ---------- Umsatzsteuer ----------
  const vat = computeVat(invoices, expenses as any, o.from, o.to, o.method, o.country);
  files[`${p}/Umsatzsteuer-Uebersicht.pdf`] = [vatPdf(vat, o, company), { level: 0 }];

  // ---------- DATEV ----------
  if (o.datev) files[`${p}/DATEV/EXTF_Buchungsstapel_${o.from}_${o.to}.csv`] = datevFile(invoices, names, expenses, o.from, o.to, o.datev);

  // ---------- Rechnungs-PDFs ----------
  let n = 0;
  for (const inv of inPeriod) {
    n++;
    say(`Rechnungs-PDFs werden erstellt (${n}/${inPeriod.length}) …`);
    try {
      const sources = await loadInvoicePdfSources(inv, o.tenantId);
      const { buildInvoicePdf } = await import("../../lib/einvoiceFiles");
      const { blob } = await buildInvoicePdf(inv, sources);
      files[`${p}/Rechnungen/${safeName(inv.invoice_number)}.pdf`] = [new Uint8Array(await blob.arrayBuffer()), { level: 0 }];
    } catch (e) {
      console.error("PDF", inv.invoice_number, e);
      warnings.push(`PDF für ${inv.invoice_number} konnte nicht erstellt werden.`);
    }
  }

  // ---------- Beleg-Dateien ----------
  const withFile = expenses.filter((e) => e.file_path);
  n = 0;
  for (const e of withFile) {
    n++;
    say(`Belegdateien werden geladen (${n}/${withFile.length}) …`);
    const { data, error } = await supabase.storage.from("receipts").download(e.file_path!);
    if (error || !data) {
      warnings.push(`Belegdatei zu B${e.id} (${e.supplier}) konnte nicht geladen werden.`);
      continue;
    }
    files[`${p}/Belege/${receiptFileName(e)}`] = [new Uint8Array(await data.arrayBuffer()), { level: 0 }];
  }

  files[`${p}/LIESMICH.txt`] = strToU8(
    [
      `Steuerberater-Paket ${o.label} – ${company}`,
      `Zeitraum: ${deDate(o.from)} bis ${deDate(o.to)}`,
      `Erstellt am ${new Date().toLocaleString("de-DE")} mit MalerSaaS (maler-saas.com)`,
      "",
      "Inhalt:",
      "- Rechnungsausgangsbuch.csv: alle Ausgangsrechnungen, Abschlags- und Stornorechnungen des Zeitraums (Spalte „PDF-Datei“ verweist auf den Ordner Rechnungen).",
      "- Belege.csv: alle Eingangsbelege (Beleg-Nr. B… entspricht dem Dateinamen im Ordner Belege). Ungültige Belege sind markiert und zählen nicht.",
      "- Umsatzsteuer-Uebersicht.pdf: Umsatzsteuer, Vorsteuer, Zahllast" + (o.country === "DE" ? " und ELSTER-Kennzahlen." : "."),
      ...(o.datev ? ["- DATEV/EXTF_Buchungsstapel_….csv: Buchungsstapel im DATEV-Format (Import in DATEV Rechnungswesen). Kontenzuordnung bitte prüfen."] : []),
      "",
      "CSV-Dateien: Trennzeichen Semikolon, Dezimalkomma, UTF-8 (öffnen z. B. mit Excel). Beträge in der Währung des Unternehmens.",
      "Ausländische Umsatzsteuer auf Belegen ist nicht als Vorsteuer gezählt.",
      ...(warnings.length ? ["", "Hinweise:", ...warnings.map((w) => `- ${w}`)] : []),
    ].join("\r\n")
  );

  say("ZIP-Datei wird erstellt …");
  const zipped = zipSync(files as any, { level: 6 });
  return { blob: new Blob([zipped as BlobPart], { type: "application/zip" }), warnings };
}

export function downloadBlob(blob: Blob, name: string) {
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = name;
  document.body.appendChild(a);
  a.click();
  a.remove();
  window.setTimeout(() => URL.revokeObjectURL(url), 10_000);
}
