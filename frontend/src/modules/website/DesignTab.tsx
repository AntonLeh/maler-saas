import { useState } from "react";
import type { CompanyInfo, Website, WebsiteSections, WebsiteService, WebsiteTheme } from "./types";
import { ACCENT_PRESETS, DEFAULT_SERVICES, THEMES, siteUrl, slugError } from "./types";
import { processImage, uploadImage } from "./api";

type Props = {
  website: Website;
  company: CompanyInfo | null;
  saving: boolean;
  onSave: (values: Partial<Website>) => Promise<void> | void;
  onError: (msg: string) => void;
};

const SECTION_LABELS: [keyof WebsiteSections, string][] = [
  ["services", "Leistungen"],
  ["references", "Referenzen / Aktuelle Projekte"],
  ["about", "Über uns"],
  ["area", "Einsatzgebiet"],
  ["contact", "Kontakt"],
];

export default function DesignTab({ website, company, saving, onSave, onError }: Props) {
  const [theme, setTheme] = useState<WebsiteTheme>(website.theme);
  const [accent, setAccent] = useState(website.accent_color);
  const [heroTitle, setHeroTitle] = useState(website.hero_title ?? "");
  const [heroSubtitle, setHeroSubtitle] = useState(website.hero_subtitle ?? "");
  const [heroImage, setHeroImage] = useState(website.hero_image_url ?? "");
  const [highlights, setHighlights] = useState((website.highlights ?? []).join("\n"));
  const [services, setServices] = useState<WebsiteService[]>(website.services ?? []);
  const [aboutTitle, setAboutTitle] = useState(website.about_title ?? "");
  const [aboutText, setAboutText] = useState(website.about_text ?? "");
  const [area, setArea] = useState(website.service_area ?? "");
  const [hours, setHours] = useState(website.opening_hours ?? "");
  const [contactForm, setContactForm] = useState(website.contact_form);
  const [sections, setSections] = useState<WebsiteSections>({ ...website.sections });
  const [seoTitle, setSeoTitle] = useState(website.seo_title ?? "");
  const [seoDescription, setSeoDescription] = useState(website.seo_description ?? "");
  const [slug, setSlug] = useState(website.slug);
  const [uploading, setUploading] = useState(false);

  const city = company?.city?.trim() || "";
  const slugProblem = slug !== website.slug ? slugError(slug) : null;

  const uploadHero = async (file: File | undefined) => {
    if (!file) return;
    setUploading(true);
    try {
      // Altes Bild bleibt im Speicher, bis gespeichert wurde (sonst wäre die Website bis dahin ohne Bild)
      const img = await uploadImage(website.tenant_id, await processImage(file, 2000), "titelbild");
      setHeroImage(img.url);
    } catch (e) {
      onError((e as Error).message);
    } finally {
      setUploading(false);
    }
  };

  const updateService = (i: number, patch: Partial<WebsiteService>) =>
    setServices((prev) => prev.map((s, j) => (j === i ? { ...s, ...patch } : s)));
  const moveService = (i: number, dir: -1 | 1) =>
    setServices((prev) => {
      const next = [...prev];
      const j = i + dir;
      if (j < 0 || j >= next.length) return prev;
      [next[i], next[j]] = [next[j], next[i]];
      return next;
    });
  const suggestions = DEFAULT_SERVICES.filter((d) => !services.some((s) => s.title.trim().toLowerCase() === d.title.toLowerCase()));

  const submit = () => {
    if (slugProblem) {
      onError(slugProblem);
      return;
    }
    onSave({
      theme,
      accent_color: /^#[0-9a-f]{6}$/i.test(accent) ? accent : website.accent_color,
      hero_title: heroTitle.trim() || null,
      hero_subtitle: heroSubtitle.trim() || null,
      hero_image_url: heroImage || null,
      highlights: highlights
        .split("\n")
        .map((h) => h.trim())
        .filter(Boolean)
        .slice(0, 8),
      services: services.map((s) => ({ title: s.title.trim(), text: s.text.trim() })).filter((s) => s.title),
      about_title: aboutTitle.trim() || null,
      about_text: aboutText.trim() || null,
      service_area: area.trim() || null,
      opening_hours: hours.trim() || null,
      contact_form: contactForm,
      sections,
      seo_title: seoTitle.trim() || null,
      seo_description: seoDescription.trim() || null,
      slug,
    });
  };

  return (
    <div className="ws-stack">
      <section className="ws-panel">
        <h3>Aussehen</h3>
        <div className="ws-themes" role="radiogroup" aria-label="Vorlage">
          {THEMES.map((t) => (
            <button
              key={t.value}
              type="button"
              role="radio"
              aria-checked={theme === t.value}
              className={`ws-theme ws-theme-${t.value}${theme === t.value ? " active" : ""}`}
              onClick={() => setTheme(t.value)}
              style={{ ["--ws-accent" as string]: accent }}
            >
              <span className="ws-theme-sample" aria-hidden="true">
                <span />
                <span />
                <span />
              </span>
              <strong>{t.label}</strong>
              <span className="tk-muted">{t.hint}</span>
            </button>
          ))}
        </div>
        <div className="ws-colors">
          <span className="ws-label">Hauptfarbe</span>
          {ACCENT_PRESETS.map((c) => (
            <button
              key={c}
              type="button"
              className={`ws-swatch${accent.toLowerCase() === c ? " active" : ""}`}
              style={{ background: c }}
              onClick={() => setAccent(c)}
              aria-label={`Farbe ${c}`}
            />
          ))}
          <label className="ws-custom-color">
            <input type="color" value={accent} onChange={(e) => setAccent(e.target.value)} aria-label="Eigene Farbe" />
            eigene Farbe
          </label>
        </div>
        <p className="tk-muted">
          Logo, Telefonnummer und Adresse kommen aus den <strong>Firmeneinstellungen</strong> und erscheinen automatisch auf der Website.
        </p>
      </section>

      <section className="ws-panel">
        <h3>Titelbereich</h3>
        <div className="tk-form">
          <label className="tk-field tk-span-2">
            <span>Überschrift</span>
            <input value={heroTitle} onChange={(e) => setHeroTitle(e.target.value)} placeholder={city ? `Ihr Malerbetrieb in ${city}` : "Ihr Malerbetrieb in …"} maxLength={90} />
            <small className="tk-muted">Tipp für Google: Beruf und Ort nennen, z. B. „Ihr Malerbetrieb in {city || "Musterstadt"}“.</small>
          </label>
          <label className="tk-field tk-span-2">
            <span>Kurzer Text darunter</span>
            <textarea rows={2} value={heroSubtitle} onChange={(e) => setHeroSubtitle(e.target.value)} maxLength={240} placeholder="Leer lassen für einen passenden Standardtext." />
          </label>
          <div className="tk-field tk-span-2">
            <span>Titelbild</span>
            <div className="ws-hero-row">
              {heroImage ? <img src={heroImage} alt="Titelbild" className="ws-hero-thumb" /> : <div className="ws-hero-thumb ws-hero-empty">kein Bild</div>}
              <div className="ws-hero-actions">
                <label className="btn btn-secondary btn-small">
                  {uploading ? "Wird hochgeladen …" : heroImage ? "Anderes Bild wählen" : "Bild hochladen"}
                  <input type="file" accept="image/jpeg,image/png,image/webp" hidden disabled={uploading} onChange={(e) => uploadHero(e.target.files?.[0])} />
                </label>
                {heroImage && (
                  <button type="button" className="ws-link" onClick={() => setHeroImage("")}>
                    Bild entfernen
                  </button>
                )}
                <small className="tk-muted">Am besten ein helles Querformat-Foto einer fertigen Arbeit. Standortdaten im Bild werden automatisch entfernt.</small>
              </div>
            </div>
          </div>
          <label className="tk-field tk-span-2">
            <span>Ihre Stärken (eine pro Zeile, max. 8)</span>
            <textarea rows={4} value={highlights} onChange={(e) => setHighlights(e.target.value)} placeholder={"Meisterbetrieb\nSeit 1998\nFestpreis-Angebot"} />
          </label>
        </div>
      </section>

      <section className="ws-panel">
        <h3>Leistungen</h3>
        {services.length === 0 && <p className="tk-muted">Noch keine Leistungen eingetragen.</p>}
        <div className="ws-services">
          {services.map((s, i) => (
            <div key={i} className="ws-service">
              <div className="ws-service-fields">
                <input value={s.title} onChange={(e) => updateService(i, { title: e.target.value })} placeholder="z. B. Fassadenanstrich" maxLength={60} aria-label="Leistung" />
                <textarea rows={2} value={s.text} onChange={(e) => updateService(i, { text: e.target.value })} placeholder="Ein bis zwei Sätze zur Leistung" maxLength={240} aria-label="Beschreibung" />
              </div>
              <div className="ws-service-tools">
                <button type="button" className="tk-icon-btn" onClick={() => moveService(i, -1)} disabled={i === 0} aria-label="Nach oben">
                  ↑
                </button>
                <button type="button" className="tk-icon-btn" onClick={() => moveService(i, 1)} disabled={i === services.length - 1} aria-label="Nach unten">
                  ↓
                </button>
                <button type="button" className="tk-icon-btn" onClick={() => setServices((p) => p.filter((_, j) => j !== i))} aria-label="Entfernen">
                  ×
                </button>
              </div>
            </div>
          ))}
        </div>
        <div className="ws-row">
          <button type="button" className="btn btn-secondary btn-small" onClick={() => setServices((p) => [...p, { title: "", text: "" }])} disabled={services.length >= 12}>
            + Leistung hinzufügen
          </button>
          {suggestions.length > 0 && (
            <span className="ws-suggest">
              Vorschläge:{" "}
              {suggestions.map((sg) => (
                <button key={sg.title} type="button" className="ws-chip" onClick={() => setServices((p) => [...p, { ...sg }])}>
                  + {sg.title}
                </button>
              ))}
            </span>
          )}
        </div>
      </section>

      <section className="ws-panel">
        <h3>Über uns, Einsatzgebiet und Kontakt</h3>
        <div className="tk-form">
          <label className="tk-field tk-span-2">
            <span>Überschrift „Über uns“</span>
            <input value={aboutTitle} onChange={(e) => setAboutTitle(e.target.value)} placeholder={`Über ${company?.company_name || "uns"}`} maxLength={90} />
          </label>
          <label className="tk-field tk-span-2">
            <span>Text „Über uns“</span>
            <textarea
              rows={5}
              value={aboutText}
              onChange={(e) => setAboutText(e.target.value)}
              placeholder="Wer seid ihr, seit wann gibt es den Betrieb, wie groß ist das Team, was ist euch wichtig? Leerzeile = neuer Absatz."
            />
          </label>
          <label className="tk-field tk-span-2">
            <span>Einsatzgebiet (Orte mit Komma trennen)</span>
            <input value={area} onChange={(e) => setArea(e.target.value)} placeholder="Wittlich, Bernkastel-Kues, Trier" />
            <small className="tk-muted">Wichtig für Google: Wer „Maler + Ort“ sucht, findet euch eher, wenn der Ort hier steht.</small>
          </label>
          <label className="tk-field">
            <span>Erreichbarkeit</span>
            <textarea rows={2} value={hours} onChange={(e) => setHours(e.target.value)} placeholder="Mo–Fr 7:00–17:00 Uhr" />
          </label>
          <label className="tk-field ws-check">
            <input type="checkbox" checked={contactForm} onChange={(e) => setContactForm(e.target.checked)} />
            <span>Kontaktformular anzeigen (Anfragen landen unter „Anfragen“)</span>
          </label>
        </div>
      </section>

      <section className="ws-panel">
        <h3>Bereiche anzeigen</h3>
        <div className="ws-checks">
          {SECTION_LABELS.map(([k, label]) => (
            <label key={k} className="ws-check">
              <input type="checkbox" checked={sections[k]} onChange={(e) => setSections((p) => ({ ...p, [k]: e.target.checked }))} />
              <span>{label}</span>
            </label>
          ))}
        </div>
        <p className="tk-muted">Bereiche ohne Inhalt (z. B. noch keine Referenzen) werden automatisch ausgeblendet.</p>
      </section>

      <section className="ws-panel">
        <h3>Google-Suche und Web-Adresse</h3>
        <div className="tk-form">
          <label className="tk-field tk-span-2">
            <span>Titel in der Google-Suche ({seoTitle.length}/60)</span>
            <input value={seoTitle} onChange={(e) => setSeoTitle(e.target.value)} maxLength={70} placeholder={`${company?.company_name || "Firmenname"} – Maler${city ? ` in ${city}` : ""}`} />
          </label>
          <label className="tk-field tk-span-2">
            <span>Beschreibung in der Google-Suche ({seoDescription.length}/155)</span>
            <textarea rows={2} value={seoDescription} onChange={(e) => setSeoDescription(e.target.value)} maxLength={160} placeholder="Leer lassen für eine automatische Beschreibung aus Leistungen und Ort." />
          </label>
          <label className="tk-field tk-span-2">
            <span>Web-Adresse</span>
            <div className="ws-slug">
              <span className="tk-muted">{siteUrl("").replace(/\/$/, "")}/</span>
              <input value={slug} onChange={(e) => setSlug(e.target.value.toLowerCase().replace(/[^a-z0-9-]/g, ""))} maxLength={50} />
            </div>
            {slugProblem && <small className="ws-warn">{slugProblem}</small>}
            {slug !== website.slug && !slugProblem && (
              <small className="ws-warn">Achtung: Die alte Adresse funktioniert danach nicht mehr. Bereits verteilte Links und Google-Einträge zeigen dann ins Leere.</small>
            )}
          </label>
        </div>
      </section>

      <div className="ws-savebar">
        <button type="button" className="btn btn-primary" onClick={submit} disabled={saving || uploading}>
          {saving ? "Wird gespeichert …" : "Änderungen speichern"}
        </button>
      </div>
    </div>
  );
}
