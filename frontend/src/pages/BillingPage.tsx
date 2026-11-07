import React, { useEffect, useState } from "react";
import { supabase } from "../lib/supabase";
import { showAlert } from "../lib/dialogs";
import DataExportSection from "../modules/export/DataExportSection";

type Subscription = {
  plan: string;
  status: string;
  monthly_price?: number;
  currency?: string;
  is_trial?: boolean;
  trial_ends_at?: string | null;
  expires_at?: string | null;
  cancel_at_period_end?: boolean;
  cancel_at?: string | null;
  stripe_subscription_id?: string | null;
};

type BillingPageProps = {
  subscription: Subscription | null;
  onBack: () => void;
  onOpenPricing: () => void;
  tenantId?: number | null;
  country?: string | null;
  currencySymbol?: string | null;
};

const DAY = 86400000;
const dateOnly = (v?: string | null) => (v ? new Date(v).toLocaleDateString("de-DE", { day: "2-digit", month: "2-digit", year: "numeric" }) : "-");
const plus30 = (v?: string | null) => (v ? new Date(new Date(v).getTime() + 30 * DAY).toISOString() : null);

/** Hinweis zu Vertragsende und Löschung (AGB Punkt 21) */
function endNotice(s: Subscription | null): { tone: "warn" | "info" | "danger"; text: string; undo?: boolean } | null {
  if (!s) return null;
  const ended = ["canceled", "cancelled", "expired", "unpaid"].includes(s.status);
  if (ended) {
    const end = s.expires_at || s.cancel_at;
    return {
      tone: "danger",
      text: `Ihr Abo ist am ${dateOnly(end)} beendet. Ihre Daten bleiben bis zum ${dateOnly(plus30(end))} erhalten und werden danach endgültig gelöscht. Sichern Sie sie vorher unten mit „Alle Daten exportieren“ – oder schließen Sie unter „Tarif ändern“ ein neues Abo ab.`,
    };
  }
  if (s.cancel_at_period_end) {
    const end = s.cancel_at || s.expires_at;
    return {
      tone: "warn",
      text: `Ihr Abo ist gekündigt und endet am ${dateOnly(end)}. Bis dahin können Sie alles wie gewohnt nutzen. Danach bleiben Ihre Daten noch 30 Tage erhalten und werden am ${dateOnly(plus30(end))} gelöscht. Sie haben es sich anders überlegt? Dann nehmen Sie die Kündigung einfach zurück.`,
      undo: true,
    };
  }
  if ((s.is_trial || s.status === "trialing") && !s.stripe_subscription_id && s.trial_ends_at) {
    const left = Math.ceil((new Date(s.trial_ends_at).getTime() - Date.now()) / DAY);
    return left > 0
      ? { tone: "info", text: `Ihre kostenlose Testphase endet am ${dateOnly(s.trial_ends_at)}. Es verlängert sich nichts automatisch. Wenn Sie weitermachen möchten, wählen Sie unter „Tarif ändern“ ein Abo.` }
      : {
          tone: "danger",
          text: `Ihre Testphase ist am ${dateOnly(s.trial_ends_at)} abgelaufen. Ohne Abo werden Ihre Daten am ${dateOnly(plus30(s.trial_ends_at))} gelöscht. Sichern Sie sie vorher unten mit „Alle Daten exportieren“ – oder wählen Sie unter „Tarif ändern“ ein Abo.`,
        };
  }
  return null;
}

const formatDate = (value?: string | null) => {
  if (!value) return "-";

  return (
    new Date(value).toLocaleString("de-DE", {
      day: "2-digit",
      month: "2-digit",
      year: "numeric",
      hour: "2-digit",
      minute: "2-digit",
    }) + " Uhr"
  );
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

  if (["canceled", "cancelled", "expired"].includes(subscription.status)) {
    return "🔴 Beendet";
  }

  return subscription.status || "-";
};

