// @ts-nocheck
// =====================================================================
// Modul Website – eigene Domain verbinden (z. B. www.maler-prinz.de)
//
// POST https://<projekt>.supabase.co/functions/v1/website-domain?action=connect|check|disconnect
//   Authorization: Bearer <Supabase-Token eines Admins>
//   connect:    { domain: "maler-prinz.de" }  -> bei Vercel eintragen, Status "pending", DNS-Anleitung zurück
//   check:      Status bei Vercel prüfen -> "active", sobald DNS stimmt (Zertifikat erstellt Vercel selbst)
//   disconnect: Domain bei Vercel entfernen, Website wieder unter betrieb.maler-saas.com
//
// Secrets:  VERCEL_TOKEN        (Vercel → Account Settings → Tokens)
//           VERCEL_PROJECT_ID   (Vercel → Projekt → Settings → General → Project ID)
//           VERCEL_TEAM_ID      (optional, wenn das Projekt in einem Team liegt: Team Settings → Team ID)
// Deploy:   npx supabase functions deploy website-domain --no-verify-jwt   (Anmeldung wird unten geprüft)
// =====================================================================

import { serve } from "https://deno.land/std@0.224.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.45.4";
import { VercelError, addDomain, domainStatus, normalizeDomain, removeDomain } from "./vercel.ts";

const ALLOWED_PLANS = ["professional", "business", "enterprise"];
const ALLOWED_STATUS = ["active", "trialing", "past_due"];

const db = createClient(Deno.env.get("SUPABASE_URL")!, Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!, { auth: { persistSession: false } });

const HEADERS = {
  "content-type": "application/json; charset=utf-8",
  "access-control-allow-origin": "*",
  "access-control-allow-headers": "authorization, content-type, apikey, x-client-info",
  "access-control-allow-methods": "POST, OPTIONS",
};
const json = (data: unknown, status = 200) => new Response(JSON.stringify(data), { status, headers: HEADERS });

const apexOf = (primary: string) => normalizeDomain(primary)?.apex ?? null;

async function save(tenantId: number, patch: Record<string, unknown>) {
  const { error } = await db.from("websites").update(patch).eq("tenant_id", tenantId);
  if (error) throw error;
}

serve(async (req) => {
  if (req.method === "OPTIONS") return new Response(null, { headers: HEADERS });
  if (req.method !== "POST") return json({ ok: false, error: "Nur POST" }, 405);
  try {
    // ---------- Anmeldung, Rolle, Tarif ----------
    const token = (req.headers.get("authorization") ?? "").replace(/^Bearer\s+/i, "");
    if (!token) return json({ ok: false, error: "Nicht angemeldet." }, 401);
    const { data: authData, error: authErr } = await db.auth.getUser(token);
    if (authErr || !authData?.user) return json({ ok: false, error: "Nicht angemeldet." }, 401);
    const { data: user } = await db.from("app_users").select("id, tenant_id, role_id").eq("auth_user_id", authData.user.id).maybeSingle();
    if (!user || ![1, 2].includes(Number(user.role_id))) return json({ ok: false, error: "Nur Admins dürfen die Domain verwalten." }, 403);
    const { data: sub } = await db.from("subscriptions").select("plan, status").eq("tenant_id", user.tenant_id).order("id", { ascending: false }).limit(1).maybeSingle();
    if (!sub || !ALLOWED_PLANS.includes(sub.plan) || !ALLOWED_STATUS.includes(sub.status)) {
      return json({ ok: false, error: "Eigene Domains gehören zur Website (ab Tarif Professional)." }, 403);
    }
    const { data: site } = await db.from("websites").select("tenant_id, slug, custom_domain, custom_domain_status").eq("tenant_id", user.tenant_id).maybeSingle();
    if (!site) return json({ ok: false, error: "Bitte zuerst die Website anlegen." }, 400);

    const action = new URL(req.url).searchParams.get("action");
    const body = await req.json().catch(() => ({}));

    // ---------- Verbinden ----------
    if (action === "connect") {
      const d = normalizeDomain(body.domain);
      if (!d) return json({ ok: false, error: "Bitte eine gültige Domain eingeben, z. B. maler-mustermann.de" }, 400);
      const { data: taken } = await db.from("websites").select("tenant_id").eq("custom_domain", d.primary).neq("tenant_id", user.tenant_id).maybeSingle();
      if (taken) return json({ ok: false, error: "Diese Domain ist bereits mit einer anderen Website verbunden." }, 409);
      if (site.custom_domain && site.custom_domain !== d.primary) {
        await removeDomain(site.custom_domain);
        const oldApex = apexOf(site.custom_domain);
        if (oldApex) await removeDomain(oldApex);
      }
      await addDomain(d.primary, d.apex);
      await save(user.tenant_id, { custom_domain: d.primary, custom_domain_status: "pending", custom_domain_error: null, custom_domain_checked_at: new Date().toISOString() });
      const st = await domainStatus(d.primary, d.apex).catch(() => ({ active: false, records: [], problem: "" }));
      if (st.active) await save(user.tenant_id, { custom_domain_status: "active" });
      return json({ ok: true, domain: d.primary, status: st.active ? "active" : "pending", records: st.records, problem: st.problem });
    }

    // ---------- Prüfen ----------
    if (action === "check") {
      if (!site.custom_domain) return json({ ok: true, domain: null, status: null, records: [] });
      const apex = apexOf(site.custom_domain);
      const st = await domainStatus(site.custom_domain, apex);
      const status = st.active ? "active" : "pending";
      await save(user.tenant_id, { custom_domain_status: status, custom_domain_error: st.problem || null, custom_domain_checked_at: new Date().toISOString() });
      return json({ ok: true, domain: site.custom_domain, status, records: st.records, problem: st.problem });
    }

    // ---------- Trennen ----------
    if (action === "disconnect") {
      if (site.custom_domain) {
        await removeDomain(site.custom_domain);
        const apex = apexOf(site.custom_domain);
        if (apex) await removeDomain(apex);
      }
      await save(user.tenant_id, { custom_domain: null, custom_domain_status: null, custom_domain_error: null, custom_domain_checked_at: null });
      return json({ ok: true, domain: null, status: null, records: [] });
    }

    return json({ ok: false, error: "Unbekannte Aktion." }, 400);
  } catch (e) {
    console.error("website-domain", e);
    if (e instanceof VercelError) {
      const msg =
        e.code === "no_token"
          ? e.message
          : e.status === 403
            ? "Vercel hat den Zugriff verweigert (Schlüssel oder Projekt prüfen)."
            : /already in use|owned by another/i.test(e.message)
              ? "Diese Domain ist bereits bei einem anderen Vercel-Projekt eingetragen."
              : `Vercel: ${e.message}`;
      return json({ ok: false, error: msg }, e.status >= 400 && e.status < 600 ? e.status : 502);
    }
    if (e?.code === "23505") return json({ ok: false, error: "Diese Domain ist bereits mit einer anderen Website verbunden." }, 409);
    return json({ ok: false, error: "Unerwarteter Fehler. Bitte später noch einmal versuchen." }, 500);
  }
});
