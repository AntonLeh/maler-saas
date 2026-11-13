// Owner-Werbung: Datenbank, Bilder, KI-Funktion
import { supabase } from "../../lib/supabase";
import type { AgentSettings, Article, GraphicData, Goal, KeywordIdea, LibImage, Post, Proposal, Shotlist, Texts } from "./logic";
import { DEFAULT_AGENT, parseGscCsv } from "./logic";
import type { AdCost, OriginData } from "./success";

const BUCKET = "owner-marketing";

const friendly = (err: unknown, fallback: string) => {
  const msg = String((err as { message?: string })?.message ?? err ?? "");
  if (/owner_marketing_agent|(source|approved_at|plan_month|agent_reason|hook|channels).*(column|schema cache)|column.*(source|approved_at|plan_month|agent_reason|hook|channels)/i.test(msg)) return "Für den Agenten fehlt noch das Datenbank-Update (SQL „Owner-Agent“).";
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

async function callFn<T>(body: Record<string, unknown>, fallback: string): Promise<T> {
  const { data, error } = await supabase.functions.invoke("owner-marketing", { body });
  if (error) {
    let msg = "";
    try {
      const ctx = (error as { context?: Response }).context;
      if (ctx && typeof ctx.json === "function") msg = (await ctx.json())?.error ?? "";
    } catch {
      /* leer */
    }
    if (!msg && /Failed to send|not found/i.test(String(error.message))) msg = "Die Funktion „owner-marketing“ ist noch nicht hochgeladen.";
    throw new Error(msg || fallback);
  }
  if (!data?.ok) throw new Error(data?.error || fallback);
  return data as T;
}

/** KI-Stimme (ElevenLabs) für einen Text → MP3 */
export async function voice(text: string, which: "female" | "male"): Promise<ArrayBuffer> {
  const r = await callFn<{ audio: string }>({ action: "voice", text, voice: which }, "Die Stimme konnte nicht erzeugt werden.");
  const bin = atob(r.audio);
  const bytes = new Uint8Array(bin.length);
  for (let i = 0; i < bin.length; i++) bytes[i] = bin.charCodeAt(i);
  return bytes.buffer;
}

export const shotlist = (topic: string, script: string) =>
  callFn<{ shotlist: Shotlist }>({ action: "shotlist", topic, script }, "Die Drehanleitung konnte nicht erstellt werden.").then((r) => r.shotlist);

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

// ---------- Content- & Planungs-Agent ----------
/** Einstellungen; null = Datenbank-Update fehlt */
export async function loadAgent(): Promise<AgentSettings | null> {
  const { data, error } = await supabase.from("owner_marketing_agent").select("*").eq("id", 1).maybeSingle();
  if (error) return null;
  if (!data) return { ...DEFAULT_AGENT };
  return {
    auto_enabled: !!data.auto_enabled,
    weekdays: Array.isArray(data.weekdays) && data.weekdays.length ? data.weekdays.map(Number) : DEFAULT_AGENT.weekdays,
    channels: Array.isArray(data.channels) && data.channels.length ? data.channels : DEFAULT_AGENT.channels,
    mix: { ...DEFAULT_AGENT.mix, ...(data.mix ?? {}) },
    youtube_per_month: Number(data.youtube_per_month) || 0,
    last_plan_month: data.last_plan_month ?? null,
  };
}

export async function saveAgent(s: AgentSettings) {
  const { error } = await supabase.from("owner_marketing_agent").upsert({
    id: 1,
    auto_enabled: s.auto_enabled,
    weekdays: s.weekdays,
    per_week: Math.max(1, Math.min(7, s.weekdays.length)),
    channels: s.channels,
    mix: s.mix,
    youtube_per_month: s.youtube_per_month,
    updated_at: new Date().toISOString(),
  });
  if (error) throw new Error(friendly(error, "Die Einstellungen konnten nicht gespeichert werden."));
}

const OLD_FN = "Die Funktion „owner-marketing“ ist noch die alte Fassung – bitte im Terminal neu veröffentlichen: npx supabase functions deploy owner-marketing --no-verify-jwt";

export async function proposePlan(v: { start: string; weeks: number; weekdays: number[]; mix: AgentSettings["mix"]; youtube_per_month: number }): Promise<Proposal[]> {
  const r = await callFn<{ items?: Proposal[] }>({ action: "plan", ...v }, "Der Plan konnte nicht erstellt werden.");
  if (!Array.isArray(r.items)) throw new Error(OLD_FN);
  return r.items;
}

/** Vorschläge als Entwürfe speichern (noch ohne Texte) */
export async function acceptProposals(items: Proposal[], channels: string[]): Promise<Post[]> {
  const rows = items.map((it) => ({
    topic: it.topic,
    goal: it.goal,
    keywords: it.keywords || null,
    hook: it.hook || null,
    agent_reason: it.reason || null,
    title: it.topic,
    texts: {},
    status: "entwurf",
    planned_for: it.date,
    source: "agent",
    plan_month: it.date.slice(0, 7),
    channels: it.youtube ? [...new Set([...channels, "youtube"])] : channels.filter((c) => c !== "youtube"),
    updated_at: new Date().toISOString(),
  }));
  const { data, error } = await supabase.from("owner_marketing_posts").insert(rows).select("*");
  if (error) throw new Error(friendly(error, "Die Vorschläge konnten nicht gespeichert werden."));
  return (data as Post[]) ?? [];
}

/** Texte für bis zu 3 Beiträge schreiben lassen (mehrfach aufrufen, bis remaining = 0) */
export async function prepare(ids: number[]) {
  const r = await callFn<{ done?: number; failed?: number; remaining?: number }>({ action: "prepare", ids }, "Die Texte konnten nicht erstellt werden.");
  if (typeof r.remaining !== "number") throw new Error(OLD_FN);
  return { done: r.done ?? 0, failed: r.failed ?? 0, remaining: r.remaining };
}

export async function approve(p: Post): Promise<Post> {
  return savePost(p.id, { approved_at: new Date().toISOString(), status: p.planned_for ? "geplant" : "entwurf" });
}

// ---------- Erfolgsmessung ----------

/** Herkunft je Firma; null = Datenbank-Update fehlt */
export async function loadOrigins(): Promise<Map<number, OriginData> | null> {
  const { data, error } = await supabase.rpc("owner_signup_origins");
  if (error) return null;
  const m = new Map<number, OriginData>();
  for (const r of (data ?? []) as { tenant_id: number; origin: OriginData }[]) m.set(Number(r.tenant_id), r.origin ?? null);
  return m;
}

export async function loadAdCosts(): Promise<AdCost[] | null> {
  const { data, error } = await supabase.from("owner_ad_costs").select("*").order("created_at", { ascending: false });
  if (error) return null;
  return (data ?? []).map((c) => ({ ...c, amount: Number(c.amount) })) as AdCost[];
}

export async function addAdCost(v: Omit<AdCost, "id" | "created_at">) {
  const { error } = await supabase.from("owner_ad_costs").insert(v);
  if (error) throw new Error(/owner_ad_costs|schema cache/i.test(error.message) ? "Dafür fehlt noch das Datenbank-Update (SQL „Erfolgsmessung“)." : "Die Kosten konnten nicht gespeichert werden.");
}

export async function deleteAdCost(id: number) {
  const { error } = await supabase.from("owner_ad_costs").delete().eq("id", id);
  if (error) throw new Error("Die Kosten konnten nicht gelöscht werden.");
}

// ---------- Bildbibliothek ----------
const IMG_SQL = "Für die Bildbibliothek fehlt noch das Datenbank-Update (SQL „Owner-Bilder“).";

/** null = Datenbank-Update fehlt */
export async function loadImages(): Promise<LibImage[] | null> {
  const { data, error } = await supabase.from("owner_marketing_images").select("*").order("created_at", { ascending: false }).limit(1000);
  if (error) return null;
  return (data ?? []).map((r) => ({ ...r, tags: r.tags ?? [] })) as LibImage[];
}

/** Bild verkleinern (max. 1600 px), in library/ hochladen und eintragen */
export async function uploadLibraryImage(file: File): Promise<LibImage> {
  let blob: Blob = file;
  let width: number | null = null;
  let height: number | null = null;
  try {
    const bmp = await createImageBitmap(file);
    const scale = Math.min(1, 1600 / Math.max(bmp.width, bmp.height));
    const c = document.createElement("canvas");
    c.width = Math.round(bmp.width * scale);
    c.height = Math.round(bmp.height * scale);
    c.getContext("2d")?.drawImage(bmp, 0, 0, c.width, c.height);
    width = c.width;
    height = c.height;
    blob = await new Promise<Blob>((res, rej) => c.toBlob((b) => (b ? res(b) : rej(new Error("x"))), "image/jpeg", 0.86));
  } catch {
    /* Original verwenden */
  }
  const path = `library/${Date.now()}-${Math.random().toString(36).slice(2, 8)}.jpg`;
  const up = await supabase.storage.from(BUCKET).upload(path, blob, { contentType: "image/jpeg" });
  if (up.error) throw new Error(friendly(up.error, "Bild konnte nicht hochgeladen werden."));
  const { data, error } = await supabase.from("owner_marketing_images").insert({ path, width, height }).select("*").single();
  if (error) {
    await supabase.storage.from(BUCKET).remove([path]);
    throw new Error(/owner_marketing_images|schema cache/i.test(error.message) ? IMG_SQL : "Bild konnte nicht gespeichert werden.");
  }
  return { ...data, tags: data.tags ?? [] } as LibImage;
}

export async function updateImage(id: number, v: Partial<Pick<LibImage, "description" | "tags" | "realistic" | "ai_generated">>) {
  const { error } = await supabase.from("owner_marketing_images").update(v).eq("id", id);
  if (error) throw new Error("Bild konnte nicht gespeichert werden.");
}

export async function deleteImage(img: LibImage) {
  const { error } = await supabase.from("owner_marketing_images").delete().eq("id", img.id);
  if (error) throw new Error("Bild konnte nicht gelöscht werden.");
  await supabase.storage.from(BUCKET).remove([img.path]);
}

/** KI beschreibt bis zu 4 Bilder je Aufruf (mehrfach aufrufen, bis remaining = 0) */
export async function tagImages(ids: number[] = []) {
  const r = await callFn<{ done?: number; failed?: number; remaining?: number }>({ action: "tag_images", ids }, "Die Bilder konnten nicht beschrieben werden.");
  if (typeof r.remaining !== "number") throw new Error(OLD_FN);
  return { done: r.done ?? 0, failed: r.failed ?? 0, remaining: r.remaining };
}

// ---------- SEO-Agent: Ratgeber ----------
const ART_SQL = "Für den Ratgeber fehlt noch das Datenbank-Update (SQL „Ratgeber“).";

/** null = Datenbank-Update fehlt */
export async function loadArticles(): Promise<Article[] | null> {
  const { data, error } = await supabase.from("owner_articles").select("*").order("updated_at", { ascending: false }).limit(500);
  if (error) return null;
  return (data ?? []) as Article[];
}

export async function saveArticle(id: number | null, v: Partial<Omit<Article, "id" | "created_at">>): Promise<Article> {
  const payload = { ...v, updated_at: new Date().toISOString() };
  const res = id
    ? await supabase.from("owner_articles").update(payload).eq("id", id).select("*").single()
    : await supabase.from("owner_articles").insert(payload).select("*").single();
  if (res.error) {
    const m = res.error.message;
    if (/duplicate key|unique/i.test(m)) throw new Error("Diese Adresse (Slug) gibt es schon – bitte eine andere wählen.");
    if (/slug_check|check constraint/i.test(m)) throw new Error("Die Adresse darf nur Kleinbuchstaben, Zahlen und Bindestriche enthalten.");
    throw new Error(/owner_articles|schema cache/i.test(m) ? ART_SQL : "Der Artikel konnte nicht gespeichert werden.");
  }
  return res.data as Article;
}

export async function deleteArticle(id: number) {
  const { error } = await supabase.from("owner_articles").delete().eq("id", id);
  if (error) throw new Error("Der Artikel konnte nicht gelöscht werden.");
}

export async function keywordIdeas(queries = ""): Promise<KeywordIdea[]> {
  const r = await callFn<{ items?: KeywordIdea[] }>({ action: "seo_keywords", queries }, "Es konnten keine Vorschläge erstellt werden.");
  if (!Array.isArray(r.items)) throw new Error(OLD_FN);
  return r.items;
}

export type ArticleDraft = Pick<Article, "title" | "meta_title" | "meta_description" | "slug" | "intro" | "body" | "faq" | "related_pages" | "keyword" | "image_path" | "image_alt" | "image_ai_label">;

// ---------- Ratgeber-Titelbild ----------
const PUBLIC_BUCKET = "ratgeber";
export const publicImageUrl = (path: string) => supabase.storage.from(PUBLIC_BUCKET).getPublicUrl(path).data.publicUrl;
/** Öffentlicher Name des Bilds: <slug>/<dateiname> – ändert sich, wenn ein anderes Bild gewählt wird */
export const publicNameFor = (slug: string, imagePath: string) => `${slug}/${imagePath.split("/").pop()?.replace(/[^a-z0-9._-]/gi, "") || "bild.jpg"}`;

/** Bild aus der privaten Bibliothek in den öffentlichen Ratgeber-Speicher kopieren */
export async function copyToPublic(slug: string, imagePath: string): Promise<string> {
  const target = publicNameFor(slug, imagePath);
  const { data, error } = await supabase.storage.from(BUCKET).download(imagePath);
  if (error || !data) throw new Error("Das Titelbild konnte nicht geladen werden.");
  const up = await supabase.storage.from(PUBLIC_BUCKET).upload(target, data, { contentType: data.type || "image/jpeg", upsert: true, cacheControl: "604800" });
  if (up.error) throw new Error(/bucket|not found|policy|row-level/i.test(up.error.message) ? "Für Ratgeber-Bilder fehlt noch das Datenbank-Update (SQL „Ratgeber-Bilder“)." : "Das Titelbild konnte nicht veröffentlicht werden.");
  return target;
}

export async function removePublic(path: string | null | undefined) {
  if (path) await supabase.storage.from(PUBLIC_BUCKET).remove([path]);
}
export async function writeArticle(keyword: string, title = ""): Promise<ArticleDraft> {
  const r = await callFn<{ article?: ArticleDraft }>({ action: "seo_article", keyword, title }, "Der Artikel konnte nicht erstellt werden.");
  if (!r.article) throw new Error(OLD_FN);
  return r.article;
}

/** Search-Console-Export lesen: ZIP (enthält Suchanfragen.csv/Queries.csv) oder direkt die CSV */
export async function readGscExport(file: File): Promise<{ query: string; impressions: number }[]> {
  const { unzipSync, strFromU8 } = await import("fflate");
  const bytes = new Uint8Array(await file.arrayBuffer());
  let csv = "";
  if (/\.zip$/i.test(file.name) || (bytes[0] === 0x50 && bytes[1] === 0x4b)) {
    let files: Record<string, Uint8Array>;
    try {
      files = unzipSync(bytes);
    } catch {
      throw new Error("Die ZIP-Datei konnte nicht geöffnet werden.");
    }
    const name = Object.keys(files).find((n) => /(suchanfragen|queries)\.csv$/i.test(n));
    if (!name) throw new Error("In der ZIP-Datei fehlt „Suchanfragen.csv“. Bitte in der Search Console unter Leistung → Exportieren → „CSV herunterladen“ wählen.");
    csv = strFromU8(files[name]);
  } else {
    csv = await file.text();
  }
  const list = parseGscCsv(csv);
  if (!list.length) throw new Error("In der Datei wurden keine Suchanfragen gefunden.");
  return list;
}
