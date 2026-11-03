// @ts-nocheck
// =====================================================================
// Fachkräfte-Pool (maler-saas.com/fachkraefte)
//
// Öffentlich (ohne Login, Zugang über Link mit Token aus der E-Mail):
//   signup, profile, update, set_status, delete, contact_get, contact_answer
// Für Betriebe (Login, Admin, laufendes Abo):
//   search, contact, contacts
//
// Alle Aufrufe: POST …/functions/v1/talent-pool  Body { action, … }
// Secrets (vorhanden): BREVO_API_KEY, BREVO_SENDER_EMAIL
// Postleitzahlen: eingebaute Tabelle plz.ts (keine Anfrage an fremde Dienste)
// Optional: SITE_ORIGIN (Standard https://maler-saas.com)
// Deploy:  npx supabase functions deploy talent-pool --no-verify-jwt
// =====================================================================

import { AsyncLocalStorage } from "node:async_hooks";
import { serve } from "https://deno.land/std@0.224.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.45.4";
import { PLZ_DATA } from "./plz.ts";
import { ROLE_LABEL, anonymize, distanceKm, esc, hashToken, newToken, validateProfile } from "./logic.ts";

const db = createClient(Deno.env.get("SUPABASE_URL")!, Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!, { auth: { persistSession: false } });
// Links in E-Mails zeigen auf die Seite, von der die Anfrage kam (Live-Seite oder Vorschau dieses Projekts)
const ORIGIN_OK = /^https:\/\/(maler-saas\.com|maler-saas-[a-z0-9-]+-anton-lehmanns-projects-a7614210\.vercel\.app)$/;
const requestSite = new AsyncLocalStorage<string>();
const SITE = () => requestSite.getStore() || (Deno.env.get("SITE_ORIGIN") || "https://maler-saas.com").replace(/\/$/, "");

const HEADERS = {
  "content-type": "application/json; charset=utf-8",
  "access-control-allow-origin": "*",
  "access-control-allow-headers": "authorization, content-type, apikey, x-client-info",
  "access-control-allow-methods": "POST, OPTIONS",
  "cache-control": "no-store",
};
const json = (data: unknown, status = 200) => new Response(JSON.stringify(data), { status, headers: HEADERS });
const fail = (error: string, status = 400) => json({ ok: false, error }, status);

const ALLOWED_STATUS = ["active", "trialing", "past_due"];
const VISIBLE_DAYS = 90; // so lange nach der letzten Bestätigung sichtbar
const REMIND_AFTER_DAYS = 42; // dann „Noch verfügbar?“-Mail
const CONTACTS_PER_DAY = 20;
const DAY = 86_400_000;
const PROFILE_COLUMNS =
  "id, status, first_name, last_name, email, phone, role, wants, skills, company_name, handwerksrolle, plz, ort, radius_km, available_from, driving_license, own_vehicle, languages, note, created_at, last_active_at";

// ---------------------------------------------------------------------
// Hilfen
// ---------------------------------------------------------------------
async function sendMail(to: string, toName: string, subject: string, html: string, replyTo?: { email: string; name: string }) {
  const key = Deno.env.get("BREVO_API_KEY");
  const sender = Deno.env.get("BREVO_SENDER_EMAIL");
  if (!key || !sender || !to) return false;
  try {
    const res = await fetch("https://api.brevo.com/v3/smtp/email", {
      method: "POST",
      headers: { "api-key": key, "content-type": "application/json", accept: "application/json" },
      body: JSON.stringify({
        sender: { email: sender, name: "Maler-SaaS Fachkräfte-Pool" },
        to: [{ email: to, name: toName || undefined }],
        replyTo,
        subject,
        htmlContent: `<div style="font-family:Arial,sans-serif;font-size:15px;line-height:1.5;color:#1c2430">${html}<p style="color:#888;font-size:12px;margin-top:28px">Maler-SaaS Fachkräfte-Pool · ${esc(SITE())}/fachkraefte</p></div>`,
      }),
    });
    if (!res.ok) console.error("brevo", res.status, (await res.text()).slice(0, 300));
    return res.ok;
  } catch (e) {
    console.error("brevo", e);
    return false;
  }
}
const button = (href: string, label: string, color = "#1d4e89") =>
  `<a href="${esc(href)}" style="display:inline-block;background:${color};color:#fff;text-decoration:none;font-weight:bold;padding:12px 20px;border-radius:8px;margin:4px 8px 4px 0">${esc(label)}</a>`;

