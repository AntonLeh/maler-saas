// Stunden: Nettozeiten, Kosten nach Beschäftigungsart, Monatslisten, Nachweise
import { EMPLOYMENT, minijobLimit, monthlyHours } from "../mitarbeiter-arten/logic";
import type { EmploymentType, Pay } from "../mitarbeiter-arten/logic";

export type Entry = {
  id: number;
  user_id: number;
  order_id: number | string | null;
  work_date?: string | null;
  started_at: string | null;
  ended_at: string | null;
  total_break_minutes: number | null;
  entered_by?: number | null;
  entry_note?: string | null;
  created_at?: string | null;
};

/** Herkunft: selbst gestempelt, vom Projektleiter gestempelt (Stechuhr) oder nachgetragen */
export function sourceOf(e: Entry): "self" | "pl" | "manual" {
  if (!e.entered_by) return "self";
  if (e.created_at && e.started_at && new Date(e.created_at).getTime() - new Date(e.started_at).getTime() < 3 * 60000) return "pl";
  return "manual";
}
export const SOURCE_LABELS = { self: "", pl: "vom Projektleiter gestempelt", manual: "nachgetragen" } as const;

export type Person = {
  id: number;
  role_id: number;
  first_name: string | null;
  last_name: string | null;
  hourly_rate: number | null;
  employment_type?: string | null;
  app_access?: boolean | null;
  is_active?: boolean | null;
  exit_date?: string | null;
};

export type ExternalCost = {
  id: number;
  order_id: number;
  sub_user_id: number | null;
  description: string | null;
  amount_net: number;
  invoice_no: string | null;
  invoice_date: string | null;
  reverse_charge: boolean;
  created_by: number | null;
  created_at: string;
};

export type Group = "own" | "leih" | "sub";
export const GROUP_LABELS: Record<Group, string> = { own: "Eigenes Personal", leih: "Leiharbeit", sub: "Subunternehmer" };

export const typeOf = (p: { employment_type?: string | null } | undefined): EmploymentType =>
  p?.employment_type && p.employment_type in EMPLOYMENT ? (p.employment_type as EmploymentType) : "gewerblich";
export const groupOf = (p: Person | undefined): Group => (typeOf(p) === "leiharbeit" ? "leih" : typeOf(p) === "sub" ? "sub" : "own");
export const nameOf = (p: Person | undefined, fallbackId?: number) => `${p?.first_name ?? ""} ${p?.last_name ?? ""}`.trim() || (fallbackId ? `Person #${fallbackId}` : "–");

/** Netto-Minuten eines abgeschlossenen Eintrags (laufende zählen nicht) */
export function netMinutes(e: Entry): number {
  if (!e.started_at || !e.ended_at) return 0;
  const g = (new Date(e.ended_at).getTime() - new Date(e.started_at).getTime()) / 60000;
  if (!Number.isFinite(g)) return 0;
  return Math.max(0, g - Number(e.total_break_minutes || 0));
}

const pad = (n: number) => String(n).padStart(2, "0");
export const ymd = (d: Date) => `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`;
export const localDay = (iso: string) => ymd(new Date(iso));
export const hm = (iso: string) => {
  const d = new Date(iso);
  return `${pad(d.getHours())}:${pad(d.getMinutes())}`;
};
export const deDate = (day: string) => new Date(`${day}T12:00:00`).toLocaleDateString("de-DE", { weekday: "short", day: "2-digit", month: "2-digit", year: "numeric" });
export const hours = (min: number) => Math.round((min / 60) * 100) / 100;
export const fmtH = (min: number) => hours(min).toLocaleString("de-DE", { minimumFractionDigits: 2, maximumFractionDigits: 2 });
export const fmtMoney = (n: number, cur = "€") => `${n.toLocaleString("de-DE", { minimumFractionDigits: 2, maximumFractionDigits: 2 })} ${cur}`;

/** Tag des Eintrags (Arbeitstag) */
export const dayOf = (e: Entry) => e.work_date || (e.started_at ? localDay(e.started_at) : "");

/** Einträge im Zeitraum [from, to] (Tage als YYYY-MM-DD) */
export const inRange = (list: Entry[], from: string, to: string) => list.filter((e) => e.ended_at && dayOf(e) >= from && dayOf(e) <= to);

// ---------- Kosten nach Art ----------
export type CostSplit = Record<Group, { minutes: number; cost: number }> & { external: number; total: number };

