import SeoMeta from "../components/SeoMeta";
import SiteHeader from "../components/site/SiteHeader";
import SiteFooter from "../components/site/SiteFooter";
import "./MalerSoftwarePage.css";

const SEO_TITLE = "Maler Software & Malerprogramm für Malerbetriebe | MalerSaaS";
const SEO_DESCRIPTION =
  "Maler Software aus der Cloud: Aufmaß, Angebot, Aufträge, Zeiterfassung und Rechnung in einem Malerprogramm. 14 Tage kostenlos testen – endet automatisch.";

const FAQ: { q: string; a: string }[] = [
  {
    q: "Was ist eine Maler Software?",
    a: "Eine Maler Software (auch Malerprogramm oder Branchensoftware für Maler) bündelt die Abläufe eines Malerbetriebs in einem Programm: Aufmaß, Angebote, Aufträge, Mitarbeiter und Zeiterfassung, Material und Rechnungen. MalerSaaS ist speziell für Maler- und Lackiererbetriebe gemacht.",
  },
  {
    q: "Welche Software hilft Malern bei der Auftragsabwicklung?",
    a: "Hilfreich ist eine Software, die den ganzen Weg abdeckt – vom Aufmaß über das Angebot und den Auftrag bis zur Rechnung –, damit nichts doppelt eingegeben werden muss. Am besten testen Sie mit echten Aufträgen, ob die Abläufe zu Ihrem Betrieb passen; MalerSaaS können Sie dafür 14 Tage kostenlos nutzen.",
  },
  {
    q: "Gibt es die Malersoftware als App und in der Cloud?",
    a: "Ja. MalerSaaS läuft im Browser am PC, auf dem Tablet und auf dem Handy – ohne Installation. Mitarbeiter nutzen auf der Baustelle die Mitarbeiter-App, die Daten liegen sicher in der Cloud.",
  },
  {
    q: "Kann ich mit dem Malerprogramm auch Aufmaß und Kalkulation machen?",
    a: "Ja. Sie erfassen das Aufmaß (auch per Sprache), erstellen daraus Angebote mit Ihren Preisen und übernehmen angenommene Angebote direkt als Auftrag und später in die Rechnung.",
  },
  {
    q: "Ist MalerSaaS auch für Lackierer und kleine Betriebe geeignet?",
    a: "Ja. MalerSaaS richtet sich an Maler- und Lackiererbetriebe in Deutschland, Österreich und der Schweiz – vom Ein-Mann-Betrieb bis zum Betrieb mit mehreren Kolonnen.",
  },
  {
    q: "Was kostet die Software?",
    a: "Die Tarife finden Sie auf der Startseite. Sie können MalerSaaS 14 Tage kostenlos testen; die Testphase endet automatisch, ein Abo ist dafür nicht nötig.",
  },
  {
    q: "Was ist der Unterschied zwischen einer Malersoftware und einer allgemeinen Handwerkersoftware?",
    a: "Eine allgemeine Handwerkersoftware muss für viele Gewerke passen und bleibt deshalb oft allgemein. Eine Malersoftware ist auf die Abläufe im Maler- und Lackiererhandwerk zugeschnitten – zum Beispiel Aufmaß nach Flächen, Leistungen und Preise für Malerarbeiten, Material wie Farben und Tapeten, Fortschrittsfotos von der Baustelle und ein Kundenportal für Ihre Auftraggeber.",
  },
  {
    q: "Kann ich mit MalerSaaS E-Rechnungen (XRechnung und ZUGFeRD) erstellen?",
    a: "Ja. Rechnungen erzeugen Sie als PDF mit eingebetteten E-Rechnungsdaten (ZUGFeRD) und bei Bedarf zusätzlich als XRechnung. Damit sind Sie für die E-Rechnungspflicht im deutschen B2B-Geschäft vorbereitet.",
  },
  {
    q: "Funktioniert die Malersoftware auch in Österreich und der Schweiz?",
    a: "Ja. MalerSaaS ist für Deutschland, Österreich und die Schweiz gemacht. Bei der Registrierung wählen Sie Ihr Land; Währung (EUR oder CHF) und Mehrwertsteuersatz werden passend voreingestellt und lassen sich jederzeit anpassen.",
  },
  {
    q: "Wo werden meine Daten gespeichert?",
    a: "Ihre Betriebsdaten liegen auf Servern in der EU (Irland). Den Auftragsverarbeitungsvertrag (AVV) nach DSGVO finden Sie direkt auf unserer Website.",
  },
  {
    q: "Wie lange dauert die Einführung des Malerprogramms?",
    a: "Die Registrierung dauert wenige Minuten. Danach hinterlegen Sie Ihre Firmendaten und Preise, legen Mitarbeiter an und können sofort mit dem ersten Aufmaß oder Auftrag starten – ohne Installation und ohne Schulungstermin. Bei Fragen hilft der Hilfe-Chat direkt in der Software.",
  },
];

