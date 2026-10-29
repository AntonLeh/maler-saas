import { supabase, supabaseUrl } from "../../lib/supabase";
import type {
  AiAppointment,
  AiCall,
  AiPhoneAgent,
  AiPhoneBilling,
  AiPhoneSettings,
  CallbackRequest,
  MinuteLedgerEntry,
  MinutePackage,
} from "./types";

function fail(context: string, error: { message: string } | null): never {
  const msg = error?.message ?? "Unbekannter Fehler";
  if (msg.includes("notify_")) {
    throw new Error(
      "Für die Benachrichtigungen fehlt noch die SQL-Datei supabase/migrations/20261028180000_ki_telefon_benachrichtigung.sql. Bitte im Supabase SQL-Editor ausführen."
    );
  }
  if (
    (msg.includes("ai_phone_settings") || msg.includes("ai_calls") || msg.includes("ai_callback_requests") || msg.includes("source")) &&
    (msg.includes("does not exist") || msg.includes("schema cache"))
  ) {
    throw new Error(
      "Die Tabellen für das KI-Telefon fehlen noch. Bitte die SQL-Datei supabase/migrations/20261028140000_ki_telefon.sql im Supabase SQL-Editor ausführen."
    );
  }
  throw new Error(`${context}: ${msg}`);
}

/** Einstellungen laden – legt beim ersten Aufruf einen Datensatz mit Standardwerten an */
export async function loadOrCreateSettings(tenantId: number): Promise<AiPhoneSettings> {
  const { data, error } = await supabase
    .from("ai_phone_settings")
    .select("*")
    .eq("tenant_id", tenantId)
    .maybeSingle();
  if (error) fail("Einstellungen konnten nicht geladen werden", error);
  if (data) return data as AiPhoneSettings;

  const { data: created, error: insertError } = await supabase
    .from("ai_phone_settings")
    .insert([{ tenant_id: tenantId }])
    .select("*")
    .single();
  if (!insertError) return created as AiPhoneSettings;

  // Gleichzeitig schon angelegt (z. B. doppeltes Laden) -> einfach den vorhandenen Datensatz nehmen
  if ((insertError as { code?: string }).code === "23505") {
    const { data: existing, error: againError } = await supabase
      .from("ai_phone_settings")
      .select("*")
      .eq("tenant_id", tenantId)
      .single();
    if (againError) fail("Einstellungen konnten nicht geladen werden", againError);
    return existing as AiPhoneSettings;
  }
  fail("Einstellungen konnten nicht angelegt werden", insertError);
}

export async function saveSettings(
  tenantId: number,
  values: Partial<Omit<AiPhoneSettings, "tenant_id" | "webhook_key">>
): Promise<AiPhoneSettings> {
  const { data, error } = await supabase
    .from("ai_phone_settings")
    .update({ ...values, updated_at: new Date().toISOString() })
    .eq("tenant_id", tenantId)
    .select("*")
    .single();
  if (error) fail("Einstellungen konnten nicht gespeichert werden", error);
  return data as AiPhoneSettings;
}

function randomKey(): string {
  const bytes = new Uint8Array(32);
  crypto.getRandomValues(bytes);
  return Array.from(bytes, (b) => b.toString(16).padStart(2, "0")).join("");
}

/** Neuen geheimen Schlüssel erzeugen – alte Adressen funktionieren danach nicht mehr */
export async function regenerateKey(tenantId: number): Promise<AiPhoneSettings> {
  const { data, error } = await supabase
    .from("ai_phone_settings")
    .update({ webhook_key: randomKey(), updated_at: new Date().toISOString() })
    .eq("tenant_id", tenantId)
    .select("*")
    .single();
  if (error) fail("Schlüssel konnte nicht erneuert werden", error);
  return data as AiPhoneSettings;
}

export async function loadCallbacks(tenantId: number): Promise<CallbackRequest[]> {
  const { data, error } = await supabase
    .from("ai_callback_requests")
    .select("*")
    .eq("tenant_id", tenantId)
    .order("created_at", { ascending: false })
    .limit(100);
  if (error) fail("Rückrufe konnten nicht geladen werden", error);
  return (data ?? []) as CallbackRequest[];
}

export async function markCallbackDone(id: number, userId: number, note: string): Promise<void> {
  const { error } = await supabase
    .from("ai_callback_requests")
    .update({ status: "erledigt", handled_by: userId, handled_at: new Date().toISOString(), note: note.trim() || null })
    .eq("id", id);
  if (error) fail("Rückruf konnte nicht gespeichert werden", error);
}

export async function reopenCallback(id: number): Promise<void> {
  const { error } = await supabase
    .from("ai_callback_requests")
    .update({ status: "offen", handled_by: null, handled_at: null })
    .eq("id", id);
  if (error) fail("Rückruf konnte nicht gespeichert werden", error);
}

export async function loadCalls(tenantId: number): Promise<AiCall[]> {
  const { data, error } = await supabase
    .from("ai_calls")
    .select("*")
    .eq("tenant_id", tenantId)
    .order("created_at", { ascending: false })
    .limit(50);
  if (error) fail("Anrufe konnten nicht geladen werden", error);
  return (data ?? []) as AiCall[];
}

/** Minuten im laufenden Monat (für die Abrechnung) */
export async function loadMonthSeconds(tenantId: number): Promise<{ seconds: number; calls: number }> {
  const start = new Date();
  start.setDate(1);
  start.setHours(0, 0, 0, 0);
  const { data, error } = await supabase
    .from("ai_calls")
    .select("duration_seconds")
    .eq("tenant_id", tenantId)
    .gte("created_at", start.toISOString());
  if (error) fail("Minuten konnten nicht geladen werden", error);
  const rows = (data ?? []) as { duration_seconds: number | null }[];
  return { seconds: rows.reduce((sum, r) => sum + (r.duration_seconds ?? 0), 0), calls: rows.length };
}

