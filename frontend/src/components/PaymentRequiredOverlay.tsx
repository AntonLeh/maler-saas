import type { LockKind } from "../lib/staffAccess";

type PaymentRequiredOverlayProps = {
  kind: LockKind;
  since?: Date | null; // Ende der Testphase bzw. des Abos
  onChoosePlan: () => void;
  onOpenBilling?: () => void; // „Abrechnung & Abo“ mit „Alle Daten exportieren“
  onLogout?: () => void;
};

const DAY = 24 * 60 * 60 * 1000;
const fmt = (d: Date) => d.toLocaleDateString("de-DE", { day: "2-digit", month: "2-digit", year: "numeric" });

/** Sperrseite für Admins/Inhaber: Testphase beendet, Zahlung offen oder Abo beendet */
export default function PaymentRequiredOverlay({ kind, since, onChoosePlan, onOpenBilling, onLogout }: PaymentRequiredOverlayProps) {
  const deleteAt = since && kind !== "payment" ? new Date(since.getTime() + 30 * DAY) : null;

  const title = kind === "trial" ? "Testphase beendet" : kind === "payment" ? "Zahlung offen" : "Ihr Abo ist beendet";
  const text =
    kind === "trial"
      ? `Ihre kostenlose Testphase ist${since ? ` am ${fmt(since)}` : ""} abgelaufen.`
      : kind === "payment"
      ? "Die letzte Zahlung für Ihr Abo ist nicht eingegangen. Bitte prüfen Sie Ihre Zahlungsmethode unter „Abrechnung & Abo“."
      : `Ihr Abo ist${since ? ` am ${fmt(since)}` : ""} beendet.`;

  return (
    <section className="single-page-section">
      <div
        className="card"
        style={{
          maxWidth: "760px",
          margin: "40px auto",
          border: "2px solid #f59e0b",
          background: "linear-gradient(135deg, #fffdf7 0%, #fff7ed 100%)",
          textAlign: "left",
        }}
      >
        <div style={{ fontSize: "42px", marginBottom: "12px" }}>⚠️</div>

        <h1 style={{ marginBottom: "10px" }}>{title}</h1>

        <p style={{ fontSize: "15px", lineHeight: 1.6, color: "#444", marginBottom: "10px" }}>
          {text} Ihre Daten bleiben erhalten, aber Sie können erst weiterarbeiten, wenn wieder ein Tarif aktiv ist.
        </p>
        <p style={{ fontSize: "15px", lineHeight: 1.6, color: "#444", marginBottom: "10px" }}>
          Ihre Projektleiter und Mitarbeiter können die App ab der Sperrung noch 3 Tage nutzen.
        </p>
        {deleteAt && (
          <p style={{ fontSize: "15px", lineHeight: 1.6, color: "#92400e", marginBottom: "22px" }}>
            Ohne neuen Tarif werden Ihre Daten am {fmt(deleteAt)} endgültig gelöscht. Sichern Sie sie vorher mit „Alle Daten exportieren“.
          </p>
        )}

        <div style={{ display: "flex", gap: "12px", flexWrap: "wrap", marginTop: deleteAt ? 0 : 12 }}>
          <button type="button" className="btn btn-primary" onClick={onChoosePlan}>
            Tarif auswählen
          </button>

          {onOpenBilling && (
            <button type="button" className="btn btn-secondary" onClick={onOpenBilling}>
              {kind === "payment" ? "Zahlungsmethode & Daten sichern" : "Daten sichern & Abo verwalten"}
            </button>
          )}

          {onLogout && (
            <button type="button" className="btn btn-secondary" onClick={onLogout}>
              Abmelden
            </button>
          )}
        </div>
      </div>
    </section>
  );
}
