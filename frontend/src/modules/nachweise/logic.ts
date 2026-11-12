// Dokumente & Nachweise aller Mitarbeiter (Subunternehmer, Leiharbeit, eigenes Personal): Arten je Land, Ampel, Erinnerungen
export type Land = "de" | "at" | "ch";
export type Kind = "sub" | "leiharbeit" | "eigen" | "azubi";

export type DocType = {
  key: string;
  label: string;
  hint?: string;
  for: Kind[];
  /** Pflicht-Nachweis: fehlt er oder ist er abgelaufen, wird bei der Zuteilung gewarnt */
  key_doc?: boolean;
  /** hat normalerweise ein Ablaufdatum */
  expires?: boolean;
  /** abgelaufen → Warnung bei der Zuteilung (z. B. Arbeitserlaubnis) */
  assign_warn_expired?: boolean;
};

export type PartnerDoc = {
  id: number;
  tenant_id: number;
  user_id: number;
  doc_type: string;
  title: string | null;
  valid_until: string | null;
  file_path: string | null;
  file_name: string | null;
  note: string | null;
  created_at: string;
};

const BOTH: Kind[] = ["sub", "leiharbeit"];
const OWN: Kind[] = ["eigen", "azubi"];
const ALL: Kind[] = ["sub", "leiharbeit", "eigen", "azubi"];

/** Verträge der Partner (ohne Ablauf) */
const PARTNER_CONTRACTS: DocType[] = [
  { key: "werkvertrag", label: "Werkvertrag / Rahmenvertrag", for: ["sub"] },
  { key: "ueberlassungsvertrag", label: "Arbeitnehmerüberlassungsvertrag", for: ["leiharbeit"] },
];

/** Eigenes Personal – nichts davon ist Pflicht */
const OWN_TYPES: DocType[] = [
  { key: "arbeitsvertrag", label: "Arbeitsvertrag / Änderungsvertrag", for: ["eigen"] },
  { key: "ausbildungsvertrag", label: "Ausbildungsvertrag", for: ["azubi"] },
  { key: "qualifikation", label: "Gesellenbrief / Meisterbrief / Zeugnis", for: OWN },
  { key: "fuehrerschein", label: "Führerschein", hint: "Als Halter von Firmenfahrzeugen müssen Sie den Führerschein regelmäßig kontrollieren (Empfehlung: halbjährlich).", for: OWN, expires: true },
  { key: "aufenthaltstitel", label: "Aufenthaltstitel / Arbeitserlaubnis", hint: "Ohne gültige Arbeitserlaubnis darf die Person nicht beschäftigt werden – es drohen hohe Bußgelder.", for: OWN, expires: true, assign_warn_expired: true },
  { key: "vorsorge", label: "Arbeitsmedizinische Vorsorge / Untersuchung", for: OWN, expires: true },
  { key: "unterweisung", label: "Unterweisung Arbeitsschutz", hint: "Die Unterweisung ist mindestens einmal jährlich vorgeschrieben – als „gültig bis“ das Datum in einem Jahr eintragen.", for: OWN, expires: true },
  { key: "erste_hilfe", label: "Erste-Hilfe-Ausbildung", hint: "Betriebliche Ersthelfer müssen alle 2 Jahre fortgebildet werden.", for: OWN, expires: true },
  { key: "staplerschein", label: "Staplerschein", for: OWN, expires: true },
  { key: "geruest_buehne", label: "Gerüst- / Hubarbeitsbühnen-Schein", for: OWN, expires: true },
];

