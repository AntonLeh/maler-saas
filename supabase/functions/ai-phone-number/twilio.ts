// Twilio-Anbindung für die Telefonnummer eines Betriebs
//
// Ablauf (Deutschland, Ortsnummer, Firmenkunde):
//   1. Adresse anlegen (muss im Ortsnetz der Vorwahl liegen)
//   2. Regelwerk (Regulation) für DE/local/business mit Pflichtfeldern laden
//   3. End-User (der Malerbetrieb) und Nachweise (Dokumente) anlegen
//   4. Bundle anlegen, Bestandteile zuordnen, automatisch prüfen lassen (Evaluation)
//   5. Zur Prüfung einreichen -> Twilio meldet "twilio-approved" / "twilio-rejected"
//   6. Nach Freigabe: Nummer mit passender Vorwahl suchen und kaufen
//
// Die Pflichtfelder werden zur Laufzeit aus dem Regelwerk gelesen und über
// Feldnamen zugeordnet, damit Änderungen bei Twilio nicht sofort alles brechen.

const env = (k: string) => (globalThis as any).Deno?.env?.get(k) ?? "";

export const API = () => env("TWILIO_API_URL") || "https://api.twilio.com";
export const NUMBERS = () => env("TWILIO_NUMBERS_URL") || "https://numbers.twilio.com";
export const UPLOAD = () => env("TWILIO_UPLOAD_URL") || "https://numbers-upload.twilio.com";

export class TwilioError extends Error {
  constructor(public status: number, message: string, public data?: unknown) {
    super(message);
  }
}

function auth() {
  const sid = env("TWILIO_ACCOUNT_SID");
  const token = env("TWILIO_AUTH_TOKEN");
  if (!sid || !token) throw new Error("TWILIO_ACCOUNT_SID oder TWILIO_AUTH_TOKEN fehlt (Secrets in Supabase).");
  return { sid, header: "Basic " + btoa(`${sid}:${token}`) };
}

export function accountSid() {
  return auth().sid;
}

/** Twilio-Aufruf. body: Record -> x-www-form-urlencoded, FormData -> multipart */
export async function tw(method: string, url: string, body?: Record<string, unknown> | FormData): Promise<any> {
  const headers: Record<string, string> = { authorization: auth().header };
  let payload: BodyInit | undefined;
  if (body instanceof FormData) {
    payload = body;
  } else if (body) {
    const p = new URLSearchParams();
    for (const [k, v] of Object.entries(body)) {
      if (v === undefined || v === null || v === "") continue;
      if (Array.isArray(v)) v.forEach((x) => p.append(k, String(x)));
      else p.append(k, typeof v === "object" ? JSON.stringify(v) : String(v));
    }
    payload = p;
    headers["content-type"] = "application/x-www-form-urlencoded";
  }
  const res = await fetch(url, { method, headers, body: payload, signal: AbortSignal.timeout(25000) });
  const text = await res.text();
  let data: any = {};
  try {
    data = text ? JSON.parse(text) : {};
  } catch {
    data = { raw: text.slice(0, 300) };
  }
  if (!res.ok) {
    const msg = data?.message || data?.detail || data?.raw || `HTTP ${res.status}`;
    throw new TwilioError(res.status, `Twilio ${method} ${new URL(url).pathname} → ${res.status}: ${msg}`, data);
  }
  return data;
}

// ---------------------------------------------------------------------
// Reine Hilfsfunktionen (offline testbar)
// ---------------------------------------------------------------------

export type Applicant = {
  business_name: string;
  registration_number: string;
  rep_first_name: string;
  rep_last_name: string;
  rep_email: string;
  website?: string | null;
  street: string;
  postal_code: string;
  city: string;
  region: string;
  area_code: string;
  document_issue_date?: string | null;
};

export type DocKind = "handelsregister" | "gewerbe" | "steuer";

export const DOC_KIND_PATTERNS: Record<DocKind, RegExp> = {
  handelsregister: /commercial|registr(y|ar)|register_excerpt|excerpt|handelsregister|extract/i,
  gewerbe: /trade|gewerbe|business_licen|licen[cs]e/i,
  steuer: /tax|finanzamt|freier|vat/i,
};

export const BUNDESLAENDER = [
  "Baden-Württemberg", "Bayern", "Berlin", "Brandenburg", "Bremen", "Hamburg", "Hessen",
  "Mecklenburg-Vorpommern", "Niedersachsen", "Nordrhein-Westfalen", "Rheinland-Pfalz", "Saarland",
  "Sachsen", "Sachsen-Anhalt", "Schleswig-Holstein", "Thüringen",
];

