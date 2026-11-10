// Mitarbeiter-Arten: Beschäftigungsart, Vergütung, Kosten-Stundensatz
export type EmploymentType = "gewerblich" | "angestellt" | "azubi" | "minijob" | "leiharbeit" | "sub";
export type PayType = "stunde" | "monat";
export type SubBilling = "stunde" | "pauschale" | "aufmass";

export const EMPLOYMENT: Record<EmploymentType, { label: string; short: string; color: string; bg: string; own: boolean; hint: string }> = {
  gewerblich: { label: "Festangestellt – gewerblich", short: "Festangestellt", color: "#1d4ed8", bg: "#dbeafe", own: true, hint: "Maler, Gesellen, Vorarbeiter – auch Projektleiter" },
  angestellt: { label: "Festangestellt – Büro / Lager", short: "Büro / Lager", color: "#0f766e", bg: "#ccfbf1", own: true, hint: "Büro, Lager, Verwaltung" },
  azubi: { label: "Auszubildender", short: "Azubi", color: "#7c3aed", bg: "#ede9fe", own: true, hint: "Ausbildung zum Maler und Lackierer" },
  minijob: { label: "Minijob / Aushilfe", short: "Minijob", color: "#c2410c", bg: "#ffedd5", own: true, hint: "geringfügig beschäftigt" },
  leiharbeit: { label: "Leiharbeiter (Zeitarbeitsfirma)", short: "Leiharbeit", color: "#b45309", bg: "#fef3c7", own: false, hint: "von einer Zeitarbeitsfirma überlassen" },
  sub: { label: "Subunternehmer", short: "Subunternehmer", color: "#475569", bg: "#e2e8f0", own: false, hint: "selbstständig, rechnet per Rechnung ab" },
};

export const EMPLOYMENT_ORDER: EmploymentType[] = ["gewerblich", "angestellt", "azubi", "minijob", "leiharbeit", "sub"];

export const SUB_BILLING: Record<SubBilling, string> = {
  stunde: "nach Stunden",
  pauschale: "Pauschale je Auftrag",
  aufmass: "nach Aufmaß (m², lfm …)",
};

export type Pay = {
  pay_type: PayType;
  hourly_wage: number | null;
  monthly_salary: number | null;
  weekly_hours: number | null;
  overhead_pct: number | null;
  rate_manual: boolean;
  training_year: number | null;
  agency_name: string | null;
  agency_rate: number | null;
  assignment_start: string | null;
  sub_company: string | null;
  sub_street: string | null;
  sub_zip: string | null;
  sub_city: string | null;
  sub_vat_id: string | null;
  sub_billing: SubBilling | null;
  sub_rate: number | null;
  notes: string | null;
};

export const EMPTY_PAY: Pay = {
  pay_type: "stunde",
  hourly_wage: null,
  monthly_salary: null,
  weekly_hours: 40,
  overhead_pct: null,
  rate_manual: false,
  training_year: null,
  agency_name: null,
  agency_rate: null,
  assignment_start: null,
  sub_company: null,
  sub_street: null,
  sub_zip: null,
  sub_city: null,
  sub_vat_id: null,
  sub_billing: "stunde",
  sub_rate: null,
  notes: null,
};

/** Vorschlag für den Zuschlag (Lohnnebenkosten bzw. Arbeitgeberanteile) */
export function defaultOverhead(type: EmploymentType, pay: PayType): number {
  if (type === "minijob") return 30; // Pauschalabgaben ca. 30 %
  if (pay === "monat") return 25; // Arbeitgeberanteile Sozialversicherung u. a.
  return 80; // Stundenlohn: Sozialversicherung, Urlaub, Feiertage, Krankheit
}

const round2 = (n: number) => Math.round(n * 100) / 100;

/** Bezahlte Stunden im Monat bei x Wochenstunden (Ø 52 Wochen / 12 Monate) */
export const monthlyHours = (weekly: number) => (weekly * 52) / 12;

/**
 * Kosten-Stundensatz, mit dem Stunden in Zeitauswertung und Nachkalkulation gerechnet werden.
 * null = nicht berechenbar (z. B. Subunternehmer mit Pauschale).
 */
