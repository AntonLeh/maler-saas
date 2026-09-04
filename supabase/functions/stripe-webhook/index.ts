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
    // CHECKOUT ERFOLGREICH
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

      if (!session.subscription) {
        throw new Error(
          "Stripe Subscription-ID fehlt im Checkout."
        );
      }

      const stripeSubscription =
        await stripe.subscriptions.retrieve(
          session.subscription.toString()
        );

      const currentPeriodEnd =
        stripeSubscription.items.data[0]
          ?.current_period_end;

      if (!currentPeriodEnd) {
        throw new Error(
          "current_period_end fehlt in der Stripe Subscription."
        );
      }

      console.log(
        "=== STRIPE SUBSCRIPTION ==="
      );
      console.log(
        JSON.stringify(stripeSubscription, null, 2)
      );
      console.log(
        "==========================="
      );

      const { error: subscriptionUpdateError } =
        await supabase
          .from("subscriptions")
          .update({
            stripe_customer_id:
              session.customer?.toString() || null,

            stripe_subscription_id:
              session.subscription.toString(),

            stripe_price_id:
              stripeSubscription.items.data[0]
                ?.price.id || null,

            expires_at: new Date(
              currentPeriodEnd * 1000
            ).toISOString(),
          })
          .eq("tenant_id", tenantId);

      if (subscriptionUpdateError) {
        throw subscriptionUpdateError;
      }

      const { error: billingEventError } =
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
              session.currency?.toUpperCase() ||
              "CHF",

            description:
              "Stripe Zahlung erfolgreich.",

            metadata: session,
          });

      if (billingEventError) {
        throw billingEventError;
      }
    }

    // =====================================================
    // SUBSCRIPTION AKTUALISIERT
    // z. B. monatliche Verlängerung
    // =====================================================

    if (
      event.type ===
      "customer.subscription.updated"
    ) {
      const subscription =
        event.data.object as Stripe.Subscription;

      if (!subscription.id) {
        throw new Error(
          "Subscription-ID fehlt."
        );
      }

      const currentPeriodEnd =
        subscription.items.data[0]
          ?.current_period_end;

      if (!currentPeriodEnd) {
        throw new Error(
          "current_period_end fehlt in der aktualisierten Subscription."
        );
      }

      console.log(
        "=== SUBSCRIPTION UPDATED ==="
      );

      console.log(
        JSON.stringify(subscription, null, 2)
      );

      const { error: subscriptionUpdateError } =
        await supabase
          .from("subscriptions")
          .update({
            stripe_price_id:
              subscription.items.data[0]
                ?.price.id ?? null,

            status: subscription.status,

            expires_at: new Date(
              currentPeriodEnd * 1000
            ).toISOString(),
          })
          .eq(
            "stripe_subscription_id",
            subscription.id
          );

      if (subscriptionUpdateError) {
        throw subscriptionUpdateError;
      }
    }

    return new Response(
      JSON.stringify({
        received: true,
      }),
      {
        status: 200,
      }
    );
  } catch (error) {
    console.error(
      "Webhook Fehler:",
      error
    );

    return new Response(
      JSON.stringify({
        error:
          error instanceof Error
            ? error.message
            : String(error),
      }),
      {
        status: 400,
      }
    );
  }
});