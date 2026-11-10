// Modul Website: Typen und Konstanten

export type WebsiteTheme = "klassisch" | "modern" | "frisch";

export type WebsiteFaq = { q: string; a: string };
export type WebsiteService = {
  title: string;
  text: string;
  icon?: string;
  /** Inhalte der eigenen Leistungsseite (leer = Standard) */
  details?: string;
  included?: string[];
  faq?: WebsiteFaq[];
  image?: string;
  /** frühere Adressen nach Umbenennen (werden auf die aktuelle Seite weitergeleitet) */
  aliases?: string[];
};

export type WebsiteSections = {
  services: boolean;
  /** Fotos statt Symbole in den Leistungskarten der Startseite */
  service_photos: boolean;
  process: boolean;
  faq: boolean;
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
  about_image_url?: string | null;
  service_area: string | null;
  opening_hours: string | null;
  whatsapp_number?: string | null;
  faq?: WebsiteFaq[];
  /** Online-Terminbuchung (undefined = Datenbank-Update fehlt noch, null = nie eingestellt) */
  booking?: WebsiteBooking | null;
  /** KI-Chat (undefined = Datenbank-Update fehlt noch) */
  chat?: WebsiteChatSettings | null;
  /** Stellenanzeigen (undefined = Datenbank-Update fehlt noch) */
  jobs?: WebsiteJob[];
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
  terms_text?: string | null;
  updated_at: string;
  /** eigene Domain (nur über die Funktion website-domain änderbar) */
  custom_domain?: string | null;
  custom_domain_status?: "pending" | "active" | "error" | null;
  /** Werbung: tägliche Vorschläge der KI aus abgeschlossenen Aufträgen (Standard an) */
  marketing_auto?: boolean;
  custom_domain_checked_at?: string | null;
  custom_domain_error?: string | null;
};

export type WebsiteImage = { url: string; path: string; alt?: string; kind?: "vorher" | "nachher" | null };

// ---------------------------------------------------------------------
// Werbung (KI-Beiträge für Website und soziale Netzwerke)
// ---------------------------------------------------------------------
export type MarketingChannel = "website" | "instagram" | "facebook" | "google" | "whatsapp";
export type MarketingImage = { image_id?: number; url?: string; path?: string; kind?: "vorher" | "nachher" | null };
export type MarketingPost = {
  id: number;
  tenant_id: number;
  order_id: string | null;
  reference_id: number | null;
  source: "manuell" | "vorschlag";
  status: "vorschlag" | "entwurf" | "veroeffentlicht" | "verworfen";
  title: string | null;
  city: string | null;
  texts: Partial<Record<MarketingChannel, string>>;
  images: MarketingImage[];
  warnings: string[];
  shared: Partial<Record<MarketingChannel, string>>;
  consent_confirmed: boolean;
  created_at: string;
  updated_at: string;
};

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

export const DEFAULT_SECTIONS: WebsiteSections = { services: true, service_photos: false, process: true, faq: true, references: true, reviews: true, about: true, area: true, contact: true };

/** Website für Starter-Tarif gesperrt (Professional, Business, Enterprise) */
/** Website (und Fachkräfte-Pool) gehören zum Tarif Enterprise – in der Testphase für alle Tarife */
export function hasWebsiteAccess(plan: string | null | undefined, status?: string | null, isTrial?: boolean | null): boolean {
  return plan === "enterprise" || status === "trialing" || isTrial === true;
}

export const SITE_ORIGIN = "https://maler-saas.com";

/**
 * Subdomains (betrieb.maler-saas.com) als Hauptadresse – gemeinsam mit der Vercel-Umgebungsvariable
 * SITE_SUBDOMAINS=1 einschalten, sobald *.maler-saas.com in Vercel eingerichtet und getestet ist.
 */
export const SUBDOMAINS_ENABLED = true;
export const SUBDOMAIN_SUFFIX = ".maler-saas.com";

/** Adresse über maler-saas.com (Subdomain oder /w/<slug>) */
export function siteUrl(slug: string): string {
  return SUBDOMAINS_ENABLED ? `https://${slug}${SUBDOMAIN_SUFFIX}` : `${SITE_ORIGIN}/w/${slug}`;
}

/**
 * Domain kaufen (Hilfe für Betriebe ohne eigene Domain).
 * DOMAIN_PARTNER_URL: persönlicher Partnerlink (z. B. aus affiliate.ionos.com). Ist er gesetzt, zeigt die App den
 * vorgeschriebenen Hinweis auf die Vermittlungsprovision. Ohne Partnerlink: normaler Link, kein Hinweis.
 */
