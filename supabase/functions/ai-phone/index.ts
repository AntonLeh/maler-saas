// @ts-nocheck
// =====================================================================
// KI-Telefon – Schnittstelle für den Sprach-KI-Anbieter
// (ElevenLabs Agents, Retell AI, Vapi oder eigenes "generisches" Format)
//
// Adresse:  https://<projekt>.supabase.co/functions/v1/ai-phone?key=<webhook_key>&action=<...>
//   action=context     -> Betriebsdaten zu Gesprächsbeginn
//   action=tool        -> Werkzeuge während des Gesprächs (&tool=<name> für ElevenLabs/generisch)
//   action=call-ended  -> Gesprächsende mit Zusammenfassung und Dauer
// Der webhook_key identifiziert den Betrieb (Tabelle ai_phone_settings).
//
// Deploy:  npx supabase functions deploy ai-phone --no-verify-jwt
// =====================================================================

import { serve } from "https://deno.land/std@0.224.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.45.4";
import {
  computeFreeSlots,
  isBookable,
  normalizePhone,
  parseStart,
  slotLabel,
  zonedParts,
} from "./slots.ts";
import { notify } from "./notify.ts";

const ALLOWED_PLANS = ["business", "enterprise"];
const ALLOWED_STATUS = ["active", "trialing"];
const ADMIN_ROLE_ID = 2;

const db = createClient(Deno.env.get("SUPABASE_URL")!, Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!, {
  auth: { persistSession: false },
});

const JSON_HEADERS = {
  "content-type": "application/json; charset=utf-8",
  "access-control-allow-origin": "*",
  "access-control-allow-headers": "authorization, content-type, x-ai-phone-key",
};

function json(data: unknown, status = 200) {
  return new Response(JSON.stringify(data), { status, headers: JSON_HEADERS });
}

/** Arbeit nach der Antwort erledigen (Supabase Edge Runtime), sonst abwarten */
async function inBackground(p: Promise<unknown>) {
  const rt = (globalThis as any).EdgeRuntime;
  if (rt?.waitUntil) rt.waitUntil(p);
  else await p;
}

function str(v: unknown, max = 500): string {
  if (v === null || v === undefined) return "";
  return String(v).trim().slice(0, max);
}

function parseArgs(v: unknown): Record<string, unknown> {
  if (!v) return {};
  if (typeof v === "string") {
    try {
      return JSON.parse(v);
    } catch {
      return {};
    }
  }
  return typeof v === "object" ? (v as Record<string, unknown>) : {};
}

// ---------------------------------------------------------------------
// Anbieter und Aktion erkennen
// ---------------------------------------------------------------------
function detectProvider(body: any, url: URL): string {
  const p = url.searchParams.get("provider");
  if (p) return p.toLowerCase();
  if (body?.message?.type) return "vapi";
  if (body?.type === "post_call_transcription" || (body?.agent_id && body?.caller_id !== undefined)) return "elevenlabs";
  if (body?.event || (body?.call && body?.name)) return "retell";
  return "generic";
}

function detectAction(body: any, url: URL, provider: string): string {
  const a = url.searchParams.get("action");
  if (a) return a;
  if (provider === "vapi") {
    const t = body?.message?.type;
    if (t === "tool-calls") return "tool";
    if (t === "end-of-call-report") return "call-ended";
    if (t === "assistant-request") return "context";
    return "ignore";
  }
  if (provider === "retell") {
    if (body?.event === "call_inbound") return "context";
    if (body?.event === "call_ended" || body?.event === "call_analyzed") return "call-ended";
    if (body?.event) return "ignore";
    return "tool";
  }
  if (provider === "elevenlabs") {
    if (body?.type === "post_call_transcription") return "call-ended";
    if (body?.type) return "ignore";
    if (body?.agent_id && body?.caller_id !== undefined && !url.searchParams.get("tool")) return "context";
  }
  return url.searchParams.get("tool") ? "tool" : "ignore";
}

