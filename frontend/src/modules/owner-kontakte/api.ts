// Owner-Kontakte: Datenbank und Edge Function owner-outreach
import { supabase } from "../../lib/supabase";
import type { Contact, ContactEvent, Template } from "./logic";
import { DEFAULT_TEMPLATES } from "./logic";

const friendly = (err: unknown, fallback: string) => {
  const msg = String((err as { message?: string })?.message ?? err ?? "");
  if (/owner_contacts|owner_contact_events|owner_outreach_templates|does not exist|schema cache/i.test(msg))
    return "Für die Kontakte fehlt noch das Datenbank-Update (SQL „Owner-Kontakte“).";
  if (/failed to fetch|network/i.test(msg)) return "Keine Internetverbindung.";
  return fallback;
};

export async function loadContacts(): Promise<Contact[]> {
  const { data, error } = await supabase.from("owner_contacts").select("*").order("organisation").limit(5000);
  if (error) throw new Error(friendly(error, "Kontakte konnten nicht geladen werden."));
  return (data as Contact[]) || [];
}

export async function saveContact(id: number | null, values: Partial<Contact>): Promise<Contact> {
  const payload = { ...values, updated_at: new Date().toISOString() };
  delete (payload as Partial<Contact>).id;
  delete (payload as Partial<Contact>).created_at;
  const res = id
    ? await supabase.from("owner_contacts").update(payload).eq("id", id).select("*").single()
    : await supabase.from("owner_contacts").insert(payload).select("*").single();
  if (res.error) throw new Error(friendly(res.error, "Kontakt konnte nicht gespeichert werden."));
  return res.data as Contact;
}

export async function importContacts(rows: Partial<Contact>[]): Promise<number> {
  let n = 0;
  for (let i = 0; i < rows.length; i += 200) {
    const { error, count } = await supabase.from("owner_contacts").insert(rows.slice(i, i + 200), { count: "exact" });
    if (error) throw new Error(friendly(error, `Import nach ${n} Kontakten abgebrochen.`));
    n += count ?? rows.slice(i, i + 200).length;
  }
  return n;
}

export async function deleteContact(id: number) {
  const { error } = await supabase.from("owner_contacts").delete().eq("id", id);
  if (error) throw new Error(friendly(error, "Kontakt konnte nicht gelöscht werden."));
}

export async function loadEvents(contactId: number): Promise<ContactEvent[]> {
  const { data, error } = await supabase.from("owner_contact_events").select("*").eq("contact_id", contactId).order("created_at", { ascending: false }).limit(200);
  if (error) throw new Error(friendly(error, "Verlauf konnte nicht geladen werden."));
  return (data as ContactEvent[]) || [];
}

export async function addEvent(contactId: number, kind: string, subject: string | null, body: string | null, meta: Record<string, unknown> = {}) {
  const { error } = await supabase.from("owner_contact_events").insert({ contact_id: contactId, kind, subject, body, meta });
  if (error) throw new Error(friendly(error, "Eintrag konnte nicht gespeichert werden."));
}

export async function loadTemplates(): Promise<Template[]> {
  const { data, error } = await supabase.from("owner_outreach_templates").select("*").order("kind").order("name");
  if (error) throw new Error(friendly(error, "Vorlagen konnten nicht geladen werden."));
  if (!data?.length) {
    const ins = await supabase.from("owner_outreach_templates").insert(DEFAULT_TEMPLATES).select("*");
    if (!ins.error) return (ins.data as Template[]) || [];
  }
  return (data as Template[]) || [];
}

export async function saveTemplate(id: number | null, values: Partial<Template>): Promise<Template> {
  const payload = { ...values, updated_at: new Date().toISOString() };
  const res = id
    ? await supabase.from("owner_outreach_templates").update(payload).eq("id", id).select("*").single()
    : await supabase.from("owner_outreach_templates").insert(payload).select("*").single();
  if (res.error) throw new Error(friendly(res.error, "Vorlage konnte nicht gespeichert werden."));
  return res.data as Template;
}

export async function deleteTemplate(id: number) {
  const { error } = await supabase.from("owner_outreach_templates").delete().eq("id", id);
  if (error) throw new Error(friendly(error, "Vorlage konnte nicht gelöscht werden."));
}

async function callFn<T>(body: Record<string, unknown>, fallback: string): Promise<T> {
  const { data, error } = await supabase.functions.invoke("owner-outreach", { body });
  if (error) {
    let msg = "";
    try {
      const ctx = (error as { context?: Response }).context;
      if (ctx && typeof ctx.json === "function") msg = (await ctx.json())?.error ?? "";
    } catch {
      /* leer */
    }
    if (!msg && /Failed to send|not found/i.test(String(error.message))) msg = "Die Funktion „owner-outreach“ ist noch nicht hochgeladen.";
    throw new Error(msg || fallback);
  }
  if (!data?.ok) throw new Error(data?.error || fallback);
  return data as T;
}

export const aiDraft = (input: { kind: "brief" | "email"; goal: string; target: string; offer: string; notes: string }) =>
  callFn<{ subject: string; body: string }>({ action: "ai", ...input }, "Der Entwurf konnte nicht erstellt werden.");

export const sendEmail = (contactId: number, subject: string, body: string) =>
  callFn<{ ok: true }>({ action: "email", contact_id: contactId, subject, body }, "Die E-Mail konnte nicht gesendet werden.");

export const pingenStatus = () =>
  callFn<{ configured: boolean; staging?: boolean; organisation?: string; error?: string }>({ action: "pingen_status" }, "Pingen-Status unbekannt.");

export const pingenSend = (contactId: number, pdfBase64: string, fileName: string, subject: string, delivery: "cheap" | "fast") =>
  callFn<{ letter_id: string; status: string; staging: boolean }>(
    { action: "pingen_send", contact_id: contactId, pdf_base64: pdfBase64, file_name: fileName, subject, delivery },
    "Der Brief konnte nicht an Pingen übergeben werden."
  );
