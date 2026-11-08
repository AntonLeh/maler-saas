import React, { useEffect, useRef, useState } from "react";
import { supabase } from "../lib/supabase";
import { generateInvoicePdf, snapshotSources } from "../lib/invoicePdf";
import { generateReminderPdf } from "../lib/reminderPdf";
import SendEmailDialog from "../modules/versand/SendEmailDialog";
import { loadSentInfo, type SentInfo } from "../modules/versand/api";
import { showAlert, showConfirm, showPrompt } from "../lib/dialogs";

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
  // ab dem Update „rechtssichere Rechnungen“
  document_type?: "invoice" | "cancellation";
  snapshot?: Record<string, unknown> | null;
  cancels_invoice_id?: number | null;
  cancelled_by_invoice_id?: number | null;
  cancel_reason?: string | null;
  reverse_charge?: boolean;
  is_private_customer?: boolean | null;
  labor_amount?: number | null;
  labor_share_percent?: number | null;
  service_period_start?: string | null;
  service_period_end?: string | null;
};

type UserProfile = {
  id: number;
  tenant_id: number;
  role_id: number;
};

type InvoicesPageProps = {
  onBack: () => void;
  userProfile: UserProfile;
  /** z. B. Auftragsliste neu laden, wenn ein Storno den Auftrag wieder auf „Fertig“ setzt */
  onInvoicesChanged?: () => void;
  /** Rechnung, die nach dem Öffnen ins Bild gescrollt und markiert wird (z. B. aus „Offene Posten“) */
  highlightInvoiceId?: number | null;
  onHighlightShown?: () => void;
  /** gesetzt, wenn die Liste aus der Buchhaltung geöffnet wurde */
  onBackToBuchhaltung?: () => void;
};

export default function InvoicesPage({ onBack, userProfile, onInvoicesChanged, highlightInvoiceId = null, onHighlightShown, onBackToBuchhaltung }: InvoicesPageProps) {
  const [invoices, setInvoices] = useState<Invoice[]>([]);
  const [invoiceReminders, setInvoiceReminders] = useState<InvoiceReminder[]>([]);
  const [loading, setLoading] = useState(true);
  const [sentInfo, setSentInfo] = useState<SentInfo[]>([]);
  const [mailFor, setMailFor] = useState<{ kind: "invoice" | "reminder"; invoice: Invoice; reminder?: InvoiceReminder } | null>(null);

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
    setInvoiceReminders(
      (remindersData as InvoiceReminder[]) || []
    );
  }

  setSentInfo(await loadSentInfo());
  setInvoices((data as Invoice[]) || []);
  setLoading(false);
};

  useEffect(() => {
    loadInvoices();
  }, []);

  // aus „Offene Posten“: gewünschte Rechnung ins Bild holen und kurz hervorheben
  // bleibt markiert, solange die Rechnungsliste offen ist
  const [flashId] = useState<number | null>(highlightInvoiceId);
  const scrolledRef = useRef(false);
  const shownRef = useRef(onHighlightShown);
  useEffect(() => {
    shownRef.current = onHighlightShown;
  });
  useEffect(() => {
    if (!flashId || loading || scrolledRef.current) return;
    const row = document.getElementById(`invoice-row-${flashId}`);
    if (!row) return;
    scrolledRef.current = true;
    row.scrollIntoView({ behavior: "smooth", block: "center" });
    shownRef.current?.();
  }, [flashId, loading, invoices]);

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
    // Neue Rechnungen: nur die beim Erstellen eingefrorenen Angaben verwenden (GoBD)
    const frozen = snapshotSources(invoice);
    if (frozen) {
      // neue Rechnungen: ZUGFeRD-PDF (E-Rechnung mit eingebetteten Rechnungsdaten)
      try {
        const { downloadInvoicePdf, zugferdHint } = await import("../lib/einvoiceFiles");
        const res = await downloadInvoicePdf(invoice, frozen);
        const hint = zugferdHint(res, invoice);
        if (hint) await showAlert(hint);
      } catch (e) {
        console.error("PDF", e);
        await showAlert("Das PDF konnte nicht erstellt werden.", { tone: "error", title: "Das hat nicht geklappt" });
      }
      return;
    }
    const { data: order, error: orderError } = await supabase
      .from("orders")
      .select("*")
      .eq("id", invoice.order_id)
      .single();

    if (orderError) {
      console.error("Fehler beim Laden des Auftrags:", orderError);
      await showAlert("Auftrag konnte für die Rechnung nicht geladen werden.");
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
  const confirmed = await showConfirm(
    `Möchten Sie für die Rechnung ${invoice.invoice_number} eine Mahnung erstellen?`,
    { title: "Mahnung erstellen?", confirmLabel: "Ja, Mahnung erstellen" }
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
    await showAlert(error.message || "Die Mahnung konnte nicht erstellt werden.", { tone: "error", title: "Das hat nicht geklappt" });
    return;
  }

  await showAlert(
    `Mahnung für ${invoice.invoice_number} wurde erfolgreich erstellt.`,
    { tone: "success", title: "Erledigt" }
  );

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
  const confirmed = await showConfirm(
    "Möchten Sie diese Mahnung als versendet markieren?",
    { confirmLabel: "Ja" }
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

    await showAlert(
      error.message ||
        "Die Mahnung konnte nicht als versendet markiert werden.",
        { tone: "error", title: "Das hat nicht geklappt" }
    );

    return;
  }

  await showAlert("Die Mahnung wurde als versendet markiert.", { tone: "success", title: "Erledigt" });

  await loadInvoices();
};

