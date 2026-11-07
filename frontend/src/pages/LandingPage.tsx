import { useEffect, useState } from "react";
import "./LandingPage.css";
import ContactForm from "../components/ContactForm";

type LandingPageProps = {
  onLogin: () => void;
  onRegister: () => void;
  onOpenImpressum: () => void;
  onOpenDatenschutz: () => void;
  onOpenAgb: () => void;
};

/** Probleme aus dem Alltag – und wie MalerSaaS sie löst */
const pains = [
  {
    problem: "Abends noch Angebote tippen",
    solution: "Aufmaß beim Kunden erfassen – das Angebot entsteht direkt daraus, mit Ihren Preisen und Ihrem Logo.",
  },
  {
    problem: "Zettel, Excel und WhatsApp-Chaos",
    solution: "Kunden, Aufträge, Termine, Fotos und Nachrichten an einem Ort – im Büro und auf der Baustelle.",
  },
  {
    problem: "Material verschwindet",
    solution: "Jede Ausgabe und Rückgabe wird dem Mitarbeiter und dem Auftrag zugeordnet. Verluste werden sichtbar.",
  },
  {
    problem: "Rechnungen bleiben offen",
    solution: "Rechnung mit einem Klick per E-Mail, GiroCode zum Bezahlen, offene Posten und Mahnungen im Blick.",
  },
  {
    problem: "Die E-Rechnungspflicht kommt",
    solution: "Jede Rechnung ist automatisch eine E-Rechnung (ZUGFeRD) – XRechnung für Behörden inklusive.",
  },
  {
    problem: "Belege für den Steuerberater sammeln",
    solution: "Belege abfotografieren, die KI liest sie aus. Am Monatsende ein Paket für den Steuerberater – mit DATEV-Export.",
  },
];

/** Funktionen – mit Unterseite, wo es eine gibt */
const features: { title: string; text: string; href?: string }[] = [
  {
    title: "Aufmaß & Angebote",
    text: "Räume, Flächen, Fenster und Türen digital aufmessen und daraus professionelle Angebote erstellen – inklusive Online-Freigabe durch den Kunden.",
    href: "/aufmass-angebote",
  },
  {
    title: "Aufträge & Planung",
    text: "Aufträge planen, Mitarbeiter einteilen, Baufortschritt mit Fotos dokumentieren und jederzeit den Stand sehen.",
    href: "/auftragsverwaltung",
  },
  {
    title: "Zeiterfassung",
    text: "Arbeitszeiten und Pausen mobil auf der Baustelle erfassen – direkt dem richtigen Auftrag zugeordnet, für eine ehrliche Nachkalkulation.",
    href: "/zeiterfassung",
  },
  {
    title: "Materialverwaltung",
    text: "Bestände, Ausgaben an Mitarbeiter, Rückgaben und Verbrauch je Auftrag nachvollziehen.",
    href: "/materialverwaltung",
  },
  {
    title: "Rechnungen & E-Rechnung",
    text: "Rechnungen, Abschlags- und Schlussrechnungen rechtssicher erstellen – als E-Rechnung (ZUGFeRD, XRechnung), mit GiroCode und Versand per E-Mail.",
    href: "/rechnungen",
  },
  {
    title: "Buchhaltung & Steuerberater",
    text: "Belege per Handy erfassen, Umsatzsteuer-Übersicht, offene Posten und ein fertiges Paket für den Steuerberater mit DATEV-Export.",
    href: "/buchhaltung",
  },
  {
    title: "Kundenportal",
    text: "Ihre Kunden sehen Fortschritt, Fotos, Angebote und Rechnungen online – ohne Ihre internen Preise oder Stunden.",
    href: "/kundenportal",
  },
  {
    title: "Mitarbeiter & Leistung",
    text: "Leistungen fair bewerten, Boni festlegen und Ihr Team mit klaren Kennzahlen motivieren.",
    href: "/leistungsbewertung",
  },
  {
    title: "KI-Telefonassistent",
    text: "Nimmt Anrufe an, wenn Sie auf der Leiter stehen: beantwortet Fragen, vergibt freie Besichtigungstermine und trägt sie direkt in Ihren Kalender ein, notiert Rückrufwünsche und schickt Ihnen eine Zusammenfassung.",
    href: "/ki-telefon",
  },
  {
    title: "Eigene Firmen-Website",
    text: "Ihre Website mit eigener Domain, Referenzen, Online-Terminbuchung für Besichtigungen, Stellenanzeigen und KI-Chat.",
    href: "/firmen-website",
  },
  {
    title: "Fachkräfte-Pool",
    text: "Maler, Gesellen und Subunternehmer in Ihrer Region finden, wenn es eng wird.",
    href: "/fachkraefte-finden",
  },
  {
    title: "Auswertungen",
    text: "Umsatz, offene Angebote, Auslastung und Kundenwerte auf einen Blick – damit Sie wissen, wo Ihr Betrieb steht.",
    href: "/auswertungen",
  },
];

