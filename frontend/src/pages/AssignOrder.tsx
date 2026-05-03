import { useState } from "react";

type Order = {
  id: string;
  title: string;
};

type Employee = {
  id: number;
  first_name: string | null;
  last_name: string | null;
  role_id: number;
};

type Props = {
  orders: Order[];
  employees: Employee[];
  onAssign: (
  orderId: string,
  projectManagerId: number,
  employeeIds: number[]
) => Promise<void>;
  onBack: () => void;
};

export default function AssignOrder({
  orders,
  employees,
  onAssign,
  onBack,
}: Props) {
  const [selectedOrder, setSelectedOrder] = useState("");
  const [selectedProjectManager, setSelectedProjectManager] = useState("");
  const [selectedEmployees, setSelectedEmployees] = useState<number[]>([]);

  const [message, setMessage] = useState("");
  const [loading, setLoading] = useState(false);

  const projectManagers = employees.filter((e) => e.role_id === 3);
  const workers = employees.filter((e) => e.role_id === 4);

  const handleAssign = async () => {
  if (!selectedOrder) {
    setMessage("Bitte Auftrag auswählen.");
    return;
  }

  if (!selectedProjectManager) {
    setMessage("Bitte Projektleiter auswählen.");
    return;
  }

  if (selectedEmployees.length === 0) {
    setMessage("Bitte mindestens einen Mitarbeiter auswählen.");
    return;
  }

  setLoading(true);
  setMessage("");

  try {
    await onAssign(
  selectedOrder,
  Number(selectedProjectManager),
  selectedEmployees
);

    setMessage("Zuweisung gespeichert.");
  } catch (err: any) {
    setMessage(err.message || "Fehler bei der Zuweisung.");
  } finally {
    setLoading(false);
  }
};

  return (
    <section className="single-page-section">
      <div className="card">
        <div className="page-topbar">
          <div>
            <h2>Auftrag zuweisen</h2>
            <p>Bestehenden Auftrag einem Mitarbeiter zuweisen.</p>
          </div>

          <button className="btn btn-secondary" onClick={onBack}>
            Zurück
          </button>
        </div>

        <div className="form-stack">
          <div className="form-group">
            <label>Auftrag</label>
            <select
              value={selectedOrder}
              onChange={(e) => setSelectedOrder(e.target.value)}
            >
              <option value="">Bitte Auftrag wählen</option>
              {orders.map((o) => (
                <option key={o.id} value={o.id}>
                  {o.title}
                </option>
              ))}
            </select>
          </div>
          <div className="form-group">
  <label>Projektleiter</label>
  <select
    value={selectedProjectManager}
    onChange={(e) => setSelectedProjectManager(e.target.value)}
  >
    <option value="">Bitte Projektleiter wählen</option>
    {projectManagers.map((pm) => (
      <option key={pm.id} value={pm.id}>
        {pm.first_name || ""} {pm.last_name || ""}
      </option>
    ))}
  </select>
</div>

<div className="form-group">
  <label>Mitarbeiter</label>

  {workers.length === 0 ? (
    <p className="info-text">Noch keine Mitarbeiter vorhanden.</p>
  ) : (
    <div style={{ display: "grid", gap: "8px" }}>
      {workers.map((worker) => (
        <label
          key={worker.id}
          style={{
            display: "flex",
            alignItems: "center",
            gap: "8px",
            padding: "8px 10px",
            border: "1px solid #ddd",
            borderRadius: "10px",
          }}
        >
          <input
            type="checkbox"
            checked={selectedEmployees.includes(worker.id)}
            onChange={(e) => {
              if (e.target.checked) {
                setSelectedEmployees((prev) => [...prev, worker.id]);
              } else {
                setSelectedEmployees((prev) =>
                  prev.filter((id) => id !== worker.id)
                );
              }
            }}
          />

          <span>
            {worker.first_name || ""} {worker.last_name || ""}
          </span>
        </label>
      ))}
    </div>
  )}
</div>

          <button
            className="btn btn-primary"
            onClick={handleAssign}
            disabled={loading}
          >
            {loading ? "Speichert..." : "Zuweisen"}
          </button>

          {message && <p className="info-text">{message}</p>}
        </div>
      </div>
    </section>
  );
}