import React from "react";
import { supabase } from "../lib/supabase";

type Subscription = {
  plan: string;
  status: string;
  monthly_price?: number;
  currency?: string;
  is_trial?: boolean;
  trial_ends_at?: string | null;
  current_period_end?: string | null;
  cancel_at_period_end?: boolean;
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

const getStatusLabel = (subscription: Subscription | null) => {
  if (!subscription) return "Kein Tarif aktiv";

  if (subscription.cancel_at_period_end) {
    return "🟡 Kündigung vorgemerkt";
  }

  if (subscription.is_trial || subscription.status === "trialing") {
    return "🟢 Testphase aktiv";
  }

  if (subscription.status === "active") {
    return "🟢 Aktiv";
  }

  if (subscription.status === "past_due") {
    return "🟠 Zahlung ausstehend";
  }

  if (subscription.status === "canceled") {
    return "🔴 Beendet";
  }

  return subscription.status || "-";
};

const getDateLabel = (subscription: Subscription | null) => {
  if (!subscription) return "Laufzeit";

  if (subscription.cancel_at_period_end) {
    return "Nutzbar bis";
  }

  if (subscription.is_trial || subscription.status === "trialing") {
    return "Testphase endet";
  }

  return "Nächste Abrechnung";
};

const getRelevantDate = (subscription: Subscription | null) => {
  if (!subscription) return null;

  if (subscription.is_trial || subscription.status === "trialing") {
    return subscription.trial_ends_at;
  }

  return subscription.current_period_end || subscription.trial_ends_at;
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
          <h1 style={{ fontSize: "24px" }}>Abrechnung & Abo</h1>
          <p>Verwalten Sie Ihren Tarif und Ihre Zahlungsdaten.</p>
        </div>

        <button type="button" className="btn btn-secondary" onClick={onBack}>
          Zurück
        </button>
      </div>

      <div className="card" style={{ marginTop: "24px" }}>
        <h2>Aktueller Tarif</h2>

        <p>
          <strong>{subscription?.plan ? subscription.plan.toUpperCase() : "-"}</strong>
        </p>

        <p>{getStatusLabel(subscription)}</p>

        <p>
          <strong>Preis:</strong>{" "}
          {subscription?.monthly_price
            ? `${subscription.monthly_price} ${subscription.currency || "EUR"} / Monat`
            : "-"}
        </p>

        <p>
          <strong>{getDateLabel(subscription)}:</strong>{" "}
          {formatDate(getRelevantDate(subscription))}
        </p>

        <div
          style={{
            display: "flex",
            gap: "12px",
            flexWrap: "wrap",
            marginTop: "22px",
          }}
        >
          <button type="button" className="btn btn-primary" onClick={onOpenPricing}>
            Tarif ändern
          </button>

          <button
            type="button"
            className="btn btn-secondary"
            onClick={async () => {
              const { data, error } = await supabase.functions.invoke(
                "create-stripe-portal-session"
              );

              if (error) {
                console.error("Stripe Portal Fehler:", error);
                alert("Abo-Verwaltung konnte nicht geöffnet werden.");
                return;
              }

              if (!data?.url) {
                alert("Keine Portal-URL erhalten.");
                return;
              }

              window.location.href = data.url;
            }}
          >
            💳 Abo verwalten
          </button>
        </div>
      </div>
    </section>
  );
}