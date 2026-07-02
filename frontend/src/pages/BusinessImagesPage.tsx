type ProgressEntry = {
  id: number;
  tenant_id: number;
  order_id: string;
  user_id: number;
  status: string;
  note: string;
  created_at: string;
  images?: {
    id: number;
    image_url: string;
  }[];
};

type Order = {
  id: string | number;
  title: string;
  status: string;
};

type BusinessImagesPageProps = {
  onBack: () => void;
  progressEntries: ProgressEntry[];
  orders: Order[];
  employeeNameMap: Map<number, string>;
  onPreviewImage: (url: string) => void;
};

export default function BusinessImagesPage({
  onBack,
  progressEntries,
  orders,
  employeeNameMap,
  onPreviewImage,
}: BusinessImagesPageProps) {
  return (
    <section className="single-page-section">
      <div className="page-topbar">
        <div>
          <h1 style={{ fontSize: "24px" }}>
            📸 Baustellen-Feed
          </h1>

          <p>
            Neue Fortschrittsbilder aller aktiven Baustellen.
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
  <h2>Neue Bilder</h2>

  {progressEntries.filter((entry) => (entry.images?.length ?? 0) > 0).length === 0 ? (
    <p>Keine Fortschrittsbilder auf aktiven Baustellen vorhanden.</p>
  ) : (
    <div style={{ display: "grid", gap: "18px", marginTop: "18px" }}>
      {progressEntries
        .filter((entry) => {
          const order = orders.find(
            (o) => String(o.id) === String(entry.order_id)
          );

          return (
            order &&
            order.status !== "fertig" &&
            order.status !== "abgerechnet" &&
            (entry.images?.length ?? 0) > 0
          );
        })
        .map((entry) => {
          const order = orders.find(
            (o) => String(o.id) === String(entry.order_id)
          );

          return (
            <div
              key={entry.id}
              style={{
                padding: "16px",
                border: "1px solid #e5e7eb",
                borderRadius: "12px",
                background: "#fff",
              }}
            >
              <strong>{order?.title || "Auftrag"}</strong>
              <p style={{ marginTop: "6px", color: "#64748b" }}>
                👷 {employeeNameMap.get(entry.user_id) || `Mitarbeiter #${entry.user_id}`} ·{" "}
                {new Date(entry.created_at).toLocaleString("de-DE")}
              </p>

              {entry.note && <p>{entry.note}</p>}

              <div
                style={{
                  display: "grid",
                  gridTemplateColumns: "repeat(auto-fit, minmax(140px, 1fr))",
                  gap: "12px",
                  marginTop: "12px",
                }}
              >
                {(entry.images ?? []).map((img) => (
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
                      alt="Fortschrittsbild"
                      style={{
                        width: "100%",
                        height: "140px",
                        objectFit: "cover",
                        borderRadius: "10px",
                        border: "1px solid #ddd",
                      }}
                    />
                  </button>
                ))}
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