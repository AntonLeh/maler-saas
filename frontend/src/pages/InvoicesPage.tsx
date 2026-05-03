import React, { useEffect, useState } from "react";
import { supabase } from "../lib/supabase";
import { generateInvoicePdf } from "../lib/invoicePdf";

type Invoice = {
  id: number;
  invoice_number: string;
  invoice_date: string;
  due_date: string;
  customer_id: number;
  order_id: number;
  subtotal: number;
  tax_rate: number;
  tax_amount: number;
  total_amount: number;
  status: string;
};

type InvoicesPageProps = {
  onBack: () => void;
};

export default function InvoicesPage({ onBack }: InvoicesPageProps) {
  const [invoices, setInvoices] = useState<Invoice[]>([]);
  const [loading, setLoading] = useState(true);

  const loadInvoices = async () => {
    setLoading(true);

    const { data, error } = await supabase
      .from("invoices")
      .select("*")
      .order("invoice_date", { ascending: false });

    if (error) {
      console.error("Fehler beim Laden der Rechnungen:", error);
      setInvoices([]);
      setLoading(false);
      return;
    }

    setInvoices((data as Invoice[]) || []);
    setLoading(false);
  };

  useEffect(() => {
    loadInvoices();
  }, []);

  const formatCurrency = (value: number | null | undefined) => {
    return new Intl.NumberFormat("de-DE", {
      style: "currency",
      currency: "EUR",
    }).format(Number(value || 0));
  };

  const formatDate = (value: string | null | undefined) => {
    if (!value) return "-";
    return new Date(value).toLocaleDateString("de-DE");
  };

    const handleCreatePdf = async (invoice: Invoice) => {
    const { data: order, error: orderError } = await supabase
      .from("orders")
      .select("*")
      .eq("id", invoice.order_id)
      .single();

    if (orderError) {
      console.error("Fehler beim Laden des Auftrags:", orderError);
      alert("Auftrag konnte für die Rechnung nicht geladen werden.");
      return;
    }

    const { data: customer, error: customerError } = await supabase
      .from("customers")
      .select("*")
      .eq("id", invoice.customer_id)
      .single();

    if (customerError) {
      console.error("Fehler beim Laden des Kunden:", customerError);
    }

    const { data: companySettings, error: settingsError } = await supabase
      .from("company_settings")
      .select("*")
      .single();

    if (settingsError) {
      console.error("Fehler beim Laden der Firmeneinstellungen:", settingsError);
    }

    const quoteId =
      order?.accepted_quote_id ??
      order?.quote_id ??
      order?.generated_quote_id ??
      null;

      alert("quoteId = " + quoteId);
      console.log("Geladener Auftrag:", order);

    console.log("Geladener Auftrag für Rechnung:", order);
    console.log("Gefundene quoteId:", quoteId);

    let quoteItems: any[] = [];

    if (quoteId) {
      const { data: items, error: itemsError } = await supabase
        .from("quote_items")
        .select("*")
        .eq("quote_id", quoteId)
        .order("id", { ascending: true });

      if (itemsError) {
        console.error("Fehler beim Laden der Rechnungspositionen:", itemsError);
      } else {
        quoteItems = items || [];
      }
    }

    generateInvoicePdf({
      invoice,
      invoiceItems: quoteItems,
      order,
      customer,
      companySettings,
      currencySymbol: companySettings?.currency_symbol || "€",
    });
  };

  return (
    <section className="single-page-section">
      <div className="card form-page-card">
        <div className="page-topbar">
          <div>
            <h2>Rechnungen</h2>
            <p>Verwaltung aller Rechnungen.</p>
          </div>

          <button type="button" className="btn btn-secondary" onClick={onBack}>
            Zurück zum Dashboard
          </button>
        </div>

        {loading ? (
          <p className="info-text">Rechnungen werden geladen...</p>
        ) : invoices.length === 0 ? (
          <div
            style={{
              marginTop: "24px",
              padding: "30px",
              borderRadius: "16px",
              background: "#f8fafc",
              border: "1px solid #e2e8f0",
              textAlign: "center",
              color: "#64748b",
            }}
          >
            Noch keine Rechnungen vorhanden.
          </div>
        ) : (
          <div className="table-wrapper" style={{ marginTop: "24px" }}>
            <table className="orders-table orders-table-wide">
              <thead>
                <tr>
                  <th>Rechnungsnummer</th>
                  <th>Datum</th>
                  <th>Fällig bis</th>
                  <th>Betrag</th>
                  <th>Status</th>
                  <th>Aktion</th>
                </tr>
              </thead>

              <tbody>
                {invoices.map((invoice) => (
                  <tr key={invoice.id}>
                    <td>
                      <strong>{invoice.invoice_number}</strong>
                      <div className="table-subtitle">
                        Auftrag #{invoice.order_id}
                      </div>
                    </td>

                    <td>{formatDate(invoice.invoice_date)}</td>

                    <td>{formatDate(invoice.due_date)}</td>

                    <td>
                      <strong>{formatCurrency(invoice.total_amount)}</strong>
                      <div className="table-subtitle">
                        Netto {formatCurrency(invoice.subtotal)} · MwSt.{" "}
                        {formatCurrency(invoice.tax_amount)}
                      </div>
                    </td>

                    <td>
                      <span className="status-badge status-geplant">
                        {invoice.status === "open"
                          ? "Offen"
                          : invoice.status === "paid"
                          ? "Bezahlt"
                          : invoice.status}
                      </span>
                    </td>

                    <td>
                        <button
                          type="button"
                          className="btn btn-secondary"
                          onClick={() => handleCreatePdf(invoice)}
                        >
                          PDF erstellen
                      </button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>
    </section>
  );
}