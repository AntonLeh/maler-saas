// =====================================================================
// Öffentliche Firmen-Websites der Betriebe (Modul Website)
//
// Erreichbar über   https://maler-saas.com/w/<slug>            (Startseite)
//                   https://maler-saas.com/w/<slug>/impressum
//                   https://maler-saas.com/w/<slug>/datenschutz
// (Rewrites in vercel.json). Später zusätzlich <slug>.maler-saas.com.
//
// Die Seite wird auf dem Server als fertiges HTML erzeugt (gut für Google),
// ohne externe Schriften, Tracker oder Cookies.
// Daten kommen über die Datenbank-Funktion website_public (nur veröffentlichte Inhalte).
//
// Optionale Umgebungsvariablen (Vercel):
//   BREVO_API_KEY, BREVO_SENDER_EMAIL   E-Mail an den Betrieb bei neuer Anfrage
//   SITE_ORIGIN                          Standard https://maler-saas.com
// =====================================================================

const SUPABASE_URL = "https://udzgxfjmpeygylgrcdsc.supabase.co";
const SUPABASE_ANON_KEY = "sb_publishable_N23R8SIVVw7_qmH3w-JPrw_w9YBpgyH";

const env = (k: string): string =>
  (globalThis as { process?: { env?: Record<string, string | undefined> } }).process?.env?.[k] ?? "";

export type Service = { title?: string; text?: string };
export type RefImage = { url?: string; alt?: string };
export type Reference = { id: number; title: string; text?: string | null; city?: string | null; images?: RefImage[]; published_at?: string };
export type SiteData = {
  slug: string;
  published: boolean;
  theme: "klassisch" | "modern" | "frisch" | string;
  accent_color: string;
  hero_title?: string | null;
  hero_subtitle?: string | null;
  hero_image_url?: string | null;
  highlights?: string[];
  services?: Service[];
  about_title?: string | null;
  about_text?: string | null;
  service_area?: string | null;
  opening_hours?: string | null;
  sections?: Record<string, boolean>;
  contact_form?: boolean;
  seo_title?: string | null;
  seo_description?: string | null;
  owner_name?: string | null;
  legal_form?: string | null;
  register_court?: string | null;
  register_number?: string | null;
  chamber?: string | null;
  job_title?: string | null;
  job_title_country?: string | null;
  privacy_extra?: string | null;
  company: {
    name?: string | null;
    street?: string | null;
    zip?: string | null;
    city?: string | null;
    phone?: string | null;
    email?: string | null;
    vat_id?: string | null;
    logo_url?: string | null;
  };
  references?: Reference[];
};

// ---------------------------------------------------------------------
// Hilfen
// ---------------------------------------------------------------------
export function esc(v: unknown): string {
  return String(v ?? "")
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#39;");
}