/** Postleitzahl -> Koordinaten und Ort (eingebaute Tabelle, keine Anfrage an fremde Dienste) */
let PLZ_MAP: Map<string, { lat: number; lon: number; ort: string | null }> | null = null;
export async function geocode(plz: string): Promise<{ lat: number; lon: number; ort: string | null } | null> {
  if (!PLZ_MAP) {
    PLZ_MAP = new Map();
    for (const line of PLZ_DATA.split("\n")) {
      const [k, lat, lon, ort] = line.split("|");
      if (k) PLZ_MAP.set(k, { lat: Number(lat), lon: Number(lon), ort: ort || null });
    }
  }
  return PLZ_MAP.get(plz) ?? null;
}

async function profileByToken(t: unknown) {
  const token = String(t ?? "");
  if (token.length < 20) return null;
  const { data } = await db.from("talent_profiles").select(PROFILE_COLUMNS).eq("token_hash", await hashToken(token)).maybeSingle();
  return data;
}

/** Neues Token für einen Profil-Link (ältere Links werden damit ungültig) */
async function rotateToken(id: string) {
  const token = newToken();
  await db.from("talent_profiles").update({ token_hash: await hashToken(token) }).eq("id", id);
  return token;
}

/** Hinweisbox: Dieser Link ist der Zugang zum eigenen Profil */
const accessNote = () =>
  `<div style="background:#f4f6f9;border-radius:10px;padding:14px 16px;margin:18px 0"><strong>Ihr persönlicher Zugang:</strong> Über den Knopf oben kommen Sie jederzeit in Ihr Profil – dort können Sie Ihre Angaben ändern, Ihr Profil pausieren oder löschen und sehen Ihre Kontaktanfragen. Ein Passwort brauchen Sie nicht. <strong>Bitte bewahren Sie diese E-Mail auf.</strong><br><br>Link verloren? Auf <a href="${esc(SITE())}/fachkraefte#zugang">${esc(SITE().replace(/^https:\/\//, ""))}/fachkraefte</a> können Sie sich jederzeit einen neuen Zugangslink schicken lassen.</div>`;

const profileLink = (token: string, extra = "") => `${SITE()}/fachkraefte/profil?t=${encodeURIComponent(token)}${extra}`;

async function cleanup() {
  const now = Date.now();
  await db.from("talent_profiles").delete().eq("status", "pending").lt("created_at", new Date(now - 7 * DAY).toISOString());
  await db.from("talent_profiles").delete().lt("last_active_at", new Date(now - 365 * DAY).toISOString());
}

async function businessUser(req: Request) {
  const token = (req.headers.get("authorization") ?? "").replace(/^Bearer\s+/i, "");
  if (!token) return { error: fail("Bitte anmelden.", 401) };
  const { data: authData, error } = await db.auth.getUser(token);
  if (error || !authData?.user) return { error: fail("Bitte anmelden.", 401) };
  const { data: user } = await db.from("app_users").select("id, tenant_id, role_id").eq("auth_user_id", authData.user.id).maybeSingle();
  if (!user || ![1, 2].includes(Number(user.role_id))) return { error: fail("Nur Admins können den Fachkräfte-Pool nutzen.", 403) };
  const { data: sub } = await db.from("subscriptions").select("plan, status").eq("tenant_id", user.tenant_id).order("id", { ascending: false }).limit(1).maybeSingle();
  if (!sub || !ALLOWED_STATUS.includes(sub.status)) return { error: fail("Der Fachkräfte-Pool ist für Kunden mit laufendem Abo.", 403) };
  const { data: cs } = await db.from("company_settings").select("company_name, zip, city, email, phone").eq("tenant_id", user.tenant_id).order("id", { ascending: false }).limit(1).maybeSingle();
  return { user, company: cs ?? {} };
}

