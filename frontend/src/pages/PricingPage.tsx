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
    price: "149 CHF",
    color: "#6b7280",
    features: [
      "Kundenverwaltung",
      "Angebote & Rechnungen",
      "Zeiterfassung",
      "PWA App",
      "Fortschrittsnotizen",
    ],
  },

  {
    id: "professional",
    name: "Professional",
    price: "349 CHF",
    color: "#2563eb",
    recommended: true,
    features: [
      "Alles aus Starter",
      "Kundenportal",
      "Materialverwaltung",
      "Projektleiter",
      "Bilder & Fortschritt",
      "Premium Support",
    ],
  },

  {
    id: "business",
    name: "Business",
    price: "699 CHF",
    color: "#d97706",
    features: [
      "Alles aus Professional",
      "API-Zugriff",
      "KPI & Reports",
      "Mehr Speicher",
      "Multi-Standorte",
      "Prioritäts-Support",
    ],
  },

  {
    id: "enterprise",
    name: "Enterprise",
    price: "Individuell",
    color: "#7c3aed",
    features: [
      "White Label",
      "Eigene Domain",
      "Custom Features",
      "Persönlicher Support",
      "Enterprise SLA",
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
          Zurück
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