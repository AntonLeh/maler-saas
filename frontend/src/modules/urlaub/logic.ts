// Urlaub & Abwesenheiten: Arten, Feiertage (DACH), Tage zählen, Urlaubsanspruch, Resturlaub, Soll-Stunden
export type Land = "de" | "at" | "ch";
export type AbsenceKind = "urlaub" | "krank" | "kind_krank" | "berufsschule" | "sonderurlaub" | "unbezahlt" | "ueberstunden" | "schlechtwetter";
export type Status = "beantragt" | "genehmigt" | "abgelehnt";

export type Absence = {
  id: number;
  tenant_id: number;
  user_id: number;
  kind: AbsenceKind;
  start_date: string;
  end_date: string;
  start_half: boolean;
  end_half: boolean;
  au_present: boolean;
  note: string | null;
  status: Status;
  created_at?: string;
};

export type YearData = { carry?: number | null; entitled?: number | null };
export type Leave = {
  user_id: number;
  tenant_id: number;
  vacation_days: number | null;
  work_weekdays: number[];
  entry_date: string | null;
  years: Record<string, YearData>;
};

export const KINDS: Record<AbsenceKind, { label: string; short: string; color: string; bg: string; icon: string; hint?: string }> = {
  urlaub: { label: "Urlaub", short: "Urlaub", color: "#1d4ed8", bg: "#dbeafe", icon: "🏖" },
  krank: { label: "Krank", short: "Krank", color: "#b91c1c", bg: "#fee2e2", icon: "🤒", hint: "Ab dem 4. Kalendertag ist in der Regel eine AU-Bescheinigung nötig (in Deutschland meist elektronisch – eAU beim Steuerberater abrufen)." },
  kind_krank: { label: "Kind krank", short: "Kind krank", color: "#be185d", bg: "#fce7f3", icon: "🧸" },
  berufsschule: { label: "Berufsschule", short: "Schule", color: "#7c3aed", bg: "#ede9fe", icon: "🎓" },
  sonderurlaub: { label: "Sonderurlaub (bezahlt)", short: "Sonderurlaub", color: "#0f766e", bg: "#ccfbf1", icon: "💍", hint: "z. B. eigene Hochzeit, Geburt, Todesfall, Umzug – je nach Arbeits- oder Tarifvertrag." },
  unbezahlt: { label: "Unbezahlter Urlaub", short: "Unbezahlt", color: "#475569", bg: "#e2e8f0", icon: "⏸" },
  ueberstunden: { label: "Überstundenabbau", short: "Ü-Abbau", color: "#b45309", bg: "#fef3c7", icon: "⏱", hint: "Zählt nicht vom Urlaub ab, sondern wird mit den Mehrstunden verrechnet." },
  schlechtwetter: { label: "Schlechtwetter / Winterausfall", short: "Schlechtwetter", color: "#0369a1", bg: "#e0f2fe", icon: "🌧", hint: "Ausfallstunden für das Saison-Kurzarbeitergeld bzw. die Schlechtwetterentschädigung an den Steuerberater melden." },
};
export const KIND_ORDER: AbsenceKind[] = ["urlaub", "krank", "kind_krank", "berufsschule", "sonderurlaub", "unbezahlt", "ueberstunden", "schlechtwetter"];

export const WEEKDAYS = [
  { n: 1, short: "Mo" },
  { n: 2, short: "Di" },
  { n: 3, short: "Mi" },
  { n: 4, short: "Do" },
  { n: 5, short: "Fr" },
  { n: 6, short: "Sa" },
];

// ---------- Datum ----------
const pad = (n: number) => String(n).padStart(2, "0");
export const ymd = (d: Date) => `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`;
export const todayIso = () => ymd(new Date());
const noon = (iso: string) => new Date(`${iso}T12:00:00`);
export const addDays = (iso: string, n: number) => {
  const d = noon(iso);
  d.setDate(d.getDate() + n);
  return ymd(d);
};
export const deDate = (iso: string) => noon(iso).toLocaleDateString("de-DE", { day: "2-digit", month: "2-digit", year: "numeric" });
export const deShort = (iso: string) => noon(iso).toLocaleDateString("de-DE", { day: "2-digit", month: "2-digit" });
export const fmtDays = (n: number) => `${n.toLocaleString("de-DE", { maximumFractionDigits: 1 })} ${Math.abs(n) === 1 ? "Tag" : "Tage"}`;
export const fmtNum = (n: number) => n.toLocaleString("de-DE", { maximumFractionDigits: 1 });

