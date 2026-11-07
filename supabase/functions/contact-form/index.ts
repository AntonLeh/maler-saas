// Kontaktformular der Startseite → E-Mail an das MalerSaaS-Postfach (Brevo)
//   POST { name, company?, email, phone?, message, website (Falle), elapsed (ms seit Laden) }
// Schutz: unsichtbares Fallen-Feld, Mindestzeit, Grenzen pro Absender/IP und pro Tag (Tabelle contact_messages)
// Secrets: BREVO_API_KEY, BREVO_SENDER_EMAIL (vorhanden), optional CONTACT_EMAIL (Standard info@maler-saas.com)

import { serve } from "https://deno.land/std@0.224.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.45.4";
import { checkContact } from "./logic.ts";

const env = (k: string) => Deno.env.get(k) ?? "";
const db = createClient(env("SUPABASE_URL"), env("SUPABASE_SERVICE_ROLE_KEY"), { auth: { persistSession: false } });
const HEADERS = {
  "content-type": "application/json; charset=utf-8",
  "access-control-allow-origin": "*",
  "access-control-allow-headers": "authorization, content-type, apikey, x-client-info",
  "access-control-allow-methods": "POST, OPTIONS",
};
const json = (data: unknown, status = 200) => new Response(JSON.stringify(data), { status, headers: HEADERS });

async function sha256(s: string) {
  const buf = await crypto.subtle.digest("SHA-256", new TextEncoder().encode(s));
  return Array.from(new Uint8Array(buf)).map((b) => b.toString(16).padStart(2, "0")).join("");
}

serve(async (req) => {
  if (req.method === "OPTIONS") return new Response(null, { headers: HEADERS });
  if (req.method !== "POST") return json({ ok: false, error: "Nur POST" }, 405);
  try {
    const body = await req.json().catch(() => ({}));
    const c = checkContact(body);
    if (c.spam) return json({ ok: true }); // Spam: so tun, als ob alles geklappt hat
    if (c.error) return json({ ok: false, error: c.error }, 400);
    const m = c.data!;

    // Grenzen: pro IP 5 je Stunde, insgesamt 100 je Tag
    const ip = (req.headers.get("x-forwarded-for") ?? "").split(",")[0].trim() || "unbekannt";
    const ipHash = await sha256(`${ip}|${env("SUPABASE_URL")}`);
    const hourAgo = new Date(Date.now() - 3600_000).toISOString();
    const dayAgo = new Date(Date.now() - 86400_000).toISOString();
    const [{ count: perIp }, { count: perDay }] = await Promise.all([
      db.from("contact_messages").select("id", { count: "exact", head: true }).eq("ip_hash", ipHash).gte("created_at", hourAgo),
      db.from("contact_messages").select("id", { count: "exact", head: true }).gte("created_at", dayAgo),
    ]);
    if ((perIp ?? 0) >= 5 || (perDay ?? 0) >= 100) {
      return json({ ok: false, error: "Es wurden gerade sehr viele Nachrichten gesendet. Bitte versuchen Sie es später erneut." }, 429);
    }

    const { error: insErr } = await db.from("contact_messages").insert({ ...m, ip_hash: ipHash });
    if (insErr) console.error("contact insert", insErr.message);

    const key = env("BREVO_API_KEY");
    const sender = env("BREVO_SENDER_EMAIL");
    const to = env("CONTACT_EMAIL") || "info@maler-saas.com";
    if (!key || !sender) return json({ ok: false, error: "Das Formular ist gerade nicht erreichbar." }, 500);
    const text = [
      `Neue Anfrage über das Kontaktformular auf maler-saas.com`,
      ``,
      `Name: ${m.name}`,
      m.company ? `Firma: ${m.company}` : "",
      `E-Mail: ${m.email}`,
      m.phone ? `Telefon: ${m.phone}` : "",
      ``,
      m.message,
    ]
      .filter((l, i, a) => l !== "" || a[i - 1] !== "")
      .join("\n");
    const res = await fetch("https://api.brevo.com/v3/smtp/email", {
      method: "POST",
      headers: { accept: "application/json", "content-type": "application/json", "api-key": key },
      body: JSON.stringify({
        sender: { email: sender, name: "MalerSaaS Kontaktformular" },
        replyTo: { email: m.email, name: m.name },
        to: [{ email: to }],
        subject: `Kontaktanfrage: ${m.name}${m.company ? ` (${m.company})` : ""}`,
        textContent: text,
        tags: ["kontaktformular"],
      }),
      signal: AbortSignal.timeout(20000),
    });
    if (!res.ok) {
      console.error("brevo", res.status, (await res.text()).slice(0, 300));
      return json({ ok: false, error: "Die Nachricht konnte gerade nicht gesendet werden." }, 502);
    }
    return json({ ok: true });
  } catch (e) {
    console.error("contact-form", e);
    return json({ ok: false, error: "Unerwarteter Fehler." }, 500);
  }
});
