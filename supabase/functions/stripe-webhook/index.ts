// @ts-nocheck

import { serve } from "https://deno.land/std@0.224.0/http/server.ts";
import Stripe from "https://esm.sh/stripe@14.25.0?target=deno";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.45.4";

const stripe = new Stripe(
  Deno.env.get("STRIPE_SECRET_KEY")!,
  {
    apiVersion: "2024-06-20",
  }
);

const cryptoProvider = Stripe.createSubtleCryptoProvider();

serve(async (req) => {
  try {
    const body = await req.text();

    const signature = req.headers.get("Stripe-Signature");

    if (!signature) {
      throw new Error("Stripe-Signature fehlt.");
    }

    const webhookSecret = Deno.env.get(
      "STRIPE_WEBHOOK_SECRET"
    );

    if (!webhookSecret) {
      throw new Error("Webhook Secret fehlt.");
    }

    const event = await stripe.webhooks.constructEventAsync(
      body,
      signature,
      webhookSecret,
      undefined,
      cryptoProvider
    );

    const supabase = createClient(
      Deno.env.get("SUPABASE_URL")!,
      Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!
    );

    // =====================================================
    // CHECKOUT SUCCESS
    // =====================================================

    if (event.type === "checkout.session.completed") {
      const session = event.data.object;

      const tenantId = Number(
        session.metadata?.tenant_id
      );

      const plan = session.metadata?.plan;

      if (!tenantId || !plan) {
        throw new Error(
          "tenant_id oder plan fehlt."
        );
      }

      // =====================================================
      // PLAN AKTIVIEREN
      // =====================================================

      const { error: activateError } =
        await supabase.rpc(
          "activate_subscription_plan",
          {
            p_tenant_id: tenantId,
            p_plan: plan,
          }
        );

      if (activateError) {
        throw activateError;
      }

      // =====================================================
      // STRIPE DATEN SPEICHERN
      // =====================================================

      await supabase
        .from("subscriptions")
        .update({
          stripe_customer_id:
            session.customer?.toString() || null,

          stripe_subscription_id:
            session.subscription?.toString() || null,

          stripe_price_id:
            session.line_items?.[0]?.price?.id || null,
        })
        .eq("tenant_id", tenantId);

      // =====================================================
      // BILLING EVENT
      // =====================================================

      await supabase
        .from("billing_events")
        .insert({
          tenant_id: tenantId,
          event_type: "payment_received",
          new_plan: plan,
          amount:
            session.amount_total
              ? session.amount_total / 100
              : null,
          currency:
            session.currency?.toUpperCase() || "CHF",

          description:
            "Stripe Zahlung erfolgreich.",

          metadata: session,
        });
    }

    return new Response(
      JSON.stringify({ received: true }),
      {
        status: 200,
      }
    );
  } catch (error) {
    console.error("Webhook Fehler:", error);

    return new Response(
      JSON.stringify({
        error: error.message,
      }),
      {
        status: 400,
      }
    );
  }
});