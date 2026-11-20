import { useEffect, useState } from "react";
import "./LandingPage.css";
import ContactForm from "../components/ContactForm";
import BeforeAfter from "../components/BeforeAfter";
import { euro, firstYearMonthly, firstYearPrice, SEAT_MONTHLY, yearlyPrice } from "../lib/prices";

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
    title: "Aufmaß per Sprache",
    text: "Beim Kunden einfach ansagen: „Wohnzimmer fünf mal vier, Höhe zwei fünfzig, zwei Fenster …“ – die KI legt Räume, Maße, Fenster, Türen und Anstriche im Aufmaß an. Hände frei, kein Tippen. In allen Tarifen.",
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
    title: "Werbung mit KI",
    text: "Aus Baustellenfotos werden fertige Beiträge für Website, Instagram, Facebook, Google-Profil und WhatsApp – die KI wählt die Bilder und schreibt die Texte.",
    href: "/werbung-mit-ki",
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

/** Schaufenster: die wichtigsten Bereiche mit echten Ansichten aus der App (Beispieldaten) */
const showcase: { label: string; title: string; text: string; points: string[]; img: string; w: number; h: number; alt: string; href: string; phone?: boolean }[] = [
  {
    label: "Aufmaß & Angebot",
    title: "Aufmessen beim Kunden – das Angebot entsteht direkt daraus.",
    text: "Räume, Fenster, Türen und Heizkörper am Handy oder Tablet erfassen – oder einfach ansagen. Wand- und Deckenflächen rechnet MalerSaaS sofort aus, das Angebot kommt mit Ihren Preisen.",
    points: ["Aufmaß per Sprache in allen Tarifen", "Flächen nach VOB/C, 1–3 Anstriche je Raum", "Angebot online vom Kunden bestätigen lassen"],
    img: "/images/app/aufmass.webp", w: 1400, h: 1075,
    alt: "Aufmaß erfassen in MalerSaaS mit Wand- und Deckenflächen je Raum",
    href: "/aufmass-angebote",
  },
  {
    label: "Für Ihre Mitarbeiter",
    title: "Stechuhr, Auftrag und Fotos – alles auf dem Handy.",
    text: "Ihre Mitarbeiter sehen nur ihre eigenen Aufträge mit Adresse und Route. Arbeitsbeginn, Pause und Feierabend mit einem Tipp – die Zeit landet automatisch beim richtigen Auftrag.",
    points: ["Zeiterfassung direkt am Auftrag", "Baufortschritt mit Fotos dokumentieren", "Material ausgeben und zurückbuchen"],
    img: "/images/app/mitarbeiter-handy.webp", w: 700, h: 1526,
    alt: "Mitarbeiter-Ansicht am Handy: laufende Arbeitszeit und Aufträge",
    href: "/zeiterfassung",
    phone: true,
  },
  {
    label: "Rechnungen & E-Rechnung",
    title: "Offene Beträge immer im Blick.",
    text: "Abschlags- und Schlussrechnungen mit einem Klick, als E-Rechnung im ZUGFeRD-Format und mit GiroCode. Überfälliges ist sofort markiert – die Mahnung ist einen Klick entfernt.",
    points: ["ZUGFeRD und XRechnung", "Offen, überfällig, gemahnt, bezahlt auf einen Blick", "Versand per E-Mail direkt aus der App"],
    img: "/images/app/rechnungen.webp", w: 1400, h: 872,
    alt: "Rechnungsübersicht in MalerSaaS mit offenen und überfälligen Beträgen",
    href: "/rechnungen",
  },
  {
    label: "Material",
    title: "Wissen, was im Lager ist – und was fehlt.",
    text: "Bestände, Mindestmengen und Lagerwert auf einen Blick. Lieferscheine liest die KI per Foto ein, Verbrauch und Rückgaben werden dem Auftrag zugeordnet.",
    points: ["Warnung bei Mindestbestand", "Lieferschein per Foto einlesen (ab Business)", "Verbrauch je Auftrag für die Nachkalkulation"],
    img: "/images/app/material.webp", w: 1400, h: 787,
    alt: "Materialverwaltung mit Beständen, Mindestbestand und Lagerwert",
    href: "/materialverwaltung",
  },
  {
    label: "Auswertungen",
    title: "Sehen, was am Ende übrig bleibt.",
    text: "Umsatz, Lohn- und Materialkosten und Deckungsbeitrag – für den Monat, das Jahr oder einzelne Aufträge. Dazu offene Rechnungen und eine verständliche Einschätzung.",
    points: ["Nachkalkulation je Auftrag", "Kundenanalyse und Materialanalyse", "Alle Beträge netto, ohne Steuer-Durcheinander"],
    img: "/images/app/auswertungen.webp", w: 1400, h: 692,
    alt: "Business Intelligence in MalerSaaS mit Umsatz, Kosten und Deckungsbeitrag",
    href: "/auswertungen",
  },
];

