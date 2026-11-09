// Owner-Buchhaltung: Datenbank und Edge Function owner-books
import { zipSync, strToU8 } from "fflate";
import { supabase } from "../../lib/supabase";
import * as L from "./logic";
import type { Expense, Income, Period, Settings } from "./logic";

const BUCKET = "owner-receipts";

const friendly = (err: unknown, fallback: string) => {
  const msg = String((err as { message?: string })?.message ?? err ?? "");
  if (/owner_income|owner_expenses|owner_book_settings|does not exist|schema cache/i.test(msg))
    return "Für die Buchhaltung fehlt noch das Datenbank-Update (SQL „Owner-Buchhaltung“).";
  if (/Failed to send|FunctionsFetchError|not found/i.test(msg) && /function/i.test(msg))
    return "Die Funktion „owner-books“ ist noch nicht hochgeladen.";
  if (/failed to fetch|network/i.test(msg)) return "Keine Internetverbindung.";
  return fallback;
};

export async function loadAll(): Promise<{ settings: Settings; income: Income[]; expenses: Expense[] }> {
  const [s, i, e] = await Promise.all([
    supabase.from("owner_book_settings").select("*").eq("id", 1).maybeSingle(),
    supabase.from("owner_income").select("*").order("issue_date", { ascending: false }).limit(5000),
    supabase.from("owner_expenses").select("*").order("issue_date", { ascending: false }).limit(5000),
  ]);
  const err = s.error || i.error || e.error;
  if (err) throw new Error(friendly(err, "Buchhaltung konnte nicht geladen werden."));
  const settings: Settings = {
    nif: null,
    full_name: null,
    address: null,
    difficult_pct: 5,
    difficult_cap: 2000,
    minoracion: 100,
    books_start: "2026-11-03",
    last_sync_at: null,
    ...(s.data || {}),
  };
  const n = (v: unknown) => Number(v ?? 0);
  return {
    settings: { ...settings, difficult_pct: n(settings.difficult_pct), difficult_cap: n(settings.difficult_cap), minoracion: n(settings.minoracion) },
    income: ((i.data as Income[]) || []).map((x) => ({ ...x, net: n(x.net), tax: n(x.tax), total: n(x.total), net_eur: n(x.net_eur), tax_eur: n(x.tax_eur), total_eur: n(x.total_eur), tax_rate: x.tax_rate == null ? null : n(x.tax_rate), retencion: n(x.retencion) })),
    expenses: ((e.data as Expense[]) || []).map((x) => ({ ...x, net: n(x.net), iva: n(x.iva), iva_rate: n(x.iva_rate), total: n(x.total), amount_original: x.amount_original == null ? null : n(x.amount_original) })),
  };
}

async function callFn<T>(body: Record<string, unknown>, fallback: string): Promise<T> {
  const { data, error } = await supabase.functions.invoke("owner-books", { body });
  if (error) {
    let msg = "";
    try {
      const ctx = (error as { context?: Response }).context;
      if (ctx && typeof ctx.json === "function") msg = (await ctx.json())?.error ?? "";
    } catch {
      /* leer */
    }
    throw new Error(msg || friendly(error, fallback));
  }
  if (!data?.ok) throw new Error(data?.error || fallback);
  return data as T;
}

export const syncStripe = () => callFn<{ count: number; warnings: string[] }>({ action: "sync" }, "Der Abgleich mit Stripe hat nicht geklappt.");

export const rateToEur = (from: string, date: string) =>
  callFn<{ rate: number; date: string }>({ action: "rate", from, date }, "Kein Umrechnungskurs gefunden.");

export async function uploadReceipt(file: File): Promise<string> {
  const ext = (file.name.split(".").pop() || "pdf").toLowerCase().replace(/[^a-z0-9]/g, "") || "pdf";
  const path = `${new Date().getFullYear()}/${Date.now()}-${Math.random().toString(36).slice(2, 8)}.${ext}`;
  const { error } = await supabase.storage.from(BUCKET).upload(path, file, { contentType: file.type || undefined, upsert: false });
  if (error) throw new Error(friendly(error, "Der Beleg konnte nicht hochgeladen werden."));
  return path;
}

export type ScanResult = {
  issue_date: string | null;
  supplier: string;
  supplier_country: string | null;
  supplier_tax_id: string | null;
  invoice_number: string | null;
  currency: string;
  net_amount: number | null;
  tax_rate: number | null;
  tax_amount: number | null;
  gross_amount: number | null;
  treatment: L.ExpenseTreatment | null;
  category: string;
  note: string | null;
};

