import React from "react";

type LockedFeatureCardProps = {
  feature: string;
  requiredPlan: string;
  description?: string;
  onUpgradeClick?: () => void;
};

export default function LockedFeatureCard({
  feature,
  requiredPlan,
  description,
  onUpgradeClick,
}: LockedFeatureCardProps) {
  return (
    <section className="single-page-section">
      <div
        className="card"
        style={{
          border: "2px solid #f0c36d",
          background:
            "linear-gradient(135deg, #fffdf7 0%, #fff8e8 100%)",
          maxWidth: "700px",
          margin: "0 auto",
        }}
      >
        <div
          style={{
            display: "flex",
            alignItems: "center",
            gap: "14px",
            marginBottom: "18px",
          }}
        >
          <div
            style={{
              width: "54px",
              height: "54px",
              borderRadius: "14px",
              background: "#f4b942",
              display: "flex",
              alignItems: "center",
              justifyContent: "center",
              fontSize: "26px",
              color: "#fff",
              fontWeight: 700,
              flexShrink: 0,
            }}
          >
            🔒
          </div>

          <div>
            <h2
              style={{
                margin: 0,
                fontSize: "24px",
              }}
            >
              {feature}
            </h2>

            <div
              style={{
                marginTop: "4px",
                fontSize: "14px",
                color: "#777",
                fontWeight: 600,
              }}
            >
              Verfügbar ab {requiredPlan}
            </div>
          </div>
        </div>

        <p
          style={{
            fontSize: "15px",
            lineHeight: 1.6,
            color: "#444",
            marginBottom: "24px",
          }}
        >
          {description ||
            "Dieses Feature ist in Ihrem aktuellen Plan nicht enthalten. Wechseln Sie auf einen höheren Plan, um diese Funktion freizuschalten."}
        </p>

        <div
          style={{
            display: "flex",
            gap: "12px",
            flexWrap: "wrap",
          }}
        >
          <button
            type="button"
            className="btn btn-primary"
            onClick={onUpgradeClick}
          >
            Jetzt upgraden
          </button>

          <button
            type="button"
            className="btn btn-secondary"
            onClick={() =>
              alert(
                "Die Upgrade-Seite wird als Nächstes eingebaut."
              )
            }
          >
            Mehr erfahren
          </button>
        </div>
      </div>
    </section>
  );
}