// ---------------------------------------------------------------------
// Zugriff: Business-Tarif, aktiv, vom Admin eingeschaltet
// ---------------------------------------------------------------------
async function checkAccess(settings: any): Promise<{ ok: boolean; reason?: string }> {
  if (!settings.enabled) return { ok: false, reason: "disabled" };
  const { data: sub } = await db
    .from("subscriptions")
    .select("plan, status")
    .eq("tenant_id", settings.tenant_id)
    .order("id", { ascending: false })
    .limit(1)
    .maybeSingle();
  if (!sub || !ALLOWED_PLANS.includes(String(sub.plan)) || !ALLOWED_STATUS.includes(String(sub.status))) {
    return { ok: false, reason: "plan" };
  }
  return { ok: true };
}

// ---------------------------------------------------------------------
// Betriebsdaten für das Gespräch
// ---------------------------------------------------------------------
const DAY_NAMES = ["", "Montag", "Dienstag", "Mittwoch", "Donnerstag", "Freitag", "Samstag", "Sonntag"];

function availabilityText(settings: any): string {
  const parts: string[] = [];
  for (let d = 1; d <= 7; d++) {
    const w = settings.availability?.[String(d)] ?? [];
    if (w.length) parts.push(`${DAY_NAMES[d]} ${w.map((x: string[]) => `${x[0]}–${x[1]}`).join(" und ")}`);
  }
  return parts.length ? parts.join("; ") : "nach Vereinbarung";
}

async function companyName(settings: any): Promise<string> {
  if (settings.company_name) return settings.company_name;
  const { data } = await db.from("tenants").select("*").eq("id", settings.tenant_id).maybeSingle();
  return data?.company_name || data?.name || "unser Malerbetrieb";
}

async function contextVariables(settings: any, access: { ok: boolean }) {
  const name = await companyName(settings);
  const now = new Date();
  const p = zonedParts(now, settings.timezone);
  const monthName = new Intl.DateTimeFormat("de-DE", { timeZone: settings.timezone, month: "long" }).format(now);
  const greeting = access.ok
    ? settings.greeting ||
      `Guten Tag, Sie sprechen mit dem digitalen KI-Assistenten von ${name}. Wie kann ich Ihnen helfen?`
    : `Guten Tag, Sie sind bei ${name}. Leider ist gerade niemand erreichbar. Bitte rufen Sie später noch einmal an.`;
  return {
    company_name: name,
    greeting,
    today: `${DAY_NAMES[p.weekday]}, ${p.day}. ${monthName} ${p.year}`,
    current_time: `${String(p.hour).padStart(2, "0")}:${String(p.minute).padStart(2, "0")} Uhr`,
    visit_hours: availabilityText(settings),
    visit_duration: `${settings.visit_duration_minutes} Minuten`,
    extra_instructions: str(settings.assistant_instructions, 4000) || "keine",
    service_available: access.ok ? "ja" : "nein",
  };
}

// ---------------------------------------------------------------------
// Hilfsfunktionen Datenbank
// ---------------------------------------------------------------------
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

async function firstAdminId(tenantId: number): Promise<number | null> {
  const { data } = await db
    .from("app_users")
    .select("id, is_active")
    .eq("tenant_id", tenantId)
    .eq("role_id", ADMIN_ROLE_ID)
    .order("id", { ascending: true });
  const active = (data ?? []).find((u: any) => u.is_active !== false) ?? (data ?? [])[0];
  return active?.id ?? null;
}

async function matchCustomer(tenantId: number, phone: string): Promise<number | null> {
  const wanted = normalizePhone(phone);
  if (wanted.length < 8) return null;
  const { data } = await db.from("customers").select("id, phone").eq("tenant_id", tenantId).not("phone", "is", null);
  const tail = wanted.slice(-9);
  const hit = (data ?? []).find((c: any) => {
    const n = normalizePhone(c.phone);
    return n.length >= 8 && (n === wanted || n.slice(-9) === tail);
  });
  return hit?.id ?? null;
}

