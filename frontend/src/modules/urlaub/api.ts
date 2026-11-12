// Urlaub & Abwesenheiten: Laden und Speichern
import { supabase } from "../../lib/supabase";
import { DEFAULT_WEEKDAYS, EMPTY_LEAVE, landOf } from "./logic";
import type { Absence, Calendar, Leave } from "./logic";

export const NEEDS_SQL = "Für Urlaub & Abwesenheiten fehlt noch das Datenbank-Update (SQL „Urlaub“).";
const missing = (m: string) => /absences|employee_leave|holiday_region|team_absences|schema cache|does not exist|Could not find/i.test(m);
const err = (m: string, fallback: string) => new Error(missing(m) ? NEEDS_SQL : `${fallback}: ${m}`);

/** Abwesenheiten des Betriebs (Admin) bzw. die eigenen; null = Datenbank-Update fehlt */
export async function loadAbsences(tenantId: number, from?: string, to?: string): Promise<Absence[] | null> {
  let q = supabase.from("absences").select("*").eq("tenant_id", tenantId);
  if (from) q = q.gte("end_date", from);
  if (to) q = q.lte("start_date", to);
  const { data, error } = await q.order("start_date").limit(5000);
  if (error) return null;
  return (data ?? []).map((a) => ({ ...a, user_id: Number(a.user_id) })) as Absence[];
}

export async function loadLeaves(tenantId: number): Promise<Map<number, Leave>> {
  const m = new Map<number, Leave>();
  const { data, error } = await supabase.from("employee_leave").select("*").eq("tenant_id", tenantId);
  if (error) return m;
  for (const r of data ?? []) {
    m.set(Number(r.user_id), {
      ...EMPTY_LEAVE(Number(r.user_id), tenantId),
      vacation_days: r.vacation_days != null ? Number(r.vacation_days) : null,
      work_weekdays: Array.isArray(r.work_weekdays) && r.work_weekdays.length ? r.work_weekdays.map(Number) : DEFAULT_WEEKDAYS,
      entry_date: r.entry_date ?? null,
      years: (r.years ?? {}) as Leave["years"],
    });
  }
  return m;
}

export async function saveLeave(l: Leave) {
  const { error } = await supabase.from("employee_leave").upsert({
    user_id: l.user_id,
    tenant_id: l.tenant_id,
    vacation_days: l.vacation_days,
    work_weekdays: l.work_weekdays,
    entry_date: l.entry_date || null,
    years: l.years,
    updated_at: new Date().toISOString(),
  });
  if (error) throw err(error.message, "Der Urlaubsanspruch konnte nicht gespeichert werden");
}

export type NewAbsence = Omit<Absence, "id" | "status" | "created_at">;

export async function addAbsence(a: NewAbsence, createdBy: number): Promise<Absence> {
  const { data, error } = await supabase
    .from("absences")
    .insert({ ...a, note: a.note?.trim() || null, created_by: createdBy, status: "genehmigt", decided_by: createdBy, decided_at: new Date().toISOString() })
    .select("*")
    .single();
  if (error) throw err(error.message, "Die Abwesenheit konnte nicht gespeichert werden");
  return { ...data, user_id: Number(data.user_id) } as Absence;
}

export async function updateAbsence(id: number, a: Partial<NewAbsence>) {
  const { error } = await supabase.from("absences").update({ ...a, note: a.note?.trim() || null }).eq("id", id);
  if (error) throw err(error.message, "Die Abwesenheit konnte nicht geändert werden");
}

export async function deleteAbsence(id: number) {
  const { error } = await supabase.from("absences").delete().eq("id", id);
  if (error) throw err(error.message, "Die Abwesenheit konnte nicht gelöscht werden");
}

/** Feiertags-Kalender des Betriebs (Land + Bundesland) */
export async function loadCalendar(tenantId: number): Promise<Calendar> {
  const { data } = await supabase.from("company_settings").select("*").eq("tenant_id", tenantId).maybeSingle();
  const d = (data ?? {}) as { country?: string | null; holiday_region?: string | null };
  return { land: landOf(d.country), region: d.holiday_region ?? null };
}

export type TeamAbsence = { user_id: number; start_date: string; end_date: string; start_half: boolean; end_half: boolean };

/** Wer ist wann abwesend – ohne Grund (für Projektleiter und Zuteilung) */
export async function loadTeamAbsences(from: string, to: string): Promise<TeamAbsence[]> {
  const { data, error } = await supabase.rpc("team_absences", { p_from: from, p_to: to });
  if (error) return [];
  return ((data ?? []) as TeamAbsence[]).map((a) => ({ ...a, user_id: Number(a.user_id) }));
}
