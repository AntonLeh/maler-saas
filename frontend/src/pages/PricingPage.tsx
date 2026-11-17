import React, { useState } from "react";
import { showConfirm } from "../lib/dialogs";
import { euro, monthlyEquivalent, planPriceFor, type BillingInterval } from "../lib/prices";

type PricingPageProps = {
  currentPlan?: string;
  isTrial?: boolean;
  subscriptionStatus?: string;
  /** aktuelle Abrechnungsart des bezahlten Abos */
  currentInterval?: BillingInterval;
  onBack: () => void;
  onUpgrade?: (plan: string, interval: BillingInterval) => Promise<void>;
};

const plans = [
  {
    id: "starter",
    name: "Starter",
    price: "79 €",
    color: "#6b7280",
    features: [
      "Bis 3 Mitarbeiter",
      "Kundenverwaltung",
      "Auftragsverwaltung",
      "Angebote & Rechnungen",
      "Buchhaltung: Belege, Umsatzsteuer, offene Posten",
      "E-Rechnung (ZUGFeRD & XRechnung)",
      "Zeiterfassung",
      "PWA App",
      "Fortschrittsnotizen",
      "Basis-Support",
    ],
  },

  {
    id: "professional",
    name: "Professional",
    price: "149 €",
    color: "#2563eb",
    recommended: true,
    features: [
      "Bis 8 Mitarbeiter",
      "Alles aus Starter",
      "Kundenportal",
      "Materialverwaltung",
      "Projektleiter",
      "Bilder & Baudokumentation",
      "Premium-Support",
    ],
  },

  {
    id: "business",
    name: "Business",
    price: "399 €",
    color: "#d97706",
    features: [
  "Bis 20 Mitarbeiter",
  "Alles aus Professional",
  "KPI & Reports",
  "Erweiterte Auswertungen",
  "Mitarbeiter-Bewertungssystem",
  "Leistungs- & Umsatzstatistiken",
  "KI-Telefonassistent (Minuten zubuchbar)",
  "KI-Belegerkennung",
  "Abschlagsrechnungen",
  "API-Zugriff",
  "Mehr Speicherplatz",
  "Prioritäts-Support",
],
  },

  {
    id: "enterprise",
    name: "Enterprise",
    price: "799 €",
    color: "#7c3aed",
    features: [
  "Ab 21 Mitarbeiter",
  "Alles aus Business",
  "Eigene Firmen-Website mit eigener Domain",
  "Online-Terminbuchung für Besichtigungen",
  "Stellenanzeigen & Bewerbungen („Wir stellen ein“)",
  "Fachkräfte-Pool: Maler & Subunternehmer finden",
  "KI-Chatassistent auf der Website",
  "KI-Schreibhilfe für Website-Texte",
  "Individuelle Unternehmensanpassungen",
  "Persönlicher Premium-Support",
],
  },
];

