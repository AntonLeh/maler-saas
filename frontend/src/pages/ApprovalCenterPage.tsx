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

type ApprovalCenterPageProps = {
  onBack: () => void;
  orders: Order[];
  customers: Customer[];
  progressEntries: ProgressEntry[];
  onApproveOrder: (orderId: string) => void;
  onReturnToWork: (orderId: string) => void;
};

export default function ApprovalCenterPage({
  onBack,
  orders,
  customers,
  progressEntries,
  onApproveOrder,
  onReturnToWork,
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
      <img
        key={img.id}
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