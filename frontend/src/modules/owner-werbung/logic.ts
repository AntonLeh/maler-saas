// Owner-Werbung: Themen, Kanäle, Links mit UTM-Kennung (reine Logik, testbar)

export type Goal = "funktion" | "tipp" | "testphase" | "saison" | "frei";
export type Status = "entwurf" | "geplant" | "veroeffentlicht";
export type ChannelKey = "facebook" | "instagram" | "linkedin" | "video" | "youtube";

export type Texts = {
  facebook: string;
  instagram: string;
  linkedin: string;
  video_script: string;
  video_caption: string;
  youtube_title: string;
  youtube_description: string;
  youtube_script: string;
  /** vom Video-Generator bearbeitete Szenen */
  video_scenes?: { text: string; image: string | null; seconds: number; hint?: string }[];
  video_voice?: "none" | "female" | "male";
  /** Drehanleitung fürs YouTube-Erklärvideo */
  youtube_shotlist?: Shotlist;
};

export type Shotlist = {
  preparation: string[];
  scenes: { title: string; screen: string; actions: string; say: string; seconds: number }[];
  thumbnail: string;
};

export type GraphicData = {
  template: "funktion" | "tipp" | "angebot";
  format: "1x1" | "4x5" | "9x16";
  headline: string;
  subline: string;
  points: string[];
  image: string | null; // "/images/…" (Screenshot) oder Storage-Pfad „upload:…“
};

export type Post = {
  id: number;
  topic: string;
  goal: Goal;
  keywords: string | null;
  title: string;
  texts: Partial<Texts>;
  images: string[];
  graphic: GraphicData | null;
  utm_campaign: string | null;
  status: Status;
  planned_for: string | null;
  published_channels: string[];
  created_at: string;
  updated_at: string;
  /** Agent (ab SQL „Agent“) */
  source?: "manuell" | "agent";
  agent_reason?: string | null;
  hook?: string | null;
  channels?: string[];
  approved_at?: string | null;
  plan_month?: string | null;
  prepare_error?: string | null;
  /** Kurzlink-Code (ab SQL „Erfolgsmessung“) */
  short_code?: string | null;
};

export const TOPICS: string[] = [
  "Aufmaß per Sprache",
  "Aufmaß & Angebote (VOB/C)",
  "Angebote per E-Mail, Kunde nimmt online an",
  "Aufträge & Planung",
  "Zeiterfassung / Stechuhr mit Pausen",
  "Projektleiter-Dashboard",
  "Mitarbeiter-App auf der Baustelle (Fotos, Fortschritt)",
  "Materialverwaltung & Nachbestellen",
  "Lieferschein per Foto einlesen (KI)",
  "Rechnungen, E-Rechnung (ZUGFeRD) & Mahnungen",
  "Buchhaltung & Steuerberater-Paket",
  "KI-Belegerkennung",
  "Kundenportal",
  "Eigene Firmen-Website mit KI",
  "KI-Telefon",
  "Fachkräfte-Pool",
  "14 Tage kostenlos testen",
];

export const GOAL_LABELS: Record<Goal, string> = {
  funktion: "Funktion vorstellen",
  tipp: "Tipp für Malerbetriebe",
  testphase: "Zur Testphase einladen",
  saison: "Saisonal",
  frei: "Freies Thema",
};

export const STATUS_LABELS: Record<Status, string> = {
  entwurf: "Entwurf",
  geplant: "Geplant",
  veroeffentlicht: "Veröffentlicht",
};

export const CHANNELS: { key: ChannelKey; label: string; max: number; open: string; utm: string }[] = [
  { key: "facebook", label: "Facebook", max: 2000, open: "https://www.facebook.com/", utm: "facebook" },
  { key: "instagram", label: "Instagram", max: 2200, open: "https://www.instagram.com/", utm: "instagram" },
  { key: "linkedin", label: "LinkedIn", max: 3000, open: "https://www.linkedin.com/feed/", utm: "linkedin" },
  { key: "video", label: "Kurzvideo (Reel · Short · TikTok)", max: 2200, open: "", utm: "video" },
  { key: "youtube", label: "YouTube-Erklärvideo", max: 5000, open: "https://studio.youtube.com/", utm: "youtube" },
];

export const SITE = "https://maler-saas.com";

/** Kampagnen-Kennung aus Titel/Thema + Datum, z. B. „aufmass-per-sprache-2611“ */
export function campaignSlug(text: string, date = new Date()): string {
  const base = text
    .toLowerCase()
    .replace(/ä/g, "ae")
    .replace(/ö/g, "oe")
    .replace(/ü/g, "ue")
    .replace(/ß/g, "ss")
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "")
    .slice(0, 36)
    .replace(/-+$/g, "");
  const tag = `${String(date.getFullYear()).slice(2)}${String(date.getMonth() + 1).padStart(2, "0")}`;
  return `${base || "beitrag"}-${tag}`;
}

export function utmLink(source: string, campaign: string, path = "/") {
  const p = new URLSearchParams({ utm_source: source, utm_medium: "social", utm_campaign: campaign });
  return `${SITE}${path}?${p.toString()}`;
}

/** {LINK} im Text durch den Kanal-Link ersetzen */
export const withLink = (text: string, link: string) => text.replace(/\{LINK\}/g, link);

/** Kurzlink je Kanal: maler-saas.com/go/winter7k-f */
const CH_SUFFIX: Record<string, string> = { facebook: "f", instagram: "i", linkedin: "l", video: "v", youtube: "y" };
export const shortLink = (code: string, channel: string) => `${SITE.replace(/^https:\/\//, "")}/go/${code}-${CH_SUFFIX[channel] ?? "f"}`;

