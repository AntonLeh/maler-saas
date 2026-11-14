// MalerTreff-Community: Aufgaben, die Server-Rechte brauchen
//   POST { action: "verify", member, approve, reason }   – Moderation: Nachweis freigeben/ablehnen + E-Mail an das Mitglied
//   POST { action: "delete_account" }                    – Externe (ohne MalerSaaS-Konto) löschen ihr Konto selbst (DSGVO)
// Alle Aufrufe mit Anmeldung (Bearer-Token). Secrets (vorhanden): BREVO_API_KEY, BREVO_SENDER_EMAIL
// Deploy: npx supabase functions deploy community --no-verify-jwt

import { serve } from "https://deno.land/std@0.224.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.45.4";
import { decisionMail } from "./logic.ts";

/* eslint-disable @typescript-eslint/no-explicit-any */
const env = (k: string) => Deno.env.get(k) ?? "";
const db = createClient(env("SUPABASE_URL"), env("SUPABASE_SERVICE_ROLE_KEY"), { auth: { persistSession: false } });
const HEADERS = {
  "content-type": "application/json; charset=utf-8",
  "access-control-allow-origin": "*",
  "access-control-allow-headers": "authorization, content-type, apikey, x-client-info",
  "access-control-allow-methods": "POST, OPTIONS",
  "cache-control": "no-store",
};
const json = (data: unknown, status = 200) => new Response(JSON.stringify(data), { status, headers: HEADERS });
const fail = (error: string, status = 400) => json({ ok: false, error }, status);
const ORIGIN_OK = /^https:\/\/(maler-saas\.com|maler-saas-[a-z0-9-]+-anton-lehmanns-projects-a7614210\.vercel\.app)$/;

async function sendMail(to: string, subject: string, html: string) {
  const key = env("BREVO_API_KEY");
  const sender = env("BREVO_SENDER_EMAIL");
  if (!key || !sender || !to) return false;
  try {
    const res = await fetch("https://api.brevo.com/v3/smtp/email", {
      method: "POST",
      headers: { "api-key": key, "content-type": "application/json", accept: "application/json" },
      body: JSON.stringify({ sender: { email: sender, name: "MalerTreff" }, to: [{ email: to }], subject, htmlContent: html, tags: ["malertreff"] }),
      signal: AbortSignal.timeout(20000),
    });
    if (!res.ok) console.error("brevo", res.status, (await res.text()).slice(0, 200));
    return res.ok;
  } catch (e) {
    console.error("brevo", e);
    return false;
  }
}

/** Alle Dateien eines Ordners in einem Speicher löschen */
async function removeFolder(bucket: string, folder: string) {
  const { data } = await db.storage.from(bucket).list(folder, { limit: 1000 });
  const paths = (data ?? []).map((f: any) => `${folder}/${f.name}`);
  if (paths.length) await db.storage.from(bucket).remove(paths);
}

serve(async (req) => {
  if (req.method === "OPTIONS") return new Response(null, { headers: HEADERS });
  if (req.method !== "POST") return fail("Nur POST", 405);
  try {
    const token = (req.headers.get("authorization") ?? "").replace(/^Bearer\s+/i, "");
    const { data: auth } = token ? await db.auth.getUser(token) : { data: null as any };
    const user = auth?.user;
    if (!user) return fail("Bitte erneut anmelden.", 401);
    // Datenbank-Aufrufe im Namen des Nutzers (die Rechte prüft die Datenbank)
    const asUser = createClient(env("SUPABASE_URL"), env("SUPABASE_ANON_KEY"), {
      auth: { persistSession: false },
      global: { headers: { Authorization: `Bearer ${token}` } },
    });
    const body = await req.json().catch(() => ({}));
    const origin = req.headers.get("origin") ?? "";
    const site = ORIGIN_OK.test(origin) ? origin : "https://maler-saas.com";

    if (body.action === "verify") {
      const { data, error } = await asUser.rpc("community_verify_decide", {
        p_member: Number(body.member),
        p_approve: !!body.approve,
        p_reason: String(body.reason ?? ""),
      });
      if (error) return fail(error.message);
      const { data: target } = await db.auth.admin.getUserById(String(data.auth_user_id));
      const email = target?.user?.email ?? "";
      const m = decisionMail({ name: data.display_name, approved: !!data.approved, reason: data.reason, link: `${site}/malertreff` });
      const mailed = await sendMail(email, m.subject, m.html);
      return json({ ok: true, mailed });
    }

    if (body.action === "delete_account") {
      const { data: appUser } = await db.from("app_users").select("id").eq("auth_user_id", user.id).maybeSingle();
      if (appUser) return fail("Dieses Konto gehört zu einem MalerSaaS-Zugang und kann hier nicht gelöscht werden.");
      await removeFolder("community", user.id);
      await removeFolder("community-proofs", user.id);
      const { error } = await db.auth.admin.deleteUser(user.id);
      if (error) return fail(`Löschen fehlgeschlagen: ${error.message}`, 500);
      return json({ ok: true });
    }

    return fail("Unbekannte Aktion.");
  } catch (e) {
    console.error("community", e);
    return fail((e as Error).message, 500);
  }
});
