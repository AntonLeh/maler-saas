// Owner-Termine: Typen, Arten, Wiederholungen, Kalender-Raster, Steuerfristen (Spanien)
export type Kind = "innung" | "vorfuehrung" | "gestoria" | "steuer" | "privat" | "sonstiges";
export type Recur = "none" | "weekly" | "monthly" | "quarterly" | "yearly";

export type Appointment = {
  id: number;
  title: string;
  kind: Kind;
  starts_at: string;
  ends_at: string;
  all_day: boolean;
  location: string | null;
  url: string | null;
  notes: string | null;
  contact_id: number | null;
  recur: Recur;
  recur_until: string | null;
  created_at?: string;
  updated_at?: string;
};

/** Ein einzelnes Vorkommen (bei Serien mehrere je Termin) */
export type Occurrence = { appt: Appointment; start: Date; end: Date; key: string };

export const KINDS: Record<Kind, { label: string; color: string; bg: string }> = {
  innung: { label: "Innung / Kammer", color: "#1d4ed8", bg: "#dbeafe" },
  vorfuehrung: { label: "Vorführung", color: "#7c3aed", bg: "#ede9fe" },
  gestoria: { label: "Gestoría", color: "#0f766e", bg: "#ccfbf1" },
  steuer: { label: "Steuer-Frist", color: "#b91c1c", bg: "#fee2e2" },
  privat: { label: "Privat", color: "#c2410c", bg: "#ffedd5" },
  sonstiges: { label: "Sonstiges", color: "#475569", bg: "#e2e8f0" },
};

export const RECUR_LABELS: Record<Recur, string> = {
  none: "Einmalig",
  weekly: "Jede Woche",
  monthly: "Jeden Monat",
  quarterly: "Alle 3 Monate",
  yearly: "Jedes Jahr",
};

export const WEEKDAYS = ["Mo", "Di", "Mi", "Do", "Fr", "Sa", "So"];

// ---------- Datum ----------
export const pad = (n: number) => String(n).padStart(2, "0");
export const ymd = (d: Date) => `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`;
export const hm = (d: Date) => `${pad(d.getHours())}:${pad(d.getMinutes())}`;
export const startOfDay = (d: Date) => new Date(d.getFullYear(), d.getMonth(), d.getDate());
export const addDays = (d: Date, n: number) => new Date(d.getFullYear(), d.getMonth(), d.getDate() + n, d.getHours(), d.getMinutes());
export const sameDay = (a: Date, b: Date) => ymd(a) === ymd(b);

/** Monat addieren, Tag am Monatsende kappen (31.01. + 1 → 28./29.02.) */
export function addMonths(d: Date, n: number): Date {
  const y = d.getFullYear();
  const m = d.getMonth() + n;
  const last = new Date(y, m + 1, 0).getDate();
  return new Date(y, m, Math.min(d.getDate(), last), d.getHours(), d.getMinutes());
}

/** Montag der Woche */
export function weekStart(d: Date): Date {
  const s = startOfDay(d);
  return addDays(s, -((s.getDay() + 6) % 7));
}

/** 6×7-Raster für die Monatsansicht */
export function monthGrid(month: Date): Date[] {
  const first = new Date(month.getFullYear(), month.getMonth(), 1);
  const start = weekStart(first);
  return Array.from({ length: 42 }, (_, i) => addDays(start, i));
}

export function parseLocal(date: string, time: string): Date {
  const [y, m, d] = date.split("-").map(Number);
  const [h, mi] = (time || "00:00").split(":").map(Number);
  return new Date(y, m - 1, d, h || 0, mi || 0);
}

// ---------- Wiederholungen ----------
function step(d: Date, recur: Recur, i: number): Date {
  if (recur === "weekly") return addDays(d, 7 * i);
  if (recur === "monthly") return addMonths(d, i);
  if (recur === "quarterly") return addMonths(d, 3 * i);
  if (recur === "yearly") return addMonths(d, 12 * i);
  return d;
}

