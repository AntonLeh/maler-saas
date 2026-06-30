import React, { useEffect, useMemo, useState } from "react";
import { supabase } from "../lib/supabase";
import { generateQuotePdf } from "../lib/quotePdf";
import { generateInvoicePdf } from "../lib/invoicePdf";

type PortalData = {
  quote?: any;
  quote_items?: any[];
  company_settings?: any;
  order?: any;
  invoice?: any;
  customer?: any;
  progress?: any[];
  assigned_employees?: any[];
  review_completed?: boolean;
};

const getPortalStatusLabel = (status?: string) => {
  switch (status) {
    case "draft":
      return "📝 Angebot in Vorbereitung";
    case "sent":
      return "📨 Angebot gesendet";
    case "accepted":
      return "🟡 Angebot bestätigt";
    case "neu":
      return "🔵 Auftrag geplant";
    case "in_arbeit":
      return "🟠 In Arbeit";
    case "pausiert":
      return "⏸️ Pausiert";
    case "zur_pruefung":
      return "🟣 Qualitätsprüfung";
    case "fertig":
      return "🟢 Fertiggestellt";
    case "abgerechnet":
      return "✅ Abgeschlossen";
    default:
      return status || "-";
  }
};

const getPortalStep = (status?: string) => {
  switch (status) {
    case "draft":
    case "sent":
      return 1;

    case "accepted":
      return 2;

    case "neu":
      return 3;

    case "in_arbeit":
    case "pausiert":
      return 4;

    case "zur_pruefung":
      return 5;

    case "fertig":
    case "abgerechnet":
      return 6;

    default:
      return 1;
  }
};