// ---------- Feiertage ----------
export function easter(year: number): string {
  const a = year % 19, b = Math.floor(year / 100), c = year % 100, d = Math.floor(b / 4), e = b % 4;
  const f = Math.floor((b + 8) / 25), g = Math.floor((b - f + 1) / 3), h = (19 * a + b - d - g + 15) % 30;
  const i = Math.floor(c / 4), k = c % 4, l = (32 + 2 * e + 2 * i - h - k) % 7, m = Math.floor((a + 11 * h + 22 * l) / 451);
  const month = Math.floor((h + l - 7 * m + 114) / 31), day = ((h + l - 7 * m + 114) % 31) + 1;
  return `${year}-${pad(month)}-${pad(day)}`;
}

export const DE_REGIONS: { code: string; label: string }[] = [
  { code: "BW", label: "Baden-Württemberg" },
  { code: "BY", label: "Bayern (Gemeinde ohne Mariä Himmelfahrt)" },
  { code: "BY-MH", label: "Bayern (Gemeinde mit Mariä Himmelfahrt)" },
  { code: "BE", label: "Berlin" },
  { code: "BB", label: "Brandenburg" },
  { code: "HB", label: "Bremen" },
  { code: "HH", label: "Hamburg" },
  { code: "HE", label: "Hessen" },
  { code: "MV", label: "Mecklenburg-Vorpommern" },
  { code: "NI", label: "Niedersachsen" },
  { code: "NW", label: "Nordrhein-Westfalen" },
  { code: "RP", label: "Rheinland-Pfalz" },
  { code: "SL", label: "Saarland" },
  { code: "SN", label: "Sachsen" },
  { code: "ST", label: "Sachsen-Anhalt" },
  { code: "SH", label: "Schleswig-Holstein" },
  { code: "TH", label: "Thüringen" },
];

export function landOf(country: string | null | undefined): Land {
  const c = String(country ?? "").trim().toLowerCase();
  if (["at", "österreich", "oesterreich", "austria"].includes(c)) return "at";
  if (["ch", "schweiz", "switzerland", "suisse", "svizzera"].includes(c)) return "ch";
  return "de";
}

