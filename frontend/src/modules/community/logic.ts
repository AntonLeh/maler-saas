// MalerTreff-Community: feste Werte, Typen und kleine Helfer (ohne Datenbank, testbar)

export const COMMUNITY_NAME = "MalerTreff";
export const CONTACT_EMAIL = "info@maler-saas.com";

export type MemberKind = "team" | "betrieb" | "mitarbeiter" | "zulieferer" | "privat";
export type MemberStatus = "wartet" | "aktiv" | "gesperrt";
export type PostKind = "frage" | "projekt" | "tipp" | "anzeige";
export type ContentStatus = "sichtbar" | "pruefung" | "ausgeblendet" | "geloescht";
export type ReportReason = "beleidigung" | "spam" | "werbung" | "kundendaten" | "rechtswidrig" | "gefahr" | "sonstiges";
export type TargetType = "post" | "comment" | "member";
export type ModAction = "freigeben" | "ausblenden" | "loeschen" | "verwarnen" | "sperren" | "entsperren";

export type Member = {
  id: number;
  kind: MemberKind;
  status: MemberStatus;
  display_name: string;
  company: string | null;
  trade: string | null;
  region: string | null;
  bio: string | null;
  rules_version: string | null;
  warnings: number;
};

export type Access = {
  enabled: boolean;
  rules_version: string;
  is_owner: boolean;
  is_mod: boolean;
  member: Member | null;
  unread: number;
  staff_pending: number;
};

export type Author = { id: number; name: string; kind: MemberKind; company: string | null; region: string | null; is_mod: boolean };

export type Post = {
  id: number;
  kind: PostKind;
  topic: string;
  body: string;
  images: string[];
  status: ContentStatus;
  solution_comment_id: number | null;
  comment_count: number;
  helpful_count: number;
  created_at: string;
  edited_at: string | null;
  mine: boolean;
  helpful_by_me: boolean;
  author: Author;
  comments?: Comment[];
};

export type Comment = {
  id: number;
  body: string;
  status: ContentStatus;
  created_at: string;
  helpful_count: number;
  helpful_by_me: boolean;
  mine: boolean;
  author: Author;
};

export type Notice = {
  id: number;
  kind: "moderation" | "meldung" | "antwort" | "loesung" | "freigabe";
  text: string;
  post_id: number | null;
  read: boolean;
  created_at: string;
  decision: { id: number; action: ModAction; can_appeal: boolean; appeal_at: string | null; appeal_result: string | null } | null;
};

export type Profile = {
  id: number;
  kind: MemberKind;
  display_name: string;
  company: string | null;
  trade: string | null;
  region: string | null;
  bio: string | null;
  since: string;
  is_mod: boolean;
  posts: number;
  solutions: number;
};

export type QueueItem = {
  type: TargetType;
  id: number;
  report_count: number;
  reasons: Partial<Record<ReportReason, number>>;
  notes: string[];
  danger: boolean;
  content: {
    body: string;
    images?: string[];
    status: string;
    topic?: string;
    kind?: PostKind;
    post_id?: number;
    warnings?: number;
    created_at: string;
    author: Author | null;
  } | null;
};

export type Appeal = {
  id: number;
  type: TargetType;
  target_id: number;
  action: ModAction;
  rule: string;
  note: string | null;
  excerpt: string | null;
  appeal_text: string;
  appeal_at: string;
  created_at: string;
  member: Author | null;
};

export type Decision = {
  id: number;
  type: TargetType;
  action: ModAction;
  rule: string;
  excerpt: string | null;
  created_at: string;
  member: Author | null;
  by: Author | null;
  appeal_result: string | null;
};

export type Queue = { items: QueueItem[]; appeals: Appeal[]; recent: Decision[] };

export type OwnerOverview = {
  enabled: boolean;
  beta_tenants: number[];
  rules_version: string;
  tenants: { id: number; name: string }[];
  members: { id: number; display_name: string; company: string | null; kind: MemberKind; status: MemberStatus; is_moderator: boolean; warnings: number; created_at: string }[];
  stats: { members_active: number; posts_7d: number; comments_7d: number; reports_open: number; decisions_year: number };
};

export type StaffEntry = { id: number; display_name: string; status: MemberStatus; created_at: string };

export const TOPICS: { id: string; label: string }[] = [
  { id: "untergruende", label: "Untergründe" },
  { id: "fassade", label: "Fassade" },
  { id: "lack", label: "Lack & Lackierung" },
  { id: "tapete", label: "Tapete & Wand" },
  { id: "boden", label: "Boden" },
  { id: "kalkulation", label: "Kalkulation & Angebote" },
  { id: "personal", label: "Personal & Ausbildung" },
  { id: "recht", label: "Recht & Vorschriften" },
  { id: "werkzeug", label: "Werkzeug & Maschinen" },
  { id: "heimwerker", label: "Heimwerker-Fragen" },
  { id: "sonstiges", label: "Sonstiges" },
];
export const topicLabel = (id: string) => TOPICS.find((t) => t.id === id)?.label ?? id;

export const POST_KINDS: Record<PostKind, { label: string; icon: string }> = {
  frage: { label: "Frage", icon: "❓" },
  projekt: { label: "Projekt zeigen", icon: "📸" },
  tipp: { label: "Tipp", icon: "💡" },
  anzeige: { label: "Anzeige", icon: "📣" },
};

export const MEMBER_KINDS: Record<MemberKind, string> = {
  team: "MalerSaaS-Team",
  betrieb: "Betrieb",
  mitarbeiter: "Mitarbeiter",
  zulieferer: "Zulieferer",
  privat: "Privat",
};

