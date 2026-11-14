/* eslint-disable @typescript-eslint/no-explicit-any -- Portaldaten kommen untypisiert aus der Datenbankfunktion */
import React, { useEffect, useMemo, useState } from "react";
import { supabase } from "../lib/supabase";
import { generateQuotePdf } from "../lib/quotePdf";
import { generateInvoicePdf, snapshotSources } from "../lib/invoicePdf";
import { showAlert, showConfirm } from "../lib/dialogs";
import "./CustomerPortal.css";

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
    case "rejected":
      return "Angebot abgelehnt";
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

/** Freundliche Meldungen für den Endkunden statt Datenbank-Texten */
function portalErrorText(raw?: string): string {
  const m = String(raw ?? "").toLowerCase();
  if (m.includes("ungültig") || m.includes("abgelaufen"))
    return "Dieser Link ist ungültig oder abgelaufen. Bitte fordern Sie bei Ihrem Malerbetrieb einen neuen Link an.";
  return "Dieser Link ist im Moment nicht verfügbar. Bitte wenden Sie sich an Ihren Malerbetrieb.";
}

function acceptErrorText(raw?: string): string {
  const m = String(raw ?? "").toLowerCase();
  if (m.includes("angebot ist abgelaufen"))
    return "Dieses Angebot ist leider abgelaufen. Bitte wenden Sie sich an Ihren Malerbetrieb für ein aktuelles Angebot.";
  if (m.includes("abgelehnt"))
    return "Dieses Angebot wurde als abgelehnt markiert. Bitte wenden Sie sich an Ihren Malerbetrieb.";
  return "Das Angebot konnte gerade nicht bestätigt werden. Bitte versuchen Sie es später erneut oder wenden Sie sich an Ihren Malerbetrieb.";
}