export function costRate(type: EmploymentType, p: Pay): number | null {
  if (type === "leiharbeit") return p.agency_rate != null ? round2(p.agency_rate) : null;
  if (type === "sub") return p.sub_billing === "stunde" && p.sub_rate != null ? round2(p.sub_rate) : null;
  const pct = (p.overhead_pct ?? defaultOverhead(type, p.pay_type)) / 100;
  if (p.pay_type === "monat") {
    if (!p.monthly_salary || !p.weekly_hours) return null;
    return round2((p.monthly_salary * (1 + pct)) / monthlyHours(p.weekly_hours));
  }
  if (p.hourly_wage == null) return null;
  return round2(p.hourly_wage * (1 + pct));
}

/** Rechenweg als Text, damit der Satz nachvollziehbar ist */
export function costExplain(type: EmploymentType, p: Pay, cur = "€"): string {
  const f = (n: number) => n.toLocaleString("de-DE", { minimumFractionDigits: 2, maximumFractionDigits: 2 });
  if (type === "leiharbeit") return "= Verrechnungssatz der Zeitarbeitsfirma";
  if (type === "sub") return p.sub_billing === "stunde" ? "= Stundensatz des Subunternehmers" : "Abrechnung über die Rechnung des Subunternehmers – kein Stundensatz";
  const pct = p.overhead_pct ?? defaultOverhead(type, p.pay_type);
  if (p.pay_type === "monat") {
    if (!p.monthly_salary || !p.weekly_hours) return "Monatsgehalt und Wochenstunden eintragen";
    const h = monthlyHours(p.weekly_hours);
    return `${f(p.monthly_salary)} ${cur} + ${pct} % = ${f(p.monthly_salary * (1 + pct / 100))} ${cur} ÷ ${h.toLocaleString("de-DE", { maximumFractionDigits: 1 })} Std./Monat`;
  }
  if (p.hourly_wage == null) return "Stundenlohn eintragen";
  return `${f(p.hourly_wage)} ${cur} + ${pct} % Lohnnebenkosten`;
}

// ---------- Minijob (Deutschland) ----------
const MINDESTLOHN: Record<number, number> = { 2025: 12.82, 2026: 13.9, 2027: 14.6 };

/** Minijob-Grenze = Mindestlohn × 130 ÷ 3, aufgerundet */
export function minijobLimit(year = new Date().getFullYear()): number {
  const known = Object.keys(MINDESTLOHN).map(Number);
  const y = MINDESTLOHN[year] ? year : Math.max(...known.filter((k) => k <= year), Math.min(...known));
  return Math.ceil((MINDESTLOHN[y] * 130) / 3);
}

export function minijobHint(p: Pay, year = new Date().getFullYear()): string | null {
  const limit = minijobLimit(year);
  if (p.pay_type === "monat") {
    if (p.monthly_salary && p.monthly_salary > limit) return `Achtung: ${p.monthly_salary} € liegt über der Minijob-Grenze von ${limit} € im Monat.`;
    return `Minijob-Grenze ${year}: ${limit} € im Monat.`;
  }
  if (!p.hourly_wage) return `Minijob-Grenze ${year}: ${limit} € im Monat.`;
  const max = Math.floor((limit / p.hourly_wage) * 10) / 10;
  return `Minijob-Grenze ${year}: ${limit} € im Monat – bei ${p.hourly_wage.toLocaleString("de-DE")} € Stundenlohn höchstens ${max.toLocaleString("de-DE")} Stunden im Monat.`;
}

// ---------- Leiharbeit: Höchstüberlassungsdauer 18 Monate (§ 1 Abs. 1b AÜG) ----------
export function monthsSince(date: string, today = new Date()): number {
  const d = new Date(`${date}T12:00:00`);
  return (today.getFullYear() - d.getFullYear()) * 12 + (today.getMonth() - d.getMonth()) - (today.getDate() < d.getDate() ? 1 : 0);
}

