// Stunden nachtragen, Fremdleistungen, Daten für Listen und Nachweise
import { supabase } from "../../lib/supabase";
import { toPay } from "../mitarbeiter-arten/logic";
import type { Pay } from "../mitarbeiter-arten/logic";
import type { Entry, ExternalCost, Person } from "./logic";

const NEEDS_SQL = "Dafür fehlt noch das Datenbank-Update (SQL „Stunden nachtragen“ bzw. „Fremdleistungen“).";
const missing = (m: string) => /time_entry_add_manual|time_entry_delete_manual|order_external_costs|entered_by|schema cache|does not exist|Could not find the function/i.test(m);
const clean = (m: string) => m.replace(/^.*?ERROR:\s*/i, "").trim();

export async function addManualEntry(v: { userId: number; orderId: number; start: Date; end: Date; breakMinutes: number; note: string }) {
  const { data, error } = await supabase.rpc("time_entry_add_manual", {
    p_user_id: v.userId,
    p_order_id: v.orderId,
    p_start: v.start.toISOString(),
    p_end: v.end.toISOString(),
    p_break_minutes: v.breakMinutes,
    p_note: v.note || null,
  });
  if (error) throw new Error(missing(error.message) ? NEEDS_SQL : clean(error.message));
  return data as number;
}

export async function deleteManualEntry(id: number) {
  const { error } = await supabase.rpc("time_entry_delete_manual", { p_id: id });
  if (error) throw new Error(missing(error.message) ? NEEDS_SQL : clean(error.message));
}

export async function loadEntries(tenantId: number, filter: { from?: string; to?: string; orderId?: number; userId?: number; includeOpen?: boolean } = {}): Promise<Entry[]> {
  let q = supabase.from("time_entries").select("*").eq("tenant_id", tenantId);
  if (!filter.includeOpen) q = q.not("ended_at", "is", null);
  if (filter.from) q = q.gte("started_at", `${filter.from}T00:00:00`);
  if (filter.to) q = q.lte("started_at", `${filter.to}T23:59:59`);
  if (filter.orderId) q = q.eq("order_id", filter.orderId);
  if (filter.userId) q = q.eq("user_id", filter.userId);
  const { data, error } = await q.order("started_at").limit(10000);
  if (error) throw new Error(`Die Stunden konnten nicht geladen werden: ${error.message}`);
  return (data ?? []) as Entry[];
}

export async function loadPeople(tenantId: number): Promise<Person[]> {
  const { data, error } = await supabase.from("app_users").select("*").eq("tenant_id", tenantId);
  if (error) throw new Error("Die Mitarbeiter konnten nicht geladen werden.");
  return (data ?? []) as Person[];
}

/** Vergütungsdaten (nur Admin); ohne Datenbank-Update leer */
export async function loadPays(tenantId: number): Promise<Map<number, Pay>> {
  const { data, error } = await supabase.from("employee_pay").select("*").eq("tenant_id", tenantId);
  const m = new Map<number, Pay>();
  if (error) return m;
  for (const r of data ?? []) m.set(Number(r.user_id), toPay(r));
  return m;
}

export async function loadOrders(tenantId: number): Promise<{ id: number; title: string; city: string | null; status: string; planned_hours: number | null }[]> {
  let res: { data: Record<string, unknown>[] | null; error: unknown } = await supabase.from("orders").select("id, title, address_city, status, planned_hours").eq("tenant_id", tenantId).order("id", { ascending: false });
  // ohne Datenbank-Update (Planstunden) ohne die Spalte laden
  if (res.error) res = await supabase.from("orders").select("id, title, address_city, status").eq("tenant_id", tenantId).order("id", { ascending: false });
  if (res.error) return [];
  return (res.data ?? []).map((o) => ({
    id: Number(o.id),
    title: String(o.title ?? `Auftrag ${o.id}`),
    city: (o.address_city as string) ?? null,
    status: String(o.status ?? ""),
    planned_hours: o.planned_hours != null ? Number(o.planned_hours) : null,
  }));
}

// ---------- Fremdleistungen ----------
export async function loadExternalCosts(tenantId: number | null, filter: { orderId?: number; from?: string; to?: string } = {}): Promise<ExternalCost[]> {
  let q = supabase.from("order_external_costs").select("*");
  if (tenantId) q = q.eq("tenant_id", tenantId);
  if (filter.orderId) q = q.eq("order_id", filter.orderId);
  if (filter.from) q = q.gte("invoice_date", filter.from);
  if (filter.to) q = q.lte("invoice_date", filter.to);
  const { data, error } = await q.order("invoice_date", { ascending: false });
  if (error) return [];
  return (data ?? []) as ExternalCost[];
}

