// Dialog „Angebot per E-Mail senden“ – nutzt den bestehenden Versand (Funktion send-document)
import { useEffect, useState } from "react";
import { supabase } from "../../lib/supabase";
import { generateQuotePdf } from "../../lib/quotePdf";
import { blobToBase64, sendDocument } from "../versand/api";
import { quoteMail } from "../versand/texts";
import "../terminkalender/terminkalender.css";

/* eslint-disable @typescript-eslint/no-explicit-any */

type Props = {
  quote: any;
  items: any[];
  tenantId: number;
  customers: any[];
  canPortal: boolean; // Kundenportal im Tarif enthalten?
  onClose: () => void;
  onSent: (info: { sent_at: string; to: string }) => void;
};

const fileSafe = (v: unknown) => String(v ?? "").replace(/[\\/:*?"<>|]+/g, "-").trim();
const LINK_INTRO = "Sie können das Angebot auch online ansehen und direkt bestätigen:";

export default function QuoteEmailDialog({ quote, items, tenantId, customers, canPortal, onClose, onSent }: Props) {
  const [loading, setLoading] = useState(true);
  const [to, setTo] = useState("");
  const [subject, setSubject] = useState("");
  const [text, setText] = useState("");
  const [copy, setCopy] = useState(true);
  const [withLink, setWithLink] = useState(false);
  const [linkBusy, setLinkBusy] = useState(false);
  const [companyEmail, setCompanyEmail] = useState("");
  const [company, setCompany] = useState<any>(null);
  const [sending, setSending] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let alive = true;
    (async () => {
      const [{ data: customer }, { data: comp }] = await Promise.all([
        supabase.from("customers").select("*").eq("id", quote.customer_id).maybeSingle(),
        supabase.from("company_settings").select("*").eq("tenant_id", tenantId).maybeSingle(),
      ]);
      if (!alive) return;
      const mail = quoteMail({ quote, customer, companyName: String(comp?.company_name ?? "").trim(), symbol: comp?.currency_symbol || "€" });
      setTo(String(customer?.email ?? "").trim());
      setSubject(mail.subject);
      setText(mail.text);
      setCompanyEmail(String(comp?.email ?? "").trim());
      setCompany(comp);
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

  /** Kundenlink erzeugen und vor dem Gruß in den Text einfügen (bzw. wieder entfernen) */
  const toggleLink = async (on: boolean) => {
    setError(null);
    if (!on) {
      setText((t) => t.replace(new RegExp(`\\n*${LINK_INTRO}\\n\\S+`), ""));
      setWithLink(false);
      return;
    }
    setLinkBusy(true);
    try {
      const { data: token, error: rpcError } = await supabase.rpc("create_customer_portal_link", { p_quote_id: Number(quote.id) });
      if (rpcError || typeof token !== "string" || !token.trim()) throw new Error(rpcError?.message || "Kundenlink konnte nicht erstellt werden.");
      const url = `${window.location.origin}/customer-view?token=${token}`;
      const block = `${LINK_INTRO}\n${url}`;
      setText((t) => {
        const i = t.lastIndexOf("\n\nMit freundlichen Grüßen");
        return i >= 0 ? `${t.slice(0, i)}\n\n${block}${t.slice(i)}` : `${t.trim()}\n\n${block}`;
      });
      setWithLink(true);
    } catch (e) {
      setError(e instanceof Error ? e.message : "Kundenlink konnte nicht erstellt werden.");
    } finally {
      setLinkBusy(false);
    }
  };

  const send = async () => {
    setError(null);
    if (!to.trim()) return setError("Bitte die E-Mail-Adresse des Empfängers eintragen.");
    setSending(true);
    try {
      const blob = generateQuotePdf({
        quoteDetail: quote,
        quoteItems: items,
        companySettings: company ?? {},
        currencySymbol: company?.currency_symbol || "€",
        customers,
        output: "blob",
      }) as Blob;
      const out = await sendDocument({
        kind: "quote",
        quote_id: Number(quote.id),
        to: to.trim(),
        subject,
        text,
        copy,
        attachments: [{ name: `Angebot-${fileSafe(quote.quote_number || quote.id)}.pdf`, content: await blobToBase64(blob) }],
      });
      onSent({ sent_at: out.sent_at, to: out.to });
    } catch (e) {
      setError(e instanceof Error ? e.message : "Die E-Mail konnte nicht versendet werden.");
    } finally {
      setSending(false);
    }
  };

  const title = "Angebot per E-Mail senden";
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
                <label style={label} htmlFor="q-mail-to">An</label>
                <input id="q-mail-to" type="email" style={input} value={to} onChange={(e) => setTo(e.target.value)} placeholder="kunde@beispiel.de" />
                {!to && <small style={{ color: "#b45309" }}>Beim Kunden ist keine E-Mail-Adresse hinterlegt – bitte eintragen.</small>}

                <label style={label} htmlFor="q-mail-subject">Betreff</label>
                <input id="q-mail-subject" type="text" style={input} value={subject} onChange={(e) => setSubject(e.target.value)} />

                <label style={label} htmlFor="q-mail-text">Text</label>
                <textarea id="q-mail-text" style={{ ...input, minHeight: 220, fontFamily: "inherit", fontSize: 14 }} value={text} onChange={(e) => setText(e.target.value)} />

                <div style={{ marginTop: 12, padding: "10px 12px", borderRadius: 8, background: "#f8fafc", fontSize: 14 }}>
                  <strong>Anhang:</strong> Angebot als PDF
                  {canPortal && (
                    <label style={{ display: "flex", gap: 8, alignItems: "center", marginTop: 8 }}>
                      <input type="checkbox" checked={withLink} disabled={linkBusy} onChange={(e) => void toggleLink(e.target.checked)} />
                      {linkBusy ? "Kundenlink wird erstellt …" : "Kundenlink einfügen – der Kunde kann das Angebot online ansehen und bestätigen"}
                    </label>
                  )}
                  <label style={{ display: "flex", gap: 8, alignItems: "center", marginTop: 8 }}>
                    <input type="checkbox" checked={copy} onChange={(e) => setCopy(e.target.checked)} />
                    Kopie an mich{companyEmail ? ` (${companyEmail})` : ""}
                  </label>
                  <small style={{ display: "block", color: "#64748b", marginTop: 8 }}>
                    Antworten Ihres Kunden gehen an {companyEmail || "die E-Mail-Adresse aus den Einstellungen"}.
                    {quote.status === "draft" ? " Nach dem Senden steht das Angebot auf „Gesendet“." : ""}
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
            <button type="button" className="btn btn-secondary" onClick={onClose} disabled={sending}>Abbrechen</button>
            <button type="button" className="btn btn-primary" onClick={send} disabled={loading || sending || linkBusy}>
              {sending ? "Wird gesendet …" : "Jetzt senden"}
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
