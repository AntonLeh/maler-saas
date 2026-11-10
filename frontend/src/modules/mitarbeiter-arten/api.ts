// Mitarbeiter anlegen/ändern, Vergütung (nur Admin), App-Zugang
import { supabase } from "../../lib/supabase";
import type { EmploymentType, Pay } from "./logic";
import { toPay } from "./logic";

export type Person = {
  id: number;
  tenant_id: number;
  role_id: number;
  auth_user_id: string | null;
  first_name: string | null;
  last_name: string | null;
  email: string | null;
  phone?: string | null;
  hourly_rate: number | null;
  employment_type?: string | null;
  app_access?: boolean | null;
  is_active?: boolean | null;
  exit_date?: string | null;
  exit_reason?: string | null;
};

const NEEDS_SQL = "Für die Mitarbeiter-Arten fehlt noch das Datenbank-Update (SQL „Mitarbeiter-Arten“).";
const missing = (msg: string) => /employee_pay|employment_type|app_access|schema cache|does not exist/i.test(msg);

async function callFn(body: Record<string, unknown>, fallback: string) {
  const { data, error } = await supabase.functions.invoke("create-employee-auth", { body });
  if (error) {
    let msg = "";
    try {
      const ctx = (error as { context?: Response }).context;
      if (ctx && typeof ctx.json === "function") msg = (await ctx.json())?.error ?? "";
    } catch {
      /* leer */
    }
    throw new Error(msg || fallback);
  }
  if (!data?.success) throw new Error(data?.error || fallback);
  return data as { success: true; app_user?: Person };
}

export type NewPerson = {
  first_name: string;
  last_name: string;
  email: string;
  phone: string;
  password: string;
  role_id: number;
  hourly_rate: number | null;
  employment_type: EmploymentType;
  app_access: boolean;
};

export async function createPerson(p: NewPerson): Promise<Person> {
  const r = await callFn({ action: "create", ...p }, "Mitarbeiter konnte nicht angelegt werden.");
  if (!r.app_user) throw new Error("Mitarbeiter konnte nicht angelegt werden.");
  return r.app_user;
}

export async function updatePerson(id: number, tenantId: number, values: Partial<Person>) {
  const { error } = await supabase.from("app_users").update(values).eq("id", id).eq("tenant_id", tenantId);
  if (error) throw new Error(missing(error.message) ? NEEDS_SQL : `Mitarbeiter konnte nicht gespeichert werden: ${error.message}`);
}

export const grantAccess = (userId: number, email: string, password: string) =>
  callFn({ action: "grant_access", user_id: userId, email, password }, "Der App-Zugang konnte nicht eingeschaltet werden.");

export const revokeAccess = (userId: number) => callFn({ action: "revoke_access", user_id: userId }, "Der App-Zugang konnte nicht abgeschaltet werden.");

export async function loadPay(userId: number): Promise<{ pay: Pay; available: boolean }> {
  const { data, error } = await supabase.from("employee_pay").select("*").eq("user_id", userId).maybeSingle();
  if (error) return { pay: toPay(null), available: !missing(error.message) };
  return { pay: toPay(data as Partial<Pay> | null), available: true };
}

export async function savePay(userId: number, tenantId: number, pay: Pay) {
  const { error } = await supabase.from("employee_pay").upsert({ user_id: userId, tenant_id: tenantId, ...pay, updated_at: new Date().toISOString() });
  if (error) throw new Error(missing(error.message) ? NEEDS_SQL : `Vergütung konnte nicht gespeichert werden: ${error.message}`);
}

// ---------- Austritt ----------
export const exitPerson = (userId: number, exitDate: string, reason: string) =>
  callFn({ action: "exit", user_id: userId, exit_date: exitDate, exit_reason: reason }, "Der Austritt konnte nicht eingetragen werden.");

export const rejoinPerson = (userId: number) => callFn({ action: "rejoin", user_id: userId }, "Die Person konnte nicht wieder aufgenommen werden.");

/** Neuen Einsatzbeginn speichern (Leiharbeit) – vorhandene Vergütungsdaten bleiben */
export async function setAssignmentStart(userId: number, tenantId: number, date: string) {
  const { pay, available } = await loadPay(userId);
  if (!available) return;
  await savePay(userId, tenantId, { ...pay, assignment_start: date });
}

/** Stunden vorhanden? Dann nicht löschen, sondern Austritt eintragen */
export async function hasTimeEntries(userId: number, tenantId: number): Promise<boolean> {
  const { count, error } = await supabase.from("time_entries").select("id", { count: "exact", head: true }).eq("tenant_id", tenantId).eq("user_id", userId);
  if (error) return true; // im Zweifel nicht löschen
  return (count ?? 0) > 0;
}
