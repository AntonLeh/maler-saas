// @ts-nocheck
// =====================================================================
// Materialverwaltung – Lieferschein einlesen
//
// POST …/functions/v1/delivery-note-ai   Authorization: Bearer <Login-Token eines Admins oder Projektleiters>
//   Body: { file_path: "<tenant_id>/<datei>" }   (Datei vorher in den Bucket „delivery-notes“ hochgeladen)
//   -> { ok, data: { supplier, note_date, note_number, reference, lines: [...] }, used, limit }
// Es wird nichts gebucht – Admin/Projektleiter prüft die Positionen und bucht in der App (book_material_stock).
// Tarif: ab Business und in der Testphase. Kontingent gemeinsam mit der Belegerkennung (expense_ai_log):
//   300 pro Monat, Enterprise 500 (RECEIPT_AI_MONTHLY_LIMIT / RECEIPT_AI_MONTHLY_LIMIT_ENTERPRISE).
// Secrets (vorhanden): ANTHROPIC_API_KEY.  Optional: RECEIPT_AI_MODEL
// Deploy:  npx supabase functions deploy delivery-note-ai --no-verify-jwt   (Anmeldung wird selbst geprüft)
// =====================================================================

import { serve } from "https://deno.land/std@0.224.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.45.4";
import { SYSTEM_PROMPT, TOOL, cleanResult, encodeBase64, materialList, mediaTypeFor, monthlyLimit, toolInput } from "./logic.ts";

const db = createClient(Deno.env.get("SUPABASE_URL")!, Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!, { auth: { persistSession: false } });

const HEADERS = {
  "content-type": "application/json; charset=utf-8",
  "access-control-allow-origin": "*",
  "access-control-allow-headers": "authorization, content-type, apikey, x-client-info",
  "access-control-allow-methods": "POST, OPTIONS",
};
const json = (data: unknown, status = 200) => new Response(JSON.stringify(data), { status, headers: HEADERS });
const ALLOWED_STATUS = ["active", "trialing", "past_due"];
const planOk = (sub: any) => !!sub && ALLOWED_STATUS.includes(sub.status) && (["business", "enterprise"].includes(sub.plan) || sub.status === "trialing");
const MAX_BYTES = 10 * 1024 * 1024;
const monthStart = () => {
  const d = new Date();
  return new Date(Date.UTC(d.getUTCFullYear(), d.getUTCMonth(), 1)).toISOString();
};

async function callClaude(body: Record<string, unknown>) {
  const apiKey = Deno.env.get("ANTHROPIC_API_KEY");
  if (!apiKey) throw new Error("ANTHROPIC_API_KEY fehlt");
  const models = [Deno.env.get("RECEIPT_AI_MODEL") || "claude-sonnet-5-5", "claude-haiku-5-5"];
  let last: any = null;
  for (const model of [...new Set(models)]) {
    const res = await fetch("https://api.anthropic.com/v1/messages", {
      method: "POST",
      headers: { "x-api-key": apiKey, "anthropic-version": "2023-06-01", "content-type": "application/json" },
      body: JSON.stringify({ model, ...body }),
    });
    const data = await res.json().catch(() => ({}));
    if (res.ok) return data;
    last = { status: res.status, data };
    console.error("anthropic", model, res.status, JSON.stringify(data).slice(0, 400));
    if (![400, 404].includes(res.status) || !JSON.stringify(data).includes("model")) break;
  }
  throw new Error(`anthropic ${last?.status}`);
}