export const DOMAIN_SHOP_URL = "https://www.ionos.de/domains/domain-check";
export const DOMAIN_PARTNER_URL: string | null = null;

/** Vorschläge für eine Wunschdomain aus Firmenname und Ort (nur Vorschläge – ob frei, zeigt der Anbieter) */
export function domainSuggestions(companyName: string | null | undefined, city: string | null | undefined): string[] {
  const clean = (s: string) =>
    s
      .toLowerCase()
      .replace(/ä/g, "ae")
      .replace(/ö/g, "oe")
      .replace(/ü/g, "ue")
      .replace(/ß/g, "ss")
      .replace(/\b(gmbh|ug|haftungsbeschraenkt|e\.?\s?k\.?|ohg|kg|gbr|mbh|co|und|&|die|der|das)\b/g, " ")
      .replace(/[^a-z0-9]+/g, "-")
      .replace(/^-+|-+$/g, "");
  const name = clean(companyName ?? "");
  const ort = clean(city ?? "");
  const core = name.replace(/\b(malerbetrieb|maler|malermeister|malerfachbetrieb|lackierer|malerwerkstatt)\b/g, "").replace(/-+/g, "-").replace(/^-|-$/g, "");
  const out = [
    name && `${name}.de`,
    core && `maler-${core}.de`,
    core && ort && `maler-${core}-${ort}.de`,
    core && ort && `${core}-${ort}.de`,
  ].filter((x): x is string => !!x && x.length <= 63 + 3 && !x.startsWith("-"));
  return [...new Set(out)].slice(0, 4);
}

/** Öffentliche Hauptadresse: eigene Domain (wenn aktiv) oder siteUrl */
export function publicUrl(w: Pick<Website, "slug" | "custom_domain" | "custom_domain_status">): string {
  return w.custom_domain && w.custom_domain_status === "active" ? `https://${w.custom_domain}` : siteUrl(w.slug);
}

export function previewUrl(w: Pick<Website, "slug" | "preview_token">): string {
  // Vorschau immer über maler-saas.com/w/… (funktioniert unabhängig von Subdomain und Domain)
  return `${SITE_ORIGIN}/w/${w.slug}?vorschau=${w.preview_token}`;
}

export const RESERVED_SLUGS = [
  "www", "app", "api", "admin", "mail", "smtp", "imap", "pop", "ftp", "webmail", "support", "hilfe", "help", "status",
  "blog", "shop", "static", "assets", "cdn", "dev", "test", "staging", "demo", "docs", "login", "konto", "preise", "w",
];

/** "Malerbetrieb Müller GmbH" -> "malerbetrieb-mueller" */
/**
 * Vorschläge für allgemeine Fragen auf der Startseite. Bewusst nur als Vorlage im Editor –
 * die Antworten müssen zum Betrieb passen und werden erst nach dem Speichern veröffentlicht.
 */
export const GENERAL_FAQ_SUGGESTIONS: WebsiteFaq[] = [
  { q: "Sind Besichtigung und Angebot kostenlos?", a: "Ja. Wir kommen unverbindlich zu Ihnen, schauen uns alles vor Ort an und schicken Ihnen danach ein schriftliches Angebot." },
  { q: "Wie schnell bekomme ich einen Termin?", a: "Für die Besichtigung meist innerhalb weniger Tage. Wann wir mit den Arbeiten beginnen können, sagen wir Ihnen mit dem Angebot." },
  { q: "Wie wird abgerechnet?", a: "So, wie es im Angebot steht – als Festpreis oder nach Aufmaß. Zusätzliche Arbeiten führen wir nur nach Absprache mit Ihnen aus." },
  { q: "Muss ich während der Arbeiten zu Hause sein?", a: "Nicht unbedingt. Viele Kunden geben uns einen Schlüssel. Zu Beginn und zur Abnahme sollten Sie aber kurz da sein." },
  { q: "Müssen die Möbel ausgeräumt werden?", a: "Nein. Wir rücken Möbel zur Seite und decken Möbel und Böden sorgfältig ab. Wertgegenstände und Zerbrechliches räumen Sie am besten vorher weg." },
  { q: "Arbeiten Sie auch für Vermieter, Hausverwaltungen und Gewerbe?", a: "Ja, wir arbeiten für Privatkunden ebenso wie für Vermieter, Hausverwaltungen und Gewerbebetriebe." },
  { q: "Sind Sie versichert?", a: "Ja, wir haben eine Betriebshaftpflichtversicherung. Sollte bei uns doch einmal etwas zu Bruch gehen, sind Sie abgesichert." },
  { q: "Kann ich die Farben selbst aussuchen?", a: "Natürlich. Wir beraten Sie gern und bringen auf Wunsch Farbmuster mit, damit Sie die Wirkung direkt an Ihrer Wand sehen." },
];

