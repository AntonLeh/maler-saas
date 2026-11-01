import { useState } from "react";
import type { CompanyInfo, Website } from "./types";
import { imprintGaps, previewUrl } from "./types";

export default function LegalTab({
  website,
  company,
  saving,
  onSave,
}: {
  website: Website;
  company: CompanyInfo | null;
  saving: boolean;
  onSave: (values: Partial<Website>) => Promise<void> | void;
}) {
  const [owner, setOwner] = useState(website.owner_name ?? "");
  const [legalForm, setLegalForm] = useState(website.legal_form ?? "");
  const [court, setCourt] = useState(website.register_court ?? "");
  const [regNo, setRegNo] = useState(website.register_number ?? "");
  const [chamber, setChamber] = useState(website.chamber ?? "");
  const [jobTitle, setJobTitle] = useState(website.job_title ?? "");
  const [jobCountry, setJobCountry] = useState(website.job_title_country ?? "Deutschland");
  const [privacyExtra, setPrivacyExtra] = useState(website.privacy_extra ?? "");

  const gaps = imprintGaps(company, { owner_name: owner, legal_form: legalForm });
  const base = previewUrl(website);
  const [url, query] = base.split("?");

  return (
    <div className="ws-stack">
      <section className="ws-panel">
        <h3>Firmendaten (aus den Firmeneinstellungen)</h3>
        <dl className="ws-dl">
          <dt>Firmenname</dt>
          <dd>{company?.company_name || <em className="ws-warn">fehlt</em>}</dd>
          <dt>Adresse</dt>
          <dd>{company?.street ? `${company.street}, ${company.zip ?? ""} ${company.city ?? ""}` : <em className="ws-warn">fehlt</em>}</dd>
          <dt>Telefon / E-Mail</dt>
          <dd>{[company?.phone, company?.email].filter(Boolean).join(" · ") || <em className="ws-warn">fehlt</em>}</dd>
          <dt>USt-IdNr.</dt>
          <dd>{company?.vat_id || "–"}</dd>
        </dl>
        <p className="tk-muted">Ändern unter Einstellungen → Firmendaten. Ohne Firmenname, Adresse und Kontakt kann die Website nicht veröffentlicht werden.</p>
      </section>

      <section className="ws-panel">
        <h3>Ergänzende Angaben fürs Impressum</h3>
        <div className="tk-form">
          <label className="tk-field">
            <span>Inhaber bzw. Geschäftsführer *</span>
            <input value={owner} onChange={(e) => setOwner(e.target.value)} placeholder="Vor- und Nachname" />
          </label>
          <label className="tk-field">
            <span>Rechtsform</span>
            <input value={legalForm} onChange={(e) => setLegalForm(e.target.value)} placeholder="z. B. Einzelunternehmen, GmbH, e. K." />
          </label>
          <label className="tk-field">
            <span>Registergericht (falls eingetragen)</span>
            <input value={court} onChange={(e) => setCourt(e.target.value)} placeholder="z. B. Amtsgericht Wittlich" />
          </label>
          <label className="tk-field">
            <span>Registernummer</span>
            <input value={regNo} onChange={(e) => setRegNo(e.target.value)} placeholder="z. B. HRB 12345" />
          </label>
          <label className="tk-field">
            <span>Zuständige Handwerkskammer</span>
            <input value={chamber} onChange={(e) => setChamber(e.target.value)} placeholder="z. B. Handwerkskammer Trier" />
          </label>
          <label className="tk-field">
            <span>Berufsbezeichnung</span>
            <input value={jobTitle} onChange={(e) => setJobTitle(e.target.value)} placeholder="z. B. Maler- und Lackierermeister" />
          </label>
          <label className="tk-field">
            <span>Berufsbezeichnung verliehen in</span>
            <input value={jobCountry} onChange={(e) => setJobCountry(e.target.value)} />
          </label>
          <label className="tk-field tk-span-2">
            <span>Ergänzungen zur Datenschutzerklärung (optional)</span>
            <textarea rows={3} value={privacyExtra} onChange={(e) => setPrivacyExtra(e.target.value)} placeholder="z. B. Hinweise zu weiteren Diensten, die Sie nutzen." />
          </label>
        </div>
        {gaps.length > 0 && <p className="ws-warn">Für ein vollständiges Impressum fehlt noch: {gaps.join(", ")}.</p>}
        <div className="ws-row">
          <button
            type="button"
            className="btn btn-primary"
            disabled={saving}
            onClick={() =>
              onSave({
                owner_name: owner.trim() || null,
                legal_form: legalForm.trim() || null,
                register_court: court.trim() || null,
                register_number: regNo.trim() || null,
                chamber: chamber.trim() || null,
                job_title: jobTitle.trim() || null,
                job_title_country: jobCountry.trim() || null,
                privacy_extra: privacyExtra.trim() || null,
              })
            }
          >
            {saving ? "Wird gespeichert …" : "Speichern"}
          </button>
          <a className="btn btn-secondary" href={`${url}/impressum?${query}`} target="_blank" rel="noreferrer">
            Impressum ansehen
          </a>
          <a className="btn btn-secondary" href={`${url}/datenschutz?${query}`} target="_blank" rel="noreferrer">
            Datenschutz ansehen
          </a>
        </div>
      </section>

      <div className="tk-notice tk-notice-info">
        <span>
          Impressum und Datenschutzerklärung werden aus Ihren Angaben erzeugt. Es handelt sich um eine Vorlage ohne Gewähr – bitte prüfen Sie die Texte
          oder lassen Sie sie prüfen (z. B. durch Ihre Handwerkskammer). Die Website verwendet keine Cookies und kein Tracking.
        </span>
      </div>
    </div>
  );
}
