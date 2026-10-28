export const WEEKDAYS_SHORT = ["Mo", "Di", "Mi", "Do", "Fr", "Sa", "So"];

export function startOfDay(date: Date): Date {
  const d = new Date(date);
  d.setHours(0, 0, 0, 0);
  return d;
}

export function addDays(date: Date, days: number): Date {
  const d = new Date(date);
  d.setDate(d.getDate() + days);
  return d;
}

export function addMonths(date: Date, months: number): Date {
  const d = new Date(date);
  d.setDate(1);
  d.setMonth(d.getMonth() + months);
  return d;
}

/** Montag der Woche, in der `date` liegt */
export function startOfWeek(date: Date): Date {
  const d = startOfDay(date);
  const day = (d.getDay() + 6) % 7; // Mo = 0
  return addDays(d, -day);
}

export function startOfMonth(date: Date): Date {
  const d = startOfDay(date);
  d.setDate(1);
  return d;
}

export function isSameDay(a: Date, b: Date): boolean {
  return (
    a.getFullYear() === b.getFullYear() &&
    a.getMonth() === b.getMonth() &&
    a.getDate() === b.getDate()
  );
}

/** Wert für <input type="datetime-local"> in lokaler Zeit */
export function toLocalInputValue(date: Date): string {
  const pad = (n: number) => String(n).padStart(2, "0");
  return `${date.getFullYear()}-${pad(date.getMonth() + 1)}-${pad(date.getDate())}T${pad(
    date.getHours()
  )}:${pad(date.getMinutes())}`;
}

export function formatTime(iso: string): string {
  return new Date(iso).toLocaleTimeString("de-DE", { hour: "2-digit", minute: "2-digit" });
}

export function formatDate(iso: string | Date): string {
  return new Date(iso).toLocaleDateString("de-DE", {
    weekday: "short",
    day: "2-digit",
    month: "2-digit",
    year: "numeric",
  });
}

export function formatDateLong(date: Date): string {
  return date.toLocaleDateString("de-DE", {
    weekday: "long",
    day: "numeric",
    month: "long",
    year: "numeric",
  });
}

export function formatRange(startIso: string, endIso: string): string {
  const start = new Date(startIso);
  const end = new Date(endIso);
  if (isSameDay(start, end)) {
    return `${formatDate(startIso)}, ${formatTime(startIso)}–${formatTime(endIso)} Uhr`;
  }
  return `${formatDate(startIso)} ${formatTime(startIso)} – ${formatDate(endIso)} ${formatTime(
    endIso
  )} Uhr`;
}

export function monthTitle(date: Date): string {
  return date.toLocaleDateString("de-DE", { month: "long", year: "numeric" });
}

/** Überschneidet sich der Termin mit dem Tag? */
export function overlapsDay(startIso: string, endIso: string, day: Date): boolean {
  const dayStart = startOfDay(day).getTime();
  const dayEnd = addDays(startOfDay(day), 1).getTime();
  const s = new Date(startIso).getTime();
  const e = new Date(endIso).getTime();
  return s < dayEnd && (e > dayStart || s >= dayStart);
}
