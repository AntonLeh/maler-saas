type Props = {
  onBack: () => void;
};

export default function AgbPage({ onBack }: Props) {
  return (
    <div className="auth-wrapper">
      <div
        className="card form-page-card"
        style={{
          maxWidth: 900,
          margin: "40px auto",
          lineHeight: 1.7,
        }}
      >
        <button type="button" className="btn btn-secondary" onClick={onBack}>
          Zurück zur Registrierung
        </button>

        <h1>Allgemeine Geschäftsbedingungen (AGB)</h1>

        <h3>1. Geltungsbereich</h3>
        <p>
          Diese AGB regeln die Nutzung der Plattform MalerSaaS durch
          registrierte Unternehmen und Nutzer.
        </p>

        <h3>2. Leistungen</h3>
        <p>
          MalerSaaS bietet digitale Werkzeuge zur Verwaltung von Kunden,
          Mitarbeitern, Angeboten, Aufträgen und Rechnungen.
        </p>

        <h3>3. Registrierung</h3>
        <p>
          Nutzer verpflichten sich, bei der Registrierung wahrheitsgemäße
          Angaben zu machen.
        </p>

        <h3>4. Haftung</h3>
        <p>
          Die Nutzung erfolgt im gesetzlichen Rahmen. Für Ausfälle höherer Gewalt
          wird keine Haftung übernommen.
        </p>

        <h3>5. Kündigung</h3>
        <p>
          Vertragsverhältnisse können entsprechend der jeweils vereinbarten
          Laufzeit beendet werden.
        </p>
      </div>
    </div>
  );
}