/** Von der KI gebuchte Termine, die noch keinem Projektleiter zugewiesen sind */
export async function loadAiAppointmentsToReview(tenantId: number): Promise<AiAppointment[]> {
  const { data, error } = await supabase
    .from("appointments")
    .select("id, title, starts_at, ends_at, location, contact_name, contact_phone, status")
    .eq("tenant_id", tenantId)
    .eq("source", "ki_telefon")
    .eq("status", "geplant")
    .gte("ends_at", new Date().toISOString())
    .order("starts_at", { ascending: true });
  if (error) fail("KI-Termine konnten nicht geladen werden", error);
  return (data ?? []) as AiAppointment[];
}

/** Zahl für das Dashboard: offene Rückrufe + zu prüfende KI-Termine */
export async function loadOpenCount(tenantId: number): Promise<number> {
  const [cb, ap] = await Promise.all([
    supabase
      .from("ai_callback_requests")
      .select("id", { count: "exact", head: true })
      .eq("tenant_id", tenantId)
      .eq("status", "offen"),
    supabase
      .from("appointments")
      .select("id", { count: "exact", head: true })
      .eq("tenant_id", tenantId)
      .eq("source", "ki_telefon")
      .eq("status", "geplant")
      .gte("ends_at", new Date().toISOString()),
  ]);
  return (cb.error ? 0 : cb.count ?? 0) + (ap.error ? 0 : ap.count ?? 0);
}

/** Test-Benachrichtigung über die Schnittstelle auslösen (nutzt die gespeicherten Einstellungen) */
export async function sendTestNotification(webhookKey: string): Promise<{ email: string; sms: string }> {
  let res: Response;
  try {
    res = await fetch(`${supabaseUrl}/functions/v1/ai-phone?key=${webhookKey}&action=test-notify`, {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: "{}",
    });
  } catch {
    throw new Error("Die Schnittstelle ist nicht erreichbar. Ist die Funktion ai-phone veröffentlicht?");
  }
  const data = await res.json().catch(() => ({}));
  if (!res.ok || !data.result) throw new Error(data.error || `Test fehlgeschlagen (Status ${res.status}).`);
  return data.result;
}

/** Status des automatisch angelegten KI-Agenten (null = noch nicht aktiviert oder Tabelle fehlt) */
export async function loadAgent(tenantId: number): Promise<AiPhoneAgent | null> {
  const { data, error } = await supabase.from("ai_phone_agents").select("*").eq("tenant_id", tenantId).maybeSingle();
  if (error) return null;
  return (data as AiPhoneAgent) ?? null;
}

/** KI-Agent bei ElevenLabs anlegen bzw. aktualisieren (läuft über die Schnittstelle) */
export async function provisionAgent(): Promise<{ created: boolean }> {
  const { data: sessionData } = await supabase.auth.getSession();
  const token = sessionData.session?.access_token;
  if (!token) throw new Error("Bitte erneut anmelden.");
  let res: Response;
  try {
    res = await fetch(`${supabaseUrl}/functions/v1/ai-phone?action=provision-agent`, {
      method: "POST",
      headers: { authorization: `Bearer ${token}`, "content-type": "application/json" },
      body: "{}",
    });
  } catch {
    throw new Error("Die Schnittstelle ist nicht erreichbar. Ist die Funktion ai-phone veröffentlicht?");
  }
  const data = await res.json().catch(() => ({}));
  if (!res.ok || !data.ok) throw new Error(data.error || `Aktivierung fehlgeschlagen (Status ${res.status}).`);
  return { created: !!data.created };
}

/** Kontostand (null = Tabelle fehlt noch) */
export async function loadBilling(tenantId: number): Promise<AiPhoneBilling | null> {
  const { data, error } = await supabase.from("ai_phone_billing").select("*").eq("tenant_id", tenantId).maybeSingle();
  if (error) return null;
  return (data as AiPhoneBilling) ?? { tenant_id: tenantId, setup_paid_at: null, balance_seconds: 0 };
}

/** Letzte Käufe (Gespräche werden in der Anrufliste gezeigt) */
export async function loadPurchases(tenantId: number): Promise<MinuteLedgerEntry[]> {
  const { data, error } = await supabase
    .from("ai_minute_ledger")
    .select("id, delta_seconds, reason, amount_net, currency, note, created_at")
    .eq("tenant_id", tenantId)
    .in("reason", ["einrichtung", "kauf", "korrektur"])
    .order("created_at", { ascending: false })
    .limit(10);
  if (error) return [];
  return (data ?? []) as MinuteLedgerEntry[];
}

/** Stripe-Bezahlseite öffnen */
export async function startCheckout(pkg: MinutePackage): Promise<void> {
  const { data: sessionData } = await supabase.auth.getSession();
  const token = sessionData.session?.access_token;
  if (!token) throw new Error("Bitte erneut anmelden.");
  let res: Response;
  try {
    res = await fetch(`${supabaseUrl}/functions/v1/ai-phone-billing?action=checkout`, {
      method: "POST",
      headers: { authorization: `Bearer ${token}`, "content-type": "application/json" },
      body: JSON.stringify({ package: pkg }),
    });
  } catch {
    throw new Error("Die Bezahlfunktion ist nicht erreichbar. Ist die Funktion ai-phone-billing veröffentlicht?");
  }
  const data = await res.json().catch(() => ({}));
  if (!res.ok || !data.url) throw new Error(data.error || `Bezahlung konnte nicht gestartet werden (Status ${res.status}).`);
  window.location.href = data.url;
}
