import { buildProgressFeed } from "../lib/feed";
import type { FeedEvent } from "../types/feed";

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

type BusinessFeedPageProps = {
  onBack: () => void;
  progressEntries: ProgressEntry[];
  orders: Order[];
  employeeNameMap: Map<number, string>;
  onPreviewImage: (url: string) => void;
};

function getFeedIcon(type: FeedEvent["type"]) {
  switch (type) {
    case "progress":
      return "📸";

    case "invoice":
      return "🧾";

    case "order":
      return "✅";

    case "material":
      return "⚠️";

    case "bonus":
      return "⭐";

    default:
      return "📌";
  }
}

export default function BusinessFeedPage({
  onBack,
  progressEntries,
  orders,
  employeeNameMap,
  onPreviewImage,
}: BusinessFeedPageProps) {
  const feed = buildProgressFeed(
    progressEntries,
    orders,
    employeeNameMap
  );

  return (
    <section className="single-page-section">
      <div className="page-topbar">
        <div>
          <h1 style={{ fontSize: "24px" }}>🏗️ Unternehmens-Feed</h1>
          <p>Aktuelle Fortschritte und Bilder von aktiven Baustellen.</p>
        </div>

        <button type="button" className="btn btn-secondary" onClick={onBack}>
          Zurück
        </button>
      </div>

      <div className="card" style={{ marginTop: "24px" }}>
        {feed.length === 0 ? (
          <p>Keine neuen Fortschritte auf aktiven Baustellen vorhanden.</p>
        ) : (
          <div style={{ display: "grid", gap: "18px" }}>
            {feed.map((event) => (
              <div
                key={event.id}
                style={{
                  padding: "18px",
                  border: "1px solid #e5e7eb",
                  borderRadius: "14px",
                  background: "#ffffff",
                }}
              >
                <div style={{ display: "grid", gap: "6px", marginBottom: "12px" }}>
                  <strong style={{ fontSize: "17px" }}>
                    👷 {event.employeeName || "Mitarbeiter"}
                  </strong>

                  <span style={{ color: "#334155" }}>
                    🏠 {event.orderTitle || "Auftrag"}
                  </span>

                  <span style={{ color: "#64748b", fontSize: "14px" }}>
                    🕒 {new Date(event.created_at).toLocaleString("de-DE")}
                  </span>
                </div>

                <p
  style={{
    marginTop: "10px",
    marginBottom: "14px",
    color: "#0f172a",
    fontWeight: event.type === "invoice" ? 600 : 400,
  }}
>
  {getFeedIcon(event.type)}{" "}
  {event.description}
</p>

                {(event.imageUrls?.length ?? 0) > 0 && (
                  <div
                    style={{
                      display: "grid",
                      gridTemplateColumns: "repeat(auto-fit, minmax(140px, 1fr))",
                      gap: "12px",
                    }}
                  >
                    {(event.imageUrls ?? []).map((url) => (
                      <button
                        key={url}
                        type="button"
                        onClick={() => onPreviewImage(url)}
                        style={{
                          padding: 0,
                          border: "none",
                          background: "transparent",
                          cursor: "pointer",
                        }}
                      >
                        <img
                          src={url}
                          alt="Fortschrittsbild"
                          style={{
                            width: "100%",
                            height: "150px",
                            objectFit: "cover",
                            borderRadius: "10px",
                            border: "1px solid #ddd",
                          }}
                        />
                      </button>
                    ))}
                  </div>
                )}
              </div>
            ))}
          </div>
        )}
      </div>
    </section>
  );
}