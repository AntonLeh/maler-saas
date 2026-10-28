// Reine Terminlogik ohne Datenbank – damit sie sich einfach testen lässt.

export type Availability = Record<string, [string, string][]>;

export type SlotSettings = {
  timezone: string;
  visit_duration_minutes: number;
  buffer_minutes: number;
  min_notice_hours: number;
  booking_horizon_days: number;
  slot_step_minutes: number;
  availability: Availability;
};

export type Busy = { start: Date; end: Date };

export type Slot = { start: string; end: string; label: string };

const WEEKDAY_NAMES = ["", "Montag", "Dienstag", "Mittwoch", "Donnerstag", "Freitag", "Samstag", "Sonntag"];

/** Bestandteile eines Zeitpunkts in einer Zeitzone */
export function zonedParts(date: Date, tz: string) {
  const dtf = new Intl.DateTimeFormat("en-US", {
    timeZone: tz,
    hourCycle: "h23",
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
    second: "2-digit",
    weekday: "short",
  });
  const p: Record<string, string> = {};
  for (const part of dtf.formatToParts(date)) p[part.type] = part.value;
  const wd = ["Mon", "Tue", "Wed", "Thu", "Fri", "Sat", "Sun"].indexOf(p.weekday) + 1;
  return {
    year: Number(p.year),
    month: Number(p.month),
    day: Number(p.day),
    hour: Number(p.hour),
    minute: Number(p.minute),
    second: Number(p.second),
    weekday: wd, // 1 = Montag
  };
}

function offsetMs(date: Date, tz: string): number {
  const p = zonedParts(date, tz);
  const asUtc = Date.UTC(p.year, p.month - 1, p.day, p.hour, p.minute, p.second);
  return asUtc - Math.floor(date.getTime() / 1000) * 1000;
}

/** Lokale Uhrzeit in einer Zeitzone -> echter Zeitpunkt (UTC) */
export function zonedToUtc(year: number, month: number, day: number, hour: number, minute: number, tz: string): Date {
  const guess = Date.UTC(year, month - 1, day, hour, minute);
  const off1 = offsetMs(new Date(guess), tz);
  let result = guess - off1;
  const off2 = offsetMs(new Date(result), tz);
  if (off2 !== off1) result = guess - off2;
  return new Date(result);
}

function parseHm(hm: string): [number, number] | null {
  const m = /^(\d{1,2}):(\d{2})$/.exec(hm.trim());
  if (!m) return null;
  const h = Number(m[1]);
  const min = Number(m[2]);
  if (h > 24 || min > 59) return null;
  return [h, min];
}

export function slotLabel(date: Date, tz: string): string {
  const p = zonedParts(date, tz);
  const monthName = new Intl.DateTimeFormat("de-DE", { timeZone: tz, month: "long" }).format(date);
  return `${WEEKDAY_NAMES[p.weekday]}, ${p.day}. ${monthName} um ${String(p.hour).padStart(2, "0")}:${String(
    p.minute
  ).padStart(2, "0")} Uhr`;
}

function overlaps(aStart: number, aEnd: number, bStart: number, bEnd: number) {
  return aStart < bEnd && bStart < aEnd;
}

function isFree(start: number, end: number, busy: Busy[], bufferMs: number) {
  return !busy.some((b) => overlaps(start, end, b.start.getTime() - bufferMs, b.end.getTime() + bufferMs));
}

/** Alle buchbaren Startzeiten eines lokalen Kalendertags */
function slotsForDay(
  year: number,
  month: number,
  day: number,
  weekday: number,
  s: SlotSettings,
  busy: Busy[],
  earliest: number,
  latest: number
): Date[] {
  const windows = s.availability[String(weekday)] ?? [];
  const durMs = s.visit_duration_minutes * 60_000;
  const stepMs = s.slot_step_minutes * 60_000;
  const bufferMs = s.buffer_minutes * 60_000;
  const out: Date[] = [];

  for (const w of windows) {
    const from = parseHm(w[0]);
    const to = parseHm(w[1]);
    if (!from || !to) continue;
    const winStart = zonedToUtc(year, month, day, from[0], from[1], s.timezone).getTime();
    const winEnd = zonedToUtc(year, month, day, to[0], to[1], s.timezone).getTime();
    for (let t = winStart; t + durMs <= winEnd; t += stepMs) {
      if (t < earliest || t > latest) continue;
      if (isFree(t, t + durMs, busy, bufferMs)) out.push(new Date(t));
    }
  }
  return out;
}

/**
 * Freie Besichtigungstermine.
 * Liefert bewusst nur wenige Vorschläge, verteilt auf verschiedene Tage,
 * damit die KI am Telefon nicht 30 Uhrzeiten vorliest.
 */