export const DOC_TYPES: Record<Land, DocType[]> = {
  de: [
    { key: "freistellung_48b", label: "Freistellungsbescheinigung § 48b EStG", hint: "Ohne gültige Bescheinigung müssen 15 % Bauabzugsteuer einbehalten und ans Finanzamt abgeführt werden.", for: ["sub"], key_doc: true, expires: true },
    { key: "ust_13b", label: "Nachweis § 13b UStG (USt 1 TG)", hint: "Bestätigt, dass der Subunternehmer Bauleistungen erbringt (Reverse Charge).", for: ["sub"], expires: true },
    { key: "unbedenklich_kk", label: "Unbedenklichkeitsbescheinigung Krankenkasse", hint: "Schützt vor der Haftung für Sozialversicherungsbeiträge (§ 28e SGB IV).", for: BOTH, expires: true },
    { key: "unbedenklich_bg", label: "Unbedenklichkeitsbescheinigung BG BAU", for: BOTH, expires: true },
    { key: "gewerbe", label: "Gewerbeanmeldung / Eintrag Handwerksrolle", for: ["sub"] },
    { key: "haftpflicht", label: "Betriebshaftpflicht-Versicherung", for: ["sub"], expires: true },
    { key: "aueg", label: "Erlaubnis Arbeitnehmerüberlassung (AÜG)", hint: "Ohne Erlaubnis gilt der Leiharbeiter als bei Ihnen angestellt.", for: ["leiharbeit"], key_doc: true, expires: true },
    ...PARTNER_CONTRACTS,
    ...OWN_TYPES,
    { key: "sonstiges", label: "Sonstiges", for: ALL },
  ],
  at: [
    { key: "hfu_liste", label: "HFU-Liste (Auftraggeberhaftung)", hint: "Steht der Subunternehmer nicht auf der HFU-Liste, haften Sie für Abgaben (20 % bzw. 5 % Einbehalt).", for: ["sub"], key_doc: true, expires: true },
    { key: "gewerbe", label: "Gewerbeberechtigung (GISA-Auszug)", for: ["sub"] },
    { key: "unbedenklich_fa", label: "Unbedenklichkeitsbescheinigung Finanzamt", for: BOTH, expires: true },
    { key: "unbedenklich_ogk", label: "Unbedenklichkeitsbescheinigung ÖGK", for: BOTH, expires: true },
    { key: "haftpflicht", label: "Betriebshaftpflicht-Versicherung", for: ["sub"], expires: true },
    { key: "akue", label: "Gewerbeberechtigung Arbeitskräfteüberlassung", for: ["leiharbeit"], key_doc: true, expires: true },
    ...PARTNER_CONTRACTS,
    ...OWN_TYPES,
    { key: "sonstiges", label: "Sonstiges", for: ALL },
  ],
  ch: [
    { key: "handelsregister", label: "Handelsregisterauszug", for: ["sub"] },
    { key: "mwst", label: "MWST-Bestätigung (UID)", for: ["sub"] },
    { key: "ahv", label: "Bestätigung AHV / Sozialversicherung", for: BOTH, expires: true },
    { key: "suva", label: "Bestätigung Unfallversicherung (SUVA)", for: BOTH, expires: true },
    { key: "haftpflicht", label: "Betriebshaftpflicht-Versicherung", for: ["sub"], expires: true },
    { key: "personalverleih", label: "Bewilligung Personalverleih (AVG)", for: ["leiharbeit"], key_doc: true, expires: true },
    ...PARTNER_CONTRACTS,
    ...OWN_TYPES,
    { key: "sonstiges", label: "Sonstiges", for: ALL },
  ],
};

export function landOf(country: string | null | undefined): Land {
  const c = String(country ?? "").trim().toLowerCase();
  if (["at", "österreich", "oesterreich", "austria"].includes(c)) return "at";
  if (["ch", "schweiz", "switzerland", "suisse", "svizzera"].includes(c)) return "ch";
  return "de";
}

export const kindOf = (employmentType: string | null | undefined): Kind =>
  employmentType === "sub" ? "sub" : employmentType === "leiharbeit" ? "leiharbeit" : employmentType === "azubi" ? "azubi" : "eigen";
export const isPartner = (k: Kind) => k === "sub" || k === "leiharbeit";

export const typesFor = (land: Land, kind: Kind) => DOC_TYPES[land].filter((t) => t.for.includes(kind));

export function labelOf(land: Land, key: string, title?: string | null): string {
  if (key === "sonstiges" && title) return title;
  return DOC_TYPES[land].find((t) => t.key === key)?.label ?? DOC_TYPES.de.find((t) => t.key === key)?.label ?? title ?? key;
}

export const WARN_DAYS = 30;
export type Light = "green" | "yellow" | "red";

const dayMs = 86400000;
const atNoon = (iso: string) => new Date(`${iso}T12:00:00`).getTime();
export function todayIso(now = new Date()) {
  return `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, "0")}-${String(now.getDate()).padStart(2, "0")}`;
}
/** Tage bis zum Ablauf (0 = läuft heute ab, negativ = abgelaufen) */
export const daysLeft = (validUntil: string, today = todayIso()) => Math.round((atNoon(validUntil) - atNoon(today)) / dayMs);

