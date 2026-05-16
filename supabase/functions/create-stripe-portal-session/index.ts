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

    const {
      data: subscription,
      error: subscriptionError,
    } = await supabase
      .from("subscriptions")
      .select("stripe_customer_id")
      .eq("tenant_id", appUser.tenant_id)
      .single();

    if (
      subscriptionError ||
      !subscription?.stripe_customer_id
    ) {
      throw new Error(
        "Stripe Kunde nicht vorhanden."
      );
    }

    const origin =
      req.headers.get("origin") ||
      "http://localhost:5173";

    const session =
      await stripe.billingPortal.sessions.create({
        customer:
          subscription.stripe_customer_id,

        return_url: `${origin}/`,
      });

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