/** „Noch verfügbar?“ an Profile, die sich länger nicht gemeldet haben (höchstens 10 pro Aufruf) */
async function sendReminders() {
  const now = Date.now();
  const { data } = await db
    .from("talent_profiles")
    .select("id, first_name, last_name, email, last_active_at, reminder_sent_at")
    .eq("status", "active")
    .lt("last_active_at", new Date(now - REMIND_AFTER_DAYS * DAY).toISOString())
    .order("last_active_at", { ascending: true })
    .limit(30);
  const due = (data ?? []).filter((p: any) => !p.reminder_sent_at || Date.parse(p.reminder_sent_at) < now - 21 * DAY).slice(0, 10);
  for (const p of due) {
    const token = await rotateToken(p.id);
    await db.from("talent_profiles").update({ reminder_sent_at: new Date().toISOString() }).eq("id", p.id);
    await sendMail(
      p.email,
      `${p.first_name} ${p.last_name}`,
      "Sind Sie noch auf der Suche?",
      `<p>Hallo ${esc(p.first_name)},</p><p>Sie sind im Maler-SaaS Fachkräfte-Pool eingetragen. Damit Betriebe nur aktuelle Profile sehen, fragen wir regelmäßig nach: <strong>Sind Sie noch verfügbar?</strong></p>
<p>${button(profileLink(token, "&noch=1"), "Ja, ich suche noch")}${button(profileLink(token), "Profil ansehen oder löschen", "#5b6573")}</p>
<p style="color:#666;font-size:13px">Dieser Link ist ab jetzt Ihr Zugang zum Profil – ältere Links aus früheren E-Mails gelten nicht mehr.</p>
<p>Wenn Sie nicht reagieren, wird Ihr Profil nach ${VISIBLE_DAYS} Tagen ohne Bestätigung ausgeblendet und nach 12 Monaten gelöscht.</p>`
    );
  }
}

// ---------------------------------------------------------------------
// Aktionen
// ---------------------------------------------------------------------
async function signup(b: any) {
  // Spam-Schutz: verstecktes Feld oder zu schnell ausgefüllt -> still „erfolgreich“
  const started = Number(b.t);
  if (String(b.website ?? "") || !started || Date.now() - started < 4000) return json({ ok: true });
  if (b.consent !== true) return fail("Bitte der Verarbeitung Ihrer Angaben zustimmen.");
  const v = validateProfile(b);
  if (!v.ok) return fail(v.error);
  const p = v.value;
  await cleanup();

  const { data: existing } = await db.from("talent_profiles").select("id, status, first_name, last_name, email").eq("email", p.email).maybeSingle();
  if (existing) {
    // Kein Hinweis nach außen, ob die Adresse schon eingetragen ist – stattdessen Link per E-Mail
    const token = await rotateToken(existing.id);
    await sendMail(
      existing.email,
      `${existing.first_name} ${existing.last_name}`,
      existing.status === "pending" ? "Bitte bestätigen Sie Ihre Anmeldung" : "Ihr Profil im Fachkräfte-Pool",
      existing.status === "pending"
        ? `<p>Hallo ${esc(existing.first_name)},</p><p>bitte bestätigen Sie Ihre Anmeldung im Maler-SaaS Fachkräfte-Pool:</p><p>${button(profileLink(token), "Anmeldung bestätigen und zum Profil")}</p>${accessNote()}`
        : `<p>Hallo ${esc(existing.first_name)},</p><p>mit dieser E-Mail-Adresse besteht bereits ein Profil im Fachkräfte-Pool. Hier können Sie es ansehen, ändern oder löschen:</p><p>${button(profileLink(token), "Zu meinem Profil")}</p>${accessNote()}`
    );
    return json({ ok: true });
  }

  const geo = await geocode(p.plz);
  if (!geo) return fail("Diese Postleitzahl haben wir nicht gefunden. Bitte prüfen.");
  const token = newToken();
  const { error } = await db.from("talent_profiles").insert([{ ...p, ort: geo.ort, lat: geo.lat, lon: geo.lon, token_hash: await hashToken(token), status: "pending" }]);
  if (error) throw error;
  await sendMail(
    p.email,
    `${p.first_name} ${p.last_name}`,
    "Bitte bestätigen Sie Ihre Anmeldung im Fachkräfte-Pool",
    `<p>Hallo ${esc(p.first_name)},</p><p>schön, dass Sie dabei sind! Bitte bestätigen Sie mit einem Klick Ihre E-Mail-Adresse. Erst dann wird Ihr Profil für Malerbetriebe sichtbar – ohne Ihren Namen und ohne Ihre Kontaktdaten.</p>
<p>${button(profileLink(token), "Anmeldung bestätigen und zum Profil")}</p>
${accessNote()}
<p>Möchte ein Betrieb Sie kennenlernen, bekommen Sie eine E-Mail und entscheiden selbst, ob er Ihre Kontaktdaten erhält.</p>
<p>Haben Sie sich nicht angemeldet? Dann ignorieren Sie diese E-Mail einfach – die Angaben werden nach 7 Tagen gelöscht.</p>`
  );
  return json({ ok: true });
}

