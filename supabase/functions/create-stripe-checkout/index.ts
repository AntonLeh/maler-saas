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

    if (!["starter", "professional", "business", "enterprise"].includes(plan)) {
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

    // =====================================================
    // TARIFWECHSEL bei bestehendem Stripe-Abo:
    // bestehendes Abo umstellen (anteilige Verrechnung) statt ein zweites Abo anzulegen
    // =====================================================
    const { data: currentSub } = await supabase
      .from("subscriptions")
      .select("plan, status, stripe_subscription_id")
      .eq("tenant_id", appUser.tenant_id)
      .limit(1)
      .maybeSingle();

    if (currentSub?.stripe_subscription_id) {
      let stripeSub = null;
      try {
        stripeSub = await stripe.subscriptions.retrieve(currentSub.stripe_subscription_id);
      } catch (_e) {
        stripeSub = null; // Abo bei Stripe nicht (mehr) vorhanden -> normaler Checkout
      }
      if (stripeSub && ["active", "trialing", "past_due"].includes(stripeSub.status)) {
        const item = stripeSub.items?.data?.[0];
        if (!item) throw new Error("Das bestehende Abo hat keine Position.");
        if (item.price?.id === priceId && currentSub.plan === plan) {
          throw new Error("Das ist bereits Ihr aktueller Tarif.");
        }
        await stripe.subscriptions.update(stripeSub.id, {
          items: [{ id: item.id, price: priceId }],
          proration_behavior: "create_prorations",
          metadata: { tenant_id: String(appUser.tenant_id), plan },
        });
        const { error: activateError } = await supabase.rpc("activate_subscription_plan", {
          p_tenant_id: appUser.tenant_id,
          p_plan: plan,
        });
        if (activateError) throw activateError;
        await supabase.from("subscriptions").update({ stripe_price_id: priceId }).eq("tenant_id", appUser.tenant_id);
        return new Response(JSON.stringify({ url: `${origin}/?stripe=success&changed=1`, changed: true }), {
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      }
    }

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

      // Steuer automatisch über Stripe Tax (Sitz Spanien):
      // ES 21 % IVA, EU-Firmen mit USt-IdNr. Reverse Charge, CH ohne EU-Steuer
      automatic_tax: { enabled: true },
      tax_id_collection: { enabled: true },
      billing_address_collection: "required",

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
    // Details nur ins interne Protokoll, dem Kunden nur verständliche, harmlose Texte zeigen
    console.error("Stripe Checkout Fehler:", error);
    const SAFE: Record<string, string> = {
      "Authorization Header fehlt.": "Bitte melden Sie sich neu an und versuchen Sie es noch einmal.",
      "Benutzer konnte nicht geprüft werden.": "Bitte melden Sie sich neu an und versuchen Sie es noch einmal.",
      "Kein Plan übergeben.": "Bitte einen Tarif auswählen.",
      "Ungültiger Plan.": "Dieser Tarif ist nicht verfügbar.",
      "Das ist bereits Ihr aktueller Tarif.": "Das ist bereits Ihr aktueller Tarif.",
    };
    const msg = SAFE[String(error?.message ?? "")] ?? "Bitte versuchen Sie es später noch einmal oder wenden Sie sich an info@maler-saas.com.";

    return new Response(
      JSON.stringify({
        error: msg,
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