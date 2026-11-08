// @ts-nocheck
// =====================================================================
// Modul Website – Werbung: KI erstellt Beiträge aus Baustellenfotos
//
// POST …/functions/v1/website-marketing   Authorization: Bearer <Login-Token eines Admins>
//   Body: { action: "generate", order_id?: "...", uploads?: [{ url, path }], keywords?: "...", title?: "...", city?: "...", site_url?: "https://..." }
//   -> { ok, post, used, limit }   (Beitrag wird als Entwurf in marketing_posts gespeichert)
// POST …/functions/v1/website-marketing?hook=<DELETION_HOOK_TOKEN>   Body: { action: "suggest" }   (Zeitplan, täglich)
//   -> legt für jeden Betrieb mit Website (Tarif Enterprise/Testphase, Vorschläge eingeschaltet) aus neu abgeschlossenen
//      Aufträgen mit Fotos höchstens 2 Vorschläge pro Woche an und schickt eine E-Mail.
//
// Die KI sieht nur verkleinerte Bilder (max. 1280 px) und gibt Texte, Bildauswahl und Datenschutz-Hinweise zurück.
// Zählt zum gemeinsamen Monatslimit der KI-Schreibhilfe (Tabelle website_ai_usage, kind = "werbung").
//
// Secrets (vorhanden): ANTHROPIC_API_KEY, BREVO_API_KEY, BREVO_SENDER_EMAIL, DELETION_HOOK_TOKEN
// Optional: WEBSITE_AI_MODEL (Standard claude-sonnet-5-5), WEBSITE_AI_MONTHLY_LIMIT (Standard 40)
// Deploy:   npx supabase functions deploy website-marketing --no-verify-jwt   (Anmeldung wird selbst geprüft)
// =====================================================================

import { serve } from "https://deno.land/std@0.224.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.45.4";
import {
  DONE_STATUS,
  MAX_CANDIDATES,
  MIN_ORDER_IMAGES,
  SCHEMA,
  SUGGESTIONS_PER_WEEK,
  SYSTEM_PROMPT,
  encodeBase64,
  extractResult,
  imageType,
  pickCandidates,
  planOk,
  progressPath,
  sanitize,
  siteUrlOf,
  suggestableOrders,
  suggestionMail,
  userPrompt,
} from "./logic.ts";

const env = (k: string) => Deno.env.get(k) ?? "";
const db = createClient(env("SUPABASE_URL"), env("SUPABASE_SERVICE_ROLE_KEY"), { auth: { persistSession: false } });

const HEADERS = {
  "content-type": "application/json; charset=utf-8",
  "access-control-allow-origin": "*",
  "access-control-allow-headers": "authorization, content-type, apikey, x-client-info",
  "access-control-allow-methods": "POST, OPTIONS",
};
const json = (data: unknown, status = 200) => new Response(JSON.stringify(data), { status, headers: HEADERS });

const MAX_IMAGE_BYTES = 4.5 * 1024 * 1024;
const monthStart = () => {
  const d = new Date();
  return new Date(Date.UTC(d.getUTCFullYear(), d.getUTCMonth(), 1)).toISOString();
};
const aiLimit = (sub?: { status?: string | null } | null) =>
  sub?.status === "trialing" ? Number(env("WEBSITE_AI_TRIAL_LIMIT") || 20) || 20 : Number(env("WEBSITE_AI_MONTHLY_LIMIT") || 40) || 40;

class UserError extends Error {
  status: number;
  constructor(msg: string, status = 400) {
    super(msg);
    this.status = status;
  }
}

async function usedThisMonth(tenantId: number): Promise<number> {
  const { count, error } = await db.from("website_ai_usage").select("id", { count: "exact", head: true }).eq("tenant_id", tenantId).gte("created_at", monthStart());
  if (error) throw new Error("website_ai_usage: " + error.message);
  return count ?? 0;
}

async function latestSub(tenantId: number) {
  const { data } = await db.from("subscriptions").select("plan, status").eq("tenant_id", tenantId).order("id", { ascending: false }).limit(1).maybeSingle();
  return data;
}

