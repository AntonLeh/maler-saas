// @ts-nocheck
// =====================================================================
// KI-Telefon – Einrichtung und Minutenpakete über Stripe
//
//   POST ?action=checkout   (eingeloggter Admin, Authorization: Bearer <Supabase-Token>)
//        Body: { "package": "setup" | "m300" | "m1000" }  ->  { url }  (Stripe Checkout)
//   POST ?action=webhook    (Stripe, eigener Webhook-Endpunkt, Signatur STRIPE_AI_WEBHOOK_SECRET)
//        checkout.session.completed mit metadata.kind = "ai_minutes"  ->  Guthaben buchen
//
// Secrets:
//   STRIPE_SECRET_KEY            (vorhanden)
//   STRIPE_AI_WEBHOOK_SECRET     Signatur-Secret des neuen Webhook-Endpunkts
//   STRIPE_PRICE_AI_SETUP        Preis-ID Einrichtung (49 € netto, einmalig)
//   STRIPE_PRICE_AI_300          Preis-ID 300 Minuten (45 € netto)
//   STRIPE_PRICE_AI_1000         Preis-ID 1.000 Minuten (135 € netto)
// Optional:
//   STRIPE_AUTOMATIC_TAX=true    Stripe Tax für die Mehrwertsteuer verwenden
//
// Deploy:  npx supabase functions deploy ai-phone-billing --no-verify-jwt
// =====================================================================

import { serve } from "https://deno.land/std@0.224.0/http/server.ts";
import Stripe from "https://esm.sh/stripe@14.25.0?target=deno";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.45.4";

export const PACKAGES = {
  setup: { priceEnv: "STRIPE_PRICE_AI_SETUP", minutes: 300, net: 49, reason: "einrichtung", setup: true, label: "Einrichtung KI-Telefon inkl. 300 Minuten" },
  m300: { priceEnv: "STRIPE_PRICE_AI_300", minutes: 300, net: 45, reason: "kauf", setup: false, label: "300 Minuten KI-Telefon" },
  m1000: { priceEnv: "STRIPE_PRICE_AI_1000", minutes: 1000, net: 135, reason: "kauf", setup: false, label: "1.000 Minuten KI-Telefon" },
} as const;

const ALLOWED_PLANS = ["business", "enterprise"];
const ALLOWED_STATUS = ["active", "trialing"];

const HEADERS = {
  "content-type": "application/json; charset=utf-8",
  "access-control-allow-origin": "*",
  "access-control-allow-headers": "authorization, x-client-info, apikey, content-type",
};
const json = (data: unknown, status = 200) => new Response(JSON.stringify(data), { status, headers: HEADERS });

const db = createClient(Deno.env.get("SUPABASE_URL")!, Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!, {
  auth: { persistSession: false },
});

function stripeClient() {
  const key = Deno.env.get("STRIPE_SECRET_KEY");
  if (!key) throw new Error("STRIPE_SECRET_KEY fehlt.");
  return new Stripe(key, { apiVersion: "2024-06-20" });
}

/**
 * Stripe-Kunde nur verwenden, wenn es ihn im aktuellen Modus (live/test) gibt.
 * Test-Betriebe haben teils eine Kunden-ID aus dem Testmodus oder einen gelöschten Kunden.
 */
async function existingCustomer(id: string | null | undefined): Promise<string | null> {
  if (!id) return null;
  try {
    const c: any = await stripeClient().customers.retrieve(id);
    return c && !c.deleted ? id : null;
  } catch (e: any) {
    if (e?.code === "resource_missing" || e?.statusCode === 404) return null;
    throw e;
  }
}