const audiences = [
  {
    title: "Kleiner Betrieb",
    sub: "Inhaber mit bis zu 3 Mitarbeitern",
    text: "Weniger Büro am Abend: Angebote, Rechnungen, E-Rechnung, Belege und Zeiterfassung in einer App – auch auf dem Handy.",
  },
  {
    title: "Wachsender Betrieb",
    sub: "bis 8 bzw. 20 Mitarbeiter",
    text: "Mehrere Baustellen gleichzeitig steuern: Projektleiter, Material, Kundenportal, Abschlagsrechnungen, KI-Telefon und Auswertungen.",
  },
  {
    title: "Betrieb mit Büro und Außenauftritt",
    sub: "ab 21 Mitarbeitern – ohne Obergrenze",
    text: "Alles aus einer Hand – inklusive eigener Website mit Terminbuchung und Stellenanzeigen sowie dem Fachkräfte-Pool.",
  },
];

const faqs = [
  {
    q: "Was kostet MalerSaaS?",
    a: "Die Tarife beginnen bei 79 € im Monat zzgl. MwSt. (bis 3 Mitarbeiter). Je nach Betriebsgröße gibt es vier Tarife: bis 3, bis 8 und bis 20 Mitarbeiter sowie Enterprise ab 21 Mitarbeitern ohne Obergrenze. Die Abrechnung erfolgt monatlich, Sie können zum Ende jedes Monats kündigen.",
  },
  {
    q: "Brauche ich für den Test eine Kreditkarte?",
    a: "Nein. Die 14 Tage sind kostenlos und unverbindlich. Die Testphase endet automatisch – sie wird nicht von selbst zu einem kostenpflichtigen Abo.",
  },
  {
    q: "Was passiert nach den 14 Tagen?",
    a: "Wenn Sie weitermachen möchten, wählen Sie einen Tarif und arbeiten nahtlos mit allen Daten weiter. Wenn nicht, bleiben Ihre Daten noch 30 Tage erhalten, damit Sie sie exportieren können – danach werden sie gelöscht.",
  },
  {
    q: "Ist MalerSaaS bereit für die E-Rechnungspflicht?",
    a: "Ja. Jede neue Rechnung wird automatisch als E-Rechnung im ZUGFeRD-Format erstellt (ein normales PDF mit eingebetteten Rechnungsdaten). Für Behörden und Firmen, die eine XRechnung verlangen, gibt es diese zusätzlich. Seit 2025 müssen Betriebe E-Rechnungen empfangen können; ab 2027 bzw. 2028 müssen sie Rechnungen an Firmen als E-Rechnung stellen.",
  },
  {
    q: "Funktioniert das auf Handy und Tablet?",
    a: "Ja. MalerSaaS läuft im Browser auf Handy, Tablet und Computer und lässt sich wie eine App auf den Startbildschirm legen – ideal für Aufmaß, Zeiterfassung und Fotos auf der Baustelle.",
  },
  {
    q: "Wo werden meine Daten gespeichert?",
    a: "Ihre Betriebsdaten liegen auf Servern in der EU (Irland), die Übertragung ist verschlüsselt. Einzelne Zusatzfunktionen wie die KI-Belegerkennung oder das KI-Telefon nutzen spezialisierte Dienste – welche das sind, steht in unserer Datenschutzerklärung.",
  },
  {
    q: "Kann mein Steuerberater damit arbeiten?",
    a: "Ja. Sie können jederzeit ein Paket mit allen Rechnungen, Belegen, Rechnungsausgangsbuch und Umsatzsteuer-Übersicht herunterladen – in Deutschland auch mit DATEV-Export (SKR03/SKR04).",
  },
  {
    q: "Gibt es MalerSaaS auch für Österreich und die Schweiz?",
    a: "Ja. Rechnungen enthalten die Pflichtangaben des jeweiligen Landes, in der Schweiz mit QR-Rechnung. Die Buchhaltung zeigt die Werte für die Umsatzsteuer-Voranmeldung (U30) bzw. die MWST-Abrechnung – auch mit Saldosteuersatz.",
  },
  {
    q: "Kann ich meine Daten wieder mitnehmen?",
    a: "Ja, jederzeit: Mit „Alle Daten exportieren“ laden Sie Rechnungen, Belege und alle Listen (Kunden, Aufträge, Angebote, Zeiten) als ZIP-Datei herunter.",
  },
  {
    q: "Muss ich meine Mitarbeiter schulen?",
    a: "Kaum. Die Mitarbeiter sehen nur, was sie brauchen: ihre Aufträge, Zeiterfassung, Material und Fotos. Bei Fragen hilft der eingebaute Hilfe-Assistent rund um die Uhr.",
  },
];

