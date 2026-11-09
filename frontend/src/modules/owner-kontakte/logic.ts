// Owner-Kontakte: Typen, Beschriftungen, Platzhalter, CSV-Import (reine Logik, testbar)

export type Kind = "innung" | "kammer" | "landesverband" | "fachverband" | "presse" | "sonstiges";
export type Status = "neu" | "brief" | "antwort" | "gespraech" | "partner" | "kein_interesse";
export type Consent = "antwort" | "anfrage" | "einwilligung";

export type Contact = {
  id: number;
  organisation: string;
  kind: Kind;
  country: "DE" | "AT" | "CH";
  region: string | null;
  salutation: "herr" | "frau" | "" | null;
  title: string | null;
  first_name: string | null;
  last_name: string | null;
  position: string | null;
  street: string | null;
  zip: string | null;
  city: string | null;
  email: string | null;
  phone: string | null;
  website: string | null;
  source: string | null;
  status: Status;
  next_followup: string | null;
  blocked: boolean;
  blocked_at: string | null;
  blocked_reason: string | null;
  consent_basis: Consent | null;
  consent_date: string | null;
  consent_note: string | null;
  notes: string | null;
  created_at: string;
  updated_at: string;
};

export type ContactEvent = { id: number; contact_id: number; kind: string; subject: string | null; body: string | null; meta: Record<string, unknown>; created_at: string };
export type Template = { id: number; kind: "brief" | "email"; name: string; subject: string; body: string };

export const KIND_LABELS: Record<Kind, string> = {
  innung: "Innung",
  kammer: "Handwerkskammer",
  landesverband: "Landesinnungsverband",
  fachverband: "Fachverband",
  presse: "Fachzeitschrift / Presse",
  sonstiges: "Sonstiges",
};

export const STATUS_LABELS: Record<Status, string> = {
  neu: "Neu",
  brief: "Brief verschickt",
  antwort: "Antwort erhalten",
  gespraech: "Im Gespräch",
  partner: "Partner",
  kein_interesse: "Kein Interesse",
};

export const CONSENT_LABELS: Record<Consent, string> = {
  antwort: "Hat geantwortet",
  anfrage: "Hat um Informationen gebeten",
  einwilligung: "Einwilligung zu E-Mails erteilt",
};

export const COUNTRY_NAMES: Record<string, string> = { DE: "DEUTSCHLAND", AT: "ÖSTERREICH", CH: "SCHWEIZ" };

export const EVENT_LABELS: Record<string, string> = {
  brief: "Brief (selbst verschickt)",
  brief_pingen: "Brief über Pingen",
  email: "E-Mail gesendet",
  notiz: "Notiz",
  status: "Status geändert",
  einwilligung: "Grundlage für E-Mails",
  sperre: "Widerspruch / gesperrt",
};

export function anrede(c: Pick<Contact, "salutation" | "title" | "last_name">): string {
  const name = [c.title, c.last_name].filter(Boolean).join(" ").trim();
  if (c.salutation === "herr" && name) return `Sehr geehrter Herr ${name}`;
  if (c.salutation === "frau" && name) return `Sehr geehrte Frau ${name}`;
  return "Sehr geehrte Damen und Herren";
}

export function fill(text: string, c: Contact): string {
  const person = [c.title, c.first_name, c.last_name].filter(Boolean).join(" ").trim();
  return String(text ?? "")
    .replace(/\{anrede\}/gi, anrede(c))
    .replace(/\{organisation\}/gi, c.organisation || "")
    .replace(/\{region\}/gi, c.region || c.city || "")
    .replace(/\{stadt\}/gi, c.city || "")
    .replace(/\{ansprechpartner\}/gi, person || "");
}

export const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/;