export function costSplit(entries: Entry[], people: Person[], external: ExternalCost[] = []): CostSplit {
  const s: CostSplit = { own: { minutes: 0, cost: 0 }, leih: { minutes: 0, cost: 0 }, sub: { minutes: 0, cost: 0 }, external: 0, total: 0 };
  const byId = new Map(people.map((p) => [Number(p.id), p]));
  for (const e of entries) {
    const m = netMinutes(e);
    if (!m) continue;
    const p = byId.get(Number(e.user_id));
    const g = groupOf(p);
    s[g].minutes += m;
    s[g].cost += (m / 60) * Number(p?.hourly_rate || 0);
  }
  s.external = external.reduce((sum, x) => sum + Number(x.amount_net || 0), 0);
  s.total = s.own.cost + s.leih.cost + s.sub.cost + s.external;
  return s;
}

// ---------- Monat / Soll-Stunden ----------
export function monthRange(month: string): { from: string; to: string } {
  const [y, m] = month.split("-").map(Number);
  return { from: `${y}-${pad(m)}-01`, to: ymd(new Date(y, m, 0)) };
}

export function monthLabel(month: string) {
  const [y, m] = month.split("-").map(Number);
  return new Date(y, m - 1, 1).toLocaleDateString("de-DE", { month: "long", year: "numeric" });
}

/** Werktage Mo–Fr im Zeitraum (ohne Feiertage) */
export function workdays(from: string, to: string): number {
  let n = 0;
  for (let d = new Date(`${from}T12:00:00`); ymd(d) <= to; d.setDate(d.getDate() + 1)) if (d.getDay() !== 0 && d.getDay() !== 6) n++;
  return n;
}

/** Soll-Minuten im Zeitraum bei x Wochenstunden (5-Tage-Woche), begrenzt auf Ein-/Austritt */
export function sollMinutes(weekly: number | null, from: string, to: string, exitDate?: string | null): number {
  if (!weekly) return 0;
  const end = exitDate && exitDate < to ? exitDate : to;
  if (end < from) return 0;
  return (weekly / 5) * workdays(from, end) * 60;
}

// ---------- Monatsliste Steuerberater ----------
export type StbRow = {
  person: Person;
  type: EmploymentType;
  pay: Pay | null;
  days: { day: string; minutes: number; orders: string[] }[];
  minutes: number;
  soll: number;
  note: string;
};

export function stbList(month: string, people: Person[], entries: Entry[], pays: Map<number, Pay>, orderTitle: (id: Entry["order_id"]) => string): StbRow[] {
  const { from, to } = monthRange(month);
  const list = inRange(entries, from, to);
  return people
    .filter((p) => (p.role_id === 3 || p.role_id === 4) && EMPLOYMENT[typeOf(p)].own)
    .filter((p) => p.is_active !== false || (p.exit_date && p.exit_date >= from) || list.some((e) => Number(e.user_id) === Number(p.id)))
    .map((p) => {
      const mine = list.filter((e) => Number(e.user_id) === Number(p.id));
      const byDay = new Map<string, { minutes: number; orders: Set<string> }>();
      for (const e of mine) {
        const k = dayOf(e);
        const cur = byDay.get(k) ?? { minutes: 0, orders: new Set<string>() };
        cur.minutes += netMinutes(e);
        cur.orders.add(orderTitle(e.order_id));
        byDay.set(k, cur);
      }
      const days = [...byDay.entries()].sort(([a], [b]) => a.localeCompare(b)).map(([day, v]) => ({ day, minutes: v.minutes, orders: [...v.orders] }));
      const minutes = days.reduce((s, d) => s + d.minutes, 0);
      const pay = pays.get(Number(p.id)) ?? null;
      const type = typeOf(p);
      const soll = sollMinutes(pay?.weekly_hours ?? null, from, to, p.exit_date);
      let note = "";
      if (pay?.pay_type === "monat") {
        note = `Monatsgehalt ${pay.monthly_salary != null ? fmtMoney(pay.monthly_salary) : "–"}`;
        if (soll) note += ` · Soll ${fmtH(soll)} Std. · ${minutes - soll >= 0 ? "Mehrstunden" : "Minusstunden"} ${fmtH(Math.abs(minutes - soll))}`;
      } else if (pay?.hourly_wage != null) {
        note = `Stundenlohn ${fmtMoney(pay.hourly_wage)} · Brutto ca. ${fmtMoney(hours(minutes) * pay.hourly_wage)}`;
        if (type === "minijob") {
          const limit = minijobLimit(Number(month.slice(0, 4)));
          const brutto = hours(minutes) * pay.hourly_wage;
          if (brutto > limit) note += ` · ACHTUNG: über Minijob-Grenze ${limit} €`;
        }
      }
      if (type === "azubi" && pay?.training_year) note = `${pay.training_year}. Lehrjahr${note ? ` · ${note}` : ""}`;
      if (p.exit_date && p.exit_date >= from && p.exit_date <= to) note += `${note ? " · " : ""}Austritt ${new Date(`${p.exit_date}T12:00:00`).toLocaleDateString("de-DE")}`;
      return { person: p, type, pay, days, minutes, soll, note };
    })
    .sort((a, b) => nameOf(a.person).localeCompare(nameOf(b.person), "de"));
}