async function tenantContext(tenantId: number, siteUrl?: string) {
  const [{ data: cs }, { data: w }] = await Promise.all([
    db.from("company_settings").select("company_name, city, email").eq("tenant_id", tenantId).order("id", { ascending: false }).limit(1).maybeSingle(),
    db.from("websites").select("slug, custom_domain, custom_domain_status, services, marketing_auto").eq("tenant_id", tenantId).maybeSingle(),
  ]);
  return {
    website: w,
    email: String(cs?.email ?? ""),
    ctx: {
      company: String(cs?.company_name ?? ""),
      city: String(cs?.city ?? ""),
      services: (Array.isArray(w?.services) ? w.services : []).map((s) => String(s?.title ?? "")).filter(Boolean).slice(0, 12),
      siteUrl: siteUrl && /^https:\/\/[^\s]{3,200}$/.test(siteUrl) ? siteUrl : siteUrlOf(w),
    },
  };
}

// ---------------------------------------------------------------------
// Bilder laden (verkleinert) – Baustellenbilder eines Auftrags oder eigene Fotos aus website-media
// ---------------------------------------------------------------------
type Candidate = { ref: Record<string, unknown>; media_type: string; data: string };

async function fetchSmall(bucket: string, path: string): Promise<{ bytes: Uint8Array; type: string } | null> {
  // 1) verkleinert über die Bild-Umwandlung von Supabase (Tarif Pro)
  try {
    const { data } = await db.storage.from(bucket).createSignedUrl(path, 600, { transform: { width: 1280, height: 1280, resize: "contain", quality: 75 } });
    if (data?.signedUrl) {
      const res = await fetch(data.signedUrl, { signal: AbortSignal.timeout(20000) });
      if (res.ok) {
        const bytes = new Uint8Array(await res.arrayBuffer());
        // Format laut Antwort (die Umwandlung kann z. B. WebP liefern), sonst laut Dateiendung
        const type = imageType(path, (res.headers.get("content-type") ?? "").split(";")[0].trim());
        if (type && bytes.length && bytes.length <= MAX_IMAGE_BYTES) return { bytes, type };
      }
    }
  } catch (_) {
    // weiter mit dem Original
  }
  // 2) Original
  const { data: blob } = await db.storage.from(bucket).download(path);
  if (!blob || blob.size > MAX_IMAGE_BYTES) return null;
  const type = imageType(path, blob.type);
  if (!type) return null;
  return { bytes: new Uint8Array(await blob.arrayBuffer()), type };
}

async function orderImageRows(tenantId: number, orderId: string) {
  const { data: progress, error } = await db.from("order_progress").select("id").eq("tenant_id", tenantId).eq("order_id", orderId);
  if (error) throw new Error("order_progress: " + error.message);
  const ids = (progress ?? []).map((p) => p.id);
  if (!ids.length) return [];
  const { data: images, error: imgErr } = await db
    .from("order_progress_images")
    .select("id, image_url, file_path, created_at")
    .in("progress_id", ids)
    .order("created_at", { ascending: true });
  if (imgErr) throw new Error("order_progress_images: " + imgErr.message);
  return (images ?? []).map((i) => ({ id: Number(i.id), path: progressPath(i.file_path, i.image_url) })).filter((i) => i.path);
}

async function loadCandidates(tenantId: number, orderId: string | null, uploads: { url: string; path: string }[]): Promise<Candidate[]> {
  const out: Candidate[] = [];
  if (orderId) {
    const rows = pickCandidates(await orderImageRows(tenantId, orderId), MAX_CANDIDATES);
    for (const r of rows) {
      const img = await fetchSmall("order-progress-images", r.path);
      if (img) out.push({ ref: { image_id: r.id }, media_type: img.type, data: encodeBase64(img.bytes) });
    }
  }
  for (const u of uploads.slice(0, MAX_CANDIDATES - out.length)) {
    const img = await fetchSmall("website-media", u.path);
    if (img) out.push({ ref: { url: u.url, path: u.path }, media_type: img.type, data: encodeBase64(img.bytes) });
  }
  return out;
}