async function logCall(tenantId: number, provider: string, callId: string | null, fields: Record<string, unknown>) {
  if (!callId) return;
  const { error } = await db
    .from("ai_calls")
    .upsert(
      { tenant_id: tenantId, provider, provider_call_id: callId, updated_at: new Date().toISOString(), ...fields },
      { onConflict: "tenant_id,provider_call_id" }
    );
  if (error) console.error("ai_calls upsert", error);
}

function toLocalInput(iso: string, tz: string): string {
  const p = zonedParts(new Date(iso), tz);
  const pad = (n: number) => String(n).padStart(2, "0");
  return `${p.year}-${pad(p.month)}-${pad(p.day)}T${pad(p.hour)}:${pad(p.minute)}`;
}

// ---------------------------------------------------------------------
// Werkzeuge
// ---------------------------------------------------------------------
type ToolCtx = { settings: any; provider: string; callId: string | null; callerNumber: string };

async function toolGetFreeSlots(args: any, ctx: ToolCtx) {
  const s = ctx.settings;
  const now = new Date();
  const busy = await loadBusy(s.tenant_id, now, new Date(now.getTime() + (s.booking_horizon_days + 2) * 86_400_000));
  const daypart = ["vormittag", "nachmittag"].includes(str(args.daypart).toLowerCase())
    ? str(args.daypart).toLowerCase()
    : null;
  const slots = computeFreeSlots({ settings: s, busy, now, fromDate: str(args.from_date, 10) || undefined, daypart });
  if (slots.length === 0) {
    return {
      ok: false,
      slots: [],
      message:
        "Im gewünschten Zeitraum ist leider kein Besichtigungstermin frei. Biete einen Rückruf an und nimm den Wunsch mit create_callback auf.",
    };
  }
  return {
    ok: true,
    slots: slots.map((x) => ({ start: toLocalInput(x.start, s.timezone), label: x.label })),
    message: `Freie Besichtigungstermine (je ${s.visit_duration_minutes} Minuten): ${slots
      .map((x) => x.label)
      .join("; ")}. Biete dem Anrufer höchstens zwei bis drei davon an.`,
  };
}

