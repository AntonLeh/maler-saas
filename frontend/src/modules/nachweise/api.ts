// Nachweise laden, hochladen, öffnen, löschen (nur Admin)
import { supabase } from "../../lib/supabase";
import type { PartnerDoc } from "./logic";

const BUCKET = "partner-docs";
export const NEEDS_SQL = "Für die Nachweise fehlt noch das Datenbank-Update (SQL „Nachweise“).";
const missing = (m: string) => /partner_documents|partner-docs|bucket not found|schema cache|does not exist/i.test(m);

/** Alle Nachweise des Betriebs; ohne Datenbank-Update: null */
export async function loadDocs(tenantId: number): Promise<PartnerDoc[] | null> {
  const { data, error } = await supabase.from("partner_documents").select("*").eq("tenant_id", tenantId).order("created_at", { ascending: false });
  if (error) return null;
  return (data ?? []).map((d) => ({ ...d, user_id: Number(d.user_id) })) as PartnerDoc[];
}

const ALLOWED = ["application/pdf", "image/jpeg", "image/png", "image/webp"];

export async function addDoc(v: {
  tenantId: number;
  userId: number;
  createdBy: number;
  docType: string;
  title: string;
  validUntil: string;
  note: string;
  file: File | null;
}): Promise<PartnerDoc> {
  let path: string | null = null;
  let name: string | null = null;
  if (v.file) {
    if (!ALLOWED.includes(v.file.type)) throw new Error("Bitte ein PDF oder ein Foto (JPG, PNG) wählen.");
    if (v.file.size > 10 * 1024 * 1024) throw new Error("Die Datei ist zu groß (höchstens 10 MB).");
    const ext = v.file.type === "application/pdf" ? "pdf" : v.file.type === "image/png" ? "png" : v.file.type === "image/webp" ? "webp" : "jpg";
    path = `${v.tenantId}/${v.userId}/${crypto.randomUUID()}.${ext}`;
    name = v.file.name.slice(0, 200);
    const { error } = await supabase.storage.from(BUCKET).upload(path, v.file, { contentType: v.file.type, upsert: false });
    if (error) throw new Error(missing(error.message) ? NEEDS_SQL : `Die Datei konnte nicht hochgeladen werden: ${error.message}`);
  }
  const { data, error } = await supabase
    .from("partner_documents")
    .insert({
      tenant_id: v.tenantId,
      user_id: v.userId,
      created_by: v.createdBy,
      doc_type: v.docType,
      title: v.title.trim() || null,
      valid_until: v.validUntil || null,
      note: v.note.trim() || null,
      file_path: path,
      file_name: name,
    })
    .select("*")
    .single();
  if (error) {
    if (path) await supabase.storage.from(BUCKET).remove([path]);
    throw new Error(missing(error.message) ? NEEDS_SQL : `Der Nachweis konnte nicht gespeichert werden: ${error.message}`);
  }
  return { ...data, user_id: Number(data.user_id) } as PartnerDoc;
}

export async function deleteDoc(d: PartnerDoc) {
  const { error } = await supabase.from("partner_documents").delete().eq("id", d.id);
  if (error) throw new Error(`Der Nachweis konnte nicht gelöscht werden: ${error.message}`);
  if (d.file_path) await supabase.storage.from(BUCKET).remove([d.file_path]);
}

export async function docUrl(path: string): Promise<string> {
  const { data, error } = await supabase.storage.from(BUCKET).createSignedUrl(path, 300);
  if (error || !data?.signedUrl) throw new Error("Die Datei konnte nicht geöffnet werden.");
  return data.signedUrl;
}
