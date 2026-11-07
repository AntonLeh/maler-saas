// Gemeinsame Vorlage für die Funktions-Unterseiten (/buchhaltung, /ki-telefon, …)
import { useEffect, useState } from "react";
import SeoMeta from "../../components/SeoMeta";
import BeforeAfter from "../../components/BeforeAfter";
import type { FeaturePageData } from "./featurePages";
import "../LandingPage.css";
import "./FeatureLandingPage.css";

type Props = {
  page: FeaturePageData;
  onRegister: () => void;
  onLogin: () => void;
  onOpenImpressum: () => void;
  onOpenDatenschutz: () => void;
  onOpenAgb: () => void;
};

export default function FeatureLandingPage({
  page,
  onRegister,
  onLogin,
  onOpenImpressum,
  onOpenDatenschutz,
  onOpenAgb,
}: Props) {
  const [menu, setMenu] = useState(false);
  const [openFaq, setOpenFaq] = useState<number | null>(0);

  // FAQ als strukturierte Daten für Google
  useEffect(() => {
    const el = document.createElement("script");
    el.type = "application/ld+json";
    el.id = "faq-schema";
    el.text = JSON.stringify({
      "@context": "https://schema.org",
      "@type": "FAQPage",
      mainEntity: page.faqs.map((f) => ({
        "@type": "Question",
        name: f.q,
        acceptedAnswer: { "@type": "Answer", text: f.a },
      })),
    });
    document.getElementById("faq-schema")?.remove();
    document.head.appendChild(el);
    window.scrollTo(0, 0);
    return () => el.remove();
  }, [page]);

  return (
    <>
      <SeoMeta
        title={page.seoTitle}
        description={page.seoDescription}
        canonical={`https://maler-saas.com${page.path}`}
      />
      <div className="landing-page">
        <header className="landing-header">
          <a
            href="/"
            className="landing-logo"
            style={{ textDecoration: "none", color: "inherit" }}
          >
            <img
              src="/images/logo.webp"
              alt="MalerSaaS Logo"
              className="landing-logo-image"
              width="56"
              height="56"
            />
            <div className="landing-logo-text">
              <strong>MalerSaaS</strong>
              <span>Software für Malerbetriebe</span>
            </div>
          </a>
          <button
            type="button"
            className="landing-menu-toggle"
            aria-label="Menü öffnen"
            aria-expanded={menu}
            onClick={() => setMenu((m) => !m)}
          >
            <span></span>
            <span></span>
            <span></span>
          </button>
          <nav className={`landing-nav ${menu ? "is-open" : ""}`}>
            <a href="/">Startseite</a>
            <a href="/#funktionen">Funktionen</a>
            <a href="/#preise">Preise</a>
            <a href="/#kontakt">Kontakt</a>
            <button
              type="button"
              className="landing-login-btn"
              onClick={onLogin}
            >
              Login
            </button>
          </nav>
        </header>

        <main>
          <nav className="fp-crumbs" aria-label="Brotkrumen">
            <a href="/">Startseite</a> <span>›</span>{" "}
            <a href="/#funktionen">Funktionen</a> <span>›</span>{" "}
            <span>{page.badge}</span>
          </nav>

          <section className="landing-hero fp-hero">
            <div>
              <p className="landing-badge">{page.badge}</p>
              <h1>{page.h1}</h1>
              {page.intro.map((t) => (
                <p key={t} className="landing-hero-text">
                  {t}
                </p>
              ))}
              <div className="landing-hero-actions">
                <button
                  type="button"
                  className="landing-primary-btn"
                  onClick={onRegister}
                >
                  14 Tage kostenlos testen
                </button>
                <a
                  href="/#kontakt"
                  className="landing-secondary-btn"
                  style={{ textDecoration: "none" }}
                >
                  Frage stellen
                </a>
              </div>
              <p className="fp-plan">{page.plan}</p>
            </div>

            {page.beforeAfter ? (
              <div className="fp-visual">
                <div className="fp-ba">
                  <BeforeAfter />
                  <div className="lp-social-chips">
                    {["Website", ...page.visual.chips].map((c) => (
                      <span key={c}>{c} ✓</span>
                    ))}
                  </div>
                </div>
              </div>
            ) : (
              <div className="fp-visual" aria-hidden="true">
                <div className="fp-visual-card">
                  <strong>{page.visual.title}</strong>
                  {page.visual.rows.map((r) => (
                    <div key={r.label} className="fp-visual-row">
                      <span>{r.label}</span>
                      <b>{r.value}</b>
                    </div>
                  ))}
                  <div className="lp-doc-foot">
                    {page.visual.chips.map((c) => (
                      <span key={c}>{c} ✓</span>
                    ))}
                  </div>
                </div>
              </div>
            )}
          </section>

          <section className="landing-section">
            <h2>{page.highlightsTitle}</h2>
            <div className="fp-grid">
              {page.highlights.map((h) => (
                <article key={h.title}>
                  <h3>{h.title}</h3>
                  <p>{h.text}</p>
                </article>
              ))}
            </div>
          </section>

          {page.steps && (
            <section className="landing-section landing-how-it-works">
              <h2>{page.stepsTitle}</h2>
              <div className="how-grid fp-steps">
                {page.steps.map((s, i) => (
                  <article key={s.title}>
                    <span>{i + 1}</span>
                    <h3>{s.title}</h3>
                    <p>{s.text}</p>
                  </article>
                ))}
              </div>
            </section>
          )}

          <section className="landing-section">
            <div className="lp-einvoice fp-benefits">
              <div>
                <h2>{page.benefitsTitle}</h2>
                <ul className="lp-checks">
                  {page.benefits.map((b) => (
                    <li key={b}>{b}</li>
                  ))}
                </ul>
              </div>
              <div className="fp-cta-box">
                <p>
                  Testen Sie MalerSaaS 14 Tage kostenlos – ohne Kreditkarte,
                  endet automatisch.
                </p>
                <button
                  type="button"
                  className="landing-primary-btn lp-final-btn"
                  onClick={onRegister}
                >
                  Jetzt kostenlos testen
                </button>
              </div>
            </div>
          </section>

          <section className="landing-section lp-faq">
            <h2>Häufige Fragen</h2>
            <div className="lp-faq-list">
              {page.faqs.map((f, i) => (
                <div
                  key={f.q}
                  className={`lp-faq-item ${openFaq === i ? "is-open" : ""}`}
                >
                  <button
                    type="button"
                    aria-expanded={openFaq === i}
                    onClick={() => setOpenFaq(openFaq === i ? null : i)}
                  >
                    <span>{f.q}</span>
                    <span aria-hidden="true">{openFaq === i ? "−" : "+"}</span>
                  </button>
                  {openFaq === i && <p>{f.a}</p>}
                </div>
              ))}
            </div>
          </section>

          <section className="landing-section fp-related">
            <h2>Passt dazu</h2>
            <div className="fp-related-links">
              {page.related.map((r) => (
                <a key={r.href} href={r.href} className="lp-more">
                  {r.label} →
                </a>
              ))}
              <a href="/maler-software" className="lp-more">
                Alle Funktionen im Überblick →
              </a>
            </div>
          </section>
        </main>

        <footer className="landing-footer">
          <div>
            <strong>MalerSaaS</strong>
            <span>Software für Malerbetriebe · info@maler-saas.com</span>
          </div>
          <div className="landing-footer-links">
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
        </footer>
      </div>
    </>
  );
}
