// =====================================================================
// Ratgeber-Artikel auf maler-saas.com (SEO-Agent im Owner-Bereich)
//
//   https://maler-saas.com/ratgeber                 Übersicht
//   https://maler-saas.com/ratgeber/<slug>          Artikel
//   https://maler-saas.com/ratgeber/sitemap.xml     Sitemap für Google
// (Rewrites in vercel.json). Fertiges HTML vom Server – gut für Google,
// ohne Cookies, Tracker oder externe Schriften. Nur veröffentlichte Artikel
// (Datenbank-Funktionen ratgeber_list / ratgeber_get).
// =====================================================================

const SUPABASE_URL = "https://udzgxfjmpeygylgrcdsc.supabase.co";
const SUPABASE_ANON_KEY = "sb_publishable_N23R8SIVVw7_qmH3w-JPrw_w9YBpgyH";
const ORIGIN = "https://maler-saas.com";

type Faq = { q?: string; a?: string };
type Article = {
  slug: string;
  title: string;
  meta_title?: string;
  meta_description?: string;
  intro?: string;
  body?: string;
  faq?: Faq[];
  related_pages?: string[];
  published_at?: string | null;
  updated_at?: string | null;
  image_public?: string | null;
  image_alt?: string | null;
  image_ai_label?: boolean;
};
type ListItem = { slug: string; title: string; intro?: string; published_at?: string | null; updated_at?: string | null; image_public?: string | null; image_alt?: string | null };

/** öffentliche Adresse eines Ratgeber-Bilds */
export const imageUrl = (path?: string | null) => (path && /^[a-z0-9/_.-]{1,200}$/i.test(path) ? `${SUPABASE_URL}/storage/v1/object/public/ratgeber/${path}` : "");

const PAGES: Record<string, string> = {
  "maler-software": "Software für Malerbetriebe",
  "aufmass-angebote": "Aufmaß & Angebote",
  auftragsverwaltung: "Auftragsverwaltung",
  zeiterfassung: "Zeiterfassung",
  materialverwaltung: "Materialverwaltung",
  rechnungen: "Rechnungen & E-Rechnung",
  kundenportal: "Kundenportal",
  leistungsbewertung: "Leistungsbewertung",
  fachkraefte: "Fachkräfte-Pool",
  buchhaltung: "Buchhaltung",
  "ki-telefon": "KI-Telefon",
  "firmen-website": "Firmen-Website",
  auswertungen: "Auswertungen",
  "werbung-mit-ki": "Werbung mit KI",
};

export function esc(v: unknown): string {
  return String(v ?? "")
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#39;");
}

/** Inline: **fett** und interne Links [Text](/pfad) – alles andere bleibt Text */
function inline(text: string): string {
  let s = esc(text);
  s = s.replace(/\*\*([^*]{1,200})\*\*/g, "<strong>$1</strong>");
  s = s.replace(/\[([^\]]{1,120})\]\((\/[a-z0-9/-]{0,120})\)/gi, (_m, t, href) => `<a href="${href}">${t}</a>`);
  return s;
}

