// @ts-nocheck
// =====================================================================
// Modul Website – KI-Chatassistent auf der Firmen-Website (öffentlich, ohne Login)
//
// POST …/functions/v1/website-chat  Body { site, chat_id?, message, page? }
//   -> { ok, chat_id, reply, lead_saved }
// Beantwortet Fragen aus den Angaben der Website und nimmt Anfragen auf (landen unter „Anfragen“ + E-Mail).
// Verläufe: Tabelle website_chats (90 Tage).
// Secrets (vorhanden): ANTHROPIC_API_KEY, BREVO_API_KEY, BREVO_SENDER_EMAIL
// Optional: WEBSITE_CHAT_MODEL (Standard claude-haiku-5-5), WEBSITE_CHAT_MONTHLY_LIMIT (Standard 3000 Antworten/Betrieb)
// Deploy:  npx supabase functions deploy website-chat --no-verify-jwt
// =====================================================================

import { serve } from "https://deno.land/std@0.224.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.45.4";
import { LEAD_TOOL, cleanLead, replyText, systemPrompt, toApiMessages } from "./prompt.ts";

const db = createClient(Deno.env.get("SUPABASE_URL")!, Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!, { auth: { persistSession: false } });

const HEADERS = {
  "content-type": "application/json; charset=utf-8",
  "access-control-allow-origin": "*",
  "access-control-allow-headers": "content-type",
  "access-control-allow-methods": "POST, OPTIONS",
  "cache-control": "no-store",
};
const json = (data: unknown, status = 200) => new Response(JSON.stringify(data), { status, headers: HEADERS });
const fail = (error: string, status = 400) => json({ ok: false, error }, status);

const ALLOWED_STATUS = ["active", "trialing", "past_due"];
const planOk = (sub: any) => !!sub && ALLOWED_STATUS.includes(sub.status) && (sub.plan === "enterprise" || sub.status === "trialing");
const MAX_REPLIES_PER_CHAT = 30;
const NEW_CHATS_PER_HOUR = 100;
const KEEP_DAYS = 90;
const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
const esc = (v: unknown) =>
  String(v ?? "").replace(/[&<>"']/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" })[c]);
const FALLBACK = "Entschuldigung, das hat gerade nicht geklappt. Rufen Sie uns gerne an oder nutzen Sie das Kontaktformular.";

async function findSite(site: string) {
  const key = String(site ?? "").toLowerCase().replace(/^www\./, "").slice(0, 253);
  if (!key) return null;
  const cols = "tenant_id, slug, published, chat, services, faq, highlights, about_text, service_area, opening_hours, booking, jobs, custom_domain, custom_domain_status";
  let { data: w } = await db.from("websites").select(cols).eq("slug", key).maybeSingle();
  if (!w) {
    const { data } = await db.from("websites").select(cols).in("custom_domain", [key, `www.${key}`]).eq("custom_domain_status", "active").maybeSingle();
    w = data;
  }
  if (!w || !w.published || w.chat?.enabled !== true) return null;
  const { data: sub } = await db.from("subscriptions").select("plan, status").eq("tenant_id", w.tenant_id).order("id", { ascending: false }).limit(1).maybeSingle();
  if (!planOk(sub)) return null;
  const { data: cs } = await db.from("company_settings").select("company_name, street, zip, city, phone, email").eq("tenant_id", w.tenant_id).order("id", { ascending: false }).limit(1).maybeSingle();
  return { w, cs: cs ?? {} };
}

function siteUrl(w: any) {
  if (w.custom_domain && w.custom_domain_status === "active") return `https://${w.custom_domain}`;
  return `https://${w.slug}.maler-saas.com`;
}

async function callClaude(body: Record<string, unknown>) {
  const apiKey = Deno.env.get("ANTHROPIC_API_KEY");
  if (!apiKey) throw new Error("ANTHROPIC_API_KEY fehlt");
  const models = [Deno.env.get("WEBSITE_CHAT_MODEL") || "claude-haiku-5-5", "claude-sonnet-5-5"];
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
    // nur bei Problemen mit dem Modell (nicht gefunden/ungültig) das nächste probieren
    if (![400, 404].includes(res.status) || !JSON.stringify(data).includes("model")) break;
  }
  throw new Error(`anthropic ${last?.status}`);
}

