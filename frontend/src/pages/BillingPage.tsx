import React from "react";
import { supabase } from "../lib/supabase";

type Subscription = {
  plan: string;
  status: string;
  monthly_price?: number;
  currency?: string;
  is_trial?: boolean;
  trial_ends_at?: string | null;
  stripe_customer_id?: string | null;
  stripe_subscription_id?: string | null;
};

type BillingPageProps = {
  subscription: Subscription | null;
  onBack: () => void;
  onOpenPricing: () => void;
};

const formatDate = (value?: string | null) => {
  if (!value) return "-";
  return new Date(value).toLocaleDateString("de-DE");
};

export default function BillingPage({
  subscription,
  onBack,
  onOpenPricing,
}: BillingPageProps) {
  return (
    <section className="single-page-section">
      <div className="page-topbar">
        <div>
          <h1 style={{ fontSize: "24px" }}>
  Abrechnung & Abo
</h1>
          <p>Verwalten Sie Ihren aktuellen Tarif und Ihre Zahlungsdaten.</p>
        </div>

        <button type="button" className="btn btn-secondary" onClick={onBack}>
          Zurück
        </button>
      </div>

      <div className="card" style={{ marginTop: "24px" }}>
        <h2>Aktueller Tarif</h2>

        <p>
          <strong>Plan:</strong>{" "}
          {subscription?.plan ? subscription.plan.toUpperCase() : "-"}
        </p>

        <p>
          <strong>Status:</strong> {subscription?.status || "-"}
        </p>

        <p>
          <strong>Preis:</strong>{" "}
          {subscription?.monthly_price
            ? `${subscription.monthly_price} ${subscription.currency || "CHF"} / Monat`
            : "-"}
        </p>

        <p>
          <strong>Trial:</strong>{" "}
          {subscription?.is_trial ? "Ja" : "Nein"}
        </p>

        <p>
          <strong>Trial endet:</strong>{" "}
          {formatDate(subscription?.trial_ends_at)}
        </p>

        <p>
          <strong>Stripe Kunde:</strong>{" "}
          {subscription?.stripe_customer_id ? "vorhanden" : "noch nicht vorhanden"}
        </p>

        <p>
          <strong>Stripe Abo:</strong>{" "}
          {subscription?.stripe_subscription_id ? "aktiv/verknüpft" : "noch nicht verknüpft"}
        </p>

        <div style={{ display: "flex", gap: "12px", flexWrap: "wrap", marginTop: "22px" }}>
          <button type="button" className="btn btn-primary" onClick={onOpenPricing}>
            Tarif ändern
          </button>

          <button
  type="button"
  className="btn btn-secondary"
  onClick={async () => {
    const { data, error } =
      await supabase.functions.invoke(
        "create-stripe-portal-session"
      );

    if (error) {
      console.error(
        "Stripe Portal Fehler:",
        error
      );

      alert(
        "Stripe Kundenportal konnte nicht geöffnet werden."
      );

      return;
    }

    if (!data?.url) {
      alert(
        "Keine Portal-URL erhalten."
      );

      return;
    }

    window.location.href = data.url;
  }}
>
  Zahlungsdaten & Rechnungen
</button>
        </div>
      </div>
    </section>
  );
}