import { useEffect, useState } from "react";
import { supabase } from "../lib/supabase";

type Material = {
  id: number;
  name: string;
  unit: string;
  stock_quantity: number;
};

type Employee = {
  id: number;
  first_name: string | null;
  last_name: string | null;
  role_id: number;
};

type Assignment = {
  id: number;
  material_id: number;
  assigned_to_user_id: number;
  quantity: number;
  unit: string;
  status: string;
  assigned_at: string;
  handover_count?: number;
};

type Props = {
  tenantId: number;
  orderId: number;
  employees: Employee[];
  currentUserId: number;
};

export default function OrderMaterialsSection({
  tenantId,
  orderId,
  employees,
  currentUserId,
}: Props) {
  const [materials, setMaterials] = useState<Material[]>([]);
  const [assignments, setAssignments] = useState<Assignment[]>([]);
  const [materialId, setMaterialId] = useState("");
  const [assignedToUserId, setAssignedToUserId] = useState("");
  const [quantity, setQuantity] = useState("1");
  const [message, setMessage] = useState("");

  const loadData = async () => {
    const { data: materialsData } = await supabase
      .from("materials")
      .select("id,name,unit,stock_quantity")
      .eq("tenant_id", tenantId)
      .eq("is_active", true)
      .order("name", { ascending: true });

    const { data: assignmentsData } = await supabase
      .from("order_material_assignments")
      .select("*")
      .eq("tenant_id", tenantId)
      .eq("order_id", orderId)
      .order("assigned_at", { ascending: false });

    const assignmentIds = ((assignmentsData as Assignment[]) || []).map((a) => a.id);

    let confirmations: any[] = [];

    if (assignmentIds.length > 0) {
      const { data: confirmationData } = await supabase
        .from("material_handover_confirmations")
        .select("assignment_id")
        .eq("tenant_id", tenantId)
        .in("assignment_id", assignmentIds);

      confirmations = confirmationData || [];
    }

    const assignmentsWithConfirmations = ((assignmentsData as Assignment[]) || []).map(
      (assignment) => ({
        ...assignment,
        handover_count: confirmations.filter(
          (c) => c.assignment_id === assignment.id
        ).length,
      })
    );

    setMaterials((materialsData as Material[]) || []);
    setAssignments(assignmentsWithConfirmations);
  };

  useEffect(() => {
    loadData();
  }, [tenantId, orderId]);

  const getMaterialName = (id: number) => {
    return materials.find((m) => m.id === id)?.name || `Material #${id}`;
  };

  const getUserName = (id: number) => {
    const user = employees.find((e) => e.id === id);
    return user
      ? `${user.first_name || ""} ${user.last_name || ""}`.trim()
      : `User #${id}`;
  };

  const getStatusLabel = (status: string, handoverCount = 0) => {
    if (status === "handed_over" || handoverCount > 0) return "Übergeben";
    if (status === "reserved") return "Übergabe offen";
    if (status === "returned") return "Zurückgegeben";
    if (status === "completed") return "Abgeschlossen";
    return status;
  };

  const getStatusColor = (status: string, handoverCount = 0) => {
    if (status === "handed_over" || handoverCount > 0) return "#166534";
    if (status === "reserved") return "#92400e";
    if (status === "returned") return "#1e40af";
    return "#374151";
  };

  const handleAssignMaterial = async (e: React.FormEvent) => {
    e.preventDefault();
    setMessage("");

    if (!materialId || !assignedToUserId || Number(quantity) <= 0) {
      setMessage("Bitte Material, Empfänger und Menge eingeben.");
      return;
    }

    const material = materials.find((m) => m.id === Number(materialId));

    if (!material) {
      setMessage("Material wurde nicht gefunden.");
      return;
    }

    if (Number(quantity) > Number(material.stock_quantity)) {
      setMessage("Die Menge ist größer als der aktuelle Lagerbestand.");
      return;
    }

    const { error: insertError } = await supabase
      .from("order_material_assignments")
      .insert({
        tenant_id: tenantId,
        order_id: orderId,
        material_id: Number(materialId),
        assigned_to_user_id: Number(assignedToUserId),
        assigned_by_user_id: currentUserId,
        quantity: Number(quantity),
        unit: material.unit,
        status: "reserved",
        updated_at: new Date().toISOString(),
      });

    if (insertError) {
      console.error("Fehler beim Zuweisen von Material:", insertError);
      setMessage("Material konnte nicht zugewiesen werden.");
      return;
    }

    const { error: stockError } = await supabase
      .from("materials")
      .update({
        stock_quantity: Number(material.stock_quantity) - Number(quantity),
        updated_at: new Date().toISOString(),
      })
      .eq("id", material.id)
      .eq("tenant_id", tenantId);

    if (stockError) {
      console.error("Fehler beim Aktualisieren des Lagerbestands:", stockError);
      setMessage(
        "Material wurde zugewiesen, aber Lagerbestand konnte nicht aktualisiert werden."
      );
      return;
    }

    setMaterialId("");
    setAssignedToUserId("");
    setQuantity("1");
    setMessage("Material wurde dem Auftrag zugewiesen.");
    await loadData();
  };

  return (
    <div className="card" style={{ marginTop: 24 }}>
      <h3>Material</h3>
      <p className="info-text">
        Material einem Auftrag zuweisen und Übergabestatus kontrollieren.
      </p>

      {message && <div className="message-box info">{message}</div>}

      <form onSubmit={handleAssignMaterial} className="form-stack">
        <div className="form-row three-cols">
          <div className="form-group">
            <label>Material</label>
            <select value={materialId} onChange={(e) => setMaterialId(e.target.value)}>
              <option value="">Bitte wählen</option>
              {materials.map((material) => (
                <option key={material.id} value={material.id}>
                  {material.name} — Bestand: {material.stock_quantity} {material.unit}
                </option>
              ))}
            </select>
          </div>

          <div className="form-group">
            <label>Menge</label>
            <input
              type="number"
              step="0.01"
              value={quantity}
              onChange={(e) => setQuantity(e.target.value)}
            />
          </div>

          <div className="form-group">
            <label>Empfänger</label>
            <select
              value={assignedToUserId}
              onChange={(e) => setAssignedToUserId(e.target.value)}
            >
              <option value="">Bitte wählen</option>
              {employees
                .filter((e) => e.role_id === 3 || e.role_id === 4)
                .map((employee) => (
                  <option key={employee.id} value={employee.id}>
                    {employee.first_name || ""} {employee.last_name || ""}
                  </option>
                ))}
            </select>
          </div>
        </div>

        <button type="submit" className="btn btn-primary">
          Material zuweisen
        </button>
      </form>

      <div className="table-wrapper" style={{ marginTop: 22 }}>
        <h4>Materialstatus Auftrag</h4>

        <table className="orders-table orders-table-wide">
          <thead>
            <tr>
              <th>Material</th>
              <th>Menge</th>
              <th>Empfänger</th>
              <th>Übergabestatus</th>
            </tr>
          </thead>
          <tbody>
            {assignments.length === 0 ? (
              <tr>
                <td colSpan={4}>Noch kein Material zugewiesen.</td>
              </tr>
            ) : (
              assignments.map((item) => (
                <tr key={item.id}>
                  <td>{getMaterialName(item.material_id)}</td>
                  <td>
                    {item.quantity} {item.unit}
                  </td>
                  <td>{getUserName(item.assigned_to_user_id)}</td>
                  <td>
                    <strong
                      style={{
                        color: getStatusColor(item.status, item.handover_count),
                      }}
                    >
                      {getStatusLabel(item.status, item.handover_count)}
                    </strong>
                  </td>
                </tr>
              ))
            )}
          </tbody>
        </table>
      </div>
    </div>
  );
}