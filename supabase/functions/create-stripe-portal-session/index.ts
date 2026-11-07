// @ts-nocheck

import { serve } from "https://deno.land/std@0.224.0/http/server.ts";
import Stripe from "https://esm.sh/stripe@14.25.0?target=deno";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.45.4";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type",
};

serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response("ok", {
      headers: corsHeaders,
    });
  }

  try {
    const stripeSecretKey =
      Deno.env.get("STRIPE_SECRET_KEY");

    if (!stripeSecretKey) {
      throw new Error(
        "STRIPE_SECRET_KEY fehlt."
      );
    }

    const stripe = new Stripe(
      stripeSecretKey,
      {
        apiVersion: "2024-06-20",
      }
    );

    const supabase = createClient(
      Deno.env.get("SUPABASE_URL")!,
      Deno.env.get(
        "SUPABASE_SERVICE_ROLE_KEY"
      )!
    );

    const authHeader =
      req.headers.get("Authorization");

    if (!authHeader) {
      throw new Error(
        "Authorization Header fehlt."
      );
    }

    const jwt = authHeader.replace(
      "Bearer ",
      ""
    );

    const {
      data: { user },
      error: userError,
    } = await supabase.auth.getUser(jwt);

    if (userError || !user) {
      throw new Error(
        "Benutzer konnte nicht geladen werden."
      );
    }

    const { data: appUser, error: appUserError } =
      await supabase
        .from("app_users")
        .select("tenant_id")
        .eq("auth_user_id", user.id)
        .single();

    if (appUserError || !appUser) {
      throw new Error(
        "App User nicht gefunden."
      );
    }

    // neuester Abo-Eintrag (es kann mehrere geben – .single() würde dann scheitern)
    const { data: subscription } = await supabase
      .from("subscriptions")
      .select("stripe_customer_id, status")
      .eq("tenant_id", appUser.tenant_id)
      .not("stripe_customer_id", "is", null)
      .order("id", { ascending: false })
      .limit(1)
      .maybeSingle();

    if (!subscription?.stripe_customer_id) {
      throw new Error(
        "Sie haben noch kein bezahltes Abo – in der kostenlosen Testphase gibt es nichts zu verwalten oder zu kündigen. Ein Abo können Sie unter „Tarif ändern“ abschließen."
      );
    }

    const origin =
      req.headers.get("origin") ||
      "http://localhost:5173";

    let session;
    try {
      session = await stripe.billingPortal.sessions.create({
        customer: subscription.stripe_customer_id,
        return_url: `${origin}/`,
      });
    } catch (e) {
      console.error("Stripe billingPortal:", e?.message);
      if (/configuration/i.test(String(e?.message))) {
        throw new Error(
          "Das Stripe-Kundenportal ist noch nicht eingerichtet (Stripe → Einstellungen → Billing → Kundenportal → Speichern)."
        );
      }
      if (/No such customer/i.test(String(e?.message))) {
        throw new Error("Der Stripe-Kunde wurde nicht gefunden. Bitte beim MalerSaaS-Support melden.");
      }
      throw new Error(`Stripe: ${e?.message ?? "unbekannter Fehler"}`);
    }

    return new Response(
      JSON.stringify({
        url: session.url,
      }),
      {
        headers: {
          ...corsHeaders,
          "Content-Type":
            "application/json",
        },
      }
    );
  } catch (error) {
    console.error(
      "Stripe Portal Fehler:",
      error
    );

    return new Response(
      JSON.stringify({
        error:
          error.message ||
          "Unbekannter Fehler",
      }),
      {
        status: 400,
        headers: {
          ...corsHeaders,
          "Content-Type":
            "application/json",
        },
      }
    );
  }
});