/** Die 7 KI-Funktionen (siehe /ki-funktionen) */
const aiTasks: { icon: string; title: string; text: string; plan: string }[] = [
  { icon: "🎤", title: "Aufmaß per Sprache", text: "Räume und Maße ansagen statt tippen.", plan: "Alle Tarife" },
  { icon: "📷", title: "Lieferscheine einlesen", text: "Foto genügt – Positionen landen im Lager.", plan: "Ab Business" },
  { icon: "🧾", title: "Belege erfassen", text: "Betrag, Datum und Steuersatz automatisch.", plan: "Ab Business" },
  { icon: "📞", title: "KI-Telefon", text: "Nimmt Anrufe an, wenn niemand abhebt.", plan: "Ab Business" },
  { icon: "✨", title: "Werbung aus Fotos", text: "Beiträge für Website, Instagram & Co.", plan: "Enterprise" },
  { icon: "✍️", title: "Website-Texte", text: "Aus Stichworten werden Textvorschläge.", plan: "Enterprise" },
  { icon: "💬", title: "Fragen beantworten", text: "Hilfe-Chat in der App, rund um die Uhr.", plan: "Alle Tarife" },
];

/** Tarife – Preise netto pro Monat */
const plans: { name: string; price: number; who: string; points: string[]; top?: boolean }[] = [
  { name: "Starter", price: 79, who: "3 Mitarbeiter inklusive", points: ["Aufmaß (auch per Sprache), Angebote, Aufträge", "Rechnungen & E-Rechnung", "Zeiterfassung am Handy", "Buchhaltung: Belege, Umsatzsteuer, offene Posten"] },
  { name: "Professional", price: 149, who: "6 Mitarbeiter inklusive", top: true, points: ["Alles aus Starter", "Kundenportal", "Materialverwaltung", "Projektleiter und Baudokumentation mit Fotos"] },
  { name: "Business", price: 220, who: "9 Mitarbeiter inklusive", points: ["Alles aus Professional", "KI-Telefonassistent (Minuten zubuchbar)", "KI liest Belege und Lieferscheine", "Abschlagsrechnungen, Auswertungen, Leistungsbewertung"] },
  { name: "Enterprise", price: 349, who: "12 Mitarbeiter inklusive", points: ["Alles aus Business", "Eigene Firmen-Website mit Terminbuchung", "Werbung mit KI", "Fachkräfte-Pool und persönlicher Support"] },
];

/** Weitere Funktionen als kompakte Liste (die großen Bereiche stehen oben im Schaufenster) */
const SHOWCASE_HREFS = new Set(["/materialverwaltung", "/rechnungen", "/zeiterfassung", "/auswertungen"]);

