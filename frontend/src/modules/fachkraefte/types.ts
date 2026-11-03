// Fachkräfte-Pool: Bezeichnungen (müssen zu supabase/functions/talent-pool/logic.ts passen)

export const ROLES = [
  { value: "geselle", label: "Maler/in mit Gesellenbrief" },
  { value: "meister", label: "Maler-Meister/in" },
  { value: "helfer", label: "Helfer/in oder Quereinsteiger/in" },
  { value: "azubi", label: "Ich suche einen Ausbildungsplatz" },
  { value: "sonstiges", label: "Sonstiges (z. B. Lackierer/in, Bodenleger/in)" },
];

export const WANTS = [
  { value: "festanstellung", label: "Festanstellung" },
  { value: "aushilfe", label: "Aushilfe / befristet" },
  { value: "subunternehmer", label: "Aufträge als Subunternehmer" },
  { value: "ausbildung", label: "Ausbildungsplatz" },
];

export const SKILLS = [
  { value: "innen", label: "Innenanstrich" },
  { value: "fassade", label: "Fassade" },
  { value: "tapezieren", label: "Tapezieren" },
  { value: "lackieren", label: "Lackieren" },
  { value: "spachteln", label: "Spachteln / Putz" },
  { value: "boden", label: "Bodenbeläge" },
  { value: "wdvs", label: "Wärmedämmung (WDVS)" },
  { value: "trockenbau", label: "Trockenbau" },
  { value: "beschichtung", label: "Bodenbeschichtung" },
  { value: "schimmel", label: "Schimmelsanierung" },
  { value: "kreativ", label: "Kreativ- / Dekortechniken" },
  { value: "geruest", label: "Gerüstbau" },
];

export const RADII = [10, 20, 30, 40, 50, 75, 100, 150, 250];

export const labelOf = (list: { value: string; label: string }[], v: string) => list.find((x) => x.value === v)?.label ?? v;

export type PoolProfile = {
  id?: string;
  status?: "pending" | "active" | "paused";
  first_name: string;
  last_name: string;
  email: string;
  phone: string;
  role: string;
  wants: string[];
  skills: string[];
  company_name: string;
  handwerksrolle: boolean;
  plz: string;
  ort?: string | null;
  radius_km: number;
  available_from: string; // "sofort" oder JJJJ-MM-TT
  driving_license: boolean;
  own_vehicle: boolean;
  languages: string;
  note: string;
  visible_until?: string;
};

export const EMPTY_PROFILE: PoolProfile = {
  first_name: "",
  last_name: "",
  email: "",
  phone: "",
  role: "",
  wants: [],
  skills: [],
  company_name: "",
  handwerksrolle: false,
  plz: "",
  radius_km: 30,
  available_from: "sofort",
  driving_license: false,
  own_vehicle: false,
  languages: "",
  note: "",
};

export type PoolContactForWorker = { id: number; status: "offen" | "angenommen" | "abgelehnt"; message: string | null; created_at: string; company: string; city: string | null };

export type PoolResult = {
  id: string;
  role: string;
  role_label: string;
  wants: string[];
  skills: string[];
  ort: string | null;
  distance: string;
  distance_km: number;
  available_from: string | null;
  driving_license: boolean;
  own_vehicle: boolean;
  languages: string | null;
  note: string | null;
  handwerksrolle: boolean | null;
  updated: string;
  contact_status: "offen" | "angenommen" | "abgelehnt" | null;
  contact: { name: string; email: string; phone: string | null; company_name: string | null } | null;
};

export type PoolBusinessContact = { id: number; status: "offen" | "angenommen" | "abgelehnt"; message: string | null; created_at: string; responded_at: string | null; profile: PoolResult | null };

export const availableText = (v: string | null) =>
  !v || v === "sofort" ? "sofort" : `ab ${new Date(`${v}T12:00:00`).toLocaleDateString("de-DE", { day: "2-digit", month: "2-digit", year: "numeric" })}`;
