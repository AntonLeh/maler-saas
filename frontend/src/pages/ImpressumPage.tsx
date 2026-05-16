type ImpressumPageProps = {
  onBack: () => void;
};

export default function ImpressumPage({
  onBack,
}: ImpressumPageProps) {
  return (
    <div className="legal-page">
      <div className="legal-card">
        <div className="legal-topbar">
          <div>
            <h1>Impressum</h1>
            <p>Angaben gemäß geltender Informationspflichten.</p>
          </div>

          <button
            type="button"
            className="btn btn-secondary"
            onClick={onBack}
          >
            Zurück
          </button>
        </div>

        <section className="legal-section">
          <h2>Betreiber der Plattform</h2>

          <p>
            <strong>Anton Lehmann</strong>
          </p>

          <p>
            C/ Muntanya 63
            <br />
            07420 Sa Pobla
            <br />
            Spanien
          </p>
        </section>

        <section className="legal-section">
          <h2>Kontakt</h2>

          <p>
            E-Mail:
            <br />
            info@maler-saas.com
          </p>
        </section>

        <section className="legal-section">
          <h2>Hinweis</h2>

          <p>
            MalerSaaS ist eine digitale SaaS-Plattform für
            Malerbetriebe und Handwerksunternehmen.
          </p>

        </section>

        <section className="legal-section">
          <h2>Haftungsausschluss</h2>

          <p>
            Trotz sorgfältiger Kontrolle übernehmen wir keine
            Haftung für externe Inhalte oder verlinkte Seiten.
          </p>
        </section>
      </div>
    </div>
  );
}