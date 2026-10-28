import { supabase } from "../../lib/supabase";
import type {
  Appointment,
  AppointmentInput,
  CalendarCustomer,
  CalendarOrder,
  CalendarPerson,
} from "./types";
import { formatRange } from "./dateUtils";

const PROJECT_MANAGER_ROLE_ID = 3;

const APPOINTMENT_COLUMNS = "*";

function fail(context: string, error: { message: string } | null): never {
  const msg = error?.message ?? "Unbekannter Fehler";
  if (msg.includes("appointments") && (msg.includes("does not exist") || msg.includes("schema cache"))) {
    throw new Error(
      "Die Tabelle für den Terminkalender fehlt noch. Bitte die SQL-Datei supabase/migrations/20261028120000_terminkalender.sql im Supabase SQL-Editor ausführen."
    );
  }
  throw new Error(`${context}: ${msg}`);
}

export async function loadAppointments(
  tenantId: number,
  from: Date,
  to: Date
): Promise<Appointment[]> {
  const { data, error } = await supabase
    .from("appointments")
    .select(APPOINTMENT_COLUMNS)
    .eq("tenant_id", tenantId)
    .lt("starts_at", to.toISOString())
    .gte("ends_at", from.toISOString())
    .order("starts_at", { ascending: true });

  if (error) fail("Termine konnten nicht geladen werden", error);
  return (data ?? []) as Appointment[];
}

export async function loadMyAppointments(userId: number): Promise<Appointment[]> {
  const since = new Date();
  since.setDate(since.getDate() - 30);

  const { data, error } = await supabase
    .from("appointments")
    .select(APPOINTMENT_COLUMNS)
    .eq("assigned_to", userId)
    .gte("ends_at", since.toISOString())
    .order("starts_at", { ascending: true });

  if (error) fail("Termine konnten nicht geladen werden", error);
  return (data ?? []) as Appointment[];
}

export async function loadProjectManagers(tenantId: number): Promise<CalendarPerson[]> {
  const { data, error } = await supabase
    .from("app_users")
    .select("id, first_name, last_name, email, is_active")
    .eq("tenant_id", tenantId)
    .eq("role_id", PROJECT_MANAGER_ROLE_ID)
    .order("last_name", { ascending: true });

  if (error) fail("Projektleiter konnten nicht geladen werden", error);
  return ((data ?? []) as (CalendarPerson & { is_active?: boolean | null })[])
    .filter((u) => u.is_active !== false)
    .map(({ id, first_name, last_name, email }) => ({ id, first_name, last_name, email }));
}

export async function loadPeople(ids: number[]): Promise<CalendarPerson[]> {
  const unique = [...new Set(ids)];
  if (unique.length === 0) return [];
  const { data, error } = await supabase
    .from("app_users")
    .select("id, first_name, last_name, email")
    .in("id", unique);
  if (error) return [];
  return (data ?? []) as CalendarPerson[];
}

export async function loadCustomers(tenantId: number): Promise<CalendarCustomer[]> {
  const { data, error } = await supabase
    .from("customers")
    .select("id, first_name, last_name, company_name, street, zip, city")
    .eq("tenant_id", tenantId)
    .order("last_name", { ascending: true });

  if (error) fail("Kunden konnten nicht geladen werden", error);
  return (data ?? []) as CalendarCustomer[];
}

export async function loadCustomersByIds(ids: number[]): Promise<CalendarCustomer[]> {
  const unique = [...new Set(ids)];
  if (unique.length === 0) return [];
  const { data, error } = await supabase
    .from("customers")
    .select("id, first_name, last_name, company_name, street, zip, city")
    .in("id", unique);
  if (error) return [];
  return (data ?? []) as CalendarCustomer[];
}

export async function loadOrders(tenantId: number): Promise<CalendarOrder[]> {
  const { data, error } = await supabase
    .from("orders")
    .select("id, customer_id, title, status, address_street, address_zip, address_city")
    .eq("tenant_id", tenantId)
    .order("created_at", { ascending: false });

  if (error) fail("Aufträge konnten nicht geladen werden", error);
  return (data ?? []) as CalendarOrder[];
}

export async function loadOrdersByIds(ids: number[]): Promise<CalendarOrder[]> {
  const unique = [...new Set(ids)];
  if (unique.length === 0) return [];
  const { data, error } = await supabase
    .from("orders")
    .select("id, customer_id, title, status, address_street, address_zip, address_city")
    .in("id", unique);
  if (error) return [];
  return (data ?? []) as CalendarOrder[];
}

