// @ts-nocheck
// =====================================================================
// Modul Website – Besichtigungstermin online buchen (öffentlich, ohne Login)
//
// GET  …/functions/v1/website-booking?action=slots&site=<web-adresse oder eigene domain>
//      -> freie Termine der nächsten Tage: { ok, days: [{ day, label, times: [{ start, time }] }], duration }
// POST …/functions/v1/website-booking?action=book
//      Body: { site, start, name, phone, email, address, concern, website (Honigtopf), t (Startzeit Formular) }
//      -> Termin im Terminkalender (source "website"), Anfrage unter „Anfragen“, E-Mail an Betrieb + Bestätigung an Kunden
//
// Die Terminlogik ist dieselbe wie beim KI-Telefon (../ai-phone/slots.ts).
// Secrets (vorhanden): BREVO_API_KEY, BREVO_SENDER_EMAIL
// Deploy:  npx supabase functions deploy website-booking --no-verify-jwt
// =====================================================================

import { serve } from "https://deno.land/std@0.224.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.45.4";
import { computeFreeSlots, isBookable, parseStart, slotLabel, zonedParts } from "../ai-phone/slots.ts";

const db = createClient(Deno.env.get("SUPABASE_URL")!, Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!, { auth: { persistSession: false } });

const HEADERS = {
  "content-type": "application/json; charset=utf-8",
  "access-control-allow-origin": "*",
  "access-control-allow-headers": "content-type",
  "access-control-allow-methods": "GET, POST, OPTIONS",
};
const json = (data: unknown, status = 200, extra: Record<string, string> = {}) =>
  new Response(JSON.stringify(data), { status, headers: { ...HEADERS, ...extra } });

const ALLOWED_STATUS = ["active", "trialing", "past_due"];
const ALLOWED_PLANS = ["professional", "business", "enterprise"];
const MAX_BOOKINGS_PER_HOUR = 6;
const DAY_NAMES = ["", "Montag", "Dienstag", "Mittwoch", "Donnerstag", "Freitag", "Samstag", "Sonntag"];

export const DEFAULT_BOOKING = {
  enabled: false,
  timezone: "Europe/Berlin",
  visit_duration_minutes: 60,
  buffer_minutes: 30,
  min_notice_hours: 24,
  booking_horizon_days: 21,
  slot_step_minutes: 30,
  availability: { "1": [["09:00", "12:00"], ["13:00", "17:00"]], "2": [["09:00", "12:00"], ["13:00", "17:00"]], "3": [["09:00", "12:00"], ["13:00", "17:00"]], "4": [["09:00", "12:00"], ["13:00", "17:00"]], "5": [["09:00", "13:00"]], "6": [], "7": [] },
};

const clampInt = (v: unknown, min: number, max: number, fallback: number) => {
  const n = Math.round(Number(v));
  return Number.isFinite(n) ? Math.min(max, Math.max(min, n)) : fallback;
};

/** Einstellungen aus websites.booking prüfen und mit sicheren Standardwerten ergänzen */
export function bookingSettings(raw: any) {
  const b = raw && typeof raw === "object" ? raw : {};
  const tz = typeof b.timezone === "string" && /^[A-Za-z_]+\/[A-Za-z_]+$/.test(b.timezone) ? b.timezone : DEFAULT_BOOKING.timezone;
  const availability: Record<string, [string, string][]> = {};
  for (const d of ["1", "2", "3", "4", "5", "6", "7"]) {
    const list = Array.isArray(b.availability?.[d]) ? b.availability[d] : [];
    availability[d] = list
      .filter((w: unknown) => Array.isArray(w) && /^\d{2}:\d{2}$/.test(w[0]) && /^\d{2}:\d{2}$/.test(w[1]) && w[0] < w[1])
      .slice(0, 3)
      .map((w: string[]) => [w[0], w[1]]);
  }
  return {
    enabled: b.enabled === true,
    timezone: tz,
    visit_duration_minutes: clampInt(b.visit_duration_minutes, 15, 480, DEFAULT_BOOKING.visit_duration_minutes),
    buffer_minutes: clampInt(b.buffer_minutes, 0, 240, DEFAULT_BOOKING.buffer_minutes),
    min_notice_hours: clampInt(b.min_notice_hours, 0, 336, DEFAULT_BOOKING.min_notice_hours),
    booking_horizon_days: clampInt(b.booking_horizon_days, 1, 60, DEFAULT_BOOKING.booking_horizon_days),
    slot_step_minutes: [15, 30, 60].includes(Number(b.slot_step_minutes)) ? Number(b.slot_step_minutes) : DEFAULT_BOOKING.slot_step_minutes,
    availability,
  };
}

/** Freie Termine nach Tagen gruppiert (für die Auswahl auf der Website) */
export function groupSlots(slots: { start: string }[], tz: string) {
  const days: { day: string; label: string; times: { start: string; time: string }[] }[] = [];
  const pad = (n: number) => String(n).padStart(2, "0");
  for (const s of slots) {
    const p = zonedParts(new Date(s.start), tz);
    const day = `${p.year}-${pad(p.month)}-${pad(p.day)}`;
    let entry = days.find((d) => d.day === day);
    if (!entry) {
      entry = { day, label: `${DAY_NAMES[p.weekday]}, ${pad(p.day)}.${pad(p.month)}.`, times: [] };
      days.push(entry);
    }
    entry.times.push({ start: `${day}T${pad(p.hour)}:${pad(p.minute)}`, time: `${pad(p.hour)}:${pad(p.minute)}` });
  }
  return days;
}