export function docLight(d: Pick<PartnerDoc, "valid_until">, today = todayIso()): Light {
  if (!d.valid_until) return "green";
  const n = daysLeft(d.valid_until, today);
  if (n < 0) return "red";
  if (n <= WARN_DAYS) return "yellow";
  return "green";
}

/** Neuester Nachweis je Art (der mit dem spätesten Ablaufdatum zählt) */
export function currentByType(docs: PartnerDoc[]): Map<string, PartnerDoc> {
  const m = new Map<string, PartnerDoc>();
  for (const d of docs) {
    if (d.doc_type === "sonstiges") continue;
    const prev = m.get(d.doc_type);
    if (!prev) { m.set(d.doc_type, d); continue; }
    const a = prev.valid_until ?? "9999-12-31";
    const b = d.valid_until ?? "9999-12-31";
    if (b > a || (b === a && d.created_at > prev.created_at)) m.set(d.doc_type, d);
  }
  return m;
}

export type Issue = { type: string; label: string; state: "missing" | "expired" | "soon"; days?: number; key_doc: boolean };

/**
 * Probleme einer Person: Pflicht-Nachweis fehlt, Nachweise abgelaufen oder bald ablaufend.
 * Fehlende freiwillige Nachweise sind kein Problem.
 */
export function issuesFor(kind: Kind, land: Land, docs: PartnerDoc[], today = todayIso()): Issue[] {
  const cur = currentByType(docs);
  const out: Issue[] = [];
  for (const t of typesFor(land, kind)) {
    const d = cur.get(t.key);
    if (!d) {
      if (t.key_doc) out.push({ type: t.key, label: t.label, state: "missing", key_doc: true });
      continue;
    }
    if (!d.valid_until) continue;
    const n = daysLeft(d.valid_until, today);
    const kd = !!t.key_doc || !!t.assign_warn_expired;
    if (n < 0) out.push({ type: t.key, label: t.label, state: "expired", days: n, key_doc: kd });
    else if (n <= WARN_DAYS) out.push({ type: t.key, label: t.label, state: "soon", days: n, key_doc: kd });
  }
  return out;
}

export function personLight(issues: Issue[]): Light {
  if (issues.some((i) => i.state !== "soon")) return "red";
  if (issues.length) return "yellow";
  return "green";
}

/** Probleme, die bei der Zuteilung zu einem Auftrag zählen (nur Pflicht-Nachweis fehlt/abgelaufen) */
export const blockingIssues = (issues: Issue[]) => issues.filter((i) => i.key_doc && i.state !== "soon");

export function issueText(i: Issue): string {
  if (i.state === "missing") return `${i.label} fehlt`;
  if (i.state === "expired") return `${i.label} abgelaufen seit ${-(i.days ?? 0)} ${Math.abs(i.days ?? 0) === 1 ? "Tag" : "Tagen"}`;
  if (i.days === 0) return `${i.label} läuft heute ab`;
  return `${i.label} läuft in ${i.days} ${i.days === 1 ? "Tag" : "Tagen"} ab`;
}

export const groupByUser = (docs: PartnerDoc[]) => {
  const m = new Map<number, PartnerDoc[]>();
  for (const d of docs) {
    const k = Number(d.user_id);
    if (!m.has(k)) m.set(k, []);
    m.get(k)!.push(d);
  }
  return m;
};

export type PersonLike = { id: number; first_name?: string | null; last_name?: string | null; employment_type?: string | null; is_active?: boolean | null; role_id?: number };

/** Probleme je Person (nur aktive Personen) */
export function peopleIssues(people: PersonLike[], docs: PartnerDoc[], land: Land): { person: PersonLike; issues: Issue[] }[] {
  const out: { person: PersonLike; issues: Issue[] }[] = [];
  for (const p of people) {
    const kind = kindOf(p.employment_type);
    if (p.is_active === false || p.role_id === 1) continue;
    const issues = issuesFor(kind, land, docs.filter((d) => Number(d.user_id) === Number(p.id)));
    if (issues.length) out.push({ person: p, issues });
  }
  return out;
}

