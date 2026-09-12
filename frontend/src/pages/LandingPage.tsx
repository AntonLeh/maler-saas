import { useState } from "react";
import "./LandingPage.css";

type LandingPageProps = {
  onLogin: () => void;
  onRegister: () => void;
  onOpenImpressum: () => void;
  onOpenDatenschutz: () => void;
  onOpenAgb: () => void;
};

const features = [
  {
    title: "Aufmaß & Angebote",
    text: "Aufmaße digital erfassen, Leistungen kalkulieren und professionelle Angebote direkt aus den erfassten Daten erstellen.",
  },
  {
    title: "Aufträge & Planung",
    text: "Aufträge zentral planen, Mitarbeiter zuweisen, Termine koordinieren und den aktuellen Projektstatus jederzeit verfolgen.",
  },
  {
    title: "Materialverwaltung",
    text: "Bestände, Materialausgaben, Rückgaben und Verbrauch dokumentieren und Materialbewegungen je Auftrag nachvollziehen.",
  },
  {
    title: "Zeiterfassung",
    text: "Arbeitszeiten mobil auf der Baustelle erfassen und projektbezogen für Auswertungen und Nachkalkulation bereitstellen.",
  },
  {
    title: "Kundenportal",
    text: "Kunden erhalten transparenten Zugriff auf Projektfortschritt, Bilder, Angebote, Rechnungen und wichtige Statusinformationen.",
  },
  {
    title: "Rechnungen & PDF",
    text: "Rechnungen, Abschlagsrechnungen und Schlussrechnungen erstellen und professionell als PDF an den Kunden ausgeben.",
  },
  {
    title: "Statistiken",
    text: "Umsatz, Aufträge, Auslastung, Leistung und weitere Betriebskennzahlen zentral auswerten und Entwicklungen erkennen.",
  },
  {
    title: "KI-Assistent",
    text: "Texte, Kundenkommunikation, Arbeitsbeschreibungen und betriebliche Auswertungen mit KI schneller vorbereiten.",
  },
  {
    title: "Website & digitale Sichtbarkeit",
    text: "Den eigenen Malerbetrieb professionell online präsentieren und digitale Sichtbarkeit als Bestandteil der Unternehmensentwicklung ausbauen.",
  },
];

