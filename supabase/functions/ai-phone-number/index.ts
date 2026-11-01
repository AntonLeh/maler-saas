// @ts-nocheck
// =====================================================================
// KI-Telefon – eigene Telefonnummer pro Betrieb (Twilio + ElevenLabs)
//
//   POST ?action=submit     (Admin, Bearer-Token, multipart/form-data)
//        Felder: business_name, registration_number, rep_first_name, rep_last_name, rep_email,
//                website, street, postal_code, city, region, area_code, document_issue_date
//        Dateien: doc_0 … doc_2 (PDF/JPG/PNG, je max. 5 MB) + doc_kind_0 … ("handelsregister" | "gewerbe" | "steuer")
//        -> Adresse, End-User, Nachweise und Bundle bei Twilio anlegen, prüfen, einreichen
//   POST ?action=refresh    (Admin) -> Status bei Twilio abfragen; nach Freigabe Nummer kaufen + verbinden
//   POST ?action=twilio-callback&hook=<AI_PHONE_HOOK_TOKEN>   (Twilio, Status-Callback des Bundles)
//   GET  ?action=requirements  (Plattform-Inhaber) -> aktuelles Twilio-Regelwerk DE/local/business
//
// Secrets:
//   TWILIO_ACCOUNT_SID, TWILIO_AUTH_TOKEN   Hauptkonto des Plattform-Betreibers
//   TWILIO_NOTIFY_EMAIL                     E-Mail für Statusmeldungen von Twilio (Plattform-Betreiber)
//   AI_PHONE_HOOK_TOKEN                     (vorhanden) schützt den Status-Callback
//   ELEVENLABS_API_KEY                      (vorhanden) Nummer bei ElevenLabs importieren
//   BREVO_API_KEY, BREVO_SENDER_EMAIL       (vorhanden) E-Mail an den Betrieb, wenn die Nummer aktiv ist
//
// Deploy:  npx supabase functions deploy ai-phone-number --no-verify-jwt
// =====================================================================

import { serve } from "https://deno.land/std@0.224.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.45.4";
import {
  BUNDESLAENDER,
  TwilioError,
  accountSid,
  assignItem,
  buyNumber,
  createAddress,
  createBundle,
  createDocument,
  createEndUser,
  evaluateBundle,
  evaluationProblems,
  findNumber,
  flattenDocRequirements,
  getBundle,
  loadRegulation,
  normalizeAreaCode,
  planDocuments,
  submitBundle,
} from "./twilio.ts";
import type { Applicant, DocKind } from "./twilio.ts";

const ALLOWED_PLANS = ["business", "enterprise"];
const ALLOWED_STATUS = ["active", "trialing"];
const MAX_FILE = 5 * 1024 * 1024;
const FILE_TYPES = ["application/pdf", "image/jpeg", "image/png"];

const HEADERS = {
  "content-type": "application/json; charset=utf-8",
  "access-control-allow-origin": "*",
  "access-control-allow-headers": "authorization, x-client-info, apikey, content-type",
};
const json = (data: unknown, status = 200) => new Response(JSON.stringify(data), { status, headers: HEADERS });
const env = (k: string) => Deno.env.get(k) ?? "";

const db = createClient(env("SUPABASE_URL"), env("SUPABASE_SERVICE_ROLE_KEY"), { auth: { persistSession: false } });

const PUBLIC_COLUMNS =
  "tenant_id, status, business_name, registration_number, rep_first_name, rep_last_name, rep_email, website, street, postal_code, city, region, area_code, document_issue_date, bundle_status, failure_reason, phone_number, last_error, submitted_at, approved_at, activated_at, updated_at";

const errMsg = (e: unknown) => String((e as Error)?.message ?? e).slice(0, 800);

// ---------------------------------------------------------------------
// Hilfen
// ---------------------------------------------------------------------
async function currentAdmin(req: Request) {
  const token = (req.headers.get("authorization") ?? "").replace(/^Bearer\s+/i, "");
  if (!token) return null;
  const { data: authData } = await db.auth.getUser(token);
  if (!authData?.user) return null;
  const { data: user } = await db
    .from("app_users")
    .select("id, tenant_id, role_id, email")
    .eq("auth_user_id", authData.user.id)
    .maybeSingle();
  if (!user || ![1, 2].includes(Number(user.role_id))) return null;
  return { ...user, authEmail: authData.user.email };
}