// ---------------------------------------------------------------------
// KI-Aufruf
// ---------------------------------------------------------------------
async function generate(tenantId: number, userId: number | null, input: { orderId: string | null; uploads: { url: string; path: string }[]; keywords: string; title: string; city: string; siteUrl?: string }, status: "entwurf" | "vorschlag") {
  const apiKey = env("ANTHROPIC_API_KEY");
  if (!apiKey) throw new UserError("Die KI ist noch nicht eingerichtet (Schlüssel fehlt).", 503);

  const candidates = await loadCandidates(tenantId, input.orderId, input.uploads);
  if (!candidates.length) {
    throw new UserError(input.orderId ? "Zu diesem Auftrag gibt es noch keine (lesbaren) Baustellenbilder. Bitte Fotos im Auftrag hochladen oder eigene Fotos wählen." : "Bitte mindestens ein Foto auswählen.");
  }
  const { ctx } = await tenantContext(tenantId, input.siteUrl);
  const content: unknown[] = [];
  candidates.forEach((c, i) => {
    content.push({ type: "text", text: `Bild ${i + 1}:` });
    content.push({ type: "image", source: { type: "base64", media_type: c.media_type, data: c.data } });
  });
  content.push({ type: "text", text: userPrompt(ctx, { title: input.title, city: input.city, keywords: input.keywords, imageCount: candidates.length }) });

  const model = env("WEBSITE_AI_MODEL") || "claude-sonnet-5-5";
  const res = await fetch("https://api.anthropic.com/v1/messages", {
    method: "POST",
    headers: { "x-api-key": apiKey, "anthropic-version": "2023-06-01", "content-type": "application/json" },
    body: JSON.stringify({
      model,
      max_tokens: 6000,
      system: SYSTEM_PROMPT,
      tools: [{ name: "beitrag", description: "Den fertigen Werbe-Beitrag zurückgeben", input_schema: SCHEMA }],
      tool_choice: { type: "auto" },
      messages: [{ role: "user", content }],
    }),
    signal: AbortSignal.timeout(110000),
  });
  const data = await res.json().catch(() => ({}));
  if (!res.ok) {
    console.error("anthropic", res.status, JSON.stringify(data).slice(0, 500));
    throw new UserError("Die KI ist gerade nicht erreichbar. Bitte später noch einmal versuchen.", 502);
  }
  const raw = extractResult(data.content ?? []);
  if (!raw) {
    console.error("anthropic ohne Ergebnis", JSON.stringify(data).slice(0, 500));
    throw new UserError("Die KI hat keinen Beitrag geliefert. Bitte noch einmal versuchen.", 502);
  }
  const result = sanitize(raw, candidates.length);

  await db.from("website_ai_usage").insert({
    tenant_id: tenantId,
    user_id: userId,
    kind: "werbung",
    model,
    input_tokens: data.usage?.input_tokens ?? null,
    output_tokens: data.usage?.output_tokens ?? null,
  });

  // Ausgewählte Bilder zuerst; eigene Fotos bleiben alle erhalten (bewusst gewählt)
  const chosen = result.selected.map((s) => ({ ...candidates[s.index].ref, kind: s.kind }));
  const extraUploads = candidates
    .filter((c, i) => c.ref.path && !result.selected.some((s) => s.index === i))
    .map((c) => ({ ...c.ref, kind: null }));

  const { data: post, error } = await db
    .from("marketing_posts")
    .insert({
      tenant_id: tenantId,
      order_id: input.orderId,
      source: status === "vorschlag" ? "vorschlag" : "manuell",
      status,
      title: result.title || input.title || "Neues Projekt",
      city: input.city || null,
      texts: result.texts,
      images: [...chosen, ...extraUploads],
      warnings: result.warnings,
      created_by: userId,
    })
    .select("*")
    .single();
  if (error) {
    if (/marketing_posts/.test(error.message)) throw new UserError("Für die Werbung fehlt noch ein Datenbank-Update (20261107200000_werbung.sql).", 500);
    throw new Error(error.message);
  }
  return post;
}