/** FAQ für Google als strukturierte Daten */
function useFaqSchema() {
  useEffect(() => {
    const el = document.createElement("script");
    el.type = "application/ld+json";
    el.id = "faq-schema";
    el.text = JSON.stringify({
      "@context": "https://schema.org",
      "@type": "FAQPage",
      mainEntity: faqs.map((f) => ({ "@type": "Question", name: f.q, acceptedAnswer: { "@type": "Answer", text: f.a } })),
    });
    document.getElementById("faq-schema")?.remove();
    document.head.appendChild(el);
    return () => el.remove();
  }, []);
}

/** Aufruf mit #kontakt, #preise usw. (z. B. Link aus dem Hilfe-Chat): direkt zum Abschnitt springen */
function useScrollToHash() {
  useEffect(() => {
    const id = decodeURIComponent(window.location.hash.slice(1));
    if (!/^[a-z0-9-]+$/i.test(id)) return;
    // kurz warten, bis Seite und Bilder aufgebaut sind (sonst verschiebt sich die Position)
    const timers = [50, 400, 1200].map((ms) =>
      setTimeout(() => document.getElementById(id)?.scrollIntoView({ block: "start" }), ms)
    );
    const stop = () => timers.forEach(clearTimeout);
    // sobald der Besucher selbst scrollt, nicht mehr eingreifen
    window.addEventListener("wheel", stop, { once: true, passive: true });
    window.addEventListener("touchstart", stop, { once: true, passive: true });
    return () => {
      stop();
      window.removeEventListener("wheel", stop);
      window.removeEventListener("touchstart", stop);
    };
  }, []);
}

