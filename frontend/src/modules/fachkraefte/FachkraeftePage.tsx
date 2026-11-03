import { useCallback, useEffect, useMemo, useState } from "react";
import * as api from "./api";
import type { PoolBusinessContact, PoolResult } from "./types";
import { SKILLS, WANTS, availableText, labelOf } from "./types";
import "../terminkalender/terminkalender.css";
import "./fachkraefte.css";

const DEFAULT_MESSAGE =
  "Guten Tag, wir haben Ihr Profil im Fachkräfte-Pool gesehen und würden Sie gerne kennenlernen. Wir freuen uns, wenn Sie uns Ihre Kontaktdaten freigeben.";

/** App-Modul „Fachkräfte“: Pool durchsuchen, Kontakt anfragen, eigene Anfragen sehen */
export default function FachkraeftePage({ onBack }: { onBack: () => void }) {
  const [tab, setTab] = useState<"search" | "contacts">("search");
  const [plz, setPlz] = useState("");
  const [radius, setRadius] = useState(50);
  const [want, setWant] = useState("");
  const [data, setData] = useState<{ center: { plz: string; ort: string | null }; radius: number; results: PoolResult[] } | null>(null);
  const [contacts, setContacts] = useState<PoolBusinessContact[] | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const [success, setSuccess] = useState("");
  const [asking, setAsking] = useState<string | null>(null);
  const [message, setMessage] = useState(DEFAULT_MESSAGE);
  const [sending, setSending] = useState(false);

  const runSearch = useCallback(async (p: string, r: number) => {
    setLoading(true);
    setError("");
    try {
      setData(await api.search(p, r));
    } catch (e) {
      setError((e as Error).message);
    } finally {
      setLoading(false);
    }
  }, []);

  const loadContacts = useCallback(async () => {
    try {
      setContacts(await api.loadContacts());
    } catch (e) {
      setError((e as Error).message);
    }
  }, []);

  useEffect(() => {
    runSearch("", 50);
  }, [runSearch]);
  useEffect(() => {
    if (tab === "contacts") loadContacts();
  }, [tab, loadContacts]);

  const results = useMemo(() => (data?.results ?? []).filter((r) => !want || r.wants.includes(want)), [data, want]);
  const accepted = (contacts ?? []).filter((c) => c.status === "angenommen").length;

  const send = async (id: string) => {
    setSending(true);
    setError("");
    try {
      await api.requestContact(id, message);
      setAsking(null);
      setSuccess("Anfrage gesendet. Sobald die Fachkraft zustimmt, bekommen Sie eine E-Mail mit den Kontaktdaten.");
      window.setTimeout(() => setSuccess(""), 6000);
      setData((d) => (d ? { ...d, results: d.results.map((r) => (r.id === id ? { ...r, contact_status: "offen" } : r)) } : d));
      setContacts(null);
    } catch (e) {
      setError((e as Error).message);
    } finally {
      setSending(false);
    }
  };

  return (
    <section className="single-page-section tk-root fk-app">
      <div className="card form-page-card tk-card">
        <div className="page-topbar">
          <div>
            <h1>Fachkräfte</h1>
            <p className="tk-muted">Maler, Helfer und Subunternehmer aus Ihrer Umgebung, die Arbeit suchen – kostenlos für alle MalerSaaS-Kunden.</p>
          </div>
          <button type="button" className="btn btn-secondary" onClick={onBack}>
            Zurück
          </button>
        </div>

        {error && <div className="tk-notice tk-notice-error">{error}</div>}
        {success && <div className="tk-notice tk-notice-success">{success}</div>}

        <div className="tk-segment fk-tabs" role="tablist" aria-label="Bereich">
          <button type="button" role="tab" aria-selected={tab === "search"} className={tab === "search" ? "active" : ""} onClick={() => setTab("search")}>
            Fachkräfte finden
          </button>
          <button type="button" role="tab" aria-selected={tab === "contacts"} className={tab === "contacts" ? "active" : ""} onClick={() => setTab("contacts")}>
            Meine Anfragen{accepted ? ` (${accepted} mit Kontakt)` : ""}
          </button>
        </div>

        {tab === "search" && (
          <>
            <form
              className="fk-searchbar"
              onSubmit={(e) => {
                e.preventDefault();
                runSearch(plz, radius);
              }}
            >
              <label className="tk-field">
                <span>Postleitzahl</span>
                <input value={plz} inputMode="numeric" maxLength={5} placeholder={data?.center.plz || "Firmen-PLZ"} onChange={(e) => setPlz(e.target.value.replace(/\D/g, "").slice(0, 5))} />
              </label>
              <label className="tk-field">
                <span>Umkreis</span>
                <select value={radius} onChange={(e) => setRadius(Number(e.target.value))}>
                  {[25, 50, 75, 100, 150, 200, 300].map((r) => (
                    <option key={r} value={r}>
                      {r} km
                    </option>
                  ))}
                </select>
              </label>
              <label className="tk-field">
                <span>Gesucht wird</span>
                <select value={want} onChange={(e) => setWant(e.target.value)}>
                  <option value="">alles</option>
                  {WANTS.map((w) => (
                    <option key={w.value} value={w.value}>
                      {w.label}
                    </option>
                  ))}
                </select>
              </label>
              <button type="submit" className="btn btn-primary" disabled={loading}>
                {loading ? "Sucht …" : "Suchen"}
              </button>
            </form>

            {data && (
              <p className="tk-muted fk-count">
                {results.length === 0 ? "Keine" : results.length} Fachkr{results.length === 1 ? "aft" : "äfte"} im Umkreis von {data.radius} km um{" "}
                {data.center.ort || data.center.plz}
              </p>
            )}

            {data && results.length === 0 && (
              <div className="fk-empty">
                <p>
                  <strong>Der Pool wächst gerade erst.</strong> Weisen Sie Bewerber, Bekannte oder Ihre Social-Media-Kanäle gerne auf die kostenlose Anmeldung
                  hin:
                </p>
                <p>
                  <a href="https://maler-saas.com/fachkraefte" target="_blank" rel="noreferrer">
                    maler-saas.com/fachkraefte
                  </a>
                </p>
              </div>
            )}

            <ul className="fk-results">
              {results.map((r) => (
                <li key={r.id} className="fk-result">
                  <div className="fk-result-head">
                    <div>
                      <strong>{r.role_label}</strong>
                      <span className="tk-muted">
                        {" "}
                        · {r.ort ?? "Umgebung"} · {r.distance}
                      </span>
                    </div>
                    <span className="fk-avail-tag">verfügbar {availableText(r.available_from)}</span>
                  </div>
                  <div className="fk-tags">
                    {r.wants.map((w) => (
                      <span key={w} className="fk-tag want">
                        {labelOf(WANTS, w)}
                      </span>
                    ))}
                    {r.skills.map((s) => (
                      <span key={s} className="fk-tag">
                        {labelOf(SKILLS, s)}
                      </span>
                    ))}
                  </div>
                  <p className="fk-facts">
                    {[r.driving_license && "Führerschein B", r.own_vehicle && "eigenes Auto", r.languages && `Sprachen: ${r.languages}`, r.wants.includes("subunternehmer") && r.handwerksrolle !== null && (r.handwerksrolle ? "in der Handwerksrolle eingetragen" : "nicht in der Handwerksrolle")]
                      .filter(Boolean)
                      .join(" · ")}
                  </p>
                  {r.note && <p className="fk-note">„{r.note}“</p>}
                  <div className="fk-result-foot">
                    <span className="tk-muted fk-small">zuletzt bestätigt {new Date(`${r.updated}T12:00:00`).toLocaleDateString("de-DE")}</span>
                    {r.contact_status === "angenommen" && r.contact ? (
                      <span className="fk-contact">
                        ✓ {r.contact.name}
                        {r.contact.phone && (
                          <>
                            {" "}
                            · <a href={`tel:${r.contact.phone.replace(/[^\d+]/g, "")}`}>{r.contact.phone}</a>
                          </>
                        )}{" "}
                        · <a href={`mailto:${r.contact.email}`}>{r.contact.email}</a>
                      </span>
                    ) : r.contact_status === "offen" ? (
                      <span className="fk-badge offen">Anfrage gesendet – wartet auf Antwort</span>
                    ) : r.contact_status === "abgelehnt" ? (
                      <span className="fk-badge abgelehnt">hat abgelehnt</span>
                    ) : asking === r.id ? null : (
                      <button type="button" className="btn btn-primary btn-small" onClick={() => setAsking(r.id)}>
                        Kontakt anfragen
                      </button>
                    )}
                  </div>
                  {asking === r.id && (
                    <div className="fk-ask">
                      <label className="tk-field">
                        <span>Ihre Nachricht an die Fachkraft</span>
                        <textarea rows={4} maxLength={1000} value={message} onChange={(e) => setMessage(e.target.value)} />
                      </label>
                      <div className="ws-row fk-row">
                        <button type="button" className="btn btn-primary btn-small" disabled={sending} onClick={() => send(r.id)}>
                          {sending ? "Wird gesendet …" : "Anfrage senden"}
                        </button>
                        <button type="button" className="btn btn-secondary btn-small" onClick={() => setAsking(null)}>
                          Abbrechen
                        </button>
                      </div>
                      <small className="tk-muted">Die Fachkraft bekommt Ihre Nachricht mit Ihrem Firmennamen und Ort per E-Mail und entscheidet, ob sie Ihnen ihre Kontaktdaten gibt.</small>
                    </div>
                  )}
                </li>
              ))}
            </ul>
          </>
        )}

        {tab === "contacts" && (
          <>
            {contacts === null ? (
              <p className="tk-muted">Wird geladen …</p>
            ) : contacts.length === 0 ? (
              <p className="tk-muted">Sie haben noch keine Fachkraft angefragt.</p>
            ) : (
              <ul className="fk-results">
                {contacts.map((c) => (
                  <li key={c.id} className="fk-result">
                    <div className="fk-result-head">
                      <div>
                        <strong>{c.profile?.role_label ?? "Profil gelöscht"}</strong>
                        {c.profile && (
                          <span className="tk-muted">
                            {" "}
                            · {c.profile.ort ?? "Umgebung"} · {c.profile.distance}
                          </span>
                        )}
                      </div>
                      <span className={`fk-badge ${c.status}`}>{c.status === "offen" ? "wartet auf Antwort" : c.status === "angenommen" ? "Kontakt freigegeben" : "abgelehnt"}</span>
                    </div>
                    <p className="tk-muted fk-small">angefragt am {new Date(c.created_at).toLocaleDateString("de-DE")}</p>
                    {c.status === "angenommen" && c.profile?.contact && (
                      <dl className="fk-dl">
                        <dt>Name</dt>
                        <dd>
                          {c.profile.contact.name}
                          {c.profile.contact.company_name ? ` (${c.profile.contact.company_name})` : ""}
                        </dd>
                        {c.profile.contact.phone && (
                          <>
                            <dt>Telefon</dt>
                            <dd>
                              <a href={`tel:${c.profile.contact.phone.replace(/[^\d+]/g, "")}`}>{c.profile.contact.phone}</a>
                            </dd>
                          </>
                        )}
                        <dt>E-Mail</dt>
                        <dd>
                          <a href={`mailto:${c.profile.contact.email}`}>{c.profile.contact.email}</a>
                        </dd>
                      </dl>
                    )}
                  </li>
                ))}
              </ul>
            )}
          </>
        )}

        <details className="fk-legal">
          <summary>Wichtige Hinweise</summary>
          <ul>
            <li>MalerSaaS stellt nur den Kontakt her und verleiht keine Arbeitskräfte. Arbeitsvertrag oder Auftrag schließen Sie direkt mit der Fachkraft.</li>
            <li>Subunternehmer: Prüfen Sie die Eintragung in der Handwerksrolle. Arbeitet jemand dauerhaft nur für Ihren Betrieb und nach Ihren Weisungen, kann Scheinselbstständigkeit vorliegen.</li>
            <li>Nutzen Sie die Kontaktdaten nur für dieses Kennenlernen. Kommt keine Zusammenarbeit zustande, löschen Sie die Daten bitte.</li>
            <li>Höchstens 20 Anfragen pro Tag. Jede Fachkraft kann pro Betrieb einmal angefragt werden.</li>
          </ul>
        </details>
      </div>
    </section>
  );
}
