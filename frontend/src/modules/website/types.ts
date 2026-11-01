// Modul Website: Typen und Konstanten

export type WebsiteTheme = "klassisch" | "modern" | "frisch";

export type WebsiteService = { title: string; text: string; icon?: string };

export type WebsiteSections = {
  services: boolean;
  process: boolean;
  references: boolean;
  reviews: boolean;
  about: boolean;
  area: boolean;
  contact: boolean;
};

export type Website = {
  tenant_id: number;
  slug: string;
  published: boolean;
  preview_token: string;
  theme: WebsiteTheme;
  accent_color: string;
  hero_title: string | null;
  hero_subtitle: string | null;
  hero_image_url: string | null;
  highlights: string[];
  services: WebsiteService[];
  about_title: string | null;
  about_text: string | null;
  service_area: string | null;
  opening_hours: string | null;
  sections: WebsiteSections;
  contact_form: boolean;
  seo_title: string | null;
  seo_description: string | null;
  owner_name: string | null;
  legal_form: string | null;
  register_court: string | null;
  register_number: string | null;
  chamber: string | null;
  job_title: string | null;
  job_title_country: string | null;
  privacy_extra: string | null;
  updated_at: string;
};

export type WebsiteImage = { url: string; path: string; alt?: string };

export type WebsiteReference = {
  id: number;
  tenant_id: number;
  order_id: string | null;
  title: string;
  text: string | null;
  city: string | null;
  images: WebsiteImage[];
  consent_confirmed: boolean;
  status: "entwurf" | "veroeffentlicht";
  published_at: string | null;
  created_at: string;
};

export type WebsiteLead = {
  id: number;
  name: string;
  email: string | null;
  phone: string | null;
  message: string;
  status: "neu" | "erledigt";
  created_at: string;
  services?: string[] | null;
  photo_count?: number | null;
};

/** Symbole für Leistungen – Schlüssel müssen zu SERVICE_ICONS in frontend/api/site.ts passen */
export const SERVICE_ICON_KEYS = [
  ["rolle", "Farbrolle"],
  ["pinsel", "Pinsel / Lack"],
  ["haus", "Haus / Fassade"],
  ["tapete", "Tapete"],
  ["spachtel", "Spachtel / Putz"],
  ["boden", "Boden"],
  ["tuer", "Türen / Fenster"],
  ["schutz", "Schutz / Schimmel"],
  ["daemmung", "Dämmung"],
  ["mauer", "Mauerwerk"],
  ["spray", "Spritztechnik"],
  ["palette", "Farbberatung"],
  ["gewerbe", "Gewerbe"],
  ["holz", "Holz / Zaun"],
  ["wasser", "Wasserschaden"],
  ["werkzeug", "Reparatur"],
  ["stern", "Sonstiges"],
] as const;
export type ServiceIconKey = (typeof SERVICE_ICON_KEYS)[number][0];

