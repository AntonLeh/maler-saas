import SeoMeta from "../components/SeoMeta";
import "./ZeiterfassungPage.css";

type ZeiterfassungPageProps = {
  onRegister: () => void;
  onOpenImpressum: () => void;
  onOpenDatenschutz: () => void;
  onOpenAgb: () => void;
};

export default function ZeiterfassungPage({
  onRegister,
  onOpenImpressum,
  onOpenDatenschutz,
  onOpenAgb,
}: ZeiterfassungPageProps) {
  return (
    <>
      <SeoMeta
        title="Zeiterfassung für Malerbetriebe | MalerSaaS"
        description="Digitale Zeiterfassung für Malerbetriebe: Arbeitsbeginn, Pausen und Arbeitsende direkt auf dem Auftrag erfassen und Nettozeiten automatisch auswerten."
        canonical="https://maler-saas.com/zeiterfassung"
      />

      <div className="zeiterfassung-page">
        <header className="zeiterfassung-header">
          <a href="/" className="zeiterfassung-logo">
            <img
              src="/images/logo.png"
              alt="MalerSaaS"
              className="zeiterfassung-logo-image"
            />

            <div className="zeiterfassung-logo-text">
              <strong>MalerSaaS</strong>
              <span>Digitale Komplettlösung</span>
            </div>
          </a>

          <nav className="zeiterfassung-nav">
            <a href="/">Startseite</a>
            <a href="/maler-software">Software</a>
          </nav>
        </header>

        <main>
          <section className="zeiterfassung-hero">
            <div className="zeiterfassung-hero-content">
              <p className="zeiterfassung-badge">
                Digitale Zeiterfassung für Malerbetriebe
              </p>

              <h1>Arbeitszeiten direkt auf der Baustelle erfassen</h1>

              <p className="zeiterfassung-hero-text">
                Mit MalerSaaS erfassen Mitarbeiter Arbeitsbeginn, Pausen und
                Arbeitsende direkt beim jeweiligen Auftrag.
              </p>

              <p className="zeiterfassung-hero-text">
                Bruttozeit, Pausenzeit und Nettoarbeitszeit werden
                übersichtlich dargestellt und bleiben dem Auftrag eindeutig
                zugeordnet.
              </p>

              <button
                type="button"
                className="zeiterfassung-cta-button"
                onClick={onRegister}
              >
                14 Tage kostenlos testen
              </button>
            </div>

            <div className="zeiterfassung-hero-visual">
              <img
                src="/images/zeiterfassung-malersaas.png"
                alt="Digitale Zeiterfassung in MalerSaaS mit Arbeitsbeginn, Pause, Arbeitsende sowie Brutto- und Nettozeit"
                className="zeiterfassung-hero-image"
              />
            </div>
          </section>

<section className="zeiterfassung-overview">
  <div className="zeiterfassung-overview-intro">
    <p className="zeiterfassung-section-label">
      Arbeitszeit direkt am Auftrag
    </p>

    <h2>Arbeitszeiten eindeutig dem richtigen Auftrag zuordnen</h2>

    <p>
      Die Zeiterfassung erfolgt direkt innerhalb des jeweiligen Auftrags.
      Dadurch bleiben Arbeitszeiten, Baustelle und Mitarbeiter sauber
      miteinander verknüpft.
    </p>
  </div>

  <div className="zeiterfassung-overview-grid">
    <article>
      <h3>Arbeitsbeginn erfassen</h3>
      <p>
        Mitarbeiter starten ihre Arbeitszeit direkt beim zugewiesenen
        Auftrag und müssen keine separate Zeiterfassung öffnen.
      </p>
    </article>

    <article>
      <h3>Pausen dokumentieren</h3>
      <p>
        Pausen können gestartet und beendet werden und fließen in die
        spätere Zeitauswertung ein.
      </p>
    </article>

    <article>
      <h3>Arbeitsende speichern</h3>
      <p>
        Beim Beenden der Arbeit wird der Zeiteintrag abgeschlossen und
        bleibt dem Auftrag dauerhaft zugeordnet.
      </p>
    </article>

    <article>
      <h3>Nettozeit auswerten</h3>
      <p>
        Bruttozeit, Pausenzeit und Nettoarbeitszeit werden übersichtlich
        dargestellt und können später nachvollzogen werden.
      </p>
    </article>
  </div>
</section>

<section className="zeiterfassung-evaluation">
  <div className="zeiterfassung-evaluation-content">
    <p className="zeiterfassung-section-label">
      Zeitauswertung
    </p>

    <h2>Arbeitszeiten für Büro und Projektleitung nachvollziehbar auswerten</h2>

    <p>
      Nach Abschluss eines Zeiteintrags stehen Startzeit, Endzeit,
      Pausenzeit sowie Brutto- und Nettoarbeitszeit übersichtlich zur
      Verfügung.
    </p>

    <div className="zeiterfassung-evaluation-grid">
      <article>
        <h3>Start und Ende dokumentiert</h3>
        <p>
          Jeder abgeschlossene Zeiteintrag enthält den konkreten Beginn
          und das Ende der erfassten Arbeitszeit.
        </p>
      </article>

      <article>
        <h3>Pausenzeiten berücksichtigt</h3>
        <p>
          Erfasste Pausen werden separat ausgewiesen und von der
          Arbeitszeit abgezogen.
        </p>
      </article>

      <article>
        <h3>Brutto und Netto im Vergleich</h3>
        <p>
          Die Auswertung zeigt sowohl die gesamte Anwesenheitszeit als
          auch die tatsächlich berechnete Nettoarbeitszeit.
        </p>
      </article>

      <article>
        <h3>Auftragsbezogene Kontrolle</h3>
        <p>
          Weil die Zeiten direkt am Auftrag erfasst werden, lassen sie
          sich später eindeutig der jeweiligen Baustelle zuordnen.
        </p>
      </article>
    </div>
  </div>
</section>

<section className="zeiterfassung-benefits">
  <div className="zeiterfassung-benefits-intro">
    <p className="zeiterfassung-section-label">
      Vorteile im Arbeitsalltag
    </p>

    <h2>Weniger Zettel, weniger Rückfragen, bessere Übersicht</h2>

    <p>
      Digitale und auftragsbezogene Zeiterfassung vereinfacht den
      Arbeitsalltag auf der Baustelle und schafft eine nachvollziehbare
      Grundlage für die Auswertung im Betrieb.
    </p>
  </div>

  <div className="zeiterfassung-benefits-grid">
    <article>
      <h3>Direkt auf der Baustelle</h3>
      <p>
        Mitarbeiter erfassen ihre Arbeitszeit dort, wo sie entsteht –
        direkt beim jeweiligen Auftrag.
      </p>
    </article>

    <article>
      <h3>Keine doppelte Erfassung</h3>
      <p>
        Arbeitszeiten müssen nicht erst auf Papier notiert und später
        erneut ins Büro übertragen werden.
      </p>
    </article>

    <article>
      <h3>Klare Zuordnung</h3>
      <p>
        Jeder Zeiteintrag bleibt mit dem passenden Auftrag und der
        jeweiligen Baustelle verbunden.
      </p>
    </article>

    <article>
      <h3>Bessere Nachvollziehbarkeit</h3>
      <p>
        Start, Ende, Pausen sowie Brutto- und Nettozeit lassen sich auch
        nach Abschluss des Arbeitseinsatzes nachvollziehen.
      </p>
    </article>
  </div>
</section>

<section className="zeiterfassung-cta">
  <div className="zeiterfassung-cta-content">
    <p className="zeiterfassung-cta-label">
      Zeiterfassung digitalisieren
    </p>

    <h2>Arbeitszeiten einfach und auftragsbezogen erfassen</h2>

    <p>
      Mit MalerSaaS erfassen Mitarbeiter Arbeitsbeginn, Pausen und
      Arbeitsende direkt beim Auftrag – übersichtlich und ohne doppelte
      Erfassung.
    </p>

    <button
      type="button"
      className="zeiterfassung-cta-button zeiterfassung-cta-button-dark"
      onClick={onRegister}
    >
      14 Tage kostenlos testen
    </button>
  </div>
</section>
        </main>

<footer className="zeiterfassung-footer">
  <div className="zeiterfassung-footer-inner">
    <div>
      <strong>MalerSaaS</strong>
      <p>Digitale Software für moderne Malerbetriebe.</p>
    </div>

    <nav className="zeiterfassung-footer-links">
      <button type="button" onClick={onOpenImpressum}>
        Impressum
      </button>

      <button type="button" onClick={onOpenDatenschutz}>
        Datenschutz
      </button>

      <button type="button" onClick={onOpenAgb}>
        AGB
      </button>
    </nav>
  </div>
</footer>

      </div>
    </>
  );
}