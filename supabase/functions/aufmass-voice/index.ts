// @ts-nocheck
// =====================================================================
// Aufmaß per Sprache
//
// POST …/functions/v1/aufmass-voice   Authorization: Bearer <Login-Token eines Admins oder Projektleiters>
//   Body: multipart/form-data mit Feld „audio“ (Aufnahme aus dem Browser, webm/ogg/mp4/m4a/wav, höchstens 20 MB)
//   -> { ok, transcript, data: { rooms, services, general_notes }, used, limit }
// Ablauf: Sprache → Text (ElevenLabs Scribe) → Räume/Maße (Claude). Es wird nichts gespeichert außer
// einem Zähler je Diktat (aufmass_voice_log). Die Aufnahme selbst wird nicht aufbewahrt.
// Alle Tarife (aktiv/Testphase). Monatslimit: 100 je Betrieb, Testphase 30
//   (AUFMASS_VOICE_MONTHLY_LIMIT / AUFMASS_VOICE_TRIAL_LIMIT).
// Secrets (vorhanden): ELEVENLABS_API_KEY, ANTHROPIC_API_KEY.  Optional: AUFMASS_STT_MODEL (Standard scribe_v2), AUFMASS_AI_MODEL
// Deploy:  npx supabase functions deploy aufmass-voice --no-verify-jwt   (Anmeldung wird selbst geprüft)
// =====================================================================

import { serve } from "https://deno.land/std@0.224.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.45.4";
import { SYSTEM_PROMPT, TOOL, cleanResult, monthlyLimit, toolInput } from "./logic.ts";

const db = createClient(Deno.env.get("SUPABASE_URL")!, Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!, { auth: { persistSession: false } });

const HEADERS = {
  "content-type": "application/json; charset=utf-8",
  "access-control-allow-origin": "*",
  "access-control-allow-headers": "authorization, content-type, apikey, x-client-info",
  "access-control-allow-methods": "POST, OPTIONS",
};
const json = (data: unknown, status = 200) => new Response(JSON.stringify(data), { status, headers: HEADERS });
const ALLOWED_STATUS = ["active", "trialing", "past_due"];
const MAX_BYTES = 20 * 1024 * 1024;
const monthStart = () => {
  const d = new Date();
  return new Date(Date.UTC(d.getUTCFullYear(), d.getUTCMonth(), 1)).toISOString();
};

async function transcribe(file: File): Promise<string> {
  const key = Deno.env.get("ELEVENLABS_API_KEY");
  if (!key) throw new Error("ELEVENLABS_API_KEY fehlt");
  const base = Deno.env.get("ELEVENLABS_API_URL") || "https://api.elevenlabs.io";
  // Modelle der Reihe nach probieren; bei Problemen mit der Sprachangabe ohne Sprache (automatische Erkennung)
  const models = [...new Set([Deno.env.get("AUFMASS_STT_MODEL") || "scribe_v2", "scribe_v1"])];
  const bytes = new Uint8Array(await file.arrayBuffer());
  const name = file.name || "aufmass.webm";
  const type = (file.type || "audio/webm").split(";")[0];
  let lastStatus = 0;
  for (const model of models) {
    for (const lang of ["de", null]) {
      const fd = new FormData();
      fd.append("file", new File([bytes], name, { type }));
      fd.append("model_id", model);
      if (lang) fd.append("language_code", lang);
      fd.append("tag_audio_events", "false");
      const res = await fetch(`${base}/v1/speech-to-text`, { method: "POST", headers: { "xi-api-key": key }, body: fd });
      const data = await res.json().catch(() => ({}));
      if (res.ok) return String(data?.text ?? "").trim();
      lastStatus = res.status;
      console.error("elevenlabs stt", model, lang ?? "auto", res.status, type, bytes.length, JSON.stringify(data).slice(0, 500));
      // Schlüssel ohne Berechtigung / Guthaben: weitere Versuche bringen nichts
      if (res.status === 401 || res.status === 403 || res.status === 402 || res.status === 429) throw new Error(`stt ${res.status}`);
    }
  }
  throw new Error(`stt ${lastStatus}`);
}

