// Rechnungen, Mahnungen und Angebote per E-Mail versenden (Brevo)
//   POST { kind: "invoice"|"reminder"|"quote", invoice_id?, reminder_id?, quote_id?, to, subject, text, copy: boolean,
//          attachments: [{ name, content (Base64) }] }
// Anhänge (ZUGFeRD-PDF, XRechnung, Mahnungs-PDF, Angebots-PDF) erzeugt die App im Browser.
// Secrets: BREVO_API_KEY, BREVO_SENDER_EMAIL (bereits vorhanden),
//          optional BREVO_INVOICE_SENDER_EMAIL (z. B. rechnung@maler-saas.com, in Brevo bestätigt)

import { serve } from "https://deno.land/std@0.224.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.45.4";
import { base64Size, bodyHtml, logoUrl, cleanEmail, cleanFileName, cleanSubject, MAX_ATTACHMENT_BYTES, MAX_PER_DAY, senderName } from "./logic.ts";

/* eslint-disable @typescript-eslint/no-explicit-any */

const db = createClient(Deno.env.get("SUPABASE_URL")!, Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!, { auth: { persistSession: false } });
const HEADERS = {
  "content-type": "application/json; charset=utf-8",
  "access-control-allow-origin": "*",
  "access-control-allow-headers": "authorization, content-type, apikey, x-client-info",
  "access-control-allow-methods": "POST, OPTIONS",
};
const json = (data: unknown, status = 200) => new Response(JSON.stringify(data), { status, headers: HEADERS });
const ALLOWED_STATUS = ["active", "trialing", "past_due"];

