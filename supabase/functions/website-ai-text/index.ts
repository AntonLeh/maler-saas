// @ts-nocheck
// =====================================================================
// Modul Website – KI-Schreibhilfe
//
// POST https://<projekt>.supabase.co/functions/v1/website-ai-text
//   Authorization: Bearer <Supabase-Token eines Admins>
//   Body: { kind: "service" | "about" | "seo", keywords: "...", service?: { title, text } }
// Antwort: { ok: true, result: {...}, used: <Anzahl im Monat>, limit: <Monatslimit> }
//
// Der Text wird NICHT gespeichert – der Betrieb sieht ihn als Vorschlag und übernimmt ihn selbst.
//
// Secrets:  ANTHROPIC_API_KEY            (Pflicht)
//           WEBSITE_AI_MODEL             (optional, Standard claude-sonnet-5-5)
//           WEBSITE_AI_MONTHLY_LIMIT     (optional, Standard 40 Texte pro Betrieb und Monat)
// Deploy:   npx supabase functions deploy website-ai-text --no-verify-jwt   (Anmeldung wird oben selbst geprüft)
// =====================================================================

import { serve } from "https://deno.land/std@0.224.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.45.4";
import { SYSTEM_PROMPT, extractResult, sanitize, schemaFor, userPrompt } from "./prompt.ts";

// Website gehört zum Tarif Enterprise – in der Testphase für alle
const ALLOWED_PLANS = ["enterprise"];
const planOk = (sub: any) => !!sub && ALLOWED_STATUS.includes(sub.status) && (ALLOWED_PLANS.includes(sub.plan) || sub.status === "trialing");
const ALLOWED_STATUS = ["active", "trialing", "past_due"];
const KINDS = ["service", "about", "seo"];

const db = createClient(Deno.env.get("SUPABASE_URL")!, Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!, {
  auth: { persistSession: false },
});

const HEADERS = {
  "content-type": "application/json; charset=utf-8",
  "access-control-allow-origin": "*",
  "access-control-allow-headers": "authorization, content-type, apikey, x-client-info",
  "access-control-allow-methods": "POST, OPTIONS",
};
const json = (data: unknown, status = 200) => new Response(JSON.stringify(data), { status, headers: HEADERS });

const monthStart = () => {
  const d = new Date();
  return new Date(Date.UTC(d.getUTCFullYear(), d.getUTCMonth(), 1)).toISOString();
};