export async function createAppointment(
  tenantId: number,
  createdBy: number,
  input: AppointmentInput
): Promise<Appointment> {
  const { data, error } = await supabase
    .from("appointments")
    .insert([{ ...input, tenant_id: tenantId, created_by: createdBy, status: "geplant" }])
    .select(APPOINTMENT_COLUMNS)
    .single();

  if (error) fail("Termin konnte nicht gespeichert werden", error);
  return data as Appointment;
}

export async function updateAppointment(
  id: number,
  input: AppointmentInput
): Promise<Appointment> {
  const { data, error } = await supabase
    .from("appointments")
    .update({ ...input, updated_at: new Date().toISOString() })
    .eq("id", id)
    .select(APPOINTMENT_COLUMNS)
    .single();

  if (error) fail("Termin konnte nicht gespeichert werden", error);
  return data as Appointment;
}

export async function setAppointmentStatus(
  id: number,
  status: "geplant" | "abgesagt"
): Promise<void> {
  const { error } = await supabase
    .from("appointments")
    .update({ status, updated_at: new Date().toISOString() })
    .eq("id", id);
  if (error) fail("Status konnte nicht geändert werden", error);
}

export async function deleteAppointment(id: number): Promise<void> {
  const { error } = await supabase.from("appointments").delete().eq("id", id);
  if (error) fail("Termin konnte nicht gelöscht werden", error);
}

/** Interne Nachricht über das bestehende Nachrichtensystem (Tabelle messages) */
async function sendMessage(
  tenantId: number,
  senderId: number,
  recipientId: number,
  text: string
): Promise<boolean> {
  const { error } = await supabase.from("messages").insert([
    {
      tenant_id: tenantId,
      sender_id: senderId,
      recipient_id: recipientId,
      order_id: null,
      message_type: "direct",
      message: text,
      image_url: null,
    },
  ]);
  if (error) {
    console.error("Terminkalender: Nachricht konnte nicht gesendet werden", error);
    return false;
  }
  return true;
}

/**
 * Termin an Projektleiter weiterleiten.
 * Gibt zurück, ob die Benachrichtigung verschickt werden konnte.
 */
export async function forwardAppointment(
  appointment: Appointment,
  projectManagerId: number,
  senderId: number,
  note: string,
  extraInfo: string
): Promise<{ appointment: Appointment; notified: boolean }> {
  const now = new Date().toISOString();
  const { data, error } = await supabase
    .from("appointments")
    .update({
      assigned_to: projectManagerId,
      status: "weitergeleitet",
      forwarded_at: now,
      forward_note: note.trim() || null,
      responded_at: null,
      response_note: null,
      updated_at: now,
    })
    .eq("id", appointment.id)
    .select(APPOINTMENT_COLUMNS)
    .single();

  if (error) fail("Termin konnte nicht weitergeleitet werden", error);

  const lines = [
    `📅 Neuer Termin für dich: ${appointment.title}`,
    `Wann: ${formatRange(appointment.starts_at, appointment.ends_at)}`,
  ];
  if (appointment.location) lines.push(`Wo: ${appointment.location}`);
  if (extraInfo) lines.push(extraInfo);
  if (note.trim()) lines.push(`Hinweis: ${note.trim()}`);
  lines.push("Bitte im Bereich „Meine Termine“ bestätigen oder ablehnen.");

  const notified = await sendMessage(
    appointment.tenant_id,
    senderId,
    projectManagerId,
    lines.join("\n")
  );

  return { appointment: data as Appointment, notified };
}

/** Projektleiter bestätigt oder lehnt ab (über die SQL-Funktion appointment_respond) */
export async function respondToAppointment(
  appointment: Appointment,
  responderId: number,
  accept: boolean,
  note: string
): Promise<void> {
  const { error } = await supabase.rpc("appointment_respond", {
    p_appointment_id: appointment.id,
    p_accept: accept,
    p_note: note.trim() || null,
  });
  if (error) fail("Antwort konnte nicht gespeichert werden", error);

  if (appointment.created_by) {
    const text = [
      `${accept ? "✅ Termin bestätigt" : "❌ Termin abgelehnt"}: ${appointment.title}`,
      `Wann: ${formatRange(appointment.starts_at, appointment.ends_at)}`,
      note.trim() ? `Anmerkung: ${note.trim()}` : "",
    ]
      .filter(Boolean)
      .join("\n");
    await sendMessage(appointment.tenant_id, responderId, appointment.created_by, text);
  }
}

/** Projektleiter informieren, dass ein weitergeleiteter Termin abgesagt wurde */
export async function notifyCancelled(appointment: Appointment, senderId: number): Promise<boolean> {
  if (!appointment.assigned_to) return false;
  return sendMessage(
    appointment.tenant_id,
    senderId,
    appointment.assigned_to,
    `🚫 Termin abgesagt: ${appointment.title}\nWann: ${formatRange(appointment.starts_at, appointment.ends_at)}`
  );
}
