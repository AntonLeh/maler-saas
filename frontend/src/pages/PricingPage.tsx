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
      "API-Zugriff",
      "KPI & Reports",
      "Erweiterte Auswertungen",
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
      "Mitarbeiter-Bewertungssystem",
      "Leistungs- & Umsatzstatistiken",
      "Eigene Domain",
      "KI-Telefonassistent",
      "KI-Chatassistent",
      "Social-Media-Automatisierung",
      "Persönlicher Support",
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

          <p>
            Wählen Sie den passenden Plan für Ihren Betrieb.
          </p>
        </div>

        <button
          type="button"
          className="btn btn-secondary"
          onClick={onBack}
        >
          Zurück zum Dashboard
        </button>
      </div>

      <div
        style={{
          display: "grid",
          gridTemplateColumns:
            "repeat(auto-fit, minmax(280px, 1fr))",
          gap: "24px",
          marginTop: "30px",
        }}
      >
        {plans.map((plan) => {
          const isCurrent =
  currentPlan?.toLowerCase() === plan.id &&
  currentPlan !== "starter";

          return (
            <div
              key={plan.id}
              className="card"
              style={{
                border: `2px solid ${plan.color}`,
                position: "relative",
                overflow: "hidden",
              }}
            >
              {plan.recommended && (
                <div
                  style={{
                    position: "absolute",
                    top: 0,
                    right: 0,
                    background: "#2563eb",
                    color: "#fff",
                    padding: "6px 12px",
                    fontSize: "12px",
                    fontWeight: 700,
                    borderBottomLeftRadius: "10px",
                  }}
                >
                  EMPFOHLEN
                </div>
              )}

              <h2
                style={{
                  marginBottom: "8px",
                }}
              >
                {plan.name}
              </h2>

              <div
                style={{
                  fontSize: "34px",
                  fontWeight: 800,
                  marginBottom: "18px",
                  color: plan.color,
                }}
              >
                {plan.price}
              </div>

              <div
                style={{
                  display: "flex",
                  flexDirection: "column",
                  gap: "10px",
                  marginBottom: "24px",
                }}
              >
                {plan.features.map((feature) => (
                  <div key={feature}>
                    ✅ {feature}
                  </div>
                ))}
              </div>

              {isCurrent ? (
                <button
                  type="button"
                  className="btn btn-secondary"
                  disabled
                >
                  Aktueller Plan
                </button>
              ) : (
                <button
                  type="button"
                  className="btn btn-primary"
                  onClick={() => onUpgrade?.(plan.id)}
                >
                  Upgrade
                </button>
              )}
            </div>
          );
        })}
      </div>
    </section>
  );
}