serve(async (req) => {
  if (req.method === "OPTIONS") return new Response(null, { headers: HEADERS });
  if (req.method !== "POST") return json({ ok: false, error: "Nur POST" }, 405);

  try {
    // ---------- Anmeldung: nur Admins (Rolle 1/2) ----------
    const token = (req.headers.get("authorization") ?? "").replace(/^Bearer\s+/i, "");
    if (!token) return json({ ok: false, error: "Nicht angemeldet." }, 401);
    const { data: authData, error: authErr } = await db.auth.getUser(token);
    if (authErr || !authData?.user) return json({ ok: false, error: "Nicht angemeldet." }, 401);
    const { data: user } = await db.from("app_users").select("id, tenant_id, role_id").eq("auth_user_id", authData.user.id).maybeSingle();
    if (!user || ![1, 2].includes(Number(user.role_id))) return json({ ok: false, error: "Nur Admins dürfen die KI-Schreibhilfe nutzen." }, 403);

    // ---------- Tarif ----------
    const { data: sub } = await db.from("subscriptions").select("plan, status").eq("tenant_id", user.tenant_id).order("id", { ascending: false }).limit(1).maybeSingle();
    if (!planOk(sub)) {
      return json({ ok: false, error: "Die KI-Schreibhilfe gehört zur Website (Tarif Enterprise)." }, 403);
    }

    // ---------- Anfrage ----------
    const body = await req.json().catch(() => ({}));
    const kind = String(body.kind ?? "");
    if (!KINDS.includes(kind)) return json({ ok: false, error: "Unbekannte Art." }, 400);
    const keywords = String(body.keywords ?? "").slice(0, 1200);
    const service = kind === "service" ? { title: String(body.service?.title ?? "").trim().slice(0, 80), text: String(body.service?.text ?? "").trim().slice(0, 240) } : undefined;
    if (kind === "service" && !service.title) return json({ ok: false, error: "Bitte zuerst den Namen der Leistung eintragen." }, 400);

    // ---------- Monatslimit ----------
    const limit = Number(Deno.env.get("WEBSITE_AI_MONTHLY_LIMIT") ?? 40) || 40;
    const { count, error: cErr } = await db.from("website_ai_usage").select("id", { count: "exact", head: true }).eq("tenant_id", user.tenant_id).gte("created_at", monthStart());
    if (cErr) return json({ ok: false, error: "Für die KI-Schreibhilfe fehlt noch ein Datenbank-Update (website_ai_usage)." }, 500);
    if ((count ?? 0) >= limit) return json({ ok: false, error: `Das Monatslimit von ${limit} KI-Texten ist erreicht. Ab dem 1. des nächsten Monats geht es weiter.` }, 429);

    const apiKey = Deno.env.get("ANTHROPIC_API_KEY");
    if (!apiKey) return json({ ok: false, error: "Die KI-Schreibhilfe ist noch nicht eingerichtet (Schlüssel fehlt)." }, 503);

    // ---------- Betriebsdaten (aus der Datenbank, nicht vom Browser) ----------
    const [{ data: cs }, { data: w }] = await Promise.all([
      db.from("company_settings").select("company_name, city").eq("tenant_id", user.tenant_id).order("id", { ascending: false }).limit(1).maybeSingle(),
      db.from("websites").select("service_area, highlights, services").eq("tenant_id", user.tenant_id).maybeSingle(),
    ]);
    const ctx = {
      company: String(cs?.company_name ?? ""),
      city: String(cs?.city ?? ""),
      area: String(w?.service_area ?? "").split(/[,;\n]/).map((s) => s.trim()).filter(Boolean).slice(0, 15),
      highlights: (Array.isArray(w?.highlights) ? w.highlights : []).map(String).slice(0, 8),
      services: (Array.isArray(w?.services) ? w.services : []).map((s) => String(s?.title ?? "")).filter(Boolean).slice(0, 12),
    };

    // ---------- Anthropic Messages API (Ausgabe über erzwungenes Werkzeug = sauberes JSON) ----------
    const model = Deno.env.get("WEBSITE_AI_MODEL") || "claude-sonnet-5-5";
    const res = await fetch("https://api.anthropic.com/v1/messages", {
      method: "POST",
      headers: { "x-api-key": apiKey, "anthropic-version": "2023-06-01", "content-type": "application/json" },
      body: JSON.stringify({
        model,
        max_tokens: 6000,
        system: SYSTEM_PROMPT,
        tools: [{ name: "texte", description: "Die fertigen Website-Texte zurückgeben", input_schema: schemaFor(kind) }],
        // "auto" statt erzwungenem Werkzeug: funktioniert auch bei Modellen mit eingebautem Nachdenken
        tool_choice: { type: "auto" },
        messages: [{ role: "user", content: userPrompt({ kind, keywords, service }, ctx) }],
      }),
    });
    const data = await res.json().catch(() => ({}));
    if (!res.ok) {
      console.error("anthropic", res.status, JSON.stringify(data).slice(0, 500));
      return json({ ok: false, error: "Die KI ist gerade nicht erreichbar. Bitte später noch einmal versuchen." }, 502);
    }
    const raw = extractResult(data.content ?? []);
    if (!raw) {
      console.error("anthropic ohne Ergebnis", JSON.stringify(data).slice(0, 500));
      return json({ ok: false, error: "Die KI hat keinen Text geliefert. Bitte noch einmal versuchen." }, 502);
    }
    const result = sanitize(kind, raw);

    await db.from("website_ai_usage").insert({
      tenant_id: user.tenant_id,
      user_id: user.id,
      kind,
      model,
      input_tokens: data.usage?.input_tokens ?? null,
      output_tokens: data.usage?.output_tokens ?? null,
    });

    return json({ ok: true, result, used: (count ?? 0) + 1, limit });
  } catch (e) {
    console.error(e);
    return json({ ok: false, error: "Unerwarteter Fehler. Bitte später noch einmal versuchen." }, 500);
  }
});