/** Neuen Zugangslink anfordern (immer „ok“, damit niemand prüfen kann, wer eingetragen ist) */
async function sendLink(b: any) {
  const email = String(b.email ?? "").trim().toLowerCase().slice(0, 160);
  if (!/^[^@\s]+@[^@\s]+\.[^@\s]{2,}$/.test(email)) return fail("Bitte eine gültige E-Mail-Adresse angeben.");
  const { data: p } = await db.from("talent_profiles").select("id, status, first_name, last_name, email").eq("email", email).maybeSingle();
  if (p) {
    const token = await rotateToken(p.id);
    await sendMail(
      p.email,
      `${p.first_name} ${p.last_name}`,
      p.status === "pending" ? "Bitte bestätigen Sie Ihre Anmeldung" : "Ihr Zugang zum Fachkräfte-Pool",
      `<p>Hallo ${esc(p.first_name)},</p><p>hier ist Ihr neuer Zugangslink zu Ihrem Profil im Maler-SaaS Fachkräfte-Pool:</p><p>${button(profileLink(token), p.status === "pending" ? "Anmeldung bestätigen und zum Profil" : "Zu meinem Profil")}</p>${accessNote()}<p style="color:#666;font-size:13px">Ältere Links gelten ab jetzt nicht mehr. Haben Sie keinen Link angefordert? Dann ignorieren Sie diese E-Mail einfach.</p>`
    );
  }
  return json({ ok: true });
}

async function profile(b: any) {
  const p = await profileByToken(b.t);
  if (!p) return fail("Dieser Link ist nicht mehr gültig. Fordern Sie über die Anmeldung einfach einen neuen an.", 404);
  const patch: Record<string, unknown> = {};
  if (p.status === "pending") Object.assign(patch, { status: "active", confirmed_at: new Date().toISOString() });
  if (p.status === "pending" || b.noch === true) Object.assign(patch, { last_active_at: new Date().toISOString(), reminder_sent_at: null, ...(p.status === "paused" ? { status: "active" } : {}) });
  if (Object.keys(patch).length) {
    await db.from("talent_profiles").update(patch).eq("id", p.id);
    Object.assign(p, patch);
  }
  const { data: contacts } = await db.from("talent_contacts").select("id, tenant_id, status, message, created_at, responded_at").eq("profile_id", p.id).order("created_at", { ascending: false }).limit(50);
  const ids = [...new Set((contacts ?? []).map((c: any) => c.tenant_id))];
  const { data: companies } = ids.length ? await db.from("company_settings").select("tenant_id, company_name, city").in("tenant_id", ids) : { data: [] };
  const name = (id: number) => (companies ?? []).find((c: any) => c.tenant_id === id);
  const visibleUntil = new Date(Date.parse(p.last_active_at) + VISIBLE_DAYS * DAY).toISOString().slice(0, 10);
  const { token_hash: _t, lat: _la, lon: _lo, ...safe } = p as Record<string, unknown>;
  return json({
    ok: true,
    profile: { ...safe, visible_until: visibleUntil },
    contacts: (contacts ?? []).map((c: any) => ({ id: c.id, status: c.status, message: c.message, created_at: c.created_at, company: name(c.tenant_id)?.company_name ?? "Malerbetrieb", city: name(c.tenant_id)?.city ?? null })),
  });
}