const str = (v: unknown, max: number) => String(v ?? "").trim().slice(0, max);
const esc = (v: unknown) =>
  String(v ?? "").replace(/[&<>"']/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" })[c]);

async function findSite(site: string) {
  const key = site.toLowerCase().replace(/^www\./, "");
  let { data: w } = await db.from("websites").select("tenant_id, slug, published, booking, custom_domain, custom_domain_status").eq("slug", key).maybeSingle();
  if (!w) {
    const { data } = await db
      .from("websites")
      .select("tenant_id, slug, published, booking, custom_domain, custom_domain_status")
      .in("custom_domain", [key, `www.${key}`])
      .eq("custom_domain_status", "active")
      .maybeSingle();
    w = data;
  }
  if (!w || !w.published) return null;
  const settings = bookingSettings(w.booking);
  if (!settings.enabled) return null;
  const { data: sub } = await db.from("subscriptions").select("plan, status").eq("tenant_id", w.tenant_id).order("id", { ascending: false }).limit(1).maybeSingle();
  if (!sub || !ALLOWED_PLANS.includes(sub.plan) || !ALLOWED_STATUS.includes(sub.status)) return null;
  return { website: w, settings };
}

async function loadBusy(tenantId: number, from: Date, to: Date) {
  const { data, error } = await db
    .from("appointments")
    .select("starts_at, ends_at, status")
    .eq("tenant_id", tenantId)
    .neq("status", "abgesagt")
    .lt("starts_at", to.toISOString())
    .gt("ends_at", from.toISOString());
  if (error) throw error;
  return (data ?? []).map((a: any) => ({ start: new Date(a.starts_at), end: new Date(a.ends_at) }));
}

async function sendMail(senderName: string, to: string, toName: string, subject: string, html: string, replyTo?: { email: string; name: string }) {
  const key = Deno.env.get("BREVO_API_KEY");
  const sender = Deno.env.get("BREVO_SENDER_EMAIL");
  if (!key || !sender || !to) return;
  await fetch("https://api.brevo.com/v3/smtp/email", {
    method: "POST",
    headers: { "api-key": key, "content-type": "application/json", accept: "application/json" },
    body: JSON.stringify({ sender: { email: sender, name: senderName.slice(0, 70) }, to: [{ email: to, name: toName || undefined }], replyTo, subject, htmlContent: html }),
  }).catch((e) => console.error("brevo", e));
}