async function checkEligible(tenantId: number): Promise<string | null> {
  const { data: sub } = await db
    .from("subscriptions")
    .select("plan, status")
    .eq("tenant_id", tenantId)
    .order("id", { ascending: false })
    .limit(1)
    .maybeSingle();
  if (!sub || !ALLOWED_PLANS.includes(String(sub.plan)) || !ALLOWED_STATUS.includes(String(sub.status))) {
    return "Das KI-Telefon ist nur im Business-Tarif verfügbar.";
  }
  const { data: billing } = await db.from("ai_phone_billing").select("setup_paid_at").eq("tenant_id", tenantId).maybeSingle();
  if (!billing?.setup_paid_at) return "Bitte zuerst die Einrichtung des KI-Telefons bezahlen.";
  const { data: agent } = await db.from("ai_phone_agents").select("agent_id").eq("tenant_id", tenantId).maybeSingle();
  if (!agent?.agent_id) return "Bitte zuerst den KI-Assistenten aktivieren.";
  return null;
}

async function saveRow(tenantId: number, fields: Record<string, unknown>) {
  const { error } = await db
    .from("ai_phone_numbers")
    .upsert({ tenant_id: tenantId, ...fields, updated_at: new Date().toISOString() }, { onConflict: "tenant_id" });
  if (error) throw new Error(`Speichern fehlgeschlagen: ${error.message}`);
}

async function publicRow(tenantId: number) {
  const { data } = await db.from("ai_phone_numbers").select(PUBLIC_COLUMNS).eq("tenant_id", tenantId).maybeSingle();
  return data;
}

function callbackUrl() {
  return `${env("SUPABASE_URL")}/functions/v1/ai-phone-number?action=twilio-callback&hook=${encodeURIComponent(env("AI_PHONE_HOOK_TOKEN"))}`;
}

async function companyName(tenantId: number): Promise<string> {
  const { data } = await db.from("ai_phone_settings").select("company_name").eq("tenant_id", tenantId).maybeSingle();
  if (data?.company_name) return data.company_name;
  const { data: t } = await db.from("tenants").select("name").eq("id", tenantId).maybeSingle();
  return t?.name || `Betrieb ${tenantId}`;
}

// ---------------------------------------------------------------------
// Eingaben prüfen
// ---------------------------------------------------------------------
export function readApplicant(form: FormData): { applicant?: Applicant; error?: string } {
  const g = (k: string, max = 200) => String(form.get(k) ?? "").trim().slice(0, max);
  const a: Applicant = {
    business_name: g("business_name"),
    registration_number: g("registration_number", 60),
    rep_first_name: g("rep_first_name", 80),
    rep_last_name: g("rep_last_name", 80),
    rep_email: g("rep_email", 120),
    website: g("website", 200) || null,
    street: g("street"),
    postal_code: g("postal_code", 10),
    city: g("city", 120),
    region: g("region", 60),
    area_code: normalizeAreaCode(g("area_code", 20)),
    document_issue_date: /^\d{4}-\d{2}-\d{2}$/.test(g("document_issue_date", 10)) ? g("document_issue_date", 10) : null,
  };
  const missing = [
    ["business_name", "Firmenname"],
    ["registration_number", "Registernummer / Steuernummer"],
    ["rep_first_name", "Vorname"],
    ["rep_last_name", "Nachname"],
    ["rep_email", "E-Mail"],
    ["street", "Straße und Hausnummer"],
    ["postal_code", "PLZ"],
    ["city", "Ort"],
    ["region", "Bundesland"],
  ].filter(([k]) => !(a as any)[k]);
  if (missing.length) return { error: `Bitte ausfüllen: ${missing.map((m) => m[1]).join(", ")}.` };
  if (!/^\d{5}$/.test(a.postal_code)) return { error: "Die PLZ muss 5 Ziffern haben." };
  if (!/^[^@\s]+@[^@\s]+\.[^@\s]+$/.test(a.rep_email)) return { error: "Bitte eine gültige E-Mail-Adresse angeben." };
  if (!BUNDESLAENDER.includes(a.region)) return { error: "Bitte ein Bundesland auswählen." };
  if (!a.area_code) return { error: "Bitte eine gültige Ortsvorwahl angeben (z. B. 06571, keine Handy-Vorwahl)." };
  return { applicant: a };
}