export default function LandingPage({ onLogin, onRegister, onOpenImpressum, onOpenDatenschutz, onOpenAgb }: LandingPageProps) {
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);
  const [openFaq, setOpenFaq] = useState<number | null>(0);
  useFaqSchema();
  useScrollToHash();
  const close = () => setMobileMenuOpen(false);

  return (
    <div className="landing-page">
      <header className="landing-header">
        <a href="/" className="landing-logo" style={{ textDecoration: "none", color: "inherit" }}>
          <img src="/images/logo.webp" alt="MalerSaaS Logo" className="landing-logo-image" width="56" height="56" />
          <div className="landing-logo-text">
            <strong>MalerSaaS</strong>
            <span>Software für Malerbetriebe</span>
          </div>
        </a>

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

        <nav className={`landing-nav ${mobileMenuOpen ? "is-open" : ""}`}>
          <a href="#funktionen" onClick={close}>
            Funktionen
          </a>
          <a href="#fuer-wen" onClick={close}>
            Für wen
          </a>
          <a href="#preise" onClick={close}>
            Preise
          </a>
          <a href="#fragen" onClick={close}>
            Fragen
          </a>
          <a href="#kontakt" onClick={close}>
            Kontakt
          </a>
          <button
            type="button"
            className="landing-login-btn"
            onClick={() => {
              close();
              onLogin();
            }}
          >
            Login
          </button>
        </nav>
      </header>

      <main>
        {/* ---------- Titel ---------- */}
        <section className="landing-hero landing-hero-premium">
          <div className="landing-hero-content">
            <p className="landing-badge">Für Malerbetriebe in Deutschland, Österreich und der Schweiz</p>

            <h1>Die Software für Malerbetriebe – vom Aufmaß bis zur E-Rechnung.</h1>

            <p className="landing-hero-text">
              Aufmaß, Angebote, Aufträge, Zeiterfassung, Material, Rechnungen und Buchhaltung in einer App. Weniger Büro am Abend, mehr
              Überblick auf der Baustelle – im Browser, auf dem Handy und dem Tablet.
            </p>

            <div className="landing-hero-actions">
              <button type="button" className="landing-primary-btn" onClick={onRegister}>
                14 Tage kostenlos testen
              </button>
              <a href="#funktionen" className="landing-secondary-btn" style={{ textDecoration: "none" }}>
                Funktionen ansehen
              </a>
            </div>

            <div className="landing-trust-row">
              <span>✓ Keine Kreditkarte nötig</span>
              <span>✓ Endet automatisch</span>
              <span>✓ E-Rechnung-fertig für 2027</span>
              <span>✓ Server in der EU</span>
            </div>
          </div>

          <div className="landing-hero-visual">
            <div className="hero-orbit-card hero-card-main">
              <div className="mockup-topbar">
                <span></span>
                <span></span>
                <span></span>
              </div>

              <div className="mockup-title-row">
                <div>
                  <strong>Ihr Betrieb auf einen Blick</strong>
                  <small>Live-Übersicht</small>
                </div>
                <span className="mockup-pill">Cockpit</span>
              </div>

              <div className="mockup-stats">
                <div>
                  <strong>32</strong>
                  <span>Aufträge</span>
                </div>
                <div>
                  <strong>84 T€</strong>
                  <span>Angebote</span>
                </div>
                <div>
                  <strong>91 %</strong>
                  <span>Auslastung</span>
                </div>
              </div>

              <div className="landing-dashboard-collage">
                <img src="/images/maler-saas-landing-collage.webp" alt="Ansichten der MalerSaaS-App" className="landing-dashboard-collage-image" />
              </div>
            </div>

            <div className="hero-floating-card card-material">
              <strong>E-Rechnung</strong>
              <span>ZUGFeRD · XRechnung</span>
            </div>

            <div className="hero-floating-card card-ai">
              <strong>KI-Assistent</strong>
              <span>Belege, Telefon, Texte</span>
            </div>

            <div className="hero-phone-mockup lp-phone" aria-label="Zeiterfassung auf dem Handy">
              <div className="lp-phone-screen">
                <small>Auftrag</small>
                <b>Wohnung Müller</b>
                <em>Wohnzimmer streichen</em>
                <div className="lp-phone-timer">
                  <i aria-hidden="true" />
                  <span>Läuft</span>
                  <strong>2:15 h</strong>
                </div>
                <div className="lp-phone-btn lp-phone-btn-light">Pause</div>
                <div className="lp-phone-btn">Feierabend</div>
                <div className="lp-phone-photos">📷 3 Fotos</div>
              </div>
              <p className="lp-phone-caption">
                <strong>Auf dem Handy</strong> direkt auf der Baustelle
              </p>
            </div>
          </div>
        </section>

        <section className="landing-logo-strip" aria-label="Bereiche">
          <span>Aufmaß</span>
          <span>Angebote</span>
          <span>Aufträge</span>
          <span>Zeiten</span>
          <span>Material</span>
          <span>E-Rechnung</span>
          <span>Buchhaltung</span>
          <span>Kundenportal</span>
        </section>

        {/* ---------- Kennen Sie das? ---------- */}
        <section className="landing-section lp-pains">
          <p className="landing-section-label">Kennen Sie das?</p>
          <h2>Weniger Papierkram. Mehr Zeit für die Baustelle.</h2>
          <div className="lp-pain-grid">
            {pains.map((p) => (
              <article key={p.problem}>
                <h3>{p.problem}</h3>
                <p>{p.solution}</p>
              </article>
            ))}
          </div>
        </section>

        {/* ---------- Ablauf ---------- */}
        <section className="landing-section landing-how-it-works">
          <p className="landing-section-label">So funktioniert es</p>
          <h2>Vom ersten Aufmaß bis zur bezahlten Rechnung.</h2>
          <div className="how-grid">
            {[
              { title: "Firma registrieren", text: "In wenigen Minuten Firmendaten, Logo und Preise hinterlegen – ohne Installation." },
              { title: "Mitarbeiter einladen", text: "Mitarbeiter und Projektleiter anlegen. Jeder sieht nur, was er für seine Arbeit braucht." },
              { title: "Aufmaß erfassen", text: "Räume und Flächen direkt beim Kunden aufnehmen – auf dem Handy oder Tablet." },
              { title: "Angebot senden", text: "Aus dem Aufmaß entsteht das Angebot. Der Kunde kann es online prüfen und bestätigen." },
              { title: "Auftrag ausführen", text: "Einsätze planen, Zeiten und Material erfassen, Baufortschritt mit Fotos dokumentieren." },
              { title: "Rechnung stellen", text: "E-Rechnung mit einem Klick erstellen und per E-Mail senden – offene Posten immer im Blick." },
            ].map((step, index) => (
              <article key={step.title}>
                <span>{index + 1}</span>
                <h3>{step.title}</h3>
                <p>{step.text}</p>
              </article>
            ))}
          </div>
        </section>

        {/* ---------- Funktionen ---------- */}
        <section id="funktionen" className="landing-section">
          <p className="landing-section-label">Eine App statt vieler Insellösungen</p>
          <h2>Alles, was Ihr Malerbetrieb täglich braucht.</h2>

          <div className="landing-feature-grid premium-grid">
            {features.map((feature, index) => (
              <article key={feature.title}>
                <div className="feature-icon">{index + 1}</div>
                <h3>{feature.title}</h3>
                <p>{feature.text}</p>
                {feature.href && (
                  <a className="lp-more" href={feature.href}>
                    Mehr erfahren →
                  </a>
                )}
              </article>
            ))}
          </div>
          <p className="lp-center">
            <a className="lp-more" href="/maler-software">
              Alle Funktionen der Maler-Software im Überblick →
            </a>
          </p>
        </section>

        {/* ---------- Schwerpunkt E-Rechnung ---------- */}
        <section className="landing-section">
          <div className="lp-einvoice">
            <div>
              <p className="landing-section-label lp-label-light">E-Rechnungspflicht</p>
              <h2>Bereit für die E-Rechnung – ohne Zusatzaufwand.</h2>
              <p>
                Seit 2025 müssen Betriebe in Deutschland E-Rechnungen empfangen können. Ab 2027 bzw. 2028 müssen Rechnungen an Firmen als
                E-Rechnung gestellt werden. Mit MalerSaaS ist jede neue Rechnung automatisch eine E-Rechnung im ZUGFeRD-Format – ein
                normales PDF für Ihre Kunden mit eingebetteten Daten für deren Buchhaltung.
              </p>
              <ul className="lp-checks">
                <li>ZUGFeRD (EN 16931) für alle neuen Rechnungen</li>
                <li>XRechnung für Behörden und Großkunden</li>
                <li>GiroCode zum Bezahlen per Banking-App</li>
                <li>Versand direkt aus der App per E-Mail</li>
              </ul>
            </div>
            <div className="lp-einvoice-card" aria-hidden="true">
              <div className="lp-doc">
                <strong>Rechnung RE-2026-00093</strong>
                <span>Malerarbeiten Wohnung Müller</span>
                <div className="lp-doc-lines">
                  <i />
                  <i />
                  <i />
                </div>
                <div className="lp-doc-foot">
                  <span>ZUGFeRD ✓</span>
                  <span>XRechnung ✓</span>
                  <span>GiroCode ✓</span>
                </div>
              </div>
            </div>
          </div>
        </section>

        {/* ---------- Schwerpunkt Material ---------- */}
        <section className="landing-section landing-image-section">
          <img src="/images/materialkontrolle.webp" loading="lazy" alt="Materialkontrolle in MalerSaaS: Lager, Projektleiter, Mitarbeiter, Auftrag" className="landing-full-image" />
        </section>

        {/* ---------- Schwerpunkt Kundenportal ---------- */}
        <section className="landing-section landing-visual-section">
          <div>
            <p className="landing-section-label">Kundenportal</p>
            <h2>Mehr Vertrauen durch transparente Kommunikation.</h2>
            <p>
              Ihre Kunden sehen Fortschritt, Fotos, Angebote, Rechnungen und Statusmeldungen online – ohne interne Preise, Stunden oder
              sensible Betriebsdaten. Das spart Telefonate und schafft Vertrauen.
            </p>
            <a className="lp-more" href="/kundenportal">
              Mehr zum Kundenportal →
            </a>
          </div>

          <div className="customer-portal-image-frame">
            <img src="/images/kundenportal-projektfortschritt.webp" loading="lazy" alt="Kundenportal mit Projektfortschritt in MalerSaaS" className="customer-portal-image" />
          </div>
        </section>

        {/* ---------- Für wen ---------- */}
        <section id="fuer-wen" className="landing-section landing-growth">
          <p className="landing-section-label">Für wen</p>
          <h2>Passend für jede Betriebsgröße.</h2>
          <div className="growth-grid lp-three">
            {audiences.map((a) => (
              <article key={a.title}>
                <h3>{a.title}</h3>
                <p className="lp-sub">{a.sub}</p>
                <p>{a.text}</p>
              </article>
            ))}
          </div>
        </section>

        {/* ---------- Preise ---------- */}
        <section id="preise" className="landing-section">
          <div className="lp-price">
            <div>
              <p className="landing-section-label">Preise</p>
              <h2>
                Ab 79 € im Monat <small>zzgl. MwSt.</small>
              </h2>
              <p>Für Betriebe jeder Größe – vom Ein-Mann-Betrieb bis zum Unternehmen mit 50 oder mehr Mitarbeitern:</p>
              <ul className="lp-tiers">
                <li>
                  <b>Starter</b> bis 3 Mitarbeiter
                </li>
                <li>
                  <b>Professional</b> bis 8 Mitarbeiter
                </li>
                <li>
                  <b>Business</b> bis 20 Mitarbeiter
                </li>
                <li>
                  <b>Enterprise</b> ab 21 Mitarbeitern – ohne Obergrenze
                </li>
              </ul>
              <p>Monatlich kündbar. Alle Preise und Funktionen sehen Sie nach der Registrierung unter „Tarife“.</p>
            </div>
            <div className="lp-price-cta">
              <button type="button" className="landing-primary-btn" onClick={onRegister}>
                14 Tage kostenlos testen
              </button>
              <span>Keine Kreditkarte nötig · endet automatisch</span>
            </div>
          </div>
        </section>

        {/* ---------- Fragen ---------- */}
        <section id="fragen" className="landing-section lp-faq">
          <p className="landing-section-label">Häufige Fragen</p>
          <h2>Gut zu wissen.</h2>
          <div className="lp-faq-list">
            {faqs.map((f, i) => (
              <div key={f.q} className={`lp-faq-item ${openFaq === i ? "is-open" : ""}`}>
                <button type="button" aria-expanded={openFaq === i} onClick={() => setOpenFaq(openFaq === i ? null : i)}>
                  <span>{f.q}</span>
                  <span aria-hidden="true">{openFaq === i ? "−" : "+"}</span>
                </button>
                {openFaq === i && <p>{f.a}</p>}
              </div>
            ))}
          </div>
        </section>

        {/* ---------- Abschluss ---------- */}
        <section className="landing-section">
          <div className="lp-final">
            <p className="landing-section-label lp-label-light">Jetzt starten</p>
            <h2>Machen Sie Ihren Malerbetrieb digital.</h2>
            <p>14 Tage kostenlos testen – mit allen Funktionen, ohne Kreditkarte. Die Testphase endet automatisch.</p>
            <button type="button" className="landing-primary-btn lp-final-btn" onClick={onRegister}>
              14 Tage kostenlos testen
            </button>
          </div>
        </section>

        {/* ---------- Kontakt ---------- */}
        <section id="kontakt" className="landing-section lp-contact">
          <div>
            <p className="landing-section-label">Kontakt</p>
            <h2>Fragen? Schreiben Sie uns.</h2>
            <p>
              Nutzen Sie das Formular oder schreiben Sie uns direkt per E-Mail an{" "}
              <a href="mailto:info@maler-saas.com">info@maler-saas.com</a>.
            </p>
          </div>
          <ContactForm onOpenDatenschutz={onOpenDatenschutz} />
        </section>
      </main>

      <footer className="landing-footer">
        <div>
          <strong>MalerSaaS</strong>
          <span>Software für Malerbetriebe · info@maler-saas.com</span>
        </div>

        <div className="landing-footer-links">
          <a href="/maler-software">Maler-Software</a>
          <a href="/rechnungen">Rechnungen</a>
          <a href="/zeiterfassung">Zeiterfassung</a>
          <button type="button" onClick={onOpenImpressum}>
            Impressum
          </button>
          <button type="button" onClick={onOpenDatenschutz}>
            Datenschutz
          </button>
          <button type="button" onClick={onOpenAgb}>
            AGB
          </button>
          <a href="/avv">AVV</a>
          <a href="/fachkraefte">Arbeit gesucht? Fachkräfte-Pool</a>
        </div>
      </footer>
    </div>
  );
}