/** "06571" / "+49 6571" / "6571" -> "6571"; ungültig -> "" */
export function normalizeAreaCode(raw: string): string {
  let d = String(raw ?? "").replace(/[^\d+]/g, "");
  if (d.startsWith("+49")) d = d.slice(3);
  else if (d.startsWith("0049")) d = d.slice(4);
  d = d.replace(/\D/g, "").replace(/^0+/, "");
  // Ortsnetzkennzahlen: 2–5 Ziffern, keine Mobil- (15/16/17) oder Sondernummern (1x, 3x, 9x, 7x...)
  if (!/^[2-9]\d{1,4}$/.test(d)) return "";
  if (/^(1|3[12]|700|800|900)/.test(d)) return "";
  return d;
}

export function numberMatchesArea(e164: string, area: string): boolean {
  return !!area && String(e164).startsWith(`+49${area}`);
}

/** Wert für ein Pflichtfeld anhand seines Namens */
export function valueForField(field: string, a: Applicant, addressSid: string): unknown {
  const f = field.toLowerCase();
  if (f.includes("address_sid")) return [addressSid];
  if (f === "business_name" || f.includes("company_name") || f.includes("business_name") || f.includes("legal_name")) return a.business_name;
  if (f.includes("registration") || f.includes("vat") || f.includes("tax") || f === "document_number" || f.includes("identification_number")) {
    return a.registration_number;
  }
  if (f.includes("website") || f.includes("url")) return a.website || undefined;
  if (f.includes("first_name")) return a.rep_first_name;
  if (f.includes("last_name")) return a.rep_last_name;
  if (f.includes("email")) return a.rep_email;
  if (f.includes("representative") || f.includes("contact_name") || f === "name") return `${a.rep_first_name} ${a.rep_last_name}`.trim();
  if (f.includes("issue_date") || f.includes("issuance_date")) return a.document_issue_date || undefined;
  return undefined;
}

export function attributesFor(fields: string[], a: Applicant, addressSid: string): Record<string, unknown> {
  const out: Record<string, unknown> = {};
  for (const f of fields) {
    const v = valueForField(f, a, addressSid);
    if (v !== undefined && v !== "") out[f] = v;
  }
  return out;
}

type AcceptedDoc = { name?: string; type: string; fields?: string[] };
type DocRequirement = { requirement_name?: string; name?: string; accepted_documents?: AcceptedDoc[] };

/** supporting_document ist bei Twilio eine verschachtelte Liste -> flach machen */
export function flattenDocRequirements(sd: unknown): DocRequirement[] {
  const out: DocRequirement[] = [];
  const walk = (x: unknown) => {
    if (Array.isArray(x)) x.forEach(walk);
    else if (x && typeof x === "object" && Array.isArray((x as any).accepted_documents)) out.push(x as DocRequirement);
  };
  walk(sd);
  return out;
}

export type UploadedDoc = { index: number; kind: DocKind };
export type DocPlan = { fileIndex: number; type: string; name: string; fields: string[]; requirements: string[] };

/**
 * Welche Datei wird als welcher Dokumenttyp eingereicht?
 * Ein Dokument kann mehrere Anforderungen erfüllen (Name, Adresse, Registernummer) –
 * dann wird es nur einmal angelegt, mit allen nötigen Feldern.
 */
export function planDocuments(requirements: DocRequirement[], uploads: UploadedDoc[]): { plan: DocPlan[]; unmet: string[] } {
  const plan: DocPlan[] = [];
  const unmet: string[] = [];
  for (const req of requirements) {
    const reqName = req.requirement_name || req.name || "Nachweis";
    const accepted = req.accepted_documents ?? [];
    // Schon geplante Dokumente wiederverwenden, wenn ihr Typ hier akzeptiert wird
    const reuse = plan.find((p) => accepted.some((d) => d.type === p.type));
    if (reuse) {
      const doc = accepted.find((d) => d.type === reuse.type)!;
      for (const f of doc.fields ?? []) if (!reuse.fields.includes(f)) reuse.fields.push(f);
      reuse.requirements.push(reqName);
      continue;
    }
    let chosen: { up: UploadedDoc; doc: AcceptedDoc } | null = null;
    for (const up of uploads) {
      const doc = accepted.find((d) => DOC_KIND_PATTERNS[up.kind].test(`${d.type} ${d.name ?? ""}`));
      if (doc) {
        chosen = { up, doc };
        break;
      }
    }
    if (!chosen && uploads.length === 1 && accepted.length) chosen = { up: uploads[0], doc: accepted[0] };
    if (!chosen) {
      unmet.push(reqName);
      continue;
    }
    plan.push({
      fileIndex: chosen.up.index,
      type: chosen.doc.type,
      name: chosen.doc.name ?? chosen.doc.type,
      fields: [...(chosen.doc.fields ?? [])],
      requirements: [reqName],
    });
  }
  return { plan, unmet };
}