async function update(b: any) {
  const p = await profileByToken(b.t);
  if (!p) return fail("Dieser Link ist nicht mehr gültig.", 404);
  const v = validateProfile({ ...b.profile, email: p.email });
  if (!v.ok) return fail(v.error);
  const value: Record<string, unknown> = { ...v.value, updated_at: new Date().toISOString(), last_active_at: new Date().toISOString(), reminder_sent_at: null };
  delete value.email; // E-Mail-Adresse ändern: Profil löschen und neu anmelden
  if (v.value.plz !== p.plz) {
    const geo = await geocode(v.value.plz);
    if (!geo) return fail("Diese Postleitzahl haben wir nicht gefunden. Bitte prüfen.");
    Object.assign(value, { ort: geo.ort, lat: geo.lat, lon: geo.lon });
  }
  const { error } = await db.from("talent_profiles").update(value).eq("id", p.id);
  if (error) throw error;
  return profile({ t: b.t });
}

async function setStatus(b: any) {
  const p = await profileByToken(b.t);
  if (!p) return fail("Dieser Link ist nicht mehr gültig.", 404);
  const status = b.status === "paused" ? "paused" : "active";
  await db.from("talent_profiles").update({ status, last_active_at: new Date().toISOString(), reminder_sent_at: null }).eq("id", p.id);
  return profile({ t: b.t });
}

async function remove(b: any) {
  const p = await profileByToken(b.t);
  if (!p) return fail("Dieser Link ist nicht mehr gültig.", 404);
  await db.from("talent_profiles").delete().eq("id", p.id); // Kontaktanfragen werden mitgelöscht
  return json({ ok: true });
}

async function contactByToken(t: unknown) {
  const token = String(t ?? "");
  if (token.length < 20) return null;
  const { data: c } = await db.from("talent_contacts").select("id, profile_id, tenant_id, status, message, created_at").eq("token_hash", await hashToken(token)).maybeSingle();
  if (!c) return null;
  const { data: cs } = await db.from("company_settings").select("company_name, city, email, phone").eq("tenant_id", c.tenant_id).order("id", { ascending: false }).limit(1).maybeSingle();
  return { c, company: cs ?? {} };
}

async function contactGet(b: any) {
  const found = await contactByToken(b.t);
  if (!found) return fail("Diese Anfrage gibt es nicht mehr.", 404);
  return json({ ok: true, status: found.c.status, message: found.c.message, created_at: found.c.created_at, company: found.company.company_name ?? "Malerbetrieb", city: found.company.city ?? null });
}

async function contactAnswer(b: any) {
  const found = await contactByToken(b.t);
  if (!found) return fail("Diese Anfrage gibt es nicht mehr.", 404);
  const { c, company } = found;
  if (c.status !== "offen") return json({ ok: true, status: c.status, company: company.company_name ?? "Malerbetrieb", already: true });
  const status = b.accept === true ? "angenommen" : "abgelehnt";
  await db.from("talent_contacts").update({ status, responded_at: new Date().toISOString() }).eq("id", c.id);
  const { data: p } = await db.from("talent_profiles").select(PROFILE_COLUMNS).eq("id", c.profile_id).maybeSingle();
  if (p) await db.from("talent_profiles").update({ last_active_at: new Date().toISOString(), reminder_sent_at: null }).eq("id", p.id);
  if (status === "angenommen" && p && company.email) {
    await sendMail(
      company.email,
      company.company_name ?? "",
      `Kontaktanfrage angenommen: ${p.first_name} ${p.last_name}`,
      `<p>Gute Nachricht: Eine Fachkraft aus dem Pool hat Ihrer Kontaktanfrage zugestimmt.</p>
<p><strong>${esc(p.first_name)} ${esc(p.last_name)}</strong>${p.company_name ? ` (${esc(p.company_name)})` : ""}<br>${esc(ROLE_LABEL[p.role] ?? "")}${p.ort ? ` · ${esc(p.ort)}` : ""}<br>
${p.phone ? `Telefon: ${esc(p.phone)}<br>` : ""}E-Mail: ${esc(p.email)}</p>
<p>Melden Sie sich am besten zeitnah. Die Angaben finden Sie auch in Maler-SaaS unter <em>Fachkräfte → Meine Anfragen</em>.</p>
<p style="color:#666;font-size:13px">Hinweis: Maler-SaaS stellt nur den Kontakt her und ist nicht Vertragspartner. Bei Subunternehmern prüfen Sie bitte selbst Handwerksrolle und Scheinselbstständigkeit.</p>`,
      { email: p.email, name: `${p.first_name} ${p.last_name}` }
    );
  }
  return json({ ok: true, status, company: company.company_name ?? "Malerbetrieb" });
}

