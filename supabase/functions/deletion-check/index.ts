// Löschfristen prüfen (AGB Punkt 21) – täglich per Zeitplan oder von Hand im Owner-Dashboard
//   POST ?hook=<DELETION_HOOK_TOKEN>        (Zeitplan, pg_cron)
//   POST  mit Anmeldung des Plattform-Inhabers  (Knopf „Jetzt prüfen“)
// 1) Vorwarnung per E-Mail 7 Tage vor der Löschung  2) Übersicht der fälligen Firmen an den Plattform-Inhaber
// 3) MalerTreff: Nachweise 30 Tage nach der Prüfung löschen
// Gelöscht wird NICHT automatisch – das macht der Plattform-Inhaber im Owner-Dashboard.
// Secrets: BREVO_API_KEY, BREVO_SENDER_EMAIL (vorhanden), DELETION_HOOK_TOKEN (neu, frei wählbar)

import { serve } from "https://deno.land/std@0.224.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.45.4";
import { type DueRow, fmtDate, isDue, needsWarning, warningMail } from "./logic.ts";
import { cleanupCommunityProofs } from "./community.ts";

/* eslint-disable @typescript-eslint/no-explicit-any */

const env = (k: string) => Deno.env.get(k) ?? "";
const db = createClient(env("SUPABASE_URL"), env("SUPABASE_SERVICE_ROLE_KEY"), { auth: { persistSession: false } });
const HEADERS = {
  "content-type": "application/json; charset=utf-8",
  "access-control-allow-origin": "*",
  "access-control-allow-headers": "authorization, content-type, apikey, x-client-info",
  "access-control-allow-methods": "POST, OPTIONS",
};
const json = (data: unknown, status = 200) => new Response(JSON.stringify(data), { status, headers: HEADERS });

async function sendMail(to: string, subject: string, text: string, replyTo?: string | null) {
  const key = env("BREVO_API_KEY");
  const sender = env("BREVO_SENDER_EMAIL");
  if (!key || !sender) throw new Error("Brevo ist nicht eingerichtet.");
  const res = await fetch("https://api.brevo.com/v3/smtp/email", {
    method: "POST",
    headers: { accept: "application/json", "content-type": "application/json", "api-key": key },
    body: JSON.stringify({
      sender: { email: sender, name: "MalerSaaS" },
      ...(replyTo ? { replyTo: { email: replyTo } } : {}),
      to: [{ email: to }],
      subject,
      textContent: text,
      tags: ["loeschfrist"],
    }),
    signal: AbortSignal.timeout(20000),
  });
  if (!res.ok) throw new Error(`Brevo ${res.status}: ${(await res.text()).slice(0, 200)}`);
}

serve(async (req) => {
  if (req.method === "OPTIONS") return new Response(null, { headers: HEADERS });
  if (req.method !== "POST") return json({ ok: false, error: "Nur POST" }, 405);
  try {
    const url = new URL(req.url);
    const hook = url.searchParams.get("hook") ?? "";
    const fromSchedule = !!hook && !!env("DELETION_HOOK_TOKEN") && hook === env("DELETION_HOOK_TOKEN");
    if (!fromSchedule) {
      const token = (req.headers.get("authorization") ?? "").replace(/^Bearer\s+/i, "");
      const { data: auth } = token ? await db.auth.getUser(token) : { data: null as any };
      if (!auth?.user) return json({ ok: false, error: "Bitte erneut anmelden." }, 401);
      const { data: me } = await db.from("app_users").select("role_id").eq("auth_user_id", auth.user.id).maybeSingle();
      if (!me || Number(me.role_id) !== 1) return json({ ok: false, error: "Nur für den Plattform-Inhaber." }, 403);
    }

    // MalerTreff: alte Nachweise löschen (30 Tage nach der Prüfung)
    const proofsDeleted = await cleanupCommunityProofs(db).catch((e) => (console.error("community proofs", e), 0));

    const { data, error } = await db.rpc("tenant_deletion_list");
    if (error) throw new Error(error.message);
    const rows = (data ?? []) as DueRow[];
    const { data: warns } = await db.from("tenant_deletion_warnings").select("tenant_id, due_at");
    const warned = new Map((warns ?? []).map((w: any) => [Number(w.tenant_id), String(w.due_at)]));

    const { data: owner } = await db.from("app_users").select("email").eq("role_id", 1).order("id").limit(1).maybeSingle();
    const ownerEmail = owner?.email ?? null;

    const sent: string[] = [];
    const failed: string[] = [];
    for (const r of rows) {
      if (!needsWarning(r, warned.get(Number(r.tenant_id)) ?? null)) continue;
      try {
        const m = warningMail(r);
        await sendMail(String(r.email), m.subject, m.text, ownerEmail);
        await db.from("tenant_deletion_warnings").upsert({ tenant_id: r.tenant_id, due_at: r.due_at, warned_at: new Date().toISOString(), email: r.email }, { onConflict: "tenant_id" });
        sent.push(`${r.company_name} (${r.email})`);
      } catch (e) {
        console.error("warn", r.tenant_id, e);
        failed.push(`${r.company_name}: ${(e as Error).message}`);
      }
    }

    const due = rows.filter((r) => isDue(r));
    // Übersicht an den Plattform-Inhaber (nur beim Zeitplan, nur wenn es etwas zu tun gibt)
    if (fromSchedule && ownerEmail && (due.length || sent.length || failed.length)) {
      const lines = [
        due.length ? `Zur Löschung fällig (${due.length}):\n${due.map((r) => `• ${r.company_name} – ${r.reason}, fällig seit ${fmtDate(r.due_at)}`).join("\n")}` : "",
        sent.length ? `Heute vorgewarnt (${sent.length}):\n${sent.map((s) => `• ${s}`).join("\n")}` : "",
        failed.length ? `Vorwarnung fehlgeschlagen:\n${failed.map((s) => `• ${s}`).join("\n")}` : "",
      ].filter(Boolean);
      try {
        await sendMail(ownerEmail, `MalerSaaS Löschfristen: ${due.length} fällig`, `${lines.join("\n\n")}\n\nLöschen im Owner-Dashboard → „Löschfristen“.`);
      } catch (e) {
        console.error("owner mail", e);
      }
    }

    return json({ ok: true, warned: sent, failed, due: due.map((r) => r.tenant_id), proofsDeleted });
  } catch (e) {
    console.error("deletion-check", e);
    return json({ ok: false, error: (e as Error).message }, 500);
  }
});
