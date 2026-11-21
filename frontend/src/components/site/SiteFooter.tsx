// Gemeinsame Fußzeile aller öffentlichen Seiten – Links hier ändern, dann gilt es überall.
// Der Ratgeber (frontend/api/ratgeber.ts) hat eine Kopie davon, die dort mitgepflegt werden muss.
import { ArrowRight } from "lucide-react";
import "./site.css";

type Props = {
  onRegister: () => void;
  onLogin: () => void;
  onOpenImpressum?: () => void;
  onOpenDatenschutz?: () => void;
  onOpenAgb?: () => void;
  /** auf der Startseite springen Preise/Fragen/Kontakt innerhalb der Seite */
  home?: boolean;
};

export const FOOTER_COLUMNS: { title: string; links: { href: string; label: string }[] }[] = [
  {
    title: "Funktionen",
    links: [
      { href: "/maler-software", label: "Maler-Software" },
      { href: "/aufmass-angebote", label: "Aufmaß & Angebote" },
      { href: "/auftragsverwaltung", label: "Auftragsverwaltung" },
      { href: "/zeiterfassung", label: "Zeiterfassung" },
      { href: "/rechnungen", label: "Rechnungen & E‑Rechnung" },
      { href: "/materialverwaltung", label: "Materialverwaltung" },
      { href: "/kundenportal", label: "Kundenportal" },
      { href: "/buchhaltung", label: "Buchhaltung" },
    ],
  },
  {
    title: "Mehr",
    links: [
      { href: "/ki-funktionen", label: "KI-Funktionen" },
      { href: "/ki-telefon", label: "KI-Telefon" },
      { href: "/werbung-mit-ki", label: "Werbung mit KI" },
      { href: "/firmen-website", label: "Firmen-Website" },
      { href: "/auswertungen", label: "Auswertungen" },
      { href: "/leistungsbewertung", label: "Leistungsbewertung" },
      { href: "/fachkraefte-finden", label: "Fachkräfte finden" },
    ],
  },
];

export default function SiteFooter({ onRegister, onLogin, onOpenImpressum, onOpenDatenschutz, onOpenAgb, home = false }: Props) {
  const anchor = (h: string) => (home ? h : `/${h}`);
  // ohne Öffner (z. B. Seiten außerhalb der App-Navigation) auf die eigenen Adressen verlinken
  const legal = (label: string, href: string, fn?: () => void) =>
    fn ? (
      <button type="button" onClick={fn}>
        {label}
      </button>
    ) : (
      <a href={href}>{label}</a>
    );
  return (
    <footer className="site-footer">
      <div className="site-footer-inner">
        <div className="site-footer-brand">
          <a href="/" className="site-footer-logo">
            <img src="/images/logo.webp" alt="" width="44" height="44" loading="lazy" />
            <span>
              <strong>MalerSaaS</strong>
              <small>Software für Malerbetriebe</small>
            </span>
          </a>
          <p>Aufmaß, Angebote, Aufträge, Zeiterfassung, Rechnungen und Buchhaltung in einer App – für Malerbetriebe in Deutschland, Österreich und der Schweiz.</p>
          <a className="site-footer-mail" href="mailto:info@maler-saas.com">
            info@maler-saas.com
          </a>
          <button type="button" className="site-footer-cta" onClick={onRegister}>
            14 Tage kostenlos testen <ArrowRight size={16} aria-hidden="true" />
          </button>
        </div>

        {FOOTER_COLUMNS.map((c) => (
          <nav key={c.title} className="site-footer-col" aria-label={c.title}>
            <b>{c.title}</b>
            {c.links.map((l) => (
              <a key={l.href} href={l.href}>
                {l.label}
              </a>
            ))}
          </nav>
        ))}

        <nav className="site-footer-col" aria-label="Service">
          <b>Service</b>
          <a href="/ratgeber">Ratgeber</a>
          <a href={anchor("#preise")}>Preise</a>
          <a href={anchor("#fragen")}>Häufige Fragen</a>
          <a href={anchor("#kontakt")}>Kontakt</a>
          <button type="button" onClick={onLogin}>
            Login
          </button>
          <a href="/fachkraefte">Arbeit gesucht? Fachkräfte-Pool</a>
        </nav>
      </div>

      <div className="site-footer-bottom">
        <span>© {new Date().getFullYear()} MalerSaaS · Server in der EU</span>
        <div className="site-footer-legal">
          {legal("Impressum", "/impressum", onOpenImpressum)}
          {legal("Datenschutz", "/datenschutz", onOpenDatenschutz)}
          {legal("AGB", "/agb", onOpenAgb)}
          <a href="/avv">AVV</a>
        </div>
      </div>
    </footer>
  );
}
