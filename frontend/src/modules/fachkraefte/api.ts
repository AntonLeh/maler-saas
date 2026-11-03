import { supabase, supabaseUrl } from "../../lib/supabase";
import type { PoolBusinessContact, PoolContactForWorker, PoolProfile, PoolResult } from "./types";

// eslint-disable-next-line @typescript-eslint/no-explicit-any -- Antwort der Server-Funktion
async function call(action: string, body: Record<string, unknown> = {}, withLogin = false): Promise<any> {
  const headers: Record<string, string> = { "content-type": "application/json" };
  if (withLogin) {
    const { data } = await supabase.auth.getSession();
    const token = data.session?.access_token;
    if (!token) throw new Error("Bitte erneut anmelden.");
    headers.authorization = `Bearer ${token}`;
  }
  let res: Response;
  try {
    res = await fetch(`${supabaseUrl}/functions/v1/talent-pool`, { method: "POST", headers, body: JSON.stringify({ action, ...body }) });
  } catch {
    throw new Error("Der Fachkräfte-Pool ist gerade nicht erreichbar. Bitte später noch einmal versuchen.");
  }
  const data = await res.json().catch(() => ({}));
  if (!res.ok || !data.ok) throw new Error(data.error || `Fehler (Status ${res.status}).`);
  return data;
}

/** Profil vom Server -> Formularwerte */
// eslint-disable-next-line @typescript-eslint/no-explicit-any -- Daten vom Server
export function toForm(p: any): PoolProfile {
  return {
    id: p.id,
    status: p.status,
    first_name: p.first_name ?? "",
    last_name: p.last_name ?? "",
    email: p.email ?? "",
    phone: p.phone ?? "",
    role: p.role ?? "",
    wants: p.wants ?? [],
    skills: p.skills ?? [],
    company_name: p.company_name ?? "",
    handwerksrolle: !!p.handwerksrolle,
    plz: p.plz ?? "",
    ort: p.ort ?? null,
    radius_km: p.radius_km ?? 30,
    available_from: p.available_from ?? "sofort",
    driving_license: !!p.driving_license,
    own_vehicle: !!p.own_vehicle,
    languages: p.languages ?? "",
    note: p.note ?? "",
    visible_until: p.visible_until,
  };
}

export const sendLink = (email: string) => call("send_link", { email });

export const signup = (p: PoolProfile, extra: { consent: boolean; website: string; t: number }) => call("signup", { ...p, ...extra });

export async function loadProfile(t: string, noch = false): Promise<{ profile: PoolProfile; contacts: PoolContactForWorker[] }> {
  const d = await call("profile", { t, noch });
  return { profile: toForm(d.profile), contacts: d.contacts ?? [] };
}
export async function updateProfile(t: string, p: PoolProfile) {
  const d = await call("update", { t, profile: p });
  return { profile: toForm(d.profile), contacts: d.contacts ?? [] };
}
export async function setStatus(t: string, status: "active" | "paused") {
  const d = await call("set_status", { t, status });
  return { profile: toForm(d.profile), contacts: d.contacts ?? [] };
}
export const deleteProfile = (t: string) => call("delete", { t });

export const getContact = (t: string): Promise<{ status: string; message: string | null; created_at: string; company: string; city: string | null }> => call("contact_get", { t });
export const answerContact = (t: string, accept: boolean): Promise<{ status: string; company: string; already?: boolean }> => call("contact_answer", { t, accept });

// ---------- für Betriebe ----------
export const search = (plz: string, radius: number): Promise<{ center: { plz: string; ort: string | null }; radius: number; results: PoolResult[] }> =>
  call("search", { plz: plz || undefined, radius }, true);
export const requestContact = (profileId: string, message: string) => call("contact", { profile_id: profileId, message }, true);
export async function loadContacts(): Promise<PoolBusinessContact[]> {
  return (await call("contacts", {}, true)).contacts ?? [];
}