const ICON_RULES: [RegExp, ServiceIconKey][] = [
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

/** Automatisch gewähltes Symbol (gleiche Regeln wie auf der Website) */
export function guessServiceIcon(title: string): ServiceIconKey {
  const t = title.toLowerCase();
  for (const [re, key] of ICON_RULES) if (re.test(t)) return key;
  return "rolle";
}

/** Bewertung aus dem Kundenportal, für die der Kunde der Veröffentlichung zugestimmt hat */
export type WebsiteReview = {
  review_id: number;
  overall_rating: number;
  comment: string | null;
  display_name: string;
  city: string | null;
  created_at: string;
  approved: boolean;
  order_title: string | null;
};

export type WebsiteReviewOverview = {
  count: number;
  average: number | null;
  without_consent: number;
  items: WebsiteReview[];
};

export type CompanyInfo = {
  company_name: string | null;
  street: string | null;
  zip: string | null;
  city: string | null;
  phone: string | null;
  email: string | null;
  vat_id: string | null;
  logo_url: string | null;
};

export type OrderOption = {
  id: string;
  title: string;
  status: string;
  address_city: string | null;
  end_date: string | null;
  created_at?: string;
};

export type OrderImage = { id: number; url: string };

export const THEMES: { value: WebsiteTheme; label: string; hint: string }[] = [
  { value: "klassisch", label: "Klassisch", hint: "Hell, ruhig, Serifen-Überschriften – seriös und zeitlos" },
  { value: "modern", label: "Modern", hint: "Großes Titelbild mit dunkler Fläche – kräftig und edel" },
  { value: "frisch", label: "Frisch", hint: "Farbige Titelfläche, runde Ecken – freundlich und lebendig" },
];

export const ACCENT_PRESETS = ["#1d4e89", "#2f7d4f", "#b5452a", "#7a3e9d", "#c27c0e", "#24323f"];

export const DEFAULT_SERVICES: WebsiteService[] = [
  { title: "Innenanstrich", text: "Wände und Decken in Wohnungen, Häusern und Büros – sauber abgedeckt und staubarm." },
  { title: "Fassadenanstrich", text: "Schutz und neuer Glanz für Ihre Fassade – mit Untergrundprüfung und passender Farbe." },
  { title: "Tapezierarbeiten", text: "Raufaser, Vlies- oder Designtapeten – fachgerecht vorbereitet und verklebt." },
  { title: "Lackierarbeiten", text: "Türen, Fenster, Heizkörper und Treppen – langlebig lackiert." },
  { title: "Spachtel- und Putzarbeiten", text: "Glatte Wände, Q-Stufen bis Q4, dekorative Putze." },
  { title: "Bodenbeläge", text: "Vinyl, Laminat und Teppich – verlegt von Profis." },
];

export const DEFAULT_HIGHLIGHTS = ["Meisterbetrieb", "Kostenlose Besichtigung", "Festpreis-Angebot", "Saubere Baustelle"];

export const DEFAULT_SECTIONS: WebsiteSections = { services: true, process: true, references: true, reviews: true, about: true, area: true, contact: true };

/** Website für Starter-Tarif gesperrt (Professional, Business, Enterprise) */
export function hasWebsiteAccess(plan: string | null | undefined): boolean {
  return plan === "professional" || plan === "business" || plan === "enterprise";
}

export const SITE_ORIGIN = "https://maler-saas.com";

export function siteUrl(slug: string): string {
  return `${SITE_ORIGIN}/w/${slug}`;
}

export function previewUrl(w: Pick<Website, "slug" | "preview_token">): string {
  return `${siteUrl(w.slug)}?vorschau=${w.preview_token}`;
}

export const RESERVED_SLUGS = [
  "www", "app", "api", "admin", "mail", "smtp", "imap", "pop", "ftp", "webmail", "support", "hilfe", "help", "status",
  "blog", "shop", "static", "assets", "cdn", "dev", "test", "staging", "demo", "docs", "login", "konto", "preise", "w",
];

/** "Malerbetrieb Müller GmbH" -> "malerbetrieb-mueller" */
export function slugify(name: string): string {
  const s = name
    .toLowerCase()
    .replace(/ä/g, "ae")
    .replace(/ö/g, "oe")
    .replace(/ü/g, "ue")
    .replace(/ß/g, "ss")
    .normalize("NFKD")
    .replace(/[̀-ͯ]/g, "")
    .replace(/\b(gmbh|ug|haftungsbeschraenkt|e\.?\s?k\.?|ohg|kg|gbr|mbh|co)\b/g, " ")
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "")
    .replace(/-{2,}/g, "-")
    .slice(0, 50)
    .replace(/-+$/g, "");
  return s.length >= 3 ? s : `maler-${s || "betrieb"}`.slice(0, 50);
}

export function slugError(slug: string): string | null {
  if (!/^[a-z0-9][a-z0-9-]{1,48}[a-z0-9]$/.test(slug)) {
    return "Nur Kleinbuchstaben, Ziffern und Bindestriche, 3–50 Zeichen, nicht mit Bindestrich beginnen oder enden.";
  }
  if (RESERVED_SLUGS.includes(slug)) return "Diese Adresse ist reserviert. Bitte eine andere wählen.";
  return null;
}

/** Was fürs Impressum noch fehlt (Pflichtangaben) */
export function imprintGaps(company: CompanyInfo | null, w: Pick<Website, "owner_name" | "legal_form">): string[] {
  const gaps: string[] = [];
  if (!company?.company_name) gaps.push("Firmenname");
  if (!company?.street || !company?.zip || !company?.city) gaps.push("Firmenadresse");
  if (!company?.email && !company?.phone) gaps.push("E-Mail oder Telefon");
  if (!w.owner_name) gaps.push("Inhaber bzw. Geschäftsführer");
  return gaps;
}
