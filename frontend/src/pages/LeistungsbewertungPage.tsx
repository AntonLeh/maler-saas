import SeoMeta from "../components/SeoMeta";
import "./LeistungsbewertungPage.css";

type LeistungsbewertungPageProps = {
  onRegister: () => void;
  onOpenImpressum: () => void;
  onOpenDatenschutz: () => void;
  onOpenAgb: () => void;
};

export default function LeistungsbewertungPage({
  onRegister,
  onOpenImpressum,
  onOpenDatenschutz,
  onOpenAgb,
}: LeistungsbewertungPageProps) {
  return (
    <>
      <SeoMeta
        title="Leistungsbewertung für Malerbetriebe | MalerSaaS"
        description="Mitarbeiterleistung im Malerbetrieb digital auswerten: individuelle Bewertungskriterien, Punktesysteme, Bonusregeln und Mitarbeiter-Rankings mit MalerSaaS."
        canonical="https://maler-saas.com/leistungsbewertung"
      />

      <div className="leistungsbewertung-page">
        <header className="leistungsbewertung-header">
          <a href="/" className="leistungsbewertung-logo">
            <img
              src="/images/logo.png"
              alt="MalerSaaS"
              className="leistungsbewertung-logo-image"
            />

            <div className="leistungsbewertung-logo-text">
              <strong>MalerSaaS</strong>
              <span>Digitale Komplettlösung</span>
            </div>
          </a>

          <nav className="leistungsbewertung-nav">
            <a href="/">Startseite</a>
            <a href="/maler-software">Software</a>
          </nav>
        </header>

        <main>
          <section className="leistungsbewertung-hero">
            <div className="leistungsbewertung-hero-content">
              <p className="leistungsbewertung-badge">
                Leistungsbewertung für Malerbetriebe
              </p>

              <h1>
                Mitarbeiterleistung transparent und nachvollziehbar bewerten
              </h1>

              <p className="leistungsbewertung-hero-text">
                Mit MalerSaaS können Malerbetriebe eigene Bewertungskriterien
                und Punktesysteme definieren und die Leistung ihrer Mitarbeiter
                strukturiert auswerten.
              </p>

              <p className="leistungsbewertung-hero-text">
                Individuelle Regeln, Bonusstufen und Mitarbeiter-Rankings
                schaffen eine nachvollziehbare Grundlage für Anerkennung und
                leistungsbezogene Belohnungen.
              </p>

              <button
                type="button"
                className="leistungsbewertung-cta-button"
                onClick={onRegister}
              >
                14 Tage kostenlos testen
              </button>
            </div>
          </section>

            <section className="leistungsbewertung-criteria">
  <div className="leistungsbewertung-criteria-intro">
    <p className="leistungsbewertung-section-label">
      Eigene Regeln für den Betrieb
    </p>

    <h2>Bewertungskriterien individuell festlegen</h2>

    <p>
      Jeder Malerbetrieb kann in MalerSaaS eigene Kriterien für die
      Leistungsbewertung definieren. So orientiert sich die Bewertung an den
      tatsächlichen Anforderungen und Arbeitsabläufen des jeweiligen Betriebs.
    </p>
  </div>

  <div className="leistungsbewertung-criteria-grid">
    <article>
      <h3>Eigene Kriterien</h3>
      <p>
        Der Betrieb legt selbst fest, welche Leistungen und Ergebnisse in die
        Bewertung der Mitarbeiter einfließen sollen.
      </p>
    </article>

    <article>
      <h3>Punkte vergeben</h3>
      <p>
        Für Bewertungskriterien können Punkte definiert werden, sodass
        Leistungen nachvollziehbar in die Gesamtbewertung einfließen.
      </p>
    </article>

    <article>
      <h3>Automatisch oder manuell</h3>
      <p>
        Kriterien können je nach Anwendungsfall automatisch ausgewertet oder
        manuell beurteilt werden.
      </p>
    </article>

    <article>
      <h3>Regeln je Betrieb</h3>
      <p>
        Jeder Betrieb verwaltet seine eigenen Bewertungskriterien und kann
        diese an seine individuellen Ziele und Arbeitsweisen anpassen.
      </p>
    </article>
  </div>
</section>

<section className="leistungsbewertung-rewards">
  <div className="leistungsbewertung-rewards-content">
    <p className="leistungsbewertung-section-label">
      Leistung sichtbar machen
    </p>

    <h2>Bonusregeln und Mitarbeiter-Rankings transparent abbilden</h2>

    <p>
      Auf Basis der erreichten Punkte können Malerbetriebe eigene Bonusstufen
      definieren und die Entwicklung ihrer Mitarbeiter übersichtlich
      nachvollziehen.
    </p>

    <div className="leistungsbewertung-rewards-grid">
      <article>
        <h3>Individuelle Bonusregeln</h3>
        <p>
          Jeder Betrieb kann selbst festlegen, ab welcher Punktzahl bestimmte
          Belohnungen oder Bonusstufen erreicht werden.
        </p>
      </article>

      <article>
        <h3>Mitarbeiter-Ranking</h3>
        <p>
          Die erreichten Punkte werden übersichtlich zusammengeführt und
          ermöglichen einen direkten Vergleich innerhalb des Betriebs.
        </p>
      </article>

      <article>
        <h3>Leistung anerkennen</h3>
        <p>
          Gute Ergebnisse werden sichtbar und können gezielt für Anerkennung,
          Motivation und leistungsbezogene Belohnungen genutzt werden.
        </p>
      </article>

      <article>
        <h3>Klare Grundlage</h3>
        <p>
          Punkte, Regeln und Bonusstufen schaffen eine nachvollziehbare
          Grundlage für die Bewertung von Mitarbeiterleistungen.
        </p>
      </article>
    </div>
  </div>
</section>

<section className="leistungsbewertung-automation">
  <div className="leistungsbewertung-automation-intro">
    <p className="leistungsbewertung-section-label">
      Automatisch auswerten
    </p>

    <h2>Leistungsbewertung direkt aus dem Arbeitsablauf ableiten</h2>

    <p>
      Automatische Bewertungskriterien können mit vorhandenen Projekt- und
      Auftragsdaten verknüpft werden. So fließen definierte Ergebnisse direkt
      in die Leistungsbewertung ein.
    </p>
  </div>

  <div className="leistungsbewertung-automation-grid">
    <article>
      <h3>Automatische Kriterien</h3>
      <p>
        Geeignete Regeln können automatisch ausgewertet werden, sobald die
        erforderlichen Daten im System vorliegen.
      </p>
    </article>

    <article>
      <h3>Manuelle Bewertung ergänzen</h3>
      <p>
        Kriterien, die nicht automatisch messbar sind, können weiterhin
        manuell beurteilt und in die Gesamtbewertung aufgenommen werden.
      </p>
    </article>

    <article>
      <h3>Einheitliche Bewertung</h3>
      <p>
        Definierte Regeln sorgen dafür, dass Bewertungen nach denselben
        Maßstäben durchgeführt werden.
      </p>
    </article>

    <article>
      <h3>Weniger Verwaltungsaufwand</h3>
      <p>
        Automatisierte Auswertungen reduzieren manuelle Arbeit und erleichtern
        die regelmäßige Bewertung von Mitarbeiterleistungen.
      </p>
    </article>
  </div>
</section>

<section className="leistungsbewertung-benefits">
  <div className="leistungsbewertung-benefits-intro">
    <p className="leistungsbewertung-section-label">
      Vorteile für den Betrieb
    </p>

    <h2>Leistung nachvollziehbar, fair und strukturiert bewerten</h2>

    <p>
      MalerSaaS verbindet individuelle Kriterien, Punkte, Bonusregeln und
      Auswertungen in einem gemeinsamen System.
    </p>
  </div>

  <div className="leistungsbewertung-benefits-grid">
    <article>
      <h3>Klare Bewertungskriterien</h3>
      <p>
        Mitarbeiter wissen, welche Leistungen und Ergebnisse für die
        Bewertung relevant sind.
      </p>
    </article>

    <article>
      <h3>Nachvollziehbare Ergebnisse</h3>
      <p>
        Punkte und Regeln machen sichtbar, wie eine Bewertung zustande
        gekommen ist.
      </p>
    </article>

    <article>
      <h3>Individuell je Betrieb</h3>
      <p>
        Jeder Betrieb kann seine eigenen Kriterien, Punktwerte und
        Bonusmodelle festlegen.
      </p>
    </article>

    <article>
      <h3>Motivation fördern</h3>
      <p>
        Gute Leistungen werden sichtbar und können gezielt anerkannt und
        belohnt werden.
      </p>
    </article>
  </div>
</section>

<section className="leistungsbewertung-final-cta">
  <div className="leistungsbewertung-final-cta-content">
    <p className="leistungsbewertung-final-cta-label">
      Mitarbeiterleistung strukturiert bewerten
    </p>

    <h2>Eigene Regeln, Punkte und Bonusmodelle in MalerSaaS abbilden</h2>

    <p>
      Definiere Bewertungskriterien passend zu deinem Betrieb und schaffe eine
      nachvollziehbare Grundlage für Leistung, Anerkennung und Bonusmodelle.
    </p>

    <button
      type="button"
      className="leistungsbewertung-final-cta-button"
      onClick={onRegister}
    >
      14 Tage kostenlos testen
    </button>
  </div>
</section>
        </main>
        <footer className="leistungsbewertung-footer">
  <div className="leistungsbewertung-footer-content">
    <div>
      <strong>MalerSaaS</strong>
      <p>Digitale Software für moderne Malerbetriebe.</p>
    </div>

    <div className="leistungsbewertung-footer-links">
      <button type="button" onClick={onOpenImpressum}>
        Impressum
      </button>

      <button type="button" onClick={onOpenDatenschutz}>
        Datenschutz
      </button>

      <button type="button" onClick={onOpenAgb}>
        AGB
      </button>
    </div>
  </div>
</footer>
      </div>
    </>
  );
}