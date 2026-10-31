import { supabase } from "../../lib/supabase";
import type { CompanyInfo, OrderImage, OrderOption, Website, WebsiteImage, WebsiteLead, WebsiteReference } from "./types";
import { DEFAULT_HIGHLIGHTS, DEFAULT_SECTIONS, DEFAULT_SERVICES } from "./types";

const BUCKET = "website-media";

function fail(context: string, error: { message: string; code?: string } | null): never {
  const msg = error?.message ?? "Unbekannter Fehler";
  if ((msg.includes("websites") || msg.includes("website_")) && (msg.includes("does not exist") || msg.includes("schema cache"))) {
    throw new Error("Die Tabellen für die Website fehlen noch. Bitte die SQL-Datei supabase/migrations/20261031120000_website.sql im Supabase SQL-Editor ausführen.");
  }
  if (error?.code === "23505" && msg.includes("slug")) throw new Error("Diese Web-Adresse ist schon vergeben. Bitte eine andere wählen.");
  throw new Error(`${context}: ${msg}`);
}

// ---------------------------------------------------------------------
// Website
// ---------------------------------------------------------------------
export async function loadWebsite(tenantId: number): Promise<Website | null> {
  const { data, error } = await supabase.from("websites").select("*").eq("tenant_id", tenantId).maybeSingle();
  if (error) fail("Website laden", error);
  return (data as Website) ?? null;
}

export async function createWebsite(tenantId: number, slug: string, company: CompanyInfo | null): Promise<Website> {
  const city = company?.city?.trim() || "";
  const { data, error } = await supabase
    .from("websites")
    .insert({
      tenant_id: tenantId,
      slug,
      hero_title: city ? `Ihr Malerbetrieb in ${city}` : "Ihr Malerbetrieb in der Region",
      highlights: DEFAULT_HIGHLIGHTS,
      services: DEFAULT_SERVICES.slice(0, 4),
      service_area: city,
      sections: DEFAULT_SECTIONS,
      opening_hours: "Mo–Fr 7:00–17:00 Uhr",
    })
    .select("*")
    .single();
  if (error) fail("Website anlegen", error);
  return data as Website;
}

export async function saveWebsite(tenantId: number, values: Partial<Website>): Promise<Website> {
  const payload = { ...values, updated_at: new Date().toISOString() } as Record<string, unknown>;
  delete payload.tenant_id;
  delete payload.preview_token;
  const { data, error } = await supabase.from("websites").update(payload).eq("tenant_id", tenantId).select("*").single();
  if (error) fail("Website speichern", error);
  return data as Website;
}

export async function loadCompany(tenantId: number): Promise<CompanyInfo | null> {
  const { data } = await supabase
    .from("company_settings")
    .select("company_name, street, zip, city, phone, email, vat_id, logo_url")
    .eq("tenant_id", tenantId)
    .maybeSingle();
  return (data as CompanyInfo) ?? null;
}

// ---------------------------------------------------------------------
// Bilder: verkleinern, Metadaten (z. B. GPS-Position) entfernen, hochladen
// ---------------------------------------------------------------------
export async function processImage(input: Blob, maxSize = 1600): Promise<Blob> {
  let bitmap: ImageBitmap;
  try {
    bitmap = await createImageBitmap(input, { imageOrientation: "from-image" });
  } catch {
    throw new Error("Das Bild konnte nicht gelesen werden (erlaubt: JPG, PNG, WebP).");
  }
  const scale = Math.min(1, maxSize / Math.max(bitmap.width, bitmap.height));
  const w = Math.round(bitmap.width * scale);
  const h = Math.round(bitmap.height * scale);
  const canvas = document.createElement("canvas");
  canvas.width = w;
  canvas.height = h;
  const ctx = canvas.getContext("2d");
  if (!ctx) throw new Error("Bildbearbeitung im Browser nicht möglich.");
  ctx.drawImage(bitmap, 0, 0, w, h);
  bitmap.close?.();
  // Neu kodiertes JPEG enthält keine EXIF-Daten mehr (keine Kamera-/Standortdaten)
  const blob = await new Promise<Blob | null>((resolve) => canvas.toBlob(resolve, "image/jpeg", 0.84));
  if (!blob) throw new Error("Das Bild konnte nicht umgewandelt werden.");
  return blob;
}

export async function uploadImage(tenantId: number, blob: Blob, prefix: string): Promise<WebsiteImage> {
  const path = `${tenantId}/${prefix}-${Date.now()}-${Math.random().toString(36).slice(2, 8)}.jpg`;
  const { error } = await supabase.storage.from(BUCKET).upload(path, blob, { contentType: "image/jpeg", cacheControl: "31536000", upsert: false });
  if (error) {
    if (/bucket not found/i.test(error.message)) {
      throw new Error("Der Bildspeicher fehlt noch. Bitte die SQL-Datei 20261031120000_website.sql ausführen.");
    }
    throw new Error(`Bild hochladen: ${error.message}`);
  }
  const { data } = supabase.storage.from(BUCKET).getPublicUrl(path);
  return { url: data.publicUrl, path };
}

export async function removeImages(paths: string[]) {
  const clean = paths.filter(Boolean);
  if (clean.length) await supabase.storage.from(BUCKET).remove(clean);
}

export function pathFromPublicUrl(url: string | null | undefined): string | null {
  const marker = `/storage/v1/object/public/${BUCKET}/`;
  if (!url || !url.includes(marker)) return null;
  return url.split(marker)[1].split("?")[0];
}