const MORE: { href: string; title: string; text: string }[] = [
  { href: "/ki-funktionen", title: "KI-Funktionen", text: "Aufmaß per Sprache, Lieferscheine und Belege per Foto, KI-Telefon und Werbung – die 7 KI-Helfer im Überblick." },
  { href: "/buchhaltung", title: "Buchhaltung & Steuerberater", text: "Belege fotografieren, Umsatzsteuer im Blick, Paket für den Steuerberater inklusive DATEV-Export." },
  { href: "/ki-telefon", title: "KI-Telefon", text: "Nimmt Anrufe an, wenn Sie auf der Baustelle sind, und schreibt Ihnen auf, wer was wollte." },
  { href: "/firmen-website", title: "Firmen-Website", text: "Eine eigene Website für Ihren Malerbetrieb – mit Referenzen und Anfrageformular." },
  { href: "/fachkraefte-finden", title: "Fachkräfte-Pool", text: "Maler und Lackierer in Ihrer Region finden, wenn es auf den Baustellen eng wird." },
  { href: "/auswertungen", title: "Auswertungen", text: "Umsatz, Deckungsbeitrag und Nachkalkulation je Auftrag – auf einen Blick." },
  { href: "/malertreff", title: "MalerTreff-Community", text: "Fachfragen stellen und Erfahrungen mit Kollegen aus dem Maler- und Lackiererhandwerk teilen." },
];

const CHECKLIST: { title: string; text: string }[] = [
  { title: "Aufmaß direkt auf der Baustelle", text: "Maße am Handy oder Tablet erfassen und ohne Abtippen ins Angebot übernehmen." },
  { title: "Durchgängiger Ablauf", text: "Vom Angebot über den Auftrag bis zur Rechnung – ohne Daten doppelt einzugeben." },
  { title: "E-Rechnung", text: "XRechnung und ZUGFeRD gehören in Deutschland ab 2027/2028 zum Pflichtprogramm." },
  { title: "Zeiterfassung nach Gesetz", text: "Arbeitszeiten projektbezogen erfassen, Pausen und Höchstarbeitszeiten im Blick behalten." },
  { title: "Für Handy und Tablet gemacht", text: "Ihre Mitarbeiter arbeiten auf der Baustelle – die Software muss dort einfach bedienbar sein." },
  { title: "Datenschutz", text: "Server in der EU und ein Auftragsverarbeitungsvertrag (AVV) nach DSGVO." },
  { title: "Schnittstelle zum Steuerberater", text: "Belege und Rechnungen als Paket bzw. DATEV-Export, statt Ordner voller Papier." },
  { title: "Faire Testphase", text: "Mit echten Aufträgen ausprobieren, ohne Kündigungsfristen und ohne automatische Verlängerung." },
];

const FAQ_LD = JSON.stringify({
  "@context": "https://schema.org",
  "@type": "FAQPage",
  mainEntity: FAQ.map((f) => ({ "@type": "Question", name: f.q, acceptedAnswer: { "@type": "Answer", text: f.a } })),
}).replace(/</g, "\\u003c");