export function computeFreeSlots(opts: {
  settings: SlotSettings;
  busy: Busy[];
  now: Date;
  fromDate?: string; // "YYYY-MM-DD" (lokal) – ab diesem Tag suchen
  daypart?: "vormittag" | "nachmittag" | null;
  maxSlots?: number;
  perDay?: number;
}): Slot[] {
  const s = opts.settings;
  const maxSlots = opts.maxSlots ?? 6;
  const perDay = opts.perDay ?? 2;
  const earliest = opts.now.getTime() + s.min_notice_hours * 3_600_000;
  const latest = opts.now.getTime() + s.booking_horizon_days * 86_400_000;
  const durMs = s.visit_duration_minutes * 60_000;

  const today = zonedParts(opts.now, s.timezone);
  let cursor = Date.UTC(today.year, today.month - 1, today.day);
  if (opts.fromDate && /^\d{4}-\d{2}-\d{2}$/.test(opts.fromDate)) {
    const [y, m, d] = opts.fromDate.split("-").map(Number);
    cursor = Math.max(cursor, Date.UTC(y, m - 1, d));
  }

  const result: Slot[] = [];
  for (let i = 0; i <= s.booking_horizon_days + 1 && result.length < maxSlots; i++) {
    const d = new Date(cursor + i * 86_400_000);
    const y = d.getUTCFullYear();
    const m = d.getUTCMonth() + 1;
    const day = d.getUTCDate();
    const weekday = ((d.getUTCDay() + 6) % 7) + 1;

    let daySlots = slotsForDay(y, m, day, weekday, s, opts.busy, earliest, latest);
    if (opts.daypart) {
      daySlots = daySlots.filter((t) => {
        const h = zonedParts(t, s.timezone).hour;
        return opts.daypart === "vormittag" ? h < 12 : h >= 12;
      });
    }
    if (daySlots.length === 0) continue;

    // gleichmäßig über den Tag verteilt auswählen (z. B. ein Vormittag + ein Nachmittag)
    const picks: Date[] = [];
    if (daySlots.length <= perDay) picks.push(...daySlots);
    else {
      for (let k = 0; k < perDay; k++) {
        picks.push(daySlots[Math.round((k * (daySlots.length - 1)) / Math.max(perDay - 1, 1))]);
      }
    }
    for (const t of picks) {
      if (result.length >= maxSlots) break;
      result.push({
        start: t.toISOString(),
        end: new Date(t.getTime() + durMs).toISOString(),
        label: slotLabel(t, s.timezone),
      });
    }
  }
  return result;
}

/** Prüft, ob ein gewünschter Starttermin buchbar ist */
export function isBookable(start: Date, opts: { settings: SlotSettings; busy: Busy[]; now: Date }): boolean {
  const s = opts.settings;
  const p = zonedParts(start, s.timezone);
  const earliest = opts.now.getTime() + s.min_notice_hours * 3_600_000;
  const latest = opts.now.getTime() + s.booking_horizon_days * 86_400_000;
  if (start.getTime() < earliest || start.getTime() > latest) return false;

  const durMs = s.visit_duration_minutes * 60_000;
  const windows = s.availability[String(p.weekday)] ?? [];
  const t = start.getTime();
  const insideWindow = windows.some((w) => {
    const from = parseHm(w[0]);
    const to = parseHm(w[1]);
    if (!from || !to) return false;
    const ws = zonedToUtc(p.year, p.month, p.day, from[0], from[1], s.timezone).getTime();
    const we = zonedToUtc(p.year, p.month, p.day, to[0], to[1], s.timezone).getTime();
    return t >= ws && t + durMs <= we;
  });
  return insideWindow && isFree(t, t + durMs, opts.busy, s.buffer_minutes * 60_000);
}

/**
 * Startzeit aus dem, was die KI schickt: ISO mit Zeitzone ("2026-11-03T10:00:00Z")
 * oder lokale Angabe ohne Zeitzone ("2026-11-03T10:00" / "2026-11-03 10:00").
 */
export function parseStart(value: string, tz: string): Date | null {
  const v = String(value ?? "").trim();
  if (!v) return null;
  if (/[zZ]|[+-]\d{2}:?\d{2}$/.test(v)) {
    const d = new Date(v);
    return Number.isNaN(d.getTime()) ? null : d;
  }
  const m = /^(\d{4})-(\d{2})-(\d{2})[T ](\d{1,2}):(\d{2})/.exec(v);
  if (!m) return null;
  return zonedToUtc(Number(m[1]), Number(m[2]), Number(m[3]), Number(m[4]), Number(m[5]), tz);
}

/** Ländervorwahl passend zur Zeitzone des Betriebs (für Nummern ohne +) */
export function countryCodeForTimezone(tz: string | null | undefined): string {
  switch (tz) {
    case "Europe/Vienna":
      return "43";
    case "Europe/Zurich":
      return "41";
    case "Europe/Madrid":
      return "34";
    default:
      return "49";
  }
}

/** Telefonnummern vergleichbar machen (Standard: Deutschland) */
export function normalizePhone(raw: string | null | undefined, defaultCountry = "49"): string {
  if (!raw) return "";
  let v = String(raw).replace(/[^\d+]/g, "");
  if (v.startsWith("+")) v = v.slice(1);
  else if (v.startsWith("00")) v = v.slice(2);
  else if (v.startsWith("0")) v = defaultCountry + v.slice(1);
  return v;
}