async function search(req: Request, b: any) {
  const auth = await businessUser(req);
  if (auth.error) return auth.error;
  const plz = /^[0-9]{5}$/.test(String(b.plz ?? "")) ? String(b.plz) : String(auth.company.zip ?? "").trim();
  if (!/^[0-9]{5}$/.test(plz)) return fail("Bitte eine Postleitzahl für die Suche angeben (oder in den Firmendaten hinterlegen).");
  const center = await geocode(plz);
  if (!center) return fail("Diese Postleitzahl haben wir nicht gefunden.");
  const radius = Math.min(300, Math.max(5, Math.round(Number(b.radius) || 50)));
  const since = new Date(Date.now() - VISIBLE_DAYS * DAY).toISOString();
  const { data: rows, error } = await db
    .from("talent_profiles")
    .select(`${PROFILE_COLUMNS}, lat, lon`)
    .eq("status", "active")
    .gte("last_active_at", since)
    .limit(5000);
  if (error) throw error;
  const { data: mine } = await db.from("talent_contacts").select("profile_id, status").eq("tenant_id", auth.user.tenant_id);
  const statusOf = (id: string) => (mine ?? []).find((c: any) => c.profile_id === id)?.status ?? null;
  const results = (rows ?? [])
    .filter((p: any) => p.lat != null && p.lon != null)
    .map((p: any) => ({ p, km: distanceKm(center, { lat: p.lat, lon: p.lon }) }))
    // im Suchradius des Betriebs UND im Umkreis, den die Fachkraft angegeben hat
    .filter((x: any) => x.km <= radius && x.km <= x.p.radius_km)
    .sort((a: any, b: any) => a.km - b.km)
    .slice(0, 200)
    .map((x: any) => anonymize(x.p, x.km, statusOf(x.p.id)));
  // Nebenbei: Erinnerungen und Aufräumen (ohne die Antwort aufzuhalten, falls etwas schiefgeht)
  await Promise.allSettled([sendReminders(), cleanup()]);
  return json({ ok: true, center: { plz, ort: center.ort }, radius, results });
}

