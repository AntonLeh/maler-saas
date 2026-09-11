import SeoMeta from "../components/SeoMeta";
import "./MaterialverwaltungPage.css";

type MaterialverwaltungPageProps = {
  onRegister: () => void;
  onOpenImpressum: () => void;
  onOpenDatenschutz: () => void;
  onOpenAgb: () => void;
};

export default function MaterialverwaltungPage({
  onRegister,
  onOpenImpressum,
  onOpenDatenschutz,
  onOpenAgb,
}: MaterialverwaltungPageProps) {
  return (
    <>
      <SeoMeta
        title="Materialverwaltung für Malerbetriebe | MalerSaaS"
        description="Digitale Materialverwaltung für Malerbetriebe: Lagerbestand, Mindestbestand, Lieferanten, Lagerorte und Materialverbrauch zentral mit MalerSaaS verwalten."
        canonical="https://maler-saas.com/materialverwaltung"
      />

      <div className="materialverwaltung-page">
        <header className="materialverwaltung-header">
          <a href="/" className="materialverwaltung-logo">
            <img
              src="/images/logo.png"
              alt="MalerSaaS"
              className="materialverwaltung-logo-image"
            />

            <div className="materialverwaltung-logo-text">
              <strong>MalerSaaS</strong>
              <span>Digitale Komplettlösung</span>
            </div>
          </a>

          <nav className="materialverwaltung-nav">
            <a href="/">Startseite</a>
            <a href="/maler-software">Software</a>
          </nav>
        </header>

        <main>
          <section className="materialverwaltung-hero">
            <div className="materialverwaltung-hero-content">
              <p className="materialverwaltung-badge">
                Digitale Materialverwaltung für Malerbetriebe
              </p>

              <h1>Material und Lagerbestand zentral verwalten</h1>

              <p className="materialverwaltung-hero-text">
                Mit MalerSaaS verwalten Malerbetriebe ihre Materialien,
                Lagerbestände und Mindestbestände an einem zentralen Ort.
              </p>

              <p className="materialverwaltung-hero-text">
                Lieferanten, Lagerorte, Einkaufspreise und Kategorien bleiben
                direkt mit dem jeweiligen Material verbunden und sind schnell
                auffindbar.
              </p>

              <button
                type="button"
                className="materialverwaltung-cta-button"
                onClick={onRegister}
              >
                14 Tage kostenlos testen
              </button>
            </div>

            <div className="materialverwaltung-hero-visual">
              <img
                src="/images/materialverwaltung-uebersicht-malersaas.png"
                alt="Materialverwaltung in MalerSaaS mit Lagerbestand, Mindestbestand, Lieferant, Lagerort und Einkaufspreis"
                className="materialverwaltung-hero-image"
              />
            </div>
          </section>

            <section className="materialverwaltung-overview">
  <div className="materialverwaltung-overview-intro">
    <p className="materialverwaltung-section-label">
      Lagerbestand im Blick
    </p>

    <h2>Bestände und Mindestbestände zentral überwachen</h2>

    <p>
      Für jedes Material können aktueller Lagerbestand und Mindestbestand
      hinterlegt werden. So bleibt sichtbar, welche Materialien ausreichend
      vorhanden sind und wo Nachbestellungen erforderlich werden können.
    </p>
  </div>

  <div className="materialverwaltung-overview-grid">
    <article>
      <h3>Aktuellen Bestand pflegen</h3>
      <p>
        Der vorhandene Lagerbestand wird direkt beim jeweiligen Material
        geführt und bleibt zentral einsehbar.
      </p>
    </article>

    <article>
      <h3>Mindestbestand festlegen</h3>
      <p>
        Für häufig benötigte Farben, Werkzeuge oder Verbrauchsmaterialien
        kann ein individueller Mindestbestand hinterlegt werden.
      </p>
    </article>

    <article>
      <h3>Einheiten sauber erfassen</h3>
      <p>
        Materialien lassen sich mit passenden Einheiten wie Eimer,
        Stück oder anderen betrieblichen Mengeneinheiten verwalten.
      </p>
    </article>

    <article>
      <h3>Materialstatus erkennen</h3>
      <p>
        Aktive Materialien bleiben in der Übersicht verfügbar und können
        für die weitere Planung und Verwendung herangezogen werden.
      </p>
    </article>
  </div>
</section>

<section className="materialverwaltung-organisation">
  <div className="materialverwaltung-organisation-content">
    <p className="materialverwaltung-section-label">
      Materialien schnell finden
    </p>

    <h2>Materialien nach Name, Lieferant oder Lagerort durchsuchen</h2>

    <p>
      Mit der integrierten Suche und dem Kategorienfilter lassen sich
      Materialien schnell eingrenzen und gezielt wiederfinden.
    </p>

    <div className="materialverwaltung-organisation-grid">
      <article>
        <h3>Materialsuche</h3>
        <p>
          Suche nach Materialname, Lieferant oder Lagerort und finde
          benötigte Einträge ohne langes Durchsuchen der gesamten Liste.
        </p>
      </article>

      <article>
        <h3>Kategorien filtern</h3>
        <p>
          Materialien können nach Kategorien organisiert und gefiltert
          werden, damit ähnliche Produkte übersichtlich zusammenbleiben.
        </p>
      </article>

      <article>
        <h3>Lieferanten hinterlegen</h3>
        <p>
          Der passende Lieferant bleibt direkt am Material gespeichert und
          ist bei Rückfragen oder Nachbestellungen sofort sichtbar.
        </p>
      </article>

      <article>
        <h3>Lagerorte dokumentieren</h3>
        <p>
          Lagerorte können direkt beim Material hinterlegt werden, damit
          Mitarbeiter schneller wissen, wo sich das Material befindet.
        </p>
      </article>
    </div>
  </div>
</section>

<section className="materialverwaltung-usage">
  <div className="materialverwaltung-usage-intro">
    <p className="materialverwaltung-section-label">
      Material im Auftrag
    </p>

    <h2>Materialübergabe und Verbrauch nachvollziehbar dokumentieren</h2>

    <p>
      Materialien können direkt einem Auftrag und den beteiligten
      Mitarbeitern zugeordnet werden. Übergaben, Verbrauch und Rückgaben
      bleiben dadurch nachvollziehbar dokumentiert.
    </p>
  </div>

  <div className="materialverwaltung-usage-grid">
    <article>
      <h3>Material zuweisen</h3>
      <p>
        Benötigte Materialien können einem Auftrag und dem vorgesehenen
        Mitarbeiter zugeordnet werden.
      </p>
    </article>

    <article>
      <h3>Übergabe bestätigen</h3>
      <p>
        Der Mitarbeiter bestätigt die tatsächliche Übernahme des Materials,
        bevor die Übergabe als abgeschlossen gilt.
      </p>
    </article>

    <article>
      <h3>Verbrauch dokumentieren</h3>
      <p>
        Verwendete Materialmengen können direkt im Zusammenhang mit dem
        Auftrag erfasst und später nachvollzogen werden.
      </p>
    </article>

    <article>
      <h3>Rückgaben erfassen</h3>
      <p>
        Nicht verbrauchtes Material kann zurückgebucht werden und fließt
        wieder in den verfügbaren Lagerbestand ein.
      </p>
    </article>
  </div>
</section>

<section className="materialverwaltung-benefits">
  <div className="materialverwaltung-benefits-intro">
    <p className="materialverwaltung-section-label">
      Vorteile im Betriebsalltag
    </p>

    <h2>Mehr Überblick über Material, Bestand und Verbrauch</h2>

    <p>
      Eine zentrale Materialverwaltung hilft dabei, Lagerbestände
      nachvollziehbar zu führen und Materialbewegungen direkt mit den
      jeweiligen Aufträgen zu verbinden.
    </p>
  </div>

  <div className="materialverwaltung-benefits-grid">
    <article>
      <h3>Weniger Suchaufwand</h3>
      <p>
        Materialien, Lieferanten und Lagerorte sind zentral gespeichert
        und schneller auffindbar.
      </p>
    </article>

    <article>
      <h3>Bestände besser kontrollieren</h3>
      <p>
        Aktuelle Bestände und hinterlegte Mindestbestände schaffen mehr
        Transparenz im Lager.
      </p>
    </article>

    <article>
      <h3>Materialbewegungen nachvollziehen</h3>
      <p>
        Übergaben, Verbrauch und Rückgaben bleiben mit dem jeweiligen
        Auftrag verknüpft.
      </p>
    </article>

    <article>
      <h3>Bessere Grundlage für Auswertungen</h3>
      <p>
        Dokumentierte Materialverbräuche schaffen eine bessere Datenbasis
        für spätere Kalkulationen und betriebliche Auswertungen.
      </p>
    </article>
  </div>
</section>

<section className="materialverwaltung-final-cta">
  <div className="materialverwaltung-final-cta-content">
    <p className="materialverwaltung-final-cta-label">
      Materialverwaltung digitalisieren
    </p>

    <h2>Material, Lagerbestand und Verbrauch zentral verwalten</h2>

    <p>
      Mit MalerSaaS behältst du Materialien, Bestände, Lieferanten,
      Lagerorte und auftragsbezogene Materialbewegungen an einem Ort im Blick.
    </p>

    <button
      type="button"
      className="materialverwaltung-final-cta-button"
      onClick={onRegister}
    >
      14 Tage kostenlos testen
    </button>
  </div>
</section>

        </main>

    <footer className="materialverwaltung-footer">
  <div className="materialverwaltung-footer-content">
    <div>
      <strong>MalerSaaS</strong>
      <p>Digitale Software für moderne Malerbetriebe.</p>
    </div>

    <div className="materialverwaltung-footer-links">
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