// @ts-nocheck
// =====================================================================
// Hilfe-Chat von maler-saas.com – für Besucher der Startseite und angemeldete Kunden in der App
//
// POST …/functions/v1/help-chat  Body { chat_id?, message, page? }   (optional Authorization: Bearer <Login-Token>)
//   -> { ok, chat_id, reply, support_sent }
// Beantwortet Fragen zu MalerSaaS und schickt auf Wunsch eine Support-Anfrage per E-Mail an das Team.
// Verläufe: Tabelle help_chats (90 Tage).
// Secrets (vorhanden): ANTHROPIC_API_KEY, BREVO_API_KEY, BREVO_SENDER_EMAIL
// Optional: HELP_CHAT_MODEL (Standard claude-sonnet-5-5, Ersatz claude-haiku-5-5),
//           HELP_CHAT_MONTHLY_LIMIT (Standard 3000 Antworten insgesamt), HELP_CHAT_SUPPORT_EMAIL (Standard info@maler-saas.com)
// Deploy:  npx supabase functions deploy help-chat --no-verify-jwt
// =====================================================================

import { serve } from "https://deno.land/std@0.224.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.45.4";
import { SUPPORT_TOOL, cleanSupport, planName, replyText, roleName, systemPrompt, toApiMessages } from "./prompt.ts";

const db = createClient(Deno.env.get("SUPABASE_URL")!, Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!, { auth: { persistSession: false } });

const HEADERS = {
  "content-type": "application/json; charset=utf-8",
  "access-control-allow-origin": "*",
  "access-control-allow-headers": "authorization, content-type, apikey, x-client-info",
  "access-control-allow-methods": "POST, OPTIONS",
  "cache-control": "no-store",
};
const json = (data: unknown, status = 200) => new Response(JSON.stringify(data), { status, headers: HEADERS });
const fail = (error: string, status = 400) => json({ ok: false, error }, status);

const MAX_REPLIES_PER_CHAT = 30;
const NEW_PUBLIC_CHATS_PER_HOUR = 60;
const NEW_APP_CHATS_PER_DAY = 40; // je Betrieb
const KEEP_DAYS = 90;
const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
const esc = (v: unknown) =>
  String(v ?? "").replace(/[&<>"']/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" })[c]);
const FALLBACK = "Entschuldigung, das hat gerade nicht geklappt. Schreiben Sie uns gerne an info@maler-saas.com.";
const TOPICS: Record<string, string> = { fehler: "Fehler", frage: "Frage", demo: "Demo", angebot: "Angebot", sonstiges: "Sonstiges" };

/** Angemeldeten Nutzer erkennen (optional). Ungültiges Token = Besucher. */
async function findUser(req: Request) {
  const token = (req.headers.get("authorization") ?? "").replace(/^Bearer\s+/i, "");
  if (!token || token.split(".").length !== 3) return null;
  const { data: authData, error } = await db.auth.getUser(token);
  if (error || !authData?.user) return null;
  const { data: u } = await db.from("app_users").select("id, tenant_id, role_id, first_name, last_name, email").eq("auth_user_id", authData.user.id).maybeSingle();
  if (!u?.tenant_id) return null;
  const [{ data: sub }, { data: cs }] = await Promise.all([
    db.from("subscriptions").select("plan, status").eq("tenant_id", u.tenant_id).order("id", { ascending: false }).limit(1).maybeSingle(),
    db.from("company_settings").select("company_name").eq("tenant_id", u.tenant_id).order("id", { ascending: false }).limit(1).maybeSingle(),
  ]);
  return {
    tenantId: u.tenant_id,
    email: String(u.email || authData.user.email || ""),
    name: `${u.first_name ?? ""} ${u.last_name ?? ""}`.trim(),
    role: roleName(u.role_id),
    plan: sub?.plan ?? "",
    status: sub?.status ?? "",
    company: cs?.company_name ?? "",
  };
}

