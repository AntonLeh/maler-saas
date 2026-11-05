// Belege & Ausgaben – Datenzugriff
import { supabase, supabaseUrl } from "../../lib/supabase";
import type { AiResult, Expense, ExpenseInput, ExpensePeriod, OrderOption } from "./types";
import type { TaxMethod, VatExpense, VatInvoice } from "./vat";

const BUCKET = "receipts";
const fail = (e: { message?: string } | null, fallback: string) => {
  if (!e) return;
  const msg = String(e.message ?? "");
  if (/relation .*expenses.* does not exist|schema cache/i.test(msg)) throw new Error("Für „Belege & Ausgaben“ fehlt noch ein Datenbank-Update (20261105170000_belege.sql).");
  throw new Error(msg || fallback);
};

export async function loadExpenses(tenantId: number, from: string, to: string): Promise<Expense[]> {
  const { data, error } = await supabase
    .from("expenses")
    .select("*")
    .eq("tenant_id", tenantId)
    .gte("receipt_date", from)
    .lte("receipt_date", to)
    .order("receipt_date", { ascending: false })
    .order("id", { ascending: false });
  fail(error, "Belege konnten nicht geladen werden.");
  return (data ?? []) as Expense[];
}

export async function loadPeriods(tenantId: number): Promise<ExpensePeriod[]> {
  const { data, error } = await supabase.from("expense_periods").select("period_year, period_month, locked_at").eq("tenant_id", tenantId);
  fail(error, "Abgeschlossene Monate konnten nicht geladen werden.");
  return (data ?? []) as ExpensePeriod[];
}

export async function loadOrders(tenantId: number): Promise<OrderOption[]> {
  const { data } = await supabase.from("orders").select("id, title").eq("tenant_id", tenantId).order("created_at", { ascending: false }).limit(300);
  return ((data ?? []) as { id: number; title: string | null }[]).map((o) => ({ id: Number(o.id), title: o.title || `Auftrag #${o.id}` }));
}

export async function createExpense(tenantId: number, values: ExpenseInput & { file_path: string | null; file_name: string | null; file_type: string | null; ai_extracted: boolean }) {
  const { error } = await supabase.from("expenses").insert([{ tenant_id: tenantId, ...values }]);
  fail(error, "Beleg konnte nicht gespeichert werden.");
}

/** Mögliche Doppelerfassung: gleicher Tag + gleicher Betrag (+ ähnlicher Lieferant), nicht ungültig */
export async function findDuplicates(tenantId: number, date: string, gross: number, supplier: string, excludeId?: number): Promise<Expense[]> {
  const { data, error } = await supabase
    .from("expenses")
    .select("*")
    .eq("tenant_id", tenantId)
    .eq("receipt_date", date)
    .eq("voided", false)
    .gte("gross_amount", Math.round((gross - 0.01) * 100) / 100)
    .lte("gross_amount", Math.round((gross + 0.01) * 100) / 100);
  if (error) {
    console.error("Doppel-Prüfung", error);
    throw new Error(error.message || "Prüfung fehlgeschlagen");
  }
  const norm = (v: string) => v.toLowerCase().replace(/[^a-z0-9äöüß]/g, "");
  const key = norm(supplier).slice(0, 5);
  return ((data ?? []) as Expense[]).filter((e) => e.id !== excludeId && (!key || norm(e.supplier).includes(key) || key.includes(norm(e.supplier).slice(0, 5))));
}

export async function updateExpense(id: number, values: Partial<ExpenseInput>) {
  const { error } = await supabase.from("expenses").update(values).eq("id", id);
  fail(error, "Beleg konnte nicht geändert werden.");
}

export async function voidExpense(id: number, reason: string) {
  const { error } = await supabase.from("expenses").update({ voided: true, void_reason: reason || null }).eq("id", id);
  fail(error, "Beleg konnte nicht als ungültig markiert werden.");
}

