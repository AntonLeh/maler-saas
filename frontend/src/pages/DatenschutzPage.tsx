type Props = {
  onBack: () => void;
};

export default function DatenschutzPage({ onBack }: Props) {
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

        <h1>Datenschutzerklärung</h1>

        <h3>1. Verantwortliche Stelle</h3>
        <p>
          Verantwortlich für die Datenverarbeitung im Rahmen von MalerSaaS ist
          der jeweilige Plattformbetreiber.
        </p>

        <h3>2. Erhobene Daten</h3>
        <p>
          Im Rahmen der Nutzung können personenbezogene Daten wie Name,
          E-Mail-Adresse, Telefonnummer und betriebliche Daten gespeichert
          werden.
        </p>

        <h3>3. Zweck der Verarbeitung</h3>
        <p>
          Die Verarbeitung erfolgt ausschließlich zur Bereitstellung und
          Verbesserung der Plattformfunktionen.
        </p>

        <h3>4. Weitergabe an Dritte</h3>
        <p>
          Eine Weitergabe personenbezogener Daten erfolgt nur, soweit dies
          gesetzlich erforderlich oder technisch notwendig ist.
        </p>

        <h3>5. Rechte der Nutzer</h3>
        <p>
          Nutzer haben jederzeit das Recht auf Auskunft, Berichtigung und
          Löschung ihrer gespeicherten Daten im gesetzlichen Rahmen.
        </p>
      </div>
    </div>
  );
}