const handleCancelInvoice = async (invoice: Invoice) => {
  const reason = await showPrompt(
    `Es wird eine Stornorechnung mit eigener Nummer erstellt. Danach können Sie eine neue, korrigierte Rechnung erstellen. Das lässt sich nicht rückgängig machen.\n\nGrund (optional, erscheint auf der Stornorechnung):`,
    { title: `Rechnung ${invoice.invoice_number} stornieren?`, tone: "warning", placeholder: "z. B. falscher Betrag", confirmLabel: "Ja, stornieren", danger: true }
  );
  if (reason === null) return;

  const { data, error } = await supabase.rpc("cancel_invoice", {
    p_invoice_id: invoice.id,
    p_reason: reason.trim() || null,
  });
  if (error) {
    console.error("Fehler beim Stornieren:", error);
    await showAlert(error.message || "Die Rechnung konnte nicht storniert werden.", { tone: "error", title: "Das hat nicht geklappt" });
    return;
  }
  await loadInvoices();
  onInvoicesChanged?.();
  await showAlert(
    invoice.invoice_type === "final"
      ? "Die Rechnung wurde storniert. Der Auftrag steht wieder auf „Fertig“ – Sie können jetzt eine neue Rechnung erstellen."
      : "Die Rechnung wurde storniert.");
};

const handleMarkInvoicePaid = async (invoice: Invoice) => {
  const confirmed = await showConfirm(
    `Möchten Sie die Rechnung ${invoice.invoice_number} als bezahlt markieren?`,
    { confirmLabel: "Ja, bezahlt" }
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

    await showAlert(
      error.message ||
        "Die Rechnung konnte nicht als bezahlt markiert werden.",
        { tone: "error", title: "Das hat nicht geklappt" }
    );

    return;
  }

  await showAlert(
    `Die Rechnung ${invoice.invoice_number} wurde als bezahlt markiert.`);

  await loadInvoices();
};

