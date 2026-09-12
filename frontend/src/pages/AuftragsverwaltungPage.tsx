import { useState } from "react";
import SeoMeta from "../components/SeoMeta";
import "./AuftragsverwaltungPage.css";

type AuftragsverwaltungPageProps = {
  onRegister: () => void;
  onOpenImpressum: () => void;
  onOpenDatenschutz: () => void;
  onOpenAgb: () => void;
};

export default function AuftragsverwaltungPage({
  onRegister,
  onOpenImpressum,
  onOpenDatenschutz,
  onOpenAgb,
}: AuftragsverwaltungPageProps) {
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);
  return (
    <>
      <SeoMeta
        title="Auftragsverwaltung für Malerbetriebe | MalerSaaS"
        description="Digitale Auftragsverwaltung für Malerbetriebe: Aufträge organisieren, Mitarbeiter zuweisen, Baustellenfortschritt verfolgen und alle wichtigen Informationen zentral verwalten."
        canonical="https://maler-saas.com/auftragsverwaltung"
      />

      <div className="auftragsverwaltung-page">
  <header className="auftragsverwaltung-header">
  <a href="/" className="auftragsverwaltung-logo">
    <img
      src="/images/logo.png"
      alt="MalerSaaS"
      className="auftragsverwaltung-logo-image"
    />

    <div className="auftragsverwaltung-logo-text">
      <strong>MalerSaaS</strong>
      <span>Digitale Komplettlösung</span>
    </div>
  </a>

  <button
    type="button"
    className="auftragsverwaltung-menu-toggle"
    aria-label="Menü öffnen"
    aria-expanded={mobileMenuOpen}
    onClick={() => setMobileMenuOpen((prev) => !prev)}
  >
    <span></span>
    <span></span>
    <span></span>
  </button>

  <nav
    className={`auftragsverwaltung-nav ${
      mobileMenuOpen ? "is-open" : ""
    }`}
  >
    <a href="/" onClick={() => setMobileMenuOpen(false)}>
      Startseite
    </a>

    <a
      href="/maler-software"
      onClick={() => setMobileMenuOpen(false)}
    >
      Software
    </a>
  </nav>
</header>

  <main>
  <section className="auftragsverwaltung-hero">
    <div className="auftragsverwaltung-hero-content">
      <p className="auftragsverwaltung-badge">
        Digitale Auftragsverwaltung für Malerbetriebe
      </p>

      <h1>
        Aufträge planen, Mitarbeiter koordinieren und Fortschritt verfolgen
      </h1>

      <p className="auftragsverwaltung-hero-text">
        Mit MalerSaaS verwalten Malerbetriebe ihre Aufträge zentral und
        behalten Baustellen, Mitarbeiter und den aktuellen Arbeitsstand
        im Blick.
      </p>

      <p className="auftragsverwaltung-hero-text">
        Vom bestätigten Angebot bis zum abgeschlossenen Auftrag bleiben
        alle wichtigen Informationen in einem durchgängigen digitalen
        Ablauf miteinander verbunden.
      </p>

      <div className="auftragsverwaltung-hero-actions">
        <a
          href="/maler-software"
          className="auftragsverwaltung-secondary-link"
        >
          Mehr über MalerSaaS erfahren
        </a>
      </div>
    </div>

    <div className="auftragsverwaltung-hero-visual">
      <img
        src="/images/auftragsverwaltung-malersaas.png"
        alt="Digitale Auftragsverwaltung in MalerSaaS mit Mitarbeiterzuweisung, Status, Zeitraum, Fortschrittsmeldungen und Baustellenbildern"
        className="auftragsverwaltung-hero-image"
      />
    </div>
  </section>

<section className="auftragsverwaltung-overview">
  <div className="auftragsverwaltung-overview-intro">
    <p className="auftragsverwaltung-section-label">
      Zentrale Auftragsübersicht
    </p>

    <h2>Alle Aufträge zentral im Blick</h2>

    <p>
      Statt Informationen zwischen Notizen, Tabellen und einzelnen
      Anwendungen zu verteilen, bündelt MalerSaaS die wichtigsten
      Auftragsdaten an einem zentralen Ort.
    </p>
  </div>

  <div className="auftragsverwaltung-overview-grid">
    <article>
      <h3>Auftragsstatus erkennen</h3>
      <p>
        Sieh auf einen Blick, welche Aufträge neu, geplant, in Arbeit,
        zur Prüfung, fertig oder bereits abgerechnet sind.
      </p>
    </article>

    <article>
      <h3>Kunden direkt zuordnen</h3>
      <p>
        Jeder Auftrag bleibt mit dem passenden Kunden verbunden.
        Kontaktdaten und Auftragsinformationen lassen sich dadurch
        schnell zuordnen.
      </p>
    </article>

    <article>
      <h3>Mitarbeiter einteilen</h3>
      <p>
        Projektleiter und Mitarbeiter werden dem jeweiligen Auftrag
        zugewiesen, damit Verantwortlichkeiten für alle Beteiligten
        transparent bleiben.
      </p>
    </article>

    <article>
      <h3>Termine und Baustellen verwalten</h3>
      <p>
        Adresse, Zeitraum und aktueller Arbeitsstand stehen direkt beim
        Auftrag und helfen bei der täglichen Planung.
      </p>
    </article>
  </div>
</section>

<section className="auftragsverwaltung-progress">
  <div className="auftragsverwaltung-progress-grid">
    <div className="auftragsverwaltung-progress-content">
      <p className="auftragsverwaltung-section-label">
        Fortschritt dokumentieren
      </p>

      <h2>Baustellenfortschritt mit Notizen und Bildern festhalten</h2>

      <p>
        Mitarbeiter können den aktuellen Stand direkt beim Auftrag
        dokumentieren. So bleibt nachvollziehbar, welche Arbeiten bereits
        erledigt wurden und wie sich die Baustelle entwickelt.
      </p>

      <div className="auftragsverwaltung-progress-points">
        <article>
          <h3>Fortschrittsmeldungen erfassen</h3>
          <p>
            Arbeitsschritte und wichtige Hinweise werden direkt im
            jeweiligen Auftrag gespeichert.
          </p>
        </article>

        <article>
          <h3>Baustellenbilder zuordnen</h3>
          <p>
            Fotos bleiben mit der passenden Fortschrittsmeldung verbunden
            und können später direkt im Auftrag nachvollzogen werden.
          </p>
        </article>

        <article>
          <h3>Arbeitsstand transparent verfolgen</h3>
          <p>
            Projektleiter und Betriebsleitung sehen, was auf der Baustelle
            passiert ist, ohne Informationen über verschiedene Kanäle
            zusammensuchen zu müssen.
          </p>
        </article>
      </div>
    </div>
  </div>
</section>

<section className="auftragsverwaltung-workflow">
  <div className="auftragsverwaltung-workflow-intro">
    <p className="auftragsverwaltung-section-label">
      Durchgängiger Arbeitsablauf
    </p>

    <h2>Vom bestätigten Angebot bis zur Rechnung</h2>

    <p>
      Ein Auftrag steht in MalerSaaS nicht für sich allein. Informationen
      aus den vorherigen Arbeitsschritten werden weiterverwendet und
      begleiten den Betrieb bis zum Abschluss des Projekts.
    </p>
  </div>

  <div className="auftragsverwaltung-workflow-steps">
    <article>
      <span>01</span>
      <h3>Angebot bestätigen</h3>
      <p>
        Aus einem bestätigten Angebot entsteht die Grundlage für den
        Auftrag, ohne die Daten erneut erfassen zu müssen.
      </p>
    </article>

    <article>
      <span>02</span>
      <h3>Auftrag organisieren</h3>
      <p>
        Mitarbeiter, Baustelle, Zeitraum und weitere Auftragsinformationen
        werden zentral verwaltet.
      </p>
    </article>

    <article>
      <span>03</span>
      <h3>Arbeiten dokumentieren</h3>
      <p>
        Fortschritt, Notizen und Baustellenbilder bleiben direkt mit dem
        jeweiligen Auftrag verbunden.
      </p>
    </article>

    <article>
      <span>04</span>
      <h3>Auftrag abschließen</h3>
      <p>
        Nach Abschluss können die vorhandenen Auftragsdaten für die
        weitere Abrechnung genutzt werden.
      </p>
    </article>
  </div>
</section>

<section className="auftragsverwaltung-cta">
  <div className="auftragsverwaltung-cta-content">
    <p className="auftragsverwaltung-cta-label">
      Auftragsverwaltung digitalisieren
    </p>

    <h2>Aufträge mit MalerSaaS übersichtlich organisieren</h2>

    <p>
      Plane Aufträge, koordiniere Mitarbeiter und dokumentiere den
      Baustellenfortschritt zentral in einer Software für Malerbetriebe.
    </p>

    <button
      type="button"
      className="auftragsverwaltung-cta-button"
      onClick={onRegister}
    >
      14 Tage kostenlos testen
    </button>
  </div>
</section>

</main>

<footer className="auftragsverwaltung-footer">
  <div className="auftragsverwaltung-footer-inner">
    <div>
      <strong>MalerSaaS</strong>
      <p>Digitale Software für moderne Malerbetriebe.</p>
    </div>

    <nav className="auftragsverwaltung-footer-links">
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