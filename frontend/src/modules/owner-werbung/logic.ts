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

/** Text für einen Kanal (inkl. Link), so wie er kopiert wird */
export function channelText(texts: Partial<Texts>, key: ChannelKey, campaign: string): string {
  const link = (src: string) => utmLink(src, campaign);
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