const getInvoiceReminders = (invoiceId: number) => {
  return invoiceReminders
    .filter((item) => item.invoice_id === invoiceId)
    .sort((a, b) => a.reminder_level - b.reminder_level);
};

  return (
    <section className="single-page-section">
      {mailFor && (
        <SendEmailDialog
          kind={mailFor.kind}
          invoice={mailFor.invoice}
          reminder={mailFor.reminder}
          tenantId={userProfile.tenant_id}
          onClose={() => setMailFor(null)}
          onSent={(info) => {
            setMailFor(null);
            void showAlert(`Die E-Mail wurde an ${info.to} gesendet.`, { tone: "success", title: "Erledigt" });
            loadInvoices();
          }}
        />
      )}
      <div className="card form-page-card">
        <div className="page-topbar">
          <div>
            <h2>Rechnungen</h2>
            <p>Verwaltung aller Rechnungen.</p>
          </div>

          <div style={{ display: "flex", gap: 8, flexWrap: "wrap", justifyContent: "flex-end" }}>
            {onBackToBuchhaltung && (
              <button type="button" className="btn btn-secondary" onClick={onBackToBuchhaltung}>
                Zurück zur Buchhaltung
              </button>
            )}
            <button type="button" className="btn btn-secondary" onClick={onBack}>
              Zurück zum Dashboard
            </button>
          </div>
        </div>

        {!loading && invoices.some((i) => i.snapshot && i.is_private_customer === false) && (
          <p style={{ margin: "4px 0 12px", padding: "8px 12px", borderRadius: 8, background: "#f1f5f9", color: "#475569", fontSize: 13 }}>
            Hinweis zur <strong>XRechnung</strong>: Ihr Browser fragt beim Herunterladen eventuell, ob Sie die Datei behalten möchten. Die
            Datei enthält nur Ihre Rechnungsdaten und ist sicher – bitte „Beibehalten“ wählen.
          </p>
        )}

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
                  <tr key={invoice.id} id={`invoice-row-${invoice.id}`} className={flashId === invoice.id ? "invoice-row-highlight" : undefined}>
                    <td>
  <strong>{invoice.invoice_number}</strong>

  {invoice.document_type === "cancellation" && (
    <div>
      <span className="invoice-partial-badge">
        Stornorechnung
        {invoices.find((i) => i.id === invoice.cancels_invoice_id)
          ? ` zu ${invoices.find((i) => i.id === invoice.cancels_invoice_id)?.invoice_number}`
          : ""}
      </span>
    </div>
  )}

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
        ? ` · versendet ${formatDate(reminder.sent_at)}${(() => {
            const m = sentInfo.find((x) => x.reminder_id === reminder.id);
            return m ? ` per E-Mail an ${m.recipient}` : "";
          })()}`
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
      : invoice.status === "cancelled"
      ? invoice.document_type === "cancellation"
        ? "Storno"
        : "Storniert"
      : invoice.status}
  </span>

  {invoice.status === "paid" && invoice.paid_at && (
    <div className="table-subtitle">
      am {formatDate(invoice.paid_at)}
    </div>
  )}
  {(() => {
    const last = sentInfo.find((m) => m.invoice_id === invoice.id && m.kind === "invoice");
    return last ? (
      <div className="table-subtitle" title={last.recipient}>
        ✉ versendet {formatDate(last.sent_at)} an {last.recipient}
      </div>
    ) : null;
  })()}
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

    <button
      type="button"
      className="btn btn-secondary"
      onClick={() => setMailFor({ kind: "invoice", invoice })}
    >
      Per E-Mail senden
    </button>

    {invoice.snapshot && invoice.is_private_customer === false && (
      <button
        type="button"
        className="btn btn-secondary"
        title="E-Rechnung als XML-Datei, z. B. für Behörden oder Firmen, die eine XRechnung verlangen"
        onClick={async () => {
          try {
            const { downloadXRechnung } = await import("../lib/einvoiceFiles");
            downloadXRechnung(invoice);
          } catch (e) {
            await showAlert(e instanceof Error ? e.message : "Die XRechnung konnte nicht erstellt werden.", { tone: "error", title: "Das hat nicht geklappt" });
          }
        }}
      >
        XRechnung
      </button>
    )}

   {invoice.status === "open" && (
  <button
    type="button"
    className="btn btn-secondary"
    onClick={() => handleMarkInvoicePaid(invoice)}
  >
    Als bezahlt markieren
  </button>
)} 

   {invoice.document_type !== "cancellation" &&
    (invoice.status === "open" || invoice.status === "paid") && (
  <button
    type="button"
    className="btn btn-secondary"
    onClick={() => handleCancelInvoice(invoice)}
  >
    Stornieren
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

      <button
        type="button"
        className="btn btn-secondary"
        onClick={() => setMailFor({ kind: "reminder", invoice, reminder })}
      >
        Mahnung per E-Mail
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