export function readFiles(form: FormData): { files?: { file: File; kind: DocKind }[]; error?: string } {
  const files: { file: File; kind: DocKind }[] = [];
  for (let i = 0; i < 3; i++) {
    const f = form.get(`doc_${i}`);
    if (!(f instanceof File) || f.size === 0) continue;
    const kind = String(form.get(`doc_kind_${i}`) ?? "") as DocKind;
    if (!["handelsregister", "gewerbe", "steuer"].includes(kind)) return { error: "Bitte bei jedem Dokument die Art auswählen." };
    if (f.size > MAX_FILE) return { error: `„${f.name}“ ist größer als 5 MB.` };
    const type = f.type || (f.name.toLowerCase().endsWith(".pdf") ? "application/pdf" : "");
    if (!FILE_TYPES.includes(type) || !/\.(pdf|jpe?g|png)$/i.test(f.name)) {
      return { error: `„${f.name}“: Erlaubt sind PDF, JPG oder PNG.` };
    }
    files.push({ file: f, kind });
  }
  if (!files.length) return { error: "Bitte mindestens einen Nachweis hochladen." };
  return { files };
}

// ---------------------------------------------------------------------
// Antrag einreichen
// ---------------------------------------------------------------------
async function handleSubmit(req: Request): Promise<Response> {
  const user = await currentAdmin(req);
  if (!user) return json({ ok: false, error: "Nur Admins dürfen eine Nummer beantragen." }, 403);
  const tenantId = Number(user.tenant_id);

  const notEligible = await checkEligible(tenantId);
  if (notEligible) return json({ ok: false, error: notEligible }, 403);

  const existing = (await db.from("ai_phone_numbers").select("*").eq("tenant_id", tenantId).maybeSingle()).data;
  if (existing && ["eingereicht", "freigegeben", "aktiv"].includes(existing.status)) {
    return json({ ok: false, error: "Für diesen Betrieb läuft bereits ein Antrag bzw. es gibt schon eine Nummer." }, 409);
  }

  let form: FormData;
  try {
    form = await req.formData();
  } catch {
    return json({ ok: false, error: "Ungültige Formulardaten." }, 400);
  }
  const { applicant, error: aErr } = readApplicant(form);
  if (!applicant) return json({ ok: false, error: aErr }, 400);
  const { files, error: fErr } = readFiles(form);
  if (!files) return json({ ok: false, error: fErr }, 400);

  // Angaben sofort merken (auch wenn Twilio später scheitert)
  await saveRow(tenantId, { ...applicant, status: "entwurf", last_error: null, failure_reason: null });

  const label = `MalerSaaS #${tenantId} ${applicant.business_name}`.slice(0, 64);
  try {
    const regulation = await loadRegulation();
    const address = await createAddress(applicant, label);
    const endUser = await createEndUser(regulation, applicant, address.sid, label);

    const { plan, unmet } = planDocuments(
      flattenDocRequirements(regulation?.requirements?.supporting_document),
      files.map((f, index) => ({ index, kind: f.kind }))
    );
    if (unmet.length) {
      throw new Error(`Für folgende Anforderungen fehlt ein passender Nachweis: ${unmet.join(", ")}.`);
    }
    const docSids: string[] = [];
    for (const p of plan) {
      const doc = await createDocument(p, files[p.fileIndex].file, applicant, address.sid, label);
      docSids.push(doc.sid);
    }

    const email = env("TWILIO_NOTIFY_EMAIL") || env("BREVO_SENDER_EMAIL") || applicant.rep_email;
    const bundle = await createBundle(regulation.sid, label, email, callbackUrl());
    await assignItem(bundle.sid, endUser.sid);
    for (const sid of docSids) await assignItem(bundle.sid, sid);

    const evaluation = await evaluateBundle(bundle.sid);
    await saveRow(tenantId, {
      twilio_address_sid: address.sid,
      twilio_end_user_sid: endUser.sid,
      twilio_document_sids: docSids,
      twilio_bundle_sid: bundle.sid,
      bundle_status: bundle.status ?? "draft",
      evaluation,
    });

    if (evaluation?.status && evaluation.status !== "compliant") {
      const problems = evaluationProblems(evaluation);
      const msg = `Die Unterlagen sind noch nicht vollständig${problems.length ? ": " + problems.join("; ") : "."}`;
      await saveRow(tenantId, { status: "fehler", last_error: msg });
      return json({ ok: false, error: msg, number: await publicRow(tenantId) }, 422);
    }

    const submitted = await submitBundle(bundle.sid);
    await saveRow(tenantId, {
      status: "eingereicht",
      bundle_status: submitted?.status ?? "pending-review",
      submitted_at: new Date().toISOString(),
      last_error: null,
    });
    return json({ ok: true, number: await publicRow(tenantId) });
  } catch (e) {
    const msg = errMsg(e);
    console.error("ai-phone-number submit", msg, e instanceof TwilioError ? JSON.stringify(e.data).slice(0, 1000) : "");
    await saveRow(tenantId, { status: "fehler", last_error: msg });
    return json({ ok: false, error: msg, number: await publicRow(tenantId) }, 502);
  }
}