async function callClaude(body: Record<string, unknown>) {
  const apiKey = Deno.env.get("ANTHROPIC_API_KEY");
  if (!apiKey) throw new Error("ANTHROPIC_API_KEY fehlt");
  const models = [Deno.env.get("AUFMASS_AI_MODEL") || "claude-sonnet-5-5", "claude-haiku-5-5"];
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
      return json({ ok: false, error: "Nur Admins und Projektleiter können ein Aufmaß diktieren." }, 403);
    }
    const tenantId = Number(user.tenant_id);

    // ---------- Abo (alle Tarife) ----------
    const { data: sub } = await db.from("subscriptions").select("plan, status").eq("tenant_id", tenantId).order("id", { ascending: false }).limit(1).maybeSingle();
    if (!sub || !ALLOWED_STATUS.includes(String(sub.status))) return json({ ok: false, error: "Für das Diktieren wird ein aktiver Tarif benötigt." }, 403);

    // ---------- Monatslimit ----------
    const limit = monthlyLimit(sub.status, (k) => Deno.env.get(k));
    const { count, error: cErr } = await db.from("aufmass_voice_log").select("id", { count: "exact", head: true }).eq("tenant_id", tenantId).gte("created_at", monthStart());
    if (cErr) return json({ ok: false, error: "Für das Diktieren fehlt noch ein Datenbank-Update (aufmass_voice_log)." }, 500);
    if ((count ?? 0) >= limit)
      return json({
        ok: false,
        error: sub.status === "trialing"
          ? `In der Testphase sind bis zu ${limit} Diktate enthalten. Mit einem gebuchten Tarif stehen Ihnen 100 pro Monat zur Verfügung.`
          : `Das Monatslimit von ${limit} Diktaten ist erreicht. Ab dem 1. des nächsten Monats geht es weiter.`,
      }, 429);

    // ---------- Aufnahme ----------
    const form = await req.formData().catch(() => null);
    const file = form?.get("audio");
    if (!file || typeof file === "string") return json({ ok: false, error: "Keine Aufnahme erhalten." }, 400);
    if (file.size < 1000) return json({ ok: false, error: "Die Aufnahme ist zu kurz. Bitte noch einmal diktieren." }, 400);
    if (file.size > MAX_BYTES) return json({ ok: false, error: "Die Aufnahme ist zu lang (höchstens etwa 10 Minuten). Bitte in mehreren Teilen diktieren." }, 400);

    // ---------- Sprache → Text ----------
    let transcript = "";
    try {
      transcript = await transcribe(file);
    } catch (e) {
      console.error(e);
      return json({ ok: false, error: "Die Spracherkennung ist gerade nicht erreichbar. Bitte später noch einmal versuchen." }, 502);
    }
    await db.from("aufmass_voice_log").insert({ tenant_id: tenantId, user_id: user.id, chars: transcript.length });
    if (!transcript) return json({ ok: false, error: "In der Aufnahme war nichts zu verstehen. Bitte noch einmal deutlich diktieren.", used: (count ?? 0) + 1, limit }, 422);

    // ---------- Text → Räume und Maße ----------
    const ai = await callClaude({
      max_tokens: 4000,
      system: SYSTEM_PROMPT,
      tools: [TOOL],
      tool_choice: { type: "tool", name: "aufmass" },
      messages: [{ role: "user", content: `Diktiertes Aufmaß:\n<diktat>\n${transcript.slice(0, 20000)}\n</diktat>` }],
    });
    const data = cleanResult(toolInput(ai.content ?? []));
    if (!data.rooms.length && !data.services.length && !data.general_notes) {
      return json({ ok: false, error: "Im Diktat wurden keine Räume oder Maße erkannt. Beispiel: „Wohnzimmer fünf mal vier, Höhe zwei fünfzig, zwei Fenster …“", transcript, used: (count ?? 0) + 1, limit }, 422);
    }
    return json({ ok: true, transcript, data, used: (count ?? 0) + 1, limit });
  } catch (e) {
    console.error(e);
    return json({ ok: false, error: "Die KI ist gerade nicht erreichbar. Bitte später noch einmal versuchen." }, 502);
  }
});