serve(async (req) => {
  if (req.method === "OPTIONS") return new Response(null, { headers: HEADERS });
  if (req.method !== "POST") return json({ ok: false, error: "Nur POST" }, 405);
  try {
    // ---------- Anmeldung: Admins und Projektleiter ----------
    const token = (req.headers.get("authorization") ?? "").replace(/^Bearer\s+/i, "");
    if (!token) return json({ ok: false, error: "Nicht angemeldet." }, 401);
    const { data: authData, error: authErr } = await db.auth.getUser(token);
    if (authErr || !authData?.user) return json({ ok: false, error: "Nicht angemeldet." }, 401);
    const { data: user } = await db.from("app_users").select("id, tenant_id, role_id, is_active").eq("auth_user_id", authData.user.id).maybeSingle();
    if (!user || user.is_active === false || ![1, 2, 3].includes(Number(user.role_id))) {
      return json({ ok: false, error: "Nur Admins und Projektleiter dürfen Lieferscheine einlesen." }, 403);
    }
    const tenantId = Number(user.tenant_id);

    // ---------- Tarif ----------
    const { data: sub } = await db.from("subscriptions").select("plan, status").eq("tenant_id", tenantId).order("id", { ascending: false }).limit(1).maybeSingle();
    if (!planOk(sub)) return json({ ok: false, error: "Das Einlesen von Lieferscheinen gibt es ab dem Tarif Business." }, 403);

    const body = await req.json().catch(() => ({}));
    const path = String(body.file_path ?? "");
    if (!path.startsWith(`${tenantId}/`) || path.includes("..")) return json({ ok: false, error: "Ungültige Datei." }, 400);

    // ---------- Monatslimit (gemeinsam mit der Belegerkennung) ----------
    const limit = monthlyLimit(sub?.plan, (k) => Deno.env.get(k));
    const { count } = await db.from("expense_ai_log").select("id", { count: "exact", head: true }).eq("tenant_id", tenantId).gte("created_at", monthStart());
    if ((count ?? 0) >= limit) return json({ ok: false, error: `Das Monatslimit von ${limit} KI-Erkennungen (Belege und Lieferscheine) ist erreicht. Bitte die Mengen von Hand buchen.` }, 429);

    // ---------- Datei ----------
    const { data: blob, error: dlErr } = await db.storage.from("delivery-notes").download(path);
    if (dlErr || !blob) return json({ ok: false, error: "Die Lieferschein-Datei wurde nicht gefunden." }, 404);
    if (blob.size > MAX_BYTES) return json({ ok: false, error: "Die Datei ist zu groß (höchstens 10 MB)." }, 400);
    const mediaType = mediaTypeFor(path, blob.type);
    if (!mediaType) return json({ ok: false, error: "Dieses Dateiformat kann die KI nicht lesen (JPG, PNG, WEBP oder PDF)." }, 400);
    if (mediaType !== "application/pdf" && blob.size > 5 * 1024 * 1024) return json({ ok: false, error: "Das Bild ist zu groß für die Erkennung (höchstens 5 MB)." }, 400);
    const source = { type: "base64", media_type: mediaType, data: encodeBase64(new Uint8Array(await blob.arrayBuffer())) };
    const fileBlock = mediaType === "application/pdf" ? { type: "document", source } : { type: "image", source };

    // ---------- Materialliste für die Zuordnung ----------
    const { data: materials } = await db
      .from("materials")
      .select("id, name, unit, supplier")
      .eq("tenant_id", tenantId)
      .eq("is_active", true)
      .order("name", { ascending: true })
      .limit(400);
    const list = (materials ?? []).map((m) => ({ id: Number(m.id), name: String(m.name ?? ""), unit: String(m.unit ?? "Stk"), supplier: m.supplier ?? null }));

    // ---------- KI ----------
    const data = await callClaude({
      max_tokens: 6000,
      system: SYSTEM_PROMPT,
      tools: [TOOL],
      tool_choice: { type: "auto" },
      messages: [
        {
          role: "user",
          content: [
            fileBlock,
            { type: "text", text: `Materialliste des Betriebs (id | Name | Einheit | Lieferant):\n<materialliste>\n${materialList(list)}\n</materialliste>\n\nBitte lies den Lieferschein aus und rufe „lieferschein“ auf.` },
          ],
        },
      ],
    });
    const log = await db.from("expense_ai_log").insert({ tenant_id: tenantId, kind: "lieferschein" });
    if (log.error) await db.from("expense_ai_log").insert({ tenant_id: tenantId }); // ältere Datenbank ohne Spalte „kind“
    const result = cleanResult(toolInput(data.content ?? []), list);
    if (!result.ok) return json({ ok: false, error: result.error, used: (count ?? 0) + 1, limit }, 422);
    return json({ ok: true, data: result.data, used: (count ?? 0) + 1, limit });
  } catch (e) {
    console.error(e);
    return json({ ok: false, error: "Die KI ist gerade nicht erreichbar. Bitte später noch einmal versuchen." }, 502);
  }
});