async function toolBookAppointment(args: any, ctx: ToolCtx) {
  const s = ctx.settings;
  const name = str(args.name ?? args.customer_name, 120);
  const phone = str(args.phone, 40) || ctx.callerNumber;
  const address = str(args.address ?? args.location, 300);
  const concern = str(args.concern ?? args.description, 1500);
  const email = str(args.email, 200);

  const missing = [];
  if (!name) missing.push("Name");
  if (!phone) missing.push("Telefonnummer");
  if (!address) missing.push("Adresse des Objekts");
  if (missing.length) {
    return { ok: false, message: `Es fehlen noch: ${missing.join(", ")}. Bitte erfrage diese Angaben und versuche es erneut.` };
  }

  const start = parseStart(str(args.start, 40), s.timezone);
  if (!start) {
    return { ok: false, message: "Die Startzeit ist ungültig. Nutze einen 'start'-Wert aus get_free_slots." };
  }

  const now = new Date();
  const busy = await loadBusy(s.tenant_id, new Date(start.getTime() - 86_400_000), new Date(start.getTime() + 86_400_000));
  if (!isBookable(start, { settings: s, busy, now })) {
    const allBusy = await loadBusy(s.tenant_id, now, new Date(now.getTime() + (s.booking_horizon_days + 2) * 86_400_000));
    const alt = computeFreeSlots({ settings: s, busy: allBusy, now, maxSlots: 3 });
    return {
      ok: false,
      message: alt.length
        ? `Dieser Termin ist leider nicht mehr frei. Alternativen: ${alt.map((x) => x.label).join("; ")}.`
        : "Dieser Termin ist leider nicht frei, und es gibt aktuell keine Alternativen. Biete einen Rückruf an.",
      alternatives: alt.map((x) => ({ start: toLocalInput(x.start, s.timezone), label: x.label })),
    };
  }

  const end = new Date(start.getTime() + s.visit_duration_minutes * 60_000);
  const [adminId, customerId] = await Promise.all([firstAdminId(s.tenant_id), matchCustomer(s.tenant_id, phone)]);
  const description = [
    concern && `Anliegen: ${concern}`,
    `Telefon: ${phone}`,
    email && `E-Mail: ${email}`,
    "Vom KI-Telefon gebucht – bitte prüfen und an einen Projektleiter weiterleiten.",
  ]
    .filter(Boolean)
    .join("\n");

  const { data: appt, error } = await db
    .from("appointments")
    .insert([
      {
        tenant_id: s.tenant_id,
        created_by: adminId,
        customer_id: customerId,
        title: `Besichtigung: ${name}`,
        appointment_type: "besichtigung",
        description,
        location: address,
        starts_at: start.toISOString(),
        ends_at: end.toISOString(),
        status: "geplant",
        source: "ki_telefon",
        contact_name: name,
        contact_phone: phone,
      },
    ])
    .select("id")
    .single();
  if (error) throw error;

  await logCall(s.tenant_id, ctx.provider, ctx.callId, {
    outcome: "termin",
    appointment_id: appt.id,
    caller_number: ctx.callerNumber || phone,
  });

  await inBackground(
    companyName(s).then((company) =>
      notify(s, { kind: "appointment", name, phone, address, when: slotLabel(start, s.timezone), concern }, company)
    )
  );

  return {
    ok: true,
    appointment_id: appt.id,
    message: `Termin eingetragen: ${slotLabel(start, s.timezone)} bei ${address}. Bestätige dem Anrufer Datum und Uhrzeit und sage, dass sich der Betrieb bei Änderungen meldet.`,
  };
}

async function toolCreateCallback(args: any, ctx: ToolCtx) {
  const s = ctx.settings;
  const name = str(args.name ?? args.customer_name, 120);
  const phone = str(args.phone, 40) || ctx.callerNumber;
  const concern = str(args.concern ?? args.message, 1500);
  if (!phone) {
    return { ok: false, message: "Bitte erfrage zuerst die Rückrufnummer." };
  }
  const { data, error } = await db
    .from("ai_callback_requests")
    .insert([
      {
        tenant_id: s.tenant_id,
        caller_name: name || null,
        caller_phone: phone,
        concern: concern || null,
        preferred_time: str(args.preferred_time, 200) || null,
        provider_call_id: ctx.callId,
      },
    ])
    .select("id")
    .single();
  if (error) throw error;

  await logCall(s.tenant_id, ctx.provider, ctx.callId, {
    outcome: "rueckruf",
    callback_id: data.id,
    caller_number: ctx.callerNumber || phone,
  });

  await inBackground(
    companyName(s).then((company) =>
      notify(
        s,
        { kind: "callback", name, phone, concern, preferredTime: str(args.preferred_time, 200) },
        company
      )
    )
  );

  return {
    ok: true,
    message: "Rückrufwunsch ist notiert. Sage dem Anrufer, dass sich der Betrieb so bald wie möglich meldet.",
  };
}

async function runTool(name: string, args: any, ctx: ToolCtx, access: { ok: boolean }) {
  try {
    return await runToolUnsafe(name, args, ctx, access);
  } catch (e) {
    console.error("ai-phone tool error", name, e);
    return {
      ok: false,
      message:
        "Es gab ein technisches Problem. Nimm Name, Telefonnummer und Anliegen auf, rufe create_callback auf oder sage, dass der Betrieb zurückruft.",
    };
  }
}

