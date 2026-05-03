import AdminTimeEvaluation from "../components/AdminTimeEvaluation";

type ProjectManagerDashboardProps = {
  userName: string;
  userEmail: string;
  onLogout: () => void;
  onOpenOrders: () => void;
  onOpenCreateCustomer: () => void;
  onOpenCreateSiteVisit: () => void;
  onOpenMessages: () => void;
  unreadMessages: number;
};

export default function ProjectManagerDashboard({
  userName,
  userEmail,
  onLogout,
  onOpenOrders,
  onOpenCreateCustomer,
  onOpenCreateSiteVisit,
  onOpenMessages,
  unreadMessages,
}: ProjectManagerDashboardProps) {
  return (
    <div className="dashboard-page">
      <div className="dashboard-container">
        <header className="topbar">
          <div className="topbar-left">
            <h1>Projektleiter-Dashboard</h1>
            <p className="topbar-subtitle">
              Aufträge aufnehmen, planen und Mitarbeiter zuweisen
            </p>
          </div>

          <div className="topbar-right">
            <div className="user-box">
              <span className="user-label">Eingeloggt als</span>
              <strong>{userName}</strong>
              <span className="user-meta">{userEmail}</span>
            </div>

            <button onClick={onLogout} className="btn btn-secondary">
              Logout
            </button>
          </div>
        </header>

        <section className="action-bar">
  <button
    type="button"
    className="btn btn-primary"
    onClick={onOpenOrders}
  >
    Offene Aufträge
  </button>

  <button
    type="button"
    className="btn btn-primary"
    onClick={onOpenCreateCustomer}
  >
    + Kunde anlegen
  </button>

  <button
    type="button"
    className="btn btn-primary"
    onClick={onOpenCreateSiteVisit}
  >
    + Aufmaß anlegen
  </button>

  <button
    type="button"
    className="btn btn-primary"
    onClick={onOpenMessages}
  >
    Nachrichten {unreadMessages > 0 ? `(${unreadMessages})` : ""}
  </button>
</section>

      </div>
    </div>
  );
}