/** Einfaches Markdown (## / ### / - / Absätze) → HTML */
export function mdToHtml(md: string): string {
  const out: string[] = [];
  let para: string[] = [];
  let list: string[] = [];
  const flushPara = () => {
    if (para.length) out.push(`<p>${inline(para.join(" "))}</p>`);
    para = [];
  };
  const flushList = () => {
    if (list.length) out.push(`<ul>${list.map((li) => `<li>${inline(li)}</li>`).join("")}</ul>`);
    list = [];
  };
  for (const raw of String(md ?? "").split(/\r?\n/)) {
    const line = raw.trim();
    if (!line) {
      flushPara();
      flushList();
      continue;
    }
    const h = /^(#{2,3})\s+(.*)$/.exec(line);
    if (h) {
      flushPara();
      flushList();
      out.push(h[1].length === 2 ? `<h2>${inline(h[2])}</h2>` : `<h3>${inline(h[2])}</h3>`);
      continue;
    }
    const li = /^[-*]\s+(.*)$/.exec(line) ?? /^\d+[.)]\s+(.*)$/.exec(line);
    if (li) {
      flushPara();
      list.push(li[1]);
      continue;
    }
    if (/^#\s+/.test(line)) continue; // eine zweite H1 nicht zulassen
    flushList();
    para.push(line);
  }
  flushPara();
  flushList();
  return out.join("\n");
}

const deDate = (iso?: string | null) => (iso ? new Date(iso).toLocaleDateString("de-DE", { day: "numeric", month: "long", year: "numeric" }) : "");
const jsonLd = (o: unknown) => `<script type="application/ld+json">${JSON.stringify(o).replace(/</g, "\\u003c")}</script>`;
const cta = (slug: string) => `/?utm_source=ratgeber&utm_medium=seo&utm_campaign=${encodeURIComponent(slug || "ratgeber")}`;

const CSS = `
*{box-sizing:border-box}body{margin:0;font-family:"Inter","Segoe UI",system-ui,-apple-system,Arial,sans-serif;color:#0f172a;background:#f8fafc;line-height:1.65}
a{color:#1d4ed8}header{background:#0f172a;color:#fff}.wrap{max-width:820px;margin:0 auto;padding:0 18px}
.top{display:flex;align-items:center;justify-content:space-between;gap:12px;padding:14px 0}.brand{display:flex;align-items:center;gap:10px;color:#fff;text-decoration:none;font-weight:800;font-size:20px}
.brand img{width:34px;height:34px;border-radius:8px;background:#fff;padding:3px}.top nav{display:flex;gap:14px;align-items:center;flex-wrap:wrap}
.top nav a{color:#cbd5e1;text-decoration:none;font-weight:600;font-size:15px}.btn{display:inline-block;background:#2563eb;color:#fff!important;text-decoration:none;font-weight:800;border-radius:12px;padding:11px 18px}
main{padding:28px 0 40px}.crumbs{font-size:13px;color:#64748b;margin-bottom:10px}.crumbs a{color:#64748b}
h1{font-size:clamp(28px,5vw,40px);line-height:1.2;margin:0 0 10px}.meta{color:#64748b;font-size:14px;margin-bottom:18px}
.intro{font-size:19px;color:#334155;margin:0 0 24px}article{background:#fff;border:1px solid #e2e8f0;border-radius:18px;padding:clamp(18px,4vw,36px)}
article h2{font-size:24px;line-height:1.3;margin:32px 0 10px}article h3{font-size:19px;margin:22px 0 8px}article p{margin:0 0 14px}article ul{margin:0 0 16px;padding-left:22px}article li{margin:4px 0}
.box{background:linear-gradient(135deg,#1d4ed8,#0f172a);color:#fff;border-radius:18px;padding:22px 24px;margin:30px 0}.box h2{color:#fff;margin:0 0 6px;font-size:22px}.box p{color:#dbeafe;margin:0 0 14px}
.box .btn{background:#facc15;color:#0f172a!important}.faq details{border:1px solid #e2e8f0;border-radius:12px;padding:12px 14px;margin:8px 0;background:#fff}.faq summary{font-weight:700;cursor:pointer}
.related{display:flex;flex-wrap:wrap;gap:8px;margin:14px 0}.related a{border:1px solid #bfdbfe;background:#eff6ff;border-radius:999px;padding:6px 12px;text-decoration:none;font-weight:600;font-size:14px}
.list{display:grid;gap:12px}.card{display:block;background:#fff;border:1px solid #e2e8f0;border-radius:16px;padding:18px 20px;text-decoration:none;color:inherit}.card:hover{border-color:#93c5fd}
.card h2{font-size:20px;margin:0 0 6px;color:#0f172a}.card p{margin:0;color:#475569}.card small{color:#64748b}
footer{border-top:1px solid #e2e8f0;padding:22px 0 30px;color:#64748b;font-size:14px}footer .wrap{display:flex;gap:16px;flex-wrap:wrap;justify-content:space-between}footer a{color:#64748b}
.note{font-size:13px;color:#64748b;margin-top:22px}
figure.hero{margin:0 0 22px}figure.hero img{width:100%;height:auto;aspect-ratio:16/9;object-fit:cover;border-radius:14px;display:block;background:#e2e8f0}
figure.hero figcaption{font-size:12px;color:#94a3b8;margin-top:6px}
.card{display:grid;grid-template-columns:1fr;gap:14px}.card.has-img{grid-template-columns:180px 1fr;align-items:start}
.card img{width:100%;height:auto;aspect-ratio:4/3;object-fit:cover;border-radius:10px;display:block;background:#e2e8f0}
@media(max-width:560px){.card.has-img{grid-template-columns:1fr}}
`;

function page(o: { title: string; description: string; canonical: string; body: string; ld?: string; noindex?: boolean; image?: string }): string {
  return `<!doctype html>
<html lang="de">
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width,initial-scale=1">
<title>${esc(o.title)}</title>
<meta name="description" content="${esc(o.description)}">
<link rel="canonical" href="${esc(o.canonical)}">
${o.noindex ? '<meta name="robots" content="noindex">' : ""}
<meta property="og:type" content="article">
<meta property="og:title" content="${esc(o.title)}">
<meta property="og:description" content="${esc(o.description)}">
<meta property="og:url" content="${esc(o.canonical)}">
<meta property="og:image" content="${esc(o.image || `${ORIGIN}/images/maler-saas-landing-collage.png`)}">
<link rel="icon" href="/favicon.png">
<style>${CSS}</style>
${o.ld ?? ""}
</head>
<body>
<header><div class="wrap top">
<a class="brand" href="/"><img src="/images/logo.png" alt="" width="34" height="34">MalerSaaS</a>
<nav><a href="/ratgeber">Ratgeber</a><a href="/maler-software">Funktionen</a><a class="btn" href="${cta("kopf")}">14 Tage kostenlos testen</a></nav>
</div></header>
<main><div class="wrap">
${o.body}
</div></main>
<footer><div class="wrap"><span>© ${new Date().getFullYear()} MalerSaaS – Software für Malerbetriebe</span>
<span><a href="/impressum">Impressum</a> · <a href="/datenschutz">Datenschutz</a> · <a href="/agb">AGB</a></span></div></footer>
</body>
</html>`;
}

async function rpc(fn: string, args: Record<string, unknown>): Promise<unknown> {
  const res = await fetch(`${SUPABASE_URL}/rest/v1/rpc/${fn}`, {
    method: "POST",
    headers: { apikey: SUPABASE_ANON_KEY, authorization: `Bearer ${SUPABASE_ANON_KEY}`, "content-type": "application/json" },
    body: JSON.stringify(args),
  });
  if (!res.ok) throw new Error(`rpc ${fn} ${res.status}`);
  return res.json();
}

const HEADERS = { "content-type": "text/html; charset=utf-8", "x-content-type-options": "nosniff", "referrer-policy": "strict-origin-when-cross-origin" };
const CACHE = "public, s-maxage=300, stale-while-revalidate=86400";

export function renderArticle(a: Article): string {
  const url = `${ORIGIN}/ratgeber/${a.slug}`;
  const faq = (a.faq ?? []).filter((f) => f.q && f.a);
  const related = (a.related_pages ?? []).filter((p) => p in PAGES);
  const img = imageUrl(a.image_public);
  const ld =
    jsonLd({
      "@context": "https://schema.org",
      "@type": "Article",
      headline: a.title,
      description: a.meta_description || a.intro,
      datePublished: a.published_at,
      dateModified: a.updated_at || a.published_at,
      mainEntityOfPage: url,
      ...(img ? { image: [img] } : {}),
      author: { "@type": "Organization", name: "MalerSaaS", url: ORIGIN },
      publisher: { "@type": "Organization", name: "MalerSaaS", logo: { "@type": "ImageObject", url: `${ORIGIN}/images/logo.png` } },
    }) +
    jsonLd({
      "@context": "https://schema.org",
      "@type": "BreadcrumbList",
      itemListElement: [
        { "@type": "ListItem", position: 1, name: "MalerSaaS", item: ORIGIN },
        { "@type": "ListItem", position: 2, name: "Ratgeber", item: `${ORIGIN}/ratgeber` },
        { "@type": "ListItem", position: 3, name: a.title, item: url },
      ],
    }) +
    (faq.length ? jsonLd({ "@context": "https://schema.org", "@type": "FAQPage", mainEntity: faq.map((f) => ({ "@type": "Question", name: f.q, acceptedAnswer: { "@type": "Answer", text: f.a } })) }) : "");
  const body = `
<div class="crumbs"><a href="/">MalerSaaS</a> › <a href="/ratgeber">Ratgeber</a></div>
<article>
<h1>${esc(a.title)}</h1>
<div class="meta">${a.published_at ? `Veröffentlicht am ${esc(deDate(a.published_at))}` : ""}${a.updated_at && a.published_at && a.updated_at.slice(0, 10) > a.published_at.slice(0, 10) ? ` · aktualisiert am ${esc(deDate(a.updated_at))}` : ""}</div>
${img ? `<figure class="hero"><img src="${esc(img)}" alt="${esc(a.image_alt || a.title)}" width="1600" height="900" fetchpriority="high">${a.image_ai_label ? "<figcaption>Symbolbild (KI-generiert)</figcaption>" : ""}</figure>` : ""}
${a.intro ? `<p class="intro">${inline(a.intro)}</p>` : ""}
${mdToHtml(a.body ?? "")}
<div class="box"><h2>MalerSaaS 14 Tage kostenlos testen</h2><p>Aufmaß, Angebote, Aufträge, Zeiterfassung und Rechnungen an einem Ort – speziell für Malerbetriebe. Die Testphase endet automatisch.</p><a class="btn" href="${cta(a.slug)}">Jetzt kostenlos testen</a></div>
${faq.length ? `<section class="faq"><h2>Häufige Fragen</h2>${faq.map((f) => `<details><summary>${esc(f.q)}</summary><p>${inline(f.a ?? "")}</p></details>`).join("")}</section>` : ""}
${related.length ? `<h2>Passende Funktionen</h2><div class="related">${related.map((p) => `<a href="/${p}">${esc(PAGES[p])}</a>`).join("")}</div>` : ""}
<p class="note">Hinweis: Dieser Ratgeber gibt allgemeine Informationen und ersetzt keine Rechts- oder Steuerberatung im Einzelfall.</p>
</article>`;
  return page({ title: `${a.meta_title || a.title} | MalerSaaS`, description: a.meta_description || a.intro || a.title, canonical: url, body, ld, image: img });
}

export function renderList(items: ListItem[]): string {
  const body = `
<div class="crumbs"><a href="/">MalerSaaS</a> › Ratgeber</div>
<h1>Ratgeber für Malerbetriebe</h1>
<p class="intro">Praxiswissen für Inhaber und Meister: Angebote, Aufmaß, Zeiterfassung, Rechnungen, Organisation im Büro und auf der Baustelle.</p>
<div class="list">
${
    items.length
      ? items
          .map((i) => {
            const im = imageUrl(i.image_public);
            return `<a class="card${im ? " has-img" : ""}" href="/ratgeber/${esc(i.slug)}">${im ? `<img src="${esc(im)}" alt="${esc(i.image_alt || i.title)}" loading="lazy" width="360" height="270">` : ""}<div><h2>${esc(i.title)}</h2>${i.intro ? `<p>${esc(i.intro.slice(0, 220))}${i.intro.length > 220 ? "…" : ""}</p>` : ""}${i.published_at ? `<small>${esc(deDate(i.published_at))}</small>` : ""}</div></a>`;
          })
          .join("\n")
      : "<p>Die ersten Artikel erscheinen in Kürze.</p>"
  }
</div>`;
  return page({ title: "Ratgeber für Malerbetriebe | MalerSaaS", description: "Praxiswissen für Malerbetriebe: Angebote, Aufmaß, Zeiterfassung, Rechnungen und Organisation – verständlich erklärt.", canonical: `${ORIGIN}/ratgeber`, body });
}

export function renderSitemap(items: ListItem[]): string {
  const urls = [`<url><loc>${ORIGIN}/ratgeber</loc></url>`, ...items.map((i) => `<url><loc>${ORIGIN}/ratgeber/${esc(i.slug)}</loc>${i.updated_at || i.published_at ? `<lastmod>${esc(String(i.updated_at || i.published_at).slice(0, 10))}</lastmod>` : ""}</url>`)];
  return `<?xml version="1.0" encoding="UTF-8"?>\n<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">\n${urls.join("\n")}\n</urlset>\n`;
}

export async function handle(request: Request): Promise<Response> {
  if (request.method !== "GET" && request.method !== "HEAD") return new Response("Method not allowed", { status: 405 });
  const url = new URL(request.url);
  const slug = (url.searchParams.get("slug") || "").toLowerCase().replace(/\/+$/, "");
  try {
    if (slug === "sitemap.xml") {
      const items = ((await rpc("ratgeber_list", {})) as ListItem[]) ?? [];
      return new Response(renderSitemap(items), { headers: { "content-type": "application/xml; charset=utf-8", "cache-control": CACHE } });
    }
    if (!slug) {
      const items = ((await rpc("ratgeber_list", {})) as ListItem[]) ?? [];
      return new Response(request.method === "HEAD" ? null : renderList(items), { headers: { ...HEADERS, "cache-control": CACHE } });
    }
    if (!/^[a-z0-9-]{1,80}$/.test(slug)) throw Object.assign(new Error("404"), { notFound: true });
    const a = (await rpc("ratgeber_get", { p_slug: slug })) as Article | null;
    if (!a) throw Object.assign(new Error("404"), { notFound: true });
    return new Response(request.method === "HEAD" ? null : renderArticle(a), { headers: { ...HEADERS, "cache-control": CACHE } });
  } catch (e) {
    const nf = (e as { notFound?: boolean }).notFound;
    const html = page({
      title: nf ? "Artikel nicht gefunden | MalerSaaS" : "Vorübergehend nicht erreichbar | MalerSaaS",
      description: "MalerSaaS Ratgeber",
      canonical: `${ORIGIN}/ratgeber`,
      noindex: true,
      body: `<h1>${nf ? "Artikel nicht gefunden" : "Vorübergehend nicht erreichbar"}</h1><p><a href="/ratgeber">Zur Ratgeber-Übersicht</a></p>`,
    });
    return new Response(html, { status: nf ? 404 : 503, headers: { ...HEADERS, "cache-control": "public, s-maxage=60" } });
  }
}

export default {
  fetch(request: Request) {
    return handle(request);
  },
};
