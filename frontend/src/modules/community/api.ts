// MalerTreff-Community: Datenbank-Aufrufe und Fotos
import { supabase, supabaseUrl } from "../../lib/supabase";
import { fitSize, proofExt, withHttps } from "./logic";
import type { Access, Notice, OwnerOverview, Post, Profile, Queue, SignupForm, StaffEntry, VerifyEntry } from "./logic";

export const NEEDS_SQL = "Für die Community fehlt noch das Datenbank-Update (SQL „Community“).";
const missing = (m: string) => /schema cache|does not exist|Could not find the function/i.test(m);

async function rpc<T>(fn: string, args: Record<string, unknown> = {}): Promise<T> {
  const { data, error } = await supabase.rpc(fn, args);
  if (error) throw new Error(missing(error.message) ? NEEDS_SQL : error.message);
  return data as T;
}

/** null = Datenbank-Update fehlt */
export async function loadAccess(): Promise<Access | null> {
  const { data, error } = await supabase.rpc("community_access");
  if (error) return null;
  return data as Access;
}

export const join = (rulesVersion: string) => rpc<Access>("community_join", { p_rules_version: rulesVersion });
export const feed = (o: { topic?: string | null; author?: number | null; before?: number | null; query?: string | null } = {}) =>
  rpc<Post[]>("community_feed", { p_topic: o.topic ?? null, p_author: o.author ?? null, p_before: o.before ?? null, p_query: o.query ?? null });
export const getPost = (id: number) => rpc<Post | null>("community_post_get", { p_id: id });
export const createPost = (kind: string, topic: string, body: string, images: string[]) =>
  rpc<number>("community_post_create", { p_kind: kind, p_topic: topic, p_body: body, p_images: images });
export const updatePost = (id: number, topic: string, body: string) => rpc<void>("community_post_update", { p_id: id, p_topic: topic, p_body: body });
export async function deletePost(id: number) {
  const images = await rpc<string[] | null>("community_post_delete", { p_id: id });
  if (images?.length) await deleteImages(images);
}
export const createComment = (post: number, body: string) => rpc<number>("community_comment_create", { p_post: post, p_body: body });
export const deleteComment = (id: number) => rpc<void>("community_comment_delete", { p_id: id });
export const markSolution = (post: number, comment: number | null) => rpc<void>("community_mark_solution", { p_post: post, p_comment: comment });
export const helpful = (post: number | null, comment: number | null) => rpc<boolean>("community_helpful", { p_post: post, p_comment: comment });
export const report = (type: string, id: number, reason: string, note: string) =>
  rpc<string>("community_report", { p_type: type, p_id: id, p_reason: reason, p_note: note });
export const notices = () => rpc<Notice[]>("community_notices_list");
export const noticesRead = () => rpc<void>("community_notices_read");
export const appeal = (decision: number, text: string) => rpc<void>("community_appeal", { p_decision: decision, p_text: text });
export const profile = (member: number) => rpc<Profile | null>("community_profile", { p_member: member });
export const updateProfile = (trade: string, region: string, bio: string) =>
  rpc<void>("community_profile_update", { p_trade: trade, p_region: region, p_bio: bio });

export const modQueue = () => rpc<Queue>("community_mod_queue");
export const modDecide = (type: string, id: number, action: string, rule: string, note: string) =>
  rpc<number>("community_mod_decide", { p_type: type, p_id: id, p_action: action, p_rule: rule, p_note: note });
export const modAppeal = (decision: number, uphold: boolean, note: string) =>
  rpc<void>("community_mod_appeal_decide", { p_decision: decision, p_uphold: uphold, p_note: note });

export const ownerOverview = () => rpc<OwnerOverview>("community_owner_overview");
export const saveSettings = (enabled: boolean, betaTenants: number[]) =>
  rpc<void>("community_settings_set", { p_enabled: enabled, p_beta_tenants: betaTenants });
export const setModerator = (member: number, on: boolean) => rpc<void>("community_set_moderator", { p_member: member, p_on: on });

export const staffList = () => rpc<StaffEntry[]>("community_staff_list");
export const staffDecide = (member: number, action: "freigeben" | "ablehnen" | "entziehen", confirm16: boolean) =>
  rpc<void>("community_staff_decide", { p_member: member, p_action: action, p_confirm_16: confirm16 });

// ---------- Fotos ----------
const BUCKET = "community";

/** Foto verkleinern und als JPEG neu speichern – dabei fallen alle Metadaten (auch GPS) weg */
async function shrink(file: File): Promise<Blob> {
  const bmp = await createImageBitmap(file).catch(() => null);
  if (!bmp) throw new Error(`„${file.name}“ ist kein lesbares Foto.`);
  const { w, h } = fitSize(bmp.width, bmp.height);
  const canvas = document.createElement("canvas");
  canvas.width = w;
  canvas.height = h;
  canvas.getContext("2d")!.drawImage(bmp, 0, 0, w, h);
  bmp.close?.();
  const blob = await new Promise<Blob | null>((r) => canvas.toBlob(r, "image/jpeg", 0.82));
  if (!blob) throw new Error("Foto konnte nicht verarbeitet werden.");
  return blob;
}

export async function uploadImages(files: File[]): Promise<string[]> {
  const { data } = await supabase.auth.getUser();
  const uid = data.user?.id;
  if (!uid) throw new Error("Bitte erneut anmelden.");
  const paths: string[] = [];
  for (const f of files) {
    const blob = await shrink(f);
    const path = `${uid}/${crypto.randomUUID()}.jpg`;
    const { error } = await supabase.storage.from(BUCKET).upload(path, blob, { contentType: "image/jpeg", upsert: false });
    if (error) {
      if (paths.length) await deleteImages(paths);
      throw new Error(/bucket|not found/i.test(error.message) ? NEEDS_SQL : `Foto-Upload fehlgeschlagen: ${error.message}`);
    }
    paths.push(path);
  }
  return paths;
}