async function contact(req: Request, b: any) {
  const auth = await businessUser(req);
  if (auth.error) return auth.error;
  const profileId = String(b.profile_id ?? "");
  const message = String(b.message ?? "").trim().slice(0, 1000);
  const { data: p } = await db.from("talent_profiles").select("id, status, first_name, last_name, email, last_active_at").eq("id", profileId).maybeSingle();
  if (!p || p.status !== "active") return fail("Dieses Profil ist nicht mehr verfügbar.", 404);
  const { count } = await db
    .from("talent_contacts")
    .select("id", { count: "exact", head: true })
    .eq("tenant_id", auth.user.tenant_id)
    .gte("created_at", new Date(Date.now() - DAY).toISOString());
  if ((count ?? 0) >= CONTACTS_PER_DAY) return fail(`Höchstens ${CONTACTS_PER_DAY} Kontaktanfragen pro Tag.`, 429);
  const { data: before } = await db.from("talent_contacts").select("id").eq("profile_id", p.id).eq("tenant_id", auth.user.tenant_id).maybeSingle();
  if (before) return fail("Sie haben diese Fachkraft bereits angefragt.", 409);
  const token = newToken();
  const { error } = await db
    .from("talent_contacts")
    .insert([{ profile_id: p.id, tenant_id: auth.user.tenant_id, requested_by: auth.user.id, message: message || null, status: "offen", token_hash: await hashToken(token) }]);
  if (error) {
    if (String(error.code) === "23505" || String(error.message).includes("talent_contacts_once")) return fail("Sie haben diese Fachkraft bereits angefragt.", 409);
    throw error;
  }
  const company = auth.company.company_name || "Ein Malerbetrieb";
  const link = `${SITE()}/fachkraefte/anfrage?t=${encodeURIComponent(token)}`;
  await sendMail(
    p.email,
    `${p.first_name} ${p.last_name}`,
    `${company} möchte Sie kennenlernen`,
    `<p>Hallo ${esc(p.first_name)},</p><p><strong>${esc(company)}</strong>${auth.company.city ? ` aus ${esc(auth.company.city)}` : ""} hat Ihr Profil im Fachkräfte-Pool gesehen und möchte Kontakt mit Ihnen aufnehmen.</p>
${message ? `<blockquote style="border-left:3px solid #ccd;margin:12px 0;padding:4px 12px;color:#333">${esc(message).replace(/\n/g, "<br>")}</blockquote>` : ""}
<p>Sollen wir dem Betrieb Ihren Namen, Ihre Telefonnummer und Ihre E-Mail-Adresse geben?</p>
<p>${button(`${link}&antwort=ja`, "Ja, Kontaktdaten weitergeben", "#1f8f4e")}${button(`${link}&antwort=nein`, "Nein, danke", "#5b6573")}</p>
<p style="color:#666;font-size:13px">Ohne Ihre Zustimmung erfährt der Betrieb nichts über Sie.</p>`
  );
  return json({ ok: true });
}

async function contacts(req: Request) {
  const auth = await businessUser(req);
  if (auth.error) return auth.error;
  const { data: list } = await db.from("talent_contacts").select("id, profile_id, status, message, created_at, responded_at").eq("tenant_id", auth.user.tenant_id).order("created_at", { ascending: false }).limit(200);
  const ids = (list ?? []).map((c: any) => c.profile_id);
  const { data: profiles } = ids.length ? await db.from("talent_profiles").select(`${PROFILE_COLUMNS}, lat, lon`).in("id", ids) : { data: [] };
  const center = auth.company.zip && /^[0-9]{5}$/.test(String(auth.company.zip).trim()) ? await geocode(String(auth.company.zip).trim()) : null;
  return json({
    ok: true,
    contacts: (list ?? []).map((c: any) => {
      const p = (profiles ?? []).find((x: any) => x.id === c.profile_id);
      const km = p && center && p.lat != null ? distanceKm(center, { lat: p.lat, lon: p.lon }) : 0;
      return { id: c.id, status: c.status, message: c.message, created_at: c.created_at, responded_at: c.responded_at, profile: p ? anonymize(p, km, c.status) : null };
    }),
  });
}

serve(async (req) => {
  if (req.method === "OPTIONS") return new Response(null, { headers: HEADERS });
  if (req.method !== "POST") return fail("Nur POST", 405);
  const origin = req.headers.get("origin") ?? "";
  return await requestSite.run(ORIGIN_OK.test(origin) ? origin : "", () => route(req));
});

async function route(req: Request) {
  try {
    const b = await req.json().catch(() => ({}));
    switch (b.action) {
      case "send_link":
        return await sendLink(b);
      case "signup":
        return await signup(b);
      case "profile":
        return await profile(b);
      case "update":
        return await update(b);
      case "set_status":
        return await setStatus(b);
      case "delete":
        return await remove(b);
      case "contact_get":
        return await contactGet(b);
      case "contact_answer":
        return await contactAnswer(b);
      case "search":
        return await search(req, b);
      case "contact":
        return await contact(req, b);
      case "contacts":
        return await contacts(req);
      default:
        return fail("Unbekannte Aktion.");
    }
  } catch (e) {
    console.error("talent-pool", e);
    return fail("Da ist gerade etwas schiefgegangen. Bitte später noch einmal versuchen.", 500);
  }
}