export default function CustomerPortalPage() {
    useEffect(() => {
    const robotsMeta = document.querySelector(
      'meta[name="robots"]'
    ) as HTMLMetaElement | null;

    const previousContent = robotsMeta?.content;

    if (robotsMeta) {
      robotsMeta.content = "noindex, nofollow";
    }

    return () => {
      if (robotsMeta && previousContent) {
        robotsMeta.content = previousContent;
      }
    };
  }, []);

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
  // Einwilligung: Bewertung auf der Website des Betriebs zeigen (nur wenn der Betrieb eine Website hat)
  const [publishInfo, setPublishInfo] = useState<{ available: boolean; consent_text?: string } | null>(null);
  const [publishConsent, setPublishConsent] = useState(false);
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

  // Dem Endkunden nie technische Meldungen zeigen
  setErrorMessage(portalErrorText(error.message));

  setLoading(false);
  return;
}

      setData(data as PortalData);
      setLoading(false);
    };

    loadPortalData();
  }, [token]);

  useEffect(() => {
    if (!token) return;
    supabase
      .rpc("website_review_consent_info", { p_token: token })
      .then(({ data, error }) => {
        // Fehlt das Datenbank-Update oder hat der Betrieb keine Website, bleibt das Häkchen einfach weg
        if (!error && data?.available) setPublishInfo(data);
      });
  }, [token]);

  if (loading) {
    return (
      <div className="cp-page">
        <div className="cp-wrap">
          <div className="cp-card cp-center">Ihr Projekt wird geladen …</div>
        </div>
      </div>
    );
  }

  if (errorMessage || !data) {
    return (
      <div className="cp-page">
        <div className="cp-wrap">
          <div className="cp-card cp-center">
            <h2>Link nicht verfügbar</h2>
            <p className="cp-sub">{errorMessage}</p>
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
    await showAlert("Bitte geben Sie eine Gesamtbewertung ab.", { tone: "warning", title: "Bitte prüfen" });
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


    // Einwilligung zur Veröffentlichung separat speichern (Fehler hier dürfen die Bewertung nicht stören)
    if (publishConsent && publishInfo?.available && result?.review_id) {
      const { error: consentError } = await supabase.rpc("website_review_consent", {
        p_token: token,
        p_review_id: result.review_id,
      });
      if (consentError) console.error("Einwilligung konnte nicht gespeichert werden:", consentError);
    }

    setReviewSent(true);
    setShowReviewForm(false);

    } catch (error: any) {
    console.error("Fehler beim Speichern der Kundenbewertung:", error);

    const errorMessage = String(error?.message || "");

    if (
      errorMessage.includes(
        "Für diesen Auftrag wurde bereits eine Bewertung abgegeben"
      )
    ) {
      setReviewSent(true);
      setShowReviewForm(false);

      await showAlert(
        "Vielen Dank! Für diesen Auftrag wurde bereits eine Bewertung abgegeben.");
    } else if (
      errorMessage.includes("Ungültiger oder abgelaufener Kundenlink") ||
      errorMessage.includes("Ungültiger Kundenlink")
    ) {
      await showAlert(
        "Dieser Kundenlink ist nicht mehr gültig. Bitte wenden Sie sich an den ausführenden Betrieb.");
    } else {
      await showAlert(
        "Ihre Bewertung konnte gerade nicht gespeichert werden. Bitte versuchen Sie es später noch einmal.",
        { tone: "error", title: "Das hat nicht geklappt" }
      );
    }
  } finally {
    setSendingReview(false);
  }
};

  const symbol = companySettings.currency_symbol || (companySettings.currency === "CHF" ? "CHF" : "€");
  const firmName = companySettings.company_name || "Ihr Malerbetrieb";
  const customerName = customer?.company_name || `${customer?.first_name || ""} ${customer?.last_name || ""}`.trim();
  const phone = String(companySettings.phone || "").trim();
  const email = String(companySettings.email || "").trim();
  const quoteOpen = !!quote && (quote.status === "sent" || quote.status === "draft") && !order;
  const invoicePaid = isPaid(invoice?.status);
  const invoiceDue = invoice ? dueDate(invoice, companySettings) : null;
  const finished = order?.status === "fertig" || order?.status === "abgerechnet";
  const latestImages = progress
    .slice()
    .reverse()
    .flatMap((e) => e.images || [])
    .slice(0, 4);
  const steps = ["Angebot", "Bestätigt", "Geplant", "In Arbeit", "Prüfung", "Fertig"];

  const acceptQuote = async () => {
    const confirmed = await showConfirm("Möchten Sie dieses Angebot verbindlich bestätigen?", { title: "Angebot annehmen", confirmLabel: "Ja, verbindlich bestätigen" });
    if (!confirmed) return;
    const { data: result, error } = await supabase.rpc("customer_accept_quote", { p_token: token });
    if (error) {
      console.error("Fehler beim Bestätigen des Angebots:", error);
      await showAlert(acceptErrorText(error.message), { tone: "error", title: "Das hat nicht geklappt" });
      return;
    }
    await showAlert(result?.message || "Vielen Dank! Ihr Angebot wurde bestätigt.", { tone: "success", title: "Bestätigt" });
    window.location.reload();
  };

  const openQuotePdf = () =>
    generateQuotePdf({ quoteDetail: quote, quoteItems, companySettings, currencySymbol: symbol, customers: customer ? [customer] : [] });

  const openInvoicePdf = () => {
    const frozen = snapshotSources(invoice);
    if (frozen) {
      import("../lib/einvoiceFiles")
        .then(({ downloadInvoicePdf }) => downloadInvoicePdf(invoice, frozen))
        .catch((e) => {
          console.error("PDF", e);
          void showAlert("Das PDF konnte nicht erstellt werden.", { tone: "error", title: "Das hat nicht geklappt" });
        });
      return;
    }
    generateInvoicePdf({ invoice, invoiceItems: quoteItems || [], order, customer, companySettings, currencySymbol: symbol });
  };

  // Nächster Schritt für den Kunden
  let next: React.ReactNode = null;
  if (quoteOpen) {
    next = (
      <>
        <h2>Ihr Angebot liegt bereit</h2>
        <p>Bitte prüfen Sie das Angebot. Wenn alles passt, bestätigen Sie es mit einem Klick – wir melden uns dann zur Terminplanung.</p>
        <div className="cp-facts">
          <div>
            <span>Betrag</span>
            <b>{money(quote.total_amount, symbol)}</b>
          </div>
          {quote.valid_until && (
            <div>
              <span>Gültig bis</span>
              <b>{date(quote.valid_until)}</b>
            </div>
          )}
        </div>
        <div className="cp-actions">
          <button type="button" className="btn btn-secondary" onClick={openQuotePdf}>
            📄 Angebot ansehen (PDF)
          </button>
          <button type="button" className="btn btn-primary" onClick={acceptQuote}>
            ✅ Angebot verbindlich bestätigen
          </button>
        </div>
      </>
    );
  } else if (invoice && !invoicePaid) {
    next = (
      <>
        <h2>Ihre Rechnung</h2>
        <p>Vielen Dank für Ihren Auftrag! Hier finden Sie Ihre Rechnung.</p>
        <div className="cp-facts">
          <div>
            <span>Betrag</span>
            <b>{money(invoice.total_amount ?? invoice.total, symbol)}</b>
          </div>
          {invoiceDue && (
            <div>
              <span>Fällig bis</span>
              <b>{date(invoiceDue)}</b>
            </div>
          )}
          <div>
            <span>Rechnungsnummer</span>
            <b>{invoice.invoice_number || invoice.number || invoice.id}</b>
          </div>
        </div>
        {companySettings.iban && (
          <div className="cp-bank">
            <b>Bitte überweisen an</b>
            <span>{firmName}</span>
            <span>IBAN: {formatIban(companySettings.iban)}</span>
            {companySettings.bic && <span>BIC: {companySettings.bic}</span>}
            {companySettings.bank_name && <span>{companySettings.bank_name}</span>}
            <span>Verwendungszweck: {invoice.invoice_number || invoice.number || invoice.id}</span>
          </div>
        )}
        <div className="cp-actions">
          <button type="button" className="btn btn-primary" onClick={openInvoicePdf}>
            📄 Rechnung ansehen (PDF)
          </button>
        </div>
      </>
    );
  } else if (finished) {
    next = null; // Bewertung folgt unten als eigener Kasten
  } else if (order) {
    next = (
      <>
        <h2>{order.status === "neu" ? "Ihr Auftrag ist eingeplant" : order.status === "pausiert" ? "Ihr Auftrag ist kurz pausiert" : "Wir sind für Sie im Einsatz"}</h2>
        <p>
          {order.status === "neu"
            ? "Wir haben Ihren Auftrag eingeplant. Hier sehen Sie, sobald es losgeht."
            : "Unten sehen Sie den aktuellen Baufortschritt mit Fotos. Bei Fragen erreichen Sie uns jederzeit."}
        </p>
        {latestImages.length > 0 && (
          <div className="cp-thumbs">
            {latestImages.map((img: any, i: number) => (
              <button type="button" key={i} onClick={() => setSelectedImagePreview(img.image_url)}>
                <img src={img.image_url} alt="Foto vom Baufortschritt" loading="lazy" />
              </button>
            ))}
          </div>
        )}
      </>
    );
  }

  return (
    <div className="cp-page">
      <div className="cp-wrap">
        <header className="cp-head">
          <div className="cp-firm">
            {companySettings.logo_url ? <img src={companySettings.logo_url} alt={firmName} /> : <span className="cp-firm-initial">{firmName.slice(0, 1)}</span>}
            <div>
              <b>{firmName}</b>
              <small>Ihr Projekt{order?.title ? `: ${order.title}` : ""}</small>
            </div>
          </div>
          {(phone || email) && (
            <div className="cp-contact">
              {phone && (
                <a className="btn btn-secondary" href={`tel:${phone.replace(/[^\d+]/g, "")}`}>
                  📞 Anrufen
                </a>
              )}
              {email && (
                <a className="btn btn-secondary" href={`mailto:${email}`}>
                  ✉️ E-Mail
                </a>
              )}
            </div>
          )}
        </header>

        <section className="cp-card">
          <p className="cp-hello">Guten Tag{customerName ? `, ${customerName}` : ""}!</p>
          <p className="cp-sub">Hier sehen Sie jederzeit den aktuellen Stand Ihres Projekts.</p>
          <ol className="cp-steps" aria-label="Projektstand">
            {steps.map((s, i) => (
              <li key={s} className={i + 1 < currentStep ? "done" : i + 1 === currentStep ? "now" : ""}>
                <span className="cp-dot">{i + 1 < currentStep ? "✓" : i + 1}</span>
                <span className="cp-step-label">{s}</span>
              </li>
            ))}
          </ol>
          <p className="cp-now">
            Aktuell: <b>{statusText(currentStatus)}</b>
          </p>
        </section>

        {next && <section className="cp-card cp-next">{next}</section>}

        {finished && (
          <section className="cp-card cp-review">
            <h2>Wie zufrieden sind Sie?</h2>
            {reviewSent || data.review_completed ? (
              <p className="cp-ok">✅ Vielen Dank für Ihre Bewertung!</p>
            ) : !showReviewForm ? (
              <>
                <p>Ihr Auftrag ist abgeschlossen – vielen Dank für Ihr Vertrauen! Mit Ihrer Bewertung helfen Sie uns, noch besser zu werden.</p>
                <div className="cp-actions">
                  <button type="button" className="btn btn-primary" onClick={() => setShowReviewForm(true)}>
                    ⭐ Jetzt bewerten
                  </button>
                </div>
              </>
            ) : (
              <div className="cp-form">
                <Stars label="Gesamtzufriedenheit *" value={overallRating} onChange={setOverallRating} big />
                <div className="cp-stars-grid">
                  <Stars label="Arbeitsqualität" value={qualityRating} onChange={setQualityRating} />
                  <Stars label="Freundlichkeit" value={friendlinessRating} onChange={setFriendlinessRating} />
                  <Stars label="Sauberkeit" value={cleanlinessRating} onChange={setCleanlinessRating} />
                  <Stars label="Termintreue" value={punctualityRating} onChange={setPunctualityRating} />
                </div>
                <div className="cp-field">
                  <span>Würden Sie uns weiterempfehlen?</span>
                  <div className="cp-nps" role="radiogroup" aria-label="Weiterempfehlung von 0 bis 10">
                    {Array.from({ length: 11 }, (_, n) => (
                      <button key={n} type="button" role="radio" aria-checked={recommendation === String(n)} className={recommendation === String(n) ? "on" : ""} onClick={() => setRecommendation(String(n))}>
                        {n}
                      </button>
                    ))}
                  </div>
                  <small className="cp-nps-legend">
                    <span>0 = auf keinen Fall</span>
                    <span>10 = auf jeden Fall</span>
                  </small>
                </div>
                <label className="cp-field">
                  <span>Ihr Kommentar (freiwillig)</span>
                  <textarea rows={4} value={customerComment} onChange={(e) => setCustomerComment(e.target.value)} placeholder="Was hat Ihnen gefallen, was können wir besser machen?" />
                </label>
                {assignedEmployees.length > 0 && (
                  <div className="cp-employees">
                    <b>Mitarbeiter bewerten (freiwillig)</b>
                    {assignedEmployees.map((employee: any) => (
                      <div key={employee.id} className="cp-employee">
                        <Stars
                          label={`${employee.first_name || ""} ${employee.last_name || ""}`.trim() || "Mitarbeiter"}
                          value={employeeRatings[employee.id] ? String(employeeRatings[employee.id]) : ""}
                          onChange={(v) => setEmployeeRatings({ ...employeeRatings, [employee.id]: Number(v) })}
                        />
                        <input
                          value={employeeComments[employee.id] || ""}
                          onChange={(e) => setEmployeeComments({ ...employeeComments, [employee.id]: e.target.value })}
                          placeholder="Kommentar (freiwillig)"
                          aria-label="Kommentar zum Mitarbeiter"
                        />
                      </div>
                    ))}
                  </div>
                )}
                {publishInfo?.available && publishInfo.consent_text && (
                  <label className="cp-consent">
                    <input type="checkbox" checked={publishConsent} onChange={(e) => setPublishConsent(e.target.checked)} />
                    <span>
                      {publishInfo.consent_text}
                      <small>Freiwillig – ohne Häkchen bleibt Ihre Bewertung intern.</small>
                    </span>
                  </label>
                )}
                <div className="cp-actions">
                  <button type="button" className="btn btn-secondary" onClick={() => setShowReviewForm(false)}>
                    Später
                  </button>
                  <button type="button" className="btn btn-primary" onClick={submitCustomerReview} disabled={sendingReview}>
                    {sendingReview ? "Wird gesendet …" : "Bewertung absenden"}
                  </button>
                </div>
              </div>
            )}
          </section>
        )}

        <div className="cp-docs">
          {quote && (
            <section className="cp-card cp-doc">
              <h3>Angebot</h3>
              <dl>
                <dt>Nummer</dt>
                <dd>{quote.quote_number || quote.number || quote.id}</dd>
                <dt>Datum</dt>
                <dd>{date(quote.quote_date)}</dd>
                {quote.total_amount != null && (
                  <>
                    <dt>Betrag</dt>
                    <dd>{money(quote.total_amount, symbol)}</dd>
                  </>
                )}
                <dt>Status</dt>
                <dd>{quoteOpen ? "Wartet auf Ihre Bestätigung" : quote.status === "rejected" ? "Abgelehnt" : "Bestätigt"}</dd>
              </dl>
              <button type="button" className="cp-link" onClick={openQuotePdf}>
                PDF ansehen
              </button>
            </section>
          )}
          {order && (
            <section className="cp-card cp-doc">
              <h3>Auftrag</h3>
              <dl>
                <dt>Projekt</dt>
                <dd>{order.title || "–"}</dd>
                <dt>Adresse</dt>
                <dd>{[order.address_street, [order.address_zip, order.address_city].filter(Boolean).join(" ")].filter(Boolean).join(", ") || "–"}</dd>
                <dt>Status</dt>
                <dd>{statusText(order.status)}</dd>
              </dl>
            </section>
          )}
          {invoice && (
            <section className="cp-card cp-doc">
              <h3>Rechnung</h3>
              <dl>
                <dt>Nummer</dt>
                <dd>{invoice.invoice_number || invoice.number || invoice.id}</dd>
                <dt>Datum</dt>
                <dd>{date(invoice.invoice_date)}</dd>
                <dt>Betrag</dt>
                <dd>{money(invoice.total_amount ?? invoice.total, symbol)}</dd>
                <dt>Status</dt>
                <dd className={invoicePaid ? "cp-paid" : ""}>{invoiceStatusText(invoice.status, invoiceDue)}</dd>
              </dl>
              <button type="button" className="cp-link" onClick={openInvoicePdf}>
                PDF ansehen
              </button>
            </section>
          )}
        </div>

        {(order || progress.length > 0) && (
          <section className="cp-card">
            <h2>Baufortschritt</h2>
            {progress.length === 0 ? (
              <p className="cp-sub">Sobald es losgeht, sehen Sie hier Neuigkeiten und Fotos von der Baustelle.</p>
            ) : (
              <ol className="cp-timeline">
                {progress
                  .slice()
                  .reverse()
                  .map((entry: any) => (
                    <li key={entry.id}>
                      <div className="cp-tl-head">
                        <time>{dateTime(entry.created_at)}</time>
                        {entry.status && <span className="cp-tag">{statusText(entry.status)}</span>}
                      </div>
                      {entry.note && <p>{entry.note}</p>}
                      {entry.images?.length > 0 && (
                        <div className="cp-thumbs">
                          {entry.images.map((img: any, i: number) => (
                            <button type="button" key={i} onClick={() => setSelectedImagePreview(img.image_url)}>
                              <img src={img.image_url} alt="Foto vom Baufortschritt" loading="lazy" />
                            </button>
                          ))}
                        </div>
                      )}
                    </li>
                  ))}
              </ol>
            )}
          </section>
        )}

        <footer className="cp-foot">
          {[firmName, companySettings.street, [companySettings.zip, companySettings.city].filter(Boolean).join(" ")].filter(Boolean).join(" · ")}
        </footer>
      </div>

      {selectedImagePreview && (
        <div className="cp-lightbox" role="dialog" aria-label="Foto" onClick={() => setSelectedImagePreview(null)}>
          <img src={selectedImagePreview} alt="Foto vom Baufortschritt" />
          <button type="button" aria-label="Schließen" onClick={() => setSelectedImagePreview(null)}>
            ✕
          </button>
        </div>
      )}
    </div>
  );
}

