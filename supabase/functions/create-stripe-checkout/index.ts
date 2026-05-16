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
    return new Response("ok", { headers: corsHeaders });
  }

  try {
    const stripeSecretKey = Deno.env.get("STRIPE_SECRET_KEY");
    const supabaseUrl = Deno.env.get("SUPABASE_URL");
    const supabaseServiceRoleKey = Deno.env.get(
      "SUPABASE_SERVICE_ROLE_KEY"
    );

    if (!stripeSecretKey) {
      throw new Error("STRIPE_SECRET_KEY fehlt.");
    }

    if (!supabaseUrl || !supabaseServiceRoleKey) {
      throw new Error("Supabase Umgebungsvariablen fehlen.");
    }

    const stripe = new Stripe(stripeSecretKey, {
      apiVersion: "2024-06-20",
    });

    const supabase = createClient(
      supabaseUrl,
      supabaseServiceRoleKey
    );

    const authHeader = req.headers.get("Authorization");

    if (!authHeader) {
      throw new Error("Authorization Header fehlt.");
    }

    const jwt = authHeader.replace("Bearer ", "");

    const {
      data: { user },
      error: userError,
    } = await supabase.auth.getUser(jwt);

    if (userError || !user) {
      throw new Error("Benutzer konnte nicht geprüft werden.");
    }

    const body = await req.json();
    const plan = body.plan;

    if (!plan) {
      throw new Error("Kein Plan übergeben.");
    }

    if (!["starter", "professional", "business"].includes(plan)) {
      throw new Error("Ungültiger Plan.");
    }

    const { data: appUser, error: appUserError } = await supabase
      .from("app_users")
      .select("tenant_id, email")
      .eq("auth_user_id", user.id)
      .single();

    if (appUserError || !appUser) {
      throw new Error("App-Benutzer wurde nicht gefunden.");
    }

    const { data: priceId, error: priceError } = await supabase.rpc(
      "get_stripe_price_id_for_plan",
      {
        p_plan: plan,
      }
    );

    if (priceError || !priceId) {
      throw new Error("Stripe Price ID konnte nicht geladen werden.");
    }

    const origin =
      req.headers.get("origin") || "http://localhost:5173";

    const session = await stripe.checkout.sessions.create({
      mode: "subscription",
      payment_method_types: ["card"],

      line_items: [
        {
          price: priceId,
          quantity: 1,
        },
      ],

      customer_email: user.email || appUser.email,

      success_url:
        `${origin}/?stripe=success&session_id={CHECKOUT_SESSION_ID}`,

      cancel_url:
        `${origin}/?stripe=cancel`,

      metadata: {
        tenant_id: String(appUser.tenant_id),
        plan,
      },

      subscription_data: {
        metadata: {
          tenant_id: String(appUser.tenant_id),
          plan,
        },
      },
    });

    return new Response(
      JSON.stringify({
        url: session.url,
      }),
      {
        headers: {
          ...corsHeaders,
          "Content-Type": "application/json",
        },
      }
    );
  } catch (error) {
    console.error("Stripe Checkout Fehler:", error);

    return new Response(
      JSON.stringify({
        error: error.message || "Unbekannter Fehler",
      }),
      {
        status: 400,
        headers: {
          ...corsHeaders,
          "Content-Type": "application/json",
        },
      }
    );
  }
});