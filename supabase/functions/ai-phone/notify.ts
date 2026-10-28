// Benachrichtigung per E-Mail und SMS über Brevo (EU-Anbieter)
//
// Benötigte Secrets in Supabase (npx supabase secrets set ...):
//   BREVO_API_KEY        API-Schlüssel aus dem Brevo-Konto (SMTP & API)
//   BREVO_SENDER_EMAIL   in Brevo bestätigte Absenderadresse
// Optional:
//   BREVO_SENDER_NAME    Absendername der E-Mail (Standard: "MalerSaaS KI-Telefon")
//   BREVO_SMS_SENDER     SMS-Absender, max. 11 Zeichen ohne Leerzeichen (Standard: "MalerSaaS")
//   APP_URL              Link in der E-Mail (Standard: https://maler-saas.com)

import { normalizePhone } from "./slots.ts";

export type NotifyEvent =
  | { kind: "callback"; name: string; phone: string; concern: string; preferredTime: string }
  | { kind: "appointment"; name: string; phone: string; address: string; when: string; concern: string }
  | { kind: "test" };

export type NotifyResult = { email: string; sms: string };

type Settings = {
  company_name?: string | null;
  notify_email?: string | null;
  notify_phone?: string | null;
  notify_callback_email?: boolean;
  notify_callback_sms?: boolean;
  notify_appointment_email?: boolean;
  notify_appointment_sms?: boolean;
};

const env = (k: string) => (globalThis as any).Deno?.env?.get(k) ?? "";
const apiBase = () => env("BREVO_API_URL") || "https://api.brevo.com/v3";

function esc(s: string): string {
  return s.replace(/[&<>"']/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" })[c]!);
}

function cut(s: string, max: number): string {
  return s.length <= max ? s : s.slice(0, max - 1) + "…";
}

/** Inhalte der Nachricht – reine Funktion, damit testbar */
export function buildMessage(event: NotifyEvent, company: string) {
  const appUrl = env("APP_URL") || "https://maler-saas.com";
  if (event.kind === "test") {
    return {
      subject: `Test: Benachrichtigung vom KI-Telefon (${company})`,
      lines: ["Das ist eine Test-Benachrichtigung.", "Wenn du sie erhältst, ist alles richtig eingerichtet."],
      sms: `Test vom KI-Telefon (${company}): Benachrichtigungen funktionieren.`,
      appUrl,
    };
  }
  if (event.kind === "callback") {
    const lines = [
      `Name: ${event.name || "nicht genannt"}`,
      `Telefon: ${event.phone}`,
      event.concern && `Anliegen: ${event.concern}`,
      event.preferredTime && `Passt am besten: ${event.preferredTime}`,
    ].filter(Boolean) as string[];
    return {
      subject: `📞 Rückrufwunsch: ${event.name || event.phone}`,
      lines,
      sms: cut(
        `Rückrufwunsch: ${event.name ? event.name + ", " : ""}${event.phone}${event.concern ? " – " + event.concern : ""}`,
        160
      ),
      appUrl,
    };
  }
  const lines = [
    `Wann: ${event.when}`,
    `Name: ${event.name}`,
    `Telefon: ${event.phone}`,
    `Adresse: ${event.address}`,
    event.concern && `Anliegen: ${event.concern}`,
    "Bitte in der App prüfen und an einen Projektleiter weiterleiten.",
  ].filter(Boolean) as string[];
  return {
    subject: `🤖 Neuer Besichtigungstermin: ${event.name}, ${event.when}`,
    lines,
    sms: cut(`Neuer KI-Termin: ${event.when}, ${event.name}, ${event.address}`, 160),
    appUrl,
  };
}

