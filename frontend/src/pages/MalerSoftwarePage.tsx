import { useState } from "react";
import SeoMeta from "../components/SeoMeta";
import "./MalerSoftwarePage.css";

export default function MalerSoftwarePage({
  onRegister,
  onLogin,
  onOpenImpressum,
  onOpenDatenschutz,
  onOpenAgb,
}: {
  onRegister: () => void;
  onLogin: () => void;
  onOpenImpressum: () => void;
  onOpenDatenschutz: () => void;
  onOpenAgb: () => void;
}) {
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);
  return (
    <>
  <SeoMeta
    title="Software für Malerbetriebe | MalerSaaS"
    description="Software für Malerbetriebe: Mit MalerSaaS Aufmaß, Angebote, Aufträge, Zeiterfassung, Materialverwaltung und Rechnungen digital verwalten."
    canonical="https://maler-saas.com/maler-software"
  />

  <div className="maler-software-page">
    <header className="maler-software-header">
  <a href="/" className="maler-software-logo">
    <img
      src="/images/logo.png"
      alt="MalerSaaS"
      className="maler-software-logo-image"
    />

    <div className="maler-software-logo-text">
      <strong>MalerSaaS</strong>
      <span>Digitale Komplettlösung</span>
    </div>
  </a>

  <button
    type="button"
    className="maler-software-menu-toggle"
    aria-label="Menü öffnen"
    aria-expanded={mobileMenuOpen}
    onClick={() => setMobileMenuOpen((prev) => !prev)}
  >
    <span></span>
    <span></span>
    <span></span>
  </button>

  <nav
    className={`maler-software-nav ${
      mobileMenuOpen ? "is-open" : ""
    }`}
  >
    <a
      href="/"
      onClick={() => setMobileMenuOpen(false)}
    >
      Startseite
    </a>

    <a
      href="#funktionen"
      onClick={() => setMobileMenuOpen(false)}
    >
      Funktionen
    </a>

    <button
      type="button"
      className="maler-software-login-btn"
      onClick={() => {
        setMobileMenuOpen(false);
        onLogin();
      }}
    >
      Login
    </button>
  </nav>
</header>

    <main>
    <section className="maler-software-hero">
  <div className="maler-software-hero-content">
    <p className="maler-software-badge">
      MalerSaaS – digitale Betriebssoftware für das Malerhandwerk
    </p>

    <h1>Software für Malerbetriebe</h1>

    <p className="maler-software-hero-text">
      MalerSaaS unterstützt Malerbetriebe dabei, ihre täglichen
      Arbeitsabläufe digital zu organisieren. Aufmaß, Angebote, Aufträge,
      Mitarbeiter, Zeiterfassung, Materialverwaltung und Rechnungen werden
      in einer zentralen Plattform zusammengeführt.
    </p>

    <p className="maler-software-hero-text">
      So entstehen weniger doppelte Eingaben, Informationen bleiben
      nachvollziehbar und Büro, Projektleitung und Baustelle arbeiten mit
      denselben aktuellen Daten.
    </p>

    <div className="maler-software-hero-actions">
      <button
        type="button"
        className="maler-software-primary-btn"
        onClick={onRegister}
      >
        14 Tage kostenlos testen
      </button>
    </div>

    <div className="maler-software-trust-row">
      <span>✓ Für Malerbetriebe entwickelt</span>
      <span>✓ Mobile Nutzung</span>
      <span>✓ Alles in einer Plattform</span>
    </div>
  </div>

  <div className="maler-software-hero-visual">
    <img
      src="/images/maler-saas-landing-collage.png"
      alt="MalerSaaS Software für Malerbetriebe mit Dashboard, Aufträgen und Betriebsübersicht"
      className="maler-software-hero-image"
    />
  </div>
</section>

    <section className="maler-software-intro">
       <div className="maler-software-section-inner">
  <h2>Eine Software für den gesamten Malerbetrieb</h2>

  <p>
    In vielen Malerbetrieben verteilen sich Kundendaten, Aufmaße,
    Angebote, Baustelleninformationen, Arbeitszeiten und Materialdaten
    auf unterschiedliche Programme, Tabellen oder Papierunterlagen.
    MalerSaaS führt diese Abläufe in einem gemeinsamen System zusammen.
  </p>

  <h3>Vom Aufmaß bis zur Rechnung</h3>

  <p>
    Ein Auftrag kann vom ersten Aufmaß über Angebot und
    Auftragsabwicklung bis zur Rechnung digital begleitet werden.
    Arbeitszeiten, Projektfortschritt, Baustellenbilder und
    Materialbewegungen bleiben dabei dem jeweiligen Auftrag zugeordnet.
  </p>

    <div className="maler-software-workflow-visual">
  <img
    src="/images/Aufmaß.png"
    alt="Digitaler Ablauf in MalerSaaS von Aufmaß und Angebot bis Auftrag und Rechnung"
    className="maler-software-workflow-image"
  />
</div>

  </div>
</section>

<section
  id="funktionen"
  className="maler-software-features"
>
  <div className="maler-software-section-inner">
  <h2>Funktionen für Malerbetriebe</h2>

  <p>
    MalerSaaS verbindet die wichtigsten kaufmännischen und operativen
    Abläufe eines Malerbetriebs in einer zentralen Software.
  </p>

  <div className="maler-software-feature-grid">
    <article>
  <h3>Digitales Aufmaß</h3>
  <p>
    Maße und Leistungen direkt beim Kunden erfassen und als Grundlage
    für die weitere Kalkulation verwenden.
  </p>

  <a
    href="/aufmass-angebote"
    className="maler-software-feature-link"
  >
    Mehr über Aufmaß &amp; Angebote erfahren →
  </a>
</article>

    <article>
      <h3>Angebote erstellen</h3>
      <p>
        Aus den erfassten Leistungen professionelle Angebote erstellen
        und anschließend in Aufträge überführen.
      </p>
      <a
  href="/aufmass-angebote"
  className="maler-software-feature-link"
>
  Mehr über Aufmaß & Angebote erfahren →
</a>
    </article>

    <article>
  <h3>Aufträge verwalten</h3>
  <p>
    Projekte planen, Mitarbeiter zuweisen und den aktuellen
    Arbeitsfortschritt zentral verfolgen.
  </p>

  <a
    href="/auftragsverwaltung"
    className="maler-software-feature-link"
  >
    Mehr über Auftragsverwaltung erfahren →
  </a>
</article>

    <article>
      <h3>Zeiterfassung auf der Baustelle</h3>
      <p>
        Arbeitszeiten projektbezogen erfassen und für Auswertungen und
        Nachkalkulationen bereitstellen.
      </p>
<a
  href="/zeiterfassung"
  className="maler-software-feature-link"
>
  Mehr über Zeiterfassung erfahren →
</a>

    </article>

    <article>
      <h3>Materialverwaltung</h3>
      <p>
        Materialbestände, Ausgaben, Rückgaben und Verbrauch dokumentieren
        und den jeweiligen Aufträgen zuordnen.
      </p>
<a
  href="/materialverwaltung"
  className="maler-software-feature-link"
>
  Mehr über Materialverwaltung erfahren →
</a>
    </article>

    <article>
      <h3>Rechnungen erstellen</h3>
      <p>
        Abgeschlossene Aufträge abrechnen und Rechnungen zentral im
        System verwalten.
      </p>

<a
  href="/rechnungen"
  className="maler-software-feature-link"
>
  Mehr über Rechnungen erfahren →
</a>

    </article>

    <article>
      <h3>Kundenportal</h3>
      <p>
        Kunden können wichtige Projektinformationen, Fortschritte,
        Bilder, Angebote und Rechnungen digital einsehen.
      </p>
      <a
  href="/kundenportal"
  className="maler-software-feature-link"
>
  Mehr über das Kundenportal erfahren →
</a>
    </article>

    <article>
      <h3>Mitarbeiter & Leistung</h3>
      <p>
        Mitarbeiter organisieren, projektbezogene Leistungen auswerten
        und betriebliche Abläufe transparenter machen.
      </p>
<a
  href="/leistungsbewertung"
  className="maler-software-feature-link"
>
  Mehr über Leistungsbewertung erfahren →
</a>

    </article>
    </div>
  </div>
</section>

<section className="maler-software-material-visual">
  <div className="maler-software-section-inner">
    <div className="maler-software-material-image-wrap">
      <img
        src="/images/materialverwaltung-malersaas.png"
        alt="Materialverwaltung in MalerSaaS mit Lagerbestand, Mindestbestand, Lieferanten, Lagerorten und Preisen"
        className="maler-software-material-image"
        loading="lazy"
      />
    </div>
  </div>
</section>

<section className="maler-software-benefits">
  <div className="maler-software-section-inner">
    <h2>Vorteile einer digitalen Software für Malerbetriebe</h2>

    <div className="maler-software-benefit-list">
      <article>
        <span className="maler-software-benefit-check">✓</span>
        <h3>Weniger doppelte Arbeit</h3>
        <p>
          Daten müssen nicht mehrfach in verschiedenen Programmen,
          Tabellen oder Formularen erfasst werden.
        </p>
      </article>

      <article>
        <span className="maler-software-benefit-check">✓</span>
        <h3>Bessere Übersicht</h3>
        <p>
          Aufträge, Mitarbeiter, Zeiten, Material und Rechnungen sind
          zentral verfügbar und leichter nachvollziehbar.
        </p>
      </article>

      <article>
        <span className="maler-software-benefit-check">✓</span>
        <h3>Mehr Transparenz auf der Baustelle</h3>
        <p>
          Arbeitsfortschritt, Zeiten, Bilder und Materialbewegungen können
          direkt dem jeweiligen Auftrag zugeordnet werden.
        </p>
      </article>

      <article>
        <span className="maler-software-benefit-check">✓</span>
        <h3>Schnellere Abläufe im Büro</h3>
        <p>
          Informationen aus Aufmaß, Angebot und Auftrag stehen für die
          weitere Bearbeitung strukturiert zur Verfügung.
        </p>
      </article>

      <article>
        <span className="maler-software-benefit-check">✓</span>
        <h3>Bessere Nachkalkulation</h3>
        <p>
          Projektbezogene Zeiten und Materialdaten schaffen eine bessere
          Grundlage für die wirtschaftliche Bewertung abgeschlossener
          Aufträge.
        </p>
      </article>

      <article>
        <span className="maler-software-benefit-check">✓</span>
        <h3>Professioneller Kundenservice</h3>
        <p>
          Kunden erhalten über das Kundenportal einen transparenten Einblick
          in wichtige Projektinformationen und Dokumente.
        </p>
      </article>
    </div>
  </div>
</section>

<section className="maler-software-target">
  <div className="maler-software-section-inner">
  <h2>Für welche Malerbetriebe eignet sich MalerSaaS?</h2>

  <p>
    MalerSaaS richtet sich an Malerbetriebe, die ihre Organisation
    digitalisieren und Informationen aus Büro, Projektleitung und
    Baustelle in einem gemeinsamen System zusammenführen möchten.
  </p>

  <div className="maler-software-target-grid">
    <article>
      <h3>Kleine Malerbetriebe</h3>
      <p>
        Für Betriebe, die Angebote, Aufträge, Arbeitszeiten und
        Rechnungen übersichtlich an einem Ort verwalten möchten.
      </p>
    </article>

    <article>
      <h3>Wachsende Malerfirmen</h3>
      <p>
        Für Unternehmen mit mehreren Mitarbeitern und parallelen
        Baustellen, bei denen Planung, Zuständigkeiten und aktuelle
        Projektinformationen immer wichtiger werden.
      </p>
    </article>

    <article>
      <h3>Digital arbeitende Malerbetriebe</h3>
      <p>
        Für Betriebe, die Papier, einzelne Tabellen und voneinander
        getrennte Programme durch durchgängige digitale Abläufe
        ersetzen möchten.
      </p>
    </article>
  </div>
  </div>
</section>

<section className="maler-software-cta">
  <div className="maler-software-cta-inner">
    <p className="maler-software-cta-label">
      Bereit für den nächsten Schritt?
    </p>

    <h2>MalerSaaS kostenlos testen</h2>

    <p className="maler-software-cta-text">
      Erlebe selbst, wie MalerSaaS Aufmaß, Angebote, Aufträge,
      Zeiterfassung, Materialverwaltung und Rechnungen in einer
      zentralen Software für Malerbetriebe verbindet.
    </p>

    <button
      type="button"
      className="maler-software-cta-button"
      onClick={onRegister}
    >
      14 Tage kostenlos testen
    </button>

    <p className="maler-software-cta-note">
      Für Malerbetriebe entwickelt · Direkt im Browser nutzbar
    </p>
  </div>
</section>

  </main>

<footer className="maler-software-footer">
  <div className="maler-software-footer-brand">
    <strong>MalerSaaS</strong>
    <span>Software für Malerbetriebe</span>
  </div>

  <div className="maler-software-footer-links">
    <a href="/">Startseite</a>

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

  <div className="maler-software-footer-copy">
    © 2026 MalerSaaS
  </div>
</footer>

  </div>
  </>
);
}