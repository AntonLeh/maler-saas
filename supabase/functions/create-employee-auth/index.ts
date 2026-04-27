import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

const ALLOWED_CREATABLE_ROLE_IDS = [3, 4];

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") {
    console.log("OPTIONS request received");
    return new Response("ok", { headers: corsHeaders });
  }

  try {
    console.log("Function start");

    const supabaseUrl = Deno.env.get("SUPABASE_URL");
    const supabaseAnonKey = Deno.env.get("SUPABASE_ANON_KEY");
    const serviceRoleKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY");

    console.log("Env check", {
      hasSupabaseUrl: !!supabaseUrl,
      hasAnonKey: !!supabaseAnonKey,
      hasServiceRoleKey: !!serviceRoleKey,
    });

    if (!supabaseUrl || !supabaseAnonKey || !serviceRoleKey) {
      return new Response(
        JSON.stringify({ error: "Fehlende Environment-Variablen in der Function." }),
        {
          status: 500,
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        }
      );
    }

    const authHeader = req.headers.get("Authorization");
    console.log("Authorization header present:", !!authHeader);

    if (!authHeader) {
      return new Response(
        JSON.stringify({ error: "Fehlender Authorization-Header." }),
        {
          status: 401,
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        }
      );
    }

    const userClient = createClient(supabaseUrl, supabaseAnonKey, {
      global: {
        headers: {
          Authorization: authHeader,
        },
      },
    });

    const adminClient = createClient(supabaseUrl, serviceRoleKey);

    const {
      data: { user },
      error: authError,
    } = await userClient.auth.getUser();

    console.log("auth.getUser result", {
      hasUser: !!user,
      authError: authError?.message ?? null,
      userId: user?.id ?? null,
      userEmail: user?.email ?? null,
    });

    if (authError || !user) {
      return new Response(
        JSON.stringify({
          error: authError?.message || "Nicht eingeloggt oder Token ungültig.",
        }),
        {
          status: 401,
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        }
      );
    }

    const { data: callerProfile, error: callerError } = await adminClient
      .from("app_users")
      .select("*")
      .eq("auth_user_id", user.id)
      .single();

    console.log("callerProfile lookup", {
      found: !!callerProfile,
      callerError: callerError?.message ?? null,
      roleId: callerProfile?.role_id ?? null,
      tenantId: callerProfile?.tenant_id ?? null,
    });

    if (callerError || !callerProfile) {
      return new Response(
        JSON.stringify({
          error: callerError?.message || "Admin-Profil konnte nicht geladen werden.",
        }),
        {
          status: 403,
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        }
      );
    }

    if (![1, 2].includes(callerProfile.role_id)) {
      console.log("Role check failed", {
        roleId: callerProfile.role_id,
      });

      return new Response(
        JSON.stringify({
          error: `Keine Berechtigung zum Anlegen von Benutzern. role_id=${callerProfile.role_id}`,
        }),
        {
          status: 403,
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        }
      );
    }

    const body = await req.json();
console.log("Request body received", {
  first_name: body?.first_name ?? null,
  last_name: body?.last_name ?? null,
  email: body?.email ?? null,
  hasPassword: !!body?.password,
  phone: body?.phone ?? null,
  role_id: body?.role_id ?? null,
  hourly_rate: body?.hourly_rate ?? null,
});

const first_name = String(body.first_name || "").trim();
const last_name = String(body.last_name || "").trim();
const email = String(body.email || "").trim().toLowerCase();
const phone = String(body.phone || "").trim();
const password = String(body.password || "");
const role_id = Number(body.role_id);
const hourly_rate =
  body.hourly_rate !== undefined &&
  body.hourly_rate !== null &&
  String(body.hourly_rate).trim() !== ""
    ? Number(body.hourly_rate)
    : null;

    if (!first_name || !last_name || !email || !password) {
      return new Response(
        JSON.stringify({
          error: "Vorname, Nachname, E-Mail und Passwort sind Pflichtfelder.",
        }),
        {
          status: 400,
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        }
      );
    }

    if (password.length < 8) {
      return new Response(
        JSON.stringify({
          error: "Das Passwort muss mindestens 8 Zeichen lang sein.",
        }),
        {
          status: 400,
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        }
      );
    }

    if (!ALLOWED_CREATABLE_ROLE_IDS.includes(role_id)) {
      return new Response(
        JSON.stringify({
          error: "Es dürfen nur Projektleiter oder Mitarbeiter angelegt werden.",
        }),
        {
          status: 400,
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        }
      );
    }

    const { data: existingAppUser, error: existingError } = await adminClient
      .from("app_users")
      .select("id")
      .eq("tenant_id", callerProfile.tenant_id)
      .eq("email", email)
      .maybeSingle();

    console.log("existing app user check", {
      found: !!existingAppUser,
      existingError: existingError?.message ?? null,
    });

    if (existingError) {
      return new Response(
        JSON.stringify({
          error: existingError.message || "Vorhandene Benutzer konnten nicht geprüft werden.",
        }),
        {
          status: 400,
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        }
      );
    }

    if (existingAppUser) {
      return new Response(
        JSON.stringify({
          error: "Für diese E-Mail existiert in diesem Tenant bereits ein Benutzer.",
        }),
        {
          status: 409,
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        }
      );
    }

    const { data: createdAuthUser, error: createAuthError } =
      await adminClient.auth.admin.createUser({
        email,
        password,
        email_confirm: true,
        user_metadata: {
          first_name,
          last_name,
          role_id,
          tenant_id: callerProfile.tenant_id,
        },
      });

    console.log("auth.admin.createUser result", {
      created: !!createdAuthUser?.user,
      createAuthError: createAuthError?.message ?? null,
      createdUserId: createdAuthUser?.user?.id ?? null,
    });

    if (createAuthError || !createdAuthUser.user) {
      return new Response(
        JSON.stringify({
          error: createAuthError?.message || "Auth-User konnte nicht angelegt werden.",
        }),
        {
          status: 400,
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        }
      );
    }

    const { data: insertedAppUser, error: insertError } = await adminClient
  .from("app_users")
  .insert([
    {
      tenant_id: callerProfile.tenant_id,
      role_id,
      auth_user_id: createdAuthUser.user.id,
      first_name,
      last_name,
      email,
      phone: phone || null,
      password_hash: null,
      is_active: true,
      hourly_rate, // 👈 NEU
    },
  ])
      .select()
      .single();

    console.log("app_users insert result", {
      inserted: !!insertedAppUser,
      insertError: insertError?.message ?? null,
      insertedId: insertedAppUser?.id ?? null,
    });

    if (insertError) {
      await adminClient.auth.admin.deleteUser(createdAuthUser.user.id);

      return new Response(
        JSON.stringify({
          error: insertError.message || "app_users-Datensatz konnte nicht angelegt werden.",
        }),
        {
          status: 400,
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        }
      );
    }

    console.log("Function success");

    return new Response(
      JSON.stringify({
        success: true,
        app_user: insertedAppUser,
      }),
      {
        status: 200,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      }
    );
  } catch (error) {
    console.error("Unhandled function error", error);

    return new Response(
      JSON.stringify({
        error: error instanceof Error ? error.message : "Unbekannter Fehler",
      }),
      {
        status: 500,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      }
    );
  }
});