/** Adresse der Projektseite einer Referenz – gleiche Regel wie referenceSlug in frontend/api/site.ts */
export function referenceSlug(id: number, title: string): string {
  const base = title
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
    .replace(/-+$/g, "")
    .slice(0, 50)
    .replace(/-+$/g, "");
  return `projekt-${base ? `${base}-` : ""}${id}`;
}

/** Adressen der Leistungsseiten – gleiche Regeln wie serviceSlugs in frontend/api/site.ts */
const RESERVED_SERVICE_PAGES = new Set(["impressum", "datenschutz", "agb", "robots-txt", "sitemap-xml", "index-html", "kontakt", "leistungen"]);
export function serviceSlugs(titles: string[]): string[] {
  const used = new Set<string>();
  return titles.map((title) => {
    let base =
      title
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
    if (RESERVED_SERVICE_PAGES.has(base)) base = `${base}-leistung`;
    let slug = base;
    for (let n = 2; used.has(slug); n++) slug = `${base}-${n}`;
    used.add(slug);
    return slug;
  });
}

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

// ---------------------------------------------------------------------
// Online-Terminbuchung (Besichtigungen)
// ---------------------------------------------------------------------
export type WebsiteBooking = {
  enabled: boolean;
  visit_duration_minutes: number;
  buffer_minutes: number;
  min_notice_hours: number;
  booking_horizon_days: number;
  slot_step_minutes: number;
  timezone: string;
  availability: Record<string, [string, string][]>;
};

export const DEFAULT_BOOKING: WebsiteBooking = {
  enabled: false,
  visit_duration_minutes: 60,
  buffer_minutes: 30,
  min_notice_hours: 24,
  booking_horizon_days: 21,
  slot_step_minutes: 30,
  timezone: "Europe/Berlin",
  availability: {
    "1": [["09:00", "12:00"], ["13:00", "17:00"]],
    "2": [["09:00", "12:00"], ["13:00", "17:00"]],
    "3": [["09:00", "12:00"], ["13:00", "17:00"]],
    "4": [["09:00", "12:00"], ["13:00", "17:00"]],
    "5": [["09:00", "13:00"]],
    "6": [],
    "7": [],
  },
};

export const BOOKING_WEEKDAYS = [
  { key: "1", label: "Montag" },
  { key: "2", label: "Dienstag" },
  { key: "3", label: "Mittwoch" },
  { key: "4", label: "Donnerstag" },
  { key: "5", label: "Freitag" },
  { key: "6", label: "Samstag" },
  { key: "7", label: "Sonntag" },
];

export const BOOKING_TIMEZONES = [
  { value: "Europe/Berlin", label: "Deutschland (Berlin)" },
  { value: "Europe/Vienna", label: "Österreich (Wien)" },
  { value: "Europe/Zurich", label: "Schweiz (Zürich)" },
  { value: "Europe/Madrid", label: "Spanien (Madrid/Palma)" },
];

// ---------------------------------------------------------------------
// „Wir stellen ein“
// ---------------------------------------------------------------------
export type WebsiteJob = {
  id: string;
  title: string;
  employment: string;
  location: string;
  start: string;
  text: string;
  tasks: string[];
  profile: string[];
  benefits: string[];
  salary_min: number | null;
  salary_max: number | null;
  salary_unit: "HOUR" | "MONTH";
  active: boolean;
  posted_at: string;
};

export type WebsiteApplication = {
  id: number;
  job_id: string | null;
  job_title: string;
  name: string;
  email: string | null;
  phone: string | null;
  available_from: string | null;
  experience: string | null;
  driving_license: boolean | null;
  message: string | null;
  cv_name: string | null;
  cv_mime: string | null;
  status: "neu" | "kontaktiert" | "erledigt";
  created_at: string;
};

export const EMPLOYMENT_OPTIONS = [
  { value: "vollzeit", label: "Vollzeit" },
  { value: "teilzeit", label: "Teilzeit" },
  { value: "vollzeit_teilzeit", label: "Vollzeit oder Teilzeit" },
  { value: "minijob", label: "Minijob" },
  { value: "aushilfe", label: "Aushilfe / befristet" },
  { value: "ausbildung", label: "Ausbildung" },
];

/** Website-Pfad einer Stelle (muss zu jobSlug in api/site.ts passen) */
export function jobSlug(job: Pick<WebsiteJob, "id" | "title">): string {
  const base = (serviceSlugs([job.title])[0] ?? "").slice(0, 50).replace(/-+$/g, "");
  return `stelle-${base ? `${base}-` : ""}${job.id}`;
}