// ---------------------------------------------------------------------
// Status übernehmen, nach Freigabe Nummer kaufen und verbinden
// ---------------------------------------------------------------------
const STATUS_MAP: Record<string, string> = {
  draft: "entwurf",
  "pending-review": "eingereicht",
  "in-review": "eingereicht",
  "twilio-rejected": "abgelehnt",
  "twilio-approved": "freigegeben",
  "provisionally-approved": "freigegeben",
};

async function applyBundleStatus(row: any, bundleStatus: string, failureReason?: string | null) {
  const status = STATUS_MAP[bundleStatus] ?? row.status;
  const fields: Record<string, unknown> = { bundle_status: bundleStatus };
  if (row.status !== "aktiv") fields.status = status;
  if (status === "abgelehnt") fields.failure_reason = failureReason || "Von Twilio abgelehnt (ohne Begründung).";
  if (status === "freigegeben" && !row.approved_at) fields.approved_at = new Date().toISOString();
  await saveRow(row.tenant_id, fields);
  if (status === "freigegeben" && row.status !== "aktiv") await activate(row.tenant_id);
}

async function importToElevenLabs(phoneNumber: string, label: string, agentId: string) {
  const res = await fetch(`${env("ELEVENLABS_API_URL") || "https://api.elevenlabs.io"}/v1/convai/phone-numbers`, {
    method: "POST",
    headers: { "xi-api-key": env("ELEVENLABS_API_KEY"), "content-type": "application/json" },
    body: JSON.stringify({
      provider: "twilio",
      phone_number: phoneNumber,
      label,
      sid: env("TWILIO_ACCOUNT_SID"),
      token: env("TWILIO_AUTH_TOKEN"),
      agent_id: agentId,
      enable_sms: false,
    }),
    signal: AbortSignal.timeout(25000),
  });
  const data = await res.json().catch(() => ({}));
  if (!res.ok) throw new Error(`ElevenLabs-Import → ${res.status}: ${JSON.stringify(data?.detail ?? data).slice(0, 300)}`);
  return data.phone_number_id as string;
}

async function notifyActive(tenantId: number, phoneNumber: string, to: string) {
  const key = env("BREVO_API_KEY");
  const sender = env("BREVO_SENDER_EMAIL");
  if (!key || !sender || !to) return;
  const pretty = phoneNumber.replace(/^\+49/, "0");
  const app = env("APP_URL") || "https://maler-saas.com";
  const html = `<p>Guten Tag,</p>
<p>Ihre KI-Telefonnummer ist eingerichtet: <strong>${pretty}</strong> (${phoneNumber}).</p>
<p>Letzter Schritt: Richten Sie an Ihrem Firmentelefon eine Rufumleitung auf diese Nummer ein (z. B. „bei Nichtannahme“).
Eine Anleitung finden Sie in der App unter KI-Telefon → Einrichtung.</p>
<p><a href="${app}">Zur App</a></p>`;
  await fetch("https://api.brevo.com/v3/smtp/email", {
    method: "POST",
    headers: { "api-key": key, "content-type": "application/json", accept: "application/json" },
    body: JSON.stringify({
      sender: { email: sender, name: env("BREVO_SENDER_NAME") || "MalerSaaS" },
      to: [{ email: to }],
      subject: `Ihre KI-Telefonnummer ist aktiv: ${pretty}`,
      htmlContent: html,
    }),
  }).catch((e) => console.error("notifyActive", e));
}