export default function CustomerPortalPage() {
  const [data, setData] = useState<PortalData | null>(null);
  const [loading, setLoading] = useState(true);
  const [errorMessage, setErrorMessage] = useState("");
  const [selectedImagePreview, setSelectedImagePreview] = useState<string | null>(null);
  const [overallRating, setOverallRating] = useState("");
  const [qualityRating, setQualityRating] = useState("");
  const [punctualityRating, setPunctualityRating] = useState("");
  const [cleanlinessRating, setCleanlinessRating] = useState("");
  const [friendlinessRating, setFriendlinessRating] = useState("");
  const [employeeRatings, setEmployeeRatings] = useState<Record<number, number>>({});
  const [employeeComments, setEmployeeComments] = useState<Record<number, string>>({});
  const [recommendation, setRecommendation] = useState("");
  const [customerComment, setCustomerComment] = useState("");

  const [reviewSent, setReviewSent] = useState(false);
  const [sendingReview, setSendingReview] = useState(false);
  const [showReviewForm, setShowReviewForm] = useState(false);
  const token = useMemo(() => {
    return new URLSearchParams(window.location.search).get("token") || "";
  }, []);

  useEffect(() => {
    const loadPortalData = async () => {
      if (!token) {
        setErrorMessage("Kein gültiger Kundenlink vorhanden.");
        setLoading(false);
        return;
      }

      const { data, error } = await supabase.rpc("get_customer_portal_data", {
        p_token: token,
      });

      if (error) {
  console.error("Fehler beim Laden des Kundenportals:", error);

  setErrorMessage(
    error.message || "Dieser Kundenlink ist ungültig oder abgelaufen."
  );

  setLoading(false);
  return;
}

      setData(data as PortalData);
      console.log("PortalData:", data);
      console.log("Progress:", data?.progress);
      setLoading(false);
    };

    loadPortalData();
  }, [token]);

  if (loading) {
    return (
      <div className="dashboard-page">
        <div className="dashboard-container">
          <div className="card">Kundenportal wird geladen...</div>
        </div>
      </div>
    );
  }

  if (errorMessage || !data) {
    return (
      <div className="dashboard-page">
        <div className="dashboard-container">
          <div className="card">
            <h2>Kundenportal</h2>
            <p className="info-text">{errorMessage}</p>
          </div>
        </div>
      </div>
    );
  }

  const quote = data.quote;
  const order = data.order;
  const invoice = data.invoice;
  const customer = data.customer;
  const progress = data.progress || [];
  const assignedEmployees = data.assigned_employees || [];
  
  const currentStatus = order?.status || quote?.status || "draft";
  const currentStep = getPortalStep(currentStatus);
  const quoteItems = data.quote_items || [];
  const companySettings = data.company_settings || {};

  const submitCustomerReview = async () => {
  if (!overallRating) {
    alert("Bitte geben Sie eine Gesamtbewertung ab.");
    return;
  }

  setSendingReview(true);

  try {
    const employeeReviews = assignedEmployees
      .filter((employee: any) => employeeRatings[employee.id])
      .map((employee: any) => ({
        employee_id: employee.id,
        rating: employeeRatings[employee.id],
        comment: employeeComments[employee.id] || null,
      }));

    const { data: result, error } = await supabase.rpc(
      "submit_customer_review",
      {
        p_token: token,
        p_overall_rating: Number(overallRating),
        p_quality_rating: qualityRating
          ? Number(qualityRating)
          : null,
        p_punctuality_rating: punctualityRating
          ? Number(punctualityRating)
          : null,
        p_cleanliness_rating: cleanlinessRating
          ? Number(cleanlinessRating)
          : null,
        p_friendliness_rating: friendlinessRating
          ? Number(friendlinessRating)
          : null,
        p_recommendation_score: recommendation
          ? Number(recommendation)
          : null,
        p_comment: customerComment,
        p_employee_reviews: employeeReviews,
      }
    );

    if (error) throw error;

    console.log(result);

    setReviewSent(true);
    setShowReviewForm(false);

  } catch (error) {
    console.error(error);
    alert("Bewertung konnte nicht gespeichert werden.");
  } finally {
    setSendingReview(false);
  }
};

  return (
    <div className="dashboard-page">
      <div className="dashboard-container">
        <section className="card">
          <h1>Kundenportal</h1>
          <p className="info-text">
  Willkommen im Kundenportal{" "}
  <strong>
    {customer?.company_name
      ? `der ${customer.company_name}`
      : `${customer?.first_name || ""} ${customer?.last_name || ""}`.trim() || "unseres Hauses"}
  </strong>.
  Hier können Sie den aktuellen Stand Ihres Projekts jederzeit transparent einsehen.
</p>
          <div
  style={{
    marginTop: "20px",
    display: "grid",
    gridTemplateColumns: "repeat(6, 1fr)",
    gap: "10px",
  }}
>
  {[
    "Angebot",
    "Bestätigt",
    "Geplant",
    "In Arbeit",
    "Prüfung",
    "Fertig",
  ].map((step, index) => {
    const stepNumber = index + 1;
    const active = currentStep >= stepNumber;

    return (
      <div
        key={step}
        style={{
          textAlign: "center",
          padding: "7px 6px",
          borderRadius: "8px",
          background: active ? "#6d916f" : "#e5e7eb",
          color: active ? "#fff" : "#6b7280",
          fontWeight: 600,
          fontSize: "11px",
          transition: "all .2s ease",
        }}
      >
        {step}
      </div>
    );
  })}
</div>
        </section>

        {quote && (
          <section className="card">
            <h2>Angebot</h2>
            <p>
              <strong>Angebotsnummer:</strong>{" "}
              {quote.quote_number || quote.number || quote.id}
            </p>
            <p>
              <strong>Status:</strong>{" "}
                <span className="status-badge">
                {getPortalStatusLabel(quote.status)}
                </span>
            </p>
            <p>
              <strong>Datum:</strong>{" "}
              {quote.quote_date
                ? new Date(quote.quote_date).toLocaleDateString("de-DE")
                : "-"}
            </p>

            {quote.total_amount && (
              <p>
                <strong>Gesamtbetrag:</strong>{" "}
                {Number(quote.total_amount).toLocaleString("de-CH", {
                  minimumFractionDigits: 2,
                  maximumFractionDigits: 2,
                })}
              </p>
            )}

            <div
  style={{
    display: "flex",
    gap: "6px",
    flexWrap: "wrap",
    marginTop: "14px",
  }}
>
  <button
    type="button"
    className="btn btn-secondary"
    onClick={() =>
      generateQuotePdf({
        quoteDetail: quote,
        quoteItems,
        companySettings,
        currencySymbol: companySettings.currency_symbol || "CHF",
        customers: customer ? [customer] : [],
      })
    }
  >
    📄 PDF-Angebot ansehen
  </button>

  <button
  type="button"
  className="btn btn-primary"
  onClick={async () => {
    const confirmed = window.confirm(
      "Möchten Sie dieses Angebot verbindlich bestätigen?"
    );

    if (!confirmed) return;

    const { data: result, error } = await supabase.rpc(
      "customer_accept_quote",
      {
        p_token: token,
      }
    );

    if (error) {
      console.error("Fehler beim Bestätigen des Angebots:", error);
      alert("Das Angebot konnte nicht bestätigt werden.");
      return;
    }

    alert(result?.message || "Angebot wurde bestätigt.");

    window.location.reload();
  }}
>
  ✅ Angebot bestätigen
</button>
</div>
          </section>
        )}

        {order && (
          <section className="card">
            <h2>Auftrag</h2>
            <p>
              <strong>Titel:</strong> {order.title || "-"}
            </p>
            <p>
              <strong>Status:</strong>{" "}
                <span className="status-badge">
                {getPortalStatusLabel(order.status)}
                </span>
            </p>
            <p>
              <strong>Adresse:</strong>{" "}
              {[order.address_street, order.address_zip, order.address_city]
                .filter(Boolean)
                .join(", ") || "-"}
            </p>
          </section>
        )}

        {invoice && (
  <section
    className="card"
    style={{
      background: "#f0fdf4",
      border: "1px solid #bbf7d0",
    }}
  >
    <h2>Rechnung</h2>

    <p>
      <strong>Rechnungsnummer:</strong>{" "}
      {invoice.invoice_number || invoice.number || invoice.id}
    </p>

    <p>
      <strong>Status:</strong>{" "}
      <span className="status-badge">
        {getPortalStatusLabel(invoice.status)}
      </span>
    </p>

    <p>
      <strong>Datum:</strong>{" "}
      {invoice.invoice_date
        ? new Date(invoice.invoice_date).toLocaleDateString("de-DE")
        : "-"}
    </p>

    <p>
      <strong>Gesamtbetrag:</strong>{" "}
      {Number(invoice.total_amount || invoice.total || 0).toLocaleString("de-CH", {
        minimumFractionDigits: 2,
        maximumFractionDigits: 2,
      })}{" "}
      {companySettings.currency_symbol || "CHF"}
    </p>

    <button
      type="button"
      className="btn btn-secondary"
      onClick={() =>
        generateInvoicePdf({
          invoice,
          order,
          customer,
          companySettings,
          currencySymbol: companySettings.currency_symbol || "CHF",
        })
      }
    >
      📄 PDF-Rechnung ansehen
    </button>
  </section>
)}

  {(order?.status === "fertig" || order?.status === "abgerechnet") && (
  <section
  className="card"
  style={{
    marginTop: 40,
    background: "#f8fbff",
    border: "2px solid #2563eb",
    borderRadius: 16,
    padding: 28,
    boxShadow: "0 10px 30px rgba(37,99,235,0.08)",
  }}
>
    <h2 style={{ color: "#1d4ed8", marginBottom: 10 }}>
  🌟 Ihre Meinung ist uns wichtig
</h2>

<p
  className="info-text"
  style={{
    fontSize: "15px",
    marginBottom: "24px",
  }}
>
  Vielen Dank, dass Sie uns Ihr Vertrauen geschenkt haben.
  <br />
  Mit Ihrer Bewertung helfen Sie uns, unseren Service
  kontinuierlich zu verbessern.
</p>

    <p className="info-text">
      Wie zufrieden waren Sie mit der Ausführung dieses Auftrags?
    </p>

    {reviewSent && (
  <div className="message-box success">
    ✅ Vielen Dank! Ihre Bewertung wurde erfolgreich gespeichert.
  </div>
)}

    <div
  style={{
    textAlign: "center",
    marginTop: 25,
    marginBottom: 15,
  }}
>
  <button
    type="button"
    className="btn btn-primary"
    onClick={() => setShowReviewForm(!showReviewForm)}
  >
    {showReviewForm ? "⬆️ Bewertung ausblenden" : "⭐ Bewertung starten"}
  </button>
</div>

    {showReviewForm && (
    <div className="form-stack">

  <div className="form-group">
    <label>⭐ Gesamtzufriedenheit</label>
    <select
      value={overallRating}
      onChange={(e) => setOverallRating(e.target.value)}
    >
      <option value="">Bitte auswählen</option>
      <option value="5">★★★★★ Sehr zufrieden</option>
      <option value="4">★★★★☆ Zufrieden</option>
      <option value="3">★★★☆☆ In Ordnung</option>
      <option value="2">★★☆☆☆ Verbesserungswürdig</option>
      <option value="1">★☆☆☆☆ Unzufrieden</option>
    </select>
  </div>

  <div className="form-group">
    <label>🎨 Arbeitsqualität</label>
    <select
      value={qualityRating}
      onChange={(e) => setQualityRating(e.target.value)}
    >
      <option value="">Bitte auswählen</option>
      <option value="5">★★★★★</option>
      <option value="4">★★★★☆</option>
      <option value="3">★★★☆☆</option>
      <option value="2">★★☆☆☆</option>
      <option value="1">★☆☆☆☆</option>
    </select>
  </div>

  <div className="form-group">
    <label>😊 Freundlichkeit</label>
    <select
      value={friendlinessRating}
      onChange={(e) => setFriendlinessRating(e.target.value)}
    >
      <option value="">Bitte auswählen</option>
      <option value="5">★★★★★</option>
      <option value="4">★★★★☆</option>
      <option value="3">★★★☆☆</option>
      <option value="2">★★☆☆☆</option>
      <option value="1">★☆☆☆☆</option>
    </select>
  </div>

  <div className="form-group">
    <label>🧹 Sauberkeit</label>
    <select
      value={cleanlinessRating}
      onChange={(e) => setCleanlinessRating(e.target.value)}
    >
      <option value="">Bitte auswählen</option>
      <option value="5">★★★★★</option>
      <option value="4">★★★★☆</option>
      <option value="3">★★★☆☆</option>
      <option value="2">★★☆☆☆</option>
      <option value="1">★☆☆☆☆</option>
    </select>
  </div>

  <div className="form-group">
    <label>⏰ Termintreue</label>
    <select
      value={punctualityRating}
      onChange={(e) => setPunctualityRating(e.target.value)}
    >
      <option value="">Bitte auswählen</option>
      <option value="5">★★★★★</option>
      <option value="4">★★★★☆</option>
      <option value="3">★★★☆☆</option>
      <option value="2">★★☆☆☆</option>
      <option value="1">★☆☆☆☆</option>
    </select>
  </div>

  <div className="form-group">
    <label>💬 Kommentar</label>

    <textarea
      rows={4}
      value={customerComment}
      onChange={(e) => setCustomerComment(e.target.value)}
      placeholder="Ihre Meinung ist uns wichtig..."
    />
  </div>

  <div className="form-group">
    <label>🤝 Würden Sie uns weiterempfehlen? (0 – 10) 0 = Nein 10 = Ja</label>

    <input
      type="number"
      min={0}
      max={10}
      value={recommendation}
      onChange={(e) => setRecommendation(e.target.value)}
    />
  </div>

{assignedEmployees.length > 0 && (
  <div style={{ marginTop: 30 }}>
    <h3>👷 Mitarbeiter bewerten (optional)</h3>

    <p className="info-text">
      Wenn Sie möchten, können Sie auch die einzelnen Mitarbeiter bewerten.
    </p>

    {assignedEmployees.map((employee: any) => (
      <div
        key={employee.id}
        className="card"
        style={{
          marginTop: 15,
          padding: 15,
          background: "#f8fafc",
        }}
      >
        <strong>
          {employee.first_name} {employee.last_name}
        </strong>

        <div className="form-group" style={{ marginTop: 12 }}>
          <label>Bewertung</label>

          <select
            value={employeeRatings[employee.id] || ""}
            onChange={(e) =>
              setEmployeeRatings({
                ...employeeRatings,
                [employee.id]: Number(e.target.value),
              })
            }
          >
            <option value="">Keine Bewertung</option>
            <option value="5">★★★★★</option>
            <option value="4">★★★★☆</option>
            <option value="3">★★★☆☆</option>
            <option value="2">★★☆☆☆</option>
            <option value="1">★☆☆☆☆</option>
          </select>
        </div>

        <div className="form-group">
          <label>Kommentar (optional)</label>

          <textarea
            rows={2}
            value={employeeComments[employee.id] || ""}
            onChange={(e) =>
              setEmployeeComments({
                ...employeeComments,
                [employee.id]: e.target.value,
              })
            }
          />
        </div>
      </div>
    ))}
  </div>
)}

  <button
  type="button"
  className="btn btn-primary"
  onClick={submitCustomerReview}
  disabled={sendingReview}
>
  {sendingReview ? "Bewertung wird gespeichert..." : "Bewertung absenden"}
</button>

</div>
)}
  </section>
)}

        <section className="card">
          <h2>Fortschritt</h2>

          {progress.length === 0 ? (
            <p className="info-text">
              Noch keine Fortschrittsmeldungen vorhanden.
            </p>
          ) : (
            <div className="list-grid">
              {progress.map((entry) => (
                <div key={entry.id} className="customer-item">
                  <div className="customer-meta">
                    <span>
                      {entry.created_at
                        ? new Date(entry.created_at).toLocaleString("de-DE")
                        : ""}
                    </span>
                    <span className="status-badge">
                    {getPortalStatusLabel(entry.status)}
                    </span>
                  </div>

                  <p style={{ marginTop: "0.5rem" }}>{entry.note}</p>

                  {entry.images?.length > 0 && (
                    <div
                      style={{
                        display: "grid",
                        gridTemplateColumns:
                          "repeat(auto-fit, minmax(140px, 1fr))",
                        gap: "10px",
                        marginTop: "12px",
                      }}
                    >
                      {entry.images.map((img: any) => (
                        <button
  key={img.id}
  type="button"
  onClick={() => setSelectedImagePreview(img.image_url)}
  style={{
    padding: 0,
    border: "none",
    background: "transparent",
    cursor: "pointer",
  }}
>
  <img
    src={img.image_url}
    alt="Fortschritt"
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
                  )}
                </div>
              ))}
            </div>
          )}
        </section>
      </div>

{selectedImagePreview && (
  <div
    onClick={() => setSelectedImagePreview(null)}
    style={{
      position: "fixed",
      inset: 0,
      background: "rgba(0,0,0,0.85)",
      zIndex: 9999,
      display: "flex",
      alignItems: "center",
      justifyContent: "center",
      padding: "20px",
    }}
  >
    <button
      type="button"
      onClick={(e) => {
        e.stopPropagation();
        setSelectedImagePreview(null);
      }}
      style={{
        position: "absolute",
        top: "18px",
        right: "18px",
        width: "42px",
        height: "42px",
        borderRadius: "50%",
        border: "none",
        background: "#fff",
        color: "#111",
        fontSize: "22px",
        fontWeight: 700,
        cursor: "pointer",
      }}
    >
      ✕
    </button>

    <img
      src={selectedImagePreview}
      alt="Fortschritt groß"
      onClick={(e) => e.stopPropagation()}
      style={{
        maxWidth: "100%",
        maxHeight: "85vh",
        borderRadius: "14px",
        background: "#fff",
        objectFit: "contain",
      }}
    />
  </div>
)}

    </div>



  );
}