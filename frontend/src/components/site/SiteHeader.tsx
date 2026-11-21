// Gemeinsame Menüleiste aller öffentlichen Seiten (Startseite, Funktionsseiten, Fachkräfte-Pool …)
import { useState } from "react";
import "./site.css";

type Props = {
  onLogin: () => void;
  onRegister: () => void;
  /** auf der Startseite springen die Menüpunkte innerhalb der Seite, sonst zur Startseite */
  home?: boolean;
};

const NAV = [
  { href: "#funktionen", label: "Funktionen" },
  { href: "#fuer-wen", label: "Für wen" },
  { href: "#preise", label: "Preise" },
  { href: "#fragen", label: "Fragen" },
  { href: "#kontakt", label: "Kontakt" },
];

export default function SiteHeader({ onLogin, onRegister, home = false }: Props) {
  const [open, setOpen] = useState(false);
  const close = () => setOpen(false);
  return (
    <header className="site-header">
      <a href="/" className="site-logo" onClick={close}>
        <img src="/images/logo.webp" alt="MalerSaaS Logo" width="48" height="48" />
        <span>
          <strong>MalerSaaS</strong>
          <small>Software für Malerbetriebe</small>
        </span>
      </a>

      <button
        type="button"
        className="site-menu-toggle"
        aria-label={open ? "Menü schließen" : "Menü öffnen"}
        aria-expanded={open}
        onClick={() => setOpen((v) => !v)}
      >
        <span />
        <span />
        <span />
      </button>

      <nav className={`site-nav ${open ? "is-open" : ""}`} aria-label="Hauptmenü">
        {NAV.map((n) => (
          <a key={n.href} href={home ? n.href : `/${n.href}`} onClick={close}>
            {n.label}
          </a>
        ))}
        <button
          type="button"
          className="site-login"
          onClick={() => {
            close();
            onLogin();
          }}
        >
          Login
        </button>
        <button
          type="button"
          className="site-cta"
          onClick={() => {
            close();
            onRegister();
          }}
        >
          14 Tage kostenlos testen
        </button>
      </nav>
    </header>
  );
}
