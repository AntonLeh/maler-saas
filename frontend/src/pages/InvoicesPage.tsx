import React, { useEffect, useState } from "react";
import { supabase } from "../lib/supabase";
import { generateInvoicePdf } from "../lib/invoicePdf";
import { generateReminderPdf } from "../lib/reminderPdf";

type InvoiceReminder = {
  id: number;
  tenant_id: number;
  invoice_id: number;
  reminder_level: number;
  reminder_date: string;
  new_due_date: string | null;
  status: string;
  note: string | null;
  created_by: number | null;
  created_at: string;
  updated_at: string;
  sent_at: string | null;
};

type Invoice = {
  id: number;
  invoice_number: string;
  invoice_date: string;
  invoice_type?: "final" | "partial";
  partial_type?: "percent" | "fixed" | null;
  partial_value?: number | null;
  due_date: string;
  customer_id: number;
  order_id: number;
  subtotal: number;
  tax_rate: number;
  tax_amount: number;
  total_amount: number;
  status: string;
  paid_at: string | null;
};

type UserProfile = {
  id: number;
  tenant_id: number;
  role_id: number;
};

type InvoicesPageProps = {
  onBack: () => void;
  userProfile: UserProfile;
};

export default function InvoicesPage({ onBack, userProfile }: InvoicesPageProps) {
  const [invoices, setInvoices] = useState<Invoice[]>([]);
  const [invoiceReminders, setInvoiceReminders] = useState<InvoiceReminder[]>([]);
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
    setInvoiceReminders([]);
    setLoading(false);
    return;
  }

  const { data: remindersData, error: remindersError } = await supabase.rpc(
  "get_my_invoice_reminders"
);

  if (remindersError) {
    console.error("Fehler beim Laden der Mahnungen:", remindersError);
    setInvoiceReminders([]);
  } else {
    console.log("Geladene Mahnungen:", remindersData);
    setInvoiceReminders(
      (remindersData as InvoiceReminder[]) || []
    );
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
  .eq("tenant_id", userProfile.tenant_id)
  .maybeSingle();

if (settingsError) {
  console.error("Fehler beim Laden der Firmeneinstellungen:", settingsError);
}

    let quoteItems: any[] = [];

// 1. Zuerst versuchen: Quote-ID direkt aus Auftrag/Rechnung lesen
let quoteId =
  order?.accepted_quote_id ??
  order?.quote_id ??
  order?.generated_quote_id ??
  null;

// 2. Fallback: passende angenommene Quote über order_id suchen
if (!quoteId) {
  const { data: quote, error: quoteError } = await supabase
    .from("quotes")
    .select("id")
    .eq("order_id", Number(order.id))
    .eq("status", "accepted")
    .order("created_at", { ascending: false })
    .maybeSingle();

  if (quoteError) {
    console.error("Fehler beim Suchen des Angebots zur Rechnung:", quoteError);
  } else {
    quoteId = quote?.id ?? null;
  }
}

// 3. Positionen laden
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

let partialInvoices: any[] = [];

if (invoice.invoice_type === "final") {
  const { data: partialInvoiceData, error: partialInvoiceError } =
    await supabase
      .from("invoices")
      .select(
        "id, invoice_number, invoice_date, subtotal, tax_amount, total_amount, status, paid_at, partial_type, partial_value"
      )
      .eq("tenant_id", userProfile.tenant_id)
      .eq("order_id", invoice.order_id)
      .eq("invoice_type", "partial")
      .neq("status", "cancelled")
      .order("invoice_date", { ascending: true });

  if (partialInvoiceError) {
    console.error(
      "Fehler beim Laden der Abschlagsrechnungen:",
      partialInvoiceError
    );
  } else {
    partialInvoices = partialInvoiceData || [];
  }
}

    generateInvoicePdf({
  invoice,
  invoiceItems: quoteItems,
  order,
  customer,
  companySettings,
  partialInvoices,
  currencySymbol: companySettings?.currency_symbol || "€",
});
  };

const handleCreateReminder = async (invoice: Invoice) => {
  const confirmed = window.confirm(
    `Möchten Sie für die Rechnung ${invoice.invoice_number} eine Mahnung erstellen?`
  );

  if (!confirmed) {
    return;
  }

  const { data, error } = await supabase.rpc(
    "create_invoice_reminder",
    {
      p_invoice_id: invoice.id,
    }
  );

  if (error) {
    console.error("Fehler beim Erstellen der Mahnung:", error);
    alert(error.message || "Die Mahnung konnte nicht erstellt werden.");
    return;
  }

  alert(
    `Mahnung für ${invoice.invoice_number} wurde erfolgreich erstellt.`
  );

  console.log("Erstellte Mahnung ID:", data);
  await loadInvoices();
};

const handleCreateReminderPdf = async (
  invoice: Invoice,
  reminder: InvoiceReminder
) => {
  const { data: customer, error: customerError } = await supabase
    .from("customers")
    .select("*")
    .eq("id", invoice.customer_id)
    .single();

  if (customerError) {
    console.error(
      "Fehler beim Laden des Kunden für die Mahnung:",
      customerError
    );
  }

  const { data: companySettings, error: settingsError } = await supabase
    .from("company_settings")
    .select("*")
    .eq("tenant_id", userProfile.tenant_id)
    .maybeSingle();

  if (settingsError) {
    console.error(
      "Fehler beim Laden der Firmeneinstellungen für die Mahnung:",
      settingsError
    );
  }

  generateReminderPdf({
    reminder,
    invoice,
    customer,
    companySettings,
    currencySymbol: companySettings?.currency_symbol || "€",
  });
};