export default function MalerSoftwarePage({
  onRegister,
  onLogin,
  onOpenImpressum,
  onOpenDatenschutz,
  onOpenAgb,
}: {
  onRegister: () => void;
  onLogin?: () => void;
  onOpenImpressum: () => void;
  onOpenDatenschutz: () => void;
  onOpenAgb: () => void;
}) {
  return (
    <>
  <SeoMeta
    title={SEO_TITLE}
    description={SEO_DESCRIPTION}
    canonical="https://maler-saas.com/maler-software"
  />
  <script type="application/ld+json" dangerouslySetInnerHTML={{ __html: FAQ_LD }} />

  <div className="maler-software-page">
    <SiteHeader onLogin={onLogin ?? (() => (window.location.href = "/"))} onRegister={onRegister} />

    <main>
    <section className="maler-software-hero">
  <div className="maler-software-hero-content">
    <p className="maler-software-badge">
      Branchensoftware für Maler und Lackierer – das Malerprogramm aus der Cloud
    </p>

    <h1>Maler Software für Ihren Malerbetrieb</h1>

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
      <span>✓ Server in der EU</span>
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
  <h2>Eine Software für Malerbetriebe – vom Büro bis zur Baustelle</h2>

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
  <h2>Malerprogramm: alle Funktionen für Ihren Malerbetrieb</h2>

  <p>
    Als Malerprogramm verbindet MalerSaaS die wichtigsten kaufmännischen und
    operativen Abläufe eines Malerbetriebs in einer zentralen Software.
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

<section className="maler-software-more">
  <div className="maler-software-section-inner">
    <h2>Mehr als ein Malerprogramm</h2>
    <p>
      Neben Aufmaß, Aufträgen und Rechnungen bringt MalerSaaS Werkzeuge mit,
      die sonst eigene Programme bräuchten.
    </p>
    <div className="maler-software-feature-grid">
      {MORE.map((m) => (
        <article key={m.href}>
          <h3>{m.title}</h3>
          <p>{m.text}</p>
          <a href={m.href} className="maler-software-feature-link">
            Mehr erfahren →
          </a>
        </article>
      ))}
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
    <h2>Branchensoftware für Maler und Lackierer: was bringt sie?</h2>

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

<section className="maler-software-checklist">
  <div className="maler-software-section-inner">
    <h2>Checkliste: Worauf Malerbetriebe bei einer Software achten sollten</h2>
    <p>
      Ob MalerSaaS oder ein anderes Programm – diese acht Punkte sollte eine
      gute Software für Malerbetriebe heute erfüllen.
    </p>
    <ol className="maler-software-checklist-list">
      {CHECKLIST.map((c) => (
        <li key={c.title}>
          <h3>{c.title}</h3>
          <p>{c.text}</p>
        </li>
      ))}
    </ol>
  </div>
</section>

<section className="maler-software-target maler-software-dach">
  <div className="maler-software-section-inner">
    <h2>Rechtssicher in Deutschland, Österreich und der Schweiz</h2>
    <div className="maler-software-target-grid">
      <article>
        <h3>🇩🇪 Deutschland</h3>
        <p>
          E-Rechnungen als ZUGFeRD und XRechnung: Empfangen müssen alle Betriebe
          sie schon seit 2025, ausstellen ab 2027 (über 800.000 € Vorjahresumsatz)
          bzw. ab 2028 alle. Dazu GoBD-gerechte Rechnungsnummern, Storno statt
          Löschen und der DATEV-Export für den Steuerberater.
        </p>
      </article>
      <article>
        <h3>🇦🇹 Österreich</h3>
        <p>
          Euro und 20 % Umsatzsteuer voreingestellt, Rechnungen mit allen
          Pflichtangaben und ein Belegpaket, das Steuerberater mit BMD, RZL oder
          DATEV Österreich weiterverarbeiten können.
        </p>
      </article>
      <article>
        <h3>🇨🇭 Schweiz</h3>
        <p>
          Rechnungen in Schweizer Franken mit 8,1 % Mehrwertsteuer – Währung und
          Steuersatz werden bei der Registrierung passend eingestellt.
        </p>
      </article>
    </div>
    <p className="maler-software-dach-note">
      Ihre Daten liegen auf Servern in der EU (Irland); den Auftragsverarbeitungsvertrag nach DSGVO finden Sie unter{" "}
      <a href="/avv">AVV</a>. Stand: November 2026 – allgemeine Informationen, keine Rechts- oder Steuerberatung.
    </p>
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

<section className="maler-software-target maler-software-faq">
  <div className="maler-software-section-inner">
    <h2>Häufige Fragen zur Maler Software</h2>
    {FAQ.map((f) => (
      <details key={f.q}>
        <summary>{f.q}</summary>
        <p>{f.a}</p>
      </details>
    ))}
    <p className="maler-software-faq-more">
      Mehr Praxiswissen für Malerbetriebe finden Sie im <a href="/ratgeber">Ratgeber</a>.
    </p>
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

<SiteFooter
        onRegister={onRegister}
        onLogin={onLogin ?? (() => (window.location.href = "/"))}
        onOpenImpressum={onOpenImpressum}
        onOpenDatenschutz={onOpenDatenschutz}
        onOpenAgb={onOpenAgb}
      />

  </div>
  </>
);
}