async function activate(tenantId: number) {
  const { data: row } = await db.from("ai_phone_numbers").select("*").eq("tenant_id", tenantId).maybeSingle();
  if (!row || row.status === "aktiv") return;
  const { data: agent } = await db.from("ai_phone_agents").select("agent_id").eq("tenant_id", tenantId).maybeSingle();
  const label = `MalerSaaS #${tenantId} ${row.business_name ?? ""}`.trim().slice(0, 64);
  try {
    let phone = row.phone_number;
    if (!row.twilio_number_sid) {
      phone = await findNumber(row.area_code);
      if (!phone) {
        throw new Error(`Zurzeit ist bei Twilio keine freie Nummer mit der Vorwahl 0${row.area_code} verfügbar. Wir versuchen es erneut.`);
      }
      const bought = await buyNumber(phone, row.twilio_bundle_sid, row.twilio_address_sid, label);
      await saveRow(tenantId, { twilio_number_sid: bought.sid, phone_number: bought.phone_number ?? phone });
      phone = bought.phone_number ?? phone;
    }
    let elId = row.elevenlabs_phone_number_id;
    if (!elId) {
      if (!agent?.agent_id) throw new Error("Kein KI-Assistent vorhanden.");
      elId = await importToElevenLabs(phone, label, agent.agent_id);
    }
    const now = new Date().toISOString();
    await saveRow(tenantId, { status: "aktiv", elevenlabs_phone_number_id: elId, activated_at: now, last_error: null });
    await db.from("ai_phone_agents").update({ phone_number: phone, status: "aktiv", updated_at: now }).eq("tenant_id", tenantId);
    await notifyActive(tenantId, phone, row.rep_email);
  } catch (e) {
    const msg = errMsg(e);
    console.error("ai-phone-number activate", msg);
    await saveRow(tenantId, { status: "freigegeben", last_error: msg });
  }
}

async function handleRefresh(req: Request): Promise<Response> {
  const user = await currentAdmin(req);
  if (!user) return json({ ok: false, error: "Nicht angemeldet." }, 403);
  const tenantId = Number(user.tenant_id);
  const { data: row } = await db.from("ai_phone_numbers").select("*").eq("tenant_id", tenantId).maybeSingle();
  if (!row) return json({ ok: true, number: null });
  try {
    if (row.twilio_bundle_sid && ["eingereicht", "freigegeben"].includes(row.status)) {
      const bundle = await getBundle(row.twilio_bundle_sid);
      await applyBundleStatus(row, bundle.status, bundle.failure_reason ?? null);
    }
  } catch (e) {
    await saveRow(tenantId, { last_error: errMsg(e) });
  }
  return json({ ok: true, number: await publicRow(tenantId) });
}

async function handleCallback(req: Request, url: URL): Promise<Response> {
  const hook = env("AI_PHONE_HOOK_TOKEN");
  if (!hook || hook.length < 24 || url.searchParams.get("hook") !== hook) return json({ error: "unauthorized" }, 401);
  const form = await req.formData().catch(() => null);
  const bundleSid = String(form?.get("BundleSid") ?? form?.get("BundleSID") ?? "");
  const status = String(form?.get("Status") ?? "");
  const reason = form?.get("FailureReason") ? String(form.get("FailureReason")) : null;
  if (!bundleSid || !status) return json({ ok: true, ignored: true });
  const { data: row } = await db.from("ai_phone_numbers").select("*").eq("twilio_bundle_sid", bundleSid).maybeSingle();
  if (!row) return json({ ok: true, unknown: true });
  await applyBundleStatus(row, status, reason);
  return json({ ok: true });
}

async function handleRequirements(req: Request): Promise<Response> {
  const user = await currentAdmin(req);
  if (!user || Number(user.role_id) !== 1) return json({ error: "Nur für den Plattform-Inhaber." }, 403);
  return json({ account: accountSid(), regulation: await loadRegulation() });
}

serve(async (req) => {
  if (req.method === "OPTIONS") return new Response(null, { status: 204, headers: HEADERS });
  const url = new URL(req.url);
  try {
    const action = url.searchParams.get("action");
    if (action === "submit") return await handleSubmit(req);
    if (action === "refresh") return await handleRefresh(req);
    if (action === "twilio-callback") return await handleCallback(req, url);
    if (action === "requirements") return await handleRequirements(req);
    return json({ error: "unknown action" }, 400);
  } catch (e) {
    console.error("ai-phone-number", e);
    return json({ ok: false, error: errMsg(e) }, 500);
  }
});
