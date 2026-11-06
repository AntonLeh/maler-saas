// Dialog „Per E-Mail senden“ für Rechnungen und Mahnungen
import { useEffect, useState } from "react";
import { supabase } from "../../lib/supabase";
import { loadInvoicePdfSources } from "../../lib/invoiceSources";
import { generateReminderPdf } from "../../lib/reminderPdf";
import { eInvoiceIssues } from "../../lib/einvoice";
import { blobToBase64, sendDocument, type MailAttachment } from "./api";
import { invoiceMail, reminderMail } from "./texts";
import "../terminkalender/terminkalender.css";

/* eslint-disable @typescript-eslint/no-explicit-any */

type Props = {
  kind: "invoice" | "reminder";
  invoice: any;
  reminder?: any;
  tenantId: number;
  onClose: () => void;
  onSent: (info: { sent_at: string; to: string }) => void;
};

const fileSafe = (v: unknown) => String(v ?? "").replace(/[\\/:*?"<>|]+/g, "-").trim();

export default function SendEmailDialog({ kind, invoice, reminder, tenantId, onClose, onSent }: Props) {
  const [loading, setLoading] = useState(true);
  const [to, setTo] = useState("");
  const [subject, setSubject] = useState("");
  const [text, setText] = useState("");
  const [copy, setCopy] = useState(true);
  const [withXml, setWithXml] = useState(false);
  const [companyEmail, setCompanyEmail] = useState("");
  const [sending, setSending] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [ctx, setCtx] = useState<{ customer: any; company: any } | null>(null);

  const business = invoice?.is_private_customer === false;
  const canXml = kind === "invoice" && !!invoice?.snapshot && business;
  const zugferdIssues = kind === "invoice" && invoice?.snapshot ? eInvoiceIssues(invoice, "en16931") : [];

  useEffect(() => {
    let alive = true;
    (async () => {
      const [{ data: customer }, { data: company }] = await Promise.all([
        supabase.from("customers").select("*").eq("id", invoice.customer_id).maybeSingle(),
        supabase.from("company_settings").select("*").eq("tenant_id", tenantId).maybeSingle(),
      ]);
      if (!alive) return;
      const snapCustomer = (invoice?.snapshot as any)?.customer ?? {};
      const cust = { ...snapCustomer, ...(customer ?? {}) };
      const companyName = String(company?.company_name ?? (invoice?.snapshot as any)?.company?.company_name ?? "").trim();
      const symbol = company?.currency_symbol || "€";
      let cancelledNumber: string | null = (invoice?.snapshot as any)?.cancels?.invoice_number ?? null;
      if (!cancelledNumber && invoice?.cancels_invoice_id) {
        const { data } = await supabase.from("invoices").select("invoice_number").eq("id", invoice.cancels_invoice_id).maybeSingle();
        cancelledNumber = data?.invoice_number ?? null;
      }
      const mail =
        kind === "reminder"
          ? reminderMail({ invoice, reminder, customer: cust, companyName, symbol })
          : invoiceMail({ invoice, customer: cust, companyName, symbol, cancelledNumber });
      setTo(String((business && cust.einvoice_email) || cust.email || "").trim());
      setSubject(mail.subject);
      setText(mail.text);
      setCompanyEmail(String(company?.email ?? "").trim());
      setWithXml(canXml && !!String(cust.buyer_reference ?? "").trim());
      setCtx({ customer: cust, company });
      setLoading(false);
    })().catch((e) => {
      console.error(e);
      if (alive) {
        setError("Daten konnten nicht geladen werden.");
        setLoading(false);
      }
    });
    return () => {
      alive = false;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const send = async () => {
    setError(null);
    if (!to.trim()) return setError("Bitte die E-Mail-Adresse des Empfängers eintragen.");
    setSending(true);
    try {
      const attachments: MailAttachment[] = [];
      if (kind === "invoice") {
        const { buildInvoicePdf } = await import("../../lib/einvoiceFiles");
        const sources = await loadInvoicePdfSources(invoice, tenantId);
        const res = await buildInvoicePdf(invoice, sources);
        const base = `${invoice.document_type === "cancellation" ? "Stornorechnung" : "Rechnung"}-${fileSafe(invoice.invoice_number)}`;
        attachments.push({ name: `${base}.pdf`, content: await blobToBase64(res.blob) });
        if (withXml) {
          const { buildCii } = await import("../../lib/einvoice");
          const issues = eInvoiceIssues(invoice, "xrechnung");
          if (issues.length) throw new Error(`Die XRechnung kann noch nicht erstellt werden:\n• ${issues.map((i) => i.message).join("\n• ")}`);
          const xml = new Blob([buildCii(invoice, "xrechnung")], { type: "application/xml" });
          attachments.push({ name: `XRechnung-${fileSafe(invoice.invoice_number)}.xml`, content: await blobToBase64(xml) });
        }
      } else {
        const blob = generateReminderPdf({
          reminder,
          invoice,
          customer: ctx?.customer ?? null,
          companySettings: ctx?.company ?? {},
          currencySymbol: ctx?.company?.currency_symbol || "€",
          output: "blob",
        }) as Blob;
        attachments.push({ name: `${Number(reminder?.reminder_level) || 1}-Mahnung-${fileSafe(invoice.invoice_number)}.pdf`, content: await blobToBase64(blob) });
      }
      const out = await sendDocument({
        kind,
        invoice_id: Number(invoice.id),
        reminder_id: reminder ? Number(reminder.id) : undefined,
        to: to.trim(),
        subject,
        text,
        copy,
        attachments,
      });
      onSent({ sent_at: out.sent_at, to: out.to });
    } catch (e) {
      setError(e instanceof Error ? e.message : "Die E-Mail konnte nicht versendet werden.");
    } finally {
      setSending(false);
    }
  };

  const title = kind === "reminder" ? `${Number(reminder?.reminder_level) || 1}. Mahnung per E-Mail senden` : "Rechnung per E-Mail senden";
  const label: React.CSSProperties = { display: "block", fontWeight: 600, margin: "12px 0 4px" };
  const input: React.CSSProperties = { width: "100%", boxSizing: "border-box" };

  return (
    <div className="tk-root">
      <div className="tk-modal-backdrop" onMouseDown={() => !sending && onClose()}>
        <div className="tk-modal" role="dialog" aria-modal="true" aria-label={title} onMouseDown={(e) => e.stopPropagation()}>
          <div className="tk-modal-head">
            <h2>{title}</h2>
            <button type="button" className="btn btn-secondary" onClick={onClose} disabled={sending} aria-label="Schließen">
              ✕
            </button>
          </div>
          <div className="tk-modal-body">
            {loading ? (
              <p>Wird vorbereitet …</p>
            ) : (
              <>
                <label style={label} htmlFor="mail-to">
                  An
                </label>
                <input id="mail-to" type="email" style={input} value={to} onChange={(e) => setTo(e.target.value)} placeholder="kunde@beispiel.de" />
                {!to && <small style={{ color: "#b45309" }}>Beim Kunden ist keine E-Mail-Adresse hinterlegt – bitte eintragen.</small>}

                <label style={label} htmlFor="mail-subject">
                  Betreff
                </label>
                <input id="mail-subject" type="text" style={input} value={subject} onChange={(e) => setSubject(e.target.value)} />

                <label style={label} htmlFor="mail-text">
                  Text
                </label>
                <textarea id="mail-text" style={{ ...input, minHeight: 220, fontFamily: "inherit", fontSize: 14 }} value={text} onChange={(e) => setText(e.target.value)} />

                <div style={{ marginTop: 12, padding: "10px 12px", borderRadius: 8, background: "#f8fafc", fontSize: 14 }}>
                  <strong>Anhang:</strong>{" "}
                  {kind === "reminder"
                    ? "Mahnung als PDF"
                    : invoice?.snapshot && zugferdIssues.length === 0
                    ? "Rechnung als PDF (E-Rechnung ZUGFeRD)"
                    : "Rechnung als PDF"}
                  {kind === "invoice" && invoice?.snapshot && business && zugferdIssues.length > 0 && (
                    <div style={{ color: "#b45309", marginTop: 6 }}>
                      Ohne E-Rechnungsdaten, weil Angaben fehlen: {zugferdIssues.map((i) => i.message).join(" ")}
                    </div>
                  )}
                  {canXml && (
                    <label style={{ display: "flex", gap: 8, alignItems: "center", marginTop: 8 }}>
                      <input type="checkbox" checked={withXml} onChange={(e) => setWithXml(e.target.checked)} />
                      XRechnung (XML) zusätzlich anhängen – nur nötig, wenn der Kunde sie verlangt (z. B. Behörden)
                    </label>
                  )}
                  <label style={{ display: "flex", gap: 8, alignItems: "center", marginTop: 8 }}>
                    <input type="checkbox" checked={copy} onChange={(e) => setCopy(e.target.checked)} />
                    Kopie an mich{companyEmail ? ` (${companyEmail})` : ""}
                  </label>
                  <small style={{ display: "block", color: "#64748b", marginTop: 8 }}>
                    Antworten Ihres Kunden gehen an {companyEmail || "die E-Mail-Adresse aus den Einstellungen"}.
                  </small>
                </div>
              </>
            )}
            {error && (
              <div className="error-message" style={{ marginTop: 12, whiteSpace: "pre-line" }}>
                {error}
              </div>
            )}
          </div>
          <div className="tk-modal-foot">
            <button type="button" className="btn btn-secondary" onClick={onClose} disabled={sending}>
              Abbrechen
            </button>
            <button type="button" className="btn btn-primary" onClick={send} disabled={loading || sending}>
              {sending ? "Wird gesendet …" : "Jetzt senden"}
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