/** Kurzer Code aus dem Titel, z. B. „winter7k“ */
export function makeShortCode(title: string, rnd = Math.random): string {
  const word =
    title
      .toLowerCase()
      .replace(/ä/g, "ae")
      .replace(/ö/g, "oe")
      .replace(/ü/g, "ue")
      .replace(/ß/g, "ss")
      .split(/[^a-z0-9]+/)
      .find((w) => w.length >= 4 && !["fuer", "eine", "einen", "ihre", "mehr", "ohne", "statt", "jetzt", "beim", "wenn"].includes(w)) ?? "post";
  const tail = Array.from({ length: 2 }, () => "abcdefghjkmnpqrstuvwxyz23456789"[Math.floor(rnd() * 31)]).join("");
  return `${word.slice(0, 12)}${tail}`;
}

/** Text für einen Kanal (inkl. Link), so wie er kopiert wird */
export function channelText(texts: Partial<Texts>, key: ChannelKey, campaign: string, shortCode?: string | null): string {
  const link = (src: string) => (shortCode ? `https://${shortLink(shortCode, src)}` : utmLink(src, campaign));
  switch (key) {
    case "facebook":
      return withLink(texts.facebook ?? "", link("facebook"));
    case "instagram":
      return withLink(texts.instagram ?? "", "Link in der Bio");
    case "linkedin":
      return withLink(texts.linkedin ?? "", link("linkedin"));
    case "video":
      return withLink(texts.video_caption ?? "", "Link in der Bio");
    case "youtube":
      return [texts.youtube_title ?? "", "", withLink(texts.youtube_description ?? "", link("youtube"))].join("\n").trim();
  }
}

/** Beiträge sortiert: geplante nach Datum, dann Entwürfe (neueste zuerst), dann veröffentlichte */
export function sortPosts(posts: Post[]): Post[] {
  const rank: Record<Status, number> = { geplant: 0, entwurf: 1, veroeffentlicht: 2 };
  return [...posts].sort((a, b) => {
    const r = rank[a.status] - rank[b.status];
    if (r) return r;
    if (a.status === "geplant") return String(a.planned_for ?? "9999").localeCompare(String(b.planned_for ?? "9999"));
    return b.updated_at.localeCompare(a.updated_at);
  });
}

/** Beiträge in den nächsten 7 Tagen (oder überfällig, aber noch nicht veröffentlicht) */
export function dueThisWeek(posts: Post[], today: string): Post[] {
  const end = new Date(`${today}T12:00:00`);
  end.setDate(end.getDate() + 7);
  const endIso = end.toISOString().slice(0, 10);
  return posts.filter((p) => p.status === "geplant" && p.planned_for && p.planned_for <= endIso);
}

// ---------- Content- & Planungs-Agent ----------
export type AgentGoal = "tipp" | "funktion" | "testphase" | "saison";
export const AGENT_GOALS: AgentGoal[] = ["tipp", "funktion", "testphase", "saison"];
export type AgentSettings = {
  auto_enabled: boolean;
  weekdays: number[];
  channels: string[];
  mix: Record<AgentGoal, number>;
  youtube_per_month: number;
  last_plan_month: string | null;
};
export const DEFAULT_AGENT: AgentSettings = {
  auto_enabled: false,
  weekdays: [2, 4, 6],
  channels: ["facebook", "instagram", "linkedin"],
  mix: { tipp: 40, funktion: 30, testphase: 20, saison: 10 },
  youtube_per_month: 0,
  last_plan_month: null,
};
export const WEEKDAY_SHORT = ["Mo", "Di", "Mi", "Do", "Fr", "Sa", "So"];
export const AGENT_CHANNELS: { key: string; label: string }[] = [
  { key: "facebook", label: "Facebook" },
  { key: "instagram", label: "Instagram" },
  { key: "linkedin", label: "LinkedIn" },
  { key: "video", label: "Kurzvideo" },
];
export type Proposal = { date: string; goal: AgentGoal; youtube: boolean; topic: string; hook: string; keywords: string; reason: string };

export const hasTexts = (p: Pick<Post, "texts">) => ["facebook", "instagram", "linkedin"].some((k) => String((p.texts as Record<string, unknown>)?.[k] ?? "").trim());
/** wartet auf Freigabe durch den Inhaber */
export const needsApproval = (p: Post) => p.source === "agent" && !p.approved_at && p.status !== "veroeffentlicht";

/** Nächster Montag (oder morgen, falls heute Sonntag) */
export function nextMonday(today = new Date()): string {
  const d = new Date(today.getFullYear(), today.getMonth(), today.getDate(), 12);
  const add = ((8 - d.getDay()) % 7) || 7;
  d.setDate(d.getDate() + add);
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
}

/** Anteile in Prozent (gerundet, Summe 100) */
export function mixPercent(mix: Record<AgentGoal, number>): Record<AgentGoal, number> {
  const total = AGENT_GOALS.reduce((s, g) => s + (mix[g] || 0), 0) || 1;
  return Object.fromEntries(AGENT_GOALS.map((g) => [g, Math.round(((mix[g] || 0) / total) * 100)])) as Record<AgentGoal, number>;
}

/** Heute (oder überfällig) zu posten: freigegeben/geplant, noch nicht veröffentlicht */
export const postToday = (posts: Post[], today: string) =>
  posts.filter((p) => p.status === "geplant" && p.planned_for && p.planned_for <= today && !needsApproval(p)).sort((a, b) => String(a.planned_for).localeCompare(String(b.planned_for)));