// ---------------------------------------------------------------------
// Checkout starten
// ---------------------------------------------------------------------
async function handleCheckout(req: Request): Promise<Response> {
  const token = (req.headers.get("authorization") ?? "").replace(/^Bearer\s+/i, "");
  const { data: authData } = token ? await db.auth.getUser(token) : { data: null };
  if (!authData?.user) return json({ error: "Nicht angemeldet." }, 401);

  const { data: user } = await db
    .from("app_users")
    .select("id, tenant_id, role_id, email")
    .eq("auth_user_id", authData.user.id)
    .maybeSingle();
  if (!user || ![1, 2].includes(Number(user.role_id))) return json({ error: "Nur Admins dürfen kaufen." }, 403);

  const body = await req.json().catch(() => ({}));
  const key = String(body?.package ?? "");
  const pkg = PACKAGES[key as keyof typeof PACKAGES];
  if (!pkg) return json({ error: "Unbekanntes Paket." }, 400);

  const { data: sub } = await db
    .from("subscriptions")
    .select("plan, status, stripe_customer_id")
    .eq("tenant_id", user.tenant_id)
    .order("id", { ascending: false })
    .limit(1)
    .maybeSingle();
  if (!sub || !ALLOWED_PLANS.includes(String(sub.plan)) || !ALLOWED_STATUS.includes(String(sub.status))) {
    return json({ error: "Das KI-Telefon ist nur im Business-Tarif verfügbar." }, 403);
  }

  const { data: billing } = await db.from("ai_phone_billing").select("setup_paid_at").eq("tenant_id", user.tenant_id).maybeSingle();
  if (pkg.setup && billing?.setup_paid_at) return json({ error: "Die Einrichtung ist bereits bezahlt." }, 409);
  if (!pkg.setup && !billing?.setup_paid_at) return json({ error: "Bitte zuerst das KI-Telefon aktivieren." }, 409);

  const priceId = Deno.env.get(pkg.priceEnv);
  if (!priceId) return json({ error: `Preis fehlt: ${pkg.priceEnv} ist nicht hinterlegt.` }, 500);

  const origin = req.headers.get("origin") || Deno.env.get("APP_URL") || "https://maler-saas.com";
  const metadata = { kind: "ai_minutes", tenant_id: String(user.tenant_id), package: key, user_id: String(user.id) };

  const params: Record<string, unknown> = {
    mode: "payment",
    line_items: [{ price: priceId, quantity: 1 }],
    metadata,
    payment_intent_data: { metadata, description: pkg.label },
    invoice_creation: { enabled: true, invoice_data: { description: pkg.label, metadata } },
    success_url: `${origin}/?ki_kauf=erfolg&paket=${key}`,
    cancel_url: `${origin}/?ki_kauf=abbruch`,
  };
  const customerId = await existingCustomer(sub.stripe_customer_id);
  if (customerId) {
    params.customer = customerId;
    params.customer_update = { address: "auto", name: "auto" };
  } else {
    params.customer_email = authData.user.email || user.email;
    params.customer_creation = "always";
  }
  if (Deno.env.get("STRIPE_AUTOMATIC_TAX") === "true") {
    params.automatic_tax = { enabled: true };
    params.tax_id_collection = { enabled: true };
  }

  const session = await stripeClient().checkout.sessions.create(params);
  return json({ url: session.url });
}

// ---------------------------------------------------------------------
// Stripe-Webhook: Guthaben buchen
// ---------------------------------------------------------------------
export async function creditFromSession(session: any): Promise<{ credited: boolean; reason?: string }> {
  if (session?.metadata?.kind !== "ai_minutes") return { credited: false, reason: "not ai_minutes" };
  if (session.payment_status !== "paid") return { credited: false, reason: "not paid" };
  const tenantId = Number(session.metadata.tenant_id);
  const pkg = PACKAGES[session.metadata.package as keyof typeof PACKAGES];
  if (!tenantId || !pkg) throw new Error("tenant_id oder Paket fehlt.");

  const { data, error } = await db.rpc("ai_minutes_apply", {
    p_tenant_id: tenantId,
    p_delta: pkg.minutes * 60,
    p_reason: pkg.reason,
    p_reference: `stripe:${session.id}`,
    p_amount_net: session.amount_subtotal != null ? session.amount_subtotal / 100 : pkg.net,
    p_currency: (session.currency || "eur").toUpperCase(),
    p_setup: pkg.setup,
    p_note: pkg.label,
  });
  if (error) throw error;
  const row = Array.isArray(data) ? data[0] : data;
  return { credited: !!row?.applied };
}

async function handleWebhook(req: Request): Promise<Response> {
  const secret = Deno.env.get("STRIPE_AI_WEBHOOK_SECRET");
  const signature = req.headers.get("stripe-signature");
  if (!secret || !signature) return json({ error: "Signatur fehlt." }, 400);

  const body = await req.text();
  let event;
  try {
    event = await stripeClient().webhooks.constructEventAsync(
      body,
      signature,
      secret,
      undefined,
      Stripe.createSubtleCryptoProvider()
    );
  } catch (e) {
    console.error("Webhook-Signatur ungültig", e);
    return json({ error: "Signatur ungültig." }, 400);
  }

  if (event.type === "checkout.session.completed" || event.type === "checkout.session.async_payment_succeeded") {
    const result = await creditFromSession(event.data.object);
    return json({ received: true, ...result });
  }
  return json({ received: true, ignored: event.type });
}

serve(async (req) => {
  if (req.method === "OPTIONS") return new Response(null, { status: 204, headers: HEADERS });
  try {
    const action = new URL(req.url).searchParams.get("action");
    if (action === "checkout") return await handleCheckout(req);
    if (action === "webhook") return await handleWebhook(req);
    return json({ error: "unknown action" }, 400);
  } catch (e) {
    console.error("ai-phone-billing", e);
    return json({ error: String((e as Error)?.message ?? e) }, 500);
  }
});
