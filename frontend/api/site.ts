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

export type Faq = { q?: string; a?: string };
export type Service = {
  title?: string;
  text?: string;
  icon?: string;
  details?: string;
  included?: string[];
  faq?: Faq[];
  image?: string;
  aliases?: string[];
};
export type RefImage = { url?: string; alt?: string };
export type Reference = { id: number; title: string; text?: string | null; city?: string | null; images?: RefImage[]; published_at?: string };
export type ReviewItem = { rating: number; text?: string | null; name?: string | null; city?: string | null; date?: string | null };
export type Reviews = { count: number; average: number | string | null; items: ReviewItem[] };
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
  custom_domain?: string | null;
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
  reviews?: Reviews;
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

/**
 * E-Mail-Adresse als HTML-Zeichencodes ausgeben (Schutz vor Spam-Sammlern).
 * Browser zeigen sie normal an und der Link funktioniert, im Quelltext steht aber keine lesbare Adresse.
 */
export function encodeEmail(email: unknown): string {
  return Array.from(String(email ?? "").trim())
    .map((ch) => `&#${ch.codePointAt(0)};`)
    .join("");
}

function emailLink(email: unknown): string {
  const enc = encodeEmail(email);
  return `<a href="${encodeEmail("mailto:")}${enc}">${enc}</a>`;
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

const SECTION_DEFAULTS = { services: true, service_photos: false, process: true, references: true, reviews: true, about: true, area: true, contact: true };

/** Symbole für Leistungen (aus Lucide, ISC-Lizenz), als SVG-Innenleben */
export const SERVICE_ICONS: Record<string, string> = {
  rolle: "<rect width=\"16\" height=\"6\" x=\"2\" y=\"2\" rx=\"2\"></rect><path d=\"M10 16v-2a2 2 0 0 1 2-2h8a2 2 0 0 0 2-2V7a2 2 0 0 0-2-2h-2\"></path><rect width=\"4\" height=\"6\" x=\"8\" y=\"16\" rx=\"1\"></rect>",
  pinsel: "<path d=\"m14.622 17.897-10.68-2.913\"></path><path d=\"M18.376 2.622a1 1 0 1 1 3.002 3.002L17.36 9.643a.5.5 0 0 0 0 .707l.944.944a2.41 2.41 0 0 1 0 3.408l-.944.944a.5.5 0 0 1-.707 0L8.354 7.348a.5.5 0 0 1 0-.707l.944-.944a2.41 2.41 0 0 1 3.408 0l.944.944a.5.5 0 0 0 .707 0z\"></path><path d=\"M9 8c-1.804 2.71-3.97 3.46-6.583 3.948a.507.507 0 0 0-.302.819l7.32 8.883a1 1 0 0 0 1.185.204C12.735 20.405 16 16.792 16 15\"></path>",
  haus: "<path d=\"M15 21v-8a1 1 0 0 0-1-1h-4a1 1 0 0 0-1 1v8\"></path><path d=\"M3 10a2 2 0 0 1 .709-1.528l7-6a2 2 0 0 1 2.582 0l7 6A2 2 0 0 1 21 10v9a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2z\"></path>",
  tapete: "<path d=\"M19 17V5a2 2 0 0 0-2-2H4\"></path><path d=\"M8 21h12a2 2 0 0 0 2-2v-1a1 1 0 0 0-1-1H11a1 1 0 0 0-1 1v1a2 2 0 1 1-4 0V5a2 2 0 1 0-4 0v2a1 1 0 0 0 1 1h3\"></path>",
  spachtel: "<path d=\"M12.83 2.18a2 2 0 0 0-1.66 0L2.6 6.08a1 1 0 0 0 0 1.83l8.58 3.91a2 2 0 0 0 1.66 0l8.58-3.9a1 1 0 0 0 0-1.83z\"></path><path d=\"M2 12a1 1 0 0 0 .58.91l8.6 3.91a2 2 0 0 0 1.65 0l8.58-3.9A1 1 0 0 0 22 12\"></path><path d=\"M2 17a1 1 0 0 0 .58.91l8.6 3.91a2 2 0 0 0 1.65 0l8.58-3.9A1 1 0 0 0 22 17\"></path>",
  boden: "<path d=\"M12 3v18\"></path><path d=\"M3 12h18\"></path><rect x=\"3\" y=\"3\" width=\"18\" height=\"18\" rx=\"2\"></rect>",
  tuer: "<path d=\"M11 20H2\"></path><path d=\"M11 4.562v16.157a1 1 0 0 0 1.242.97L19 20V5.562a2 2 0 0 0-1.515-1.94l-4-1A2 2 0 0 0 11 4.561z\"></path><path d=\"M11 4H8a2 2 0 0 0-2 2v14\"></path><path d=\"M14 12h.01\"></path><path d=\"M22 20h-3\"></path>",
  schutz: "<path d=\"M20 13c0 5-3.5 7.5-7.66 8.95a1 1 0 0 1-.67-.01C7.5 20.5 4 18 4 13V6a1 1 0 0 1 1-1c2 0 4.5-1.2 6.24-2.72a1.17 1.17 0 0 1 1.52 0C14.51 3.81 17 5 19 5a1 1 0 0 1 1 1z\"></path><path d=\"m9 12 2 2 4-4\"></path>",
  daemmung: "<path d=\"M12 2v2\"></path><path d=\"M12 8a4 4 0 0 0-1.645 7.647\"></path><path d=\"M2 12h2\"></path><path d=\"M20 14.54a4 4 0 1 1-4 0V4a2 2 0 0 1 4 0z\"></path><path d=\"m4.93 4.93 1.41 1.41\"></path><path d=\"m6.34 17.66-1.41 1.41\"></path>",
  mauer: "<rect width=\"18\" height=\"18\" x=\"3\" y=\"3\" rx=\"2\"></rect><path d=\"M12 9v6\"></path><path d=\"M16 15v6\"></path><path d=\"M16 3v6\"></path><path d=\"M3 15h18\"></path><path d=\"M3 9h18\"></path><path d=\"M8 15v6\"></path><path d=\"M8 3v6\"></path>",
  spray: "<path d=\"M3 3h.01\"></path><path d=\"M7 5h.01\"></path><path d=\"M11 7h.01\"></path><path d=\"M3 7h.01\"></path><path d=\"M7 9h.01\"></path><path d=\"M3 11h.01\"></path><rect width=\"4\" height=\"4\" x=\"15\" y=\"5\"></rect><path d=\"m19 9 2 2v10c0 .6-.4 1-1 1h-6c-.6 0-1-.4-1-1V11l2-2\"></path><path d=\"m13 14 8-2\"></path><path d=\"m13 19 8-2\"></path>",
  palette: "<path d=\"M12 22a1 1 0 0 1 0-20 10 9 0 0 1 10 9 5 5 0 0 1-5 5h-2.25a1.75 1.75 0 0 0-1.4 2.8l.3.4a1.75 1.75 0 0 1-1.4 2.8z\"></path><circle cx=\"13.5\" cy=\"6.5\" r=\".5\" fill=\"currentColor\"></circle><circle cx=\"17.5\" cy=\"10.5\" r=\".5\" fill=\"currentColor\"></circle><circle cx=\"6.5\" cy=\"12.5\" r=\".5\" fill=\"currentColor\"></circle><circle cx=\"8.5\" cy=\"7.5\" r=\".5\" fill=\"currentColor\"></circle>",
  gewerbe: "<path d=\"M10 12h4\"></path><path d=\"M10 8h4\"></path><path d=\"M14 21v-3a2 2 0 0 0-4 0v3\"></path><path d=\"M6 10H4a2 2 0 0 0-2 2v7a2 2 0 0 0 2 2h16a2 2 0 0 0 2-2V9a2 2 0 0 0-2-2h-2\"></path><path d=\"M6 21V5a2 2 0 0 1 2-2h8a2 2 0 0 1 2 2v16\"></path>",
  holz: "<path d=\"M4 3 2 5v15c0 .6.4 1 1 1h2c.6 0 1-.4 1-1V5Z\"></path><path d=\"M6 8h4\"></path><path d=\"M6 18h4\"></path><path d=\"m12 3-2 2v15c0 .6.4 1 1 1h2c.6 0 1-.4 1-1V5Z\"></path><path d=\"M14 8h4\"></path><path d=\"M14 18h4\"></path><path d=\"m20 3-2 2v15c0 .6.4 1 1 1h2c.6 0 1-.4 1-1V5Z\"></path>",
  wasser: "<path d=\"M7 16.3c2.2 0 4-1.83 4-4.05 0-1.16-.57-2.26-1.71-3.19S7.29 6.75 7 5.3c-.29 1.45-1.14 2.84-2.29 3.76S3 11.1 3 12.25c0 2.22 1.8 4.05 4 4.05z\"></path><path d=\"M12.56 6.6A10.97 10.97 0 0 0 14 3.02c.5 2.5 2 4.9 4 6.5s3 3.5 3 5.5a6.98 6.98 0 0 1-11.91 4.97\"></path>",
  werkzeug: "<path d=\"M14.7 6.3a1 1 0 0 0 0 1.4l1.6 1.6a1 1 0 0 0 1.4 0l3.106-3.105c.32-.322.863-.22.983.218a6 6 0 0 1-8.259 7.057l-7.91 7.91a1 1 0 0 1-2.999-3l7.91-7.91a6 6 0 0 1 7.057-8.259c.438.12.54.662.219.984z\"></path>",
  stern: "<path d=\"M11.017 2.814a1 1 0 0 1 1.966 0l1.051 5.558a2 2 0 0 0 1.594 1.594l5.558 1.051a1 1 0 0 1 0 1.966l-5.558 1.051a2 2 0 0 0-1.594 1.594l-1.051 5.558a1 1 0 0 1-1.966 0l-1.051-5.558a2 2 0 0 0-1.594-1.594l-5.558-1.051a1 1 0 0 1 0-1.966l5.558-1.051a2 2 0 0 0 1.594-1.594z\"></path><path d=\"M20 2v4\"></path><path d=\"M22 4h-4\"></path><circle cx=\"4\" cy=\"20\" r=\"2\"></circle>",
};

/** Passendes Symbol anhand des Leistungsnamens (gleiche Regeln wie im Editor: src/modules/website/types.ts) */
const ICON_RULES: [RegExp, string][] = [
  [/fassad|außen|aussen|wdvs/, "haus"],
  [/dämm|daemm|wärme|waerme/, "daemmung"],
  [/tapez|tapete/, "tapete"],
  [/spachtel|putz|trockenbau|q[1-4]\b/, "spachtel"],
  [/boden|vinyl|laminat|parkett|teppich|designbelag/, "boden"],
  [/tür|tuer|fenster/, "tuer"],
  [/lack|heizkörper|heizkoerper|treppe|pinsel/, "pinsel"],
  [/schimmel|schutz|imprägn|impraegn|beschicht/, "schutz"],
  [/mauer|klinker|stein|sandstrahl/, "mauer"],
  [/graffiti|spritz|airless|spray/, "spray"],
  [/beratung|gestalt|design|dekor|kreativ|farbkonzept|akzent/, "palette"],
  [/gewerbe|büro|buero|objekt|hotel|praxis|industrie/, "gewerbe"],
  [/holz|zaun|carport|lasur|gartenhaus/, "holz"],
  [/wasser|feucht|nässe|naesse/, "wasser"],
  [/reparatur|sanier|renovier|ausbesser/, "werkzeug"],
];
export function serviceIcon(sv: Service): string {
  if (sv.icon && SERVICE_ICONS[sv.icon]) return sv.icon;
  const t = String(sv.title ?? "").toLowerCase();
  for (const [re, key] of ICON_RULES) if (re.test(t)) return key;
  return "rolle";
}
function iconSvg(key: string): string {
  return `<svg xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">${SERVICE_ICONS[key] ?? SERVICE_ICONS.rolle}</svg>`;
}

/** Bewertungen nur zeigen, wenn es freigegebene Zitate oder mindestens 3 Bewertungen gibt */
export function reviewSummary(d: SiteData): { count: number; avg: number; items: ReviewItem[] } | null {
  const r = d.reviews;
  const count = Number(r?.count ?? 0);
  const avg = Number(r?.average ?? 0);
  const items = (r?.items ?? []).filter((i) => Number(i?.rating) >= 1 && Number(i?.rating) <= 5);
  if (!count || !(avg >= 1 && avg <= 5)) return null;
  if (items.length === 0 && count < 3) return null;
  return { count, avg, items };
}

function stars(n: number): string {
  const full = Math.round(n);
  return `<span class="stars" aria-hidden="true">${"★".repeat(full)}<span class="off">${"★".repeat(5 - full)}</span></span>`;
}

const fmtAvg = (n: number) => n.toFixed(1).replace(".", ",");

function monthYear(iso: unknown): string {
  const t = new Date(String(iso ?? ""));
  return isNaN(t.getTime()) ? "" : t.toLocaleDateString("de-DE", { month: "long", year: "numeric", timeZone: "Europe/Berlin" });
}

/**
 * Fotos im Browser verkleinern (max. 1600 px, JPEG) und als Base64 in versteckte Felder legen.
 * Dabei gehen Standortdaten (EXIF/GPS) verloren. Ohne JavaScript wird das Formular ohne Fotos gesendet.
 */
const FORM_SCRIPT = `(function(){var f=document.querySelector("form.lead");if(!f)return;var inp=document.getElementById("fotos"),pv=document.getElementById("foto-vorschau"),busy=false;
function pick(){return inp&&inp.files?Array.prototype.slice.call(inp.files,0,3):[]}
if(inp)inp.addEventListener("change",function(){pv.innerHTML="";if(inp.files.length>3)alert("Bitte höchstens 3 Fotos auswählen – es werden die ersten 3 gesendet.");pick().forEach(function(file){var i=document.createElement("img");i.alt="";i.src=URL.createObjectURL(file);pv.appendChild(i)})});
function shrink(file){return new Promise(function(res){var img=new Image();img.onload=function(){var m=1600,w=img.naturalWidth,h=img.naturalHeight,r=Math.min(1,m/Math.max(w,h));var c=document.createElement("canvas");c.width=Math.round(w*r);c.height=Math.round(h*r);c.getContext("2d").drawImage(img,0,0,c.width,c.height);var q=.8,u=c.toDataURL("image/jpeg",q);while(u.length>1900000&&q>.4){q-=.15;u=c.toDataURL("image/jpeg",q)}URL.revokeObjectURL(img.src);res(u.split(",")[1]||"")};img.onerror=function(){res("")};img.src=URL.createObjectURL(file)})}
f.addEventListener("submit",function(e){var files=pick();if(!files.length||busy)return;e.preventDefault();busy=true;var b=f.querySelector("button[type=submit]");b.disabled=true;b.textContent="Fotos werden vorbereitet …";
Promise.all(files.map(shrink)).then(function(list){list.filter(Boolean).forEach(function(d){var h=document.createElement("input");h.type="hidden";h.name="foto";h.value=d;f.appendChild(h)});b.textContent="Wird gesendet …";HTMLFormElement.prototype.submit.call(f)})})})();`;

/**
 * Besucherzähler ohne Cookies und ohne Kennungen: meldet nur Seite und Herkunft (Google, Bing, soziale Netzwerke,
 * direkt, andere). Navigation innerhalb der Website zählt als Seitenaufruf, aber nicht als neuer Besuch.
 */
export function countScript(slug: string, page: string): string {
  const q = `action=hit&site=${encodeURIComponent(slug)}&page=${encodeURIComponent(page)}`;
  return `(function(){try{if(navigator.webdriver)return;var r=document.referrer||"",h=location.hostname,s="";var rh="";try{rh=r?new URL(r).hostname:""}catch(e){}
if(rh!==h){s=!rh?"direkt":/(^|\\.)google\\./.test(rh)?"google":/(^|\\.)bing\\.com$/.test(rh)?"bing":/(facebook|instagram|fb\\.|t\\.co$|linkedin|whatsapp|pinterest|tiktok|x\\.com$)/.test(rh)?"social":"andere"}
var u="/api/site?${q}"+(s?"&src="+s:"");if(navigator.sendBeacon)navigator.sendBeacon(u);else fetch(u,{method:"POST",keepalive:true})}catch(e){}})();`;
}

// ---------------------------------------------------------------------
// Layout
// ---------------------------------------------------------------------
type Ctx = { base: string; canonical: string; origin: string; notice?: string; preview: boolean; q?: string; page?: string; slug?: string };

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
.hero:not(.has-img) .grid{grid-template-columns:1fr;max-width:820px}
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
.card{position:relative;overflow:hidden}.card-img{margin:-24px -24px 18px;aspect-ratio:16/10;background:#e6e9ed}.card-img img{width:100%;height:100%;object-fit:cover}.card-img.ph{display:grid;place-items:center;background:color-mix(in srgb,var(--accent) 12%,#fff);color:var(--accent-dark)}.card-img.ph svg{width:56px;height:56px;stroke-width:1.5}.card h3{margin-bottom:.35em}.card-link{color:inherit;text-decoration:none}.card-link::after{content:"";position:absolute;inset:0;border-radius:inherit}
.card .more{display:inline-block;margin-top:12px;font-weight:700;color:var(--accent-dark);font-size:.95rem}.card:hover{border-color:var(--accent)}.card:hover .more{text-decoration:underline}
.faq{display:grid;gap:12px;max-width:860px}.faq details{background:#fff;border:1px solid var(--line);border-radius:var(--radius);padding:4px 20px}
.faq summary{cursor:pointer;font-weight:700;padding:14px 0;list-style:none;display:flex;justify-content:space-between;gap:12px}.faq summary::-webkit-details-marker{display:none}
.faq summary::after{content:"+";color:var(--accent);font-size:1.4rem;line-height:1}.faq details[open] summary::after{content:"–"}.faq details p{margin:0 0 16px;color:var(--muted)}
.ico.big{width:56px;height:56px;border-radius:50%;background:color-mix(in srgb,var(--accent) 14%,#fff);color:var(--accent-dark);display:grid;place-items:center;margin-bottom:16px}
.hero.sub{padding:48px 0 44px}.theme-modern .hero.sub{padding:64px 0 56px}.hero.sub .grid{max-width:1120px}.hero.sub:not(.has-img) .grid{grid-template-columns:1fr;max-width:1120px}.hero.sub:not(.has-img) .grid>div{max-width:860px}
.crumbs{font-size:.9rem;margin-bottom:14px;opacity:.85}.crumbs a{color:inherit}
.area a{color:inherit;text-decoration:none;font-weight:600}.area li:has(a):hover{border-color:var(--accent)}
.card p{margin:0;color:var(--muted)}
.card .ico{width:48px;height:48px;border-radius:50%;background:color-mix(in srgb,var(--accent) 14%,#fff);color:var(--accent-dark);display:grid;place-items:center;font-weight:800;margin-bottom:14px}
.steps{display:grid;grid-template-columns:repeat(4,1fr);gap:20px;list-style:none;margin:0;padding:0;counter-reset:st}
.steps li{position:relative;background:#fff;border:1px solid var(--line);border-radius:var(--radius);padding:24px 22px 22px}
.steps li::before{counter-increment:st;content:counter(st);display:grid;place-items:center;width:38px;height:38px;border-radius:50%;background:var(--accent);color:#fff;font-weight:800;margin-bottom:14px}
.steps h3{font-size:1.08rem;margin-bottom:.3em}.steps p{margin:0;color:var(--muted);font-size:.97rem}
fieldset.svc{border:0;margin:0;padding:0;display:grid;gap:8px}
fieldset.svc legend{font-weight:600;font-size:.95rem;margin-bottom:6px;padding:0}
.svc .opts{display:flex;flex-wrap:wrap;gap:8px}
.svc .opt{position:relative}
.svc .opt input{position:absolute;opacity:0;width:1px;height:1px}
.svc .opt span{display:inline-block;border:1px solid #c9ced6;border-radius:999px;padding:7px 14px;font-weight:500;font-size:.93rem;cursor:pointer;background:#fff;user-select:none}
.svc .opt input:checked+span{background:var(--accent);border-color:var(--accent);color:#fff}
.svc .opt input:focus-visible+span{outline:3px solid color-mix(in srgb,var(--accent) 35%,transparent)}
.photos input[type=file]{padding:10px;background:#fafbfc}
.photo-prev{display:flex;gap:8px;flex-wrap:wrap}.photo-prev img{width:72px;height:72px;object-fit:cover;border-radius:8px;border:1px solid var(--line)}
.refs{display:grid;grid-template-columns:repeat(auto-fill,minmax(300px,1fr));gap:24px}
.ref{background:#fff;border:1px solid var(--line);border-radius:var(--radius);overflow:hidden;display:flex;flex-direction:column}
.ref .main{aspect-ratio:4/3;background:#e6e9ed}.ref .main img{width:100%;height:100%;object-fit:cover}
.ref .thumbs{display:flex;gap:6px;padding:8px 8px 0;overflow-x:auto}
.ref .thumb{padding:0;border:2px solid transparent;border-radius:6px;background:none;cursor:pointer;flex:0 0 auto;line-height:0}
.ref .thumb.on{border-color:var(--accent)}
.ref .thumbs img{width:64px;height:48px;object-fit:cover;border-radius:4px}
.ref .body{padding:18px 20px 22px}
.ref .where{font-size:.85rem;color:var(--muted);font-weight:600;text-transform:uppercase;letter-spacing:.04em}
.ref p{margin:.4em 0 0;color:var(--muted)}
.stars{color:#f2a900;letter-spacing:1px}.stars .off{color:#d5d9df}
.rating-line{display:flex;align-items:center;gap:10px;flex-wrap:wrap;margin:22px 0 0;font-weight:600}
.rating-line a{color:inherit}
.theme-modern .rating-line .stars .off,.theme-frisch .rating-line .stars .off{color:rgba(255,255,255,.35)}
.rv-sum{display:flex;align-items:center;gap:16px;flex-wrap:wrap;margin:0 0 28px}
.rv-sum .big{font-size:2.6rem;font-weight:800;font-family:var(--head);line-height:1}
.rv-sum .stars{font-size:1.5rem}.rv-sum .cnt{color:var(--muted)}
.sr{position:absolute;width:1px;height:1px;overflow:hidden;clip:rect(0 0 0 0);white-space:nowrap}
.rv-list{display:grid;grid-template-columns:repeat(auto-fill,minmax(280px,1fr));gap:20px}
.rv{background:#fff;border:1px solid var(--line);border-radius:var(--radius);padding:22px;margin:0;display:flex;flex-direction:column;gap:10px}
.rv blockquote{margin:0;font-size:1.02rem}
.rv figcaption{color:var(--muted);font-size:.92rem;margin-top:auto}
.rv-note{color:var(--muted);font-size:.88rem;margin:22px 0 0}
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
 .steps{grid-template-columns:1fr 1fr}
 section.block{padding:52px 0}
 form.lead .two{grid-template-columns:1fr}
 .top .call{display:none}
 .callbar{display:grid;grid-template-columns:1fr 1fr;position:fixed;left:0;right:0;bottom:0;z-index:30;box-shadow:0 -4px 16px rgba(0,0,0,.12)}
 .callbar a{padding:15px 10px;text-align:center;font-weight:700;text-decoration:none;color:#fff;background:var(--accent)}
 .callbar a+a{background:var(--accent-dark)}
}
@media (max-width:520px){.steps{grid-template-columns:1fr}}
@media (prefers-reduced-motion:reduce){html{scroll-behavior:auto}}
`;
}

/** Link zur Startseite (bei eigener Adresse "/" statt "") */
const homeHref = (ctx: Ctx) => `${ctx.base || "/"}${ctx.q ?? ""}`;

function header(d: SiteData, ctx: Ctx, home: boolean): string {
  const name = d.company.name || "Malerbetrieb";
  const logo = safeUrl(d.company.logo_url);
  const phone = d.company.phone?.trim();
  const s = { ...SECTION_DEFAULTS, ...(d.sections ?? {}) };
  const link = (hash: string) => (home ? `#${hash}` : `${homeHref(ctx)}#${hash}`);
  const nav = [
    s.services && (d.services?.length ?? 0) > 0 ? `<a href="${link("leistungen")}">Leistungen</a>` : "",
    s.references && (d.references?.length ?? 0) > 0 ? `<a href="${link("referenzen")}">Referenzen</a>` : "",
    s.reviews && reviewSummary(d) ? `<a href="${link("bewertungen")}">Bewertungen</a>` : "",
    s.about && (d.about_text || (d.highlights?.length ?? 0) > 0) ? `<a href="${link("ueber-uns")}">Über uns</a>` : "",
    s.contact ? `<a href="${link("kontakt")}">Kontakt</a>` : "",
  ].join("");
  return `${ctx.preview ? `<div class="preview">Vorschau – diese Seite ist noch nicht veröffentlicht.</div>` : ""}
<header class="top"><div class="wrap">
<a class="brand" href="${homeHref(ctx)}">${logo ? `<img src="${esc(logo)}" alt="${esc(name)} Logo">` : ""}<span>${esc(name)}</span></a>
<nav class="main" aria-label="Hauptnavigation">${nav}</nav>
${phone ? `<a class="btn call" href="tel:${esc(telHref(phone))}">📞 ${esc(phone)}</a>` : ""}
</div></header>`;
}

function footer(d: SiteData, ctx: Ctx): string {
  const c = d.company;
  const phone = c.phone?.trim();
  return `<footer class="bottom"><div class="wrap">
<div><strong>${esc(c.name)}</strong><br>${esc(c.street)}<br>${esc([c.zip, c.city].filter(Boolean).join(" "))}</div>
<div>${phone ? `Telefon: <a href="tel:${esc(telHref(phone))}">${esc(phone)}</a><br>` : ""}${c.email ? `E-Mail: ${emailLink(c.email)}` : ""}</div>
<div><a href="${ctx.base}/impressum${ctx.q ?? ""}">Impressum</a> · <a href="${ctx.base}/datenschutz${ctx.q ?? ""}">Datenschutz</a><br><span class="made">Website erstellt mit <a href="${esc(ctx.origin)}/">Maler-SaaS</a></span></div>
</div></footer>
${phone ? `<div class="callbar"><a href="tel:${esc(telHref(phone))}">📞 Anrufen</a><a href="${homeHref(ctx)}#kontakt">✉️ Anfrage</a></div>` : ""}`;
}

function jsonLd(d: SiteData, ctx: Ctx): string {
  const c = d.company;
  const data: Record<string, unknown> = {
    "@context": "https://schema.org",
    "@type": "HousePainter",
    name: c.name || undefined,
    url: ctx.canonical,
    telephone: c.phone || undefined,
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

function page(d: SiteData, ctx: Ctx, title: string, description: string, body: string, opts: { home: boolean; index: boolean; jsonLd?: string; script?: boolean }): string {
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
${opts.home ? jsonLd(d, ctx) : (opts.jsonLd ?? "")}
</head>
<body class="theme-${esc(["klassisch", "modern", "frisch"].includes(d.theme) ? d.theme : "klassisch")}">
<a class="skip" href="#inhalt">Zum Inhalt springen</a>
${header(d, ctx, opts.home)}
<main id="inhalt">${body}</main>
${footer(d, ctx)}
${!ctx.preview && ctx.slug ? `<script>${countScript(ctx.slug, ctx.page ?? "")}</script>` : ""}
${opts.home || opts.script ? `<script>document.addEventListener("click",function(e){var b=e.target.closest(".thumb");if(!b)return;var r=b.closest(".ref"),m=r&&r.querySelector(".main img");if(!m)return;m.src=b.getAttribute("data-src");r.querySelectorAll(".thumb").forEach(function(t){t.classList.toggle("on",t===b)})})</script>` : ""}
</body></html>`;
}

// ---------------------------------------------------------------------
// Seiten
// ---------------------------------------------------------------------
/** Abwechselnd heller und getönter Hintergrund – unabhängig davon, welche Bereiche angezeigt werden */
function alternate(blocks: string[]): string {
  return blocks
    .filter(Boolean)
    .map((b, i) => (i % 2 === 1 ? b.replace('<section class="block"', '<section class="block alt"') : b))
    .join("");
}

// ---------------------------------------------------------------------
// Bausteine (Startseite und Leistungsseiten)
// ---------------------------------------------------------------------
type Sections = typeof SECTION_DEFAULTS;
const sectionsOf = (d: SiteData): Sections => ({ ...SECTION_DEFAULTS, ...(d.sections ?? {}) });
const servicesOf = (d: SiteData): Service[] => (d.services ?? []).filter((x) => x?.title).slice(0, 12);

function processSection(d: SiteData, s: Sections): string {
  if (!s.process) return "";
  const phone = d.company.phone?.trim();
  return `<section class="block" id="ablauf"><div class="wrap">
<div class="sec-head"><h2>So läuft's ab</h2><p>In vier Schritten zum fertigen Ergebnis – unkompliziert und transparent.</p></div>
<ol class="steps">
<li><h3>Anfrage</h3><p>${phone ? "Rufen Sie an oder schreiben" : "Schreiben"} Sie uns${s.contact && d.contact_form !== false ? " über das Formular – gern mit Fotos" : ""}.</p></li>
<li><h3>Kostenlose Besichtigung</h3><p>Wir schauen uns alles vor Ort an und beraten Sie zu Farben und Materialien.</p></li>
<li><h3>Verbindliches Angebot</h3><p>Sie erhalten ein schriftliches Angebot – klar aufgeschlüsselt und ohne versteckte Kosten.</p></li>
<li><h3>Saubere Ausführung</h3><p>Termingerecht, mit sauber abgedeckten Flächen und gemeinsamer Abnahme zum Schluss.</p></li>
</ol></div></section>`;
}

function refsSection(refs: Reference[], heading: string, sub: string): string {
  if (!refs.length) return "";
  return `<section class="block" id="referenzen"><div class="wrap">
<div class="sec-head"><h2>${esc(heading)}</h2><p>${esc(sub)}</p></div>
<div class="refs">${refs
    .map((r) => {
      const imgs = (r.images ?? []).map((im) => ({ url: safeUrl(im?.url), alt: im?.alt })).filter((im) => im.url);
      const first = imgs[0];
      return `<article class="ref">${
        first ? `<div class="main"><img src="${esc(first.url)}" alt="${esc(first.alt || r.title)}" loading="lazy"></div>` : ""
      }${
        imgs.length > 1
          ? `<div class="thumbs">${imgs
              .slice(0, 8)
              .map(
                (im, i) =>
                  `<button type="button" class="thumb${i === 0 ? " on" : ""}" data-src="${esc(im.url)}" aria-label="Bild ${i + 1} anzeigen"><img src="${esc(im.url)}" alt="" loading="lazy"></button>`
              )
              .join("")}</div>`
          : ""
      }<div class="body">${r.city ? `<div class="where">${esc(r.city)}</div>` : ""}<h3>${esc(r.title)}</h3>${r.text ? `<p>${esc(r.text)}</p>` : ""}</div></article>`;
    })
    .join("")}</div></div></section>`;
}

function reviewsSection(rv: ReturnType<typeof reviewSummary>, maxItems = 12): string {
  if (!rv) return "";
  const items = rv.items.slice(0, maxItems);
  return `<section class="block" id="bewertungen"><div class="wrap">
<div class="sec-head"><h2>Das sagen unsere Kunden</h2><p>Bewertungen unserer Auftraggeber nach Abschluss der Arbeiten.</p></div>
<div class="rv-sum"><span class="big">${fmtAvg(rv.avg)}</span><div>${stars(rv.avg)}<br><span class="cnt">${rv.count} Bewertung${rv.count === 1 ? "" : "en"}</span></div></div>
${
  items.length
    ? `<div class="rv-list">${items
        .map((i) => {
          const who = [i.name, i.city].filter(Boolean).map(esc).join(", ");
          const when = monthYear(i.date);
          return `<figure class="rv">${stars(Number(i.rating))}<span class="sr">${Number(i.rating)} von 5 Sternen</span>${
            i.text ? `<blockquote>„${esc(i.text).replace(/\n/g, "<br>")}“</blockquote>` : ""
          }<figcaption>${who}${who && when ? " · " : ""}${esc(when)}</figcaption></figure>`;
        })
        .join("")}</div>`
    : ""
}
<p class="rv-note">Alle Bewertungen stammen von Kunden, die einen Auftrag bei uns abgeschlossen haben, und wurden über unser Kundenportal abgegeben. Der Durchschnitt berücksichtigt alle abgegebenen Bewertungen; Texte werden nur mit Einwilligung der Kunden veröffentlicht.</p>
</div></section>`;
}

/** Kontaktbereich mit Formular. preselect: Leistung, die schon angeklickt ist; page: Unterseite für die Rückkehr nach dem Absenden */
function contactSection(d: SiteData, ctx: Ctx, s: Sections, opts: { preselect?: string; page?: string; intro?: string } = {}): string {
  if (!s.contact) return "";
  const c = d.company;
  const phone = c.phone?.trim();
  const services = servicesOf(d);
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
${
  services.length
    ? `<fieldset class="svc"><legend>Worum geht es? <small>(mehrere möglich)</small></legend><div class="opts">${services
        .map(
          (sv) =>
            `<label class="opt"><input type="checkbox" name="leistung" value="${esc(sv.title)}"${sv.title === opts.preselect ? " checked" : ""}><span>${esc(sv.title)}</span></label>`
        )
        .join("")}</div></fieldset>`
    : ""
}
<label>Ihr Anliegen${services.length ? "" : " *"}<textarea name="message"${services.length ? "" : " required"} rows="5" maxlength="3000" placeholder="z. B. Wohnzimmer und Flur streichen, ca. 60 m², gewünschter Zeitraum …"></textarea></label>
<label class="photos">Fotos <small>(optional, bis zu 3 – z. B. von Wand, Fassade oder Schaden)</small><input type="file" id="fotos" accept="image/*" multiple></label>
<div class="photo-prev" id="foto-vorschau"></div>
<div class="hp" aria-hidden="true"><label>Website<input name="website" tabindex="-1" autocomplete="off"></label></div>
<input type="hidden" name="t" value="${Date.now()}"><input type="hidden" name="basis" value="${esc(ctx.base)}">${opts.page ? `\n<input type="hidden" name="seite" value="${esc(opts.page)}">` : ""}
<small>Bitte Telefon oder E-Mail angeben. Ihre Angaben verwenden wir nur zur Bearbeitung Ihrer Anfrage, siehe <a href="${ctx.base}/datenschutz${ctx.q ?? ""}">Datenschutz</a>.</small>
<button class="btn" type="submit">Anfrage senden</button>
</form>
<script>${FORM_SCRIPT}</script>`
      : "";
  return `<section class="block" id="kontakt"><div class="wrap contact">
<div><h2>Kontakt</h2><p>${esc(opts.intro || "Rufen Sie uns an oder schreiben Sie uns – wir melden uns zeitnah und vereinbaren einen kostenlosen Besichtigungstermin.")}</p>
<dl>${phone ? `<dt>Telefon</dt><dd><a href="tel:${esc(telHref(phone))}">${esc(phone)}</a></dd>` : ""}
${c.email ? `<dt>E-Mail</dt><dd>${emailLink(c.email)}</dd>` : ""}
${c.street ? `<dt>Adresse</dt><dd>${esc(c.street)}<br>${esc([c.zip, c.city].filter(Boolean).join(" "))}</dd>` : ""}
${d.opening_hours ? `<dt>Erreichbarkeit</dt><dd>${esc(d.opening_hours).replace(/\n/g, "<br>")}</dd>` : ""}</dl></div>
${formHtml || "<div></div>"}
</div></section>`;
}

export function renderHome(d: SiteData, ctx: Ctx): string {
  const c = d.company;
  const city = c.city?.trim() || "";
  const name = c.name || "Malerbetrieb";
  const s = sectionsOf(d);
  const services = servicesOf(d);
  const slugs = serviceSlugs(services);
  const refs = (d.references ?? []).filter((r) => r?.title);
  const highlights = (d.highlights ?? []).filter(Boolean).slice(0, 8);
  const area = areaList(d.service_area);
  const heroImg = safeUrl(d.hero_image_url);
  const phone = c.phone?.trim();
  const rv = s.reviews ? reviewSummary(d) : null;
  const h1 = d.hero_title?.trim() || (city ? `Ihr Malerbetrieb in ${city}` : `Ihr Malerbetrieb`);
  const sub =
    d.hero_subtitle?.trim() ||
    `${name}: Malerarbeiten innen und außen – sauber, termintreu und mit festem Ansprechpartner${city ? ` in ${city} und Umgebung` : ""}.`;

  const hero = `<section class="hero${heroImg ? " has-img" : ""}"${heroImg ? ` style="--hero-img:url('${esc(heroImg)}')"` : ""}><div class="wrap grid">
<div><h1>${esc(h1)}</h1><p class="lead">${esc(sub)}</p>
<div class="actions">${phone ? `<a class="btn" href="tel:${esc(telHref(phone))}">📞 ${esc(phone)}</a>` : ""}${s.contact ? `<a class="btn ghost" href="#kontakt">Kostenlos anfragen</a>` : ""}</div>
${highlights.length ? `<ul class="chips">${highlights.map((h) => `<li>${esc(h)}</li>`).join("")}</ul>` : ""}
${rv ? `<p class="rating-line">${stars(rv.avg)} <a href="#bewertungen">${fmtAvg(rv.avg)} von 5 – ${rv.count} Kundenbewertung${rv.count === 1 ? "" : "en"}</a></p>` : ""}
</div>
${heroImg ? `<div class="pic"><img src="${esc(heroImg)}" alt="${esc(`${name} – Malerarbeiten`)}" fetchpriority="high"></div>` : ""}
</div></section>`;

  const servicesHtml =
    s.services && services.length
      ? `<section class="block" id="leistungen"><div class="wrap">
<div class="sec-head"><h2>Unsere Leistungen</h2><p>Alles aus einer Hand${city ? ` – für Privat- und Gewerbekunden in ${esc(city)} und Umgebung` : ""}.</p></div>
<div class="cards">${services
          .map(
            (sv, i) =>
              `<article class="card${s.service_photos ? " has-img" : ""}">${
                !s.service_photos
                  ? `<div class="ico">${iconSvg(serviceIcon(sv))}</div>`
                  : safeUrl(sv.image)
                    ? `<div class="card-img"><img src="${esc(safeUrl(sv.image))}" alt="${esc(sv.title)}" loading="lazy"></div>`
                    : `<div class="card-img ph">${iconSvg(serviceIcon(sv))}</div>`
              }<h3><a class="card-link" href="${ctx.base}/${slugs[i]}${ctx.q ?? ""}">${esc(sv.title)}</a></h3>${
                sv.text ? `<p>${esc(sv.text)}</p>` : ""
              }<span class="more" aria-hidden="true">Mehr erfahren →</span></article>`
          )
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
      ? `<section class="block" id="einzugsgebiet"><div class="wrap">
<div class="sec-head"><h2>Hier sind wir für Sie da</h2><p>Unser Einsatzgebiet rund um ${esc(city || "unseren Standort")}:</p></div>
<ul class="area">${area.map((a) => `<li>${esc(a)}</li>`).join("")}</ul></div></section>`
      : "";

  const title = d.seo_title?.trim() || `${name} – Maler${city ? ` in ${city}` : ""}`;
  const description =
    d.seo_description?.trim() ||
    `${name}${city ? ` in ${city}` : ""}: ${services.length ? services.slice(0, 4).map((x) => x.title).join(", ") : "Malerarbeiten innen und außen"}. Jetzt kostenlos anfragen.`;
  const body =
    hero +
    alternate([
      servicesHtml,
      processSection(d, s),
      s.references ? refsSection(refs, "Aktuelle Projekte", "Ein Auszug aus unseren zuletzt abgeschlossenen Arbeiten.") : "",
      reviewsSection(rv),
      aboutHtml,
      areaHtml,
      contactSection(d, ctx, s),
    ]);
  return page(d, ctx, title.slice(0, 70), description.slice(0, 160), body, { home: true, index: !ctx.preview });
}

// ---------------------------------------------------------------------
// Eigene Seite pro Leistung, z. B. /w/prinzenkinder/fassadenanstrich
// ---------------------------------------------------------------------
const RESERVED_PAGES = new Set(["impressum", "datenschutz", "robots-txt", "sitemap-xml", "index-html", "kontakt", "leistungen"]);

export function slugifyService(title: string): string {
  return title
    .toLowerCase()
    .replace(/ä/g, "ae")
    .replace(/ö/g, "oe")
    .replace(/ü/g, "ue")
    .replace(/ß/g, "ss")
    .normalize("NFKD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "")
    .slice(0, 60)
    .replace(/-+$/g, "") || "leistung";
}

/** Eindeutige Adressen für alle Leistungen (gleiche Reihenfolge wie die Liste) */
export function serviceSlugs(services: Service[]): string[] {
  const used = new Set<string>();
  return services.map((sv) => {
    let base = slugifyService(String(sv.title ?? ""));
    if (RESERVED_PAGES.has(base)) base = `${base}-leistung`;
    let slug = base;
    for (let n = 2; used.has(slug); n++) slug = `${base}-${n}`;
    used.add(slug);
    return slug;
  });
}

/** Standardtexte, solange der Betrieb keinen eigenen ausführlichen Text hinterlegt hat */
const SERVICE_DEFAULT_TEXT: Record<string, string> = {
  rolle:
    "Frische Farbe verändert einen Raum mehr als fast jede andere Maßnahme. Wir decken Möbel und Böden sorgfältig ab, prüfen den Untergrund, bessern kleine Risse und Löcher aus und streichen Wände und Decken gleichmäßig und streifenfrei.\n\nGemeinsam wählen wir Farbtöne und die passende Farbe – zum Beispiel besonders strapazierfähig für Flur und Küche, scheuerbeständig für Kinderzimmer oder emissionsarm für Schlafräume. Nach getaner Arbeit räumen wir auf und hinterlassen alles besenrein.",
  pinsel:
    "Lackierte Flächen sind täglich im Gebrauch und brauchen eine sorgfältige Vorbereitung: Wir reinigen, schleifen und grundieren, bevor wir Türen, Zargen, Heizkörper, Geländer oder Treppen lackieren.\n\nSo entsteht eine glatte, widerstandsfähige Oberfläche, die lange schön bleibt. Auf Wunsch arbeiten wir mit wasserbasierten, geruchsarmen Lacken.",
  haus:
    "Eine gepflegte Fassade schützt Ihr Haus vor Witterung und steigert seinen Wert. Vor dem Anstrich prüfen wir den Untergrund, reinigen die Flächen, schließen Risse und wählen das passende System – etwa Silikonharz-, Silikat- oder Dispersionsfarbe.\n\nWir kümmern uns auf Wunsch um das Gerüst, schützen Fenster, Wege und Pflanzen und stimmen den Zeitplan auf das Wetter ab.",
  tapete:
    "Ob Raufaser, Vlies, Glasgewebe oder Designtapete: Wir entfernen alte Tapeten, bereiten den Untergrund vor und tapezieren sauber auf Stoß – auch bei Dachschrägen, Ecken und Nischen.\n\nGerne beraten wir Sie zur Auswahl von Tapeten und Farben, damit das Ergebnis zu Ihren Räumen passt.",
  spachtel:
    "Glatte Wände sind die Grundlage für jedes gute Ergebnis. Wir spachteln Wände und Decken in den Qualitätsstufen Q1 bis Q4, gleichen Unebenheiten aus und bringen auf Wunsch dekorative Putze und Strukturen auf.\n\nAuch Ausbesserungen nach Umbauten oder Installationen übernehmen wir – staubarm und sauber.",
  boden:
    "Neue Böden runden jede Renovierung ab. Wir bereiten den Untergrund vor, gleichen ihn bei Bedarf aus und verlegen Vinyl, Designbelag, Laminat oder Teppich fachgerecht – inklusive Sockelleisten und sauberer Übergänge.\n\nSo bekommen Sie Wand und Boden aus einer Hand, ohne zusätzlichen Abstimmungsaufwand.",
  tuer:
    "Fenster und Türen sind Wind und Wetter oder täglicher Nutzung ausgesetzt. Wir schleifen, grundieren und lackieren Holz- und Metallflächen, erneuern Anstriche an Fensterrahmen und Haustüren und sorgen für einen dauerhaften Schutz.",
  schutz:
    "Schimmel und Feuchtigkeit sollten Sie nicht einfach überstreichen. Wir suchen gemeinsam mit Ihnen nach der Ursache, entfernen befallene Beschichtungen fachgerecht und setzen geeignete Sanier- und Schutzsysteme ein.\n\nDazu geben wir Ihnen Tipps zum richtigen Lüften und Heizen, damit das Problem nicht wiederkommt.",
  daemmung:
    "Eine gute Dämmung senkt die Heizkosten und verbessert das Wohnklima. Wir beraten Sie zu Wärmedämm-Verbundsystemen und Innendämmung und führen die Arbeiten fachgerecht aus – inklusive Putz und Anstrich.",
  mauer:
    "Sichtmauerwerk, Klinker und Natursteinflächen brauchen besondere Pflege. Wir reinigen schonend, bessern Fugen aus und schützen die Flächen mit passenden Imprägnierungen und Beschichtungen.",
  spray:
    "Mit modernen Spritzverfahren beschichten wir große Flächen schnell und gleichmäßig. Wir entfernen außerdem Graffiti und schützen Flächen auf Wunsch mit Anti-Graffiti-Beschichtungen.",
  palette:
    "Die richtige Farbe macht den Unterschied. Wir beraten Sie zu Farbtönen, Materialien und Wirkung – mit Farbmustern direkt an Ihrer Wand – und entwickeln mit Ihnen ein stimmiges Gesamtkonzept für Wohnung, Haus oder Geschäftsräume.",
  gewerbe:
    "Für Büros, Praxen, Ladenlokale, Hotels und Hausverwaltungen arbeiten wir planbar und mit möglichst wenig Störung des laufenden Betriebs – auf Wunsch auch abends oder am Wochenende. Sie erhalten feste Ansprechpartner und verlässliche Termine.",
  holz:
    "Holz im Außenbereich braucht regelmäßigen Schutz. Wir reinigen, schleifen und behandeln Zäune, Carports, Gartenhäuser, Fensterläden und Holzfassaden mit Lasuren, Ölen oder Lacken – passend zum Holz und zur gewünschten Optik.",
  wasser:
    "Nach einem Wasserschaden kümmern wir uns um die Wiederherstellung: Wir prüfen die Trocknung, entfernen geschädigte Beschichtungen, spachteln und streichen neu. Auf Wunsch stimmen wir uns direkt mit Ihrer Versicherung ab.",
  werkzeug:
    "Ob kleine Schäden oder eine komplette Renovierung: Wir bessern Risse, Löcher und Beschädigungen aus, erneuern Oberflächen und bringen Ihre Räume wieder in einen gepflegten Zustand – zuverlässig und sauber.",
  stern:
    "Sprechen Sie uns an – wir beraten Sie gerne persönlich und finden gemeinsam die passende Lösung für Ihr Vorhaben.",
};

/** „Das ist enthalten“ – Vorschläge je Leistungsart */
const SERVICE_DEFAULT_INCLUDED: Record<string, string[]> = {
  rolle: ["Kostenlose Besichtigung und Farbberatung", "Abdecken von Böden, Möbeln und Steckdosen", "Ausbessern kleiner Risse und Löcher", "Grundierung bei Bedarf", "Zwei Anstriche für ein gleichmäßiges Ergebnis", "Aufräumen und besenreine Übergabe"],
  pinsel: ["Reinigen und Anschleifen der Oberflächen", "Ausbessern von Macken und Rissen", "Passende Grundierung", "Lackieren mit hochwertigen, auf Wunsch geruchsarmen Lacken", "Abkleben angrenzender Flächen", "Saubere Übergabe"],
  haus: ["Prüfung von Untergrund und Altanstrich", "Reinigung der Fassade", "Rissbehandlung und Ausbesserungen", "Gerüst auf Wunsch", "Schutz von Fenstern, Wegen und Pflanzen", "Anstrich mit passendem Fassadensystem"],
  tapete: ["Entfernen alter Tapeten", "Vorbereitung und Glätten des Untergrunds", "Tapezieren auf Stoß, auch an Schrägen und Nischen", "Anstrich der Tapete auf Wunsch", "Beratung zur Tapetenauswahl", "Aufräumen und Entsorgung"],
  spachtel: ["Spachtelarbeiten in Q1 bis Q4", "Ausgleichen von Unebenheiten", "Schleifen mit staubarmer Technik", "Dekorative Putze und Strukturen auf Wunsch", "Ausbesserung nach Umbau oder Installation", "Fertig zum Streichen oder Tapezieren"],
  boden: ["Entfernen des alten Belags", "Prüfen und Ausgleichen des Untergrunds", "Verlegung von Vinyl, Designbelag, Laminat oder Teppich", "Sockelleisten und Übergangsprofile", "Beratung zu Material und Optik", "Entsorgung von Resten"],
  tuer: ["Schleifen und Ausbessern von Rahmen und Türblättern", "Grundierung von Holz und Metall", "Lackierung innen und außen", "Abkleben von Glas und Beschlägen", "Witterungsbeständige Materialien", "Saubere Übergabe"],
  schutz: ["Begutachtung und Ursachensuche", "Fachgerechtes Entfernen befallener Beschichtungen", "Behandlung mit geeigneten Sanierprodukten", "Schimmelhemmender Anstrich", "Tipps zum Lüften und Heizen", "Dokumentation auf Wunsch"],
  daemmung: ["Beratung zu Dämmsystem und Dämmstärke", "Untergrundvorbereitung", "Anbringen der Dämmplatten", "Armierung und Oberputz", "Fassadenanstrich", "Detailanschlüsse an Fenster und Dach"],
};
const GENERIC_INCLUDED = ["Kostenlose Besichtigung vor Ort", "Persönliche Beratung", "Schriftliches Angebot", "Sorgfältiges Abdecken und Schützen", "Fachgerechte Ausführung", "Aufräumen und saubere Übergabe"];

/** Häufige Fragen – Vorschläge je Leistungsart */
const SERVICE_DEFAULT_FAQ: Record<string, Faq[]> = {
  rolle: [
    { q: "Wie lange dauert es, ein Zimmer zu streichen?", a: "Ein durchschnittliches Zimmer ist meist an einem Tag fertig. Sind Ausbesserungen nötig oder wird ein dunkler Farbton überstrichen, kann es etwas länger dauern." },
    { q: "Muss ich die Möbel vorher ausräumen?", a: "Nein. Wir rücken Möbel in die Raummitte und decken sie und den Boden sorgfältig ab. Zerbrechliches und Wertgegenstände räumen Sie am besten vorher weg." },
    { q: "Welche Farbe ist für Küche und Bad geeignet?", a: "Für stark beanspruchte oder feuchte Räume empfehlen wir abwaschbare, scheuerbeständige Farben. Wir beraten Sie gern bei der Besichtigung." },
  ],
  pinsel: [
    { q: "Können Türen und Heizkörper vor Ort lackiert werden?", a: "Ja, in den meisten Fällen lackieren wir direkt bei Ihnen. Türen können bei Bedarf auch ausgehängt werden." },
    { q: "Riecht frischer Lack lange?", a: "Wir arbeiten auf Wunsch mit wasserbasierten Lacken, die kaum riechen und schnell trocknen." },
    { q: "Wie lange muss der Lack trocknen?", a: "Oberflächlich ist er meist nach wenigen Stunden trocken, voll belastbar nach einigen Tagen. Wir sagen Ihnen genau, worauf Sie achten sollten." },
  ],
  haus: [
    { q: "Wann ist die beste Zeit für einen Fassadenanstrich?", a: "Von Frühjahr bis Herbst bei trockenem Wetter und Temperaturen über etwa 5 °C. Wir planen den Termin passend zur Wetterlage." },
    { q: "Wie oft sollte eine Fassade gestrichen werden?", a: "Je nach Lage, Wetterseite und Farbsystem etwa alle 10 bis 15 Jahre. Abplatzungen, Risse oder Verfärbungen sind ein Zeichen, dass es Zeit wird." },
    { q: "Brauche ich ein Gerüst?", a: "Bei den meisten Häusern ja. Wir kümmern uns auf Wunsch um Gerüst und Genehmigungen." },
  ],
  tapete: [
    { q: "Welche Tapete passt zu meinem Raum?", a: "Vliestapeten sind einfach zu verarbeiten und später leicht zu entfernen, Raufaser ist günstig und robust. Wir beraten Sie zu Optik und Pflege." },
    { q: "Müssen alte Tapeten entfernt werden?", a: "In der Regel ja, damit die neue Tapete gut hält. Wir übernehmen das Ablösen und die Vorbereitung des Untergrunds." },
    { q: "Kann die neue Tapete gestrichen werden?", a: "Raufaser und viele Vliestapeten sind überstreichbar. Den Anstrich erledigen wir auf Wunsch gleich mit." },
  ],
  spachtel: [
    { q: "Was bedeuten Q1 bis Q4?", a: "Das sind Qualitätsstufen für die Oberfläche. Q2 ist der Standard für Tapete oder Anstrich, Q3 und Q4 sorgen für besonders glatte Wände, etwa bei Streiflicht." },
    { q: "Wie viel Staub entsteht beim Schleifen?", a: "Wir arbeiten mit abgesaugten Schleifgeräten und decken alles sorgfältig ab. Ganz staubfrei geht es nicht, aber deutlich sauberer als früher." },
    { q: "Kann man Rauputz glatt machen?", a: "Ja, durch Überspachteln entsteht wieder eine glatte Fläche, die gestrichen oder tapeziert werden kann." },
  ],
  boden: [
    { q: "Kann der neue Boden auf den alten verlegt werden?", a: "Oft ja, wenn der alte Belag fest und eben ist. Bei der Besichtigung prüfen wir, ob das in Ihrem Fall geht." },
    { q: "Ist Vinyl für Küche und Bad geeignet?", a: "Viele Vinyl- und Designbeläge sind wasserfest und daher gut für Küche und Bad geeignet." },
    { q: "Wie lange dauert die Verlegung?", a: "Ein normales Zimmer ist meist an einem Tag fertig, eine ganze Wohnung in wenigen Tagen." },
  ],
  schutz: [
    { q: "Reicht es, Schimmel zu überstreichen?", a: "Nein. Der Befall muss fachgerecht entfernt und die Ursache gefunden werden, sonst kommt er wieder." },
    { q: "Woher kommt Schimmel in der Wohnung?", a: "Häufig durch zu hohe Luftfeuchtigkeit, Wärmebrücken oder Feuchtigkeit im Mauerwerk. Wir schauen uns das vor Ort an." },
    { q: "Ab wann sollte ein Fachbetrieb kommen?", a: "Bei größeren Flächen, wiederkehrendem Befall oder wenn Kinder oder Allergiker im Haushalt leben, sollten Sie nicht selbst Hand anlegen." },
  ],
};
const GENERIC_FAQ: Faq[] = [
  { q: "Was kostet die Leistung?", a: "Das hängt von Fläche, Untergrund und Aufwand ab. Nach einer kostenlosen Besichtigung erhalten Sie ein schriftliches, verbindliches Angebot." },
  { q: "Wie schnell bekomme ich einen Termin?", a: "Rufen Sie uns an oder schreiben Sie uns – wir melden uns zeitnah und vereinbaren einen Besichtigungstermin." },
  { q: "Arbeiten Sie auch für Gewerbekunden und Hausverwaltungen?", a: "Ja, wir arbeiten für Privatkunden ebenso wie für Gewerbe, Vermieter und Hausverwaltungen." },
];

export function serviceIncluded(sv: Service): string[] {
  const own = (sv.included ?? []).map((x) => String(x).trim()).filter(Boolean).slice(0, 12);
  return own.length ? own : SERVICE_DEFAULT_INCLUDED[serviceIcon(sv)] ?? GENERIC_INCLUDED;
}

export function serviceFaq(sv: Service): Faq[] {
  const own = (sv.faq ?? []).filter((f) => String(f?.q ?? "").trim() && String(f?.a ?? "").trim()).slice(0, 8);
  return own.length ? own : SERVICE_DEFAULT_FAQ[serviceIcon(sv)] ?? GENERIC_FAQ;
}

/** Vorschläge für den Editor (GET /api/site?action=vorschlaege&icon=haus) */
export function serviceSuggestions(icon: string) {
  const sv: Service = { icon: SERVICE_ICONS[icon] ? icon : "stern" };
  return { details: serviceDetails(sv), included: serviceIncluded(sv), faq: serviceFaq(sv) };
}

export function serviceDetails(sv: Service): string {
  const own = String(sv.details ?? "").trim();
  return own || SERVICE_DEFAULT_TEXT[serviceIcon(sv)] || SERVICE_DEFAULT_TEXT.stern;
}

/** Referenzen, die thematisch zur Leistung passen (gleiches Symbol bzw. Leistungsname im Text) */
function refsForService(sv: Service, refs: Reference[]): Reference[] {
  const key = serviceIcon(sv);
  const word = slugifyService(String(sv.title ?? "")).split("-")[0].slice(0, 7);
  return refs.filter((r) => {
    const text = `${r.title} ${r.text ?? ""}`;
    const guess = serviceIcon({ title: text });
    return (guess === key && key !== "rolle") || (word.length >= 5 && slugifyService(text).includes(word));
  });
}

export function findService(d: SiteData, pageSlug: string): { service: Service; index: number; slug: string; moved?: boolean } | null {
  const services = servicesOf(d);
  const slugs = serviceSlugs(services);
  const i = slugs.indexOf(pageSlug);
  if (i >= 0) return { service: services[i], index: i, slug: slugs[i] };
  // Alte Adresse nach Umbenennen -> Weiterleitung
  const j = services.findIndex((sv) => (sv.aliases ?? []).includes(pageSlug));
  return j >= 0 ? { service: services[j], index: j, slug: slugs[j], moved: true } : null;
}

export function renderService(d: SiteData, ctx: Ctx, found: { service: Service; slug: string }): string {
  const sv = found.service;
  const c = d.company;
  const city = c.city?.trim() || "";
  const name = c.name || "Malerbetrieb";
  const s = sectionsOf(d);
  const services = servicesOf(d);
  const slugs = serviceSlugs(services);
  const area = areaList(d.service_area);
  const phone = c.phone?.trim();
  const highlights = (d.highlights ?? []).filter(Boolean).slice(0, 8);
  const rv = s.reviews ? reviewSummary(d) : null;
  const title = String(sv.title);
  const h1 = city ? `${title} in ${city} und Umgebung` : title;
  const lead = sv.text?.trim() || `${title} vom Fachbetrieb – sauber, termintreu und mit festem Ansprechpartner.`;
  const allRefs = (d.references ?? []).filter((r) => r?.title);
  const matching = refsForService(sv, allRefs);
  const refs = (matching.length ? matching : allRefs).slice(0, 6);
  const pageCtx: Ctx = { ...ctx, canonical: `${ctx.canonical.replace(/\/$/, "")}/${found.slug}` };

  const img = safeUrl(sv.image);
  const hero = `<section class="hero sub${img ? " has-img" : ""}"${img ? ` style="--hero-img:url('${esc(img)}')"` : ""}><div class="wrap grid">
<div><nav class="crumbs" aria-label="Brotkrumen"><a href="${homeHref(ctx)}">Startseite</a> › <a href="${homeHref(ctx)}#leistungen">Leistungen</a> › <span>${esc(title)}</span></nav>
<h1>${esc(h1)}</h1><p class="lead">${esc(lead)}</p>
<div class="actions">${phone ? `<a class="btn" href="tel:${esc(telHref(phone))}">📞 ${esc(phone)}</a>` : ""}${s.contact ? `<a class="btn ghost" href="#kontakt">Kostenlos anfragen</a>` : ""}</div>
${highlights.length ? `<ul class="chips">${highlights.map((h) => `<li>${esc(h)}</li>`).join("")}</ul>` : ""}
${rv ? `<p class="rating-line">${stars(rv.avg)} <a href="#bewertungen">${fmtAvg(rv.avg)} von 5 – ${rv.count} Kundenbewertung${rv.count === 1 ? "" : "en"}</a></p>` : ""}
</div>
${img ? `<div class="pic"><img src="${esc(img)}" alt="${esc(`${title} – ${name}`)}" fetchpriority="high"></div>` : ""}
</div></section>`;

  const included = serviceIncluded(sv);
  const faq = serviceFaq(sv);
  const detailHtml = `<section class="block" id="details"><div class="wrap about">
<div><div class="ico big">${iconSvg(serviceIcon(sv))}</div><h2>${esc(title)} von ${esc(name)}</h2>${paragraphs(serviceDetails(sv))}${
    city ? `<p>Wir sind für Sie in ${esc(city)}${area.filter((a) => a !== city).length ? ` und in ${esc(area.filter((a) => a !== city).slice(0, 6).join(", "))}` : " und Umgebung"} im Einsatz.</p>` : ""
  }</div>
<div><h3>Das ist enthalten</h3><ul class="facts">${included.map((h) => `<li>${esc(h)}</li>`).join("")}</ul></div>
</div></section>`;

  const faqHtml = faq.length
    ? `<section class="block" id="fragen"><div class="wrap">
<div class="sec-head"><h2>Häufige Fragen zu ${esc(title)}</h2></div>
<div class="faq">${faq
        .map((f) => `<details><summary>${esc(f.q)}</summary>${paragraphs(f.a)}</details>`)
        .join("")}</div></div></section>`
    : "";

  const others = services
    .map((o, i) => ({ o, slug: slugs[i] }))
    .filter((x) => x.slug !== found.slug);
  const othersHtml = others.length
    ? `<section class="block" id="weitere"><div class="wrap">
<div class="sec-head"><h2>Weitere Leistungen</h2></div>
<ul class="area">${others.map((x) => `<li><a href="${ctx.base}/${x.slug}${ctx.q ?? ""}">${esc(x.o.title)}</a></li>`).join("")}</ul></div></section>`
    : "";

  const body =
    hero +
    alternate([
      detailHtml,
      faqHtml,
      processSection(d, s),
      s.references ? refsSection(refs, matching.length ? `Projekte: ${title}` : "Aus unseren letzten Projekten", "Ein Auszug aus unseren abgeschlossenen Arbeiten.") : "",
      reviewsSection(rv, 3),
      othersHtml,
      contactSection(d, ctx, s, {
        preselect: title,
        page: found.slug,
        intro: `Sie interessieren sich für „${title}“? Rufen Sie uns an oder schreiben Sie uns – wir melden uns zeitnah und vereinbaren einen kostenlosen Besichtigungstermin.`,
      }),
    ]);

  const pageTitle = `${city ? `${title} in ${city}` : title} – ${name}`;
  const description = `${title}${city ? ` in ${city} und Umgebung` : ""}: ${lead}`.replace(/\s+/g, " ");
  return page(d, pageCtx, pageTitle.slice(0, 70), description.slice(0, 160), body, {
    home: false,
    index: !ctx.preview,
    jsonLd: serviceJsonLd(d, pageCtx, sv) + faqJsonLd(faq),
    script: true,
  });
}

function faqJsonLd(faq: Faq[]): string {
  if (!faq.length) return "";
  const data = {
    "@context": "https://schema.org",
    "@type": "FAQPage",
    mainEntity: faq.map((f) => ({ "@type": "Question", name: f.q, acceptedAnswer: { "@type": "Answer", text: f.a } })),
  };
  return `<script type="application/ld+json">${JSON.stringify(data).replace(/</g, "\\u003c")}</script>`;
}

function serviceJsonLd(d: SiteData, ctx: Ctx, sv: Service): string {
  const c = d.company;
  const data = {
    "@context": "https://schema.org",
    "@type": "Service",
    name: sv.title,
    serviceType: sv.title,
    description: sv.text || undefined,
    image: safeUrl(sv.image) || undefined,
    url: ctx.canonical,
    areaServed: areaList(d.service_area).map((n) => ({ "@type": "City", name: n })),
    provider: {
      "@type": "HousePainter",
      name: c.name || undefined,
      telephone: c.phone || undefined,
      url: ctx.canonical.replace(/\/[^/]+$/, ""),
      address: c.street
        ? { "@type": "PostalAddress", streetAddress: c.street, postalCode: c.zip || undefined, addressLocality: c.city || undefined, addressCountry: "DE" }
        : undefined,
    },
  };
  return `<script type="application/ld+json">${JSON.stringify(data).replace(/</g, "\\u003c")}</script>`;
}

export function renderImprint(d: SiteData, ctx: Ctx): string {
  const c = d.company;
  const rows: string[] = [];
  rows.push(`<p><strong>${esc(c.name)}</strong>${d.legal_form ? `<br>${esc(d.legal_form)}` : ""}<br>${esc(c.street)}<br>${esc([c.zip, c.city].filter(Boolean).join(" "))}<br>Deutschland</p>`);
  if (d.owner_name) rows.push(`<p>Vertreten durch: ${esc(d.owner_name)}</p>`);
  rows.push(
    `<h2>Kontakt</h2><p>${c.phone ? `Telefon: ${esc(c.phone)}<br>` : ""}${c.email ? `E-Mail: ${emailLink(c.email)}` : ""}</p>`
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
  const contact = `${esc(c.name)}, ${esc(c.street)}, ${esc([c.zip, c.city].filter(Boolean).join(" "))}${c.email ? `, E-Mail: ${encodeEmail(c.email)}` : ""}${c.phone ? `, Telefon: ${esc(c.phone)}` : ""}`;
  const body = `<div class="wrap legal"><h1>Datenschutzerklärung</h1>
<h2>1. Verantwortlicher</h2><p>${contact}</p>
<h2>2. Allgemeines</h2><p>Wir verarbeiten personenbezogene Daten nur, soweit dies zur Bereitstellung dieser Website und zur Bearbeitung Ihrer Anfragen erforderlich ist. Diese Website verwendet keine Cookies, keine Tracking-Werkzeuge von Drittanbietern und lädt keine Schriften oder Inhalte von Drittanbietern.</p><p>Um zu sehen, wie die Website genutzt wird, zählen wir Seitenaufrufe anonym: Gespeichert werden nur Tagessummen je Seite und die grobe Herkunft eines Besuchs (z. B. „Google“ oder „direkt“). IP-Adressen, Gerätekennungen oder Cookies werden dafür nicht verwendet; ein Rückschluss auf einzelne Personen ist nicht möglich. Die Tageswerte werden nach 13 Monaten gelöscht.</p>
<h2>3. Hosting und Server-Protokolle</h2><p>Die Website wird über die Software „Maler-SaaS“ bereitgestellt und bei Vercel Inc. (USA) gehostet; die Inhalte werden bei Supabase gespeichert. Beim Aufruf werden technisch notwendige Daten (z. B. IP-Adresse, Datum und Uhrzeit, aufgerufene Seite, Browsertyp) kurzzeitig in Server-Protokollen verarbeitet, um die Website sicher und stabil auszuliefern. Rechtsgrundlage ist Art. 6 Abs. 1 lit. f DSGVO (berechtigtes Interesse an einem sicheren Betrieb). Mit den Dienstleistern bestehen Verträge zur Auftragsverarbeitung; Übermittlungen in die USA erfolgen auf Grundlage des EU-US Data Privacy Framework bzw. von Standardvertragsklauseln.</p>
${
  d.contact_form !== false
    ? `<h2>4. Kontaktformular, E-Mail und Telefon</h2><p>Wenn Sie uns über das Kontaktformular, per E-Mail oder telefonisch kontaktieren, verarbeiten wir Ihre Angaben (Name, Kontaktdaten, Anliegen, gewünschte Leistungen und ggf. mitgesendete Fotos) zur Bearbeitung Ihrer Anfrage und für mögliche Anschlussfragen. Rechtsgrundlage ist Art. 6 Abs. 1 lit. b DSGVO (Anbahnung eines Vertrags) bzw. lit. f DSGVO. Fotos werden bereits in Ihrem Browser verkleinert; dabei werden eingebettete Zusatzdaten wie Standortangaben entfernt. Die Daten werden gelöscht, sobald sie nicht mehr erforderlich sind und keine gesetzlichen Aufbewahrungspflichten bestehen.</p>`
    : ""
}
<h2>${d.contact_form !== false ? "5" : "4"}. Bilder von Projekten und Kundenbewertungen</h2><p>Bilder von Kundenprojekten veröffentlichen wir nur mit Einwilligung der jeweiligen Auftraggeber und ohne Angabe der genauen Anschrift. Kundenbewertungen (Sterne, Kommentar, Vorname mit Anfangsbuchstabe des Nachnamens bzw. Firmenname und Ort) veröffentlichen wir nur, wenn die Kundin oder der Kunde beim Bewerten ausdrücklich eingewilligt hat (Art. 6 Abs. 1 lit. a DSGVO). Die Einwilligung kann jederzeit mit Wirkung für die Zukunft widerrufen werden; eine kurze Nachricht an die oben genannten Kontaktdaten genügt. In den angezeigten Durchschnittswert fließen alle Bewertungen ohne Namen ein.</p>
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
  if (!res.ok) throw Object.assign(new Error(`rpc ${fn} → ${res.status}`), { status: res.status });
  return res.json();
}

type Lead = { name: string; email: string; phone: string; message: string; services: string[]; photos: string[] };

async function sendLeadMail(to: string, company: string, lead: Lead, siteUrl: string) {
  const key = env("BREVO_API_KEY");
  const sender = env("BREVO_SENDER_EMAIL");
  if (!key || !sender || !to) return;
  const html = `<p>Neue Anfrage über Ihre Website:</p>
<p><strong>${esc(lead.name)}</strong><br>${lead.phone ? `Telefon: ${esc(lead.phone)}<br>` : ""}${lead.email ? `E-Mail: ${esc(lead.email)}` : ""}</p>
${lead.services.length ? `<p><strong>Gewünschte Leistungen:</strong> ${lead.services.map(esc).join(", ")}</p>` : ""}
<p>${esc(lead.message).replace(/\n/g, "<br>")}</p>
${lead.photos.length ? `<p>${lead.photos.length} Foto${lead.photos.length > 1 ? "s" : ""} im Anhang.</p>` : ""}
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
      attachment: lead.photos.length ? lead.photos.map((content, i) => ({ name: `foto-${i + 1}.jpg`, content })) : undefined,
    }),
  }).catch(() => undefined);
}

// ---------------------------------------------------------------------
// Einstieg
// ---------------------------------------------------------------------
// ---------------------------------------------------------------------
// Adressen
// ---------------------------------------------------------------------
const SLUG_RE = /^[a-z0-9][a-z0-9-]{1,48}[a-z0-9]$/;
const DOMAIN_RE = /^([a-z0-9]([a-z0-9-]{0,61}[a-z0-9])?\.)+[a-z]{2,24}$/;
export const SUBDOMAIN_SUFFIX = ".maler-saas.com";

/** Subdomains erst nach dem Test einschalten (Vercel-Umgebungsvariable SITE_SUBDOMAINS=1) */
export const subdomainsEnabled = () => env("SITE_SUBDOMAINS") === "1";

export function preferredSiteUrl(d: SiteData, origin: string): string {
  if (d.custom_domain && DOMAIN_RE.test(d.custom_domain)) return `https://${d.custom_domain}`;
  if (subdomainsEnabled()) return `https://${d.slug}${SUBDOMAIN_SUFFIX}`;
  return `${origin}/w/${d.slug}`;
}

/** Website-Schlüssel aus der Anfrage: ?host=… (eigene Adresse, von middleware.ts) oder ?slug=… (Pfad /w/…) */
export function siteKey(url: URL): { key: string; root: boolean; host?: string } | null {
  const host = (url.searchParams.get("host") || "").toLowerCase().replace(/:\d+$/, "").replace(/\.$/, "");
  if (host) {
    if (host.endsWith(SUBDOMAIN_SUFFIX)) {
      const sub = host.slice(0, -SUBDOMAIN_SUFFIX.length);
      return SLUG_RE.test(sub) ? { key: sub, root: true, host } : null;
    }
    return DOMAIN_RE.test(host) && host.length <= 253 ? { key: host, root: true, host } : null;
  }
  const slug = (url.searchParams.get("slug") || "").toLowerCase();
  return SLUG_RE.test(slug) ? { key: slug, root: false } : null;
}

const HTML_HEADERS = { "content-type": "text/html; charset=utf-8", "x-content-type-options": "nosniff", "referrer-policy": "strict-origin-when-cross-origin" };

export async function handle(request: Request): Promise<Response> {
  const url = new URL(request.url);
  // Vorschläge für den Editor in der App (gleiche Texte wie auf den Websites)
  if (url.searchParams.get("action") === "vorschlaege") {
    return Response.json(serviceSuggestions(url.searchParams.get("icon") || ""), { headers: { "cache-control": "public, max-age=3600" } });
  }
  const origin = env("SITE_ORIGIN") || "https://maler-saas.com";

  // Besucherzähler (vom Skript auf der Website, ohne Cookies)
  if (url.searchParams.get("action") === "hit") {
    const siteParam = (url.searchParams.get("site") || "").toLowerCase();
    const pageParam = (url.searchParams.get("page") || "").toLowerCase().slice(0, 70);
    const src = (url.searchParams.get("src") || "").toLowerCase();
    if (request.method === "POST" && SLUG_RE.test(siteParam) && /^[a-z0-9-]{0,70}$/.test(pageParam)) {
      await rpc("website_track", {
        p_site: siteParam,
        p_page: pageParam,
        p_source: ["google", "bing", "social", "direkt", "andere"].includes(src) ? src : null,
      }).catch(() => undefined);
    }
    return new Response(null, { status: 204, headers: { "cache-control": "no-store" } });
  }

  // Kontaktformular (Formular sendet immer slug mit; "basis" = "" bei eigener Adresse, sonst /w/<slug>)
  if (request.method === "POST" && url.searchParams.get("action") === "contact") {
    const slug = (url.searchParams.get("slug") || "").toLowerCase();
    if (!SLUG_RE.test(slug)) return notFound(origin);
    const form = await request.formData().catch(() => null);
    const base = String(form?.get("basis") ?? "x") === "" ? "" : `/w/${slug}`;
    const seite = String(form?.get("seite") ?? "").toLowerCase();
    const target = /^[a-z0-9-]{1,70}$/.test(seite) && !["impressum", "datenschutz"].includes(seite) ? `${base}/${seite}` : base || "/";
    const reqHost = (request.headers.get("x-forwarded-host") || request.headers.get("host") || "").toLowerCase();
    const siteUrl = base === "" && DOMAIN_RE.test(reqHost.replace(/:\d+$/, "")) ? `https://${reqHost.replace(/:\d+$/, "")}` : `${origin}/w/${slug}`;
    const back = (q: string) => new Response(null, { status: 303, headers: { location: `${target}?${q}#kontakt` } });
    if (!form) return back("fehler=formular");
    const get = (k: string) => String(form.get(k) ?? "").trim();
    const started = Number(get("t"));
    // Spam-Schutz: verstecktes Feld ausgefüllt oder Formular in < 3 Sekunden abgeschickt -> still verwerfen
    if (get("website") || !started || Date.now() - started < 3000) return back("gesendet=1");
    const services = form
      .getAll("leistung")
      .map((v) => String(v).trim().slice(0, 60))
      .filter(Boolean)
      .slice(0, 12);
    // Fotos: im Browser verkleinerte JPEGs als Base64 (beginnen mit "/9j/"), max. 3 und je ca. 1,5 MB
    const photos = form
      .getAll("foto")
      .map((v) => String(v).replace(/\s/g, ""))
      .filter((v) => v.startsWith("/9j/") && v.length <= 2_100_000 && /^[A-Za-z0-9+/=]+$/.test(v))
      .slice(0, 3);
    const lead: Lead = { name: get("name"), email: get("email"), phone: get("phone"), message: get("message"), services, photos };
    try {
      let r;
      try {
        r = await rpc("website_submit_lead2", {
          p_slug: slug, p_name: lead.name, p_email: lead.email, p_phone: lead.phone, p_message: lead.message, p_services: services, p_photos: photos,
        });
      } catch (e) {
        // Datenbank-Update noch nicht eingespielt -> alte Funktion, Leistungen in den Text, ohne Fotos
        if ((e as { status?: number }).status !== 404) throw e;
        const msg = [services.length ? `Gewünschte Leistungen: ${services.join(", ")}` : "", lead.message].filter(Boolean).join("\n\n");
        r = await rpc("website_submit_lead", { p_slug: slug, p_name: lead.name, p_email: lead.email, p_phone: lead.phone, p_message: msg });
        lead.message = msg;
        lead.services = [];
        lead.photos = [];
      }
      if (!r?.ok) {
        const err = r?.error === "invalid_email" ? "email" : r?.error === "rate_limited" ? "spaeter" : r?.error === "photos" ? "fotos" : "angaben";
        return back(`fehler=${err}`);
      }
      if (!lead.message && services.length) lead.message = `Anfrage zu: ${services.join(", ")}`;
      if (typeof r.photos === "number" && r.photos < lead.photos.length) lead.photos = lead.photos.slice(0, r.photos);
      await sendLeadMail(r.notify_email, r.company, lead, siteUrl);
      return back("gesendet=1");
    } catch {
      return back("fehler=server");
    }
  }
  if (request.method !== "GET" && request.method !== "HEAD") return new Response("Method not allowed", { status: 405 });

  // Welche Website? Eigene Adresse (über middleware.ts: ?host=…) oder Pfad /w/<slug>
  const site = siteKey(url);
  if (!site) return notFound(origin);
  const base = site.root ? "" : `/w/${site.key}`;

  const preview = url.searchParams.get("vorschau") || "";
  let data: SiteData | null = null;
  try {
    data = await rpc("website_public", { p_slug: site.key, p_preview: preview || null });
  } catch {
    return new Response("Die Seite ist vorübergehend nicht erreichbar.", { status: 503, headers: { "content-type": "text/plain; charset=utf-8" } });
  }
  if (!data) return notFound(origin);

  const isPreview = !data.published;
  const pagePath = (url.searchParams.get("page") || "").replace(/^\/+|\/+$/g, "").toLowerCase();

  // Bevorzugte Adresse: eigene Domain > Subdomain (wenn eingeschaltet) > maler-saas.com/w/<slug>
  const preferred = preferredSiteUrl(data, origin);
  const current = site.root ? `https://${site.host}` : `${origin}/w/${data.slug}`;
  const preferredIsOwn = !!data.custom_domain || subdomainsEnabled();
  if (!isPreview && preferredIsOwn && preferred !== current) {
    const keep = new URLSearchParams();
    for (const k of ["gesendet", "fehler"]) if (url.searchParams.get(k)) keep.set(k, url.searchParams.get(k)!);
    const qs = keep.toString();
    return new Response(null, {
      status: 301,
      headers: { location: `${preferred}${pagePath && pagePath !== "index.html" ? `/${pagePath}` : "/"}${qs ? `?${qs}` : ""}`, "cache-control": "public, s-maxage=300" },
    });
  }
  const errors: Record<string, string> = {
    email: "Bitte prüfen Sie Ihre E-Mail-Adresse.",
    spaeter: "Gerade gehen sehr viele Anfragen ein. Bitte versuchen Sie es später noch einmal oder rufen Sie uns an.",
    angaben: "Bitte geben Sie Ihren Namen, Ihr Anliegen und Telefon oder E-Mail an.",
    formular: "Das Formular konnte nicht gelesen werden. Bitte erneut versuchen.",
    fotos: "Die Fotos konnten nicht verarbeitet werden. Bitte senden Sie die Anfrage ohne Fotos oder mit anderen Bildern.",
    server: "Die Anfrage konnte gerade nicht gesendet werden. Bitte rufen Sie uns an.",
  };
  const ctx: Ctx = {
    base,
    origin,
    canonical: preferred,
    slug: data.slug,
    page: pagePath === "index.html" ? "" : pagePath,
    preview: isPreview,
    q: isPreview ? `?vorschau=${encodeURIComponent(preview)}` : "",
    notice: url.searchParams.get("gesendet") ? "ok" : errors[url.searchParams.get("fehler") || ""] || undefined,
  };
  const cache = isPreview ? "private, no-store" : "public, s-maxage=120, stale-while-revalidate=600";

  if (pagePath === "robots.txt") {
    return new Response(`User-agent: *\nAllow: /\nSitemap: ${preferred}/sitemap.xml\n`, { headers: { "content-type": "text/plain; charset=utf-8", "cache-control": cache } });
  }
  if (pagePath === "sitemap.xml") {
    const pages = sectionsOf(data).services ? serviceSlugs(servicesOf(data)).map((sl) => `${ctx.canonical}/${sl}`) : [];
    const xml = `<?xml version="1.0" encoding="UTF-8"?>\n<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">${[ctx.canonical, ...pages]
      .map((u) => `<url><loc>${esc(u)}</loc></url>`)
      .join("")}</urlset>`;
    return new Response(xml, { headers: { "content-type": "application/xml; charset=utf-8", "cache-control": cache } });
  }

  let html: string;
  if (pagePath === "" || pagePath === "index.html") html = renderHome(data, ctx);
  else if (pagePath === "impressum") html = renderImprint(data, ctx);
  else if (pagePath === "datenschutz") html = renderPrivacy(data, ctx);
  else {
    const found = sectionsOf(data).services && /^[a-z0-9-]{1,70}$/.test(pagePath) ? findService(data, pagePath) : null;
    if (!found) return notFound(origin);
    if (found.moved) return new Response(null, { status: 301, headers: { location: `${base}/${found.slug}${ctx.q ?? ""}`, "cache-control": cache } });
    html = renderService(data, ctx, found);
  }

  const headers = { ...HTML_HEADERS, "cache-control": cache };
  return new Response(request.method === "HEAD" ? null : html, { status: 200, headers });
}

export default {
  fetch(request: Request) {
    return handle(request);
  },
};