export default function PricingPage({
  currentPlan,
  isTrial = false,
  subscriptionStatus,
  currentInterval = "month",
  onBack,
  onUpgrade,
}: PricingPageProps) {
  const [interval, setInterval] = useState<BillingInterval>(currentInterval);
  const order = ["starter", "professional", "business", "enterprise"];
  // Rückmeldung nach dem Klick, bis die Stripe-Seite geladen ist (dauert einige Sekunden)
  const [busyPlan, setBusyPlan] = useState<string | null>(null);
  return (
  <section className="single-page-section">
    <style>{`
      .pricing-interval { display: inline-flex; gap: 4px; padding: 4px; margin: 0 0 18px; border-radius: 999px; background: #eef2f7; border: 1px solid #dbe3ee; }
      .pricing-interval button { border: 0; background: transparent; padding: 9px 18px; border-radius: 999px; font-weight: 700; color: #475569; cursor: pointer; }
      .pricing-interval button.on { background: #fff; color: #0f172a; box-shadow: 0 2px 8px rgba(15, 23, 42, 0.12); }
      .pricing-interval small { margin-left: 6px; font-size: 12px; font-weight: 800; color: #15803d; }
      .pricing-locked { margin: 8px 0 0; font-size: 13px; color: #64748b; line-height: 1.5; }
    `}</style>
    <div className="page-topbar">
      <div>
        <h1>Preise & Pläne</h1>
        <p>Wählen Sie den passenden Plan für Ihren Betrieb.</p>
      </div>

      <button type="button" className="btn btn-secondary" onClick={onBack}>
        Zurück zum Dashboard
      </button>
    </div>

    <div className="pricing-interval" role="radiogroup" aria-label="Abrechnung">
      <button type="button" role="radio" aria-checked={interval === "month"} className={interval === "month" ? "on" : ""} onClick={() => setInterval("month")}>
        Monatlich
      </button>
      <button type="button" role="radio" aria-checked={interval === "year"} className={interval === "year" ? "on" : ""} onClick={() => setInterval("year")}>
        Jährlich <small>2 Monate geschenkt</small>
      </button>
    </div>

    <div className="pricing-grid">
      {plans.map((plan) => {
        const isTrialingNow = isTrial || subscriptionStatus === "trialing";
        const isCurrent =
  currentPlan?.toLowerCase() === plan.id &&
  ["active", "trialing"].includes(subscriptionStatus ?? "") &&
  (isTrialingNow || currentInterval === interval);
        const paidYearly = subscriptionStatus === "active" && !isTrialingNow && currentInterval === "year";
        // im Jahresabo nur größerer Tarif, weiterhin jährlich
        const lockedByYear =
          paidYearly && (interval === "month" || order.indexOf(plan.id) <= order.indexOf(currentPlan ?? ""));
        const price = planPriceFor(plan.id, interval);
        const isTrialing =
  isTrial || subscriptionStatus === "trialing";

const canActivateCurrentTrialPlan =
  isCurrent && isTrialing;
        return (
          <div
            key={plan.id}
            className={`card pricing-card ${plan.recommended ? "pricing-card-recommended" : ""}`}
            style={{ borderColor: plan.color }}
          >
            {plan.recommended && (
              <div className="pricing-badge">
                EMPFOHLEN
              </div>
            )}

            <h2>{plan.name}</h2>

            <div className="pricing-price" style={{ color: plan.color }}>
              {euro(price)}
              <span>{interval === "year" ? "/Jahr" : "/Monat"}</span>
            </div>
            <div style={{ fontSize: "0.85rem", color: "#6b7280", marginTop: "-4px", marginBottom: "8px" }}>
              {interval === "year"
                ? `netto, zzgl. MwSt. · entspricht ${euro(monthlyEquivalent(plan.id, "year"))} im Monat`
                : "netto, zzgl. MwSt."}
            </div>

            <div className="pricing-features">
              {plan.features.map((feature) => (
                <div key={feature}>✅ {feature}</div>
              ))}
            </div>

            {isCurrent && !canActivateCurrentTrialPlan ? (
  <button type="button" className="btn btn-secondary" disabled>
    Aktueller Plan
  </button>
) : lockedByYear ? (
  <p className="pricing-locked">Während Ihres Jahresabos ab Laufzeitende möglich – schreiben Sie uns an info@maler-saas.com.</p>
) : (
  <button
  type="button"
  className="btn btn-primary"
  onClick={async () => {
    // Bezahltes Abo: Tarif wird umgestellt (anteilige Verrechnung durch Stripe)
    const paid = subscriptionStatus === "active" && !isTrialing;
    if (paid && currentPlan && (currentPlan !== plan.id || currentInterval !== interval)) {
      const down = order.indexOf(plan.id) < order.indexOf(currentPlan);
      const loseWebsite = currentPlan === "enterprise" && plan.id !== "enterprise";
      const label = `${euro(price)}/${interval === "year" ? "Jahr" : "Monat"} netto`;
      const text =
        `Ihren Tarif auf ${plan.name}${interval === "year" ? " jährlich" : ""} (${label}) umstellen?\n\n` +
        (interval === "year"
          ? "Die Umstellung gilt sofort. Der Jahresbetrag wird abzüglich des bereits bezahlten Anteils sofort abgerechnet. Die Laufzeit beträgt 12 Monate."
          : `Die Umstellung gilt sofort. Die Differenz wird anteilig mit der nächsten Rechnung verrechnet${down ? " (Gutschrift)" : ""}.`) +
        (loseWebsite ? "\n\nAchtung: Firmen-Website, KI-Chat, Online-Terminbuchung, Stellenanzeigen und Fachkräfte-Pool gibt es nur in Enterprise – Ihre Website geht dann offline (die Inhalte bleiben gespeichert)." : "");
      if (!(await showConfirm(text, { title: "Tarif umstellen?", confirmLabel: `Ja, auf ${plan.name} umstellen`, danger: loseWebsite }))) return;
    } else if (interval === "year") {
      const ok = await showConfirm(
        `${plan.name} jährlich buchen: ${euro(price)} netto für 12 Monate, im Voraus fällig.\n\nDer Vertrag verlängert sich um weitere 12 Monate, wenn er nicht bis zum Ende der Laufzeit gekündigt wird. Bei vorzeitiger Kündigung erfolgt keine anteilige Erstattung.`,
        { title: "Jahresabo buchen?", confirmLabel: "Weiter zur Bezahlung" },
      );
      if (!ok) return;
    }
    setBusyPlan(plan.id);
    // nach dem Neuzeichnen starten, damit „Wird geöffnet …“ sofort sichtbar ist
    window.setTimeout(() => {
      Promise.resolve(onUpgrade?.(plan.id, interval)).finally(() => window.setTimeout(() => setBusyPlan(null), 8000));
    }, 0);
  }}
  disabled={busyPlan !== null}
>
  {busyPlan === plan.id
    ? "Wird geöffnet …"
    : canActivateCurrentTrialPlan
      ? `${plan.name} jetzt aktivieren`
      : subscriptionStatus === "active" && !isTrialing && currentPlan && (currentPlan !== plan.id || currentInterval !== interval)
        ? currentPlan === plan.id ? "Auf jährlich umstellen" : `Zu ${plan.name} wechseln`
        : "Plan wählen"}
</button>
)}
          </div>
        );
      })}
    </div>
  </section>
);
}