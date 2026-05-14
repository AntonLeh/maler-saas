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
  const currentStatus = order?.status || quote?.status || "draft";
  const currentStep = getPortalStep(currentStatus);
  const quoteItems = data.quote_items || [];
  const companySettings = data.company_settings || {};

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