async function sendLeadMail(to: string, company: string, lead: any, transcript: { role: string; text: string }[], url: string) {
  const key = Deno.env.get("BREVO_API_KEY");
  const sender = Deno.env.get("BREVO_SENDER_EMAIL");
  if (!key || !sender || !to) return;
  const chat = transcript
    .map((m) => `<p style="margin:4px 0"><strong>${m.role === "user" ? "Besucher" : "Assistent"}:</strong> ${esc(m.text).replace(/\n/g, "<br>")}</p>`)
    .join("");
  const html = `<p>Neue Anfrage über den <strong>KI-Chat</strong> Ihrer Website:</p>
<p><strong>${esc(lead.name)}</strong><br>${lead.phone ? `Telefon: ${esc(lead.phone)}<br>` : ""}${lead.email ? `E-Mail: ${esc(lead.email)}` : ""}</p>
${lead.services.length ? `<p><strong>Leistungen:</strong> ${lead.services.map(esc).join(", ")}</p>` : ""}
<p>${esc(lead.message).replace(/\n/g, "<br>")}</p>
<details><summary>Chat-Verlauf</summary><div style="color:#444;font-size:14px">${chat}</div></details>
<p>Die Anfrage finden Sie auch in Maler-SaaS unter <em>Website → Anfragen</em>, den Verlauf unter <em>Website → Chat</em>.</p><p style="color:#888">${esc(url)}</p>`;
  const res = await fetch("https://api.brevo.com/v3/smtp/email", {
    method: "POST",
    headers: { "api-key": key, "content-type": "application/json", accept: "application/json" },
    body: JSON.stringify({
      sender: { email: sender, name: "Maler-SaaS Website" },
      to: [{ email: to, name: company || undefined }],
      replyTo: lead.email ? { email: lead.email, name: lead.name } : undefined,
      subject: `Neue Chat-Anfrage von ${lead.name}`,
      htmlContent: html,
    }),
  }).catch((e) => (console.error("brevo", e), null));
  if (res && !res.ok) console.error("brevo", res.status, (await res.text().catch(() => "")).slice(0, 300));
}

