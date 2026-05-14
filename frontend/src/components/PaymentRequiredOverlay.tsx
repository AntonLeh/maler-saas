import React from "react";

type PaymentRequiredOverlayProps = {
  onChoosePlan: () => void;
  onLogout?: () => void;
};

export default function PaymentRequiredOverlay({
  onChoosePlan,
  onLogout,
}: PaymentRequiredOverlayProps) {
  return (
    <section className="single-page-section">
      <div
        className="card"
        style={{
          maxWidth: "760px",
          margin: "40px auto",
          border: "2px solid #f59e0b",
          background:
            "linear-gradient(135deg, #fffdf7 0%, #fff7ed 100%)",
        }}
      >
        <div style={{ fontSize: "42px", marginBottom: "12px" }}>
          ⚠️
        </div>

        <h1 style={{ marginBottom: "10px" }}>
          Testphase beendet
        </h1>

        <p
          style={{
            fontSize: "15px",
            lineHeight: 1.6,
            color: "#444",
            marginBottom: "22px",
          }}
        >
          Ihre kostenlose Testphase ist abgelaufen. Ihre Daten bleiben
          erhalten, aber neue Aktionen sind erst wieder möglich, wenn
          ein Tarif aktiviert wurde.
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
            onClick={onChoosePlan}
          >
            Tarif auswählen
          </button>

          {onLogout && (
            <button
              type="button"
              className="btn btn-secondary"
              onClick={onLogout}
            >
              Abmelden
            </button>
          )}
        </div>
      </div>
    </section>
  );
}