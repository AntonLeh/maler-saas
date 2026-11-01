import { useCallback, useEffect, useState } from "react";
import "../terminkalender/terminkalender.css";
import "./website.css";
import type { CompanyInfo, Website, WebsiteLead, WebsiteReference } from "./types";
import { imprintGaps, previewUrl, siteUrl, slugError, slugify } from "./types";
import * as api from "./api";
import DesignTab from "./DesignTab";
import ReferencesTab from "./ReferencesTab";
import LeadsTab from "./LeadsTab";
import LegalTab from "./LegalTab";

type Tab = "design" | "references" | "leads" | "legal";

export default function WebsitePage({
  tenantId,
  currentUserId,
  onBack,
  onOpenSettings,
}: {
  tenantId: number;
  currentUserId: number;
  onBack: () => void;
  onOpenSettings?: () => void;
}) {
  const [website, setWebsite] = useState<Website | null>(null);
  const [company, setCompany] = useState<CompanyInfo | null>(null);
  const [references, setReferences] = useState<WebsiteReference[]>([]);
  const [leads, setLeads] = useState<WebsiteLead[]>([]);
  const [loading, setLoading] = useState(true);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const [success, setSuccess] = useState("");
  const [tab, setTab] = useState<Tab>("design");
  const [slug, setSlug] = useState("");

  const flash = (msg: string) => {
    setSuccess(msg);
    window.setTimeout(() => setSuccess(""), 4000);
  };
  const showError = useCallback((msg: string) => {
    setError(msg);
    window.scrollTo({ top: 0, behavior: "smooth" });
  }, []);

  const reloadRefs = useCallback(async () => setReferences(await api.loadReferences(tenantId)), [tenantId]);
  const reloadLeads = useCallback(async () => setLeads(await api.loadLeads(tenantId)), [tenantId]);

  useEffect(() => {
    let cancelled = false;
    (async () => {
      try {
        const [w, c] = await Promise.all([api.loadWebsite(tenantId), api.loadCompany(tenantId)]);
        if (cancelled) return;
        setWebsite(w);
        setCompany(c);
        setSlug(slugify(c?.company_name || "malerbetrieb"));
        if (w) {
          const [r, l] = await Promise.all([api.loadReferences(tenantId), api.loadLeads(tenantId)]);
          if (cancelled) return;
          setReferences(r);
          setLeads(l);
        }
      } catch (e) {
        if (!cancelled) setError((e as Error).message);
      } finally {
        if (!cancelled) setLoading(false);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [tenantId]);

  const save = async (values: Partial<Website>, msg = "Gespeichert.") => {
    setBusy(true);
    setError("");
    try {
      setWebsite(await api.saveWebsite(tenantId, values));
      flash(msg);
    } catch (e) {
      showError((e as Error).message);
    } finally {
      setBusy(false);
    }
  };

  const create = async () => {
    const problem = slugError(slug);
    if (problem) return showError(problem);
    setBusy(true);
    setError("");
    try {
      setWebsite(await api.createWebsite(tenantId, slug, company));
      flash("Ihre Website ist angelegt. Passen Sie jetzt Texte und Bilder an und schauen Sie sich die Vorschau an.");
    } catch (e) {
      showError((e as Error).message);
    } finally {
      setBusy(false);
    }
  };

  const gaps = website ? imprintGaps(company, website) : [];
  const togglePublish = async () => {
    if (!website) return;
    if (!website.published && gaps.length) {
      setTab("legal");
      return showError(`Vor dem Veröffentlichen bitte ergänzen: ${gaps.join(", ")}.`);
    }
    if (website.published && !window.confirm("Website wirklich offline nehmen? Besucher sehen dann eine Fehlerseite.")) return;
    await save({ published: !website.published }, website.published ? "Die Website ist jetzt offline." : "Ihre Website ist jetzt online!");
  };

  const newLeads = leads.filter((l) => l.status === "neu").length;

  return (
    <section className="single-page-section tk-root ws-root">
      <div className="card form-page-card tk-card">
        <div className="page-topbar">
          <div>
            <h1>Website</h1>
            <p>Ihre eigene Firmen-Website – mit aktuellen Projekten aus Ihren Aufträgen.</p>
          </div>
          <div className="tk-topbar-actions">
            <button type="button" className="btn btn-secondary" onClick={onBack}>
              Zurück
            </button>
          </div>
        </div>

        {error && (
          <div className="tk-notice tk-notice-error" role="alert">
            <span>{error}</span>
            <button type="button" className="tk-icon-btn" onClick={() => setError("")} aria-label="Ausblenden">
              ×
            </button>
          </div>
        )}
        {success && (
          <div className="tk-notice tk-notice-success" role="status">
            <span>{success}</span>
          </div>
        )}

        {loading ? (
          <p className="tk-empty">Wird geladen …</p>
        ) : !website ? (
          <section className="ws-panel ws-welcome">
            <h3>In zwei Minuten zur eigenen Website</h3>
            <ul className="ws-benefits">
              <li>✓ Fertige, für Handy und Google optimierte Website mit Ihrem Logo und Ihren Farben</li>
              <li>✓ Kontaktformular – Anfragen landen direkt hier in der App</li>
              <li>✓ Referenzen mit Fotos aus Ihren Aufträgen, mit einem Klick veröffentlicht</li>
              <li>✓ Impressum und Datenschutzerklärung werden automatisch erstellt</li>
            </ul>
            {!company?.company_name && (
              <div className="tk-notice tk-notice-info">
                <span>
                  Tipp: Hinterlegen Sie zuerst Firmenname, Adresse, Telefon und Logo in den Einstellungen.
                  {onOpenSettings && (
                    <>
                      {" "}
                      <button type="button" className="ws-link" onClick={onOpenSettings}>
                        Zu den Einstellungen
                      </button>
                    </>
                  )}
                </span>
              </div>
            )}
            <label className="tk-field">
              <span>Ihre Web-Adresse</span>
              <div className="ws-slug">
                <span className="tk-muted">maler-saas.com/w/</span>
                <input value={slug} onChange={(e) => setSlug(e.target.value.toLowerCase().replace(/[^a-z0-9-]/g, ""))} maxLength={50} />
              </div>
              {slugError(slug) && <small className="ws-warn">{slugError(slug)}</small>}
            </label>
            <div className="ws-row">
              <button type="button" className="btn btn-primary" onClick={create} disabled={busy || !!slugError(slug)}>
                {busy ? "Wird angelegt …" : "Website anlegen"}
              </button>
              <span className="tk-muted">Die Website ist erst sichtbar, wenn Sie sie veröffentlichen.</span>
            </div>
          </section>
        ) : (
          <>
            <div className={`ws-status${website.published ? " ws-status-online" : ""}`}>
              <div>
                <strong>{website.published ? "● Online" : "○ Noch nicht veröffentlicht"}</strong>
                <a href={website.published ? siteUrl(website.slug) : previewUrl(website)} target="_blank" rel="noreferrer" className="ws-url">
                  {siteUrl(website.slug).replace("https://", "")}
                </a>
              </div>
              <div className="ws-row">
                <a className="btn btn-secondary" href={website.published ? siteUrl(website.slug) : previewUrl(website)} target="_blank" rel="noreferrer">
                  {website.published ? "Website ansehen" : "Vorschau ansehen"}
                </a>
                <button type="button" className={`btn ${website.published ? "btn-secondary" : "btn-primary"}`} onClick={togglePublish} disabled={busy}>
                  {website.published ? "Offline nehmen" : "Veröffentlichen"}
                </button>
              </div>
            </div>

            <div className="tk-segment ws-tabs" role="tablist" aria-label="Bereich">
              {(
                [
                  ["design", "Gestaltung"],
                  ["references", `Referenzen (${references.length})`],
                  ["leads", `Anfragen${newLeads ? ` (${newLeads} neu)` : ""}`],
                  ["legal", "Impressum & Datenschutz"],
                ] as [Tab, string][]
              ).map(([t, label]) => (
                <button key={t} type="button" role="tab" aria-selected={tab === t} className={tab === t ? "active" : ""} onClick={() => setTab(t)}>
                  {label}
                </button>
              ))}
            </div>

            {tab === "design" && (
              <DesignTab key={website.updated_at} website={website} company={company} saving={busy} onSave={(v) => save(v, "Gestaltung gespeichert.")} onError={showError} />
            )}
            {tab === "references" && (
              <ReferencesTab tenantId={tenantId} userId={currentUserId} references={references} onChanged={reloadRefs} onError={showError} onSuccess={flash} />
            )}
            {tab === "leads" && <LeadsTab tenantId={tenantId} leads={leads} onChanged={reloadLeads} onError={showError} />}
            {tab === "legal" && <LegalTab key={website.updated_at} website={website} company={company} saving={busy} onSave={(v) => save(v, "Angaben gespeichert.")} />}
          </>
        )}
      </div>
    </section>
  );
}