// ---------- Nachweis (Leiharbeit / Subunternehmer) ----------
export type ProofRow = { day: string; order: string; from: string; to: string; breakMin: number; minutes: number; manual: boolean; source: "self" | "pl" | "manual" };

export function proofRows(personId: number, entries: Entry[], from: string, to: string, orderTitle: (id: Entry["order_id"]) => string): ProofRow[] {
  return inRange(entries, from, to)
    .filter((e) => Number(e.user_id) === Number(personId))
    .sort((a, b) => String(a.started_at).localeCompare(String(b.started_at)))
    .map((e) => ({
      day: dayOf(e),
      order: orderTitle(e.order_id),
      from: hm(e.started_at!),
      to: hm(e.ended_at!),
      breakMin: Number(e.total_break_minutes || 0),
      minutes: netMinutes(e),
      manual: sourceOf(e) === "manual",
      source: sourceOf(e),
    }));
}

/** Monatsstunden-Hinweis für Gehalt (für Anzeige im Formular) */
export const monthlyHoursLabel = (weekly: number) => monthlyHours(weekly).toLocaleString("de-DE", { maximumFractionDigits: 1 });

// ---------- CSV ----------
export function csv(rows: (string | number)[][]): string {
  const esc = (v: string | number) => {
    const s = typeof v === "number" ? v.toLocaleString("de-DE", { maximumFractionDigits: 2, useGrouping: false }) : String(v ?? "");
    return /[;"\n]/.test(s) ? `"${s.replace(/"/g, '""')}"` : s;
  };
  return "﻿" + rows.map((r) => r.map(esc).join(";")).join("\r\n");
}

export function download(blob: Blob, name: string) {
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = name;
  a.click();
  setTimeout(() => URL.revokeObjectURL(url), 3000);
}

/** Pausen-Vorschlag nach Arbeitszeitgesetz: über 6 Std. 30 min, über 9 Std. 45 min */
export const suggestedBreak = (grossMinutes: number) => (grossMinutes > 9 * 60 + 45 ? 45 : grossMinutes > 6 * 60 + 30 ? 30 : 0);

/** ISO-Kalenderwoche eines Tages (YYYY-MM-DD) */
export function isoWeek(day: string): { year: number; week: number; key: string } {
  const d = new Date(`${day}T12:00:00`);
  const t = new Date(Date.UTC(d.getFullYear(), d.getMonth(), d.getDate()));
  const dow = t.getUTCDay() || 7;
  t.setUTCDate(t.getUTCDate() + 4 - dow);
  const y = t.getUTCFullYear();
  const week = Math.ceil(((t.getTime() - Date.UTC(y, 0, 1)) / 86400000 + 1) / 7);
  return { year: y, week, key: `${y}-${String(week).padStart(2, "0")}` };
}

/** Zeilen nach Kalenderwoche gruppieren (Reihenfolge bleibt) */
export function byWeek<T extends { day: string; minutes: number }>(rows: T[]): { key: string; label: string; minutes: number; rows: T[] }[] {
  const out: { key: string; label: string; minutes: number; rows: T[] }[] = [];
  for (const r of rows) {
    const w = isoWeek(r.day);
    let g = out.find((x) => x.key === w.key);
    if (!g) {
      g = { key: w.key, label: `KW ${w.week}/${w.year}`, minutes: 0, rows: [] };
      out.push(g);
    }
    g.rows.push(r);
    g.minutes += r.minutes;
  }
  return out;
}

/** Schnellauswahl Zeitraum */
export function presetRange(kind: "week" | "lastweek" | "month" | "lastmonth", now = new Date()): { from: string; to: string } {
  const d = new Date(now.getFullYear(), now.getMonth(), now.getDate());
  if (kind === "week" || kind === "lastweek") {
    const mon = new Date(d);
    mon.setDate(d.getDate() - ((d.getDay() + 6) % 7) - (kind === "lastweek" ? 7 : 0));
    const sun = new Date(mon);
    sun.setDate(mon.getDate() + 6);
    return { from: ymd(mon), to: ymd(kind === "week" ? d : sun) };
  }
  const m = kind === "month" ? d.getMonth() : d.getMonth() - 1;
  const first = new Date(d.getFullYear(), m, 1);
  const last = kind === "month" ? d : new Date(d.getFullYear(), m + 1, 0);
  return { from: ymd(first), to: ymd(last) };
}