serve(async (req) => {
  if (req.method === "OPTIONS") return new Response(null, { headers: HEADERS });
  if (req.method !== "POST") return json({ ok: false, error: "Nur POST" }, 405);
  try {
    // ---------- Anmeldung: nur Admins ----------
    const token = (req.headers.get("authorization") ?? "").replace(/^Bearer\s+/i, "");
    if (!token) return json({ ok: false, error: "Bitte erneut anmelden." }, 401);
    const { data: authData, error: authErr } = await db.auth.getUser(token);
    if (authErr || !authData?.user) return json({ ok: false, error: "Bitte erneut anmelden." }, 401);
    const { data: user } = await db.from("app_users").select("id, tenant_id, role_id").eq("auth_user_id", authData.user.id).maybeSingle();
    if (!user || ![1, 2].includes(Number(user.role_id))) return json({ ok: false, error: "Nur Admins dürfen Dokumente versenden." }, 403);
    const tenantId = Number(user.tenant_id);

    const { data: sub } = await db.from("subscriptions").select("plan, status").eq("tenant_id", tenantId).order("id", { ascending: false }).limit(1).maybeSingle();
    if (!sub || !ALLOWED_STATUS.includes(sub.status)) return json({ ok: false, error: "Für den Versand wird ein aktives Abo benötigt." }, 403);

    const body = await req.json().catch(() => ({}));
    const kind = body.kind === "reminder" ? "reminder" : body.kind === "invoice" ? "invoice" : body.kind === "quote" ? "quote" : null;
    if (!kind) return json({ ok: false, error: "Unbekannte Art." }, 400);

    // ---------- Angebot / Rechnung / Mahnung gehört zum Betrieb? ----------
    let quote: any = null;
    let invoice: any = null;
    if (kind === "quote") {
      const { data } = await db.from("quotes").select("id, tenant_id, quote_number, status").eq("id", Number(body.quote_id)).maybeSingle();
      if (!data || Number(data.tenant_id) !== tenantId) return json({ ok: false, error: "Angebot nicht gefunden." }, 404);
      quote = data;
    } else {
      const { data } = await db.from("invoices").select("id, tenant_id, invoice_number, status").eq("id", Number(body.invoice_id)).maybeSingle();
      if (!data || Number(data.tenant_id) !== tenantId) return json({ ok: false, error: "Rechnung nicht gefunden." }, 404);
      invoice = data;
    }
    let reminder: any = null;
    if (kind === "reminder") {
      const { data } = await db.from("invoice_reminders").select("id, tenant_id, invoice_id, status, reminder_level").eq("id", Number(body.reminder_id)).maybeSingle();
      if (!data || Number(data.tenant_id) !== tenantId || Number(data.invoice_id) !== Number(invoice.id)) return json({ ok: false, error: "Mahnung nicht gefunden." }, 404);
      if (data.status === "cancelled") return json({ ok: false, error: "Diese Mahnung wurde zurückgezogen." }, 400);
      reminder = data;
    }

    // ---------- Eingaben prüfen ----------
    const to = cleanEmail(body.to);
    if (!to) return json({ ok: false, error: "Bitte eine gültige E-Mail-Adresse des Empfängers eingeben." }, 400);
    const subject = cleanSubject(body.subject);
    if (!subject) return json({ ok: false, error: "Bitte einen Betreff eingeben." }, 400);
    const text = String(body.text ?? "").slice(0, 10000);
    if (!text.trim()) return json({ ok: false, error: "Bitte einen Text eingeben." }, 400);
    const atts: { name: string; content: string }[] = [];
    let total = 0;
    for (const a of Array.isArray(body.attachments) ? body.attachments.slice(0, 3) : []) {
      const name = cleanFileName(a?.name);
      const content = String(a?.content ?? "").replace(/\s/g, "");
      if (!name || !/^[A-Za-z0-9+/]+=*$/.test(content)) return json({ ok: false, error: "Ungültiger Anhang." }, 400);
      total += base64Size(content);
      atts.push({ name, content });
    }
    if (!atts.length) return json({ ok: false, error: "Kein Anhang." }, 400);
    if (total > MAX_ATTACHMENT_BYTES) return json({ ok: false, error: "Die Anhänge sind zu groß (max. 8 MB)." }, 400);

    // ---------- Obergrenze pro Tag ----------
    const since = new Date(Date.now() - 24 * 3600 * 1000).toISOString();
    const { count } = await db.from("document_emails").select("id", { count: "exact", head: true }).eq("tenant_id", tenantId).gte("sent_at", since);
    if ((count ?? 0) >= MAX_PER_DAY) return json({ ok: false, error: `Tageslimit erreicht (${MAX_PER_DAY} E-Mails in 24 Stunden). Bitte später erneut versuchen.` }, 429);

    // ---------- Firmendaten ----------
    const { data: company } = await db.from("company_settings").select("company_name, email, phone, street, zip, city, logo_url").eq("tenant_id", tenantId).maybeSingle();
    const replyTo = cleanEmail(company?.email);
    if (!replyTo) return json({ ok: false, error: "Bitte zuerst unter „Einstellungen“ die E-Mail-Adresse der Firma eintragen – an sie gehen die Antworten Ihrer Kunden." }, 400);
    const copyTo = body.copy && replyTo.toLowerCase() !== to.toLowerCase() ? replyTo : null;

    const key = Deno.env.get("BREVO_API_KEY");
    const sender = Deno.env.get("BREVO_INVOICE_SENDER_EMAIL") || Deno.env.get("BREVO_SENDER_EMAIL");
    if (!key || !sender) return json({ ok: false, error: "Der E-Mail-Versand ist noch nicht eingerichtet (Brevo)." }, 500);

    const footer = [company?.company_name, [company?.street, [company?.zip, company?.city].filter(Boolean).join(" ")].filter(Boolean).join(", "), company?.phone, replyTo];
    const res = await fetch("https://api.brevo.com/v3/smtp/email", {
      method: "POST",
      headers: { accept: "application/json", "content-type": "application/json", "api-key": key },
      body: JSON.stringify({
        sender: { email: sender, name: senderName(company?.company_name) },
        replyTo: { email: replyTo, name: senderName(company?.company_name) },
        to: [{ email: to }],
        ...(copyTo ? { bcc: [{ email: copyTo }] } : {}),
        subject,
        htmlContent: bodyHtml(text, footer, { url: logoUrl(company?.logo_url), alt: senderName(company?.company_name) }),
        textContent: `${text.trim()}\n\n--\n${footer.filter(Boolean).join("\n")}`,
        attachment: atts,
        tags: [kind === "invoice" ? "rechnung" : kind === "quote" ? "angebot" : "mahnung"],
      }),
      signal: AbortSignal.timeout(20000),
    });
    const out = await res.json().catch(() => ({}));
    if (!res.ok) {
      console.error("brevo", res.status, JSON.stringify(out).slice(0, 400));
      return json({ ok: false, error: "Die E-Mail konnte nicht versendet werden. Bitte später erneut versuchen." }, 502);
    }

    const sentAt = new Date().toISOString();
    const { error: logErr } = await db.from("document_emails").insert({
      tenant_id: tenantId,
      kind,
      invoice_id: invoice?.id ?? null,
      quote_id: quote?.id ?? null,
      reminder_id: reminder?.id ?? null,
      recipient: to,
      copy_to: copyTo,
      subject,
      attachments: atts.map((a) => a.name),
      provider_message_id: out?.messageId ?? null,
      sent_by: user.id,
      sent_at: sentAt,
    });
    if (logErr) console.error("log", logErr.message);
    if (reminder && reminder.status === "created") {
      await db.from("invoice_reminders").update({ status: "sent", sent_at: sentAt, updated_at: sentAt }).eq("id", reminder.id).eq("tenant_id", tenantId);
    }
    // Angebot: Entwurf → "Gesendet" (abgelehnte/angenommene bleiben, wie sie sind)
    if (quote && (quote.status === "draft" || !quote.status)) {
      await db.from("quotes").update({ status: "sent" }).eq("id", quote.id).eq("tenant_id", tenantId);
    }
    return json({ ok: true, sent_at: sentAt, to, copy_to: copyTo });
  } catch (e) {
    console.error("send-document", e);
    return json({ ok: false, error: "Unerwarteter Fehler beim Versand." }, 500);
  }
});
