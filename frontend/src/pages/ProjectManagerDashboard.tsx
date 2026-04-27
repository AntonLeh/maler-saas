import AdminTimeEvaluation from "../components/AdminTimeEvaluation";

type ProjectManagerDashboardProps = {
  userName: string;
  userEmail: string;
  onLogout: () => void;
  onOpenCustomers: () => void;
  onOpenOrders: () => void;
  onOpenCreateCustomer: () => void;
  onOpenCreateOrder: () => void;
  onOpenAssignOrder: () => void;
  onOpenTimeEvaluation: () => void;
};

export default function ProjectManagerDashboard({
  userName,
  userEmail,
  onLogout,
  onOpenCustomers,
  onOpenOrders,
  onOpenCreateCustomer,
  onOpenCreateOrder,
  onOpenAssignOrder,
  onOpenTimeEvaluation,
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

        <section className="stats-grid stats-grid-5">
          <button
            type="button"
            className="stat-card stat-card-clickable"
            onClick={onOpenCustomers}
          >
            <span className="stat-label">Kunden</span>
            <strong className="stat-value">Öffnen</strong>
          </button>

          <button
            type="button"
            className="stat-card stat-card-clickable"
            onClick={onOpenOrders}
          >
            <span className="stat-label">Aufträge</span>
            <strong className="stat-value">Öffnen</strong>
          </button>
        </section>

        <section className="action-bar">
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
            onClick={onOpenCreateOrder}
          >
            + Auftrag anlegen
          </button>

          <button
            type="button"
            className="btn btn-primary"
            onClick={onOpenAssignOrder}
          >
            Auftrag zuweisen
          </button>
          <button
          type="button"
          className="btn btn-primary"
          onClick={onOpenTimeEvaluation}
          >
          Arbeitsstunden
          </button>
        </section>

      </div>
    </div>
  );
}