/** Nur https-Bilder zulassen */
export function safeUrl(v: unknown): string {
  const s = String(v ?? "").trim();
  return /^https:\/\/[^\s"'<>]+$/i.test(s) ? s : "";
}

/** Absätze aus Freitext */
function paragraphs(text: unknown): string {
  return String(text ?? "")
    .split(/\n{2,}/)
    .map((p) => p.trim())
    .filter(Boolean)
    .map((p) => `<p>${esc(p).replace(/\n/g, "<br>")}</p>`)
    .join("");
}

function telHref(phone: string): string {
  const d = phone.replace(/[^\d+]/g, "");
  if (d.startsWith("+")) return d;
  if (d.startsWith("00")) return `+${d.slice(2)}`;
  if (d.startsWith("0")) return `+49${d.slice(1)}`;
  return d;
}

function validColor(c: string): string {
  return /^#[0-9a-f]{6}$/i.test(c) ? c : "#1d4e89";
}

/** Dunklere Variante der Akzentfarbe (für Hover/Text auf hellem Grund) */
function shade(hex: string, factor: number): string {
  const n = parseInt(hex.slice(1), 16);
  const r = Math.round(((n >> 16) & 255) * factor);
  const g = Math.round(((n >> 8) & 255) * factor);
  const b = Math.round((n & 255) * factor);
  return `#${[r, g, b].map((x) => Math.max(0, Math.min(255, x)).toString(16).padStart(2, "0")).join("")}`;
}

export function areaList(area: unknown): string[] {
  return String(area ?? "")
    .split(/[,;\n]/)
    .map((s) => s.trim())
    .filter(Boolean)
    .slice(0, 40);
}

const SECTION_DEFAULTS = { services: true, references: true, about: true, area: true, contact: true };

// ---------------------------------------------------------------------
// Layout
// ---------------------------------------------------------------------
type Ctx = { base: string; canonical: string; origin: string; notice?: string; preview: boolean; q?: string };

function styles(d: SiteData): string {
  const accent = validColor(d.accent_color);
  const accentDark = shade(accent, 0.72);
  const serif = d.theme === "klassisch";
  return `
:root{--accent:${accent};--accent-dark:${accentDark};--ink:#1c2430;--muted:#5b6573;--line:#e3e6ea;--bg:#ffffff;--soft:${d.theme === "frisch" ? "#f3f7f4" : "#f6f5f2"};--radius:${d.theme === "modern" ? "4px" : d.theme === "frisch" ? "18px" : "10px"};
--head:${serif ? 'Georgia,"Times New Roman",serif' : 'system-ui,-apple-system,"Segoe UI",Roboto,Arial,sans-serif'};--body:system-ui,-apple-system,"Segoe UI",Roboto,Arial,sans-serif}
*{box-sizing:border-box}html{scroll-behavior:smooth;-webkit-text-size-adjust:100%}
body{margin:0;font-family:var(--body);color:var(--ink);background:var(--bg);line-height:1.6;font-size:17px}
img{max-width:100%;display:block}a{color:var(--accent-dark)}
h1,h2,h3{font-family:var(--head);line-height:1.2;margin:0 0 .5em;letter-spacing:${serif ? "0" : "-.01em"}}
h1{font-size:clamp(2rem,4.5vw,3.2rem)}h2{font-size:clamp(1.6rem,3vw,2.2rem)}h3{font-size:1.2rem}
.wrap{max-width:1120px;margin:0 auto;padding:0 20px}
.skip{position:absolute;left:-999px}.skip:focus{left:10px;top:10px;background:#fff;padding:8px;z-index:9}
header.top{position:sticky;top:0;z-index:20;background:rgba(255,255,255,.96);backdrop-filter:blur(6px);border-bottom:1px solid var(--line)}
header.top .wrap{display:flex;align-items:center;gap:16px;min-height:68px}
.brand{display:flex;align-items:center;gap:10px;text-decoration:none;color:var(--ink);font-weight:700;font-family:var(--head);font-size:1.15rem;min-width:0}
.brand img{height:44px;width:auto;max-width:160px;object-fit:contain}
.brand span{overflow:hidden;text-overflow:ellipsis;white-space:nowrap}
nav.main{margin-left:auto;display:flex;gap:22px}
nav.main a{color:var(--ink);text-decoration:none;font-weight:500;font-size:.98rem}
nav.main a:hover{color:var(--accent)}
.btn{display:inline-flex;align-items:center;justify-content:center;gap:8px;padding:13px 22px;border-radius:var(--radius);font-weight:700;text-decoration:none;border:2px solid var(--accent);background:var(--accent);color:#fff;cursor:pointer;font-size:1rem;font-family:inherit}
.btn:hover{background:var(--accent-dark);border-color:var(--accent-dark)}
.btn.ghost{background:transparent;color:var(--accent-dark)}
.btn.ghost:hover{background:var(--accent);color:#fff}
.btn.light{background:#fff;color:var(--ink);border-color:#fff}
.top .call{margin-left:8px;padding:9px 16px;font-size:.95rem}
.hero{position:relative;padding:72px 0 64px;background:var(--soft)}
.hero .grid{display:grid;grid-template-columns:1.1fr .9fr;gap:48px;align-items:center}
.hero p.lead{font-size:1.2rem;color:var(--muted);margin:0 0 26px;max-width:36em}
.hero .actions{display:flex;flex-wrap:wrap;gap:12px}
.hero .pic{border-radius:calc(var(--radius) * 1.6);overflow:hidden;aspect-ratio:4/3;background:#dfe3e8;box-shadow:0 18px 40px rgba(20,30,45,.15)}
.hero .pic img{width:100%;height:100%;object-fit:cover}
.chips{display:flex;flex-wrap:wrap;gap:10px;margin:26px 0 0;padding:0;list-style:none}
.chips li{background:#fff;border:1px solid var(--line);border-radius:999px;padding:6px 14px;font-size:.92rem;font-weight:600}
.chips li::before{content:"✓ ";color:var(--accent)}
.theme-modern .hero{color:#fff;background:#18202b;padding:110px 0 96px;overflow:hidden}
.theme-modern .hero.has-img{background:linear-gradient(90deg,rgba(12,18,26,.88) 0%,rgba(12,18,26,.62) 55%,rgba(12,18,26,.25) 100%),var(--hero-img) center/cover no-repeat}
.theme-modern .hero .grid{grid-template-columns:1fr}.theme-modern .hero .pic{display:none}
.theme-modern .hero p.lead{color:#e6eaf0}.theme-modern .hero .btn.ghost{color:#fff;border-color:#fff}
.theme-modern .chips li{background:rgba(255,255,255,.12);border-color:rgba(255,255,255,.3);color:#fff}
.theme-frisch .hero{background:linear-gradient(135deg,var(--accent) 0%,var(--accent-dark) 100%);color:#fff}
.theme-frisch .hero p.lead{color:rgba(255,255,255,.9)}.theme-frisch .hero .btn{background:#fff;color:var(--accent-dark);border-color:#fff}
.theme-frisch .hero .btn.ghost{background:transparent;color:#fff}
.theme-frisch .chips li{background:rgba(255,255,255,.15);border-color:rgba(255,255,255,.35);color:#fff}.theme-frisch .chips li::before{color:#fff}
section.block{padding:72px 0}
section.alt{background:var(--soft)}
.sec-head{max-width:720px;margin:0 0 34px}
.sec-head p{color:var(--muted);margin:0}
.cards{display:grid;grid-template-columns:repeat(auto-fill,minmax(250px,1fr));gap:20px}
.card{background:#fff;border:1px solid var(--line);border-radius:var(--radius);padding:24px}
.card h3{margin-bottom:.35em}.card p{margin:0;color:var(--muted)}
.card .ico{width:42px;height:42px;border-radius:50%;background:color-mix(in srgb,var(--accent) 14%,#fff);color:var(--accent-dark);display:grid;place-items:center;font-weight:800;margin-bottom:14px}
.refs{display:grid;grid-template-columns:repeat(auto-fill,minmax(300px,1fr));gap:24px}
.ref{background:#fff;border:1px solid var(--line);border-radius:var(--radius);overflow:hidden;display:flex;flex-direction:column}
.ref .main{aspect-ratio:4/3;background:#e6e9ed}.ref .main img{width:100%;height:100%;object-fit:cover}
.ref .thumbs{display:flex;gap:6px;padding:8px 8px 0;overflow-x:auto}
.ref .thumbs img{width:64px;height:48px;object-fit:cover;border-radius:4px;flex:0 0 auto}
.ref .body{padding:18px 20px 22px}
.ref .where{font-size:.85rem;color:var(--muted);font-weight:600;text-transform:uppercase;letter-spacing:.04em}
.ref p{margin:.4em 0 0;color:var(--muted)}
.about{display:grid;grid-template-columns:1fr 1fr;gap:48px;align-items:start}
.facts{list-style:none;margin:0;padding:0;display:grid;gap:12px}
.facts li{background:#fff;border:1px solid var(--line);border-radius:var(--radius);padding:14px 18px;font-weight:600}
.facts li::before{content:"✓";color:var(--accent);margin-right:10px}
.area{display:flex;flex-wrap:wrap;gap:10px;padding:0;margin:0;list-style:none}
.area li{border:1px solid var(--line);background:#fff;border-radius:999px;padding:7px 15px}
.contact{display:grid;grid-template-columns:.9fr 1.1fr;gap:40px}
.contact dl{margin:0}.contact dt{font-weight:700;margin-top:14px}.contact dd{margin:2px 0 0}
form.lead{background:#fff;border:1px solid var(--line);border-radius:var(--radius);padding:26px;display:grid;gap:14px}
form.lead label{display:grid;gap:6px;font-weight:600;font-size:.95rem}
form.lead input,form.lead textarea{font:inherit;padding:12px 14px;border:1px solid #c9ced6;border-radius:calc(var(--radius) * .7);width:100%}
form.lead input:focus,form.lead textarea:focus{outline:3px solid color-mix(in srgb,var(--accent) 30%,transparent);border-color:var(--accent)}
form.lead .two{display:grid;grid-template-columns:1fr 1fr;gap:14px}
form.lead .hp{position:absolute;left:-5000px;width:1px;height:1px;overflow:hidden}
form.lead small{color:var(--muted);font-weight:400}
.notice{padding:14px 18px;border-radius:var(--radius);margin-bottom:16px;font-weight:600}
.notice.ok{background:#e7f6ec;color:#1d5b33}.notice.err{background:#fdecec;color:#8a1f1f}
.preview{background:#fff4d6;color:#6b4e00;text-align:center;padding:8px 12px;font-size:.9rem;font-weight:600}
footer.bottom{background:#141a22;color:#cfd5dd;padding:40px 0 90px;font-size:.95rem}
footer.bottom a{color:#fff}
footer.bottom .wrap{display:flex;flex-wrap:wrap;gap:24px;justify-content:space-between}
footer.bottom .made{opacity:.6;font-size:.85rem}
.legal{padding:48px 0 72px;max-width:820px}.legal h2{font-size:1.3rem;margin-top:1.6em}
.callbar{display:none}
@media (max-width:860px){
 nav.main{display:none}
 .hero{padding:44px 0 40px}.theme-modern .hero{padding:72px 0 64px}
 .hero .grid,.about,.contact{grid-template-columns:1fr;gap:28px}
 section.block{padding:52px 0}
 form.lead .two{grid-template-columns:1fr}
 .top .call{display:none}
 .callbar{display:grid;grid-template-columns:1fr 1fr;position:fixed;left:0;right:0;bottom:0;z-index:30;box-shadow:0 -4px 16px rgba(0,0,0,.12)}
 .callbar a{padding:15px 10px;text-align:center;font-weight:700;text-decoration:none;color:#fff;background:var(--accent)}
 .callbar a+a{background:var(--accent-dark)}
}
@media (prefers-reduced-motion:reduce){html{scroll-behavior:auto}}
`;
}

function header(d: SiteData, ctx: Ctx, home: boolean): string {
  const name = d.company.name || "Malerbetrieb";
  const logo = safeUrl(d.company.logo_url);
  const phone = d.company.phone?.trim();
  const s = { ...SECTION_DEFAULTS, ...(d.sections ?? {}) };
  const link = (hash: string) => (home ? `#${hash}` : `${ctx.base}/${ctx.q ?? ""}#${hash}`);
  const nav = [
    s.services && (d.services?.length ?? 0) > 0 ? `<a href="${link("leistungen")}">Leistungen</a>` : "",
    s.references && (d.references?.length ?? 0) > 0 ? `<a href="${link("referenzen")}">Referenzen</a>` : "",
    s.about && (d.about_text || (d.highlights?.length ?? 0) > 0) ? `<a href="${link("ueber-uns")}">Über uns</a>` : "",
    s.contact ? `<a href="${link("kontakt")}">Kontakt</a>` : "",
  ].join("");
  return `${ctx.preview ? `<div class="preview">Vorschau – diese Seite ist noch nicht veröffentlicht.</div>` : ""}
<header class="top"><div class="wrap">
<a class="brand" href="${ctx.base}/${ctx.q ?? ""}">${logo ? `<img src="${esc(logo)}" alt="${esc(name)} Logo">` : ""}<span>${esc(name)}</span></a>
<nav class="main" aria-label="Hauptnavigation">${nav}</nav>
${phone ? `<a class="btn call" href="tel:${esc(telHref(phone))}">📞 ${esc(phone)}</a>` : ""}
</div></header>`;
}

function footer(d: SiteData, ctx: Ctx): string {
  const c = d.company;
  const phone = c.phone?.trim();
  return `<footer class="bottom"><div class="wrap">
<div><strong>${esc(c.name)}</strong><br>${esc(c.street)}<br>${esc([c.zip, c.city].filter(Boolean).join(" "))}</div>
<div>${phone ? `Telefon: <a href="tel:${esc(telHref(phone))}">${esc(phone)}</a><br>` : ""}${c.email ? `E-Mail: <a href="mailto:${esc(c.email)}">${esc(c.email)}</a>` : ""}</div>
<div><a href="${ctx.base}/impressum${ctx.q ?? ""}">Impressum</a> · <a href="${ctx.base}/datenschutz${ctx.q ?? ""}">Datenschutz</a><br><span class="made">Website erstellt mit <a href="${esc(ctx.origin)}/">Maler-SaaS</a></span></div>
</div></footer>
${phone ? `<div class="callbar"><a href="tel:${esc(telHref(phone))}">📞 Anrufen</a><a href="${ctx.base}/${ctx.q ?? ""}#kontakt">✉️ Anfrage</a></div>` : ""}`;
}

function jsonLd(d: SiteData, ctx: Ctx): string {
  const c = d.company;
  const data: Record<string, unknown> = {
    "@context": "https://schema.org",
    "@type": "HousePainter",
    name: c.name || undefined,
    url: ctx.canonical,
    telephone: c.phone || undefined,
    email: c.email || undefined,
    image: safeUrl(d.hero_image_url) || safeUrl(c.logo_url) || undefined,
    logo: safeUrl(c.logo_url) || undefined,
    address: c.street
      ? { "@type": "PostalAddress", streetAddress: c.street, postalCode: c.zip || undefined, addressLocality: c.city || undefined, addressCountry: "DE" }
      : undefined,
    areaServed: areaList(d.service_area).map((n) => ({ "@type": "City", name: n })),
    makesOffer: (d.services ?? []).filter((s) => s.title).map((s) => ({ "@type": "Offer", itemOffered: { "@type": "Service", name: s.title } })),
  };
  // "<" im JSON escapen, damit niemand das Script-Tag schließen kann
  return `<script type="application/ld+json">${JSON.stringify(data).replace(/</g, "\\u003c")}</script>`;
}

function page(d: SiteData, ctx: Ctx, title: string, description: string, body: string, opts: { home: boolean; index: boolean }): string {
  const ogImage = safeUrl(d.hero_image_url) || safeUrl(d.references?.[0]?.images?.[0]?.url) || "";
  return `<!doctype html>
<html lang="de"><head>
<meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1">
<title>${esc(title)}</title>
<meta name="description" content="${esc(description)}">
<link rel="canonical" href="${esc(ctx.canonical)}">
${opts.index ? "" : '<meta name="robots" content="noindex">'}
<meta property="og:type" content="website"><meta property="og:title" content="${esc(title)}">
<meta property="og:description" content="${esc(description)}"><meta property="og:url" content="${esc(ctx.canonical)}">
${ogImage ? `<meta property="og:image" content="${esc(ogImage)}">` : ""}
<meta name="theme-color" content="${esc(validColor(d.accent_color))}">
<style>${styles(d)}</style>
${opts.home ? jsonLd(d, ctx) : ""}
</head>
<body class="theme-${esc(["klassisch", "modern", "frisch"].includes(d.theme) ? d.theme : "klassisch")}">
<a class="skip" href="#inhalt">Zum Inhalt springen</a>
${header(d, ctx, opts.home)}
<main id="inhalt">${body}</main>
${footer(d, ctx)}
</body></html>`;
}

// ---------------------------------------------------------------------
// Seiten
// ---------------------------------------------------------------------
export function renderHome(d: SiteData, ctx: Ctx): string {
  const c = d.company;
  const city = c.city?.trim() || "";
  const name = c.name || "Malerbetrieb";
  const s = { ...SECTION_DEFAULTS, ...(d.sections ?? {}) };
  const services = (d.services ?? []).filter((x) => x?.title);
  const refs = (d.references ?? []).filter((r) => r?.title);
  const highlights = (d.highlights ?? []).filter(Boolean).slice(0, 8);
  const area = areaList(d.service_area);
  const heroImg = safeUrl(d.hero_image_url);
  const phone = c.phone?.trim();
  const h1 = d.hero_title?.trim() || (city ? `Ihr Malerbetrieb in ${city}` : `Ihr Malerbetrieb`);
  const sub =
    d.hero_subtitle?.trim() ||
    `${name}: Malerarbeiten innen und außen – sauber, termintreu und mit festem Ansprechpartner${city ? ` in ${city} und Umgebung` : ""}.`;

  const hero = `<section class="hero${heroImg ? " has-img" : ""}"${heroImg ? ` style="--hero-img:url('${esc(heroImg)}')"` : ""}><div class="wrap grid">
<div><h1>${esc(h1)}</h1><p class="lead">${esc(sub)}</p>
<div class="actions">${phone ? `<a class="btn" href="tel:${esc(telHref(phone))}">📞 ${esc(phone)}</a>` : ""}${s.contact ? `<a class="btn ghost" href="#kontakt">Kostenlos anfragen</a>` : ""}</div>
${highlights.length ? `<ul class="chips">${highlights.map((h) => `<li>${esc(h)}</li>`).join("")}</ul>` : ""}
</div>
${heroImg ? `<div class="pic"><img src="${esc(heroImg)}" alt="${esc(`${name} – Malerarbeiten`)}" fetchpriority="high"></div>` : ""}
</div></section>`;

  const servicesHtml =
    s.services && services.length
      ? `<section class="block" id="leistungen"><div class="wrap">
<div class="sec-head"><h2>Unsere Leistungen</h2><p>Alles aus einer Hand${city ? ` – für Privat- und Gewerbekunden in ${esc(city)} und Umgebung` : ""}.</p></div>
<div class="cards">${services
          .map((sv, i) => `<article class="card"><div class="ico" aria-hidden="true">${i + 1}</div><h3>${esc(sv.title)}</h3>${sv.text ? `<p>${esc(sv.text)}</p>` : ""}</article>`)
          .join("")}</div></div></section>`
      : "";

  const refsHtml =
    s.references && refs.length
      ? `<section class="block alt" id="referenzen"><div class="wrap">
<div class="sec-head"><h2>Aktuelle Projekte</h2><p>Ein Auszug aus unseren zuletzt abgeschlossenen Arbeiten.</p></div>
<div class="refs">${refs
          .map((r) => {
            const imgs = (r.images ?? []).map((im) => ({ url: safeUrl(im?.url), alt: im?.alt })).filter((im) => im.url);
            const first = imgs[0];
            return `<article class="ref">${
              first ? `<div class="main"><img src="${esc(first.url)}" alt="${esc(first.alt || r.title)}" loading="lazy"></div>` : ""
            }${
              imgs.length > 1
                ? `<div class="thumbs">${imgs
                    .slice(1, 7)
                    .map((im) => `<img src="${esc(im.url)}" alt="${esc(im.alt || r.title)}" loading="lazy">`)
                    .join("")}</div>`
                : ""
            }<div class="body">${r.city ? `<div class="where">${esc(r.city)}</div>` : ""}<h3>${esc(r.title)}</h3>${r.text ? `<p>${esc(r.text)}</p>` : ""}</div></article>`;
          })
          .join("")}</div></div></section>`
      : "";

  const aboutHtml =
    s.about && (d.about_text || highlights.length)
      ? `<section class="block" id="ueber-uns"><div class="wrap about">
<div><h2>${esc(d.about_title?.trim() || `Über ${name}`)}</h2>${paragraphs(d.about_text)}</div>
${highlights.length ? `<ul class="facts">${highlights.map((h) => `<li>${esc(h)}</li>`).join("")}</ul>` : ""}
</div></section>`
      : "";

  const areaHtml =
    s.area && area.length
      ? `<section class="block alt" id="einzugsgebiet"><div class="wrap">
<div class="sec-head"><h2>Hier sind wir für Sie da</h2><p>Unser Einsatzgebiet rund um ${esc(city || "unseren Standort")}:</p></div>
<ul class="area">${area.map((a) => `<li>${esc(a)}</li>`).join("")}</ul></div></section>`
      : "";

  const notice =
    ctx.notice === "ok"
      ? `<div class="notice ok" role="status">Vielen Dank! Ihre Anfrage ist bei uns angekommen. Wir melden uns schnellstmöglich.</div>`
      : ctx.notice
        ? `<div class="notice err" role="alert">${esc(ctx.notice)}</div>`
        : "";
  const formHtml =
    d.contact_form !== false
      ? `<form class="lead" method="post" action="/api/site?slug=${encodeURIComponent(d.slug)}&action=contact">
${notice}
<div class="two"><label>Ihr Name *<input name="name" required maxlength="120" autocomplete="name"></label>
<label>Telefon<input name="phone" type="tel" maxlength="40" autocomplete="tel"></label></div>
<label>E-Mail<input name="email" type="email" maxlength="160" autocomplete="email"></label>
<label>Ihr Anliegen *<textarea name="message" required rows="5" maxlength="3000" placeholder="z. B. Wohnzimmer und Flur streichen, ca. 60 m², gewünschter Zeitraum …"></textarea></label>
<div class="hp" aria-hidden="true"><label>Website<input name="website" tabindex="-1" autocomplete="off"></label></div>
<input type="hidden" name="t" value="${Date.now()}">
<small>Bitte Telefon oder E-Mail angeben. Ihre Angaben verwenden wir nur zur Bearbeitung Ihrer Anfrage, siehe <a href="${ctx.base}/datenschutz${ctx.q ?? ""}">Datenschutz</a>.</small>
<button class="btn" type="submit">Anfrage senden</button>
</form>`
      : "";
  const contactHtml = s.contact
    ? `<section class="block" id="kontakt"><div class="wrap contact">
<div><h2>Kontakt</h2><p>Rufen Sie uns an oder schreiben Sie uns – wir melden uns zeitnah und vereinbaren einen kostenlosen Besichtigungstermin.</p>
<dl>${phone ? `<dt>Telefon</dt><dd><a href="tel:${esc(telHref(phone))}">${esc(phone)}</a></dd>` : ""}
${c.email ? `<dt>E-Mail</dt><dd><a href="mailto:${esc(c.email)}">${esc(c.email)}</a></dd>` : ""}
${c.street ? `<dt>Adresse</dt><dd>${esc(c.street)}<br>${esc([c.zip, c.city].filter(Boolean).join(" "))}</dd>` : ""}
${d.opening_hours ? `<dt>Erreichbarkeit</dt><dd>${esc(d.opening_hours).replace(/\n/g, "<br>")}</dd>` : ""}</dl></div>
${formHtml || "<div></div>"}
</div></section>`
    : "";

  const title = d.seo_title?.trim() || `${name} – Maler${city ? ` in ${city}` : ""}`;
  const description =
    d.seo_description?.trim() ||
    `${name}${city ? ` in ${city}` : ""}: ${services.length ? services.slice(0, 4).map((x) => x.title).join(", ") : "Malerarbeiten innen und außen"}. Jetzt kostenlos anfragen.`;
  return page(d, ctx, title.slice(0, 70), description.slice(0, 160), hero + servicesHtml + refsHtml + aboutHtml + areaHtml + contactHtml, {
    home: true,
    index: !ctx.preview,
  });
}

export function renderImprint(d: SiteData, ctx: Ctx): string {
  const c = d.company;
  const rows: string[] = [];
  rows.push(`<p><strong>${esc(c.name)}</strong>${d.legal_form ? `<br>${esc(d.legal_form)}` : ""}<br>${esc(c.street)}<br>${esc([c.zip, c.city].filter(Boolean).join(" "))}<br>Deutschland</p>`);
  if (d.owner_name) rows.push(`<p>Vertreten durch: ${esc(d.owner_name)}</p>`);
  rows.push(
    `<h2>Kontakt</h2><p>${c.phone ? `Telefon: ${esc(c.phone)}<br>` : ""}${c.email ? `E-Mail: <a href="mailto:${esc(c.email)}">${esc(c.email)}</a>` : ""}</p>`
  );
  if (d.register_court || d.register_number) {
    rows.push(`<h2>Registereintrag</h2><p>${d.register_court ? `Registergericht: ${esc(d.register_court)}<br>` : ""}${d.register_number ? `Registernummer: ${esc(d.register_number)}` : ""}</p>`);
  }
  if (c.vat_id) rows.push(`<h2>Umsatzsteuer-ID</h2><p>Umsatzsteuer-Identifikationsnummer gemäß § 27a Umsatzsteuergesetz: ${esc(c.vat_id)}</p>`);
  if (d.chamber || d.job_title) {
    rows.push(
      `<h2>Angaben für Handwerksbetriebe</h2><p>${d.job_title ? `Berufsbezeichnung: ${esc(d.job_title)} (verliehen in ${esc(d.job_title_country || "Deutschland")})<br>` : ""}${
        d.chamber ? `Zuständige Kammer: ${esc(d.chamber)}<br>` : ""
      }Berufsrechtliche Regelungen: Gesetz zur Ordnung des Handwerks (Handwerksordnung), einsehbar unter <a href="https://www.gesetze-im-internet.de/hwo/" rel="noopener">www.gesetze-im-internet.de/hwo</a></p>`
    );
  }
  rows.push(
    `<h2>Verbraucherstreitbeilegung</h2><p>Wir sind nicht bereit oder verpflichtet, an Streitbeilegungsverfahren vor einer Verbraucherschlichtungsstelle teilzunehmen.</p>`
  );
  return page(
    d,
    { ...ctx, canonical: `${ctx.canonical.replace(/\/$/, "")}/impressum` },
    `Impressum – ${c.name ?? ""}`,
    `Impressum von ${c.name ?? ""}`,
    `<div class="wrap legal"><h1>Impressum</h1><p>Angaben gemäß § 5 Digitale-Dienste-Gesetz (DDG)</p>${rows.join("")}</div>`,
    { home: false, index: false }
  );
}

export function renderPrivacy(d: SiteData, ctx: Ctx): string {
  const c = d.company;
  const contact = `${esc(c.name)}, ${esc(c.street)}, ${esc([c.zip, c.city].filter(Boolean).join(" "))}${c.email ? `, E-Mail: ${esc(c.email)}` : ""}${c.phone ? `, Telefon: ${esc(c.phone)}` : ""}`;
  const body = `<div class="wrap legal"><h1>Datenschutzerklärung</h1>
<h2>1. Verantwortlicher</h2><p>${contact}</p>
<h2>2. Allgemeines</h2><p>Wir verarbeiten personenbezogene Daten nur, soweit dies zur Bereitstellung dieser Website und zur Bearbeitung Ihrer Anfragen erforderlich ist. Diese Website verwendet keine Cookies, keine Analyse- oder Tracking-Werkzeuge und lädt keine Schriften oder Inhalte von Drittanbietern.</p>
<h2>3. Hosting und Server-Protokolle</h2><p>Die Website wird über die Software „Maler-SaaS“ bereitgestellt und bei Vercel Inc. (USA) gehostet; die Inhalte werden bei Supabase gespeichert. Beim Aufruf werden technisch notwendige Daten (z. B. IP-Adresse, Datum und Uhrzeit, aufgerufene Seite, Browsertyp) kurzzeitig in Server-Protokollen verarbeitet, um die Website sicher und stabil auszuliefern. Rechtsgrundlage ist Art. 6 Abs. 1 lit. f DSGVO (berechtigtes Interesse an einem sicheren Betrieb). Mit den Dienstleistern bestehen Verträge zur Auftragsverarbeitung; Übermittlungen in die USA erfolgen auf Grundlage des EU-US Data Privacy Framework bzw. von Standardvertragsklauseln.</p>
${
  d.contact_form !== false
    ? `<h2>4. Kontaktformular, E-Mail und Telefon</h2><p>Wenn Sie uns über das Kontaktformular, per E-Mail oder telefonisch kontaktieren, verarbeiten wir Ihre Angaben (Name, Kontaktdaten, Anliegen) zur Bearbeitung Ihrer Anfrage und für mögliche Anschlussfragen. Rechtsgrundlage ist Art. 6 Abs. 1 lit. b DSGVO (Anbahnung eines Vertrags) bzw. lit. f DSGVO. Die Daten werden gelöscht, sobald sie nicht mehr erforderlich sind und keine gesetzlichen Aufbewahrungspflichten bestehen.</p>`
    : ""
}
<h2>${d.contact_form !== false ? "5" : "4"}. Bilder von Projekten</h2><p>Bilder von Kundenprojekten veröffentlichen wir nur mit Einwilligung der jeweiligen Auftraggeber und ohne Angabe der genauen Anschrift.</p>
<h2>${d.contact_form !== false ? "6" : "5"}. Ihre Rechte</h2><p>Sie haben das Recht auf Auskunft (Art. 15 DSGVO), Berichtigung (Art. 16), Löschung (Art. 17), Einschränkung der Verarbeitung (Art. 18), Datenübertragbarkeit (Art. 20) und Widerspruch gegen die Verarbeitung (Art. 21 DSGVO). Außerdem können Sie sich bei einer Datenschutz-Aufsichtsbehörde beschweren. Wenden Sie sich für Ihre Anliegen einfach an die oben genannten Kontaktdaten.</p>
${d.privacy_extra ? `<h2>Ergänzende Hinweise</h2>${paragraphs(d.privacy_extra)}` : ""}
</div>`;
  return page(d, { ...ctx, canonical: `${ctx.canonical.replace(/\/$/, "")}/datenschutz` }, `Datenschutz – ${c.name ?? ""}`, `Datenschutzerklärung von ${c.name ?? ""}`, body, {
    home: false,
    index: false,
  });
}

function notFound(origin: string): Response {
  const html = `<!doctype html><html lang="de"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><meta name="robots" content="noindex"><title>Seite nicht gefunden</title>
<style>body{font-family:system-ui,sans-serif;display:grid;place-items:center;min-height:90vh;margin:0;color:#1c2430;text-align:center;padding:20px}</style></head>
<body><div><h1>Diese Seite gibt es nicht (mehr).</h1><p><a href="${esc(origin)}/">Zur Startseite von Maler-SaaS</a></p></div></body></html>`;
  return new Response(html, { status: 404, headers: { "content-type": "text/html; charset=utf-8", "cache-control": "public, s-maxage=60" } });
}

// ---------------------------------------------------------------------
// Datenbank
// ---------------------------------------------------------------------
// eslint-disable-next-line @typescript-eslint/no-explicit-any -- Antwort der Datenbank-Funktion
async function rpc(fn: string, args: Record<string, unknown>): Promise<any> {
  const res = await fetch(`${SUPABASE_URL}/rest/v1/rpc/${fn}`, {
    method: "POST",
    headers: { apikey: SUPABASE_ANON_KEY, authorization: `Bearer ${SUPABASE_ANON_KEY}`, "content-type": "application/json" },
    body: JSON.stringify(args),
  });
  if (!res.ok) throw new Error(`rpc ${fn} → ${res.status}`);
  return res.json();
}

async function sendLeadMail(to: string, company: string, lead: Record<string, string>, siteUrl: string) {
  const key = env("BREVO_API_KEY");
  const sender = env("BREVO_SENDER_EMAIL");
  if (!key || !sender || !to) return;
  const html = `<p>Neue Anfrage über Ihre Website:</p>
<p><strong>${esc(lead.name)}</strong><br>${lead.phone ? `Telefon: ${esc(lead.phone)}<br>` : ""}${lead.email ? `E-Mail: ${esc(lead.email)}` : ""}</p>
<p>${esc(lead.message).replace(/\n/g, "<br>")}</p>
<p>Alle Anfragen finden Sie in Maler-SaaS unter <em>Website → Anfragen</em>.</p><p style="color:#888">${esc(siteUrl)}</p>`;
  await fetch("https://api.brevo.com/v3/smtp/email", {
    method: "POST",
    headers: { "api-key": key, "content-type": "application/json", accept: "application/json" },
    body: JSON.stringify({
      sender: { email: sender, name: "Maler-SaaS Website" },
      to: [{ email: to, name: company || undefined }],
      replyTo: lead.email ? { email: lead.email, name: lead.name } : undefined,
      subject: `Neue Website-Anfrage von ${lead.name}`,
      htmlContent: html,
    }),
  }).catch(() => undefined);
}

// ---------------------------------------------------------------------
// Einstieg
// ---------------------------------------------------------------------
const HTML_HEADERS = { "content-type": "text/html; charset=utf-8", "x-content-type-options": "nosniff", "referrer-policy": "strict-origin-when-cross-origin" };

export async function handle(request: Request): Promise<Response> {
  const url = new URL(request.url);
  const origin = env("SITE_ORIGIN") || "https://maler-saas.com";
  const slug = (url.searchParams.get("slug") || "").toLowerCase();
  if (!/^[a-z0-9][a-z0-9-]{1,48}[a-z0-9]$/.test(slug)) return notFound(origin);
  const base = `/w/${slug}`;

  // Kontaktformular
  if (request.method === "POST" && url.searchParams.get("action") === "contact") {
    const back = (q: string) => new Response(null, { status: 303, headers: { location: `${base}/?${q}#kontakt` } });
    const form = await request.formData().catch(() => null);
    if (!form) return back("fehler=formular");
    const get = (k: string) => String(form.get(k) ?? "").trim();
    const started = Number(get("t"));
    // Spam-Schutz: verstecktes Feld ausgefüllt oder Formular in < 3 Sekunden abgeschickt -> still verwerfen
    if (get("website") || !started || Date.now() - started < 3000) return back("gesendet=1");
    const lead = { name: get("name"), email: get("email"), phone: get("phone"), message: get("message") };
    try {
      const r = await rpc("website_submit_lead", { p_slug: slug, p_name: lead.name, p_email: lead.email, p_phone: lead.phone, p_message: lead.message });
      if (!r?.ok) {
        const err = r?.error === "invalid_email" ? "email" : r?.error === "rate_limited" ? "spaeter" : "angaben";
        return back(`fehler=${err}`);
      }
      await sendLeadMail(r.notify_email, r.company, lead, `${origin}${base}`);
      return back("gesendet=1");
    } catch {
      return back("fehler=server");
    }
  }
  if (request.method !== "GET" && request.method !== "HEAD") return new Response("Method not allowed", { status: 405 });

  const preview = url.searchParams.get("vorschau") || "";
  let data: SiteData | null = null;
  try {
    data = await rpc("website_public", { p_slug: slug, p_preview: preview || null });
  } catch {
    return new Response("Die Seite ist vorübergehend nicht erreichbar.", { status: 503, headers: { "content-type": "text/plain; charset=utf-8" } });
  }
  if (!data) return notFound(origin);

  const isPreview = !data.published;
  const pagePath = (url.searchParams.get("page") || "").replace(/^\/+|\/+$/g, "").toLowerCase();
  const errors: Record<string, string> = {
    email: "Bitte prüfen Sie Ihre E-Mail-Adresse.",
    spaeter: "Gerade gehen sehr viele Anfragen ein. Bitte versuchen Sie es später noch einmal oder rufen Sie uns an.",
    angaben: "Bitte geben Sie Ihren Namen, Ihr Anliegen und Telefon oder E-Mail an.",
    formular: "Das Formular konnte nicht gelesen werden. Bitte erneut versuchen.",
    server: "Die Anfrage konnte gerade nicht gesendet werden. Bitte rufen Sie uns an.",
  };
  const ctx: Ctx = {
    base,
    origin,
    canonical: `${origin}${base}/`,
    preview: isPreview,
    q: isPreview ? `?vorschau=${encodeURIComponent(preview)}` : "",
    notice: url.searchParams.get("gesendet") ? "ok" : errors[url.searchParams.get("fehler") || ""] || undefined,
  };
  const cache = isPreview ? "private, no-store" : "public, s-maxage=120, stale-while-revalidate=600";

  if (pagePath === "robots.txt") {
    return new Response(`User-agent: *\nAllow: /\nSitemap: ${origin}${base}/sitemap.xml\n`, { headers: { "content-type": "text/plain; charset=utf-8", "cache-control": cache } });
  }
  if (pagePath === "sitemap.xml") {
    const xml = `<?xml version="1.0" encoding="UTF-8"?>\n<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9"><url><loc>${esc(ctx.canonical)}</loc></url></urlset>`;
    return new Response(xml, { headers: { "content-type": "application/xml; charset=utf-8", "cache-control": cache } });
  }

  let html: string;
  if (pagePath === "" || pagePath === "index.html") html = renderHome(data, ctx);
  else if (pagePath === "impressum") html = renderImprint(data, ctx);
  else if (pagePath === "datenschutz") html = renderPrivacy(data, ctx);
  else return notFound(origin);

  const headers = { ...HTML_HEADERS, "cache-control": cache };
  return new Response(request.method === "HEAD" ? null : html, { status: 200, headers });
}

export default {
  fetch(request: Request) {
    return handle(request);
  },
};