serve(async (req) => {
  if (req.method === "OPTIONS") return new Response(null, { headers: HEADERS });
  const url = new URL(req.url);
  const action = url.searchParams.get("action");
  try {
    // ---------- freie Termine ----------
    if (action === "slots" && req.method === "GET") {
      const found = await findSite(str(url.searchParams.get("site"), 253));
      if (!found) return json({ ok: false, error: "Online-Terminbuchung ist hier nicht verfügbar." }, 404);
      const s = found.settings;
      const now = new Date();
      const busy = await loadBusy(found.website.tenant_id, now, new Date(now.getTime() + (s.booking_horizon_days + 2) * 86_400_000));
      const slots = computeFreeSlots({ settings: s, busy, now, maxSlots: 400, perDay: 48 });
      return json({ ok: true, duration: s.visit_duration_minutes, days: groupSlots(slots, s.timezone) }, 200, { "cache-control": "no-store" });
    }

    // ---------- buchen ----------
    if (action === "book" && req.method === "POST") {
      const body = await req.json().catch(() => ({}));
      // Spam-Schutz: verstecktes Feld oder zu schnell ausgefüllt -> still „erfolgreich“, aber nichts speichern
      const started = Number(body.t);
      if (str(body.website, 200) || !started || Date.now() - started < 4000) return json({ ok: true, label: "" });

      const found = await findSite(str(body.site, 253));
      if (!found) return json({ ok: false, error: "Online-Terminbuchung ist hier nicht verfügbar." }, 404);
      const s = found.settings;
      const tenantId = found.website.tenant_id;

      const name = str(body.name, 120);
      const phone = str(body.phone, 40);
      const email = str(body.email, 160);
      const address = str(body.address, 300);
      const concern = str(body.concern, 1500);
      const missing = [!name && "Name", !phone && "Telefonnummer", !address && "Adresse des Objekts"].filter(Boolean);
      if (missing.length) return json({ ok: false, error: `Bitte noch angeben: ${missing.join(", ")}.` }, 400);
      if (!/^[+0-9 ()/-]{6,40}$/.test(phone)) return json({ ok: false, error: "Bitte eine gültige Telefonnummer angeben." }, 400);
      if (email && !/^[^@\s]+@[^@\s]+\.[^@\s]+$/.test(email)) return json({ ok: false, error: "Bitte die E-Mail-Adresse prüfen." }, 400);

      const start = parseStart(str(body.start, 40), s.timezone);
      if (!start) return json({ ok: false, error: "Bitte einen Termin auswählen." }, 400);

      // Schutz vor Massenbuchungen
      const hourAgo = new Date(Date.now() - 3_600_000).toISOString();
      const { count } = await db.from("appointments").select("id", { count: "exact", head: true }).eq("tenant_id", tenantId).eq("source", "website").gte("created_at", hourAgo);
      if ((count ?? 0) >= MAX_BOOKINGS_PER_HOUR) return json({ ok: false, error: "Gerade sind sehr viele Buchungen eingegangen. Bitte rufen Sie uns an." }, 429);

      const now = new Date();
      const busy = await loadBusy(tenantId, new Date(start.getTime() - 86_400_000), new Date(start.getTime() + 86_400_000));
      // nur Uhrzeiten aus dem angebotenen Raster (z. B. 9:00, 9:30 …) – und natürlich frei
      const offered = computeFreeSlots({ settings: s, busy, now, maxSlots: 4000, perDay: 200 }).some((x) => new Date(x.start).getTime() === start.getTime());
      if (!offered || !isBookable(start, { settings: s, busy, now })) {
        return json({ ok: false, error: "Dieser Termin ist leider gerade vergeben worden. Bitte wählen Sie einen anderen.", code: "taken" }, 409);
      }

      const end = new Date(start.getTime() + s.visit_duration_minutes * 60_000);
      const label = slotLabel(start, s.timezone);
      const { data: admin } = await db.from("app_users").select("id").eq("tenant_id", tenantId).in("role_id", [1, 2]).order("id").limit(1).maybeSingle();
      const description = [concern && `Anliegen: ${concern}`, `Telefon: ${phone}`, email && `E-Mail: ${email}`, "Über die Website gebucht – bitte prüfen und bestätigen."]
        .filter(Boolean)
        .join("\n");
      const { data: appt, error } = await db
        .from("appointments")
        .insert([
          {
            tenant_id: tenantId,
            created_by: admin?.id ?? null,
            title: `Besichtigung: ${name}`,
            appointment_type: "besichtigung",
            description,
            location: address,
            starts_at: start.toISOString(),
            ends_at: end.toISOString(),
            status: "geplant",
            source: "website",
            contact_name: name,
            contact_phone: phone,
          },
        ])
        .select("id")
        .single();
      if (error) throw error;

      // auch unter „Anfragen“ sichtbar
      await db.from("website_leads").insert([
        { tenant_id: tenantId, name, email: email || null, phone, message: `Besichtigungstermin online gebucht: ${label}\nAdresse: ${address}${concern ? `\n\n${concern}` : ""}` },
      ]);

      const { data: cs } = await db.from("company_settings").select("company_name, email, phone").eq("tenant_id", tenantId).order("id", { ascending: false }).limit(1).maybeSingle();
      const company = cs?.company_name || "Ihr Malerbetrieb";
      await sendMail(
        "Ihre Website (Maler-SaaS)",
        cs?.email ?? "",
        company,
        `Neuer Besichtigungstermin: ${label} – ${name}`,
        `<p>Über Ihre Website wurde ein Besichtigungstermin gebucht:</p>
<p><strong>${esc(label)}</strong> (${s.visit_duration_minutes} Minuten)<br>${esc(address)}</p>
<p><strong>${esc(name)}</strong><br>Telefon: ${esc(phone)}${email ? `<br>E-Mail: ${esc(email)}` : ""}</p>
${concern ? `<p>${esc(concern).replace(/\n/g, "<br>")}</p>` : ""}
<p>Der Termin steht bereits in Ihrem Terminkalender in Maler-SaaS. Bitte bestätigen Sie ihn dem Kunden kurz telefonisch oder per E-Mail.</p>`,
        email ? { email, name } : undefined
      );
      if (email) {
        await sendMail(
          company,
          email,
          name,
          `Ihr Besichtigungstermin bei ${company}: ${label}`,
          `<p>Guten Tag ${esc(name)},</p>
<p>vielen Dank für Ihre Terminanfrage. Wir haben folgenden Besichtigungstermin für Sie eingetragen:</p>
<p><strong>${esc(label)}</strong><br>${esc(address)}</p>
<p>Wir melden uns, falls sich etwas ändert. Sollten Sie den Termin nicht wahrnehmen können, sagen Sie bitte kurz Bescheid${cs?.phone ? ` – telefonisch unter ${esc(cs.phone)} oder` : ""} per Antwort auf diese E-Mail.</p>
<p>Viele Grüße<br>${esc(company)}</p>`,
          cs?.email ? { email: cs.email, name: company } : undefined
        );
      }
      return json({ ok: true, label, appointment_id: appt.id });
    }

    return json({ ok: false, error: "Unbekannte Aktion." }, 400);
  } catch (e) {
    console.error("website-booking", e);
    return json({ ok: false, error: "Die Buchung hat gerade nicht geklappt. Bitte rufen Sie uns an." }, 500);
  }
});