/** Gesetzliche Feiertage eines Jahres: Datum → Name */
export function holidays(year: number, land: Land, region: string | null | undefined): Map<string, string> {
  const m = new Map<string, string>();
  const e = easter(year);
  const add = (d: string, n: string) => m.set(d, n);
  const fix = (md: string, n: string) => add(`${year}-${md}`, n);
  const r = String(region ?? "").toUpperCase();
  const st = r.startsWith("BY") ? "BY" : r;
  const inR = (...codes: string[]) => codes.includes(st);
  if (land === "de") {
    fix("01-01", "Neujahr");
    if (inR("BW", "BY", "ST")) fix("01-06", "Heilige Drei Könige");
    if (inR("BE") || (inR("MV") && year >= 2023)) fix("03-08", "Internationaler Frauentag");
    add(addDays(e, -2), "Karfreitag");
    add(addDays(e, 1), "Ostermontag");
    fix("05-01", "Tag der Arbeit");
    add(addDays(e, 39), "Christi Himmelfahrt");
    add(addDays(e, 50), "Pfingstmontag");
    if (inR("BW", "BY", "HE", "NW", "RP", "SL")) add(addDays(e, 60), "Fronleichnam");
    if (inR("SL") || r === "BY-MH") fix("08-15", "Mariä Himmelfahrt");
    if (inR("TH") && year >= 2019) fix("09-20", "Weltkindertag");
    fix("10-03", "Tag der Deutschen Einheit");
    if (inR("BB", "MV", "SN", "ST", "TH") || (inR("HB", "HH", "NI", "SH") && year >= 2018)) fix("10-31", "Reformationstag");
    if (inR("BW", "BY", "NW", "RP", "SL")) fix("11-01", "Allerheiligen");
    if (inR("SN")) {
      // Buß- und Bettag: Mittwoch vor dem 23. November
      const d = noon(`${year}-11-22`);
      while (d.getDay() !== 3) d.setDate(d.getDate() - 1);
      add(ymd(d), "Buß- und Bettag");
    }
    fix("12-25", "1. Weihnachtstag");
    fix("12-26", "2. Weihnachtstag");
  } else if (land === "at") {
    fix("01-01", "Neujahr");
    fix("01-06", "Heilige Drei Könige");
    add(addDays(e, 1), "Ostermontag");
    fix("05-01", "Staatsfeiertag");
    add(addDays(e, 39), "Christi Himmelfahrt");
    add(addDays(e, 50), "Pfingstmontag");
    add(addDays(e, 60), "Fronleichnam");
    fix("08-15", "Mariä Himmelfahrt");
    fix("10-26", "Nationalfeiertag");
    fix("11-01", "Allerheiligen");
    fix("12-08", "Mariä Empfängnis");
    fix("12-25", "Christtag");
    fix("12-26", "Stefanitag");
  } else {
    fix("01-01", "Neujahr");
    fix("01-02", "Berchtoldstag");
    add(addDays(e, -2), "Karfreitag");
    add(addDays(e, 1), "Ostermontag");
    add(addDays(e, 39), "Auffahrt");
    add(addDays(e, 50), "Pfingstmontag");
    fix("08-01", "Bundesfeiertag");
    fix("12-25", "Weihnachten");
    fix("12-26", "Stephanstag");
  }
  return m;
}

/** Feiertage für einen Zeitraum (über Jahresgrenzen) */
export function holidaySet(from: string, to: string, land: Land, region: string | null | undefined): Map<string, string> {
  const out = new Map<string, string>();
  for (let y = Number(from.slice(0, 4)); y <= Number(to.slice(0, 4)); y++) for (const [d, n] of holidays(y, land, region)) out.set(d, n);
  return out;
}

export type Calendar = { land: Land; region: string | null };
const holCache = new Map<string, Map<string, string>>();
export function isHoliday(day: string, cal: Calendar): string | undefined {
  const key = `${day.slice(0, 4)}|${cal.land}|${cal.region ?? ""}`;
  let h = holCache.get(key);
  if (!h) {
    h = holidays(Number(day.slice(0, 4)), cal.land, cal.region);
    holCache.set(key, h);
  }
  return h.get(day);
}

const weekdayOf = (iso: string) => noon(iso).getDay(); // 0 = So
export const DEFAULT_WEEKDAYS = [1, 2, 3, 4, 5];
export const isWorkday = (day: string, weekdays: number[], cal: Calendar) => weekdays.includes(weekdayOf(day)) && !isHoliday(day, cal);

// ---------- Tage einer Abwesenheit ----------
/** Arbeitstage einer Abwesenheit je Datum (1 oder 0,5), optional auf einen Zeitraum begrenzt */
export function absenceDays(a: Pick<Absence, "start_date" | "end_date" | "start_half" | "end_half">, weekdays: number[], cal: Calendar, from?: string, to?: string): Map<string, number> {
  const m = new Map<string, number>();
  const s = from && from > a.start_date ? from : a.start_date;
  const e = to && to < a.end_date ? to : a.end_date;
  for (let d = s; d <= e; d = addDays(d, 1)) {
    if (!isWorkday(d, weekdays, cal)) continue;
    let v = 1;
    if (d === a.start_date && a.start_half) v = 0.5;
    if (d === a.end_date && a.end_half) v = Math.min(v, 0.5);
    m.set(d, v);
  }
  return m;
}
export const countDays = (a: Parameters<typeof absenceDays>[0], weekdays: number[], cal: Calendar, from?: string, to?: string) =>
  [...absenceDays(a, weekdays, cal, from, to).values()].reduce((s, v) => s + v, 0);

