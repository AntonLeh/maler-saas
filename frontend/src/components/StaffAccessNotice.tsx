import type { StaffAccess } from "../lib/staffAccess";

/** Gelber Hinweis (Übergangszeit) bzw. Sperrseite für Projektleiter und Mitarbeiter */
export function StaffGraceBanner({ access }: { access: StaffAccess }) {
  if (access.state !== "grace") return null;
  const until = access.until.toLocaleDateString("de-DE", { weekday: "long", day: "2-digit", month: "2-digit" });
  return (
    <div className="staff-grace" role="status">
      <strong>Das Abo Ihres Betriebs muss erneuert werden – bitte wenden Sie sich an Ihren Admin.</strong>
      <span>
        Sie können die App noch {access.daysLeft === 1 ? "1 Tag" : `${access.daysLeft} Tage`} nutzen (bis {until}).
      </span>
    </div>
  );
}

export function StaffLockedPage({ onLogout }: { onLogout: () => void }) {
  return (
    <div className="staff-locked">
      <div className="staff-locked-card">
        <div className="staff-locked-icon" aria-hidden>🔒</div>
        <h1>Zugang vorübergehend gesperrt</h1>
        <p>Das Abo Ihres Betriebs muss erneuert werden – bitte wenden Sie sich an Ihren Admin.</p>
        <p className="staff-locked-muted">
          Sobald das Abo erneuert ist, können Sie sich wieder anmelden und wie gewohnt weiterarbeiten. Ihre Daten bleiben erhalten.
        </p>
        <button type="button" className="btn btn-secondary" onClick={onLogout}>
          Abmelden
        </button>
      </div>
    </div>
  );
}