/** Lesbare Zusammenfassung einer nicht bestandenen Evaluation */
export function evaluationProblems(evaluation: any): string[] {
  const out: string[] = [];
  for (const r of evaluation?.results ?? []) {
    if (r?.passed === true || r?.valid === true) continue;
    const fields = (r?.fields ?? [])
      .filter((f: any) => f?.passed === false || f?.valid === false)
      .map((f: any) => f?.friendly_name || f?.object_field || f?.field_name)
      .filter(Boolean);
    const label = r?.friendly_name || r?.requirement_friendly_name || r?.requirement_name || r?.object_type || "Anforderung";
    out.push(fields.length ? `${label}: ${fields.join(", ")}` : String(label));
  }
  return out;
}

// ---------------------------------------------------------------------
// Twilio-Schritte
// ---------------------------------------------------------------------

export async function loadRegulation() {
  const q = new URLSearchParams({ IsoCountry: "DE", NumberType: "local", EndUserType: "business", IncludeConstraints: "true" });
  const data = await tw("GET", `${NUMBERS()}/v2/RegulatoryCompliance/Regulations?${q}`);
  const list = data?.results ?? data?.regulations ?? [];
  if (!list.length) throw new Error("Twilio liefert kein Regelwerk für deutsche Ortsnummern (DE/local/business).");
  return list[0];
}

export async function createAddress(a: Applicant, label: string) {
  return tw("POST", `${API()}/2010-04-01/Accounts/${accountSid()}/Addresses.json`, {
    CustomerName: a.business_name,
    FriendlyName: label,
    Street: a.street,
    City: a.city,
    Region: a.region,
    PostalCode: a.postal_code,
    IsoCountry: "DE",
    AutoCorrectAddress: "false",
  });
}

export async function createEndUser(regulation: any, a: Applicant, addressSid: string, label: string) {
  const fields: string[] = [];
  for (const eu of regulation?.requirements?.end_user ?? []) {
    for (const f of eu?.fields ?? []) if (!fields.includes(f)) fields.push(f);
  }
  const attributes = attributesFor(fields.length ? fields : ["business_name", "business_registration_number"], a, addressSid);
  return tw("POST", `${NUMBERS()}/v2/RegulatoryCompliance/EndUsers`, {
    FriendlyName: label,
    Type: "business",
    Attributes: attributes,
  });
}

export async function createDocument(p: DocPlan, file: File, a: Applicant, addressSid: string, label: string) {
  const fd = new FormData();
  fd.append("FriendlyName", `${label} – ${p.name}`.slice(0, 64));
  fd.append("Type", p.type);
  fd.append("Attributes", JSON.stringify(attributesFor(p.fields, a, addressSid)));
  fd.append("File", file, file.name || "nachweis.pdf");
  return tw("POST", `${UPLOAD()}/v2/RegulatoryCompliance/SupportingDocuments`, fd);
}

export async function createBundle(regulationSid: string, label: string, email: string, statusCallback: string) {
  return tw("POST", `${NUMBERS()}/v2/RegulatoryCompliance/Bundles`, {
    FriendlyName: label,
    Email: email,
    StatusCallback: statusCallback,
    RegulationSid: regulationSid,
  });
}

export async function assignItem(bundleSid: string, objectSid: string) {
  return tw("POST", `${NUMBERS()}/v2/RegulatoryCompliance/Bundles/${bundleSid}/ItemAssignments`, { ObjectSid: objectSid });
}

export async function evaluateBundle(bundleSid: string) {
  return tw("POST", `${NUMBERS()}/v2/RegulatoryCompliance/Bundles/${bundleSid}/Evaluations`);
}

export async function submitBundle(bundleSid: string) {
  return tw("POST", `${NUMBERS()}/v2/RegulatoryCompliance/Bundles/${bundleSid}`, { Status: "pending-review" });
}

export async function getBundle(bundleSid: string) {
  return tw("GET", `${NUMBERS()}/v2/RegulatoryCompliance/Bundles/${bundleSid}`);
}

/** Freie Ortsnummer mit der Vorwahl des Betriebs */
export async function findNumber(area: string): Promise<string | null> {
  const base = `${API()}/2010-04-01/Accounts/${accountSid()}/AvailablePhoneNumbers/DE/Local.json`;
  for (const pattern of [`+49${area}*`, `49${area}*`, `${area}*`]) {
    try {
      const q = new URLSearchParams({ VoiceEnabled: "true", Contains: pattern, PageSize: "20" });
      const data = await tw("GET", `${base}?${q}`);
      const hit = (data?.available_phone_numbers ?? []).find((n: any) => numberMatchesArea(n.phone_number, area));
      if (hit) return hit.phone_number;
    } catch (e) {
      if (!(e instanceof TwilioError) || e.status >= 500) throw e;
    }
  }
  return null;
}

export async function buyNumber(phoneNumber: string, bundleSid: string, addressSid: string, label: string) {
  return tw("POST", `${API()}/2010-04-01/Accounts/${accountSid()}/IncomingPhoneNumbers.json`, {
    PhoneNumber: phoneNumber,
    BundleSid: bundleSid,
    AddressSid: addressSid,
    FriendlyName: label,
  });
}