/** Alle Vorkommen im Zeitraum [from, to) */
export function expand(list: Appointment[], from: Date, to: Date): Occurrence[] {
  const out: Occurrence[] = [];
  for (const a of list) {
    const s0 = new Date(a.starts_at);
    const e0 = new Date(a.ends_at);
    const dur = Math.max(0, e0.getTime() - s0.getTime());
    const until = a.recur_until ? parseLocal(a.recur_until, "23:59") : null;
    const single = !(a.recur in RECUR_LABELS) || a.recur === "none";
    for (let i = 0; i < 1000; i++) {
      const s = single ? s0 : step(s0, a.recur, i);
      if (s >= to || (until && s > until)) break;
      const e = new Date(s.getTime() + dur);
      const endCmp = a.all_day ? addDays(startOfDay(e), 1) : e;
      if (endCmp > from) out.push({ appt: a, start: s, end: e, key: `${a.id}-${i}` });
      if (single) break;
    }
  }
  return out.sort((x, y) => x.start.getTime() - y.start.getTime() || Number(y.appt.all_day) - Number(x.appt.all_day));
}

/** Vorkommen an einem Tag (mehrtägige Termine an jedem Tag) */
export function onDay(occ: Occurrence[], day: Date): Occurrence[] {
  const s = startOfDay(day);
  const e = addDays(s, 1);
  return occ.filter((o) => {
    if (o.start >= e) return false;
    if (o.appt.all_day) return addDays(startOfDay(o.end), 1) > s;
    return o.end > s || o.start >= s;
  });
}

export function timeLabel(o: Occurrence): string {
  const multi = !sameDay(o.start, o.end);
  const until = `bis ${o.end.toLocaleDateString("de-DE", { day: "2-digit", month: "2-digit" })}`;
  if (o.appt.all_day) return multi ? `ganztägig ${until}` : "ganztägig";
  if (multi) return `${hm(o.start)} ${until}`;
  return `${hm(o.start)}–${hm(o.end)}`;
}

// ---------- Steuerfristen Spanien (Autónomo, vierteljährlich) ----------
/** Fällt die Frist auf Sa/So, verschiebt sie sich auf den nächsten Werktag */
export function nextWorkday(d: Date): Date {
  let x = startOfDay(d);
  while (x.getDay() === 0 || x.getDay() === 6) x = addDays(x, 1);
  return x;
}

export type TaxDeadline = { date: Date; title: string; notes: string };

export function taxDeadlines(year: number): TaxDeadline[] {
  const hint =
    "Selbstveranlagung über die Gestoría. Bei Lastschrift (domiciliación) endet die Frist 5 Tage früher. Fällt die Frist auf einen Feiertag, verschiebt sie sich auf den nächsten Werktag – bitte bei der Gestoría bestätigen lassen.";
  const q = (m: number, d: number, quarter: string, extra = "") => ({
    date: nextWorkday(new Date(year, m, d)),
    title: `Steuer ${quarter}: Modelo 303, 130, 349${extra}`,
    notes: `Quartalserklärungen ${quarter}: IVA (303), Einkommensteuer-Vorauszahlung (130), EU-Umsätze (349)${extra ? ", Jahreserklärung IVA (390)" : ""}.\n\nBelege vorher an die Gestoría schicken (Owner → Buchhaltung → ZIP).\n\n${hint}`,
  });
  return [
    q(0, 30, `4. Quartal ${year - 1}`, " + 390"),
    q(3, 20, `1. Quartal ${year}`),
    q(6, 20, `2. Quartal ${year}`),
    q(9, 20, `3. Quartal ${year}`),
  ];
}

/** Belege-Erinnerung (Gestoría möchte sie monatlich) – am 5. jedes Monats */
export function receiptReminder(year: number, month: number): Pick<Appointment, "title" | "notes"> & { date: Date } {
  return {
    date: new Date(year, month, 5),
    title: "Belege des Vormonats an Gestoría",
    notes: "Owner → Buchhaltung → Monat wählen → ZIP für die Gestoría herunterladen und schicken.",
  };
}