async function brevo(path: string, body: unknown): Promise<string> {
  const key = env("BREVO_API_KEY");
  if (!key) return "fehlt: BREVO_API_KEY";
  const res = await fetch(`${apiBase()}${path}`, {
    method: "POST",
    headers: { accept: "application/json", "content-type": "application/json", "api-key": key },
    body: JSON.stringify(body),
    signal: AbortSignal.timeout(8000),
  });
  if (res.ok) return "gesendet";
  const text = await res.text().catch(() => "");
  return `Fehler ${res.status}: ${text.slice(0, 200)}`;
}

async function sendEmail(to: string, msg: ReturnType<typeof buildMessage>, company: string): Promise<string> {
  const sender = env("BREVO_SENDER_EMAIL");
  if (!sender) return "fehlt: BREVO_SENDER_EMAIL";
  const html = `<div style="font-family:Arial,sans-serif;font-size:15px;color:#0f172a">
<h2 style="margin:0 0 12px">${esc(msg.subject)}</h2>
${msg.lines.map((l) => `<p style="margin:4px 0">${esc(l)}</p>`).join("\n")}
<p style="margin:18px 0 0"><a href="${esc(msg.appUrl)}" style="background:#4f46e5;color:#fff;padding:10px 16px;border-radius:10px;text-decoration:none">In der App öffnen</a></p>
<p style="margin:18px 0 0;color:#64748b;font-size:12px">Automatisch gesendet vom KI-Telefon von ${esc(company)}.</p>
</div>`;
  return brevo("/smtp/email", {
    sender: { email: sender, name: env("BREVO_SENDER_NAME") || "MalerSaaS KI-Telefon" },
    to: [{ email: to }],
    subject: msg.subject,
    htmlContent: html,
    textContent: [...msg.lines, "", msg.appUrl].join("\n"),
  });
}

async function sendSms(to: string, text: string): Promise<string> {
  const recipient = normalizePhone(to);
  if (recipient.length < 8) return "ungültige Handynummer";
  const sender = (env("BREVO_SMS_SENDER") || "MalerSaaS").replace(/[^A-Za-z0-9]/g, "").slice(0, 11) || "MalerSaaS";
  return brevo("/transactionalSMS/send", {
    sender,
    recipient,
    content: text,
    type: "transactional",
    unicodeEnabled: /[^\x00-\x7F]/.test(text),
  });
}

/** Je nach Einstellungen E-Mail und/oder SMS verschicken. Wirft nie. */
export async function notify(settings: Settings, event: NotifyEvent, companyName: string): Promise<NotifyResult> {
  const result: NotifyResult = { email: "aus", sms: "aus" };
  const wantEmail =
    event.kind === "test" ||
    (event.kind === "callback" ? settings.notify_callback_email : settings.notify_appointment_email) === true;
  const wantSms =
    event.kind === "test" ||
    (event.kind === "callback" ? settings.notify_callback_sms : settings.notify_appointment_sms) === true;

  const msg = buildMessage(event, companyName);
  const jobs: Promise<void>[] = [];

  if (wantEmail) {
    if (!settings.notify_email) result.email = event.kind === "test" ? "keine E-Mail-Adresse hinterlegt" : "aus";
    else
      jobs.push(
        sendEmail(settings.notify_email, msg, companyName)
          .then((r) => void (result.email = r))
          .catch((e) => void (result.email = `Fehler: ${String(e?.message ?? e)}`))
      );
  }
  if (wantSms) {
    if (!settings.notify_phone) result.sms = event.kind === "test" ? "keine Handynummer hinterlegt" : "aus";
    else
      jobs.push(
        sendSms(settings.notify_phone, msg.sms)
          .then((r) => void (result.sms = r))
          .catch((e) => void (result.sms = `Fehler: ${String(e?.message ?? e)}`))
      );
  }

  await Promise.all(jobs);
  if (result.email.startsWith("Fehler") || result.email.startsWith("fehlt")) console.error("notify email", result.email);
  if (result.sms.startsWith("Fehler") || result.sms.startsWith("fehlt")) console.error("notify sms", result.sms);
  return result;
}