serve(async (req) => {
  if (req.method === "OPTIONS") return new Response(null, { headers: HEADERS });
  if (req.method !== "POST") return fail("Nur POST", 405);
  try {
    const b = await req.json().catch(() => ({}));
    const message = String(b.message ?? "").trim().slice(0, 1000);
    if (!message) return fail("Bitte eine Nachricht eingeben.");
    const found = await findSite(b.site);
    if (!found) return fail("Der Chat ist hier gerade nicht verfügbar.", 404);
    const { w, cs } = found;
    const tenantId = w.tenant_id;

    // ---------- Monatslimit ----------
    const limit = Number(Deno.env.get("WEBSITE_CHAT_MONTHLY_LIMIT") ?? 3000) || 3000;
    const monthStart = new Date(Date.UTC(new Date().getUTCFullYear(), new Date().getUTCMonth(), 1)).toISOString();
    const { data: usage } = await db.from("website_chats").select("bot_replies").eq("tenant_id", tenantId).gte("updated_at", monthStart).limit(10000);
    const used = (usage ?? []).reduce((a: number, r: any) => a + (Number(r.bot_replies) || 0), 0);
    if (used >= limit) return json({ ok: true, chat_id: b.chat_id ?? null, reply: "Der Chat ist im Moment nicht erreichbar. Rufen Sie uns gerne an oder nutzen Sie das Kontaktformular.", limit: true });

    // ---------- Unterhaltung laden oder neu beginnen ----------
    let chat: any = null;
    if (UUID.test(String(b.chat_id ?? ""))) {
      const { data } = await db.from("website_chats").select("id, tenant_id, messages, bot_replies, lead_id, updated_at").eq("id", b.chat_id).maybeSingle();
      if (data && data.tenant_id === tenantId && Date.parse(data.updated_at) > Date.now() - 86_400_000) chat = data;
    }
    if (!chat) {
      const { count } = await db.from("website_chats").select("id", { count: "exact", head: true }).eq("tenant_id", tenantId).gte("created_at", new Date(Date.now() - 3_600_000).toISOString());
      if ((count ?? 0) >= NEW_CHATS_PER_HOUR) return fail("Gerade ist sehr viel los. Bitte versuchen Sie es später noch einmal oder rufen Sie uns an.", 429);
      // Aufräumen: Verläufe älter als 90 Tage löschen
      await db.from("website_chats").delete().eq("tenant_id", tenantId).lt("updated_at", new Date(Date.now() - KEEP_DAYS * 86_400_000).toISOString());
      const { data, error } = await db
        .from("website_chats")
        .insert([{ tenant_id: tenantId, page: String(b.page ?? "").slice(0, 80) || null, messages: [], bot_replies: 0 }])
        .select("id, tenant_id, messages, bot_replies, lead_id, updated_at")
        .single();
      if (error) throw error;
      chat = data;
    }
    if ((chat.bot_replies ?? 0) >= MAX_REPLIES_PER_CHAT) {
      return json({ ok: true, chat_id: chat.id, reply: "Dieser Chat ist schon recht lang geworden. Für alles Weitere rufen Sie uns bitte an oder schreiben Sie uns über das Kontaktformular – wir helfen gern weiter." });
    }

    const now = new Date().toISOString();
    const history = [...(Array.isArray(chat.messages) ? chat.messages : []), { role: "user", text: message, at: now }];
    const url = siteUrl(w);
    const system = systemPrompt({ company: cs, website: w, jobs: (Array.isArray(w.jobs) ? w.jobs : []).filter((j: any) => j?.active !== false && j?.title), siteUrl: url });
    const services = (Array.isArray(w.services) ? w.services : []).map((s: any) => String(s?.title ?? "").trim()).filter(Boolean);

    // ---------- KI fragen (höchstens 2 Runden mit Werkzeug) ----------
    let messages: any[] = toApiMessages(history.slice(-30));
    let reply = "";
    let leadSaved = false;
    let leadId = chat.lead_id ?? null;
    for (let round = 0; round < 3; round++) {
      const data = await callClaude({
        max_tokens: 700,
        system: [{ type: "text", text: system, cache_control: { type: "ephemeral" } }],
        tools: [LEAD_TOOL],
        tool_choice: { type: "auto" },
        messages,
      });
      const uses = (data.content ?? []).filter((c: any) => c.type === "tool_use" && c.name === "anfrage_speichern");
      if (!uses.length || round === 2) {
        reply = replyText(data.content);
        break;
      }
      const results: any[] = [];
      for (const u of uses) {
        let result = "";
        if (leadId) result = "Die Anfrage wurde in diesem Chat bereits gespeichert. Nicht erneut speichern.";
        else {
          const v = cleanLead(u.input, services);
          if (!v.ok) result = `Nicht gespeichert: ${v.error}. Bitte beim Besucher nachfragen.`;
          else {
            const { data: lead, error } = await db
              .from("website_leads")
              .insert([{ tenant_id: tenantId, name: v.lead.name, email: v.lead.email || null, phone: v.lead.phone || null, message: `Über den KI-Chat der Website:\n${v.lead.message}`, services: v.lead.services }])
              .select("id")
              .single();
            if (error) {
              console.error("lead", error);
              result = "Speichern fehlgeschlagen. Bitte den Besucher bitten, anzurufen oder das Kontaktformular zu nutzen.";
            } else {
              leadId = lead.id;
              leadSaved = true;
              await sendLeadMail(cs.email ?? "", cs.company_name ?? "", v.lead, history, url);
              result = "Gespeichert. Der Betrieb wurde per E-Mail informiert und meldet sich.";
            }
          }
        }
        results.push({ type: "tool_result", tool_use_id: u.id, content: result });
      }
      messages = [...messages, { role: "assistant", content: data.content }, { role: "user", content: results }];
    }
    if (!reply) reply = leadSaved ? "Vielen Dank! Ihre Anfrage ist gespeichert – wir melden uns so schnell wie möglich bei Ihnen." : FALLBACK;
    reply = reply.slice(0, 2500);

    history.push({ role: "assistant", text: reply, at: new Date().toISOString(), ...(leadSaved ? { lead: true } : {}) });
    await db
      .from("website_chats")
      .update({ messages: history.slice(-80), bot_replies: (chat.bot_replies ?? 0) + 1, lead_id: leadId, updated_at: new Date().toISOString() })
      .eq("id", chat.id);
    return json({ ok: true, chat_id: chat.id, reply, lead_saved: leadSaved });
  } catch (e) {
    console.error("website-chat", e);
    return json({ ok: false, error: FALLBACK }, 500);
  }
});
