import React from "react";

type PricingPageProps = {
  currentPlan?: string;
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
  "Eigene Domain",
  "KI-Telefonassistent",
  "KI-Chatassistent",
  "Social-Media-Automatisierung",
  "Automatische Kundenanfragen",
  "Individuelle Unternehmensanpassungen",
  "Persönlicher Premium-Support",
],
  },
];

export default function PricingPage({
  currentPlan,
  onBack,
  onUpgrade,
}: PricingPageProps) {
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
        const isCurrent = currentPlan?.toLowerCase() === plan.id;

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

            <div className="pricing-features">
              {plan.features.map((feature) => (
                <div key={feature}>✅ {feature}</div>
              ))}
            </div>

            {isCurrent ? (
              <button type="button" className="btn btn-secondary" disabled>
                Aktueller Plan
              </button>
            ) : (
              <button
                type="button"
                className="btn btn-primary"
                onClick={() => onUpgrade?.(plan.id)}
              >
                Plan wählen
              </button>
            )}
          </div>
        );
      })}
    </div>
  </section>
);
}