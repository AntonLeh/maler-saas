// Firma vollständig löschen (nur Plattform-Inhaber)
//   POST { tenant_id, confirm_name }
// Reihenfolge: 1) Angaben sammeln  2) Datenbank löschen (bricht ab → nichts verändert)
//              3) Dateien, Zugänge, Telefonnummer, KI-Assistent, Domain, Stripe-Abo entfernen  4) Bericht
// Secrets (alle schon vorhanden): TWILIO_ACCOUNT_SID, TWILIO_AUTH_TOKEN, ELEVENLABS_API_KEY,
//          VERCEL_TOKEN, VERCEL_PROJECT_ID, (VERCEL_TEAM_ID), STRIPE_SECRET_KEY

import { serve } from "https://deno.land/std@0.224.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.45.4";
import { normalizeDomain, removeDomain } from "../website-domain/vercel.ts";
import { listAll, ORDER_BUCKET, removeAll, sameName, TENANT_BUCKETS, type StorageLike } from "./logic.ts";

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

type Step = { step: string; ok: boolean; detail: string };

async function twilioRelease(numberSid: string) {
  const sid = env("TWILIO_ACCOUNT_SID");
  const token = env("TWILIO_AUTH_TOKEN");
  if (!sid || !token) throw new Error("Twilio-Zugang fehlt");
  const res = await fetch(`${env("TWILIO_API_URL") || "https://api.twilio.com"}/2010-04-01/Accounts/${sid}/IncomingPhoneNumbers/${encodeURIComponent(numberSid)}.json`, {
    method: "DELETE",
    headers: { authorization: `Basic ${btoa(`${sid}:${token}`)}` },
  });
  if (!res.ok && res.status !== 404) throw new Error(`Twilio ${res.status}: ${(await res.text()).slice(0, 200)}`);
}

async function elevenDelete(path: string) {
  const key = env("ELEVENLABS_API_KEY");
  if (!key) throw new Error("ElevenLabs-Schlüssel fehlt");
  const res = await fetch(`${env("ELEVENLABS_API_URL") || "https://api.elevenlabs.io"}${path}`, { method: "DELETE", headers: { "xi-api-key": key } });
  if (!res.ok && res.status !== 404) throw new Error(`ElevenLabs ${res.status}: ${(await res.text()).slice(0, 200)}`);
}

async function stripeCancel(subscriptionId: string) {
  const key = env("STRIPE_SECRET_KEY");
  if (!key) throw new Error("Stripe-Schlüssel fehlt");
  const res = await fetch(`https://api.stripe.com/v1/subscriptions/${encodeURIComponent(subscriptionId)}`, {
    method: "DELETE",
    headers: { authorization: `Bearer ${key}` },
  });
  if (!res.ok && res.status !== 404) {
    const body = await res.json().catch(() => ({}));
    // bereits gekündigt ist in Ordnung
    if (!/canceled|No such subscription/i.test(JSON.stringify(body))) throw new Error(`Stripe ${res.status}: ${body?.error?.message ?? ""}`);
  }
}

