// Belege & Ausgaben – Datenzugriff
import { supabase, supabaseUrl } from "../../lib/supabase";
import type { Expense, ExpenseInput, ExpensePeriod, OrderOption } from "./types";

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

/** KI-Belegerkennung (Funktion receipt-ai) */
export async function recognize(path: string): Promise<Partial<ExpenseInput>> {
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