const handleMarkReminderSent = async (
  reminder: InvoiceReminder
) => {
  const confirmed = window.confirm(
    "Möchten Sie diese Mahnung als versendet markieren?"
  );

  if (!confirmed) {
    return;
  }

  const { error } = await supabase.rpc(
    "mark_invoice_reminder_sent",
    {
      p_reminder_id: reminder.id,
    }
  );

  if (error) {
    console.error(
      "Fehler beim Markieren der Mahnung als versendet:",
      error
    );

    alert(
      error.message ||
        "Die Mahnung konnte nicht als versendet markiert werden."
    );

    return;
  }

  alert("Die Mahnung wurde als versendet markiert.");

  await loadInvoices();
};

const handleMarkInvoicePaid = async (invoice: Invoice) => {
  const confirmed = window.confirm(
    `Möchten Sie die Rechnung ${invoice.invoice_number} als bezahlt markieren?`
  );

  if (!confirmed) {
    return;
  }

  const { error } = await supabase.rpc(
    "mark_invoice_paid",
    {
      p_invoice_id: invoice.id,
    }
  );

  if (error) {
    console.error(
      "Fehler beim Markieren der Rechnung als bezahlt:",
      error
    );

    alert(
      error.message ||
        "Die Rechnung konnte nicht als bezahlt markiert werden."
    );

    return;
  }

  alert(
    `Die Rechnung ${invoice.invoice_number} wurde als bezahlt markiert.`
  );

  await loadInvoices();
};

const getInvoiceReminders = (invoiceId: number) => {
  return invoiceReminders
    .filter((item) => item.invoice_id === invoiceId)
    .sort((a, b) => a.reminder_level - b.reminder_level);
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

  {invoice.invoice_type === "partial" && (
  <div>
    <span className="invoice-partial-badge">
      Abschlagsrechnung
      {invoice.partial_type === "percent" &&
      invoice.partial_value != null
        ? ` · ${Number(invoice.partial_value).toLocaleString("de-DE", {
            maximumFractionDigits: 2,
          })} %`
        : ""}
    </span>
  </div>
)}

  <div className="table-subtitle">
    Auftrag #{invoice.order_id}
  </div>
</td>

                    <td>{formatDate(invoice.invoice_date)}</td>

                    <td>
  {formatDate(invoice.due_date)}

  {getInvoiceReminders(invoice.id).map((reminder) => (
    <div
      key={reminder.id}
      className="table-subtitle"
    >
      {reminder.reminder_level}. Mahnung
      {reminder.status === "sent" && reminder.sent_at
        ? ` · versendet ${formatDate(reminder.sent_at)}`
        : reminder.status === "created"
        ? " · erstellt"
        : ""}
      {reminder.new_due_date
        ? ` · Frist ${formatDate(reminder.new_due_date)}`
        : ""}
    </div>
  ))}
</td>

                    <td>
                      <strong>{formatCurrency(invoice.total_amount)}</strong>
                      <div className="table-subtitle">
                        Netto {formatCurrency(invoice.subtotal)} · MwSt.{" "}
                        {formatCurrency(invoice.tax_amount)}
                      </div>
                    </td>

                    <td>
  <span
    className={`status-badge ${
      invoice.status === "paid"
        ? "status-paid"
        : "status-geplant"
    }`}
  >
    {invoice.status === "open"
      ? "Offen"
      : invoice.status === "paid"
      ? "Bezahlt"
      : invoice.status === "credited"
      ? "In Schlussrechnung übernommen"
      : invoice.status}
  </span>

  {invoice.status === "paid" && invoice.paid_at && (
    <div className="table-subtitle">
      am {formatDate(invoice.paid_at)}
    </div>
  )}
</td>

                    <td>
  <div
    style={{
      display: "flex",
      gap: "8px",
      flexWrap: "wrap",
    }}
  >
    <button
      type="button"
      className="btn btn-secondary"
      onClick={() => handleCreatePdf(invoice)}
    >
      PDF erstellen
    </button>

   {invoice.status === "open" && (
  <button
    type="button"
    className="btn btn-secondary"
    onClick={() => handleMarkInvoicePaid(invoice)}
  >
    Als bezahlt markieren
  </button>
)} 

   {invoice.status === "open" && (() => {
  const reminders = getInvoiceReminders(invoice.id);

  const reminder =
    reminders.length > 0
      ? reminders[reminders.length - 1]
      : undefined;

  const today = new Date().toLocaleDateString("sv-SE");

  if (!reminder) {
    const isOverdue =
      invoice.status === "open" &&
      invoice.due_date &&
      invoice.due_date < today;

    if (!isOverdue) {
      return null;
    }

    return (
      <button
        type="button"
        className="btn btn-secondary"
        onClick={() => handleCreateReminder(invoice)}
      >
        Mahnung erstellen
      </button>
    );
  }

  return (
    <>
      <button
        type="button"
        className="btn btn-secondary"
        onClick={() => handleCreateReminderPdf(invoice, reminder)}
      >
        Mahnung PDF
      </button>

      {reminder.status === "created" && (
  <button
    type="button"
    className="btn btn-secondary"
    onClick={() => handleMarkReminderSent(reminder)}
  >
    Als versendet markieren
  </button>
)}

      {reminder.reminder_level >= 3 ? (
        <button
          type="button"
          className="btn btn-secondary"
          disabled
        >
          3. Mahnstufe erreicht
        </button>
      ) : reminder.new_due_date &&
        reminder.new_due_date >= today ? (
        <button
          type="button"
          className="btn btn-secondary"
          disabled
        >
          {reminder.reminder_level}. Mahnung läuft
        </button>
      ) : (
        <button
          type="button"
          className="btn btn-secondary"
          onClick={() => handleCreateReminder(invoice)}
        >
          {reminder.reminder_level + 1}. Mahnung erstellen
        </button>
      )}
    </>
  );
})()}
  </div>
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