/** Grund, warum keine E-Mail möglich ist (null = erlaubt) */
export function emailBlocker(c: Pick<Contact, "blocked" | "consent_basis" | "email">): string | null {
  if (c.blocked) return "Gesperrt (Widerspruch).";
  if (!c.consent_basis) return "Erst nach Antwort, Anfrage oder Einwilligung – Erstkontakt per Brief.";
  if (!c.email || !EMAIL_RE.test(c.email.trim())) return "Keine gültige E-Mail-Adresse.";
  return null;
}

/** Anschrift für das Sichtfenster (DIN 5008), Land in Großbuchstaben (Versand aus dem Ausland) */
export function addressLines(c: Contact): string[] {
  const person = [c.salutation === "herr" ? "Herrn" : c.salutation === "frau" ? "Frau" : "", c.title, c.first_name, c.last_name].filter(Boolean).join(" ");
  return [c.organisation, person, c.street ?? "", [c.zip, c.city].filter(Boolean).join(" "), COUNTRY_NAMES[c.country] ?? ""].map((l) => l.trim()).filter(Boolean).slice(0, 6);
}

export const addressComplete = (c: Contact) => !!(c.organisation && c.street && c.zip && c.city);

export function dueFollowups(list: Contact[], today: string) {
  return list.filter((c) => !c.blocked && c.next_followup && c.next_followup <= today && !["partner", "kein_interesse"].includes(c.status));
}

// ---------- CSV-Import ----------

const ALIASES: Record<string, keyof Contact> = {
  organisation: "organisation", organisation_name: "organisation", name: "organisation", firma: "organisation", institution: "organisation", innung: "organisation",
  art: "kind", typ: "kind", kind: "kind",
  land: "country", country: "country",
  region: "region", bundesland: "region", kanton: "region",
  anrede: "salutation", salutation: "salutation",
  titel: "title", title: "title",
  vorname: "first_name", first_name: "first_name",
  nachname: "last_name", last_name: "last_name", ansprechpartner: "last_name",
  funktion: "position", position: "position",
  strasse: "street", straße: "street", street: "street", adresse: "street",
  plz: "zip", postleitzahl: "zip", zip: "zip",
  ort: "city", stadt: "city", city: "city",
  email: "email", "e-mail": "email", mail: "email",
  telefon: "phone", phone: "phone", tel: "phone",
  website: "website", webseite: "website", internet: "website", url: "website",
  quelle: "source", source: "source",
  notiz: "notes", notizen: "notes", notes: "notes", bemerkung: "notes",
};

function splitRow(line: string, sep: string): string[] {
  const out: string[] = [];
  let cur = "";
  let q = false;
  for (let i = 0; i < line.length; i++) {
    const ch = line[i];
    if (q) {
      if (ch === '"' && line[i + 1] === '"') {
        cur += '"';
        i++;
      } else if (ch === '"') q = false;
      else cur += ch;
    } else if (ch === '"') q = true;
    else if (ch === sep) {
      out.push(cur);
      cur = "";
    } else cur += ch;
  }
  out.push(cur);
  return out.map((s) => s.trim());
}

const normKind = (v: string): Kind => {
  const s = v.toLowerCase();
  if (s.includes("kammer")) return "kammer";
  if (s.includes("landes")) return "landesverband";
  if (s.includes("fach") && s.includes("verband")) return "fachverband";
  if (s.includes("presse") || s.includes("zeitschrift") || s.includes("magazin")) return "presse";
  if (s.includes("innung")) return "innung";
  return "sonstiges";
};
const normCountry = (v: string): "DE" | "AT" | "CH" => {
  const s = v.toLowerCase();
  if (s.startsWith("at") || s.includes("österreich") || s.includes("oesterreich") || s.includes("austria")) return "AT";
  if (s.startsWith("ch") || s.includes("schweiz") || s.includes("switzerland") || s.includes("suisse")) return "CH";
  return "DE";
};
const normSal = (v: string) => (/^(herr|hr)/i.test(v) ? "herr" : /^(frau|fr)/i.test(v) ? "frau" : "");

