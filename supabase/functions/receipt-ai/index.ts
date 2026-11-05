// @ts-nocheck
// =====================================================================
// Belege & Ausgaben – KI-Belegerkennung
//
// POST …/functions/v1/receipt-ai   Authorization: Bearer <Login-Token eines Admins>
//   Body: { file_path: "<tenant_id>/<datei>" }   (Datei vorher in den Bucket „receipts“ hochgeladen)
//   -> { ok, data: { receipt_date, supplier, gross_amount, tax_rate, tax_amount, category, description, payment_method }, used, limit }
// Es wird nichts gespeichert außer einem Zähler (expense_ai_log) – der Admin prüft die Vorschläge im Formular.
// Tarif: ab Business (Business, Enterprise) und in der Testphase.
// Secrets (vorhanden): ANTHROPIC_API_KEY
// Optional: RECEIPT_AI_MODEL (Standard claude-sonnet-5-5, Ersatz claude-haiku-5-5), RECEIPT_AI_MONTHLY_LIMIT (Standard 300 je Betrieb)
// Deploy:  npx supabase functions deploy receipt-ai --no-verify-jwt   (Anmeldung wird selbst geprüft)
// =====================================================================

import { serve } from "https://deno.land/std@0.224.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.45.4";
import { SYSTEM_PROMPT, TOOL, cleanResult, encodeBase64, mediaTypeFor, toolInput } from "./logic.ts";

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
    // ---------- Anmeldung: nur Admins ----------
    const token = (req.headers.get("authorization") ?? "").replace(/^Bearer\s+/i, "");
    if (!token) return json({ ok: false, error: "Nicht angemeldet." }, 401);
    const { data: authData, error: authErr } = await db.auth.getUser(token);
    if (authErr || !authData?.user) return json({ ok: false, error: "Nicht angemeldet." }, 401);
    const { data: user } = await db.from("app_users").select("id, tenant_id, role_id").eq("auth_user_id", authData.user.id).maybeSingle();
    if (!user || ![1, 2].includes(Number(user.role_id))) return json({ ok: false, error: "Nur Admins dürfen Belege erfassen." }, 403);

    // ---------- Tarif ----------
    const { data: sub } = await db.from("subscriptions").select("plan, status").eq("tenant_id", user.tenant_id).order("id", { ascending: false }).limit(1).maybeSingle();
    if (!planOk(sub)) return json({ ok: false, error: "Die automatische Belegerkennung gibt es ab dem Tarif Business." }, 403);

    // ---------- Datei ----------
    const body = await req.json().catch(() => ({}));
    const path = String(body.file_path ?? "");
    if (!path.startsWith(`${user.tenant_id}/`) || path.includes("..")) return json({ ok: false, error: "Ungültige Datei." }, 400);

    // ---------- Monatslimit ----------
    const limit = Number(Deno.env.get("RECEIPT_AI_MONTHLY_LIMIT") ?? 300) || 300;
    const { count } = await db.from("expense_ai_log").select("id", { count: "exact", head: true }).eq("tenant_id", user.tenant_id).gte("created_at", monthStart());
    if ((count ?? 0) >= limit) return json({ ok: false, error: `Das Monatslimit von ${limit} automatisch erkannten Belegen ist erreicht. Bitte die Angaben selbst eintragen.` }, 429);

    const { data: blob, error: dlErr } = await db.storage.from("receipts").download(path);
    if (dlErr || !blob) return json({ ok: false, error: "Die Beleg-Datei wurde nicht gefunden." }, 404);
    if (blob.size > MAX_BYTES) return json({ ok: false, error: "Die Datei ist zu groß (höchstens 10 MB)." }, 400);
    const mediaType = mediaTypeFor(path, blob.type);
    if (!mediaType) return json({ ok: false, error: "Dieses Dateiformat kann die KI nicht lesen (JPG, PNG, WEBP oder PDF)." }, 400);
    if (mediaType !== "application/pdf" && blob.size > 5 * 1024 * 1024) return json({ ok: false, error: "Das Bild ist zu groß für die Erkennung (höchstens 5 MB)." }, 400);
    const b64 = encodeBase64(new Uint8Array(await blob.arrayBuffer()));
    const source = { type: "base64", media_type: mediaType, data: b64 };
    const fileBlock = mediaType === "application/pdf" ? { type: "document", source } : { type: "image", source };

    // ---------- KI ----------
    const data = await callClaude({
      max_tokens: 2000,
      system: SYSTEM_PROMPT,
      tools: [TOOL],
      tool_choice: { type: "auto" },
      messages: [{ role: "user", content: [fileBlock, { type: "text", text: "Bitte lies diesen Beleg aus und rufe beleg_daten auf." }] }],
    });
    await db.from("expense_ai_log").insert({ tenant_id: user.tenant_id });
    const result = cleanResult(toolInput(data.content));
    if (!result.ok) return json({ ok: false, error: result.error, used: (count ?? 0) + 1, limit }, 422);
    return json({ ok: true, data: result.data, used: (count ?? 0) + 1, limit });
  } catch (e) {
    console.error("receipt-ai", e);
    return json({ ok: false, error: "Die Belegerkennung hat gerade nicht geklappt. Bitte die Angaben selbst eintragen." }, 500);
  }
});
