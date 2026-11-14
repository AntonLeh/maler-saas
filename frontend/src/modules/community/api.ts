// MalerTreff-Community: Datenbank-Aufrufe und Fotos
import { supabase } from "../../lib/supabase";
import { fitSize } from "./logic";
import type { Access, Notice, OwnerOverview, Post, Profile, Queue, StaffEntry } from "./logic";

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