export async function addExternalCost(v: {
  tenantId: number;
  orderId: number;
  createdBy: number;
  subUserId: number | null;
  description: string;
  amount: number;
  invoiceNo: string;
  invoiceDate: string;
  reverseCharge: boolean;
}): Promise<ExternalCost> {
  const { data, error } = await supabase
    .from("order_external_costs")
    .insert({
      tenant_id: v.tenantId,
      order_id: v.orderId,
      created_by: v.createdBy,
      sub_user_id: v.subUserId,
      description: v.description.trim() || null,
      amount_net: v.amount,
      invoice_no: v.invoiceNo.trim() || null,
      invoice_date: v.invoiceDate || null,
      reverse_charge: v.reverseCharge,
    })
    .select("*")
    .single();
  if (error) throw new Error(missing(error.message) ? NEEDS_SQL : `Die Fremdleistung konnte nicht gespeichert werden: ${error.message}`);
  return data as ExternalCost;
}

export async function deleteExternalCost(id: number) {
  const { error } = await supabase.from("order_external_costs").delete().eq("id", id);
  if (error) throw new Error(`Die Fremdleistung konnte nicht gelöscht werden: ${error.message}`);
}

/** Firmendaten für die PDF-Köpfe */
export async function loadCompany(tenantId: number): Promise<{ name: string; street: string; city: string }> {
  const { data } = await supabase.from("company_settings").select("*").eq("tenant_id", tenantId).maybeSingle();
  const d = (data ?? {}) as Record<string, string | null>;
  return {
    name: d.company_name || d.name || "",
    street: d.street || d.address_street || "",
    city: [d.zip || d.postal_code, d.city].filter(Boolean).join(" "),
  };
}

// ---------- Stechuhr durch den Projektleiter (Personen ohne App) ----------
export type ClockOpen = { user_id: number; entry_id: number; order_id: number; started_at: string };

export async function clockStatus(): Promise<ClockOpen[]> {
  const { data, error } = await supabase.rpc("pm_clock_status");
  if (error) throw new Error(missing(error.message) || /pm_clock/i.test(error.message) ? "Für die Stechuhr fehlt noch das Datenbank-Update (SQL „PL-Stechuhr“)." : clean(error.message));
  return ((data ?? []) as ClockOpen[]).map((r) => ({ ...r, user_id: Number(r.user_id), order_id: Number(r.order_id) }));
}

export async function clockStart(userId: number, orderId: number) {
  const { error } = await supabase.rpc("pm_clock_start", { p_user_id: userId, p_order_id: orderId });
  if (error) throw new Error(/pm_clock|Could not find/i.test(error.message) ? "Für die Stechuhr fehlt noch das Datenbank-Update (SQL „PL-Stechuhr“)." : clean(error.message));
}

export async function clockStop(userId: number, breakMinutes: number) {
  const { error } = await supabase.rpc("pm_clock_stop", { p_user_id: userId, p_break_minutes: breakMinutes });
  if (error) throw new Error(clean(error.message));
}

// ---------- Korrektur (nur Admin) ----------
export async function correctEntry(id: number, start: Date, end: Date, breakMinutes: number, reason: string) {
  const { error } = await supabase.rpc("time_entry_correct", { p_id: id, p_start: start.toISOString(), p_end: end.toISOString(), p_break_minutes: breakMinutes, p_reason: reason });
  if (error) throw new Error(/time_entry_correct|Could not find/i.test(error.message) ? "Für Korrekturen fehlt noch das Datenbank-Update (SQL „Zeit-Korrektur“)." : clean(error.message));
}

export type Correction = { id: number; time_entry_id: number; old_started_at: string | null; old_ended_at: string | null; old_break_minutes: number | null; new_started_at: string; new_ended_at: string; new_break_minutes: number; reason: string; corrected_by: number | null; created_at: string };

export async function loadCorrections(tenantId: number): Promise<Correction[]> {
  const { data, error } = await supabase.from("time_entry_corrections").select("*").eq("tenant_id", tenantId).order("created_at", { ascending: false }).limit(2000);
  if (error) return [];
  return (data ?? []) as Correction[];
}

/** Laufende Einträge (ohne Ende) – für „vergessen auszustempeln“ */
export async function loadOpenEntries(tenantId: number): Promise<Entry[]> {
  const { data, error } = await supabase.from("time_entries").select("*").eq("tenant_id", tenantId).is("ended_at", null).limit(500);
  if (error) return [];
  return (data ?? []) as Entry[];
}
