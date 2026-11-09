// @ts-nocheck
// =====================================================================
// Owner: Kontakte & Anschreiben – nur Plattform-Inhaber (Rolle 1)
//
// POST …/functions/v1/owner-outreach   Authorization: Bearer <Login-Token>
//   { action: "ai", kind: "brief"|"email", goal, target, offer, notes }   -> { ok, subject, body }  (mit Platzhaltern)
//   { action: "email", contact_id, subject, body }                        -> { ok }   Brevo, nur mit Grundlage, nicht gesperrt
//   { action: "pingen_status" }                                           -> { ok, configured, staging, organisation }
//   { action: "pingen_send", contact_id, pdf_base64, file_name, delivery } -> { ok, letter_id, status }
// Secrets: ANTHROPIC_API_KEY, BREVO_API_KEY, BREVO_SENDER_EMAIL (vorhanden)
//   Optional: OWNER_OUTREACH_SENDER (Absender, z. B. info@maler-saas.com), OWNER_OUTREACH_REPLY_TO
//   Pingen:   PINGEN_CLIENT_ID, PINGEN_CLIENT_SECRET, optional PINGEN_ORGANISATION_ID, PINGEN_STAGING=true (Testumgebung)
// Deploy:  npx supabase functions deploy owner-outreach --no-verify-jwt
// =====================================================================

import { serve } from "https://deno.land/std@0.224.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.45.4";
import { AI_PROMPT, AI_TOOL, DELIVERY, EMAIL_FOOTER, aiUserPrompt, emailBlocker, emailHtml, fill, pingenUrls } from "./logic.ts";

const env = (k: string) => Deno.env.get(k) ?? "";
const db = createClient(env("SUPABASE_URL"), env("SUPABASE_SERVICE_ROLE_KEY"), { auth: { persistSession: false } });
const HEADERS = {
  "content-type": "application/json; charset=utf-8",
  "access-control-allow-origin": "*",
  "access-control-allow-headers": "authorization, content-type, apikey, x-client-info",
  "access-control-allow-methods": "POST, OPTIONS",
};
const json = (data: unknown, status = 200) => new Response(JSON.stringify(data), { status, headers: HEADERS });

async function callClaude(body: Record<string, unknown>) {
  const apiKey = env("ANTHROPIC_API_KEY");
  if (!apiKey) throw new Error("ANTHROPIC_API_KEY fehlt");
  let last: any = null;
  for (const model of [...new Set([env("OWNER_MARKETING_MODEL") || "claude-sonnet-5-5", "claude-haiku-5-5"])]) {
    const res = await fetch("https://api.anthropic.com/v1/messages", {
      method: "POST",
      headers: { "x-api-key": apiKey, "anthropic-version": "2023-06-01", "content-type": "application/json" },
      body: JSON.stringify({ model, ...body }),
    });
    const data = await res.json().catch(() => ({}));
    if (res.ok) return data;
    last = res.status;
    if (![400, 404].includes(res.status) || !JSON.stringify(data).includes("model")) break;
  }
  throw new Error(`anthropic ${last}`);
}

async function pingenToken() {
  const id = env("PINGEN_CLIENT_ID");
  const secret = env("PINGEN_CLIENT_SECRET");
  if (!id || !secret) return null;
  const staging = env("PINGEN_STAGING").toLowerCase() === "true";
  const urls = pingenUrls(staging);
  const res = await fetch(`${urls.identity}/auth/access-tokens`, {
    method: "POST",
    headers: { "content-type": "application/x-www-form-urlencoded" },
    body: new URLSearchParams({ grant_type: "client_credentials", client_id: id, client_secret: secret, scope: "letter organisation_read" }),
  });
  const data = await res.json().catch(() => ({}));
  if (!res.ok || !data.access_token) {
    console.error("pingen token", res.status, JSON.stringify(data).slice(0, 300));
    throw new Error("Pingen-Anmeldung fehlgeschlagen – bitte Client-ID und Secret prüfen.");
  }
  return { token: data.access_token as string, urls, staging };
}

