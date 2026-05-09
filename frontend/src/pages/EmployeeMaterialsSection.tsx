import { useEffect, useState } from "react";
import { supabase } from "../lib/supabase";

type MaterialAssignment = {
  id: number;
  tenant_id: number;
  order_id: number;
  material_id: number;
  assigned_to_user_id: number;
  quantity: number;
  unit: string;
  status: string;
  materials?: {
    name: string;
  } | null;
};

type ConsumptionLog = {
  id: number;
  assignment_id: number;
  quantity: number;
  action: string;
  note: string | null;
  created_at: string;
};

type Props = {
  tenantId: number;
  orderId: string;
  currentUserId: number;
};

export default function EmployeeMaterialsSection({
  tenantId,
  orderId,
  currentUserId,
}: Props) {
  const [assignments, setAssignments] = useState<MaterialAssignment[]>([]);
  const [logs, setLogs] = useState<ConsumptionLog[]>([]);
  const [message, setMessage] = useState("");
  const [loadingId, setLoadingId] = useState<number | null>(null);

  const [consumptionQuantity, setConsumptionQuantity] = useState<Record<number, string>>({});
  const [consumptionAction, setConsumptionAction] = useState<Record<number, string>>({});
  const [consumptionNote, setConsumptionNote] = useState<Record<number, string>>({});

  const loadAssignments = async () => {
    const { data, error } = await supabase
      .from("order_material_assignments")
      .select(`
        *,
        materials (
          name
        )
      `)
      .eq("tenant_id", tenantId)
      .eq("order_id", Number(orderId))
      .eq("assigned_to_user_id", currentUserId)
      .order("assigned_at", { ascending: false });

    if (error) {
      console.error("Material konnte nicht geladen werden:", error);
      setAssignments([]);
      setLogs([]);
      return;
    }

    const loadedAssignments = (data as MaterialAssignment[]) || [];
    setAssignments(loadedAssignments);

    const assignmentIds = loadedAssignments.map((item) => item.id);

    if (assignmentIds.length === 0) {
      setLogs([]);
      return;
    }

    const { data: logData, error: logError } = await supabase
      .from("material_consumption_logs")
      .select("*")
      .eq("tenant_id", tenantId)
      .in("assignment_id", assignmentIds)
      .order("created_at", { ascending: false });

    if (logError) {
      console.error("Verbrauchsdaten konnten nicht geladen werden:", logError);
      setLogs([]);
      return;
    }

    setLogs((logData as ConsumptionLog[]) || []);
  };

  useEffect(() => {
    loadAssignments();
  }, [tenantId, orderId, currentUserId]);

  const getActionLabel = (action: string) => {
    if (action === "used") return "Verbraucht";
    if (action === "returned") return "Zurückgegeben";
    if (action === "damaged") return "Beschädigt";
    if (action === "left_on_site") return "Auf Baustelle gelassen";
    return action;
  };

  const getLogsForAssignment = (assignmentId: number) => {
    return logs.filter((log) => log.assignment_id === assignmentId);
  };

  const confirmHandover = async (assignmentId: number) => {
    setLoadingId(assignmentId);
    setMessage("");

    const { error: confirmError } = await supabase
      .from("material_handover_confirmations")
      .insert({
        tenant_id: tenantId,
        assignment_id: assignmentId,
        confirmed_by_user_id: currentUserId,
        confirmation_text: "Materialübernahme digital bestätigt.",
      });

    if (confirmError) {
      console.error("Übergabe konnte nicht bestätigt werden:", confirmError);
      setMessage("Übergabe konnte nicht bestätigt werden.");
      setLoadingId(null);
      return;
    }

    const { error: updateError } = await supabase
      .from("order_material_assignments")
      .update({
        status: "handed_over",
        updated_at: new Date().toISOString(),
      })
      .eq("id", assignmentId)
      .eq("tenant_id", tenantId);

    if (updateError) {
      console.error("Materialstatus konnte nicht aktualisiert werden:", updateError);
      setMessage("Bestätigung gespeichert, aber Status konnte nicht aktualisiert werden.");
      setLoadingId(null);
      return;
    }

    setMessage("Materialübernahme wurde bestätigt.");
    setLoadingId(null);
    await loadAssignments();
  };

  const saveConsumption = async (assignment: MaterialAssignment) => {
    const quantity = Number(consumptionQuantity[assignment.id] || 0);
    const action = consumptionAction[assignment.id] || "used";
    const note = consumptionNote[assignment.id] || "";

    if (quantity <= 0) {
      setMessage("Bitte eine gültige Menge für den Materialverbrauch eingeben.");
      return;
    }

    const alreadyBooked = logs
  .filter((log) => log.assignment_id === assignment.id)
  .reduce((sum, log) => sum + Number(log.quantity), 0);

const remaining = Number(assignment.quantity) - alreadyBooked;

if (remaining <= 0) {
  setMessage("Für dieses Material ist keine Restmenge mehr verfügbar.");
  return;
}

if (quantity > remaining) {
  setMessage(
    `Es sind nur noch ${remaining} ${assignment.unit} verfügbar.`
  );
  return;
}

    setLoadingId(assignment.id);
    setMessage("");

    const { error } = await supabase.from("material_consumption_logs").insert({
      tenant_id: tenantId,
      assignment_id: assignment.id,
      order_id: Number(orderId),
      material_id: assignment.material_id,
      user_id: currentUserId,
      quantity,
      action,
      note: note.trim() || null,
    });

    if (error) {
      console.error("Materialverbrauch konnte nicht gespeichert werden:", error);
      setMessage("Materialverbrauch konnte nicht gespeichert werden.");
      setLoadingId(null);
      return;
    }



    if (action === "returned") {
  const { data: materialData, error: materialLoadError } = await supabase
    .from("materials")
    .select("stock_quantity")
    .eq("id", assignment.material_id)
    .eq("tenant_id", tenantId)
    .single();

  if (materialLoadError) {
    console.error("Materialbestand konnte nicht geladen werden:", materialLoadError);
    setMessage("Rückgabe wurde gespeichert, aber Lagerbestand konnte nicht geladen werden.");
    setLoadingId(null);
    return;
  }

  const { error: stockUpdateError } = await supabase
    .from("materials")
    .update({
      stock_quantity: Number(materialData.stock_quantity || 0) + quantity,
      updated_at: new Date().toISOString(),
    })
    .eq("id", assignment.material_id)
    .eq("tenant_id", tenantId);

  if (stockUpdateError) {
    console.error("Lagerbestand konnte nicht erhöht werden:", stockUpdateError);
    setMessage("Rückgabe wurde gespeichert, aber Lagerbestand konnte nicht erhöht werden.");
    setLoadingId(null);
    return;
  }
}

    setConsumptionQuantity((prev) => ({ ...prev, [assignment.id]: "" }));
    setConsumptionAction((prev) => ({ ...prev, [assignment.id]: "used" }));
    setConsumptionNote((prev) => ({ ...prev, [assignment.id]: "" }));

    setMessage("Materialverbrauch wurde gespeichert.");
    setLoadingId(null);
    await loadAssignments();
  };

  if (assignments.length === 0) {
    return null;
  }

  return (
    <div className="card" style={{ marginTop: 18 }}>
      <h4>Materialübernahme & Verbrauch</h4>

      {message && <div className="message-box info">{message}</div>}

      <div className="table-wrapper">
        <table className="orders-table orders-table-wide">
          <thead>
            <tr>
              <th>Material</th>
              <th>Zugewiesen</th>
              <th>Status</th>
              <th>Übernahme</th>
              <th>Verbrauch / Rückgabe</th>
              <th>Historie</th>
            </tr>
          </thead>

          <tbody>
            {assignments.map((item) => {
              const itemLogs = getLogsForAssignment(item.id);

              return (
                <tr key={item.id}>
                  <td>{item.materials?.name || `Material #${item.material_id}`}</td>

                  <td>
                    {item.quantity} {item.unit}
                  </td>

                  <td>{item.status}</td>

                  <td>
                    {item.status === "reserved" ? (
                      <button
                        type="button"
                        className="btn btn-primary"
                        disabled={loadingId === item.id}
                        onClick={() => confirmHandover(item.id)}
                      >
                        {loadingId === item.id
                          ? "Bestätige..."
                          : "Übernahme bestätigen"}
                      </button>
                    ) : (
                      "Bestätigt"
                    )}
                  </td>

                  <td>
                    {item.status === "handed_over" ? (
                      <div style={{ display: "grid", gap: 8, minWidth: 260 }}>
                        <input
                          type="number"
                          step="0.01"
                          placeholder="Menge"
                          value={consumptionQuantity[item.id] || ""}
                          onChange={(e) =>
                            setConsumptionQuantity((prev) => ({
                              ...prev,
                              [item.id]: e.target.value,
                            }))
                          }
                        />

                        <select
                          value={consumptionAction[item.id] || "used"}
                          onChange={(e) =>
                            setConsumptionAction((prev) => ({
                              ...prev,
                              [item.id]: e.target.value,
                            }))
                          }
                        >
                          <option value="used">Verbraucht</option>
                          <option value="returned">Zurückgegeben</option>
                          <option value="damaged">Beschädigt</option>
                          <option value="left_on_site">Auf Baustelle gelassen</option>
                        </select>

                        <input
                          type="text"
                          placeholder="Notiz optional"
                          value={consumptionNote[item.id] || ""}
                          onChange={(e) =>
                            setConsumptionNote((prev) => ({
                              ...prev,
                              [item.id]: e.target.value,
                            }))
                          }
                        />

                        <button
                          type="button"
                          className="btn btn-secondary"
                          disabled={loadingId === item.id}
                          onClick={() => saveConsumption(item)}
                        >
                          {loadingId === item.id ? "Speichert..." : "Verbrauch speichern"}
                        </button>
                      </div>
                    ) : (
                      "Erst Übernahme bestätigen"
                    )}
                  </td>

                  <td>
                    {itemLogs.length === 0 ? (
                      <span className="info-text">Noch nichts dokumentiert.</span>
                    ) : (
                      <div style={{ display: "grid", gap: 6 }}>
                        {itemLogs.map((log) => (
                          <div key={log.id}>
                            <strong>
                              {getActionLabel(log.action)}: {log.quantity} {item.unit}
                            </strong>
                            {log.note && (
                              <div className="table-subtitle">{log.note}</div>
                            )}
                          </div>
                        ))}
                      </div>
                    )}
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>
    </div>
  );
}