// ---------- Urlaubsanspruch ----------
const roundLeave = (n: number) => {
  // § 5 Abs. 2 BUrlG: Bruchteile ab einem halben Tag werden aufgerundet
  const f = n - Math.floor(n);
  return f >= 0.5 ? Math.ceil(n) : Math.round(n * 10) / 10;
};
/** volle Beschäftigungsmonate zwischen zwei Daten (einschließlich) */
function fullMonths(from: string, to: string): number {
  let n = 0;
  let cur = from;
  while (true) {
    const d = noon(cur);
    const next = ymd(new Date(d.getFullYear(), d.getMonth() + 1, d.getDate(), 12));
    if (addDays(next, -1) > to) break;
    n++;
    cur = next;
  }
  return n;
}

/**
 * Vorschlag Urlaubsanspruch im Jahr (Bundesurlaubsgesetz):
 * Eintritt nach dem 1.7. → 1/12 je vollem Monat; Austritt bis 30.6. → 1/12 je vollem Monat; sonst voller Anspruch.
 */
export function suggestedEntitlement(l: Pick<Leave, "vacation_days" | "entry_date">, year: number, exitDate?: string | null): { days: number; note: string } {
  const full = Number(l.vacation_days ?? 0);
  if (!full) return { days: 0, note: "" };
  const ys = `${year}-01-01`, ye = `${year}-12-31`;
  const start = l.entry_date && l.entry_date > ys ? l.entry_date : ys;
  const end = exitDate && exitDate < ye ? exitDate : ye;
  if (start > ye || end < ys || end < start) return { days: 0, note: "in diesem Jahr nicht beschäftigt" };
  const lateEntry = !!l.entry_date && l.entry_date > `${year}-07-01`;
  const earlyExit = !!exitDate && exitDate <= `${year}-06-30`;
  if (!lateEntry && !earlyExit) return { days: full, note: "" };
  const months = fullMonths(start, end);
  return { days: roundLeave((full * months) / 12), note: `anteilig ${months}/12 (${lateEntry ? "Eintritt" : "Austritt"} im Jahr)` };
}

export type Balance = { year: number; entitled: number; entitledNote: string; carry: number; taken: number; planned: number; rest: number; byKind: Record<AbsenceKind, number> };

const emptyKinds = (): Record<AbsenceKind, number> => Object.fromEntries(KIND_ORDER.map((k) => [k, 0])) as Record<AbsenceKind, number>;

/** Urlaubskonto eines Jahres; Resturlaub aus dem Vorjahr wird automatisch weitergeführt */
export function balance(l: Leave, year: number, absences: Absence[], cal: Calendar, exitDate?: string | null, today = todayIso()): Balance {
  const firstYear = Math.min(year, ...Object.keys(l.years ?? {}).map(Number).filter(Number.isFinite));
  let carry = 0;
  let res: Balance | null = null;
  for (let y = firstYear; y <= year; y++) {
    const yd = l.years?.[String(y)] ?? {};
    if (yd.carry != null) carry = Number(yd.carry);
    else if (y === firstYear) carry = 0;
    const sug = suggestedEntitlement(l, y, exitDate);
    const entitled = yd.entitled != null ? Number(yd.entitled) : sug.days;
    const byKind = emptyKinds();
    let taken = 0, planned = 0;
    for (const a of absences) {
      if (a.status !== "genehmigt" || Number(a.user_id) !== Number(l.user_id)) continue;
      const days = absenceDays(a, l.work_weekdays?.length ? l.work_weekdays : DEFAULT_WEEKDAYS, cal, `${y}-01-01`, `${y}-12-31`);
      for (const [d, v] of days) {
        byKind[a.kind] += v;
        if (a.kind === "urlaub") {
          if (d <= today) taken += v;
          else planned += v;
        }
      }
    }
    res = { year: y, entitled, entitledNote: yd.entitled != null ? "angepasst" : sug.note, carry, taken, planned, rest: Math.round((entitled + carry - taken - planned) * 10) / 10, byKind };
    carry = Math.max(0, res.rest);
  }
  return res!;
}