// ---------- Hilfen ----------
function Stars({ label, value, onChange, big }: { label: string; value: string; onChange: (v: string) => void; big?: boolean }) {
  const n = Number(value) || 0;
  return (
    <div className={`cp-stars${big ? " big" : ""}`}>
      <span>{label}</span>
      <div role="radiogroup" aria-label={label}>
        {[1, 2, 3, 4, 5].map((i) => (
          <button key={i} type="button" role="radio" aria-checked={n === i} aria-label={`${i} von 5 Sternen`} className={i <= n ? "on" : ""} onClick={() => onChange(String(i))}>
            ★
          </button>
        ))}
      </div>
    </div>
  );
}

const money = (v: unknown, symbol: string) =>
  `${Number(v || 0).toLocaleString("de-DE", { minimumFractionDigits: 2, maximumFractionDigits: 2 })} ${symbol}`;
const date = (v?: string | null) => (v ? new Date(v).toLocaleDateString("de-DE") : "–");
const dateTime = (v?: string | null) => (v ? new Date(v).toLocaleString("de-DE", { dateStyle: "medium", timeStyle: "short" }) : "");
const formatIban = (v: string) => String(v).replace(/\s+/g, "").replace(/(.{4})/g, "$1 ").trim();
const isPaid = (s?: string) => ["paid", "bezahlt"].includes(String(s ?? "").toLowerCase());

function dueDate(invoice: any, settings: any): string | null {
  if (invoice?.due_date) return invoice.due_date;
  if (!invoice?.invoice_date) return null;
  const d = new Date(invoice.invoice_date);
  d.setDate(d.getDate() + (Number(settings?.payment_term_days) || 14));
  return d.toISOString().slice(0, 10);
}

function invoiceStatusText(status?: string, due?: string | null): string {
  const s = String(status ?? "").toLowerCase();
  if (s === "paid" || s === "bezahlt") return "Bezahlt – vielen Dank!";
  if (s === "storniert" || s === "cancelled") return "Storniert";
  if (s === "teilbezahlt" || s === "partial") return "Teilweise bezahlt";
  if (due && new Date(due).getTime() < Date.now() - 86_400_000) return "Überfällig";
  return "Offen";
}

/** Status ohne Symbole für die Anzeige */
function statusText(status?: string): string {
  return getPortalStatusLabel(status).replace(/^[^\p{L}]+/u, "");
}
