type BusinessCockpitProps = {
  activeEmployees: number;
  openOrders: number;
  openInvoices: number;
  openReceivables: number;
  newImages: number;
  pendingApprovalOrders: number;
  onOpenImages?: () => void;
};

export default function BusinessCockpit({
  activeEmployees,
  openOrders,
  openInvoices,
  openReceivables,
  newImages,
  pendingApprovalOrders,
onOpenImages,
}: BusinessCockpitProps) {
  return (
    <section
      className="card"
      style={{
        marginTop: "24px",
        padding: "22px",
      }}
    >
      <div style={{ marginBottom: "18px" }}>
        <h2 style={{ margin: 0 }}>📢 Heute im Betrieb</h2>
        <p style={{ marginTop: "6px", color: "#64748b" }}>
          Die wichtigsten Kennzahlen für den heutigen Arbeitstag.
        </p>
      </div>

      <div
        style={{
          display: "grid",
          gridTemplateColumns: "repeat(auto-fit, minmax(220px, 1fr))",
          gap: "14px",
        }}
      >
        <CockpitItem
  icon="📸"
  label="Neue Fortschrittsbilder"
  value={newImages}
  onClick={onOpenImages}
/>
<CockpitItem
  icon="👷"
  label="Mitarbeiter auf Baustellen"
  value={activeEmployees}
/>
        <CockpitItem
          icon="📋"
          label="Offene Aufträge"
          value={openOrders}
        />

        <CockpitItem
          icon="🧾"
          label="Offene Rechnungen"
          value={openInvoices}
        />

        <CockpitItem
          icon="💰"
          label="Offene Forderungen"
          value={`${openReceivables.toLocaleString("de-DE")} €`}
        />

        <CockpitItem
          icon="⚠️"
          label="Warten auf Freigabe"
          value={pendingApprovalOrders}
          warning
        />
      </div>

        <div style={{ marginTop: "28px" }}>
  <h3 style={{ margin: 0 }}>📢 Neuigkeiten</h3>
  <p style={{ marginTop: "6px", color: "#64748b" }}>
    Die wichtigsten Ereignisse aus Ihrem Betrieb.
  </p>

  <div
    style={{
      marginTop: "14px",
      display: "grid",
      gap: "10px",
    }}
  >
    <NewsItem
      time="09:45"
      icon="📸"
      text="Joshua hat 4 neue Baustellenbilder hochgeladen."
    />

    <NewsItem
      time="09:18"
      icon="✅"
      text='Auftrag "Müller Wohnzimmer" wurde fertig gemeldet.'
    />

    <NewsItem
      time="08:54"
      icon="🧾"
      text="Rechnung RE-2026-0061 wurde erstellt."
    />

    <NewsItem
      time="08:31"
      icon="⭐"
      text="Leon hat heute einen Bonus erreicht."
    />

    <NewsItem
      time="07:58"
      icon="⚠️"
      text='Materialbestand "Alpina Weiß" ist niedrig.'
      warning
    />
  </div>
</div>

    </section>
  );
}

type CockpitItemProps = {
  icon: string;
  label: string;
  value: string | number;
  warning?: boolean;
  onClick?: () => void;
};

function CockpitItem({
  icon,
  label,
  value,
  warning = false,
  onClick,
}: CockpitItemProps) {
  return (
    <div
  onClick={onClick}
  role={onClick ? "button" : undefined}
  tabIndex={onClick ? 0 : undefined}
  style={{
    padding: "16px",
    borderRadius: "14px",
    background: warning ? "#fff7ed" : "#f8fafc",
    border: warning ? "1px solid #fdba74" : "1px solid #e2e8f0",
    cursor: onClick ? "pointer" : "default",
  }}
>
      <div style={{ fontSize: "22px", marginBottom: "8px" }}>{icon}</div>
      <div style={{ color: "#64748b", fontSize: "14px" }}>{label}</div>
      <strong style={{ display: "block", fontSize: "28px", marginTop: "6px" }}>
        {value}
      </strong>
    </div>

  );
}

type NewsItemProps = {
  time: string;
  icon: string;
  text: string;
  warning?: boolean;
};

function NewsItem({ time, icon, text, warning = false }: NewsItemProps) {
  return (
    <div
      style={{
        display: "grid",
        gridTemplateColumns: "70px 32px 1fr",
        alignItems: "center",
        gap: "10px",
        padding: "12px 14px",
        borderRadius: "12px",
        background: warning ? "#fff7ed" : "#ffffff",
        border: warning ? "1px solid #fdba74" : "1px solid #e2e8f0",
      }}
    >
      <span style={{ color: "#64748b", fontSize: "14px" }}>{time}</span>
      <span style={{ fontSize: "20px" }}>{icon}</span>
      <span style={{ color: "#0f172a" }}>{text}</span>
    </div>
  );
}