// ---------- Soll-Stunden ----------
/** Abwesende Arbeitstage einer Person (alles außer Überstundenabbau senkt das Soll) */
export function absentMap(userId: number, absences: Absence[], weekdays: number[], cal: Calendar, from: string, to: string): Map<string, number> {
  const m = new Map<string, number>();
  for (const a of absences) {
    if (Number(a.user_id) !== Number(userId) || a.status !== "genehmigt" || a.kind === "ueberstunden") continue;
    if (a.end_date < from || a.start_date > to) continue;
    for (const [d, v] of absenceDays(a, weekdays, cal, from, to)) m.set(d, Math.min(1, (m.get(d) ?? 0) + v));
  }
  return m;
}

/**
 * Soll-Minuten: Wochenstunden verteilt auf die Arbeitstage, ohne Feiertage und Abwesenheiten,
 * begrenzt auf Eintritt/Austritt.
 */
export function sollMinutes(weekly: number | null, from: string, to: string, o: { weekdays?: number[]; cal: Calendar; entryDate?: string | null; exitDate?: string | null; absent?: Map<string, number> }): number {
  if (!weekly) return 0;
  const wd = o.weekdays?.length ? o.weekdays : DEFAULT_WEEKDAYS;
  const start = o.entryDate && o.entryDate > from ? o.entryDate : from;
  const end = o.exitDate && o.exitDate < to ? o.exitDate : to;
  if (end < start) return 0;
  const perDay = (weekly / wd.length) * 60;
  let n = 0;
  for (let d = start; d <= end; d = addDays(d, 1)) {
    if (!isWorkday(d, wd, o.cal)) continue;
    n += perDay * (1 - (o.absent?.get(d) ?? 0));
  }
  return Math.round(n);
}

/** Tage je Art in einem Zeitraum (für Lohnliste) */
export function kindDays(userId: number, absences: Absence[], weekdays: number[], cal: Calendar, from: string, to: string): Record<AbsenceKind, number> {
  const k = emptyKinds();
  for (const a of absences) {
    if (Number(a.user_id) !== Number(userId) || a.status !== "genehmigt" || a.end_date < from || a.start_date > to) continue;
    k[a.kind] += countDays(a, weekdays, cal, from, to);
  }
  return k;
}

export function kindSummary(k: Record<AbsenceKind, number>): string {
  return KIND_ORDER.filter((x) => k[x] > 0)
    .map((x) => `${KINDS[x].short} ${fmtNum(k[x])}`)
    .join(" · ");
}

/** Überschneidet sich eine Abwesenheit mit einem Zeitraum? */
export const overlaps = (a: { start_date: string; end_date: string }, from: string, to: string) => a.start_date <= to && a.end_date >= from;

export const EMPTY_LEAVE = (userId: number, tenantId: number): Leave => ({ user_id: userId, tenant_id: tenantId, vacation_days: null, work_weekdays: DEFAULT_WEEKDAYS, entry_date: null, years: {} });

/** Gesetzlicher Mindesturlaub bei x Arbeitstagen pro Woche */
export const legalMinimum = (land: Land, workdaysPerWeek: number) => (land === "at" ? (25 * workdaysPerWeek) / 5 : land === "ch" ? (20 * workdaysPerWeek) / 5 : (24 * workdaysPerWeek) / 6);

export type UPerson = { id: number; first_name?: string | null; last_name?: string | null; employment_type?: string | null; is_active?: boolean | null; role_id?: number; exit_date?: string | null; app_access?: boolean | null };
export const personName = (p?: UPerson) => `${p?.first_name ?? ""} ${p?.last_name ?? ""}`.trim() || (p ? `Person ${p.id}` : "–");
/** Personen mit Urlaubsanspruch: eigenes Personal (Projektleiter, Mitarbeiter) */
export const hasLeave = (p: UPerson) => (p.role_id === 3 || p.role_id === 4) && !["leiharbeit", "sub"].includes(String(p.employment_type ?? ""));
/** Personen, für die Abwesenheiten eingetragen werden können (ohne Subunternehmer) */
export const canBeAbsent = (p: UPerson) => (p.role_id === 3 || p.role_id === 4) && p.employment_type !== "sub";
