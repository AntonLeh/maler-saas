// Owner-Werbung: Datenbank, Bilder, KI-Funktion
import { supabase } from "../../lib/supabase";
import type { GraphicData, Goal, Post, Texts } from "./logic";

const BUCKET = "owner-marketing";

const friendly = (err: unknown, fallback: string) => {
  const msg = String((err as { message?: string })?.message ?? err ?? "");
  if (/owner_marketing_posts|does not exist|schema cache/i.test(msg)) return "Für die Werbung fehlt noch das Datenbank-Update (SQL „Owner-Werbung“).";
  if (/failed to fetch|network/i.test(msg)) return "Keine Internetverbindung.";
  return fallback;
};

export async function loadPosts(): Promise<Post[]> {
  const { data, error } = await supabase.from("owner_marketing_posts").select("*").order("updated_at", { ascending: false }).limit(500);
  if (error) throw new Error(friendly(error, "Beiträge konnten nicht geladen werden."));
  return (data as Post[]) || [];
}

export async function savePost(id: number | null, values: Partial<Omit<Post, "id" | "created_at">>): Promise<Post> {
  const payload = { ...values, updated_at: new Date().toISOString() };
  const res = id
    ? await supabase.from("owner_marketing_posts").update(payload).eq("id", id).select("*").single()
    : await supabase.from("owner_marketing_posts").insert(payload).select("*").single();
  if (res.error) throw new Error(friendly(res.error, "Beitrag konnte nicht gespeichert werden."));
  return res.data as Post;
}

export async function deletePost(p: Post) {
  const { error } = await supabase.from("owner_marketing_posts").delete().eq("id", p.id);
  if (error) throw new Error(friendly(error, "Beitrag konnte nicht gelöscht werden."));
  if (p.images?.length) await supabase.storage.from(BUCKET).remove(p.images);
}

/** Bild verkleinern (max. 1600 px, JPEG) und hochladen */
export async function uploadImage(file: File): Promise<string> {
  let blob: Blob = file;
  try {
    const bmp = await createImageBitmap(file);
    const scale = Math.min(1, 1600 / Math.max(bmp.width, bmp.height));
    const c = document.createElement("canvas");
    c.width = Math.round(bmp.width * scale);
    c.height = Math.round(bmp.height * scale);
    c.getContext("2d")?.drawImage(bmp, 0, 0, c.width, c.height);
    blob = await new Promise<Blob>((res, rej) => c.toBlob((b) => (b ? res(b) : rej(new Error("x"))), "image/jpeg", 0.85));
  } catch {
    /* Original verwenden */
  }
  const path = `${new Date().getFullYear()}/${Date.now()}-${Math.random().toString(36).slice(2, 8)}.jpg`;
  const { error } = await supabase.storage.from(BUCKET).upload(path, blob, { contentType: "image/jpeg" });
  if (error) throw new Error(friendly(error, "Bild konnte nicht hochgeladen werden."));
  return path;
}

const urlCache = new Map<string, { url: string; at: number }>();
export async function imageUrl(path: string): Promise<string> {
  const hit = urlCache.get(path);
  if (hit && Date.now() - hit.at < 50 * 60 * 1000) return hit.url;
  const { data, error } = await supabase.storage.from(BUCKET).createSignedUrl(path, 3600);
  if (error || !data?.signedUrl) throw new Error("Bild konnte nicht geladen werden.");
  urlCache.set(path, { url: data.signedUrl, at: Date.now() });
  return data.signedUrl;
}

export type AiResult = { title: string; graphic: { headline: string; subline: string; points: string[] }; texts: Texts };

export async function generate(input: { topic: string; goal: Goal; keywords: string; youtube: boolean; image_paths: string[] }): Promise<AiResult> {
  const { data, error } = await supabase.functions.invoke("owner-marketing", { body: input });
  if (error) {
    let msg = "";
    try {
      const ctx = (error as { context?: Response }).context;
      if (ctx && typeof ctx.json === "function") msg = (await ctx.json())?.error ?? "";
    } catch {
      /* leer */
    }
    if (!msg && /Failed to send|not found/i.test(String(error.message))) msg = "Die Funktion „owner-marketing“ ist noch nicht hochgeladen.";
    throw new Error(msg || "Die Texte konnten nicht erstellt werden.");
  }
  if (!data?.ok) throw new Error(data?.error || "Die Texte konnten nicht erstellt werden.");
  return data.result as AiResult;
}

export const defaultGraphic = (goal: Goal, ai?: AiResult["graphic"], image: string | null = null): GraphicData => ({
  template: goal === "testphase" ? "angebot" : goal === "tipp" ? "tipp" : "funktion",
  format: "1x1",
  headline: ai?.headline ?? "",
  subline: ai?.subline ?? "",
  points: ai?.points ?? [],
  image,
});

/** Bildquelle auflösen: Screenshot der Website oder hochgeladenes Bild */
export async function resolveImage(image: string | null): Promise<string | null> {
  if (!image) return null;
  if (image.startsWith("/images/")) return image;
  return imageUrl(image);
}