async function pingenOrg(auth: { token: string; urls: { api: string } }) {
  if (env("PINGEN_ORGANISATION_ID")) return env("PINGEN_ORGANISATION_ID");
  const res = await fetch(`${auth.urls.api}/organisations`, { headers: { authorization: `Bearer ${auth.token}`, accept: "application/vnd.api+json" } });
  const data = await res.json().catch(() => ({}));
  const id = data?.data?.[0]?.id;
  if (!id) throw new Error("Pingen-Organisation nicht gefunden – bitte PINGEN_ORGANISATION_ID hinterlegen.");
  return id as string;
}

const b64ToBytes = (b64: string) => Uint8Array.from(atob(b64), (c) => c.charCodeAt(0));

serve(async (req) => {
  if (req.method === "OPTIONS") return new Response(null, { headers: HEADERS });
  if (req.method !== "POST") return json({ ok: false, error: "Nur POST" }, 405);
  try {
    const token = (req.headers.get("authorization") ?? "").replace(/^Bearer\s+/i, "");
    const { data: authData } = token ? await db.auth.getUser(token) : { data: null };
    if (!authData?.user) return json({ ok: false, error: "Nicht angemeldet." }, 401);
    const { data: user } = await db.from("app_users").select("role_id").eq("auth_user_id", authData.user.id).maybeSingle();
    if (!user || Number(user.role_id) !== 1) return json({ ok: false, error: "Nur für den Plattform-Inhaber." }, 403);

    const body = await req.json().catch(() => ({}));
    const loadContact = async () => {
      const { data } = await db.from("owner_contacts").select("*").eq("id", Number(body.contact_id)).maybeSingle();
      return data;
    };
    const log = (contact_id: number, kind: string, subject: string, text: string, meta: Record<string, unknown> = {}) =>
      db.from("owner_contact_events").insert({ contact_id, kind, subject, body: text, meta });

    // ---------- KI ----------
    if (body.action === "ai") {
      const data = await callClaude({
        max_tokens: 1500,
        system: AI_PROMPT,
        tools: [AI_TOOL],
        tool_choice: { type: "tool", name: "anschreiben" },
        messages: [{ role: "user", content: aiUserPrompt({ kind: String(body.kind), goal: String(body.goal), target: String(body.target ?? ""), offer: String(body.offer ?? ""), notes: String(body.notes ?? "") }) }],
      });
      const block = (data.content ?? []).find((c: any) => c.type === "tool_use");
      const subject = String(block?.input?.subject ?? "").slice(0, 120);
      const text = String(block?.input?.body ?? "").slice(0, 3000);
      if (!text) return json({ ok: false, error: "Die KI hat keinen Text geliefert. Bitte noch einmal versuchen." }, 422);
      return json({ ok: true, subject, body: text });
    }

    // ---------- E-Mail ----------
    if (body.action === "email") {
      const c = await loadContact();
      if (!c) return json({ ok: false, error: "Kontakt nicht gefunden." }, 404);
      const blocker = emailBlocker(c);
      if (blocker) return json({ ok: false, error: blocker }, 400);
      const subject = fill(String(body.subject ?? ""), c).trim().slice(0, 150);
      const text = fill(String(body.body ?? ""), c).trim().slice(0, 6000);
      if (!subject || !text) return json({ ok: false, error: "Betreff und Text dürfen nicht leer sein." }, 400);
      const key = env("BREVO_API_KEY");
      const sender = env("OWNER_OUTREACH_SENDER") || env("BREVO_SENDER_EMAIL");
      if (!key || !sender) return json({ ok: false, error: "Der E-Mail-Versand (Brevo) ist nicht eingerichtet." }, 500);
      const replyTo = env("OWNER_OUTREACH_REPLY_TO") || "info@maler-saas.com";
      const res = await fetch("https://api.brevo.com/v3/smtp/email", {
        method: "POST",
        headers: { accept: "application/json", "content-type": "application/json", "api-key": key },
        body: JSON.stringify({
          sender: { email: sender, name: "Anton Lehmann · MalerSaaS" },
          replyTo: { email: replyTo, name: "Anton Lehmann · MalerSaaS" },
          to: [{ email: c.email.trim(), name: c.organisation }],
          subject,
          htmlContent: emailHtml(text),
          textContent: `${text}\n\n${EMAIL_FOOTER}`,
          tags: ["owner-anschreiben"],
        }),
      });
      if (!res.ok) {
        console.error("brevo", res.status, (await res.text()).slice(0, 300));
        return json({ ok: false, error: "Die E-Mail konnte nicht gesendet werden (Brevo)." }, 502);
      }
      const msg = await res.json().catch(() => ({}));
      await log(c.id, "email", subject, text, { to: c.email, message_id: msg?.messageId ?? null });
      await db.from("owner_contacts").update({ updated_at: new Date().toISOString() }).eq("id", c.id);
      return json({ ok: true });
    }

    // ---------- Pingen ----------
    if (body.action === "pingen_status") {
      try {
        const auth = await pingenToken();
        if (!auth) return json({ ok: true, configured: false });
        const org = await pingenOrg(auth);
        return json({ ok: true, configured: true, staging: auth.staging, organisation: org });
      } catch (e) {
        return json({ ok: true, configured: true, error: String(e?.message ?? e) });
      }
    }

    if (body.action === "pingen_send") {
      const c = await loadContact();
      if (!c) return json({ ok: false, error: "Kontakt nicht gefunden." }, 404);
      if (c.blocked) return json({ ok: false, error: "Dieser Kontakt hat widersprochen und ist gesperrt." }, 400);
      const auth = await pingenToken();
      if (!auth) return json({ ok: false, error: "Pingen ist noch nicht eingerichtet (Client-ID und Secret fehlen)." }, 400);
      const org = await pingenOrg(auth);
      const pdf = b64ToBytes(String(body.pdf_base64 ?? ""));
      if (pdf.length < 500 || pdf.length > 10 * 1024 * 1024) return json({ ok: false, error: "Ungültige PDF-Datei." }, 400);
      const h = { authorization: `Bearer ${auth.token}`, accept: "application/vnd.api+json" };

      // 1) Upload-Adresse holen und PDF hochladen
      const up = await fetch(`${auth.urls.api}/file-upload`, { headers: h });
      const upData = await up.json().catch(() => ({}));
      const url = upData?.data?.attributes?.url;
      const signature = upData?.data?.attributes?.url_signature;
      if (!url || !signature) {
        console.error("pingen upload", up.status, JSON.stringify(upData).slice(0, 300));
        return json({ ok: false, error: "Pingen: Upload nicht möglich." }, 502);
      }
      const put = await fetch(url, { method: "PUT", body: pdf, headers: { "content-type": "application/pdf" } });
      if (!put.ok) return json({ ok: false, error: "Pingen: PDF konnte nicht hochgeladen werden." }, 502);

      // 2) Brief anlegen und direkt versenden
      const delivery = DELIVERY.includes(body.delivery) ? body.delivery : "cheap";
      const create = await fetch(`${auth.urls.api}/organisations/${org}/letters`, {
        method: "POST",
        headers: { ...h, "content-type": "application/vnd.api+json" },
        body: JSON.stringify({
          data: {
            type: "letters",
            attributes: {
              file_original_name: String(body.file_name || "brief.pdf").replace(/[^\w.\-]+/g, "_").slice(0, 80),
              file_url: url,
              file_url_signature: signature,
              address_position: "left",
              auto_send: true,
              delivery_product: delivery,
              print_mode: "simplex",
              print_spectrum: "color",
            },
          },
        }),
      });
      const created = await create.json().catch(() => ({}));
      if (!create.ok) {
        console.error("pingen create", create.status, JSON.stringify(created).slice(0, 500));
        const detail = created?.errors?.[0]?.detail ?? created?.errors?.[0]?.title ?? "";
        return json({ ok: false, error: `Pingen hat den Brief abgelehnt${detail ? `: ${detail}` : "."}` }, 502);
      }
      const letterId = created?.data?.id ?? null;
      const status = created?.data?.attributes?.status ?? "submitted";
      await log(c.id, "brief_pingen", String(body.subject ?? "Brief"), "", { letter_id: letterId, status, delivery, staging: auth.staging });
      if (c.status === "neu") await db.from("owner_contacts").update({ status: "brief", updated_at: new Date().toISOString() }).eq("id", c.id);
      return json({ ok: true, letter_id: letterId, status, staging: auth.staging });
    }

    return json({ ok: false, error: "Unbekannte Aktion." }, 400);
  } catch (e) {
    console.error("owner-outreach", e);
    return json({ ok: false, error: String(e?.message ?? "").startsWith("Pingen") ? e.message : "Das hat gerade nicht geklappt. Bitte noch einmal versuchen." }, 500);
  }
});
