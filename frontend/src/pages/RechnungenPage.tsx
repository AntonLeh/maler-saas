import { useState } from "react";
import SeoMeta from "../components/SeoMeta";
import "./RechnungenPage.css";

type RechnungenPageProps = {
  onRegister: () => void;
  onOpenImpressum: () => void;
  onOpenDatenschutz: () => void;
  onOpenAgb: () => void;
};

export default function RechnungenPage({
  onRegister,
  onOpenImpressum,
  onOpenDatenschutz,
  onOpenAgb,
}: RechnungenPageProps) {
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);
  return (
    <>
      <SeoMeta
        title="Rechnungssoftware für Malerbetriebe | MalerSaaS"
        description="Rechnungen für Malerbetriebe digital erstellen und verwalten: Fälligkeiten, Zahlungsstatus, Abschlagsrechnungen, Schlussrechnungen und Rechnungs-PDFs mit MalerSaaS."
        canonical="https://maler-saas.com/rechnungen"
      />

      <div className="rechnungen-page">
        <header className="rechnungen-header">
  <a href="/" className="rechnungen-logo">
    <img
      src="/images/logo.png"
      alt="MalerSaaS"
      className="rechnungen-logo-image"
    />

    <div className="rechnungen-logo-text">
      <strong>MalerSaaS</strong>
      <span>Digitale Komplettlösung</span>
    </div>
  </a>

  <button
    type="button"
    className="rechnungen-menu-toggle"
    aria-label="Menü öffnen"
    aria-expanded={mobileMenuOpen}
    onClick={() => setMobileMenuOpen((prev) => !prev)}
  >
    <span></span>
    <span></span>
    <span></span>
  </button>

  <nav
    className={`rechnungen-nav ${
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
          <section className="rechnungen-hero">
            <div className="rechnungen-hero-content">
              <p className="rechnungen-badge">
                Rechnungssoftware für Malerbetriebe
              </p>

              <h1>Rechnungen erstellen und Zahlungen im Blick behalten</h1>

              <p className="rechnungen-hero-text">
                Mit MalerSaaS erstellen und verwalten Malerbetriebe ihre
                Rechnungen direkt auf Basis der ausgeführten Aufträge.
              </p>

              <p className="rechnungen-hero-text">
                Fälligkeiten, Beträge und Zahlungsstatus bleiben zentral
                sichtbar. Auch Abschlags- und Schlussrechnungen lassen sich
                nachvollziehbar verwalten.
              </p>

              <button
                type="button"
                className="rechnungen-cta-button"
                onClick={onRegister}
              >
                14 Tage kostenlos testen
              </button>
            </div>

            <div className="rechnungen-hero-visual">
              <img
                src="/images/rechnungen-malersaas.png"
                alt="Rechnungsverwaltung in MalerSaaS mit Rechnungsnummer, Fälligkeit, Betrag, Zahlungsstatus und Abschlagsrechnung"
                className="rechnungen-hero-image"
              />
            </div>
          </section>

            <section className="rechnungen-overview">
  <div className="rechnungen-overview-intro">
    <p className="rechnungen-section-label">
      Rechnungen zentral verwalten
    </p>

    <h2>Fälligkeiten, Beträge und Zahlungsstatus auf einen Blick</h2>

    <p>
      Jede Rechnung bleibt mit dem zugehörigen Auftrag verbunden. Dadurch
      lassen sich Rechnungsnummer, Datum, Fälligkeit, Betrag und aktueller
      Zahlungsstatus zentral nachvollziehen.
    </p>
  </div>

  <div className="rechnungen-overview-grid">
    <article>
      <h3>Rechnungen eindeutig zuordnen</h3>
      <p>
        Jede Rechnung erhält eine eigene Rechnungsnummer und bleibt dem
        passenden Auftrag zugeordnet.
      </p>
    </article>

    <article>
      <h3>Fälligkeiten im Blick behalten</h3>
      <p>
        Rechnungsdatum und Fälligkeitsdatum werden übersichtlich angezeigt,
        damit offene Forderungen leichter kontrolliert werden können.
      </p>
    </article>

    <article>
      <h3>Beträge transparent darstellen</h3>
      <p>
        Netto, Mehrwertsteuer und Gesamtbetrag sind direkt in der
        Rechnungsübersicht sichtbar.
      </p>
    </article>

    <article>
      <h3>Zahlungsstatus erkennen</h3>
      <p>
        Offene und bezahlte Rechnungen lassen sich anhand ihres Status
        schnell unterscheiden.
      </p>
    </article>
  </div>
</section>

<section className="rechnungen-partials">
  <div className="rechnungen-partials-content">
    <p className="rechnungen-section-label">
      Abschlags- und Schlussrechnungen
    </p>

    <h2>Teilzahlungen sauber erfassen und in der Schlussrechnung berücksichtigen</h2>

    <p>
      Für größere Aufträge können Abschlagsrechnungen erstellt und später
      nachvollziehbar in die Schlussrechnung übernommen werden.
    </p>

    <div className="rechnungen-partials-grid">
      <article>
        <h3>Abschlagsrechnung erstellen</h3>
        <p>
          Für einen Auftrag kann eine Abschlagsrechnung mit dem vorgesehenen
          Teilbetrag erstellt und separat geführt werden.
        </p>
      </article>

      <article>
        <h3>Zahlungsstatus dokumentieren</h3>
        <p>
          Bezahlte Abschlagsrechnungen bleiben mit Zahlungsstatus und
          Zahlungsdatum nachvollziehbar dokumentiert.
        </p>
      </article>

      <article>
        <h3>In Schlussrechnung übernehmen</h3>
        <p>
          Bereits berücksichtigte Abschlagsrechnungen werden in der
          Rechnungsübersicht entsprechend gekennzeichnet.
        </p>
      </article>

      <article>
        <h3>Offenen Restbetrag abrechnen</h3>
        <p>
          Die Schlussrechnung führt die bisherige Abrechnung zusammen und
          bildet den noch offenen Rechnungsbetrag des Auftrags ab.
        </p>
      </article>
    </div>
  </div>
</section>

<section className="rechnungen-actions">
  <div className="rechnungen-actions-intro">
    <p className="rechnungen-section-label">
      Rechnungen weiterverarbeiten
    </p>

    <h2>PDF erstellen, Zahlungen erfassen und offene Forderungen verfolgen</h2>

    <p>
      Rechnungen können als PDF erstellt, als bezahlt markiert und bei Bedarf
      über das Mahnwesen weiterverfolgt werden.
    </p>
  </div>

  <div className="rechnungen-actions-grid">
    <article>
      <h3>Rechnungs-PDF erstellen</h3>
      <p>
        Für jede Rechnung kann direkt ein PDF erzeugt werden, das sich für
        den Versand oder die weitere Ablage verwenden lässt.
      </p>
    </article>

    <article>
      <h3>Zahlung dokumentieren</h3>
      <p>
        Eingegangene Zahlungen können direkt an der Rechnung erfasst werden,
        sodass der Zahlungsstatus aktuell bleibt.
      </p>
    </article>

    <article>
      <h3>Offene Rechnungen erkennen</h3>
      <p>
        Offene Forderungen und deren Fälligkeit bleiben in der Übersicht
        sichtbar und lassen sich gezielt kontrollieren.
      </p>
    </article>

    <article>
      <h3>Mahnungen verwalten</h3>
      <p>
        Für überfällige Rechnungen können Mahnungen erstellt und der weitere
        Bearbeitungsstand nachvollziehbar dokumentiert werden.
      </p>
    </article>
  </div>
</section>

<section className="rechnungen-pdf-preview">
  <div className="rechnungen-pdf-preview-content">
    <div className="rechnungen-pdf-preview-text">
      <p className="rechnungen-section-label">
        Professionelle Rechnungs-PDFs
      </p>

      <h2>Fertige Rechnungen direkt als PDF erstellen</h2>

      <p>
        MalerSaaS erstellt aus den Rechnungsdaten ein übersichtliches
        Rechnungs-PDF mit Firmenlogo, Rechnungsadresse, Auftragsdaten,
        Leistungspositionen und Rechnungsbeträgen.
      </p>

      <p>
        Auch bei Schlussrechnungen bleiben bereits geleistete
        Abschlagszahlungen und der noch zu zahlende Restbetrag transparent
        dargestellt.
      </p>
    </div>

    <div className="rechnungen-pdf-preview-visual">
      <img
        src="/images/rechnung-pdf-malersaas.png"
        alt="Mit MalerSaaS erstellte Schlussrechnung mit Leistungspositionen, Abschlagszahlung und Restbetrag"
        className="rechnungen-pdf-preview-image"
      />
    </div>
  </div>
</section>

<section className="rechnungen-benefits">
  <div className="rechnungen-benefits-intro">
    <p className="rechnungen-section-label">
      Vorteile im Betriebsalltag
    </p>

    <h2>Rechnungen schneller erstellen und besser nachverfolgen</h2>

    <p>
      Mit einer zentralen Rechnungsverwaltung lassen sich offene Forderungen,
      Teilzahlungen und abgeschlossene Rechnungen einfacher überblicken.
    </p>
  </div>

  <div className="rechnungen-benefits-grid">
    <article>
      <h3>Weniger doppelte Arbeit</h3>
      <p>
        Rechnungen bauen auf vorhandenen Auftragsdaten auf und müssen nicht
        jedes Mal vollständig neu erfasst werden.
      </p>
    </article>

    <article>
      <h3>Fälligkeiten im Blick</h3>
      <p>
        Offene Rechnungen und ihre Fälligkeit bleiben zentral sichtbar.
      </p>
    </article>

    <article>
      <h3>Zahlungen nachvollziehen</h3>
      <p>
        Bezahlte und offene Rechnungen lassen sich über ihren Status schnell
        unterscheiden.
      </p>
    </article>

    <article>
      <h3>Professioneller Außenauftritt</h3>
      <p>
        Einheitliche Rechnungs-PDFs mit Firmendaten und Logo sorgen für einen
        professionellen Eindruck beim Kunden.
      </p>
    </article>
  </div>
</section>

<section className="rechnungen-final-cta">
  <div className="rechnungen-final-cta-content">
    <p className="rechnungen-final-cta-label">
      Rechnungswesen digitalisieren
    </p>

    <h2>Rechnungen schneller erstellen und Zahlungen besser verfolgen</h2>

    <p>
      Mit MalerSaaS verwaltest du Rechnungen, Fälligkeiten,
      Abschlagszahlungen, Schlussrechnungen und Zahlungsstatus zentral.
    </p>

    <button
      type="button"
      className="rechnungen-final-cta-button"
      onClick={onRegister}
    >
      14 Tage kostenlos testen
    </button>
  </div>
</section>

        </main>

        <footer className="rechnungen-footer">
  <div className="rechnungen-footer-content">
    <div>
      <strong>MalerSaaS</strong>
      <p>Digitale Software für moderne Malerbetriebe.</p>
    </div>

    <div className="rechnungen-footer-links">
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