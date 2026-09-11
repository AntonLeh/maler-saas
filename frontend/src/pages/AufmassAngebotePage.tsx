import SeoMeta from "../components/SeoMeta";
import "./AufmassAngebotePage.css";

export default function AufmassAngebotePage({
  onRegister,
  onOpenImpressum,
  onOpenDatenschutz,
  onOpenAgb,
}: {
  onRegister: () => void;
  onOpenImpressum: () => void;
  onOpenDatenschutz: () => void;
  onOpenAgb: () => void;
}) {
  return (
    <>
      <SeoMeta
        title="Aufmaß & Angebote für Malerbetriebe | MalerSaaS"
        description="Digitales Aufmaß und Angebote für Malerbetriebe: Maße und Leistungen beim Kunden erfassen, Angebote kalkulieren und direkt in Aufträge überführen."
        canonical="https://maler-saas.com/aufmass-angebote"
      />

      <div className="aufmass-angebote-page">
        <header className="aufmass-angebote-header">
  <a href="/" className="aufmass-angebote-logo">
    <img
      src="/images/logo.png"
      alt="MalerSaaS"
      className="aufmass-angebote-logo-image"
    />

    <div className="aufmass-angebote-logo-text">
      <strong>MalerSaaS</strong>
      <span>Digitale Komplettlösung</span>
    </div>
  </a>

  <nav className="aufmass-angebote-nav">
    <a href="/">Startseite</a>
    <a href="/maler-software">Software</a>
  </nav>
</header>
        <main>
          <section className="aufmass-angebote-hero">
  <div className="aufmass-angebote-hero-content">
    <p className="aufmass-angebote-badge">
      Digitales Aufmaß und Angebotskalkulation für Malerbetriebe
    </p>

    <h1>Aufmaß erfassen und Angebote direkt daraus erstellen</h1>

    <p className="aufmass-angebote-hero-text">
      Mit MalerSaaS erfassen Malerbetriebe Räume, Flächen und Leistungen
      direkt beim Kunden und verwenden diese Daten anschließend für die
      Angebotserstellung.
    </p>

    <p className="aufmass-angebote-hero-text">
      Dadurch müssen Informationen nicht mehrfach übertragen werden und
      Aufmaß, Kalkulation und Angebot bleiben in einem durchgängigen
      digitalen Ablauf miteinander verbunden.
    </p>
  </div>

  <div className="aufmass-angebote-hero-visual">
    <img
      src="/images/Aufmaß.png"
      alt="Digitales Aufmaß und Angebotserstellung mit MalerSaaS"
      className="aufmass-angebote-hero-image"
    />
  </div>
</section>

<section className="aufmass-angebote-intro">
  <div className="aufmass-angebote-section-inner">
    <h2>Digitales Aufmaß für Malerbetriebe</h2>

    <p>
      Beim Aufmaß werden die wichtigsten Daten direkt vor Ort erfasst.
      Räume, Wand- und Deckenflächen, Fenster, Türen, Heizkörper und
      weitere relevante Angaben können strukturiert aufgenommen und dem
      jeweiligen Kunden beziehungsweise Auftrag zugeordnet werden.
    </p>

    <div className="aufmass-angebote-intro-grid">
      <article>
        <h3>Räume und Flächen erfassen</h3>
        <p>
          Wand- und Deckenflächen sowie einzelne Räume systematisch
          dokumentieren und für die weitere Kalkulation verwenden.
        </p>
      </article>

      <article>
        <h3>Bauteile berücksichtigen</h3>
        <p>
          Fenster, Türen, Heizkörper und weitere relevante Bauteile direkt
          beim Aufmaß mit erfassen.
        </p>
      </article>

      <article>
        <h3>Notizen und Bilder ergänzen</h3>
        <p>
          Besonderheiten, Kundenwünsche und Baustellenbilder direkt dem
          Aufmaß zuordnen.
        </p>
      </article>

      <article>
        <h3>Daten direkt weiterverwenden</h3>
        <p>
          Die erfassten Aufmaßdaten stehen anschließend als Grundlage für
          Kalkulation, Angebot und Auftrag zur Verfügung.
        </p>
      </article>
    </div>
  </div>
</section>

<section className="aufmass-angebote-process">
  <div className="aufmass-angebote-section-inner">
    <p className="aufmass-angebote-process-label">
      Vom Aufmaß zum Angebot
    </p>

    <h2>Aus erfassten Daten wird ein professionelles Angebot</h2>

    <p className="aufmass-angebote-process-intro">
      Die beim Aufmaß aufgenommenen Informationen bilden die Grundlage
      für die weitere Kalkulation. So bleiben Kundendaten, Maße,
      Leistungen und Angebot miteinander verbunden.
    </p>

    <div className="aufmass-angebote-process-steps">
      <article>
        <span>01</span>
        <h3>Aufmaß erfassen</h3>
        <p>
          Räume, Flächen, Bauteile und weitere Angaben direkt beim
          Kunden aufnehmen.
        </p>
      </article>

      <article>
        <span>02</span>
        <h3>Leistungen kalkulieren</h3>
        <p>
          Die erfassten Daten als Grundlage für die benötigten
          Leistungen und Positionen verwenden.
        </p>
      </article>

      <article>
        <span>03</span>
        <h3>Angebot erstellen</h3>
        <p>
          Aus der Kalkulation ein strukturiertes Angebot für den
          Kunden erstellen.
        </p>
      </article>

      <article>
        <span>04</span>
        <h3>Auftrag übernehmen</h3>
        <p>
          Nach der Angebotsbestätigung kann der Vorgang ohne erneute
          Dateneingabe in die Auftragsabwicklung übergehen.
        </p>
      </article>
    </div>
  </div>
</section>

<section className="aufmass-angebote-real-example">
  <div className="aufmass-angebote-section-inner">
    <div className="aufmass-angebote-real-example-heading">
      <p className="aufmass-angebote-process-label">
        Direkt aus MalerSaaS
      </p>

      <h2>Vom Aufmaß zur konkreten Angebotsposition</h2>

      <p>
        Die erfassten Flächen und Bauteile werden zu kalkulierbaren
        Positionen. So entstehen beispielsweise aus Wandflächen,
        Deckenflächen, Fenstern oder Heizkörpern konkrete Leistungen
        mit Menge, Einheitspreis und Gesamtpreis.
      </p>
    </div>

    <div className="aufmass-angebote-real-example-image-wrap">
      <img
        src="/images/angebot-malersaas.png"
        alt="Angebot in MalerSaaS mit Räumen, Wand- und Deckenflächen, Leistungen, Mengen und Preisen"
        className="aufmass-angebote-real-example-image"
        loading="lazy"
      />
    </div>
  </div>
</section>

<section className="aufmass-angebote-benefits">
  <div className="aufmass-angebote-section-inner">
    <div className="aufmass-angebote-benefits-heading">
      <p className="aufmass-angebote-process-label">
        Weniger Aufwand im Büro
      </p>

      <h2>Aufmaß und Angebot ohne doppelte Dateneingabe</h2>

      <p>
        Wenn Aufmaß und Angebot in einem durchgängigen System verbunden
        sind, müssen Informationen nicht immer wieder neu übertragen
        werden. Das spart Zeit und sorgt für nachvollziehbare Abläufe
        vom ersten Kundentermin bis zum Auftrag.
      </p>
    </div>

    <div className="aufmass-angebote-benefits-grid">
      <article>
        <h3>Weniger Übertragungsfehler</h3>
        <p>
          Bereits erfasste Maße und Angaben können im weiteren Ablauf
          verwendet werden, statt sie erneut aus Notizen oder anderen
          Unterlagen zu übertragen.
        </p>
      </article>

      <article>
        <h3>Schneller kalkulieren</h3>
        <p>
          Flächen, Bauteile und Leistungen stehen strukturiert zur
          Verfügung und bilden eine klare Grundlage für die Kalkulation.
        </p>
      </article>

      <article>
        <h3>Angebote übersichtlich aufbauen</h3>
        <p>
          Leistungen lassen sich nach Bereichen und Räumen darstellen,
          sodass auch umfangreichere Malerarbeiten nachvollziehbar
          kalkuliert werden können.
        </p>
      </article>

      <article>
        <h3>Direkt zum Auftrag</h3>
        <p>
          Wird ein Angebot bestätigt, können die vorhandenen Daten für
          die weitere Auftragsabwicklung genutzt werden.
        </p>
      </article>
    </div>
  </div>
</section>

<section className="aufmass-angebote-cta">
  <div className="aufmass-angebote-section-inner">
    <div className="aufmass-angebote-cta-content">
      <h2>Aufmaß und Angebote mit MalerSaaS digitalisieren</h2>

      <p>
        Teste MalerSaaS 14 Tage kostenlos und erlebe, wie Aufmaß,
        Kalkulation, Angebote und Auftragsabwicklung in einem
        durchgängigen System zusammenarbeiten.
      </p>

      <button
        type="button"
        className="aufmass-angebote-cta-button"
        onClick={onRegister}
      >
        14 Tage kostenlos testen
      </button>
    </div>
  </div>
</section>

<footer className="aufmass-angebote-footer">
  <div className="aufmass-angebote-footer-brand">
    <strong>MalerSaaS</strong>
    <span>Software für Malerbetriebe</span>
  </div>

  <div className="aufmass-angebote-footer-links">
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

  <div className="aufmass-angebote-footer-copy">
    © 2026 MalerSaaS
  </div>
</footer>

        </main>
      </div>
    </>
  );
}