export const newJobId = () => Math.random().toString(36).slice(2, 8).padEnd(6, "0");

const today = () => new Date().toISOString().slice(0, 10);

/** Vorlagen, damit niemand bei null anfangen muss */
export const JOB_TEMPLATES: { label: string; job: Omit<WebsiteJob, "id" | "location" | "posted_at" | "active"> }[] = [
  {
    label: "Maler/in (Geselle)",
    job: {
      title: "Maler- und Lackierer/in (m/w/d)",
      employment: "vollzeit",
      start: "ab sofort",
      text: "Zur Verstärkung unseres Teams suchen wir eine/n Maler- und Lackierer/in in Vollzeit. Sie erwartet ein familiäres Team, abwechslungsreiche Aufträge bei Privat- und Gewerbekunden und ein sicherer, unbefristeter Arbeitsplatz.",
      tasks: ["Maler- und Tapezierarbeiten im Innenbereich", "Fassadenanstriche und Lackierarbeiten", "Spachtel- und Putzarbeiten", "Saubere Baustellen beim Kunden"],
      profile: ["Abgeschlossene Ausbildung als Maler/in und Lackierer/in", "Zuverlässige und sorgfältige Arbeitsweise", "Führerschein Klasse B wünschenswert"],
      benefits: ["Unbefristeter Arbeitsvertrag", "Pünktliche Bezahlung, Bezahlung nach Tarif", "Moderne Arbeitsmittel und Arbeitskleidung", "Feste Ansprechpartner und gutes Teamklima"],
      salary_min: null,
      salary_max: null,
      salary_unit: "HOUR",
    },
  },
  {
    label: "Helfer/in",
    job: {
      title: "Helfer/in im Malerhandwerk (m/w/d)",
      employment: "vollzeit_teilzeit",
      start: "ab sofort",
      text: "Sie packen gerne mit an und möchten im Handwerk arbeiten? Auch Quereinsteiger sind bei uns willkommen – wir arbeiten Sie gründlich ein.",
      tasks: ["Abkleben, Abdecken und Vorbereiten der Baustelle", "Unterstützung bei Maler- und Tapezierarbeiten", "Auf- und Abbau, Ordnung und Sauberkeit"],
      profile: ["Handwerkliches Geschick und Freude an der Arbeit", "Zuverlässigkeit und Pünktlichkeit", "Gute Deutschkenntnisse"],
      benefits: ["Einarbeitung durch erfahrene Kolleginnen und Kollegen", "Pünktliche Bezahlung", "Möglichkeit zur Weiterbildung"],
      salary_min: null,
      salary_max: null,
      salary_unit: "HOUR",
    },
  },
  {
    label: "Auszubildende/r",
    job: {
      title: "Ausbildung Maler/in und Lackierer/in (m/w/d)",
      employment: "ausbildung",
      start: "1. August",
      text: "Du willst etwas mit deinen Händen schaffen und am Ende des Tages sehen, was du geleistet hast? Dann starte deine Ausbildung bei uns!",
      tasks: ["Wände, Decken und Fassaden gestalten", "Untergründe vorbereiten und spachteln", "Farben mischen und Techniken lernen"],
      profile: ["Schulabschluss (Hauptschule oder höher)", "Freude an handwerklicher Arbeit", "Teamgeist und Zuverlässigkeit"],
      benefits: ["Ausbildungsvergütung nach Tarif", "Gute Chancen auf Übernahme", "Erfahrene Ausbilder und Ausbilderinnen"],
      salary_min: null,
      salary_max: null,
      salary_unit: "MONTH",
    },
  },
];

export function emptyJob(city?: string | null): WebsiteJob {
  return {
    id: newJobId(),
    title: "",
    employment: "vollzeit",
    location: city ?? "",
    start: "ab sofort",
    text: "",
    tasks: [],
    profile: [],
    benefits: [],
    salary_min: null,
    salary_max: null,
    salary_unit: "HOUR",
    active: true,
    posted_at: today(),
  };
}

// ---------------------------------------------------------------------
// KI-Chatassistent
// ---------------------------------------------------------------------
export type WebsiteChatSettings = { enabled: boolean; greeting: string; info: string };
export type WebsiteChat = {
  id: string;
  page: string | null;
  messages: { role: "user" | "assistant"; text: string; at: string; lead?: boolean }[];
  bot_replies: number;
  lead_id: number | null;
  created_at: string;
  updated_at: string;
};
export const CHAT_MONTHLY_LIMIT = 3000;
