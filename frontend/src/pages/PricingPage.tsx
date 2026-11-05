import React, { useState } from "react";

type PricingPageProps = {
  currentPlan?: string;
  isTrial?: boolean;
  subscriptionStatus?: string;
  onBack: () => void;
  onUpgrade?: (plan: string) => Promise<void>;
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
  onBack,
  onUpgrade,
}: PricingPageProps) {
  // Rückmeldung nach dem Klick, bis die Stripe-Seite geladen ist (dauert einige Sekunden)
  const [busyPlan, setBusyPlan] = useState<string | null>(null);
  return (
  <section className="single-page-section">
    <div className="page-topbar">
      <div>
        <h1>Preise & Pläne</h1>
        <p>Wählen Sie den passenden Plan für Ihren Betrieb.</p>
      </div>

      <button type="button" className="btn btn-secondary" onClick={onBack}>
        Zurück zum Dashboard
      </button>
    </div>

    <div className="pricing-grid">
      {plans.map((plan) => {
        const isCurrent =
  currentPlan?.toLowerCase() === plan.id &&
  ["active", "trialing"].includes(subscriptionStatus ?? "");
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
              {plan.price}
              <span>/Monat</span>
            </div>
            <div style={{ fontSize: "0.85rem", color: "#6b7280", marginTop: "-4px", marginBottom: "8px" }}>
              netto, zzgl. MwSt.
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
) : (
  <button
  type="button"
  className="btn btn-primary"
  onClick={() => {
    // Bezahltes Abo: Tarif wird umgestellt (anteilige Verrechnung durch Stripe)
    const paid = subscriptionStatus === "active" && !isTrialing;
    if (paid && currentPlan && currentPlan !== plan.id) {
      const order = ["starter", "professional", "business", "enterprise"];
      const down = order.indexOf(plan.id) < order.indexOf(currentPlan);
      const loseWebsite = currentPlan === "enterprise" && plan.id !== "enterprise";
      const text =
        `Ihren Tarif auf ${plan.name} (${plan.price}/Monat netto) umstellen?\n\n` +
        `Die Umstellung gilt sofort. Die Differenz wird anteilig mit der nächsten Rechnung verrechnet${down ? " (Gutschrift)" : ""}.` +
        (loseWebsite ? "\n\nAchtung: Firmen-Website, KI-Chat, Online-Terminbuchung, Stellenanzeigen und Fachkräfte-Pool gibt es nur in Enterprise – Ihre Website geht dann offline (die Inhalte bleiben gespeichert)." : "");
      if (!window.confirm(text)) return;
    }
    setBusyPlan(plan.id);
    // nach dem Neuzeichnen starten, damit „Wird geöffnet …“ sofort sichtbar ist
    window.setTimeout(() => {
      Promise.resolve(onUpgrade?.(plan.id)).finally(() => window.setTimeout(() => setBusyPlan(null), 8000));
    }, 0);
  }}
  disabled={busyPlan !== null}
>
  {busyPlan === plan.id
    ? "Wird geöffnet …"
    : canActivateCurrentTrialPlan
      ? `${plan.name} jetzt aktivieren`
      : subscriptionStatus === "active" && !isTrialing && currentPlan && currentPlan !== plan.id
        ? `Zu ${plan.name} wechseln`
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