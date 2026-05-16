type DatenschutzPageProps = {
  onBack: () => void;
};

export default function DatenschutzPage({
  onBack,
}: DatenschutzPageProps) {
  return (
    <div className="legal-page">
      <div className="legal-card">
        <div className="legal-topbar">
          <div>
            <h1>Datenschutzerklärung</h1>
            <p>Informationen zur Verarbeitung personenbezogener Daten.</p>
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
          <h2>Allgemeines</h2>

          <p>
            Der Schutz Ihrer persönlichen Daten ist uns wichtig.
            Wir behandeln personenbezogene Daten vertraulich und
            entsprechend der gesetzlichen Datenschutzvorschriften.
          </p>
        </section>

        <section className="legal-section">
          <h2>Verantwortlicher</h2>

          <p>
            Anton Lehmann
            <br />
            C/ Muntanya 63
            <br />
            07420 Sa Pobla
            <br />
            Spanien
          </p>
        </section>

        <section className="legal-section">
          <h2>Verarbeitete Daten</h2>

          <p>
            Im Rahmen der Nutzung von MalerSaaS können unter anderem
            folgende Daten verarbeitet werden:
          </p>

          <ul>
            <li>Benutzerdaten</li>
            <li>Kundendaten</li>
            <li>Auftragsdaten</li>
            <li>Zeiterfassungen</li>
            <li>Bilder und Dokumente</li>
            <li>Rechnungsdaten</li>
            <li>Login- und Systeminformationen</li>
          </ul>
        </section>

        <section className="legal-section">
          <h2>Technische Dienstleister</h2>

          <p>
            Zur Bereitstellung der Plattform können externe
            technische Dienstleister eingesetzt werden,
            beispielsweise für Hosting, Datenbanken,
            Zahlungsabwicklung oder E-Mail-Versand.
          </p>
        </section>

        <section className="legal-section">
          <h2>Zahlungsabwicklung</h2>

          <p>
            Zahlungen und Abonnements werden über Stripe verarbeitet.
            Es gelten zusätzlich die Datenschutzbestimmungen von Stripe.
          </p>
        </section>

        <section className="legal-section">
          <h2>Ihre Rechte</h2>

          <p>
            Sie haben das Recht auf Auskunft, Berichtigung,
            Löschung sowie Einschränkung der Verarbeitung
            Ihrer personenbezogenen Daten.
          </p>
        </section>
      </div>
    </div>
  );
}