export async function lockMonth(year: number, month: number): Promise<number> {
  const { data, error } = await supabase.rpc("lock_expense_month", { p_year: year, p_month: month });
  fail(error, "Monat konnte nicht abgeschlossen werden.");
  return Number(data ?? 0);
}

/** Bilder vor dem Hochladen verkleinern (max. 2000 px, JPEG) – spart Speicher und macht die KI-Erkennung schneller */
async function shrinkImage(file: File): Promise<Blob> {
  const bitmap = await createImageBitmap(file);
  const scale = Math.min(1, 2000 / Math.max(bitmap.width, bitmap.height));
  const canvas = document.createElement("canvas");
  canvas.width = Math.round(bitmap.width * scale);
  canvas.height = Math.round(bitmap.height * scale);
  canvas.getContext("2d")!.drawImage(bitmap, 0, 0, canvas.width, canvas.height);
  bitmap.close();
  return await new Promise<Blob>((resolve, reject) => canvas.toBlob((b) => (b ? resolve(b) : reject(new Error("Bild konnte nicht verarbeitet werden."))), "image/jpeg", 0.85));
}

/** Datei in den privaten Speicher laden. Rückgabe: Pfad, Name, Typ */
export async function uploadReceipt(tenantId: number, file: File): Promise<{ path: string; name: string; type: string }> {
  const isPdf = file.type === "application/pdf" || /\.pdf$/i.test(file.name);
  let body: Blob = file;
  let type = isPdf ? "application/pdf" : "image/jpeg";
  if (!isPdf) {
    if (!file.type.startsWith("image/")) throw new Error("Bitte ein Foto (JPG, PNG) oder ein PDF wählen.");
    try {
      body = await shrinkImage(file);
    } catch {
      if (!["image/jpeg", "image/png", "image/webp"].includes(file.type)) {
        throw new Error("Dieses Bildformat wird nicht unterstützt (z. B. HEIC). Bitte als JPG speichern oder ein Foto direkt mit der Kamera aufnehmen.");
      }
      body = file;
      type = file.type;
    }
  }
  if (body.size > 10 * 1024 * 1024) throw new Error("Die Datei ist zu groß (höchstens 10 MB).");
  const ext = type === "application/pdf" ? "pdf" : type === "image/png" ? "png" : type === "image/webp" ? "webp" : "jpg";
  const path = `${tenantId}/${new Date().getFullYear()}/${crypto.randomUUID()}.${ext}`;
  const { error } = await supabase.storage.from(BUCKET).upload(path, body, { contentType: type, upsert: false });
  if (error) {
    if (/bucket not found/i.test(error.message)) throw new Error("Für „Belege & Ausgaben“ fehlt noch ein Datenbank-Update (Speicher „receipts“).");
    throw new Error(error.message || "Datei konnte nicht hochgeladen werden.");
  }
  return { path, name: file.name.slice(0, 200), type };
}

export async function receiptUrl(path: string): Promise<string> {
  const { data, error } = await supabase.storage.from(BUCKET).createSignedUrl(path, 300);
  if (error || !data?.signedUrl) throw new Error("Beleg konnte nicht geöffnet werden.");
  return data.signedUrl;
}

async function callReceiptAi(body: Record<string, unknown>) {
  const { data: sessionData } = await supabase.auth.getSession();
  const token = sessionData.session?.access_token;
  if (!token) throw new Error("Bitte erneut anmelden.");
  let res: Response;
  try {
    res = await fetch(`${supabaseUrl}/functions/v1/receipt-ai`, {
      method: "POST",
      headers: { authorization: `Bearer ${token}`, "content-type": "application/json" },
      body: JSON.stringify(body),
    });
  } catch {
    throw new Error("Die Funktion receipt-ai ist nicht erreichbar. Ist sie veröffentlicht?");
  }
  const data = await res.json().catch(() => ({}));
  if (!res.ok || !data.ok) throw new Error(data.error || `Fehler (Status ${res.status}).`);
  return data;
}