async function sendMail(to: string, subject: string, text: string) {
  const key = env("BREVO_API_KEY");
  const sender = env("BREVO_SENDER_EMAIL");
  if (!key || !sender) throw new Error("Brevo ist nicht eingerichtet.");
  const res = await fetch("https://api.brevo.com/v3/smtp/email", {
    method: "POST",
    headers: { accept: "application/json", "content-type": "application/json", "api-key": key },
    body: JSON.stringify({ sender: { email: sender, name: "MalerSaaS" }, to: [{ email: to }], subject, textContent: text, tags: ["werbung"] }),
    signal: AbortSignal.timeout(20000),
  });
  if (!res.ok) throw new Error(`Brevo ${res.status}: ${(await res.text()).slice(0, 200)}`);
}

// ---------------------------------------------------------------------
// Vorschläge (Zeitplan)
// ---------------------------------------------------------------------
async function suggestAll(deadline: number) {
  const report: Record<string, unknown>[] = [];
  const { data: sites, error } = await db.from("websites").select("tenant_id, marketing_auto");
  if (error) throw new Error("websites: " + error.message);
  for (const s of sites ?? []) {
    if (Date.now() > deadline) {
      report.push({ stop: "Zeitlimit – Rest beim nächsten Lauf" });
      break;
    }
    const tenantId = Number(s.tenant_id);
    try {
      if (s.marketing_auto === false) continue;
      const tSub = await latestSub(tenantId);
      if (!planOk(tSub)) continue;

      const weekAgo = new Date(Date.now() - 7 * 86400000).toISOString();
      const { count: recent } = await db
        .from("marketing_posts")
        .select("id", { count: "exact", head: true })
        .eq("tenant_id", tenantId)
        .eq("source", "vorschlag")
        .gte("created_at", weekAgo);
      let room = SUGGESTIONS_PER_WEEK - (recent ?? 0);
      if (room <= 0) continue;
      room = Math.min(room, aiLimit(tSub) - (await usedThisMonth(tenantId)));
      if (room <= 0) continue;

      const [{ data: orders }, { data: posts }, { data: refs }] = await Promise.all([
        db.from("orders").select("id, title, status, address_city, end_date, created_at").eq("tenant_id", tenantId).in("status", DONE_STATUS).order("created_at", { ascending: false }).limit(40),
        db.from("marketing_posts").select("order_id").eq("tenant_id", tenantId).not("order_id", "is", null),
        db.from("website_references").select("order_id").eq("tenant_id", tenantId).not("order_id", "is", null),
      ]);
      const used = new Set([...(posts ?? []), ...(refs ?? [])].map((r) => String(r.order_id)));
      const titles: string[] = [];
      for (const o of suggestableOrders(orders ?? [], used)) {
        if (room <= 0 || Date.now() > deadline) break;
        if ((await orderImageRows(tenantId, String(o.id))).length < MIN_ORDER_IMAGES) continue;
        const post = await generate(tenantId, null, { orderId: String(o.id), uploads: [], keywords: "", title: String(o.title ?? ""), city: String(o.address_city ?? "") }, "vorschlag");
        titles.push(String(post.title));
        room--;
      }
      if (!titles.length) continue;

      const { ctx, email } = await tenantContext(tenantId);
      let to = email;
      if (!to) {
        const { data: admin } = await db.from("app_users").select("email").eq("tenant_id", tenantId).eq("role_id", 2).not("email", "is", null).order("id").limit(1).maybeSingle();
        to = String(admin?.email ?? "");
      }
      let mailed = false;
      if (to) {
        const m = suggestionMail(ctx.company, titles);
        try {
          await sendMail(to, m.subject, m.text);
          mailed = true;
        } catch (e) {
          console.error("mail", tenantId, e);
        }
      }
      report.push({ tenant_id: tenantId, created: titles.length, mailed });
    } catch (e) {
      console.error("suggest", tenantId, e);
      report.push({ tenant_id: tenantId, error: String(e?.message ?? e).slice(0, 200) });
    }
  }
  return report;
}