// ---------------------------------------------------------------------
// Referenzen
// ---------------------------------------------------------------------
export async function loadReferences(tenantId: number): Promise<WebsiteReference[]> {
  const { data, error } = await supabase
    .from("website_references")
    .select("*")
    .eq("tenant_id", tenantId)
    .order("created_at", { ascending: false });
  if (error) fail("Referenzen laden", error);
  return (data ?? []) as WebsiteReference[];
}

export type ReferenceInput = {
  order_id: string | null;
  title: string;
  text: string | null;
  city: string | null;
  images: WebsiteImage[];
  consent_confirmed: boolean;
  status: "entwurf" | "veroeffentlicht";
};

export async function saveReference(tenantId: number, userId: number, input: ReferenceInput, existing?: WebsiteReference | null): Promise<WebsiteReference> {
  const publishedAt =
    input.status === "veroeffentlicht" ? (existing?.status === "veroeffentlicht" ? existing.published_at : new Date().toISOString()) : null;
  const row = { ...input, published_at: publishedAt, updated_at: new Date().toISOString() };
  const query = existing
    ? supabase.from("website_references").update(row).eq("id", existing.id).eq("tenant_id", tenantId)
    : supabase.from("website_references").insert({ ...row, tenant_id: tenantId, created_by: userId });
  const { data, error } = await query.select("*").single();
  if (error) fail("Referenz speichern", error);
  return data as WebsiteReference;
}

export async function deleteReference(tenantId: number, ref: WebsiteReference) {
  const { error } = await supabase.from("website_references").delete().eq("id", ref.id).eq("tenant_id", tenantId);
  if (error) fail("Referenz löschen", error);
  await removeImages((ref.images ?? []).map((i) => i.path));
}

// ---------------------------------------------------------------------
// Aufträge und ihre Baustellenbilder (Quelle für Referenzen)
// ---------------------------------------------------------------------
export async function loadOrders(tenantId: number): Promise<OrderOption[]> {
  const { data, error } = await supabase
    .from("orders")
    .select("id, title, status, address_city, end_date, created_at")
    .eq("tenant_id", tenantId)
    .order("created_at", { ascending: false })
    .limit(200);
  if (error) fail("Aufträge laden", error);
  const done = ["fertig", "abgerechnet", "abgeschlossen", "erledigt"];
  return ((data ?? []) as OrderOption[]).sort((a, b) => Number(done.includes(b.status)) - Number(done.includes(a.status)));
}

function progressPath(filePath: string | null, imageUrl: string | null): string | null {
  const stored = String(filePath || imageUrl || "");
  if (!stored) return null;
  const pub = "/storage/v1/object/public/order-progress-images/";
  const sign = "/storage/v1/object/sign/order-progress-images/";
  let p = stored;
  if (stored.includes(pub)) p = stored.split(pub)[1];
  else if (stored.includes(sign)) p = stored.split(sign)[1].split("?")[0];
  return decodeURIComponent(p).replace(/^order-progress-images\//, "");
}

export async function loadOrderImages(tenantId: number, orderId: string): Promise<OrderImage[]> {
  const { data: progress, error } = await supabase
    .from("order_progress")
    .select("id")
    .eq("tenant_id", tenantId)
    .eq("order_id", orderId);
  if (error) fail("Baustellenbilder laden", error);
  const ids = (progress ?? []).map((p: { id: number }) => p.id);
  if (!ids.length) return [];
  const { data: images, error: imgErr } = await supabase
    .from("order_progress_images")
    .select("id, image_url, file_path, created_at")
    .in("progress_id", ids)
    .order("created_at", { ascending: true });
  if (imgErr) fail("Baustellenbilder laden", imgErr);
  const out: OrderImage[] = [];
  for (const img of (images ?? []) as { id: number; image_url: string | null; file_path: string | null }[]) {
    const path = progressPath(img.file_path, img.image_url);
    if (!path) continue;
    const { data } = await supabase.storage.from("order-progress-images").createSignedUrl(path, 3600);
    if (data?.signedUrl) out.push({ id: img.id, url: data.signedUrl });
  }
  return out;
}

/** Baustellenbild (privat) -> bereinigte Kopie im öffentlichen Website-Speicher */
export async function copyOrderImage(tenantId: number, signedUrl: string): Promise<WebsiteImage> {
  const res = await fetch(signedUrl);
  if (!res.ok) throw new Error("Ein Baustellenbild konnte nicht geladen werden.");
  return uploadImage(tenantId, await processImage(await res.blob()), "ref");
}

// ---------------------------------------------------------------------
// Anfragen
// ---------------------------------------------------------------------
export async function loadLeads(tenantId: number): Promise<WebsiteLead[]> {
  const { data, error } = await supabase
    .from("website_leads")
    .select("id, name, email, phone, message, status, created_at")
    .eq("tenant_id", tenantId)
    .order("created_at", { ascending: false })
    .limit(200);
  if (error) fail("Anfragen laden", error);
  return (data ?? []) as WebsiteLead[];
}

export async function setLeadStatus(tenantId: number, id: number, status: "neu" | "erledigt") {
  const { error } = await supabase.from("website_leads").update({ status }).eq("id", id).eq("tenant_id", tenantId);
  if (error) fail("Anfrage aktualisieren", error);
}

export async function deleteLead(tenantId: number, id: number) {
  const { error } = await supabase.from("website_leads").delete().eq("id", id).eq("tenant_id", tenantId);
  if (error) fail("Anfrage löschen", error);
}

export async function countNewLeads(tenantId: number): Promise<number> {
  const { count, error } = await supabase
    .from("website_leads")
    .select("id", { count: "exact", head: true })
    .eq("tenant_id", tenantId)
    .eq("status", "neu");
  if (error) return 0;
  return count ?? 0;
}