export type ImportRow = Partial<Contact> & { organisation: string };

/** CSV (Semikolon oder Komma, erste Zeile = Spaltennamen) → Kontakte */
export function parseCsv(text: string): { rows: ImportRow[]; unknownColumns: string[]; skipped: number } {
  const lines = text.replace(/^\uFEFF/, "").split(/\r?\n/).filter((l) => l.trim());
  if (lines.length < 2) return { rows: [], unknownColumns: [], skipped: 0 };
  const sep = (lines[0].match(/;/g)?.length ?? 0) >= (lines[0].match(/,/g)?.length ?? 0) ? ";" : ",";
  const head = splitRow(lines[0], sep).map((h) => h.toLowerCase().replace(/\s+/g, "_"));
  const map = head.map((h) => ALIASES[h] ?? null);
  const unknownColumns = head.filter((_, i) => !map[i]);
  const rows: ImportRow[] = [];
  let skipped = 0;
  for (const line of lines.slice(1)) {
    const cells = splitRow(line, sep);
    const r: Record<string, string> = {};
    map.forEach((k, i) => {
      if (k && cells[i]) r[k] = r[k] ? `${r[k]} ${cells[i]}` : cells[i];
    });
    if (!r.organisation) {
      skipped++;
      continue;
    }
    rows.push({
      ...(r as Partial<Contact>),
      organisation: r.organisation.slice(0, 200),
      kind: normKind(r.kind ?? r.organisation),
      country: normCountry(r.country ?? "DE"),
      salutation: normSal(r.salutation ?? "") as Contact["salutation"],
      email: r.email ? r.email.toLowerCase() : null,
    });
  }
  return { rows, unknownColumns, skipped };
}

export const DEFAULT_TEMPLATES: Omit<Template, "id">[] = [
  {
    kind: "brief",
    name: "Vorstellung + Vortrag anbieten",
    subject: "Digitalisierung im Malerbetrieb – Angebot eines kostenlosen Vortrags für Ihre Mitglieder",
    body: `{anrede},

mein Name ist Anton Lehmann. Ich habe MalerSaaS entwickelt – eine Software speziell für Maler- und Lackiererbetriebe, mit der Aufmaß, Angebot, Auftrag, Zeiterfassung, Material und Rechnung an einem Ort laufen, im Büro und auf der Baustelle.

Viele Inhaber erzählen mir, dass die Büroarbeit abends und am Wochenende liegen bleibt. Genau dort setzt MalerSaaS an: Das Aufmaß lässt sich zum Beispiel einfach ansagen, die Rechnung ist automatisch eine E-Rechnung (ZUGFeRD).

Gern stelle ich das Thema „Digitalisierung im Malerbetrieb“ in einem kurzen, kostenlosen Vortrag bei einer Versammlung der {organisation} vor – vor Ort oder online, sachlich und ohne Verkaufsdruck.

Hätten Sie Interesse? Eine kurze Antwort an info@maler-saas.com genügt, dann stimmen wir einen Termin ab.

Mit freundlichen Grüßen`,
  },
  {
    kind: "email",
    name: "Antwort mit Infos",
    subject: "Ihre Anfrage zu MalerSaaS",
    body: `{anrede},

vielen Dank für Ihre Rückmeldung. Wie besprochen sende ich Ihnen die wichtigsten Informationen zu MalerSaaS:

– Aufmaß (auch per Sprache), Angebot, Auftrag, Zeiterfassung, Material und Rechnung in einer Software
– E-Rechnung (ZUGFeRD) in allen Tarifen
– 14 Tage kostenlos testen, endet automatisch: https://maler-saas.com

Gern zeige ich Ihnen MalerSaaS in einer kurzen Online-Vorstellung (ca. 20 Minuten). Passt Ihnen ein Termin in den nächsten Tagen?

Mit freundlichen Grüßen
Anton Lehmann`,
  },
];
