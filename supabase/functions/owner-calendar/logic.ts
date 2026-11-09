// iCal-Feed (RFC 5545) für die Owner-Termine
export type Appt = {
  id: number;
  title: string;
  kind: string;
  starts_at: string;
  ends_at: string;
  all_day: boolean;
  location: string | null;
  url: string | null;
  notes: string | null;
  recur: string;
  recur_until: string | null;
  updated_at: string;
};

export const KIND_NAMES: Record<string, string> = {
  innung: "Innung / Kammer",
  vorfuehrung: "Vorführung",
  gestoria: "Gestoría",
  steuer: "Steuer",
  privat: "Privat",
  sonstiges: "Sonstiges",
};

const TZ = "Europe/Madrid";

export const esc = (s: string) => s.replace(/\\/g, "\\\\").replace(/\r?\n/g, "\\n").replace(/([,;])/g, "\\$1");

// Zeilen > 75 Byte falten (UTF-8-sicher)
export function fold(line: string): string {
  const enc = new TextEncoder();
  if (enc.encode(line).length <= 75) return line;
  const out: string[] = [];
  let cur = "";
  let len = 0;
  for (const ch of line) {
    const n = enc.encode(ch).length;
    if (len + n > (out.length ? 74 : 75)) {
      out.push(cur);
      cur = "";
      len = 0;
    }
    cur += ch;
    len += n;
  }
  out.push(cur);
  return out.join("\r\n ");
}

const utc = (iso: string) => new Date(iso).toISOString().replace(/[-:]/g, "").replace(/\.\d{3}/, "");

// Kalenderdatum in Madrid-Zeit als YYYYMMDD
export function localDate(iso: string): string {
  const p = new Intl.DateTimeFormat("en-CA", { timeZone: TZ, year: "numeric", month: "2-digit", day: "2-digit" }).format(new Date(iso));
  return p.replace(/-/g, "");
}

function nextDay(yyyymmdd: string): string {
  const d = new Date(Date.UTC(+yyyymmdd.slice(0, 4), +yyyymmdd.slice(4, 6) - 1, +yyyymmdd.slice(6, 8) + 1));
  return d.toISOString().slice(0, 10).replace(/-/g, "");
}

export function rrule(a: Pick<Appt, "recur" | "recur_until"> & { all_day?: boolean }): string | null {
  const base = { weekly: "FREQ=WEEKLY", monthly: "FREQ=MONTHLY", quarterly: "FREQ=MONTHLY;INTERVAL=3", yearly: "FREQ=YEARLY" }[a.recur];
  if (!base) return null;
  if (!a.recur_until) return base;
  const d = a.recur_until.replace(/-/g, "");
  return `${base};UNTIL=${a.all_day ? d : `${d}T235959Z`}`;
}

export function buildIcs(list: Appt[], now = new Date()): string {
  const stamp = utc(now.toISOString());
  const lines = ["BEGIN:VCALENDAR", "VERSION:2.0", "PRODID:-//MalerSaaS//Owner-Termine//DE", "CALSCALE:GREGORIAN", "METHOD:PUBLISH", "X-WR-CALNAME:MalerSaaS – Meine Termine", `X-WR-TIMEZONE:${TZ}`, "REFRESH-INTERVAL;VALUE=DURATION:PT1H", "X-PUBLISHED-TTL:PT1H"];
  for (const a of list) {
    lines.push("BEGIN:VEVENT", `UID:owner-appt-${a.id}@maler-saas.com`, `DTSTAMP:${stamp}`, `LAST-MODIFIED:${utc(a.updated_at)}`);
    if (a.all_day) {
      const s = localDate(a.starts_at);
      const e = localDate(a.ends_at);
      lines.push(`DTSTART;VALUE=DATE:${s}`, `DTEND;VALUE=DATE:${nextDay(e < s ? s : e)}`);
    } else {
      lines.push(`DTSTART:${utc(a.starts_at)}`, `DTEND:${utc(a.ends_at)}`);
    }
    const r = rrule(a);
    if (r) lines.push(`RRULE:${r}`);
    lines.push(`SUMMARY:${esc(a.title)}`, `CATEGORIES:${esc(KIND_NAMES[a.kind] ?? a.kind)}`);
    if (a.location) lines.push(`LOCATION:${esc(a.location)}`);
    const desc = [a.notes, a.url].filter(Boolean).join("\n\n");
    if (desc) lines.push(`DESCRIPTION:${esc(desc)}`);
    if (a.url && /^https?:\/\//.test(a.url)) lines.push(`URL:${a.url}`);
    // Erinnerung (iPhone/Outlook übernehmen sie; Google nutzt eigene Standard-Erinnerungen)
    lines.push("BEGIN:VALARM", "ACTION:DISPLAY", `DESCRIPTION:${esc(a.title)}`, `TRIGGER:${a.all_day ? "-PT15H" : "-PT30M"}`, "END:VALARM");
    lines.push("END:VEVENT");
  }
  lines.push("END:VCALENDAR");
  return lines.map(fold).join("\r\n") + "\r\n";
}

// Vergleich ohne Zeit-Leck
export function sameToken(a: string, b: string): boolean {
  if (!a || !b || a.length !== b.length) return false;
  let d = 0;
  for (let i = 0; i < a.length; i++) d |= a.charCodeAt(i) ^ b.charCodeAt(i);
  return d === 0;
}
