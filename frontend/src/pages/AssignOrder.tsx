import { useState } from "react";

type Order = {
  id: string;
  title: string;
};

type Employee = {
  id: number;
  first_name: string | null;
  last_name: string | null;
};

type Props = {
  orders: Order[];
  employees: Employee[];
  onAssign: (orderId: string, employeeId: number | null) => Promise<void>;
  onBack: () => void;
};

export default function AssignOrder({
  orders,
  employees,
  onAssign,
  onBack,
}: Props) {
  const [selectedOrder, setSelectedOrder] = useState("");
  const [selectedEmployee, setSelectedEmployee] = useState("");
  const [message, setMessage] = useState("");
  const [loading, setLoading] = useState(false);

  const handleAssign = async () => {
    if (!selectedOrder) {
      setMessage("Bitte Auftrag auswählen.");
      return;
    }

    setLoading(true);
    setMessage("");

    try {
      await onAssign(
        selectedOrder,
        selectedEmployee ? Number(selectedEmployee) : null
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
            <label>Mitarbeiter</label>
            <select
              value={selectedEmployee}
              onChange={(e) => setSelectedEmployee(e.target.value)}
            >
              <option value="">Kein Mitarbeiter</option>
              {employees.map((e) => (
                <option key={e.id} value={e.id}>
                  {e.first_name || ""} {e.last_name || ""}
                </option>
              ))}
            </select>
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