export const REASONS: { id: ReportReason; label: string }[] = [
  { id: "beleidigung", label: "Beleidigung, Hetze oder Bedrohung" },
  { id: "spam", label: "Spam oder Betrug" },
  { id: "werbung", label: "Werbung ohne Kennzeichnung" },
  { id: "kundendaten", label: "Kundendaten, Adressen oder Gesichter ohne Einwilligung" },
  { id: "rechtswidrig", label: "Rechtswidriger Inhalt (z. B. Schwarzarbeit, Urheberrecht)" },
  { id: "gefahr", label: "Gefahr für Leib und Leben" },
  { id: "sonstiges", label: "Sonstiges" },
];
export const reasonLabel = (id: string) => REASONS.find((r) => r.id === id)?.label ?? id;

/** Community-Regeln (Entwurf, wird anwaltlich geprüft). Der Kurzname dient in der Moderation als Begründung. */
export const RULES: { short: string; text: string }[] = [
  { short: "Respektvoller Umgang", text: "Keine Beleidigungen, Drohungen, Hetze oder Diskriminierung. Kritik an der Sache ist erlaubt, nicht an der Person." },
  { short: "Beim Thema bleiben", text: "Hier geht es um das Maler- und Lackiererhandwerk und verwandte Gewerke. Keine Politik und keine privaten Streitigkeiten." },
  { short: "Keine Kundendaten", text: "Keine Namen, Adressen, Kfz-Kennzeichen oder erkennbaren Gesichter ohne Einwilligung – auch nicht auf Fotos." },
  { short: "Nur eigene Fotos und Texte", text: "Laden Sie nur Fotos und Texte hoch, an denen Sie die Rechte haben. Sie erlauben MalerSaaS, diese in der Community anzuzeigen." },
  { short: "Werbung nur gekennzeichnet", text: "Zulieferer werben nur in Beiträgen der Art „Anzeige“. Betriebe werben hier nicht um Endkunden." },
  { short: "Keine Preis- oder Gebietsabsprachen", text: "Erfahrungen zur Kalkulation sind erlaubt, Absprachen über Preise, Kunden oder Gebiete nicht (Kartellrecht)." },
  { short: "Nichts Rechtswidriges", text: "Keine Angebote zu Schwarzarbeit, keine Urheberrechtsverletzungen, keine sonstigen rechtswidrigen Inhalte." },
  { short: "Keine verbindliche Rechts- oder Steuerberatung", text: "Erfahrungen teilen ist willkommen. Im Einzelfall helfen Steuerberater, Anwalt oder Innung." },
  { short: "Melden statt streiten", text: "Melden Sie Verstöße über „Melden“. Die Moderation prüft, entscheidet, begründet ihre Entscheidung und Sie können einmal widersprechen." },
  { short: "Folgen bei Verstößen", text: "Inhalte können ausgeblendet oder entfernt, Mitglieder verwarnt oder gesperrt werden. Bei Gefahr für Leib und Leben informieren wir die Behörden." },
];

export const MAX_IMAGES = 4;
export const MAX_POST = 5000;
export const MAX_COMMENT = 2000;
export const PHOTO_HINT = "Bitte keine Kundennamen, Adressen, Kfz-Kennzeichen oder erkennbaren Gesichter. Standortdaten (GPS) werden beim Hochladen entfernt.";

export const isDraftRules = (v: string | null | undefined) => (v ?? "").startsWith("entwurf");
export const needsJoin = (a: Access | null) => !!a && (!a.member || a.member.rules_version !== a.rules_version);

/** Welche Beitragsarten darf dieses Mitglied wählen? */
export const allowedKinds = (kind: MemberKind | undefined): PostKind[] =>
  kind === "zulieferer" ? ["frage", "projekt", "tipp", "anzeige"] : ["frage", "projekt", "tipp"];

export function validatePost(body: string, topic: string, images: number): string | null {
  const t = body.trim();
  if (!topic) return "Bitte ein Thema wählen.";
  if (t.length < 10) return "Bitte mindestens 10 Zeichen schreiben.";
  if (t.length > MAX_POST) return `Höchstens ${MAX_POST} Zeichen.`;
  if (images > MAX_IMAGES) return `Höchstens ${MAX_IMAGES} Fotos je Beitrag.`;
  return null;
}

/** „vor 5 Min.“, „gestern“, „12.11.2026“ */
export function timeAgo(iso: string, now: Date = new Date()): string {
  const d = new Date(iso);
  const s = Math.max(0, Math.round((now.getTime() - d.getTime()) / 1000));
  if (s < 60) return "gerade eben";
  if (s < 3600) return `vor ${Math.floor(s / 60)} Min.`;
  if (s < 86400) return `vor ${Math.floor(s / 3600)} Std.`;
  const days = Math.floor(s / 86400);
  if (days === 1) return "gestern";
  if (days < 7) return `vor ${days} Tagen`;
  return d.toLocaleDateString("de-DE", { day: "2-digit", month: "2-digit", year: "numeric" });
}

/** Neue Größe beim Verkleinern (längste Seite höchstens max) */
export function fitSize(w: number, h: number, max = 1600): { w: number; h: number } {
  if (w <= max && h <= max) return { w, h };
  const f = max / Math.max(w, h);
  return { w: Math.round(w * f), h: Math.round(h * f) };
}

export const initials = (name: string) =>
  name
    .split(/\s+/)
    .filter(Boolean)
    .slice(0, 2)
    .map((p) => p[0]!.toUpperCase())
    .join("") || "?";

export const ACTION_LABEL: Record<ModAction, string> = {
  freigeben: "freigegeben",
  ausblenden: "ausgeblendet",
  loeschen: "entfernt",
  verwarnen: "verwarnt",
  sperren: "gesperrt",
  entsperren: "entsperrt",
};