const getDateLabel = (subscription: Subscription | null) => {
  if (!subscription) return "Laufzeit";

  if (subscription.cancel_at_period_end) {
    return "Nutzbar bis";
  }

  if (["canceled", "cancelled", "expired"].includes(subscription.status)) {
    return "Beendet am";
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

  return subscription.expires_at || subscription.trial_ends_at;
};

export default function BillingPage({
  subscription,
  onBack,
  onOpenPricing,
  tenantId,
  country,
  currencySymbol,
}: BillingPageProps) {
  // genaue Abo-Angaben (Kündigung vorgemerkt, Stripe-Abo vorhanden) – vor dem Datenbank-Update einfach die bisherigen
  const [billing, setBilling] = useState<Partial<Subscription> | null>(null);
  useEffect(() => {
    supabase.rpc("get_my_billing_status").then(({ data, error }) => {
      const row = Array.isArray(data) ? data[0] : data;
      if (!error && row) setBilling({ ...row, stripe_subscription_id: row.has_stripe_subscription ? "vorhanden" : null });
    });
  }, []);
  const sub: Subscription | null = subscription ? { ...subscription, ...(billing ?? {}) } : null;
  const hasStripe = billing ? !!billing.stripe_subscription_id : true;
  const notice = endNotice(sub);
  const openPortal = async () => {
              // frische Anmeldung mitschicken und die genaue Meldung des Servers anzeigen
              const { data: fresh } = await supabase.auth.refreshSession();
              const accessToken = fresh.session?.access_token ?? (await supabase.auth.getSession()).data.session?.access_token;
              if (!accessToken) {
                await showAlert("Ihre Anmeldung ist abgelaufen. Bitte melden Sie sich neu an.", { tone: "error", title: "Das hat nicht geklappt" });
                return;
              }
              const { data, error } = await supabase.functions.invoke("create-stripe-portal-session", {
                headers: { Authorization: `Bearer ${accessToken}` },
              });

              if (error) {
                console.error("Stripe Portal Fehler:", error);
                let detail = "";
                try {
                  const ctx = (error as { context?: Response }).context;
                  const body = ctx ? await ctx.json() : null;
                  detail = body?.error ? String(body.error) : "";
                } catch {
                  /* keine Details */
                }
                await showAlert(detail || "Abo-Verwaltung konnte nicht geöffnet werden.", { tone: "error", title: "Abo-Verwaltung nicht möglich" });
                return;
              }

              if (!data?.url) {
                await showAlert("Keine Portal-URL erhalten.");
                return;
              }

              window.location.href = data.url;
            };
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

        <p>{getStatusLabel(sub)}</p>

        <p>
          <strong>Preis:</strong>{" "}
          {subscription?.monthly_price
            ? `${subscription.monthly_price} ${subscription.currency || "EUR"} / Monat`
            : "-"}
        </p>

        <p>
          <strong>{getDateLabel(sub)}:</strong>{" "}
          {formatDate(getRelevantDate(sub))}
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

          {hasStripe && (
          <button
            type="button"
            className="btn btn-secondary"
            onClick={openPortal}
          >
            💳 Abo verwalten oder kündigen
          </button>
          )}
        </div>
        {hasStripe && <p style={{ margin: "10px 0 0", color: "#64748b", fontSize: 14 }}>
          Über „Abo verwalten“ öffnet sich das sichere Kundenportal unseres Zahlungsanbieters Stripe: Zahlungsart ändern, Rechnungen
          herunterladen oder das Abo zum Ende des Abrechnungszeitraums kündigen.
        </p>}

        {notice && (
          <div
            style={{
              marginTop: 18,
              padding: "12px 14px",
              borderRadius: 10,
              border: `1px solid ${notice.tone === "danger" ? "#fecaca" : notice.tone === "warn" ? "#fde68a" : "#c7d2fe"}`,
              background: notice.tone === "danger" ? "#fef2f2" : notice.tone === "warn" ? "#fffbeb" : "#eef2ff",
              color: "#1e293b",
            }}
          >
            {notice.text}
            {notice.undo && (
              <div style={{ marginTop: 10 }}>
                <button type="button" className="btn btn-primary" onClick={openPortal}>
                  Kündigung zurücknehmen
                </button>
              </div>
            )}
          </div>
        )}
      </div>

      <div className="card" style={{ marginTop: "24px" }}>
        <h2>Vor einer Kündigung: Daten sichern</h2>
        <p style={{ color: "#475569" }}>
          Nach Vertragsende bleiben Ihre Daten noch 30 Tage erhalten und werden danach endgültig gelöscht (AGB Punkt 21). Laden Sie
          vorher alle Daten herunter – Rechnungen und Belege müssen Sie gesetzlich aufbewahren.
        </p>
        {tenantId ? (
          <DataExportSection tenantId={tenantId} country={country ?? "Deutschland"} currencySymbol={currencySymbol ?? "€"} compact />
        ) : null}
      </div>
    </section>
  );
}