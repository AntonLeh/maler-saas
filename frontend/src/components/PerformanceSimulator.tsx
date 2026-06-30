import { useState } from "react";
import { supabase } from "../lib/supabase";

type AppUser = {
  id: number;
  first_name: string | null;
  last_name: string | null;
  email: string;
};

type PerformanceResult = {
  employee_id: number;
  order_id: number;
  performance_score: number;
  total_rules: number;
  successful_rules: number;
  failed_rules: number;
  stars: number | null;
  reward_name: string | null;
  reward_type: string | null;
  reward_value: number | null;
};

type PerformanceSimulatorProps = {
  orderId: number | string;
  employees: AppUser[];
};

export default function PerformanceSimulator({
  orderId,
  employees,
}: PerformanceSimulatorProps) {
  const [loading, setLoading] = useState(false);
  const [results, setResults] = useState<PerformanceResult[]>([]);
  const [isOpen, setIsOpen] = useState(false);

  const getEmployeeName = (employeeId: number | string) => {
    const employee = employees.find(
      (emp) => Number(emp.id) === Number(employeeId)
    );

    if (!employee) return `Mitarbeiter-ID ${employeeId}`;

    const fullName = `${employee.first_name ?? ""} ${employee.last_name ?? ""}`.trim();
    return fullName || employee.email;
  };

  const calculatePerformance = async () => {
    try {
      setLoading(true);

      const { data, error } = await supabase.rpc("calculate_employee_performance", {
        p_order_id: Number(orderId),
      });

      if (error) {
        console.error("Fehler bei Leistungsbewertung:", error);
        alert("Fehler bei der Leistungsbewertung: " + error.message);
        return;
      }

      setResults(data || []);
      setIsOpen(true);
    } catch (err) {
      console.error("Unerwarteter Fehler bei Leistungsbewertung:", err);
      alert("Unerwarteter Fehler bei der Leistungsbewertung.");
    } finally {
      setLoading(false);
    }
  };

  return (
    <div style={{ marginTop: "10px" }}>
      <button
        type="button"
        className="btn btn-secondary btn-small"
        onClick={calculatePerformance}
        disabled={loading}
      >
        {loading ? "⭐ Bewertung läuft..." : "⭐ Leistungsbewertung"}
      </button>

      {isOpen && results.length > 0 && (
        <div
          style={{
            marginTop: "10px",
            padding: "12px",
            border: "1px solid #fde68a",
            borderRadius: "10px",
            background: "#fffbeb",
          }}
        >
          <button
            type="button"
            onClick={() => setIsOpen(false)}
            style={{
              float: "right",
              border: "none",
              background: "transparent",
              cursor: "pointer",
              fontSize: "18px",
              fontWeight: 700,
            }}
          >
            ×
          </button>

          <strong>⭐ Leistungsbewertung</strong>

          {results.map((result) => (
            <div
              key={`${result.employee_id}-${result.order_id}`}
              style={{
                marginTop: "10px",
                padding: "10px",
                borderRadius: "8px",
                background: "#fff",
                border: "1px solid #fef3c7",
              }}
            >
              <div>
                👤 <strong>{getEmployeeName(result.employee_id)}</strong>
              </div>
              <div>🏆 Punkte: {result.performance_score}</div>
              <div>
                ✅ Regeln erfüllt: {result.successful_rules} / {result.total_rules}
              </div>
              <div>❌ Regeln nicht erfüllt: {result.failed_rules}</div>
              <div>
                🎁 Bonus:{" "}
                {result.reward_name
                  ? `${result.reward_name} – ${result.reward_value ?? 0} ${
                      result.reward_type || ""
                    }`
                  : "Keine passende Bonusregel hinterlegt"}
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}