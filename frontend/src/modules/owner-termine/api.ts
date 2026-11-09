// Owner-Termine: Datenbank und Abo-Link
import { supabase, supabaseUrl } from "../../lib/supabase";
import type { Appointment } from "./logic";

const friendly = (err: unknown, fallback: string) => {
  const msg = String((err as { message?: string })?.message ?? err ?? "");
  if (/owner_appointments|owner_calendar_feed|does not exist|schema cache/i.test(msg)) return "Für den Terminkalender fehlt noch das Datenbank-Update (SQL „Owner-Termine“).";
  if (/failed to fetch|network/i.test(msg)) return "Keine Internetverbindung.";
  return fallback;
};

const COLS = "id, title, kind, starts_at, ends_at, all_day, location, url, notes, contact_id, recur, recur_until, created_at, updated_at";

export async function loadAppointments(): Promise<Appointment[]> {
  const { data, error } = await supabase.from("owner_appointments").select(COLS).order("starts_at").limit(5000);
  if (error) throw new Error(friendly(error, "Die Termine konnten nicht geladen werden."));
  return (data ?? []) as Appointment[];
}

export async function loadForContact(contactId: number): Promise<Appointment[]> {
  const { data, error } = await supabase.from("owner_appointments").select(COLS).eq("contact_id", contactId).order("starts_at", { ascending: false });
  if (error) return [];
  return (data ?? []) as Appointment[];
}

export async function saveAppointment(id: number | null, values: Partial<Appointment>): Promise<Appointment> {
  const row = { ...values, updated_at: new Date().toISOString() };
  delete (row as { id?: number }).id;
  delete (row as { created_at?: string }).created_at;
  const q = id ? supabase.from("owner_appointments").update(row).eq("id", id) : supabase.from("owner_appointments").insert(row);
  const { data, error } = await q.select(COLS).single();
  if (error) throw new Error(friendly(error, "Der Termin konnte nicht gespeichert werden."));
  return data as Appointment;
}

export async function insertMany(rows: Partial<Appointment>[]): Promise<number> {
  if (!rows.length) return 0;
  const { error } = await supabase.from("owner_appointments").insert(rows);
  if (error) throw new Error(friendly(error, "Die Termine konnten nicht eingetragen werden."));
  return rows.length;
}

export async function deleteAppointment(id: number) {
  const { error } = await supabase.from("owner_appointments").delete().eq("id", id);
  if (error) throw new Error(friendly(error, "Der Termin konnte nicht gelöscht werden."));
}

// ---------- Abo-Link ----------
export const feedUrl = (token: string) => `${supabaseUrl}/functions/v1/owner-calendar?token=${token}`;

export async function loadFeedToken(): Promise<string | null> {
  const { data, error } = await supabase.from("owner_calendar_feed").select("token").eq("id", 1).maybeSingle();
  if (error) throw new Error(friendly(error, "Der Abo-Link konnte nicht geladen werden."));
  return (data?.token as string) ?? null;
}

function randomToken(): string {
  const b = new Uint8Array(24);
  crypto.getRandomValues(b);
  return Array.from(b, (x) => x.toString(16).padStart(2, "0")).join("");
}

/** Neuen Token erzeugen (alter Link funktioniert danach nicht mehr) */
export async function createFeedToken(): Promise<string> {
  const token = randomToken();
  const { error } = await supabase.from("owner_calendar_feed").upsert({ id: 1, token, created_at: new Date().toISOString() });
  if (error) throw new Error(friendly(error, "Der Abo-Link konnte nicht erstellt werden."));
  return token;
}
