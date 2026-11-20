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

// Zusatzmitarbeiter (19 € monatlich / 190 € jährlich) – eigene Abo-Position neben dem Tarif
const SEAT_PRICE_IDS = ["price_1Udqx52QOB8iolrWn7FkS322", "price_1UdqzZ2QOB8iolrWYIWhMqvq"];
const isSeat = (it: any) => SEAT_PRICE_IDS.includes(it?.price?.id);
const planItemOf = (sub: any) => (sub?.items?.data ?? []).find((it: any) => !isSeat(it)) ?? sub?.items?.data?.[0];
const seatCountOf = (sub: any) => (sub?.items?.data ?? []).filter(isSeat).reduce((n: number, it: any) => n + Number(it.quantity || 0), 0);

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

      // KI-Telefon-Minutenkäufe werden von der Funktion ai-phone-billing verbucht
      if (session.metadata?.kind === "ai_minutes") {
        return new Response(JSON.stringify({ received: true, skipped: "ai_minutes" }), { status: 200 });
      }

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
              planItemOf(stripeSubscription)?.price?.id || null,

            expires_at: new Date(
              currentPeriodEnd * 1000
            ).toISOString(),
          })
          .eq("tenant_id", tenantId);

      if (subscriptionUpdateError) {
        throw subscriptionUpdateError;
      }

      // Abrechnungsart (monatlich/jährlich) – eigenes Update, damit ein fehlendes Feld nichts blockiert
      {
        const iv = planItemOf(stripeSubscription)?.price?.recurring?.interval === "year" ? "year" : "month";
        const { error: ivErr } = await supabase.from("subscriptions").update({ billing_interval: iv }).eq("tenant_id", tenantId);
        if (ivErr) console.error("billing_interval:", ivErr.message);
        // Zusatzmitarbeiter übernehmen
        const { error: seatErr } = await supabase.rpc("set_extra_seats", { p_tenant_id: tenantId, p_seats: seatCountOf(stripeSubscription) });
        if (seatErr) console.error("set_extra_seats:", seatErr.message);
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

    // Abo ist endgültig beendet (nach Kündigung zum Periodenende oder sofort)
    if (event.type === "customer.subscription.deleted") {
      const subscription = event.data.object as Stripe.Subscription;
      const endedAt =
        (subscription as any).ended_at ??
        subscription.items?.data?.[0]?.current_period_end ??
        Math.floor(Date.now() / 1000);
      const { error: delErr } = await supabase
        .from("subscriptions")
        .update({ status: "canceled", expires_at: new Date(endedAt * 1000).toISOString() })
        .eq("stripe_subscription_id", subscription.id);
      if (delErr) throw delErr;
      const { error: flagErr } = await supabase
        .from("subscriptions")
        .update({ cancel_at_period_end: false, cancel_at: new Date(endedAt * 1000).toISOString() })
        .eq("stripe_subscription_id", subscription.id);
      if (flagErr) console.error("cancel flags:", flagErr.message);
      console.log("=== SUBSCRIPTION DELETED ===", subscription.id);
    }

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
              planItemOf(subscription)?.price?.id ?? null,

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

      // Kündigung vorgemerkt / zurückgenommen (Spalten ab Update „Abo-Kündigung“ – Fehler nur protokollieren)
      {
        const cancelAt = subscription.cancel_at ?? (subscription.cancel_at_period_end ? currentPeriodEnd : null);
        const { error: cancelErr } = await supabase
          .from("subscriptions")
          .update({
            cancel_at_period_end: !!subscription.cancel_at_period_end || !!subscription.cancel_at,
            cancel_at: cancelAt ? new Date(cancelAt * 1000).toISOString() : null,
          })
          .eq("stripe_subscription_id", subscription.id);
        if (cancelErr) console.error("cancel_at_period_end:", cancelErr.message);
      }

      // Tarif nachziehen, falls der Preis in Stripe geändert wurde (z. B. über das Kundenportal)
      const newPriceId = planItemOf(subscription)?.price?.id ?? null;
      if (newPriceId && ["active", "trialing", "past_due"].includes(subscription.status)) {
        const { data: row } = await supabase
          .from("subscriptions")
          .select("tenant_id, plan")
          .eq("stripe_subscription_id", subscription.id)
          .maybeSingle();
        if (row) {
          // Monats- und Jahrespreise erkennen (ohne SQL-Update nur Monatspreise wie bisher)
          let found: { plan: string; billing_interval: string } | null = null;
          const { data: hit, error: hitErr } = await supabase.rpc("get_plan_for_stripe_price", { p_price_id: newPriceId });
          if (!hitErr && Array.isArray(hit) && hit[0]) {
            found = hit[0];
          } else {
            for (const p of ["starter", "professional", "business", "enterprise"]) {
              const { data: pid } = await supabase.rpc("get_stripe_price_id_for_plan", { p_plan: p });
              if (pid === newPriceId) {
                found = { plan: p, billing_interval: "month" };
                break;
              }
            }
          }
          if (found) {
            if (row.plan !== found.plan) {
              const { error: actErr } = await supabase.rpc("activate_subscription_plan", { p_tenant_id: row.tenant_id, p_plan: found.plan });
              if (actErr) throw actErr;
            }
            const { error: ivErr } = await supabase
              .from("subscriptions")
              .update({ billing_interval: found.billing_interval })
              .eq("stripe_subscription_id", subscription.id);
            if (ivErr) console.error("billing_interval:", ivErr.message);
          }
          // Zusatzmitarbeiter nachziehen (z. B. geändert über Stripe)
          const { error: seatErr } = await supabase.rpc("set_extra_seats", { p_tenant_id: row.tenant_id, p_seats: seatCountOf(subscription) });
          if (seatErr) console.error("set_extra_seats:", seatErr.message);
        }
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