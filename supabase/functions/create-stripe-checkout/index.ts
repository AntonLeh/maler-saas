// @ts-nocheck

import { serve } from "https://deno.land/std@0.224.0/http/server.ts";
import Stripe from "https://esm.sh/stripe@14.25.0?target=deno";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.45.4";
import { changeError, normInterval, FIRST_YEAR_COUPON, SEAT_PRICES, splitItems, seatsError } from "./rules.ts";

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
    const action = String(body.action || "plan");
    const plan = body.plan;
    const interval = normInterval(body.interval);

    if (action !== "seats") {
      if (!plan) {
        throw new Error("Kein Plan übergeben.");
      }

      if (!["starter", "professional", "business", "enterprise"].includes(plan)) {
        throw new Error("Ungültiger Plan.");
      }
    }

    const { data: appUser, error: appUserError } = await supabase
      .from("app_users")
      .select("tenant_id, email, role_id")
      .eq("auth_user_id", user.id)
      .single();

    if (appUserError || !appUser) {
      throw new Error("App-Benutzer wurde nicht gefunden.");
    }

    // Nur Admins/Inhaber dürfen einen Tarif buchen oder wechseln
    if (![1, 2].includes(Number(appUser.role_id))) {
      return new Response(
        JSON.stringify({ error: "Den Tarif kann nur der Admin bzw. Inhaber Ihres Betriebs buchen oder ändern." }),
        { status: 403, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    const json = (b: unknown, status = 200) =>
      new Response(JSON.stringify(b), { status, headers: { ...corsHeaders, "Content-Type": "application/json" } });

    // =====================================================
    // ZUSATZMITARBEITER (je 19 € im Monat bzw. 190 € im Jahr)
    // =====================================================
    if (action === "seats") {
      const wanted = Number(body.seats);
      const { data: sub } = await supabase
        .from("subscriptions")
        .select("plan, status, stripe_subscription_id")
        .eq("tenant_id", appUser.tenant_id)
        .order("id", { ascending: false })
        .limit(1)
        .maybeSingle();
      if (!sub || !["active", "trialing", "past_due"].includes(String(sub.status))) throw new Error("SEATS_KEIN_ABO");
      const { count: used } = await supabase
        .from("app_users")
        .select("id", { count: "exact", head: true })
        .eq("tenant_id", appUser.tenant_id)
        .eq("is_active", true)
        .eq("app_access", true)
        .in("role_id", [3, 4]);
      const sErr = seatsError(String(sub.plan), wanted, Number(used || 0));
      if (sErr) throw new Error(sErr);

      let stripeSub = null;
      if (sub.stripe_subscription_id) {
        try {
          stripeSub = await stripe.subscriptions.retrieve(sub.stripe_subscription_id);
        } catch (_e) {
          stripeSub = null;
        }
      }
      if (stripeSub && ["active", "trialing", "past_due"].includes(stripeSub.status)) {
        // bezahltes Abo: Zusatzplätze als eigene Position, anteilig abgerechnet
        const { plan: planItem, seats: seatItem } = splitItems(stripeSub.items?.data ?? []);
        if (!planItem) throw new Error("Das bestehende Abo hat keine Position.");
        const iv = planItem.price?.recurring?.interval === "year" ? "year" : "month";
        const items = seatItem
          ? wanted > 0
            ? [{ id: seatItem.id, quantity: wanted }]
            : [{ id: seatItem.id, deleted: true }]
          : wanted > 0
            ? [{ price: SEAT_PRICES[iv], quantity: wanted }]
            : [];
        if (items.length) {
          await stripe.subscriptions.update(stripeSub.id, {
            items,
            // Jahresabo: Mehrbetrag sofort abrechnen; monatlich: mit der nächsten Rechnung
            proration_behavior: iv === "year" ? "always_invoice" : "create_prorations",
          });
        }
      } else if (sub.status !== "trialing") {
        throw new Error("SEATS_KEIN_ABO");
      }
      // Testphase: Plätze gelten sofort, bezahlt wird mit der Buchung des Tarifs
      const { error: seatErr } = await supabase.rpc("set_extra_seats", { p_tenant_id: appUser.tenant_id, p_seats: wanted });
      if (seatErr) throw seatErr;
      return json({ ok: true, seats: wanted });
    }

    const { data: priceId, error: priceError } = await supabase.rpc(
      "get_stripe_price_id_for_plan_interval",
      {
        p_plan: plan,
        p_interval: interval,
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
      .select("plan, status, stripe_subscription_id, extra_seats")
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
        const { plan: item, seats: seatItem } = splitItems(stripeSub.items?.data ?? []);
        if (!item) throw new Error("Das bestehende Abo hat keine Position.");
        const curInterval = item.price?.recurring?.interval === "year" ? "year" : "month";
        const err = changeError({ plan: String(currentSub.plan), interval: curInterval }, { plan, interval });
        if (err) throw new Error(err);
        const items: Record<string, unknown>[] = [{ id: item.id, price: priceId }];
        // Zusatzplätze müssen dieselbe Abrechnungsart haben wie der Tarif
        if (seatItem && curInterval !== interval) items.push({ id: seatItem.id, price: SEAT_PRICES[interval] });
        const hasDiscount = !!(stripeSub.discount || (stripeSub.discounts && stripeSub.discounts.length));
        await stripe.subscriptions.update(stripeSub.id, {
          items,
          // Wechsel ins Jahresabo bzw. Upgrade im Jahresabo: Differenz sofort abrechnen (nicht erst in einem Jahr)
          proration_behavior: interval === "year" ? "always_invoice" : "create_prorations",
          // Wechsel von monatlich auf jährlich: Einführungsrabatt aufs erste Jahresabo
          ...(curInterval === "month" && interval === "year" && !hasDiscount ? { coupon: FIRST_YEAR_COUPON } : {}),
          metadata: { tenant_id: String(appUser.tenant_id), plan, interval },
        });
        const { error: activateError } = await supabase.rpc("activate_subscription_plan", {
          p_tenant_id: appUser.tenant_id,
          p_plan: plan,
        });
        if (activateError) throw activateError;
        await supabase.from("subscriptions").update({ stripe_price_id: priceId }).eq("tenant_id", appUser.tenant_id);
        // eigenes Update: funktioniert auch, falls die Spalte noch fehlt (SQL noch nicht ausgeführt)
        await supabase.from("subscriptions").update({ billing_interval: interval }).eq("tenant_id", appUser.tenant_id);
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
        // in der Testphase eingetragene Zusatzplätze
        ...(Number(currentSub?.extra_seats || 0) > 0
          ? [{ price: SEAT_PRICES[interval], quantity: Number(currentSub.extra_seats) }]
          : []),
      ],

      // Jährlich: Einführungsrabatt aufs erste Jahr automatisch; monatlich: Feld für Rabattcodes
      ...(interval === "year"
        ? { discounts: [{ coupon: FIRST_YEAR_COUPON }] }
        : { allow_promotion_codes: true }),

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
        interval,
      },

      subscription_data: {
        metadata: {
          tenant_id: String(appUser.tenant_id),
          plan,
          interval,
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
      SEATS_UNGUELTIG: "Bitte eine gültige Anzahl zusätzlicher Mitarbeiter wählen.",
      SEATS_BELEGT:
        "So wenige Plätze reichen nicht: Es haben mehr Mitarbeiter einen App-Zugang. Entziehen Sie zuerst einzelnen Mitarbeitern den Zugang (unter „Mitarbeiter“).",
      SEATS_KEIN_ABO: "Zusätzliche Mitarbeiter können Sie in der Testphase oder mit einem gebuchten Tarif hinzufügen.",
      JAHRESABO_WECHSEL:
        "Während eines Jahresabos ist nur ein Wechsel in einen größeren Tarif möglich. Ein kleinerer Tarif oder die monatliche Abrechnung gilt ab dem Ende der Laufzeit – schreiben Sie uns dafür an info@maler-saas.com.",
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