async function callClaude(body: Record<string, unknown>) {
  const apiKey = Deno.env.get("ANTHROPIC_API_KEY");
  if (!apiKey) throw new Error("ANTHROPIC_API_KEY fehlt");
  const models = [Deno.env.get("HELP_CHAT_MODEL") || "claude-sonnet-5-5", "claude-haiku-5-5"];
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

async function sendSupportMail(r: { name: string; email: string; phone: string; topic: string; message: string }, user: any, transcript: { role: string; text: string }[], page: string) {
  const key = Deno.env.get("BREVO_API_KEY");
  const sender = Deno.env.get("BREVO_SENDER_EMAIL");
  const to = Deno.env.get("HELP_CHAT_SUPPORT_EMAIL") || "info@maler-saas.com";
  if (!key || !sender) return false;
  const chat = transcript
    .map((m) => `<p style="margin:4px 0"><strong>${m.role === "user" ? "Nutzer" : "Assistent"}:</strong> ${esc(m.text).replace(/\n/g, "<br>")}</p>`)
    .join("");
  const who = user
    ? `<p><strong>Angemeldeter Kunde</strong><br>Firma: ${esc(user.company || "–")} (Betrieb #${esc(user.tenantId)})<br>Tarif: ${esc(planName(user.plan) || "–")} · Status: ${esc(user.status || "–")}<br>Rolle: ${esc(user.role || "–")}${user.email ? `<br>Konto-E-Mail: ${esc(user.email)}` : ""}</p>`
    : `<p><strong>Besucher</strong> auf maler-saas.com${page ? ` (Seite: ${esc(page)})` : ""}</p>`;
  const html = `<p>Neue Anfrage über den <strong>Hilfe-Chat</strong> (${esc(TOPICS[r.topic] ?? r.topic)}):</p>
<p><strong>${esc(r.name)}</strong><br>E-Mail: ${esc(r.email)}${r.phone ? `<br>Telefon: ${esc(r.phone)}` : ""}</p>
${who}
<p>${esc(r.message).replace(/\n/g, "<br>")}</p>
<details><summary>Chat-Verlauf</summary><div style="color:#444;font-size:14px">${chat}</div></details>`;
  const res = await fetch("https://api.brevo.com/v3/smtp/email", {
    method: "POST",
    headers: { "api-key": key, "content-type": "application/json", accept: "application/json" },
    body: JSON.stringify({
      sender: { email: sender, name: "MalerSaaS Hilfe-Chat" },
      to: [{ email: to, name: "MalerSaaS Support" }],
      replyTo: { email: r.email, name: r.name },
      subject: `Hilfe-Chat: ${TOPICS[r.topic] ?? "Anfrage"} von ${r.name}${user?.company ? ` (${user.company})` : ""}`,
      htmlContent: html,
    }),
  }).catch((e) => (console.error("brevo", e), null));
  if (!res) return false;
  if (!res.ok) {
    console.error("brevo", res.status, (await res.text().catch(() => "")).slice(0, 300));
    return false;
  }
  return true;
}

serve(async (req) => {
  if (req.method === "OPTIONS") return new Response(null, { headers: HEADERS });
  if (req.method !== "POST") return fail("Nur POST", 405);
  try {
    const b = await req.json().catch(() => ({}));
    const message = String(b.message ?? "").trim().slice(0, 1000);
    if (!message) return fail("Bitte eine Nachricht eingeben.");
    const page = String(b.page ?? "").replace(/[^a-z0-9/_-]/gi, "").slice(0, 80);
    const user = await findUser(req);
    const mode = user ? "app" : "public";

    // ---------- Monatslimit (alle Chats zusammen) ----------
    const limit = Number(Deno.env.get("HELP_CHAT_MONTHLY_LIMIT") ?? 3000) || 3000;
    const monthStart = new Date(Date.UTC(new Date().getUTCFullYear(), new Date().getUTCMonth(), 1)).toISOString();
    const { data: usage } = await db.from("help_chats").select("bot_replies").gte("updated_at", monthStart).limit(20000);
    const used = (usage ?? []).reduce((a: number, r: any) => a + (Number(r.bot_replies) || 0), 0);
    if (used >= limit) return json({ ok: true, chat_id: b.chat_id ?? null, reply: "Der Hilfe-Chat ist im Moment nicht erreichbar. Schreiben Sie uns gerne an info@maler-saas.com.", limit: true });

    // ---------- Unterhaltung laden oder neu beginnen ----------
    let chat: any = null;
    if (UUID.test(String(b.chat_id ?? ""))) {
      const { data } = await db.from("help_chats").select("id, mode, tenant_id, messages, bot_replies, support_sent, updated_at").eq("id", b.chat_id).maybeSingle();
      // nur fortsetzen, wenn es dieselbe Art von Nutzer ist (Besucher bzw. derselbe Betrieb) und nicht älter als 1 Tag
      const same = data && data.mode === mode && (mode === "public" || Number(data.tenant_id) === Number(user.tenantId));
      if (same && Date.parse(data.updated_at) > Date.now() - 86_400_000) chat = data;
    }
    if (!chat) {
      if (user) {
        const { count } = await db.from("help_chats").select("id", { count: "exact", head: true }).eq("tenant_id", user.tenantId).gte("created_at", new Date(Date.now() - 86_400_000).toISOString());
        if ((count ?? 0) >= NEW_APP_CHATS_PER_DAY) return fail("Heute wurden schon sehr viele Chats gestartet. Bitte schreiben Sie uns an info@maler-saas.com.", 429);
      } else {
        const { count } = await db.from("help_chats").select("id", { count: "exact", head: true }).eq("mode", "public").gte("created_at", new Date(Date.now() - 3_600_000).toISOString());
        if ((count ?? 0) >= NEW_PUBLIC_CHATS_PER_HOUR) return fail("Gerade ist sehr viel los. Bitte versuchen Sie es später noch einmal oder schreiben Sie uns an info@maler-saas.com.", 429);
      }
      // Aufräumen: Verläufe älter als 90 Tage löschen
      await db.from("help_chats").delete().lt("updated_at", new Date(Date.now() - KEEP_DAYS * 86_400_000).toISOString());
      const { data, error } = await db
        .from("help_chats")
        .insert([{ mode, tenant_id: user?.tenantId ?? null, page: page || null, messages: [], bot_replies: 0 }])
        .select("id, mode, tenant_id, messages, bot_replies, support_sent, updated_at")
        .single();
      if (error) throw error;
      chat = data;
    }
    if ((chat.bot_replies ?? 0) >= MAX_REPLIES_PER_CHAT) {
      return json({ ok: true, chat_id: chat.id, reply: "Dieser Chat ist schon recht lang geworden. Starten Sie gerne einen neuen Chat oder schreiben Sie uns an info@maler-saas.com." });
    }

    const now = new Date().toISOString();
    const history = [...(Array.isArray(chat.messages) ? chat.messages : []), { role: "user", text: message, at: now }];
    const system = systemPrompt({
      mode,
      page,
      user: user ? { name: user.name, company: user.company, plan: user.plan, status: user.status, role: user.role } : null,
    });

    // ---------- KI fragen (höchstens 2 Runden mit Werkzeug) ----------
    let messages: any[] = toApiMessages(history.slice(-30));
    let reply = "";
    let sent = false;
    let alreadySent = chat.support_sent === true;
    for (let round = 0; round < 3; round++) {
      const data = await callClaude({
        max_tokens: 800,
        system: [{ type: "text", text: system, cache_control: { type: "ephemeral" } }],
        tools: [SUPPORT_TOOL],
        tool_choice: { type: "auto" },
        messages,
      });
      const uses = (data.content ?? []).filter((c: any) => c.type === "tool_use" && c.name === "support_anfrage");
      if (!uses.length || round === 2) {
        reply = replyText(data.content);
        break;
      }
      const results: any[] = [];
      for (const u of uses) {
        let result = "";
        if (sent) result = "Diese Anfrage wurde gerade schon geschickt. Nicht erneut senden.";
        else {
          const v = cleanSupport(u.input, user?.email ?? "");
          if (!v.ok) result = `Nicht gesendet: ${v.error}. Bitte beim Nutzer nachfragen.`;
          else if (await sendSupportMail(v.req, user, history, page)) {
            sent = true;
            alreadySent = true;
            result = `Gesendet. Unser Team antwortet per E-Mail an ${v.req.email}.`;
          } else result = "Senden fehlgeschlagen. Bitte den Nutzer bitten, direkt an info@maler-saas.com zu schreiben.";
        }
        results.push({ type: "tool_result", tool_use_id: u.id, content: result });
      }
      messages = [...messages, { role: "assistant", content: data.content }, { role: "user", content: results }];
    }
    if (!reply) reply = sent ? "Vielen Dank! Ihre Anfrage ist bei unserem Team angekommen – wir melden uns per E-Mail." : FALLBACK;
    reply = reply.slice(0, 2500);

    history.push({ role: "assistant", text: reply, at: new Date().toISOString(), ...(sent ? { support: true } : {}) });
    await db
      .from("help_chats")
      .update({ messages: history.slice(-80), bot_replies: (chat.bot_replies ?? 0) + 1, support_sent: alreadySent, updated_at: new Date().toISOString() })
      .eq("id", chat.id);
    return json({ ok: true, chat_id: chat.id, reply, support_sent: sent });
  } catch (e) {
    console.error("help-chat", e);
    return json({ ok: false, error: FALLBACK }, 500);
  }
});
