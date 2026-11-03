// Reine Logik des Fachkräfte-Pools (ohne Datenbank) – damit sie sich einfach testen lässt.

export const ROLES = ["geselle", "meister", "helfer", "azubi", "sonstiges"] as const;
export const WANTS = ["festanstellung", "aushilfe", "subunternehmer", "ausbildung"] as const;
export const SKILLS = [
  "innen",
  "fassade",
  "tapezieren",
  "lackieren",
  "spachteln",
  "boden",
  "wdvs",
  "trockenbau",
  "beschichtung",
  "schimmel",
  "kreativ",
  "geruest",
] as const;

export const ROLE_LABEL: Record<string, string> = {
  geselle: "Maler/in mit Gesellenbrief",
  meister: "Maler-Meister/in",
  helfer: "Helfer/in / Quereinsteiger/in",
  azubi: "sucht Ausbildungsplatz",
  sonstiges: "Fachkraft (sonstige)",
};

const str = (v: unknown, max: number) => String(v ?? "").trim().replace(/\s+/g, " ").slice(0, max);
const pick = <T extends string>(list: readonly T[], v: unknown): T[] =>
  Array.isArray(v) ? [...new Set(v.map(String))].filter((x): x is T => (list as readonly string[]).includes(x)) : [];

export type ProfileInput = {
  first_name: string;
  last_name: string;
  email: string;
  phone: string | null;
  role: string;
  wants: string[];
  skills: string[];
  company_name: string | null;
  handwerksrolle: boolean | null;
  plz: string;
  radius_km: number;
  available_from: string | null;
  driving_license: boolean;
  own_vehicle: boolean;
  languages: string | null;
  note: string | null;
};

/** Eingaben prüfen und bereinigen. Liefert { ok, value } oder { ok:false, error } */
export function validateProfile(b: Record<string, unknown>, today = new Date()): { ok: true; value: ProfileInput } | { ok: false; error: string } {
  const first = str(b.first_name, 60);
  const last = str(b.last_name, 60);
  const email = str(b.email, 160).toLowerCase();
  const phone = str(b.phone, 40);
  const role = String(b.role ?? "");
  const wants = pick(WANTS, b.wants);
  const plz = str(b.plz, 5);
  if (first.length < 2 || last.length < 2) return { ok: false, error: "Bitte Vor- und Nachnamen angeben." };
  if (!/^[^@\s]+@[^@\s]+\.[^@\s]{2,}$/.test(email)) return { ok: false, error: "Bitte eine gültige E-Mail-Adresse angeben." };
  if (phone && !/^[+0-9 ()/-]{6,40}$/.test(phone)) return { ok: false, error: "Bitte die Telefonnummer prüfen." };
  if (!(ROLES as readonly string[]).includes(role)) return { ok: false, error: "Bitte angeben, was Sie sind (z. B. Geselle, Helfer)." };
  if (!wants.length) return { ok: false, error: "Bitte angeben, was Sie suchen (z. B. Festanstellung)." };
  if (!/^[0-9]{5}$/.test(plz)) return { ok: false, error: "Bitte eine gültige Postleitzahl (5 Ziffern) angeben." };
  const radius = Math.round(Number(b.radius_km));
  let available: string | null = null;
  const av = String(b.available_from ?? "").trim();
  if (av && av !== "sofort") {
    if (!/^\d{4}-\d{2}-\d{2}$/.test(av) || Number.isNaN(Date.parse(av))) return { ok: false, error: "Bitte ein gültiges Datum für „verfügbar ab“ angeben." };
    const max = new Date(today.getTime() + 400 * 86_400_000).toISOString().slice(0, 10);
    available = av < today.toISOString().slice(0, 10) ? null : av > max ? max : av;
  }
  const sub = wants.includes("subunternehmer");
  return {
    ok: true,
    value: {
      first_name: first,
      last_name: last,
      email,
      phone: phone || null,
      role,
      wants,
      skills: pick(SKILLS, b.skills),
      company_name: sub ? str(b.company_name, 100) || null : null,
      handwerksrolle: sub ? b.handwerksrolle === true : null,
      plz,
      radius_km: Number.isFinite(radius) ? Math.min(500, Math.max(5, radius)) : 30,
      available_from: available,
      driving_license: b.driving_license === true,
      own_vehicle: b.own_vehicle === true,
      languages: str(b.languages, 120) || null,
      note: str(b.note, 600) || null,
    },
  };
}

/** Luftlinie in km */
export function distanceKm(a: { lat: number; lon: number }, b: { lat: number; lon: number }): number {
  const R = 6371;
  const toRad = (d: number) => (d * Math.PI) / 180;
  const dLat = toRad(b.lat - a.lat);
  const dLon = toRad(b.lon - a.lon);
  const h = Math.sin(dLat / 2) ** 2 + Math.cos(toRad(a.lat)) * Math.cos(toRad(b.lat)) * Math.sin(dLon / 2) ** 2;
  return 2 * R * Math.asin(Math.min(1, Math.sqrt(h)));
}

/** Entfernung grob angeben, damit niemand den Wohnort genau bestimmen kann */
export const roughKm = (km: number) => (km < 5 ? "unter 5 km" : `ca. ${Math.max(5, Math.round(km / 5) * 5)} km`);

/** Anonymisierte Ansicht für Betriebe (ohne Namen, Kontaktdaten, Postleitzahl, Firmenname) */
export function anonymize(p: Record<string, any>, km: number, contactStatus: string | null) {
  const accepted = contactStatus === "angenommen";
  return {
    id: p.id,
    role: p.role,
    role_label: ROLE_LABEL[p.role] ?? p.role,
    wants: p.wants ?? [],
    skills: p.skills ?? [],
    ort: p.ort ?? null,
    distance: roughKm(km),
    distance_km: Math.round(km),
    available_from: p.available_from ?? null,
    driving_license: !!p.driving_license,
    own_vehicle: !!p.own_vehicle,
    languages: p.languages ?? null,
    note: p.note ?? null,
    handwerksrolle: p.handwerksrolle ?? null,
    updated: String(p.last_active_at ?? "").slice(0, 10),
    contact_status: contactStatus,
    contact: accepted ? { name: `${p.first_name} ${p.last_name}`, email: p.email, phone: p.phone ?? null, company_name: p.company_name ?? null } : null,
  };
}

/** Zufälliges Zugangs-Token (für Links in E-Mails) und sein Hash für die Datenbank */
export function newToken(): string {
  const b = new Uint8Array(24);
  crypto.getRandomValues(b);
  return btoa(String.fromCharCode(...b)).replace(/\+/g, "-").replace(/\//g, "_").replace(/=+$/, "");
}
export async function hashToken(t: string): Promise<string> {
  const d = await crypto.subtle.digest("SHA-256", new TextEncoder().encode(`talent:${t}`));
  return [...new Uint8Array(d)].map((x) => x.toString(16).padStart(2, "0")).join("");
}

export const esc = (v: unknown) =>
  String(v ?? "").replace(/[&<>"']/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" })[c] as string);