/** EZB-Referenzkurs: 1 Einheit „from“ = rate Einheiten „to“ (letzter Kurs bis zum Datum) */
export async function exchangeRate(from: string, to: string, date: string): Promise<{ rate: number; date: string }> {
  const data = await callReceiptAi({ action: "rate", from, to, date });
  return { rate: Number(data.rate), date: String(data.date) };
}

/** KI-Belegerkennung (Funktion receipt-ai) */
export async function recognize(path: string): Promise<AiResult> {
  const { data: sessionData } = await supabase.auth.getSession();
  const token = sessionData.session?.access_token;
  if (!token) throw new Error("Bitte erneut anmelden.");
  let res: Response;
  try {
    res = await fetch(`${supabaseUrl}/functions/v1/receipt-ai`, {
      method: "POST",
      headers: { authorization: `Bearer ${token}`, "content-type": "application/json" },
      body: JSON.stringify({ file_path: path }),
    });
  } catch {
    throw new Error("Die Belegerkennung ist nicht erreichbar. Ist die Funktion receipt-ai veröffentlicht?");
  }
  const data = await res.json().catch(() => ({}));
  if (!res.ok || !data.ok) throw new Error(data.error || `Belegerkennung fehlgeschlagen (Status ${res.status}).`);
  return data.data ?? {};
}

// ---------------------------------------------------------------------
// Umsatzsteuer-Übersicht
// ---------------------------------------------------------------------

export async function loadVatInvoices(tenantId: number): Promise<VatInvoice[]> {
  const { data, error } = await supabase
    .from("invoices")
    .select("id, invoice_number, invoice_date, paid_at, status, document_type, invoice_type, subtotal, tax_rate, tax_amount, total_amount, reverse_charge, cancels_invoice_id, customer_id")
    .eq("tenant_id", tenantId)
    .order("invoice_date", { ascending: true })
    .limit(20000);
  if (error) {
    // vor dem Rechnungs-Update gibt es manche Spalten noch nicht
    const { data: old, error: e2 } = await supabase
      .from("invoices")
      .select("id, invoice_number, invoice_date, paid_at, status, invoice_type, subtotal, tax_rate, tax_amount, total_amount, customer_id")
      .eq("tenant_id", tenantId)
      .limit(20000);
    fail(e2, "Rechnungen konnten nicht geladen werden.");
    return (old ?? []) as VatInvoice[];
  }
  return (data ?? []) as VatInvoice[];
}

export async function loadVatExpenses(tenantId: number, from: string, to: string): Promise<VatExpense[]> {
  const { data, error } = await supabase
    .from("expenses")
    .select("id, receipt_date, supplier, net_amount, tax_amount, gross_amount, tax_rate, voided")
    .eq("tenant_id", tenantId)
    .gte("receipt_date", from)
    .lte("receipt_date", to)
    .order("receipt_date", { ascending: true });
  fail(error, "Belege konnten nicht geladen werden.");
  return (data ?? []) as VatExpense[];
}

export async function loadTaxMethod(tenantId: number): Promise<TaxMethod> {
  const { data, error } = await supabase.from("company_settings").select("tax_method").eq("tenant_id", tenantId).maybeSingle();
  if (error) return "soll";
  return (data as { tax_method?: string } | null)?.tax_method === "ist" ? "ist" : "soll";
}

export async function saveTaxMethod(tenantId: number, method: TaxMethod) {
  const { error } = await supabase.from("company_settings").update({ tax_method: method }).eq("tenant_id", tenantId);
  if (error && /tax_method/.test(error.message)) throw new Error("Für die Versteuerungsart fehlt noch ein Datenbank-Update (20261105190000_umsatzsteuer.sql).");
  fail(error, "Einstellung konnte nicht gespeichert werden.");
}