serve(async (req) => {
  if (req.method === "OPTIONS") return new Response(null, { headers: HEADERS });
  if (req.method !== "POST") return json({ ok: false, error: "Nur POST" }, 405);
  try {
    // ---------- nur Plattform-Inhaber ----------
    const token = (req.headers.get("authorization") ?? "").replace(/^Bearer\s+/i, "");
    const { data: auth } = token ? await db.auth.getUser(token) : { data: null as any };
    if (!auth?.user) return json({ ok: false, error: "Bitte erneut anmelden." }, 401);
    const { data: me } = await db.from("app_users").select("id, tenant_id, role_id").eq("auth_user_id", auth.user.id).maybeSingle();
    if (!me || Number(me.role_id) !== 1) return json({ ok: false, error: "Nur für den Plattform-Inhaber." }, 403);

    const body = await req.json().catch(() => ({}));
    const tenantId = Number(body.tenant_id);
    if (!Number.isInteger(tenantId) || tenantId <= 0) return json({ ok: false, error: "Ungültige Firma." }, 400);
    if (tenantId === Number(me.tenant_id)) return json({ ok: false, error: "Die eigene Plattform-Firma kann nicht gelöscht werden." }, 400);

    const { data: tenant } = await db.from("tenants").select("*").eq("id", tenantId).maybeSingle();
    if (!tenant) return json({ ok: false, error: "Firma nicht gefunden." }, 404);
    const { data: company } = await db.from("company_settings").select("company_name").eq("tenant_id", tenantId).maybeSingle();
    const name = company?.company_name || tenant.name || tenant.company_name || `Firma ${tenantId}`;
    if (!sameName(body.confirm_name, name)) return json({ ok: false, error: `Zur Bestätigung bitte genau den Firmennamen „${name}“ eingeben.` }, 400);

    // ---------- 1) Angaben sammeln (vor dem Löschen in der Datenbank) ----------
    const [{ data: users }, { data: orders }, { data: numbers }, { data: agents }, { data: site }, { data: subs }] = await Promise.all([
      db.from("app_users").select("id, auth_user_id").eq("tenant_id", tenantId),
      db.from("orders").select("id").eq("tenant_id", tenantId),
      db.from("ai_phone_numbers").select("twilio_number_sid, elevenlabs_phone_number_id, phone_number").eq("tenant_id", tenantId),
      db.from("ai_phone_agents").select("agent_id, tool_ids").eq("tenant_id", tenantId),
      db.from("websites").select("custom_domain").eq("tenant_id", tenantId).maybeSingle(),
      db.from("subscriptions").select("stripe_subscription_id, status").eq("tenant_id", tenantId),
    ]);
    const storage = db.storage as unknown as StorageLike;
    const files: { bucket: string; paths: string[] }[] = [];
    const steps: Step[] = [];
    for (const bucket of TENANT_BUCKETS) {
      try {
        files.push({ bucket, paths: await listAll(storage, bucket, String(tenantId)) });
      } catch (e) {
        steps.push({ step: `Dateien ${bucket} auflisten`, ok: false, detail: (e as Error).message });
      }
    }
    try {
      const paths: string[] = [];
      for (const o of orders ?? []) paths.push(...(await listAll(storage, ORDER_BUCKET, String(o.id))));
      files.push({ bucket: ORDER_BUCKET, paths });
    } catch (e) {
      steps.push({ step: `Dateien ${ORDER_BUCKET} auflisten`, ok: false, detail: (e as Error).message });
    }

    // ---------- 2) Datenbank ----------
    const { data: counts, error: dbErr } = await db.rpc("delete_tenant_completely", { p_tenant_id: tenantId });
    if (dbErr) {
      console.error("delete_tenant_completely", dbErr);
      return json({ ok: false, error: `Datenbank: ${dbErr.message} – es wurde nichts gelöscht.` }, 500);
    }
    const rows = Object.values((counts ?? {}) as Record<string, number>).reduce((a, b) => a + Number(b || 0), 0);
    steps.push({ step: "Datenbank", ok: true, detail: `${rows} Einträge gelöscht (${Object.values((counts ?? {}) as Record<string, number>).filter((n) => Number(n) > 0).length} Tabellen betroffen)` });

    // ---------- 3) alles außerhalb der Datenbank ----------
    const run = async (step: string, fn: () => Promise<string>) => {
      try {
        steps.push({ step, ok: true, detail: await fn() });
      } catch (e) {
        console.error(step, e);
        steps.push({ step, ok: false, detail: (e as Error).message });
      }
    };
    for (const f of files) {
      if (f.paths.length) await run(`Dateien ${f.bucket}`, async () => `${await removeAll(storage, f.bucket, f.paths)} Dateien gelöscht`);
    }
    for (const n of numbers ?? []) {
      if (n.elevenlabs_phone_number_id) await run("ElevenLabs-Nummer", async () => (await elevenDelete(`/v1/convai/phone-numbers/${encodeURIComponent(n.elevenlabs_phone_number_id)}`), "entfernt"));
      if (n.twilio_number_sid) await run(`Twilio-Nummer ${n.phone_number ?? ""}`.trim(), async () => (await twilioRelease(n.twilio_number_sid), "freigegeben"));
    }
    for (const a of agents ?? []) {
      if (a.agent_id) await run("KI-Assistent (ElevenLabs)", async () => (await elevenDelete(`/v1/convai/agents/${encodeURIComponent(a.agent_id)}`), "entfernt"));
      for (const toolId of Object.values((a.tool_ids ?? {}) as Record<string, string>)) {
        if (toolId) await run("KI-Werkzeug (ElevenLabs)", async () => (await elevenDelete(`/v1/convai/tools/${encodeURIComponent(toolId)}`), "entfernt"));
      }
    }
    if (site?.custom_domain) {
      await run(`Domain ${site.custom_domain}`, async () => {
        await removeDomain(site.custom_domain);
        const apex = normalizeDomain(site.custom_domain)?.apex;
        if (apex && apex !== site.custom_domain) await removeDomain(apex);
        return "bei Vercel entfernt";
      });
    }
    for (const s of subs ?? []) {
      if (s.stripe_subscription_id && ["active", "trialing", "past_due", "unpaid", "incomplete"].includes(String(s.status)))
        await run("Stripe-Abo", async () => (await stripeCancel(s.stripe_subscription_id), "gekündigt (Rechnungen bei Stripe bleiben erhalten)"));
    }
    const logins = (users ?? []).map((u: any) => u.auth_user_id).filter(Boolean);
    if (logins.length) {
      await run("Zugänge (Anmeldungen)", async () => {
        let n = 0;
        const errs: string[] = [];
        for (const id of logins) {
          const { error } = await db.auth.admin.deleteUser(id);
          if (error && !/not found/i.test(error.message)) errs.push(error.message);
          else n += 1;
        }
        if (errs.length) throw new Error(`${n} gelöscht, ${errs.length} Fehler: ${errs[0]}`);
        return `${n} gelöscht`;
      });
    }

    const failed = steps.filter((s) => !s.ok);
    console.log("delete-tenant", tenantId, JSON.stringify(steps));
    return json({ ok: true, tenant_id: tenantId, name, complete: failed.length === 0, steps, counts });
  } catch (e) {
    console.error("delete-tenant", e);
    return json({ ok: false, error: "Unerwarteter Fehler beim Löschen." }, 500);
  }
});