async function runToolUnsafe(name: string, args: any, ctx: ToolCtx, access: { ok: boolean }) {
  if (!access.ok) {
    return {
      ok: false,
      message:
        "Der Telefonassistent ist für diesen Betrieb derzeit nicht freigeschaltet. Bitte den Anrufer höflich, es später noch einmal zu versuchen, und beende das Gespräch.",
    };
  }
  switch (name) {
    case "get_company_info": {
      const vars = await contextVariables(ctx.settings, access);
      return { ok: true, ...vars, message: `Betrieb: ${vars.company_name}. Heute ist ${vars.today}, ${vars.current_time}.` };
    }
    case "get_free_slots":
      return toolGetFreeSlots(args, ctx);
    case "book_appointment":
      return toolBookAppointment(args, ctx);
    case "create_callback":
      return toolCreateCallback(args, ctx);
    default:
      return { ok: false, message: `Unbekanntes Werkzeug: ${name}` };
  }
}

// ---------------------------------------------------------------------
// Gesprächsende auswerten
// ---------------------------------------------------------------------
function parseCallEnded(body: any, provider: string) {
  const ms = (v: any) => (v ? new Date(typeof v === "number" ? v : v).toISOString() : null);
  if (provider === "vapi") {
    const m = body.message ?? {};
    const started = m.startedAt ?? m.call?.startedAt ?? null;
    const ended = m.endedAt ?? m.call?.endedAt ?? null;
    return {
      callId: m.call?.id ?? null,
      caller: m.call?.customer?.number ?? null,
      started_at: ms(started),
      ended_at: ms(ended),
      duration_seconds:
        m.durationSeconds ?? (started && ended ? Math.round((new Date(ended).getTime() - new Date(started).getTime()) / 1000) : null),
      summary: m.summary ?? m.analysis?.summary ?? null,
    };
  }
  if (provider === "retell") {
    const c = body.call ?? {};
    return {
      callId: c.call_id ?? null,
      caller: c.from_number ?? null,
      started_at: ms(c.start_timestamp),
      ended_at: ms(c.end_timestamp),
      duration_seconds: c.duration_ms
        ? Math.round(c.duration_ms / 1000)
        : c.start_timestamp && c.end_timestamp
        ? Math.round((c.end_timestamp - c.start_timestamp) / 1000)
        : null,
      summary: c.call_analysis?.call_summary ?? null,
    };
  }
  if (provider === "elevenlabs") {
    const d = body.data ?? {};
    const startSecs = d.metadata?.start_time_unix_secs;
    const dur = d.metadata?.call_duration_secs ?? null;
    return {
      callId: d.conversation_id ?? null,
      caller:
        d.metadata?.phone_call?.external_number ??
        d.conversation_initiation_client_data?.dynamic_variables?.system__caller_id ??
        null,
      started_at: startSecs ? new Date(startSecs * 1000).toISOString() : null,
      ended_at: startSecs && dur ? new Date((startSecs + dur) * 1000).toISOString() : null,
      duration_seconds: dur,
      summary: d.analysis?.transcript_summary ?? null,
    };
  }
  return {
    callId: body.call_id ?? null,
    caller: body.caller_number ?? null,
    started_at: body.started_at ?? null,
    ended_at: body.ended_at ?? null,
    duration_seconds: body.duration_seconds ?? null,
    summary: body.summary ?? null,
  };
}