// ---------------------------------------------------------------------
serve(async (req) => {
  if (req.method === "OPTIONS") return new Response(null, { headers: HEADERS });
  if (req.method !== "POST") return json({ ok: false, error: "Nur POST" }, 405);
  const started = Date.now();
  try {
    const url = new URL(req.url);
    const hook = url.searchParams.get("hook") ?? "";
    const body = await req.json().catch(() => ({}));

    // ---------- Zeitplan ----------
    if (hook) {
      if (!env("DELETION_HOOK_TOKEN") || hook !== env("DELETION_HOOK_TOKEN")) return json({ ok: false, error: "Ungültiger Schlüssel." }, 403);
      const report = await suggestAll(started + 120000);
      return json({ ok: true, report });
    }

    // ---------- Anmeldung: nur Admins ----------
    const token = (req.headers.get("authorization") ?? "").replace(/^Bearer\s+/i, "");
    if (!token) return json({ ok: false, error: "Nicht angemeldet." }, 401);
    const { data: authData, error: authErr } = await db.auth.getUser(token);
    if (authErr || !authData?.user) return json({ ok: false, error: "Nicht angemeldet." }, 401);
    const { data: user } = await db.from("app_users").select("id, tenant_id, role_id").eq("auth_user_id", authData.user.id).maybeSingle();
    if (!user || ![1, 2].includes(Number(user.role_id))) return json({ ok: false, error: "Nur Admins dürfen Werbe-Beiträge erstellen." }, 403);
    const tenantId = Number(user.tenant_id);

    const sub = await latestSub(tenantId);
    if (!planOk(sub)) return json({ ok: false, error: "Die Werbung gehört zur Website (Tarif Enterprise)." }, 403);
    if (String(body.action ?? "generate") !== "generate") return json({ ok: false, error: "Unbekannte Aktion." }, 400);

    const limit = aiLimit(sub);
    const used = await usedThisMonth(tenantId).catch(() => -1);
    if (used < 0) return json({ ok: false, error: "Für die KI fehlt noch ein Datenbank-Update (website_ai_usage)." }, 500);
    if (used >= limit)
      return json({
        ok: false,
        error: sub?.status === "trialing"
          ? `In der Testphase sind bis zu ${limit} KI-Texte enthalten. Im Tarif Enterprise stehen Ihnen 40 pro Monat zur Verfügung.`
          : `Das Monatslimit von ${limit} KI-Texten ist erreicht. Ab dem 1. des nächsten Monats geht es weiter.`,
      }, 429);

    // ---------- Eingaben prüfen ----------
    const orderId = body.order_id ? String(body.order_id).slice(0, 64) : null;
    if (orderId) {
      const { data: order } = await db.from("orders").select("id").eq("tenant_id", tenantId).eq("id", orderId).maybeSingle();
      if (!order) return json({ ok: false, error: "Auftrag nicht gefunden." }, 404);
    }
    const prefix = `${tenantId}/`;
    const uploads = (Array.isArray(body.uploads) ? body.uploads : [])
      .map((u) => ({ url: String(u?.url ?? ""), path: String(u?.path ?? "") }))
      .filter((u) => u.path.startsWith(prefix) && !u.path.includes("..") && u.url.includes(`/website-media/${u.path}`))
      .slice(0, MAX_CANDIDATES);
    if (!orderId && !uploads.length) return json({ ok: false, error: "Bitte einen Auftrag mit Fotos oder eigene Fotos wählen." }, 400);

    const post = await generate(
      tenantId,
      Number(user.id),
      {
        orderId,
        uploads,
        keywords: String(body.keywords ?? "").slice(0, 1200),
        title: String(body.title ?? "").trim().slice(0, 90),
        city: String(body.city ?? "").trim().slice(0, 80),
        siteUrl: String(body.site_url ?? ""),
      },
      "entwurf"
    );
    return json({ ok: true, post, used: used + 1, limit });
  } catch (e) {
    if (e instanceof UserError) return json({ ok: false, error: e.message }, e.status);
    console.error(e);
    return json({ ok: false, error: "Unerwarteter Fehler. Bitte später noch einmal versuchen." }, 500);
  }
});