export const scanReceipt = (filePath: string) =>
  callFn<{ data: ScanResult }>({ action: "scan", file_path: filePath }, "Der Beleg konnte nicht gelesen werden.").then((r) => r.data);

export async function receiptUrl(path: string) {
  const { data, error } = await supabase.storage.from(BUCKET).createSignedUrl(path, 600);
  if (error || !data?.signedUrl) throw new Error("Beleg konnte nicht geöffnet werden.");
  return data.signedUrl;
}

export type ExpenseInput = Omit<Expense, "id">;

export async function saveExpense(id: number | null, input: ExpenseInput) {
  const payload = { ...input, updated_at: new Date().toISOString() };
  const res = id ? await supabase.from("owner_expenses").update(payload).eq("id", id) : await supabase.from("owner_expenses").insert(payload);
  if (res.error) throw new Error(friendly(res.error, "Die Ausgabe konnte nicht gespeichert werden."));
}

export async function deleteExpense(e: Expense) {
  const { error } = await supabase.from("owner_expenses").delete().eq("id", e.id);
  if (error) throw new Error(friendly(error, "Die Ausgabe konnte nicht gelöscht werden."));
  if (e.file_path) await supabase.storage.from(BUCKET).remove([e.file_path]);
}

export async function updateIncome(id: number, patch: Partial<Pick<Income, "treatment" | "retencion">>) {
  const extra = patch.treatment ? { treatment_locked: true } : {};
  const { error } = await supabase.from("owner_income").update({ ...patch, ...extra, updated_at: new Date().toISOString() }).eq("id", id);
  if (error) throw new Error(friendly(error, "Änderung konnte nicht gespeichert werden."));
}

export async function saveSettings(s: Partial<Settings>) {
  const { error } = await supabase.from("owner_book_settings").update({ ...s, updated_at: new Date().toISOString() }).eq("id", 1);
  if (error) throw new Error(friendly(error, "Einstellungen konnten nicht gespeichert werden."));
}

export function download(name: string, content: BlobPart, type = "text/csv;charset=utf-8") {
  const url = URL.createObjectURL(new Blob([content], { type }));
  const a = document.createElement("a");
  a.href = url;
  a.download = name;
  a.click();
  setTimeout(() => URL.revokeObjectURL(url), 3000);
}

/** ZIP für die Gestoría: Libros registro und alle Belege des Zeitraums (Monat oder Quartal; beim Quartal mit Resumen 303/130/349) */
export async function gestoriaZip(income: Income[], expenses: Expense[], period: Period, s: Settings) {
  const { from, to, tag } = period;
  const files: Record<string, Uint8Array> = {
    [`libro_facturas_emitidas_${tag}.csv`]: strToU8(L.libroEmitidas(income, from, to)),
    [`libro_facturas_recibidas_${tag}.csv`]: strToU8(L.libroRecibidas(expenses, from, to)),
  };
  const qq = period.quarter;
  if (qq) {
    files[`resumen_303_130_349_${tag}.csv`] = strToU8(
      L.resumenCsv(qq, L.modelo303(income, expenses, qq, s.books_start), L.modelo130(income, expenses, qq, s), L.modelo349(income, expenses, qq))
    );
  }
  const missing: string[] = [];
  for (const e of expenses.filter((x) => x.issue_date >= from && x.issue_date <= to)) {
    if (!e.file_path) {
      missing.push(`${e.issue_date} ${e.supplier}`);
      continue;
    }
    const { data } = await supabase.storage.from(BUCKET).download(e.file_path);
    if (!data) {
      missing.push(`${e.issue_date} ${e.supplier}`);
      continue;
    }
    const safe = `${e.issue_date}_${e.supplier}`.replace(/[^\w.-]+/g, "_").slice(0, 60);
    files[`facturas_recibidas/${safe}_${e.id}.${e.file_path.split(".").pop()}`] = new Uint8Array(await data.arrayBuffer());
  }
  const links = income
    .filter((i) => i.issue_date >= from && i.issue_date <= to && i.invoice_pdf)
    .map((i) => `${i.number ?? i.stripe_id};${i.invoice_pdf}`)
    .join("\r\n");
  if (links) files[`facturas_emitidas_enlaces_stripe_${tag}.csv`] = strToU8("﻿Número;Enlace PDF\r\n" + links);
  const zipped = zipSync(files, { level: 6 });
  return { blob: new Blob([zipped as BlobPart], { type: "application/zip" }), name: `gestoria_${tag}.zip`, missing };
}
