// „Alle Daten exportieren“ (AGB Punkt 21): eine ZIP-Datei mit allen Daten des Betriebs
//  - Rechnungen (PDF, neue als E-Rechnung), Belege (Originaldateien), Rechnungsausgangsbuch, Belegliste, Steuerübersicht
//    (wie das Steuerberater-Paket, über den gesamten Zeitraum)
//  - zusätzlich jede Tabelle als CSV-Datei (Kunden, Aufträge, Angebote, Zeiten, Website, …)
import { strToU8, unzipSync, zipSync } from "fflate";
import { supabase } from "../../lib/supabase";
import { buildPackage, downloadBlob, safeName } from "../belege/paket";
import type { Country } from "../belege/types";
import type { TaxMethod } from "../belege/vat";

/* eslint-disable @typescript-eslint/no-explicit-any */

/** Tabellen für den Export (nur, was der Betrieb sehen darf; fehlende/gesperrte werden übersprungen) */
export const EXPORT_TABLES: { table: string; label: string }[] = [
  { table: "customers", label: "Kunden" },
  { table: "orders", label: "Auftraege" },
  { table: "order_assignments", label: "Auftrag_Mitarbeiter" },
  { table: "order_progress", label: "Baufortschritt" },
  { table: "quotes", label: "Angebote" },
  { table: "quote_items", label: "Angebotspositionen" },
  { table: "additional_quote_positions", label: "Zusatzpositionen" },
  { table: "quote_pricing_rules", label: "Preisregeln" },
  { table: "invoices", label: "Rechnungen" },
  { table: "invoice_reminders", label: "Mahnungen" },
  { table: "document_emails", label: "E-Mail-Versand" },
  { table: "expenses", label: "Belege" },
  { table: "site_visits", label: "Besichtigungen" },
  { table: "site_visit_rooms", label: "Besichtigung_Raeume" },
  { table: "site_visit_windows", label: "Besichtigung_Fenster" },
  { table: "site_visit_doors", label: "Besichtigung_Tueren" },
  { table: "site_visit_radiators", label: "Besichtigung_Heizkoerper" },
  { table: "site_visit_custom_services", label: "Besichtigung_Leistungen" },
  { table: "appointments", label: "Termine" },
  { table: "time_entries", label: "Zeiterfassung" },
  { table: "materials", label: "Material" },
  { table: "material_stock_movements", label: "Material_Bewegungen" },
  { table: "messages", label: "Nachrichten" },
  { table: "app_users", label: "Mitarbeiter" },
  { table: "company_settings", label: "Firmeneinstellungen" },
  { table: "customer_reviews", label: "Kundenbewertungen" },
  { table: "websites", label: "Website" },
  { table: "website_references", label: "Website_Referenzen" },
  { table: "website_leads", label: "Website_Anfragen" },
  { table: "website_applications", label: "Bewerbungen" },
  { table: "ai_calls", label: "KI-Telefon_Anrufe" },
  { table: "ai_callback_requests", label: "KI-Telefon_Rueckrufe" },
];

const cell = (v: unknown) => {
  if (v === null || v === undefined) return "";
  const s = typeof v === "object" ? JSON.stringify(v) : String(v);
  return /[";\r\n]/.test(s) ? `"${s.replace(/"/g, '""')}"` : s;
};

export function rowsToCsv(rows: Record<string, unknown>[]): string {
  const cols: string[] = [];
  for (const r of rows) for (const k of Object.keys(r)) if (!cols.includes(k)) cols.push(k);
  return "﻿" + [cols.join(";"), ...rows.map((r) => cols.map((c) => cell(r[c])).join(";"))].join("\r\n") + "\r\n";
}

async function loadTable(table: string, tenantId: number): Promise<Record<string, unknown>[] | null> {
  const out: Record<string, unknown>[] = [];
  for (let from = 0; ; from += 1000) {
    const { data, error } = await supabase.from(table).select("*").eq("tenant_id", tenantId).range(from, from + 999);
    if (error) return out.length ? out : null;
    out.push(...((data ?? []) as Record<string, unknown>[]));
    if (!data || data.length < 1000) break;
  }
  // geheime Felder nicht exportieren
  return out.map((r) => {
    const c = { ...r };
    for (const k of Object.keys(c)) if (/token|secret|webhook_key|password|api_key/i.test(k)) delete c[k];
    return c;
  });
}

export async function exportAllData(o: {
  tenantId: number;
  country: Country;
  method: TaxMethod;
  currencySymbol: string;
  onProgress?: (msg: string) => void;
}): Promise<{ fileName: string; warnings: string[] }> {
  const say = o.onProgress ?? (() => {});
  const today = new Date().toISOString().slice(0, 10);
  const { blob, warnings } = await buildPackage({
    tenantId: o.tenantId,
    from: "1900-01-01",
    to: "2999-12-31",
    label: `Datenexport_${today}`,
    country: o.country,
    method: o.method,
    datev: null,
    currencySymbol: o.currencySymbol,
    onProgress: say,
  });
  const files = unzipSync(new Uint8Array(await blob.arrayBuffer()));
  const root = Object.keys(files)[0]?.split("/")[0] || safeName(`Datenexport_${today}`);
  const skipped: string[] = [];
  let i = 0;
  for (const t of EXPORT_TABLES) {
    i += 1;
    say(`Daten werden gesammelt (${i}/${EXPORT_TABLES.length}) …`);
    const rows = await loadTable(t.table, o.tenantId);
    if (rows === null) {
      skipped.push(t.label);
      continue;
    }
    if (rows.length) files[`${root}/Daten/${t.label}.csv`] = strToU8(rowsToCsv(rows));
  }
  files[`${root}/Daten/LIESMICH.txt`] = strToU8(
    [
      "Datenexport aus MalerSaaS",
      `Erstellt am ${today.split("-").reverse().join(".")}`,
      "",
      "Im Ordner „Daten“ liegt jede Tabelle als CSV-Datei (Trennzeichen Semikolon, UTF-8) – lässt sich mit Excel oder LibreOffice öffnen.",
      "Rechnungen (PDF), Belege (Originaldateien), Rechnungsausgangsbuch und Belegliste liegen im übergeordneten Ordner.",
      "Bitte beachten Sie Ihre gesetzlichen Aufbewahrungspflichten (in Deutschland i. d. R. 8 bzw. 10 Jahre für Rechnungen und Belege).",
      ...(skipped.length ? ["", `Nicht enthalten (keine Berechtigung oder nicht vorhanden): ${skipped.join(", ")}`] : []),
    ].join("\r\n")
  );
  say("ZIP-Datei wird erstellt …");
  const zip = zipSync(files, { level: 6 });
  const fileName = `${root}.zip`;
  downloadBlob(new Blob([zip as BlobPart], { type: "application/zip" }), fileName);
  return { fileName, warnings };
}
