// =====================================================================
// create-employee-auth – Mitarbeiter anlegen und App-Zugang verwalten (nur Admin)
//   action "create" (Standard): Person anlegen – mit App-Zugang (E-Mail + Passwort, zählt zum Tarif-Limit)
//                                oder ohne App-Zugang (z. B. Subunternehmer, Lager – zählt nicht zum Limit)
//   action "grant_access":  App-Zugang nachträglich einschalten (Login anlegen bzw. wieder freigeben)
//   action "revoke_access": App-Zugang abschalten (Login gesperrt, Daten bleiben)
// Deploy:  npx supabase functions deploy create-employee-auth --no-verify-jwt
// =====================================================================
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

const ALLOWED_CREATABLE_ROLE_IDS = [3, 4];
const EMPLOYMENT_TYPES = ["gewerblich", "angestellt", "azubi", "minijob", "leiharbeit", "sub"];
const EMAIL_RE = /^[^@\s]+@[^@\s]+\.[^@\s]{2,}$/;
const BAN_FOREVER = "876000h"; // ~100 Jahre

const json = (body: unknown, status = 200) => new Response(JSON.stringify(body), { status, headers: { ...corsHeaders, "Content-Type": "application/json" } });

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: corsHeaders });

  try {
    const supabaseUrl = Deno.env.get("SUPABASE_URL");
    const supabaseAnonKey = Deno.env.get("SUPABASE_ANON_KEY");
    const serviceRoleKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY");
    if (!supabaseUrl || !supabaseAnonKey || !serviceRoleKey) return json({ error: "Fehlende Environment-Variablen in der Function." }, 500);

    const authHeader = req.headers.get("Authorization");
    if (!authHeader) return json({ error: "Fehlender Authorization-Header." }, 401);

    const userClient = createClient(supabaseUrl, supabaseAnonKey, { global: { headers: { Authorization: authHeader } } });
    const adminClient = createClient(supabaseUrl, serviceRoleKey);

    const {
      data: { user },
      error: authError,
    } = await userClient.auth.getUser();
    if (authError || !user) return json({ error: authError?.message || "Nicht eingeloggt oder Token ungültig." }, 401);

    const { data: callerProfile, error: callerError } = await adminClient.from("app_users").select("*").eq("auth_user_id", user.id).single();
    if (callerError || !callerProfile) return json({ error: callerError?.message || "Admin-Profil konnte nicht geladen werden." }, 403);
    if (![1, 2].includes(callerProfile.role_id)) return json({ error: "Nur Admins dürfen Mitarbeiter anlegen." }, 403);

    const tenantId = callerProfile.tenant_id;
    const body = await req.json().catch(() => ({}));
    const action = String(body?.action || "create");

    // ---------- Abo und Limit: es zählen nur aktive Personen MIT App-Zugang ----------
    const checkLimit = async (): Promise<Response | null> => {
      const { data: sub } = await adminClient.from("subscriptions").select("status, max_users").eq("tenant_id", tenantId).order("id", { ascending: false }).limit(1).maybeSingle();
      if (!sub || !["active", "trialing", "past_due"].includes(String(sub.status))) return json({ error: "Für den App-Zugang von Mitarbeitern wird ein aktiver Tarif benötigt." }, 403);
      const maxUsers = Number(sub.max_users || 0);
      if (maxUsers <= 0) return null;
      let res = await adminClient.from("app_users").select("id", { count: "exact", head: true }).eq("tenant_id", tenantId).eq("is_active", true).eq("app_access", true).in("role_id", [3, 4]);
      if (res.error) {
        // Datenbank-Update noch nicht eingespielt → wie bisher alle zählen
        res = await adminClient.from("app_users").select("id", { count: "exact", head: true }).eq("tenant_id", tenantId).eq("is_active", true).in("role_id", [3, 4]);
      }
      if (res.error) return json({ error: "Das Mitarbeiter-Limit konnte nicht geprüft werden. Bitte später erneut versuchen." }, 500);
      if (Number(res.count || 0) >= maxUsers) {
        return json(
          {
            error: `Mitarbeiter-Limit erreicht: Ihr Tarif erlaubt höchstens ${maxUsers} Mitarbeiter mit App-Zugang. Legen Sie die Person ohne App-Zugang an oder wechseln Sie den Tarif.`,
          },
          403
        );
      }
      return null;
    };

    const emailTaken = async (email: string, exceptId?: number) => {
      let q = adminClient.from("app_users").select("id").eq("tenant_id", tenantId).eq("email", email);
      if (exceptId) q = q.neq("id", exceptId);
      const { data } = await q.limit(1);
      return !!data?.length;
    };

    // ---------- App-Zugang ein/aus für bestehende Person ----------
    if (action === "grant_access" || action === "revoke_access") {
      const userId = Number(body.user_id);
      const { data: target } = await adminClient.from("app_users").select("*").eq("id", userId).eq("tenant_id", tenantId).maybeSingle();
      if (!target || !ALLOWED_CREATABLE_ROLE_IDS.includes(target.role_id)) return json({ error: "Person nicht gefunden." }, 404);

      if (action === "revoke_access") {
        if (target.auth_user_id) {
          const { error } = await adminClient.auth.admin.updateUserById(target.auth_user_id, { ban_duration: BAN_FOREVER });
          if (error) return json({ error: `Login konnte nicht gesperrt werden: ${error.message}` }, 400);
        }
        const { error } = await adminClient.from("app_users").update({ app_access: false }).eq("id", userId);
        if (error) return json({ error: error.message }, 400);
        return json({ success: true });
      }

      if (target.app_access && target.auth_user_id) return json({ success: true });
      const email = String(body.email || target.email || "").trim().toLowerCase();
      const password = String(body.password || "");
      if (!EMAIL_RE.test(email)) return json({ error: "Für den App-Zugang wird eine gültige E-Mail-Adresse benötigt." }, 400);
      if (!target.auth_user_id && password.length < 8) return json({ error: "Das Passwort muss mindestens 8 Zeichen lang sein." }, 400);
      if (password && password.length < 8) return json({ error: "Das Passwort muss mindestens 8 Zeichen lang sein." }, 400);
      if (await emailTaken(email, userId)) return json({ error: "Diese E-Mail-Adresse wird in Ihrem Betrieb schon verwendet." }, 409);
      const limit = await checkLimit();
      if (limit) return limit;

      let authId = target.auth_user_id as string | null;
      if (authId) {
        const { error } = await adminClient.auth.admin.updateUserById(authId, { ban_duration: "none", email, email_confirm: true, ...(password ? { password } : {}) });
        if (error) return json({ error: `Login konnte nicht freigegeben werden: ${error.message}` }, 400);
      } else {
        const { data: created, error } = await adminClient.auth.admin.createUser({
          email,
          password,
          email_confirm: true,
          user_metadata: { first_name: target.first_name, last_name: target.last_name, role_id: target.role_id, tenant_id: tenantId },
        });
        if (error || !created.user) return json({ error: error?.message || "Login konnte nicht angelegt werden." }, 400);
        authId = created.user.id;
      }
      const { error: upErr } = await adminClient.from("app_users").update({ app_access: true, auth_user_id: authId, email }).eq("id", userId);
      if (upErr) return json({ error: upErr.message }, 400);
      return json({ success: true });
    }

    if (action !== "create") return json({ error: "Unbekannte Aktion." }, 400);

    // ---------- Neue Person anlegen ----------
    const first_name = String(body.first_name || "").trim();
    const last_name = String(body.last_name || "").trim();
    const email = String(body.email || "").trim().toLowerCase();
    const phone = String(body.phone || "").trim();
    const password = String(body.password || "");
    const role_id = Number(body.role_id);
    const appAccess = body.app_access !== false;
    const employmentType = EMPLOYMENT_TYPES.includes(String(body.employment_type)) ? String(body.employment_type) : "gewerblich";
    const hourly_rate = body.hourly_rate !== undefined && body.hourly_rate !== null && String(body.hourly_rate).trim() !== "" ? Number(body.hourly_rate) : null;

    if (!first_name || !last_name) return json({ error: "Vorname und Nachname sind Pflichtfelder." }, 400);
    if (!ALLOWED_CREATABLE_ROLE_IDS.includes(role_id)) return json({ error: "Es dürfen nur Projektleiter oder Mitarbeiter angelegt werden." }, 400);
    if (appAccess) {
      if (!email || !password) return json({ error: "Für den App-Zugang sind E-Mail und Passwort Pflichtfelder." }, 400);
      if (password.length < 8) return json({ error: "Das Passwort muss mindestens 8 Zeichen lang sein." }, 400);
    }
    if (email && !EMAIL_RE.test(email)) return json({ error: "Die E-Mail-Adresse ist ungültig." }, 400);
    if (email && (await emailTaken(email))) return json({ error: "Für diese E-Mail existiert in diesem Tenant bereits ein Benutzer." }, 409);

    if (appAccess) {
      const limit = await checkLimit();
      if (limit) return limit;
    } else {
      const { data: sub } = await adminClient.from("subscriptions").select("status").eq("tenant_id", tenantId).order("id", { ascending: false }).limit(1).maybeSingle();
      if (!sub || !["active", "trialing", "past_due"].includes(String(sub.status))) return json({ error: "Für das Anlegen von Mitarbeitern wird ein aktiver Tarif benötigt." }, 403);
    }

    let authUserId: string | null = null;
    if (appAccess) {
      const { data: createdAuthUser, error: createAuthError } = await adminClient.auth.admin.createUser({
        email,
        password,
        email_confirm: true,
        user_metadata: { first_name, last_name, role_id, tenant_id: tenantId },
      });
      if (createAuthError || !createdAuthUser.user) return json({ error: createAuthError?.message || "Auth-User konnte nicht angelegt werden." }, 400);
      authUserId = createdAuthUser.user.id;
    }

    const row: Record<string, unknown> = {
      tenant_id: tenantId,
      role_id,
      auth_user_id: authUserId,
      first_name,
      last_name,
      email: email || null,
      phone: phone || null,
      password_hash: null,
      is_active: true,
      hourly_rate,
    };
    // Neue Spalten nur mitschicken, wenn nötig – so klappt das Anlegen mit App-Zugang auch vor dem Datenbank-Update
    if (!appAccess) row.app_access = false;
    if (employmentType !== "gewerblich") row.employment_type = employmentType;

    const { data: insertedAppUser, error: insertError } = await adminClient.from("app_users").insert([row]).select().single();
    if (insertError) {
      if (authUserId) await adminClient.auth.admin.deleteUser(authUserId);
      const missing = /app_access|employment_type|null value in column "email"/i.test(insertError.message);
      return json({ error: missing ? "Für Personen ohne App-Zugang fehlt noch das Datenbank-Update (SQL „Mitarbeiter-Arten“)." : insertError.message || "app_users-Datensatz konnte nicht angelegt werden." }, 400);
    }

    return json({ success: true, app_user: insertedAppUser });
  } catch (error) {
    console.error("create-employee-auth", error);
    return json({ error: error instanceof Error ? error.message : "Unbekannter Fehler" }, 500);
  }
});