export async function deleteImages(paths: string[]) {
  if (paths.length) await supabase.storage.from(BUCKET).remove(paths);
}

const urlCache = new Map<string, { url: string; until: number }>();
/** Vorübergehende Links (1 Stunde) für private Fotos, mit Zwischenspeicher */
export async function imageUrls(paths: string[]): Promise<Record<string, string>> {
  const now = Date.now();
  const out: Record<string, string> = {};
  const need = paths.filter((p) => {
    const c = urlCache.get(p);
    if (c && c.until > now) out[p] = c.url;
    return !(c && c.until > now);
  });
  if (need.length) {
    const { data } = await supabase.storage.from(BUCKET).createSignedUrls(need, 3600);
    for (const d of data ?? []) {
      if (d.signedUrl && d.path) {
        out[d.path] = d.signedUrl;
        urlCache.set(d.path, { url: d.signedUrl, until: now + 50 * 60 * 1000 });
      }
    }
  }
  return out;
}

// ---------- Konten für Externe ----------
/** Server-Funktion „community“ (Freigabe mit E-Mail, Konto löschen) */
async function callFn<T>(action: string, body: Record<string, unknown> = {}): Promise<T> {
  const { data } = await supabase.auth.getSession();
  const token = data.session?.access_token;
  if (!token) throw new Error("Bitte erneut anmelden.");
  let res: Response;
  try {
    res = await fetch(`${supabaseUrl}/functions/v1/community`, {
      method: "POST",
      headers: { "content-type": "application/json", authorization: `Bearer ${token}` },
      body: JSON.stringify({ action, ...body }),
    });
  } catch {
    throw new Error("Der Server ist gerade nicht erreichbar. Bitte später noch einmal versuchen.");
  }
  if (res.status === 404) throw new Error("Die Server-Funktion „community“ ist noch nicht bereitgestellt.");
  const out = await res.json().catch(() => ({}));
  if (!res.ok || !out.ok) throw new Error(out.error || `Fehler (Status ${res.status}).`);
  return out as T;
}

/** Ist die Anmeldung für Externe offen? (auch ohne Login) – null = Datenbank-Update fehlt */
export async function signupOpen(): Promise<boolean | null> {
  const { data, error } = await supabase.rpc("community_signup_open");
  if (error) return null;
  return !!data;
}

/** Öffentliche Angaben für die Seite /malertreff – null = Datenbank-Update fehlt */
export async function publicInfo(): Promise<{ signup_open: boolean; rules_version: string } | null> {
  const { data, error } = await supabase.rpc("community_public_info");
  if (error || !data) return null;
  return data as { signup_open: boolean; rules_version: string };
}

export async function signupExternal(f: SignupForm, rulesVersion: string): Promise<void> {
  const { error } = await supabase.auth.signUp({
    email: f.email.trim(),
    password: f.password,
    options: {
      emailRedirectTo: `${window.location.origin}/malertreff`,
      data: {
        signup_type: "community",
        community_kind: f.kind,
        first_name: f.first_name.trim(),
        last_name: f.last_name.trim(),
        company: f.kind === "privat" ? "" : f.company.trim(),
        trade: f.trade.trim(),
        region: f.region.trim(),
        website: f.kind === "zulieferer" ? withHttps(f.website) : "",
        impressum_url: f.kind === "zulieferer" ? withHttps(f.impressum_url) : "",
        age16: f.age16,
        community_rules: rulesVersion,
        community_accepted_at: new Date().toISOString(),
      },
    },
  });
  if (error) throw error;
}

export const externalSet = (on: boolean) => rpc<void>("community_external_set", { p_on: on });
export const profileLinks = (website: string, impressum: string) => rpc<void>("community_profile_links", { p_website: website, p_impressum: impressum });
export const verifyList = () => rpc<VerifyEntry[]>("community_verify_list");
export const verifyDecide = (member: number, approve: boolean, reason: string) => callFn<{ mailed: boolean }>("verify", { member, approve, reason });
export const deleteAccount = () => callFn<void>("delete_account");

const PROOFS = "community-proofs";
export async function uploadProof(file: File): Promise<void> {
  const ext = proofExt(file);
  if (!ext) throw new Error("Bitte eine PDF-Datei oder ein Foto (JPG, PNG) hochladen.");
  if (file.size > 10 * 1024 * 1024) throw new Error("Die Datei ist größer als 10 MB.");
  const { data } = await supabase.auth.getUser();
  const uid = data.user?.id;
  if (!uid) throw new Error("Bitte erneut anmelden.");
  const path = `${uid}/${crypto.randomUUID()}.${ext}`;
  const { error } = await supabase.storage.from(PROOFS).upload(path, file, { contentType: file.type, upsert: false });
  if (error) throw new Error(/bucket|not found/i.test(error.message) ? NEEDS_SQL : `Upload fehlgeschlagen: ${error.message}`);
  await rpc<void>("community_proof_submit", { p_path: path });
}

/** Nachweis für die Moderation öffnen (Link 10 Minuten gültig) */
export async function proofUrl(path: string): Promise<string> {
  const { data, error } = await supabase.storage.from(PROOFS).createSignedUrl(path, 600);
  if (error || !data?.signedUrl) throw new Error("Nachweis konnte nicht geöffnet werden.");
  return data.signedUrl;
}
