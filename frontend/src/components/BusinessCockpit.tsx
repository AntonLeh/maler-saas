import { useRef } from "react";

type BusinessCockpitProps = {
  businessEvents: {
    id: number;
    tenant_id: number;
    event_type: string;
    message: string;
    icon: string | null;
    severity: "info" | "success" | "warning";
    order_id: number | null;
    created_at: string;
  }[];

  activeEmployees: number;
  openOrders: number;
  openInvoices: number;
  openReceivables: number;
  newImages: number;
  pendingApprovalOrders: number;

  selectedDate?: string;
  onDateChange?: (date: string) => void;

  onOpenImages?: () => void;
  onOpenApprovals?: () => void;
};

export default function BusinessCockpit({
  businessEvents = [],
  activeEmployees,
  openOrders,
  openInvoices,
  openReceivables,
  newImages,
  pendingApprovalOrders,
  selectedDate = new Date().toLocaleDateString("sv-SE"),
  onDateChange,
  onOpenApprovals,
  onOpenImages,
}: BusinessCockpitProps) {
  const dateInputRef = useRef<HTMLInputElement>(null);
  const formattedSelectedDate = new Date(
    `${selectedDate}T12:00:00`
  ).toLocaleDateString("de-DE", {
    day: "2-digit",
    month: "2-digit",
    year: "numeric",
  });

  return (
    <section
      className="card"
      style={{
        marginTop: "24px",
        marginBottom: "36px",
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
          label="Außenstände"
          value={`${openReceivables.toLocaleString("de-DE")} €`}
        />

        <CockpitItem
          icon="⚠️"
          label="Warten auf Freigabe"
          value={pendingApprovalOrders}
          warning
          onClick={onOpenApprovals}
        />
      </div>

      <div style={{ marginTop: "28px" }}>
        <div
          className="business-news-header"
          style={{
            position: "relative",
            display: "flex",
            justifyContent: "center",
            alignItems: "flex-start",
            minHeight: "76px",
          }}
        >
          <div
            style={{
              textAlign: "center",
              width: "100%",
            }}
          >
            <h3 style={{ margin: 0 }}>📢 Neuigkeiten</h3>

            <p
              style={{
                marginTop: "6px",
                marginBottom: 0,
                color: "#64748b",
              }}
            >
              Die wichtigsten Ereignisse aus Ihrem Betrieb.
            </p>
          </div>

          <div
  className="business-news-date"
  style={{
    position: "absolute",
    right: 0,
    top: 0,
  }}
>
  <button
    type="button"
    onClick={() => {
      const input = dateInputRef.current;

      if (!input) return;

      if (typeof input.showPicker === "function") {
        input.showPicker();
      } else {
        input.click();
      }
    }}
    style={{
      display: "inline-flex",
      alignItems: "center",
      gap: "8px",
      padding: "9px 12px",
      borderRadius: "10px",
      border: "1px solid #e2e8f0",
      background: "#f8fafc",
      cursor: "pointer",
      fontWeight: 600,
      color: "#0f172a",
      fontFamily: "inherit",
      fontSize: "inherit",
    }}
  >
    <span style={{ fontSize: "18px" }}>📅</span>

    <span style={{ whiteSpace: "nowrap" }}>
      {formattedSelectedDate}
    </span>
  </button>

  <input
    ref={dateInputRef}
    type="date"
    value={selectedDate}
    onChange={(event) => {
      onDateChange?.(event.target.value);
    }}
    aria-label="Datum für Neuigkeiten auswählen"
    style={{
      position: "absolute",
      width: "1px",
      height: "1px",
      opacity: 0,
      pointerEvents: "none",
    }}
  />
</div>
        </div>

        <div
          style={{
            marginTop: "14px",
            display: "grid",
            gap: "10px",
          }}
        >
          {[...businessEvents]
  .sort(
    (a, b) =>
      new Date(b.created_at).getTime() -
      new Date(a.created_at).getTime()
  )
  .map((event) => (
    <NewsItem
      key={event.id}
      time={new Date(event.created_at).toLocaleTimeString(
        "de-DE",
        {
          hour: "2-digit",
          minute: "2-digit",
        }
      )}
      icon={event.icon || "📢"}
      text={event.message}
      warning={event.severity === "warning"}
    />
  ))}
        </div>
      </div>

      <style>
        {`
          @media (max-width: 700px) {
            .business-news-header {
              flex-direction: column !important;
              align-items: center !important;
              min-height: auto !important;
              gap: 14px !important;
            }

            .business-news-date {
              position: relative !important;
              right: auto !important;
              top: auto !important;
              align-self: center !important;
              margin-top: 4px !important;
            }
          }
        `}
      </style>
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
        border: warning
          ? "1px solid #fdba74"
          : "1px solid #e2e8f0",
        cursor: onClick ? "pointer" : "default",
      }}
    >
      <div style={{ fontSize: "22px", marginBottom: "8px" }}>
        {icon}
      </div>

      <div style={{ color: "#64748b", fontSize: "14px" }}>
        {label}
      </div>

      <strong
        style={{
          display: "block",
          fontSize: "28px",
          marginTop: "6px",
        }}
      >
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

function NewsItem({
  time,
  icon,
  text,
  warning = false,
}: NewsItemProps) {
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
        border: warning
          ? "1px solid #fdba74"
          : "1px solid #e2e8f0",
      }}
    >
      <span
        style={{
          color: "#64748b",
          fontSize: "14px",
        }}
      >
        {time}
      </span>

      <span style={{ fontSize: "20px" }}>{icon}</span>

      <span style={{ color: "#0f172a" }}>
        {text}
      </span>
    </div>
  );
}