// ---------------------------------------------------------------------
// Einstieg
// ---------------------------------------------------------------------
serve(async (req) => {
  if (req.method === "OPTIONS") return new Response(null, { status: 204, headers: JSON_HEADERS });

  try {
    const url = new URL(req.url);
    const bearer = (req.headers.get("authorization") ?? "").replace(/^Bearer\s+/i, "");
    const key = url.searchParams.get("key") || req.headers.get("x-ai-phone-key") || bearer;
    if (!key || key.length < 32) return json({ error: "unauthorized" }, 401);

    const { data: settings, error: sErr } = await db
      .from("ai_phone_settings")
      .select("*")
      .eq("webhook_key", key)
      .maybeSingle();
    if (sErr) throw sErr;
    if (!settings) return json({ error: "unauthorized" }, 401);

    const raw = await req.text();
    let body: any = {};
    try {
      body = raw ? JSON.parse(raw) : {};
    } catch {
      body = {};
    }

    const provider = detectProvider(body, url);
    const action = detectAction(body, url, provider);
    if (action === "ignore") return json({ ok: true, ignored: true });

    const access = await checkAccess(settings);

    // ---------- Test-Benachrichtigung (Knopf in der App) ----------
    if (action === "test-notify") {
      if (!access.ok && access.reason === "plan") return json({ ok: false, error: "Nur im Business-Tarif verfügbar." }, 403);
      const result = await notify(settings, { kind: "test" }, await companyName(settings));
      return json({ ok: true, result });
    }

    // ---------- Gesprächsbeginn ----------
    if (action === "context") {
      const vars = await contextVariables(settings, access);
      if (provider === "elevenlabs") {
        return json({ type: "conversation_initiation_client_data", dynamic_variables: vars });
      }
      if (provider === "retell") {
        return json({ call_inbound: { dynamic_variables: vars } });
      }
      return json(vars);
    }

    // ---------- Gesprächsende ----------
    if (action === "call-ended") {
      const c = parseCallEnded(body, provider);
      if (!c.callId) return json({ ok: true, ignored: true });
      await logCall(settings.tenant_id, provider, c.callId, {
        caller_number: c.caller,
        started_at: c.started_at,
        ended_at: c.ended_at,
        duration_seconds: c.duration_seconds,
        summary: c.summary ? String(c.summary).slice(0, 4000) : null,
      });
      // Ergebnis "info", falls während des Gesprächs nichts gebucht wurde
      await db
        .from("ai_calls")
        .update({ outcome: "info" })
        .eq("tenant_id", settings.tenant_id)
        .eq("provider_call_id", c.callId)
        .is("outcome", null);
      return json({ ok: true });
    }

    // ---------- Werkzeuge ----------
    if (action === "tool") {
      if (provider === "vapi") {
        const m = body.message ?? {};
        const ctx: ToolCtx = {
          settings,
          provider,
          callId: m.call?.id ?? null,
          callerNumber: str(m.call?.customer?.number, 40),
        };
        const results = [];
        for (const tc of m.toolCallList ?? []) {
          const name = tc.function?.name ?? tc.name;
          const res = await runTool(name, parseArgs(tc.function?.arguments ?? tc.arguments), ctx, access);
          results.push({ toolCallId: tc.id, name, result: JSON.stringify(res) });
        }
        return json({ results });
      }

      const toolName = url.searchParams.get("tool") || body.name || body.tool;
      const args =
        provider === "retell"
          ? parseArgs(body.args ?? body)
          : parseArgs(body.args ?? body.parameters ?? body);
      const ctx: ToolCtx = {
        settings,
        provider,
        callId: str(body.call?.call_id ?? body.call_id ?? body.conversation_id ?? args.call_id, 120) || null,
        callerNumber: str(body.call?.from_number ?? body.caller_number ?? body.caller_id ?? args.caller_number, 40),
      };
      const res = await runTool(String(toolName ?? ""), args, ctx, access);
      return json(res);
    }

    return json({ error: "unknown action" }, 400);
  } catch (e) {
    console.error("ai-phone error", e);
    // Der KI eine sprechbare Antwort geben statt das Gespräch abbrechen zu lassen
    return json(
      {
        ok: false,
        message:
          "Es gab ein technisches Problem. Nimm Name, Telefonnummer und Anliegen auf und sage, dass der Betrieb zurückruft.",
      },
      200
    );
  }
});