const audiences = [
  {
    title: "Kleiner Betrieb",
    sub: "Inhaber mit bis zu 3 Mitarbeitern",
    text: "Weniger Büro am Abend: Angebote, Rechnungen, E-Rechnung, Belege und Zeiterfassung in einer App – auch auf dem Handy.",
  },
  {
    title: "Wachsender Betrieb",
    sub: "bis 6 bzw. 9 Mitarbeiter",
    text: "Mehrere Baustellen gleichzeitig steuern: Projektleiter, Material, Kundenportal, Abschlagsrechnungen, KI-Telefon und Auswertungen.",
  },
  {
    title: "Betrieb mit Büro und Außenauftritt",
    sub: "ab 12 Mitarbeitern – weitere je 19 €",
    text: "Alles aus einer Hand – inklusive eigener Website mit Terminbuchung und Stellenanzeigen, Werbung mit KI sowie dem Fachkräfte-Pool.",
  },
];

const faqs = [
  {
    q: "Was kostet MalerSaaS?",
    a: "Es gibt vier Tarife, jeweils pro Monat zzgl. MwSt.: Starter 79 € (3 Mitarbeiter mit App-Zugang inklusive), Professional 149 € (6), Business 220 € (9) und Enterprise 349 € (12). Jeder weitere Mitarbeiter mit App-Zugang kostet 19 € im Monat; Sie als Inhaber zählen nicht mit. Monatlich gezahlt können Sie zum Ende jedes Monats kündigen. Bei jährlicher Zahlung (12 Monate Laufzeit) zahlen Sie im ersten Jahr nur die Hälfte des Monatspreises – zum Beispiel Starter 474 € (39,50 € im Monat) – und ab dem zweiten Jahr 10 statt 12 Monatspreise (Starter 790 € im Jahr).",
  },
  {
    q: "Zählen Leiharbeiter und Subunternehmer zur Mitarbeiterzahl?",
    a: "Nur, wenn sie die App nutzen. Zur Mitarbeiterzahl des Tarifs zählen alle aktiven Personen mit App-Zugang. Leiharbeiter, Subunternehmer oder Lagerkräfte ohne App-Zugang legen Sie kostenlos zusätzlich an – mit eigenem Kosten-Stundensatz für die Nachkalkulation. Wer den Betrieb verlässt, wird mit „Austritt“ ausgetragen und zählt danach nicht mehr mit.",
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
    q: "Kann MalerSaaS Werbung für meinen Betrieb machen?",
    a: "Ja, im Tarif Enterprise. Aus Ihren Baustellenfotos erstellt die KI fertige Beiträge für Ihre Website, Instagram, Facebook, Ihr Google-Unternehmensprofil und den WhatsApp-Status – mit passender Bildauswahl und Texten für jeden Kanal. Sie prüfen jeden Beitrag und teilen ihn mit wenigen Fingertipps. Ohne Ihre Freigabe wird nichts veröffentlicht.",
  },
  {
    q: "Kann ich das Aufmaß auch diktieren?",
    a: "Ja, in allen Tarifen. Im Aufmaß tippen Sie auf „Aufmaß diktieren“ und sagen Raum für Raum Maße, Fenster, Türen, Decke und Anzahl der Anstriche an. Die KI füllt das Formular aus, Sie prüfen kurz und speichern. Die Aufnahme selbst wird nicht gespeichert.",
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
  const [yearly, setYearly] = useState(true);
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

          <div className="landing-hero-visual lp2-hero-visual">
            <figure className="lp2-browser">
              <div className="lp2-browser-bar" aria-hidden="true">
                <i />
                <i />
                <i />
                <span>maler-saas.com</span>
              </div>
              <img
                src="/images/app/chef-startseite.webp"
                alt="Startseite für den Chef in MalerSaaS: offene Aufträge, Rechnungen, Termine und Neuigkeiten"
                width="1600"
                height="1264"
                fetchPriority="high"
              />
            </figure>

            <figure className="lp2-phone lp2-hero-phone">
              <img src="/images/app/mitarbeiter-handy.webp" alt="Mitarbeiter-App am Handy mit laufender Arbeitszeit" width="700" height="1526" />
            </figure>

            <div className="hero-floating-card card-material">
              <strong>E-Rechnung</strong>
              <span>ZUGFeRD · XRechnung</span>
            </div>

            <div className="hero-floating-card card-ai">
              <strong>Mit KI</strong>
              <span>Aufmaß, Belege, Telefon</span>
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

        {/* ---------- KI ---------- */}
        <section className="landing-section lp2-ai" aria-labelledby="lp2-ai-title">
          <div className="lp2-ai-box">
            <div className="lp2-ai-head">
              <p className="landing-section-label lp-label-light">Künstliche Intelligenz</p>
              <h2 id="lp2-ai-title">7 Aufgaben, die die KI für Sie übernimmt.</h2>
              <p>Die KI macht Vorschläge – Sie prüfen und entscheiden. Gespeichert oder veröffentlicht wird nur, was Sie freigeben.</p>
            </div>
            <ul className="lp2-ai-grid">
              {aiTasks.map((t) => (
                <li key={t.title}>
                  <span className="lp2-ai-icon" aria-hidden="true">
                    {t.icon}
                  </span>
                  <b>{t.title}</b>
                  <span>{t.text}</span>
                  <small>{t.plan}</small>
                </li>
              ))}
            </ul>
            <a className="lp2-ai-link" href="/ki-funktionen">
              Alle KI-Funktionen im Überblick →
            </a>
          </div>
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

        {/* ---------- Funktionen: Schaufenster mit echten Ansichten ---------- */}
        <section id="funktionen" className="landing-section">
          <p className="landing-section-label">Eine App statt vieler Insellösungen</p>
          <h2>Alles, was Ihr Malerbetrieb täglich braucht.</h2>

          <div className="lp2-show">
            {showcase.map((f, i) => (
              <article key={f.title} className={`lp2-show-row ${i % 2 ? "is-flip" : ""}`}>
                <div className="lp2-show-text">
                  <p className="lp2-kicker">{f.label}</p>
                  <h3>{f.title}</h3>
                  <p>{f.text}</p>
                  <ul className="lp2-points">
                    {f.points.map((pt) => (
                      <li key={pt}>{pt}</li>
                    ))}
                  </ul>
                  <a className="lp-more" href={f.href}>
                    Mehr erfahren →
                  </a>
                </div>
                <figure className={f.phone ? "lp2-phone" : "lp2-shot"}>
                  <img src={f.img} alt={f.alt} width={f.w} height={f.h} loading="lazy" decoding="async" />
                </figure>
              </article>
            ))}
          </div>

          <h3 className="lp2-more-title">Außerdem dabei</h3>
          <div className="lp2-more-grid">
            {features
              .filter((f) => !SHOWCASE_HREFS.has(f.href ?? "") && f.title !== "Aufmaß per Sprache" && f.title !== "Aufmaß & Angebote")
              .map((f) => (
                <a key={f.title} href={f.href} className="lp2-more-item">
                  <b>{f.title}</b>
                  <span>{f.text}</span>
                </a>
              ))}
          </div>
          <p className="lp-center">
            <a className="lp-more" href="/maler-software">
              Alle Funktionen der Maler-Software im Überblick →
            </a>
          </p>
          <p className="lp2-note">Ansichten mit Beispieldaten eines erfundenen Betriebs.</p>
        </section>

        {/* ---------- Schwerpunkt Werbung mit KI ---------- */}
        <section className="landing-section">
          <div className="lp-social">
            <div>
              <p className="landing-section-label">Neu: Werbung mit KI</p>
              <h2>Aus Baustellenfotos wird Werbung – mit einem Klick.</h2>
              <p>
                Ihre besten Arbeiten verdienen Aufmerksamkeit. MalerSaaS macht aus den Fotos Ihrer Aufträge fertige Beiträge – für Ihre
                Website, Instagram, Facebook, Ihr Google-Unternehmensprofil und den WhatsApp-Status. Ohne Agentur, ohne stundenlanges Texten.
              </p>
              <ol className="lp-social-steps">
                <li>
                  <b>Fotos wählen</b> – aus dem Auftrag oder vom Handy. Nach abgeschlossenen Aufträgen macht die KI auch von selbst Vorschläge.
                </li>
                <li>
                  <b>KI erstellt den Beitrag</b> – wählt die besten Bilder, erkennt Vorher/Nachher und schreibt passende Texte für jeden Kanal.
                </li>
                <li>
                  <b>Prüfen und teilen</b> – mit einem Klick auf Ihre Website, mit wenigen Fingertipps in Instagram, Facebook und Co.
                </li>
              </ol>
              <p className="lp-social-note">Die KI weist Sie auf Gesichter, Autokennzeichen oder Hausnummern auf den Fotos hin.</p>
              <a className="lp-more" href="/werbung-mit-ki">
                So funktioniert die Werbung mit KI →
              </a>
              <a className="lp-more" href="/ki-funktionen">
                Alle 7 KI-Funktionen im Überblick →
              </a>
            </div>
            <div className="lp-social-visual">
              <div className="lp-stack">
                <div className="lp-card lp-card-fb" aria-hidden="true">
                  <div className="lp-card-head">
                    <b className="lp-fb-logo">f</b>
                    <span>
                      <b>Malerbetrieb Muster</b>
                      <small>Gerade eben · 🌍</small>
                    </span>
                  </div>
                  <p>Frisch gestrichen: Fassade in warmem Sandton. Sie planen auch einen Anstrich? Jetzt anfragen …</p>
                  <img src="/images/werbung-nachher.webp" alt="" width="800" height="597" loading="lazy" decoding="async" />
                </div>
                <div className="lp-card lp-card-google" aria-hidden="true">
                  <div className="lp-card-head">
                    <b className="lp-g-logo">G</b>
                    <span>
                      <b>Google-Unternehmensprofil</b>
                      <small>Neues Update</small>
                    </span>
                  </div>
                  <img src="/images/werbung-nachher.webp" alt="" width="800" height="597" loading="lazy" decoding="async" />
                  <p>Fassadenanstrich abgeschlossen – Putzschäden ausgebessert, neu gestrichen.</p>
                </div>
                <div className="lp-insta">
                  <div className="lp-insta-head" aria-hidden="true">
                    <i />
                    <span>
                      <b>malerbetrieb_muster</b>
                      <small>Trier</small>
                    </span>
                  </div>
                  <BeforeAfter />
                  <div className="lp-insta-icons" aria-hidden="true">
                    ♡ 💬 ➤
                  </div>
                  <p className="lp-insta-text">
                    <b>malerbetrieb_muster</b> Vorher – nachher: Diese Fassade strahlt wieder! Putzschäden ausgebessert, gereinigt und in warmem
                    Sandton gestrichen.
                    <span> #maler #fassade #vorhernachher #handwerk</span>
                  </p>
                </div>
              </div>
              <div className="lp-social-chips" aria-label="Kanäle">
                <span>Website ✓</span>
                <span>Instagram ✓</span>
                <span>Facebook ✓</span>
                <span>Google ✓</span>
                <span>WhatsApp ✓</span>
              </div>
            </div>
          </div>
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

          <figure className="lp2-phone lp2-portal-phone">
            <img src="/images/app/kundenportal-handy.webp" loading="lazy" decoding="async" width="700" height="1515" alt="Kundenportal am Handy: Projektstand und Fotos vom Baufortschritt" />
          </figure>
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
        <section id="preise" className="landing-section lp2-pricing">
          <p className="landing-section-label">Preise</p>
          <h2>Klare Preise – passend zur Betriebsgröße.</h2>
          <p className="lp2-lead">
            Alle Preise netto zzgl. MwSt. Jährlich zahlen und im ersten Jahr 50 % sparen – oder monatlich kündbar. Jeder weitere Mitarbeiter mit
            App-Zugang {SEAT_MONTHLY} € im Monat. 14 Tage kostenlos testen, mit allen Funktionen, ohne Kreditkarte.
          </p>
          <div className="lp2-interval" role="radiogroup" aria-label="Abrechnung">
            <button type="button" role="radio" aria-checked={!yearly} className={!yearly ? "on" : ""} onClick={() => setYearly(false)}>
              Monatlich
            </button>
            <button type="button" role="radio" aria-checked={yearly} className={yearly ? "on" : ""} onClick={() => setYearly(true)}>
              Jährlich <small>1. Jahr 50 % günstiger</small>
            </button>
          </div>
          <div className="lp2-plans">
            {plans.map((pl) => (
              <article key={pl.name} className={`lp2-plan ${pl.top ? "is-top" : ""}`}>
                {pl.top && <span className="lp2-plan-badge">Beliebt</span>}
                <h3>{pl.name}</h3>
                <p className="lp2-plan-who">{pl.who}</p>
                <p className="lp2-plan-price">
                  <b>{yearly ? euro(firstYearMonthly(pl.name.toLowerCase())) : `${pl.price} €`}</b> <span>/ Monat</span>
                  {yearly && <s className="lp2-plan-was">{pl.price} €</s>}
                </p>
                <p className="lp2-plan-save">
                  {yearly
                    ? `1. Jahr ${euro(firstYearPrice(pl.name.toLowerCase()))}, danach ${euro(yearlyPrice(pl.name.toLowerCase()))} im Jahr`
                    : "monatlich kündbar"}
                </p>
                <ul>
                  {pl.points.map((pt) => (
                    <li key={pt}>{pt}</li>
                  ))}
                </ul>
                <button type="button" className={pl.top ? "landing-primary-btn" : "landing-secondary-btn"} onClick={onRegister}>
                  14 Tage kostenlos testen
                </button>
              </article>
            ))}
          </div>
          <p className="lp2-note">KI-Telefon: Einrichtung einmalig 49 € netto inklusive 300 Minuten, weitere Minuten nach Bedarf.</p>
        </section>

        {/* ---------- Fragen ---------- */}
        <section id="fragen" className="landing-section lp-faq">
          <p className="landing-section-label">Häufige Fragen</p>
          <h2>Gut zu wissen.</h2>
          <div className="lp2-faq-wrap">
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
          <aside className="lp2-faq-aside">
            <b>Ihre Frage ist nicht dabei?</b>
            <p>Schreiben Sie uns – wir antworten persönlich und auf Deutsch.</p>
            <a href="#kontakt" className="landing-secondary-btn">
              Frage stellen
            </a>
            <a href="mailto:info@maler-saas.com">info@maler-saas.com</a>
          </aside>
          </div>
        </section>

        {/* ---------- Wer steckt dahinter ---------- */}
        <section className="landing-section lp2-about" aria-labelledby="lp2-about-title">
          <img src="/images/anton-lehmann.webp" alt="Anton Lehmann, Gründer von MalerSaaS" width="520" height="624" loading="lazy" decoding="async" />
          <div>
            <p className="landing-section-label">Wer steckt dahinter?</p>
            <h2 id="lp2-about-title">Gebaut für das Malerhandwerk.</h2>
            <p>
              MalerSaaS ist aus einem konkreten Kundenwunsch entstanden: Ein Malerbetrieb suchte eine Software, die wirklich zu seinem Alltag
              passt – vom Aufmaß beim Kunden bis zur bezahlten Rechnung. Daraus ist eine Software geworden, die von Anfang an nur für das
              Malergewerbe gedacht ist.
            </p>
            <p>Rückmeldungen aus den Betrieben fließen direkt in die Weiterentwicklung ein. Sie haben eine Idee oder eine Frage? Schreiben Sie mir.</p>
            <p className="lp2-sign">
              <b>Anton Lehmann</b>
              <span>Gründer von MalerSaaS</span>
            </p>
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
          <a href="/ratgeber">Ratgeber</a>
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
