import { useState } from "react";
import SeoMeta from "../components/SeoMeta";
import "./KundenportalPage.css";

type KundenportalPageProps = {
  onRegister: () => void;
  onOpenImpressum: () => void;
  onOpenDatenschutz: () => void;
  onOpenAgb: () => void;
};

export default function KundenportalPage({
  onRegister,
  onOpenImpressum,
  onOpenDatenschutz,
  onOpenAgb,
}: KundenportalPageProps) {
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);
  return (
    <>
      <SeoMeta
        title="Kundenportal für Malerbetriebe | MalerSaaS"
        description="Digitales Kundenportal für Malerbetriebe: Angebote bestätigen, Projektstatus verfolgen und Baustellenfortschritt mit Bildern transparent für Kunden bereitstellen."
        canonical="https://maler-saas.com/kundenportal"
      />

      <div className="kundenportal-page">
        <header className="kundenportal-header">
  <a href="/" className="kundenportal-logo">
    <img
      src="/images/logo.png"
      alt="MalerSaaS"
      className="kundenportal-logo-image"
    />

    <div className="kundenportal-logo-text">
      <strong>MalerSaaS</strong>
      <span>Digitale Komplettlösung</span>
    </div>
  </a>

  <button
    type="button"
    className="kundenportal-menu-toggle"
    aria-label="Menü öffnen"
    aria-expanded={mobileMenuOpen}
    onClick={() => setMobileMenuOpen((prev) => !prev)}
  >
    <span></span>
    <span></span>
    <span></span>
  </button>

  <nav
    className={`kundenportal-nav ${
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
          <section className="kundenportal-hero">
            <div className="kundenportal-hero-content">
              <p className="kundenportal-badge">
                Digitales Kundenportal für Malerbetriebe
              </p>

              <h1>Kunden jederzeit transparent über ihr Projekt informieren</h1>

              <p className="kundenportal-hero-text">
                Mit dem MalerSaaS Kundenportal erhalten Kunden einen direkten
                Einblick in den aktuellen Stand ihres Projekts – ohne ständig
                im Betrieb nachfragen zu müssen.
              </p>

              <p className="kundenportal-hero-text">
                Angebote, Projektstatus und dokumentierter
                Baustellenfortschritt mit Bildern werden übersichtlich an
                einem Ort bereitgestellt.
              </p>

              <button
                type="button"
                className="kundenportal-cta-button"
                onClick={onRegister}
              >
                14 Tage kostenlos testen
              </button>
            </div>

            <div className="kundenportal-hero-visual">
              <img
                src="/images/kundenportal-malersaas.png"
                alt="MalerSaaS Kundenportal mit Angebot, Projektstatus und Baustellenfortschritt mit Bildern"
                className="kundenportal-hero-image"
              />
            </div>
          </section>

            <section className="kundenportal-overview">
  <div className="kundenportal-overview-intro">
    <p className="kundenportal-section-label">
      Projektstatus transparent
    </p>

    <h2>Vom Angebot bis zur Fertigstellung jederzeit nachvollziehbar</h2>

    <p>
      Kunden sehen im Portal, in welcher Phase sich ihr Projekt befindet.
      Der aktuelle Status bleibt übersichtlich dargestellt und kann während
      des gesamten Ablaufs nachvollzogen werden.
    </p>
  </div>

  <div className="kundenportal-overview-grid">
    <article>
      <h3>Angebot</h3>
      <p>
        Das aktuelle Angebot kann direkt im Kundenportal eingesehen und als
        PDF geöffnet werden.
      </p>
    </article>

    <article>
      <h3>Bestätigung</h3>
      <p>
        Kunden können das bereitgestellte Angebot direkt digital bestätigen.
      </p>
    </article>

    <article>
      <h3>Projektstatus</h3>
      <p>
        Geplant, in Arbeit, Prüfung oder fertig – der aktuelle Stand des
        Projekts bleibt für den Kunden sichtbar.
      </p>
    </article>

    <article>
      <h3>Fortschritt</h3>
      <p>
        Fortschrittsmeldungen und Baustellenbilder dokumentieren den
        tatsächlichen Arbeitsstand nachvollziehbar.
      </p>
    </article>
  </div>
</section>

<section className="kundenportal-offer">
  <div className="kundenportal-offer-content">
    <p className="kundenportal-section-label">
      Angebote direkt im Portal
    </p>

    <h2>Angebot einsehen und digital bestätigen</h2>

    <p>
      Kunden erhalten ihr Angebot direkt im Kundenportal und können die
      bereitgestellten Unterlagen ohne zusätzlichen E-Mail-Verkehr öffnen.
    </p>

    <div className="kundenportal-offer-grid">
      <article>
        <h3>Angebotsdaten im Blick</h3>
        <p>
          Angebotsnummer, Datum, Status und Gesamtbetrag werden direkt im
          Kundenportal übersichtlich dargestellt.
        </p>
      </article>

      <article>
        <h3>PDF-Angebot öffnen</h3>
        <p>
          Das vollständige Angebot kann direkt als PDF eingesehen werden.
        </p>
      </article>

      <article>
        <h3>Digital bestätigen</h3>
        <p>
          Der Kunde kann das Angebot direkt im Portal bestätigen, ohne
          zusätzliche Ausdrucke oder Rücksendungen.
        </p>
      </article>

      <article>
        <h3>Status sofort sichtbar</h3>
        <p>
          Nach der Bestätigung bleibt der aktuelle Angebotsstatus für den
          Kunden transparent nachvollziehbar.
        </p>
      </article>
    </div>
  </div>
</section>

<section className="kundenportal-progress">
  <div className="kundenportal-progress-intro">
    <p className="kundenportal-section-label">
      Fortschritt sichtbar machen
    </p>

    <h2>Baustellenfortschritt mit Bildern dokumentieren</h2>

    <p>
      Kunden sehen im Portal nicht nur den aktuellen Projektstatus, sondern
      auch dokumentierte Fortschrittsmeldungen und zugehörige Baustellenbilder.
    </p>
  </div>

  <div className="kundenportal-progress-grid">
    <article>
      <h3>Fortschrittsmeldungen anzeigen</h3>
      <p>
        Aktuelle Meldungen zum Arbeitsstand können direkt im Kundenportal
        nachvollzogen werden.
      </p>
    </article>

    <article>
      <h3>Baustellenbilder bereitstellen</h3>
      <p>
        Bilder aus dem Projekt werden dem jeweiligen Fortschritt zugeordnet
        und für den Kunden sichtbar gemacht.
      </p>
    </article>

    <article>
      <h3>Arbeitsschritte nachvollziehen</h3>
      <p>
        Vorher-, Zwischen- und Fortschrittsbilder helfen dabei, den Ablauf
        auf der Baustelle verständlich zu dokumentieren.
      </p>
    </article>

    <article>
      <h3>Weniger Rückfragen</h3>
      <p>
        Kunden können sich selbst über den aktuellen Stand informieren,
        ohne für jede Zwischenfrage im Betrieb anrufen zu müssen.
      </p>
    </article>
  </div>
</section>

<section className="kundenportal-benefits">
  <div className="kundenportal-benefits-intro">
    <p className="kundenportal-section-label">
      Vorteile für Betrieb und Kunde
    </p>

    <h2>Mehr Transparenz und weniger Rückfragen im Projektverlauf</h2>

    <p>
      Das Kundenportal bündelt wichtige Projektinformationen an einem Ort und
      erleichtert dadurch die Kommunikation zwischen Malerbetrieb und Kunde.
    </p>
  </div>

  <div className="kundenportal-benefits-grid">
    <article>
      <h3>Weniger Rückfragen</h3>
      <p>
        Kunden können den aktuellen Stand ihres Projekts selbst einsehen,
        ohne für jede Zwischenfrage im Betrieb anrufen zu müssen.
      </p>
    </article>

    <article>
      <h3>Mehr Transparenz</h3>
      <p>
        Angebote, Projektstatus und Fortschrittsmeldungen bleiben für den
        Kunden nachvollziehbar.
      </p>
    </article>

    <article>
      <h3>Professioneller Kundenservice</h3>
      <p>
        Ein digitales Kundenportal schafft einen modernen und strukturierten
        Kontaktpunkt für laufende Projekte.
      </p>
    </article>

    <article>
      <h3>Informationen zentral gebündelt</h3>
      <p>
        Wichtige Projektdaten müssen nicht über verschiedene E-Mails,
        Nachrichten und Telefonate zusammengesucht werden.
      </p>
    </article>
  </div>
</section>

<section className="kundenportal-final-cta">
  <div className="kundenportal-final-cta-content">
    <p className="kundenportal-final-cta-label">
      Kundenkommunikation digitalisieren
    </p>

    <h2>Projekte transparent und professionell mit Kunden teilen</h2>

    <p>
      Mit MalerSaaS erhalten Kunden einen klaren Einblick in Angebot,
      Projektstatus und dokumentierten Baustellenfortschritt.
    </p>

    <button
      type="button"
      className="kundenportal-final-cta-button"
      onClick={onRegister}
    >
      14 Tage kostenlos testen
    </button>
  </div>
</section>
        </main>
        <footer className="kundenportal-footer">
  <div className="kundenportal-footer-content">
    <div>
      <strong>MalerSaaS</strong>
      <p>Digitale Software für moderne Malerbetriebe.</p>
    </div>

    <div className="kundenportal-footer-links">
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