export default function LandingPage({
  onLogin,
  onRegister,
  onOpenImpressum,
  onOpenDatenschutz,
  onOpenAgb,
}: LandingPageProps) {
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);
  return (
    <div className="landing-page">
  <header className="landing-header">
    <div className="landing-logo">
      <img
        src="/images/logo.png"
        alt="MalerSaaS Logo"
        className="landing-logo-image"
      />

      <div className="landing-logo-text">
        <strong>MalerSaaS</strong>
        <span>Digitale Komplettlösung</span>
      </div>
    </div>

    <button
      type="button"
      className="landing-menu-toggle"
      aria-label="Menü öffnen"
      aria-expanded={mobileMenuOpen}
      onClick={() => setMobileMenuOpen((prev) => !prev)}
    >
      <span></span>
      <span></span>
      <span></span>
    </button>

    <nav
      className={`landing-nav ${mobileMenuOpen ? "is-open" : ""}`}
    >
      <a href="/maler-software">Software</a>

      <a
        href="#solution"
        onClick={() => setMobileMenuOpen(false)}
      >
        Lösung
      </a>

      <a
        href="#growth"
        onClick={() => setMobileMenuOpen(false)}
      >
        Wachstum
      </a>

      <a
        href="#contact"
        onClick={() => setMobileMenuOpen(false)}
      >
        Kontakt
      </a>

      <button
        type="button"
        className="landing-login-btn"
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
        <section className="landing-hero landing-hero-premium">
          <div className="landing-hero-content">
            <p className="landing-badge">
  Software für Malerbetriebe – digital, mobil und praxisnah
</p>

<h1>
  Das digitale Betriebssystem für moderne Malerbetriebe.
</h1>

<p className="landing-hero-text">
  MalerSaaS ist die Software für Malerbetriebe, die Aufmaß, Angebote,
  Aufträge, Mitarbeiter, Zeiterfassung, Materialverwaltung und Rechnungen
  in einer Plattform verbindet. Vom ersten Kundenkontakt bis zur fertigen
  Rechnung steuerst du deinen Betrieb digital und behältst jederzeit den
  Überblick.
</p>

            <div className="landing-hero-actions">
              <button type="button" className="landing-primary-btn" onClick={onRegister}>
                14 Tage kostenlos testen
              </button>
              <button type="button" className="landing-secondary-btn" onClick={onLogin}>
                Zum Login
              </button>
            </div>

            <div className="landing-trust-row">
              <span>✓ Für Malerbetriebe entwickelt</span>
              <span>✓ Mobile-first</span>
              <span>✓ Premium-B2B-SaaS</span>
            </div>
          </div>

          <div className="landing-hero-visual">
            <div className="hero-orbit-card hero-card-main">
              <div className="mockup-topbar">
                <span></span><span></span><span></span>
              </div>

              <div className="mockup-title-row">
                <div>
                  <strong>Unternehmer-Cockpit</strong>
                  <small>Live-Übersicht</small>
                </div>
                <span className="mockup-pill">Premium</span>
              </div>

              <div className="mockup-stats">
                <div><strong>32</strong><span>Aufträge</span></div>
                <div><strong>CHF 84k</strong><span>Offerten</span></div>
                <div><strong>91%</strong><span>Auslastung</span></div>
              </div>

              <div className="landing-dashboard-collage">
  <img
    src="/images/maler-saas-landing-collage.png"
    alt="MalerSaaS Plattform"
    className="landing-dashboard-collage-image"
  />
</div>
            </div>

            <div className="hero-floating-card card-material">
              <strong>Materialfluss</strong>
              <span>Lager → Team → Auftrag</span>
            </div>

            <div className="hero-floating-card card-ai">
              <strong>KI-Assistent</strong>
              <span>Angebote, Texte, Analysen</span>
            </div>

            <div className="hero-phone-mockup">
              <div></div>
              <strong>Mobile App</strong>
              <span>Baustelle live</span>
            </div>
          </div>
        </section>

        <section className="landing-logo-strip">
          <span>Aufmaß</span>
          <span>Angebote</span>
          <span>Aufträge</span>
          <span>Material</span>
          <span>Zeit</span>
          <span>Rechnung</span>
          <span>Kundenportal</span>
          <span>KI</span>
        </section>
        <section className="landing-section landing-how-it-works">
  <p className="landing-section-label">So funktioniert es</p>

  <h2>Vom ersten Aufmaß bis zur fertigen Rechnung.</h2>

  <div className="how-grid">
    {[
  {
    title: "Firma registrieren",
    text: "MalerSaaS einrichten und die wichtigsten Firmendaten für Angebote, Aufträge und Rechnungen hinterlegen.",
  },
  {
    title: "Mitarbeiter anlegen",
    text: "Mitarbeiter und Projektleiter erfassen und die Zusammenarbeit im Betrieb digital organisieren.",
  },
  {
    title: "Aufmaß erfassen",
    text: "Maße und Leistungen direkt beim Kunden aufnehmen und als Grundlage für die Kalkulation verwenden.",
  },
  {
    title: "Angebot erstellen",
    text: "Aus dem erfassten Aufmaß ein professionelles Angebot erstellen und dem Kunden bereitstellen.",
  },
  {
    title: "Auftrag steuern",
    text: "Aufträge planen, Arbeitsfortschritt verfolgen, Zeiten erfassen und Materialbewegungen dokumentieren.",
  },
  {
    title: "Rechnung erzeugen",
    text: "Aus abgeschlossenen Aufträgen Rechnungen erstellen und den Zahlungsstatus zentral im Blick behalten.",
  },
].map((step, index) => (
  <article key={step.title}>
    <span>{index + 1}</span>

    <h3>{step.title}</h3>

    <p>{step.text}</p>
  </article>
))}
  </div>
</section>

        <section id="solution" className="landing-section">
          <p className="landing-section-label">Eine Plattform statt Insellösungen</p>
          <h2>Alles, was dein Betrieb täglich braucht – an einem Ort.</h2>

          <div className="landing-feature-grid premium-grid">
            {features.map((feature, index) => (
  <article key={feature.title}>
    <div className="feature-icon">{index + 1}</div>
    <h3>{feature.title}</h3>
    <p>{feature.text}</p>
  </article>
))}
          </div>
        </section>

        <section className="landing-section landing-image-section">
  <img
    src="/images/materialkontrolle.png"
    alt="Materialkontrolle in MalerSaaS"
    className="landing-full-image"
  />
</section>

        <section className="landing-section landing-visual-section">
          <div>
            <p className="landing-section-label">Kundenportal</p>
            <h2>Mehr Vertrauen durch transparente Kommunikation.</h2>
            <p>
              Kunden sehen Fortschritt, Bilder, Dokumente und Statusmeldungen –
              ohne interne Preise, Stunden oder sensible Betriebsdaten.
            </p>
          </div>

          <div className="customer-portal-image-frame">
  <img
    src="/images/kundenportal-projektfortschritt.png"
    alt="Kundenportal mit Projektfortschritt in MalerSaaS"
    className="customer-portal-image"
  />
</div>
        </section>

        <section id="growth" className="landing-section landing-growth">
          <p className="landing-section-label">Mehr als Software</p>
          <h2>Digitale Unternehmensentwicklung für Malerbetriebe.</h2>

          <div className="growth-grid">
            <article>
              <h3>Statistiken & Unternehmer-Cockpit</h3>
              <p>Umsatz, offene Angebote, Auslastung, Produktivität und Materialbewegungen klar auswerten.</p>
            </article>
            <article>
  <h3>Rechnungen & Zahlungsmanagement</h3>
  <p>
    Rechnungen, Abschlagsrechnungen und Schlussrechnungen erstellen,
    Zahlungsstatus überwachen und Mahnungen strukturiert verwalten.
  </p>
</article>
            <article>
              <h3>KI-Unterstützung</h3>
              <p>Angebotstexte, Kundenantworten, Arbeitsbeschreibungen und Auswertungen schneller erstellen.</p>
            </article>
            <article>
              <h3>Website, Domain & Multimedia</h3>
              <p>Eigene professionelle Online-Präsenz, Bilder, Inhalte und laufende digitale Pflege als Premium-Service.</p>
            </article>
          </div>
        </section>
            <section
  className="landing-section landing-image-section clickable-image-section"
  onClick={onRegister}
>
  <img
    src="/images/final-cta-bg.png"
    alt="Materialkontrolle in MalerSaaS"
    className="landing-full-image"
  />
</section>
        
      </main>

      <footer id="contact" className="landing-footer">
  <div>
    <strong>MalerSaaS</strong>
    <span>Digitale Komplettlösung für Malerbetriebe</span>
  </div>

  <div className="landing-footer-links">
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
</footer>
    </div>
  );
}