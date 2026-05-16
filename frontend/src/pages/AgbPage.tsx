type AgbPageProps = {
  onBack: () => void;
};

export default function AgbPage({
  onBack,
}: AgbPageProps) {
  return (
    <div className="legal-page">
      <div className="legal-card">
        <div className="legal-topbar">
          <div>
            <h1>Allgemeine Geschäftsbedingungen</h1>
            <p>Nutzungsbedingungen für die SaaS-Plattform MalerSaaS.</p>
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
          <h2>1. Geltungsbereich</h2>

          <p>
            Diese Allgemeinen Geschäftsbedingungen regeln die Nutzung
            der Plattform MalerSaaS durch Unternehmen und Nutzer.
          </p>
        </section>

        <section className="legal-section">
          <h2>2. Leistungsumfang</h2>

          <p>
            MalerSaaS stellt digitale Werkzeuge zur Verwaltung von
            Aufträgen, Kunden, Mitarbeitern, Materialien,
            Zeiterfassungen, Rechnungen und weiteren betrieblichen
            Prozessen zur Verfügung.
          </p>
        </section>

        <section className="legal-section">
          <h2>3. Registrierung</h2>

          <p>
            Für die Nutzung der Plattform ist eine Registrierung
            erforderlich. Der Nutzer verpflichtet sich, korrekte
            Angaben zu machen.
          </p>
        </section>

        <section className="legal-section">
          <h2>4. Zahlungsbedingungen</h2>

          <p>
            Kostenpflichtige Funktionen können im Rahmen eines
            Abonnements angeboten werden. Die Abrechnung erfolgt
            über externe Zahlungsdienstleister.
          </p>
        </section>

        <section className="legal-section">
          <h2>5. Verfügbarkeit</h2>

          <p>
            Wir bemühen uns um eine möglichst unterbrechungsfreie
            Verfügbarkeit der Plattform, übernehmen jedoch keine
            Garantie für jederzeitige Erreichbarkeit.
          </p>
        </section>

        <section className="legal-section">
          <h2>6. Haftung</h2>

          <p>
            Die Nutzung der Plattform erfolgt auf eigene Verantwortung.
            Eine Haftung für indirekte Schäden oder Datenverluste ist
            ausgeschlossen, soweit gesetzlich zulässig.
          </p>
        </section>

        <section className="legal-section">
          <h2>7. Änderungen</h2>

          <p>
            Wir behalten uns vor, Funktionen, Inhalte oder diese
            Bedingungen jederzeit anzupassen oder weiterzuentwickeln.
          </p>
        </section>
      </div>
    </div>
  );
}