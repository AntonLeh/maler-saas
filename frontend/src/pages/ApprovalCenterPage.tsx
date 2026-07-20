type Order = {
  id: string | number;
  customer_id: string | number;
  title: string;
  status: string;
};

type Customer = {
  id: string | number;
  first_name?: string | null;
  last_name?: string | null;
  company_name?: string | null;
};

type ProgressEntry = {
  id: number;
  order_id: string;
  created_at: string;
  note: string | null;
  images?: {
    id: number;
    image_url: string;
  }[];
};

type AppUser = {
  id: number;
  first_name: string | null;
  last_name: string | null;
  email?: string;
  hourly_rate: number | null;
};

type MaterialConsumptionLog = {
  id: number;
  tenant_id: number;
  assignment_id: number | null;
  order_id: number;
  material_id: number;
  user_id: number | null;
  quantity: number;
  action: string;
  note: string | null;
  created_at: string;
  material_name_at_use: string | null;
  unit_at_use: string | null;
  material_supplier_at_use: string | null;
  material_price_at_use: number | null;
};

type TimeEntry = {
  id: number;
  order_id: number;
  user_id: number;
  started_at: string | null;
  ended_at: string | null;
  total_break_minutes: number;
  status: string;
};

type ApprovalCenterPageProps = {
  onBack: () => void;
  orders: Order[];
  customers: Customer[];
  progressEntries: ProgressEntry[];
  onApproveOrder: (orderId: string) => void;
  onReturnToWork: (orderId: string) => void;
  onPreviewImage: (url: string) => void;
  employees: AppUser[];
  orderAssignments: any[];
  timeEntries: TimeEntry[];
  materialConsumptionLogs: MaterialConsumptionLog[];
};