export function assignmentEnd(date: string): string {
  const d = new Date(`${date}T12:00:00`);
  d.setMonth(d.getMonth() + 18);
  d.setDate(d.getDate() - 1);
  return d.toLocaleDateString("de-DE");
}

export function leihHint(p: Pay, today = new Date()): { text: string; warn: boolean } | null {
  if (!p.assignment_start) return null;
  const m = monthsSince(p.assignment_start, today);
  const end = assignmentEnd(p.assignment_start);
  if (m >= 18) return { text: `Die gesetzliche Höchstdauer von 18 Monaten ist überschritten (Ende war ${end}). Bitte mit der Zeitarbeitsfirma klären.`, warn: true };
  if (m >= 15) return { text: `Höchstdauer von 18 Monaten endet am ${end}. Bitte rechtzeitig mit der Zeitarbeitsfirma klären.`, warn: true };
  return { text: `Einsatz seit ${m} Monaten – Höchstdauer 18 Monate (bis ${end}).`, warn: false };
}

/** Daten aus der Datenbank → Formular (fehlende Felder mit Standardwerten) */
export function toPay(row: Partial<Pay> | null | undefined): Pay {
  const p = { ...EMPTY_PAY };
  if (!row) return p;
  for (const k of Object.keys(EMPTY_PAY) as (keyof Pay)[]) {
    const v = row[k];
    if (v !== undefined && v !== null) (p as Record<string, unknown>)[k] = typeof EMPTY_PAY[k] === "number" || ["hourly_wage", "monthly_salary", "weekly_hours", "overhead_pct", "training_year", "agency_rate", "sub_rate"].includes(k) ? Number(v) : v;
  }
  return p;
}

/** Nur die Felder, die zur Beschäftigungsart gehören (Rest leeren) */
export function cleanPay(type: EmploymentType, p: Pay): Pay {
  const own = EMPLOYMENT[type].own;
  return {
    ...EMPTY_PAY,
    pay_type: own ? p.pay_type : "stunde",
    hourly_wage: own && p.pay_type === "stunde" ? p.hourly_wage : null,
    monthly_salary: own && p.pay_type === "monat" ? p.monthly_salary : null,
    weekly_hours: own ? p.weekly_hours : null,
    overhead_pct: own ? p.overhead_pct : null,
    rate_manual: p.rate_manual,
    training_year: type === "azubi" ? p.training_year : null,
    agency_name: type === "leiharbeit" ? p.agency_name?.trim() || null : null,
    agency_rate: type === "leiharbeit" ? p.agency_rate : null,
    assignment_start: type === "leiharbeit" ? p.assignment_start || null : null,
    sub_company: type === "sub" ? p.sub_company?.trim() || null : null,
    sub_street: type === "sub" ? p.sub_street?.trim() || null : null,
    sub_zip: type === "sub" ? p.sub_zip?.trim() || null : null,
    sub_city: type === "sub" ? p.sub_city?.trim() || null : null,
    sub_vat_id: type === "sub" ? p.sub_vat_id?.trim() || null : null,
    sub_billing: type === "sub" ? p.sub_billing ?? "stunde" : null,
    sub_rate: type === "sub" ? p.sub_rate : null,
    notes: p.notes?.trim() || null,
  };
}

// ---------- Liste: Filter nach Art bzw. „Ausgeschieden“ ----------
export const EXIT_FILTER = "__ausgeschieden";
export const EXIT_REASONS = ["Einsatz beendet", "Kündigung durch Mitarbeiter", "Kündigung durch Betrieb", "Vertrag ausgelaufen", "Ausbildung beendet", "Sonstiges"];

type ListPerson = { role_id: number; employment_type?: string | null; is_active?: boolean | null };

/** Standard: nur aktive; Filter „Ausgeschieden“: nur inaktive; Chef/Admin immer bei „Alle“ */
export function filterPeople<T extends ListPerson>(list: T[], filter: string): T[] {
  if (filter === EXIT_FILTER) return list.filter((e) => e.is_active === false);
  return list.filter((e) => e.is_active !== false && (!filter || (e.role_id !== 2 && (e.employment_type || "gewerblich") === filter)));
}
