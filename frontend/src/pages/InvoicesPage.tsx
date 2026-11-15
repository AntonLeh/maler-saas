import React, { useEffect, useRef, useState } from "react";
import { supabase } from "../lib/supabase";
import { generateInvoicePdf, snapshotSources } from "../lib/invoicePdf";
import { generateReminderPdf } from "../lib/reminderPdf";
import SendEmailDialog from "../modules/versand/SendEmailDialog";
import { loadSentInfo, type SentInfo } from "../modules/versand/api";
import { showAlert, showConfirm, showPrompt } from "../lib/dialogs";
import { Receipt, Search } from "lucide-react";
import MoreMenu from "../modules/rechnungen/MoreMenu";
import type { MenuItem } from "../modules/rechnungen/MoreMenu";
import { canRemind, isOpen, kpis, latestReminder, matches, nextStep, overdueDays, statusLabel, todayIso } from "../modules/rechnungen/logic";
import type { Filter } from "../modules/rechnungen/logic";
import "../modules/bi/bi.css";
import "../modules/rechnungen/rv.css";

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
  const [customerNames, setCustomerNames] = useState<Map<number, string>>(new Map());
  const [orderTitles, setOrderTitles] = useState<Map<number, string>>(new Map());
  const [currency, setCurrency] = useState("EUR");
  const [filter, setFilter] = useState<Filter>("all");
  const [query, setQuery] = useState("");

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
  // Namen für die Liste (Kunde, Auftragstitel) und die Währung des Betriebs
  const [cu, or, cs] = await Promise.all([
    supabase.from("customers").select("id, company_name, first_name, last_name").eq("tenant_id", userProfile.tenant_id),
    supabase.from("orders").select("id, title").eq("tenant_id", userProfile.tenant_id),
    supabase.from("company_settings").select("currency").eq("tenant_id", userProfile.tenant_id).maybeSingle(),
  ]);
  setCustomerNames(
    new Map(
      ((cu.data ?? []) as { id: number; company_name: string | null; first_name: string | null; last_name: string | null }[]).map((c) => [
        c.id,
        (c.company_name || `${c.first_name ?? ""} ${c.last_name ?? ""}`).trim() || `Kunde #${c.id}`,
      ]),
    ),
  );
  setOrderTitles(new Map(((or.data ?? []) as { id: number; title: string | null }[]).map((o) => [o.id, o.title || `Auftrag #${o.id}`])));
  const cur = (cs.data as { currency?: string } | null)?.currency;
  if (cur) setCurrency(String(cur));
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
    try {
      return new Intl.NumberFormat("de-DE", { style: "currency", currency: currency || "EUR" }).format(Number(value || 0));
    } catch {
      return new Intl.NumberFormat("de-DE", { style: "currency", currency: "EUR" }).format(Number(value || 0));
    }
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

  const today = todayIso();
  const stats = kpis(invoices, getInvoiceReminders, today);
  const words = query.toLowerCase().split(/\s+/).filter(Boolean);
  const shown = invoices.filter((i) => {
    if (!matches(i, filter, getInvoiceReminders, today) && i.id !== flashId) return false;
    if (!words.length) return true;
    const hay = `${i.invoice_number} ${customerNames.get(i.customer_id) ?? ""} ${orderTitles.get(i.order_id) ?? ""} ${i.order_id}`.toLowerCase();
    return words.every((w) => hay.includes(w));
  });
  const FILTERS: { key: Filter; label: string; count?: number }[] = [
    { key: "all", label: "Alle" },
    { key: "open", label: "Offen", count: stats.open.count },
    { key: "overdue", label: "Überfällig", count: stats.overdue.count },
    { key: "paid", label: "Bezahlt" },
    { key: "cancelled", label: "Storniert" },
  ];
  const showXHint = invoices.some((i) => i.snapshot && i.is_private_customer === false);

  const downloadX = async (invoice: Invoice) => {
    try {
      const { downloadXRechnung } = await import("../lib/einvoiceFiles");
      downloadXRechnung(invoice);
    } catch (e) {
      await showAlert(e instanceof Error ? e.message : "Die XRechnung konnte nicht erstellt werden.", { tone: "error", title: "Das hat nicht geklappt" });
    }
  };

  const rowActions = (invoice: Invoice) => {
    const reminders = getInvoiceReminders(invoice.id);
    const reminder = latestReminder(reminders) as InvoiceReminder | undefined;
    const step = nextStep(invoice, reminders, today);
    const remindAllowed = canRemind(invoice, reminders, today);
    const nextLevel = reminder ? reminder.reminder_level + 1 : 1;

    let primary: { label: string; onClick: () => void; tone?: string } | null = null;
    if (step === "paid") primary = { label: "Als bezahlt markieren", onClick: () => handleMarkInvoicePaid(invoice) };
    else if (step === "remind" && remindAllowed) primary = { label: `${nextLevel}. Mahnung erstellen`, onClick: () => handleCreateReminder(invoice), tone: "warn" };
    else if (step === "remind") primary = { label: "Als bezahlt markieren", onClick: () => handleMarkInvoicePaid(invoice) };
    else if (step === "sendReminder" && reminder)
      primary = { label: `${reminder.reminder_level}. Mahnung senden`, onClick: () => setMailFor({ kind: "reminder", invoice, reminder }), tone: "warn" };
    else primary = { label: "PDF", onClick: () => handleCreatePdf(invoice) };

    const items: MenuItem[] = [];
    if (primary.label !== "PDF") items.push({ label: "Rechnung als PDF", onClick: () => handleCreatePdf(invoice) });
    items.push({ label: "Rechnung per E-Mail senden", onClick: () => setMailFor({ kind: "invoice", invoice }) });
    if (invoice.snapshot && invoice.is_private_customer === false) items.push({ label: "XRechnung (XML) herunterladen", onClick: () => downloadX(invoice) });
    if (isOpen(invoice) && !primary.label.startsWith("Als bezahlt")) items.push({ label: "Als bezahlt markieren", onClick: () => handleMarkInvoicePaid(invoice) });
    if (remindAllowed && step !== "remind") items.push({ label: `${nextLevel}. Mahnung erstellen`, onClick: () => handleCreateReminder(invoice), separator: true });
    if (reminder && isOpen(invoice)) {
      items.push({ label: `${reminder.reminder_level}. Mahnung als PDF`, onClick: () => handleCreateReminderPdf(invoice, reminder), separator: !(remindAllowed && step !== "remind") });
      if (step !== "sendReminder") items.push({ label: `${reminder.reminder_level}. Mahnung per E-Mail`, onClick: () => setMailFor({ kind: "reminder", invoice, reminder }) });
      if (reminder.status === "created") items.push({ label: "Mahnung als versendet markieren", onClick: () => handleMarkReminderSent(reminder) });
    }
    if (invoice.document_type !== "cancellation" && (isOpen(invoice) || invoice.status === "paid"))
      items.push({ label: "Rechnung stornieren …", onClick: () => handleCancelInvoice(invoice), danger: true, separator: true });
    return { primary, items };
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
      <div className="bi2">
        <div className="bi2-top">
          <div>
            <h2>
              <Receipt size={24} aria-hidden="true" /> Rechnungen
            </h2>
            <p>Offene Beträge im Blick, Mahnungen mit einem Klick. Neue Rechnungen erstellen Sie im jeweiligen Auftrag.</p>
          </div>
          <div className="rv-top-actions">
            {onBackToBuchhaltung && (
              <button type="button" className="btn btn-secondary" onClick={onBackToBuchhaltung}>
                ← Buchhaltung
              </button>
            )}
            <button type="button" className="btn btn-secondary" onClick={onBack}>
              ← Zurück
            </button>
          </div>
        </div>

        {loading ? (
          <p className="bi2-muted">Rechnungen werden geladen …</p>
        ) : invoices.length === 0 ? (
          <section className="bi2-card">
            <p className="bi2-muted">Noch keine Rechnungen vorhanden. Rechnungen erstellen Sie im Auftrag über „Rechnung erstellen“.</p>
          </section>
        ) : (
          <>
            <section className="bi2-kpis four rv-kpis" aria-label="Überblick">
              <button type="button" className={`bi2-kpi${filter === "open" ? " sel" : ""}`} onClick={() => setFilter("open")}>
                <span>Offen</span>
                <b>{formatCurrency(stats.open.sum)}</b>
                <small>
                  {stats.open.count} Rechnung{stats.open.count === 1 ? "" : "en"}
                </small>
              </button>
              <button type="button" className={`bi2-kpi${stats.overdue.count > 0 ? " red" : ""}${filter === "overdue" ? " sel" : ""}`} onClick={() => setFilter("overdue")}>
                <span>Überfällig</span>
                <b>{formatCurrency(stats.overdue.sum)}</b>
                <small>
                  {stats.overdue.count} Rechnung{stats.overdue.count === 1 ? "" : "en"}
                </small>
              </button>
              <button type="button" className={`bi2-kpi${stats.dunned.count > 0 ? " yellow" : ""}`} onClick={() => setFilter("overdue")}>
                <span>Gemahnt</span>
                <b>{formatCurrency(stats.dunned.sum)}</b>
                <small>
                  {stats.dunned.count} Rechnung{stats.dunned.count === 1 ? "" : "en"} mit Mahnung
                </small>
              </button>
              <button type="button" className={`bi2-kpi green${filter === "paid" ? " sel" : ""}`} onClick={() => setFilter("paid")}>
                <span>Bezahlt diesen Monat</span>
                <b>{formatCurrency(stats.paidMonth.sum)}</b>
                <small>
                  {stats.paidMonth.count} Zahlung{stats.paidMonth.count === 1 ? "" : "en"}
                </small>
              </button>
            </section>

            <section className="bi2-card">
              <div className="bi2-tablebar">
                <div className="bi2-periods" role="tablist" aria-label="Filter">
                  {FILTERS.map((f) => (
                    <button key={f.key} type="button" role="tab" aria-selected={filter === f.key} className={filter === f.key ? "on" : ""} onClick={() => setFilter(f.key)}>
                      {f.label}
                      {f.count ? <span className="rv-count">{f.count}</span> : null}
                    </button>
                  ))}
                </div>
                <label className="rv-search">
                  <Search size={16} aria-hidden="true" />
                  <input type="search" placeholder="Nummer, Kunde oder Auftrag …" value={query} onChange={(e) => setQuery(e.target.value)} aria-label="Rechnungen durchsuchen" />
                </label>
              </div>

              {shown.length === 0 ? (
                <p className="bi2-muted">{query ? "Keine Rechnung gefunden." : "In dieser Ansicht gibt es keine Rechnungen."}</p>
              ) : (
                <div className="bi2-table-wrap">
                  <table className="bi2-table rv-table">
                    <thead>
                      <tr>
                        <th>Rechnung</th>
                        <th>Kunde / Auftrag</th>
                        <th>Datum</th>
                        <th>Fällig</th>
                        <th className="num">Betrag</th>
                        <th>Status</th>
                        <th />
                      </tr>
                    </thead>
                    <tbody>
                      {shown.map((invoice) => {
                        const reminders = getInvoiceReminders(invoice.id);
                        const st = statusLabel(invoice, reminders);
                        const late = overdueDays(invoice, reminders, today);
                        const lastReminder = latestReminder(reminders) as InvoiceReminder | undefined;
                        const lastMail = sentInfo.find((m) => m.invoice_id === invoice.id && m.kind === "invoice");
                        const reminderMail = lastReminder ? sentInfo.find((x) => x.reminder_id === lastReminder.id) : undefined;
                        const cancelled = invoices.find((i) => i.id === invoice.cancels_invoice_id);
                        const { primary, items } = rowActions(invoice);
                        return (
                          <tr
                            key={invoice.id}
                            id={`invoice-row-${invoice.id}`}
                            className={`${flashId === invoice.id ? "rv-flash" : ""}${["cancelled", "credited"].includes(invoice.status) || invoice.document_type === "cancellation" ? " rv-dim" : ""}`}
                          >
                            <td className="name" data-label="Rechnung">
                              {invoice.invoice_number}
                              <small className="sub">
                                {invoice.document_type === "cancellation" ? (
                                  <span className="bi2-chip rv-chip-storno">Storno{cancelled ? ` zu ${cancelled.invoice_number}` : ""}</span>
                                ) : invoice.invoice_type === "partial" ? (
                                  <span className="bi2-chip">
                                    Abschlag
                                    {invoice.partial_type === "percent" && invoice.partial_value != null
                                      ? ` · ${Number(invoice.partial_value).toLocaleString("de-DE", { maximumFractionDigits: 2 })} %`
                                      : ""}
                                  </span>
                                ) : (
                                  <span className="bi2-chip done">Schlussrechnung</span>
                                )}
                              </small>
                            </td>
                            <td data-label="Kunde / Auftrag" className="rv-who">
                              <b>{customerNames.get(invoice.customer_id) ?? "Kunde"}</b>
                              <small>{orderTitles.get(invoice.order_id) ?? `Auftrag #${invoice.order_id}`}</small>
                            </td>
                            <td data-label="Datum">{formatDate(invoice.invoice_date)}</td>
                            <td data-label="Fällig">
                              {formatDate(lastReminder?.new_due_date || invoice.due_date)}
                              {late > 0 && <small className="rv-late">seit {late} Tag{late === 1 ? "" : "en"} überfällig</small>}
                              {invoice.status === "paid" && invoice.paid_at && <small className="rv-ok">bezahlt am {formatDate(invoice.paid_at)}</small>}
                            </td>
                            <td className="num" data-label="Betrag">
                              <b>{formatCurrency(invoice.total_amount)}</b>
                              <small className="rv-net">netto {formatCurrency(invoice.subtotal)}</small>
                            </td>
                            <td data-label="Status">
                              <span className={`rv-status ${st.tone}`}>{st.text}</span>
                              {lastReminder?.status === "sent" && lastReminder.sent_at && (
                                <small className="rv-mail" title={reminderMail?.recipient}>
                                  Mahnung versendet {formatDate(lastReminder.sent_at)}
                                </small>
                              )}
                              {lastMail && (
                                <small className="rv-mail" title={lastMail.recipient}>
                                  ✉ Rechnung versendet {formatDate(lastMail.sent_at)}
                                </small>
                              )}
                            </td>
                            <td className="rv-actions">
                              <button type="button" className={`rv-primary${primary.tone ? ` ${primary.tone}` : ""}`} onClick={primary.onClick}>
                                {primary.label}
                              </button>
                              <MoreMenu items={items} />
                            </td>
                          </tr>
                        );
                      })}
                    </tbody>
                  </table>
                </div>
              )}
              {showXHint && (
                <p className="bi2-small">
                  XRechnung: Ihr Browser fragt beim Herunterladen eventuell, ob Sie die Datei behalten möchten. Die Datei enthält nur Ihre Rechnungsdaten – bitte „Beibehalten“ wählen.
                </p>
              )}
            </section>
          </>
        )}
      </div>
    </section>
  );
}