export default function ApprovalCenterPage({
  onBack,
  orders,
  customers,
  progressEntries,
  onApproveOrder,
  onReturnToWork,
  onPreviewImage,
  employees,
  orderAssignments,
  timeEntries,
  materialConsumptionLogs,
}: ApprovalCenterPageProps) {
    const approvalOrders = orders.filter(
  (order) => order.status === "zur_pruefung"
);
  return (
    <section className="single-page-section">
      <div className="page-topbar">
        <div>
          <h1>⚠️ Freigabecenter</h1>
          <p>
            Aufträge, die auf die Freigabe durch den Unternehmer warten.
          </p>
        </div>

        <button
          type="button"
          className="btn btn-secondary"
          onClick={onBack}
        >
          Zurück
        </button>
      </div>

      <div className="card" style={{ marginTop: "24px" }}>
        {approvalOrders.length === 0 ? (
  <p>Zurzeit warten keine Aufträge auf Ihre Freigabe.</p>
) : (
  <div style={{ display: "grid", gap: "16px" }}>
    {approvalOrders.map((order) => {
      const customer = customers.find(
        (c) => String(c.id) === String(order.customer_id)
      );

      const lastProgress = progressEntries
        .filter((p) => String(p.order_id) === String(order.id))
        .sort(
          (a, b) =>
            new Date(b.created_at).getTime() -
            new Date(a.created_at).getTime()
        )[0];

        const assignmentsForOrder = orderAssignments.filter(
  (assignment) => String(assignment.order_id) === String(order.id)
);

const projectManagerNames = assignmentsForOrder
  .filter((assignment) => assignment.assignment_role === "project_manager")
  .map((assignment) => {
    const employee = employees.find(
      (emp) => Number(emp.id) === Number(assignment.user_id)
    );

    return (
      `${employee?.first_name ?? ""} ${employee?.last_name ?? ""}`.trim() ||
      employee?.email ||
      `Mitarbeiter #${assignment.user_id}`
    );
  });

const employeeNames = assignmentsForOrder
  .filter((assignment) => assignment.assignment_role === "employee")
  .map((assignment) => {
    const employee = employees.find(
      (emp) => Number(emp.id) === Number(assignment.user_id)
    );

    return (
      `${employee?.first_name ?? ""} ${employee?.last_name ?? ""}`.trim() ||
      employee?.email ||
      `Mitarbeiter #${assignment.user_id}`
    );
  });

  const orderTimeEntries = timeEntries.filter(
  (entry) => Number(entry.order_id) === Number(order.id)
);

const totalWorkMinutes = orderTimeEntries.reduce((sum, entry) => {
  if (!entry.started_at || !entry.ended_at) {
    return sum;
  }

  const startedAt = new Date(entry.started_at).getTime();
  const endedAt = new Date(entry.ended_at).getTime();

  if (Number.isNaN(startedAt) || Number.isNaN(endedAt)) {
    return sum;
  }

  const grossMinutes = Math.max(0, (endedAt - startedAt) / 1000 / 60);
  const breakMinutes = Number(entry.total_break_minutes || 0);

  return sum + Math.max(0, grossMinutes - breakMinutes);
}, 0);

const totalWorkHours = totalWorkMinutes / 60;

const laborCostByEmployee = orderTimeEntries.reduce(
  (map, entry) => {
    if (!entry.started_at || !entry.ended_at) {
      return map;
    }

    const startedAt = new Date(entry.started_at).getTime();
    const endedAt = new Date(entry.ended_at).getTime();

    if (Number.isNaN(startedAt) || Number.isNaN(endedAt)) {
      return map;
    }

    const grossMinutes = Math.max(0, (endedAt - startedAt) / 1000 / 60);
    const breakMinutes = Number(entry.total_break_minutes || 0);
    const netMinutes = Math.max(0, grossMinutes - breakMinutes);

    const employee = employees.find(
      (emp) => Number(emp.id) === Number(entry.user_id)
    );

    const employeeName =
      `${employee?.first_name ?? ""} ${employee?.last_name ?? ""}`.trim() ||
      employee?.email ||
      `Mitarbeiter #${entry.user_id}`;

    const hourlyRate = Number(employee?.hourly_rate || 0);

    const current = map.get(entry.user_id) || {
      name: employeeName,
      minutes: 0,
      hourlyRate,
      cost: 0,
    };

    current.minutes += netMinutes;
    current.cost += (netMinutes / 60) * hourlyRate;

    map.set(entry.user_id, current);

    return map;
  },
  new Map<number, { name: string; minutes: number; hourlyRate: number; cost: number }>()
);

const laborCostRows = Array.from(laborCostByEmployee.values());

const totalLaborCost = laborCostRows.reduce(
  (sum, row) => sum + row.cost,
  0
);

const materialCost = materialConsumptionLogs
  .filter(
    (log) =>
      Number(log.order_id) === Number(order.id) &&
      log.action === "used"
  )
  .reduce(
    (sum, log) =>
      sum +
      Number(log.quantity || 0) *
        Number(log.material_price_at_use || 0),
    0
  );

const totalOrderCost = totalLaborCost + materialCost;

      return (
        <div
  key={order.id}
  style={{
    padding: "18px",
    border: "1px solid #e5e7eb",
    borderRadius: "14px",
    background: "#ffffff",
  }}
>
  <div style={{ display: "grid", gap: "6px" }}>
    <h3 style={{ margin: 0 }}>🏠 {order.title}</h3>

    <p style={{ margin: 0, color: "#475569" }}>
      👤 Kunde:{" "}
      <strong>
        {customer?.company_name ||
          `${customer?.first_name ?? ""} ${customer?.last_name ?? ""}`}
      </strong>
    </p>

    <p style={{ margin: 0, color: "#64748b" }}>
      🕒 Letzte Meldung:{" "}
      {lastProgress?.created_at
        ? new Date(lastProgress.created_at).toLocaleString("de-DE")
        : "Keine Meldung vorhanden"}
    </p>

      <p style={{ margin: 0, color: "#475569" }}>
  👷 Projektleiter:{" "}
  <strong>
    {projectManagerNames.length > 0
      ? projectManagerNames.join(", ")
      : "Nicht zugewiesen"}
  </strong>
</p>

<p style={{ margin: 0, color: "#475569" }}>
  👨‍🎨 Mitarbeiter:{" "}
  <strong>
    {employeeNames.length > 0
      ? employeeNames.join(", ")
      : "Keine Mitarbeiter zugewiesen"}
  </strong>
</p> 

<p style={{ margin: 0, color: "#475569" }}>
  ⏱️ Arbeitszeit:{" "}
  <strong>
    {totalWorkHours > 0
      ? `${totalWorkHours.toLocaleString("de-DE", {
          minimumFractionDigits: 2,
          maximumFractionDigits: 2,
        })} Stunden`
      : "Keine abgeschlossene Arbeitszeit erfasst"}
  </strong>
</p>

<p style={{ margin: 0, color: "#475569" }}>
  💰 Arbeitskosten:{" "}
  <strong>
    {totalLaborCost.toLocaleString("de-DE", {
      minimumFractionDigits: 2,
      maximumFractionDigits: 2,
    })} €
  </strong>
</p>

<p style={{ margin: 0, color: "#475569" }}>
  🎨 Materialkosten:{" "}
  <strong>
    {materialCost.toLocaleString("de-DE", {
      minimumFractionDigits: 2,
      maximumFractionDigits: 2,
    })} €
  </strong>
</p>

<p style={{ margin: 0, color: "#0f172a", fontWeight: 700 }}>
  📊 Gesamtkosten:{" "}
  <strong>
    {totalOrderCost.toLocaleString("de-DE", {
      minimumFractionDigits: 2,
      maximumFractionDigits: 2,
    })} €
  </strong>
</p>

  </div>

  <div
    style={{
      marginTop: "14px",
      padding: "12px",
      borderRadius: "10px",
      background: "#f8fafc",
      border: "1px solid #e2e8f0",
    }}
  >
    <strong>📝 Letzte Notiz</strong>

    <p style={{ marginBottom: 0 }}>
      {lastProgress?.note || "Keine Fortschrittsnotiz vorhanden."}
    </p>
  </div>

    {(lastProgress?.images?.length ?? 0) > 0 && (
  <div
    style={{
      display: "grid",
      gridTemplateColumns: "repeat(auto-fit, minmax(120px, 1fr))",
      gap: "10px",
      marginTop: "14px",
    }}
  >
    {(lastProgress?.images ?? []).slice(0, 3).map((img) => (
      <button
  key={img.id}
  type="button"
  onClick={() => onPreviewImage(img.image_url)}
  style={{
    padding: 0,
    border: "none",
    background: "transparent",
    cursor: "pointer",
  }}
>
  <img
    src={img.image_url}
    alt="Baustellenbild"
    style={{
      width: "100%",
      height: "110px",
      objectFit: "cover",
      borderRadius: "8px",
      border: "1px solid #ddd",
    }}
  />
</button>
    ))}
  </div>
)}

  <div
    style={{
      display: "flex",
      gap: "10px",
      marginTop: "16px",
    }}
  >
    <button
  type="button"
  className="btn btn-primary"
  onClick={() => onApproveOrder(String(order.id))}
>
  ✅ Freigeben
</button>

    <button
  type="button"
  className="btn btn-secondary"
  onClick={() => onReturnToWork(String(order.id))}
>
  ↩️ Zur Nacharbeit
</button>
  </div>
</div>
      );
    })}
  </div>
)}
      </div>
    </section>
  );
}