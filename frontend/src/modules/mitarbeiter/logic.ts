// Mitarbeiter-Dashboard: reine Hilfsfunktionen (ohne React/Supabase, testbar)

export type MaTimeEntry = {
  id: number;
  order_id: number | string;
  started_at: string | null;
  ended_at: string | null;
  total_break_minutes: number | null;
  status: string;
};

export type MaOrder = {
  id: string;
  status: string;
  start_date: string | null;
  end_date: string | null;
};

const STATUS_LABELS: Record<string, string> = {
  neu: "Neu",
  geplant: "Geplant",
  in_arbeit: "In Arbeit",
  pausiert: "Pausiert",
  zur_pruefung: "Fertig gemeldet",
  fertig: "Fertig",
  abgerechnet: "Abgerechnet",
};

export const statusLabel = (status: string) =>
  STATUS_LABELS[status] ?? String(status || "").replaceAll("_", " ");

/** Statuswechsel, die Mitarbeiter selbst auslösen dürfen (sonst nur über Stechuhr / „Fertig melden“) */
export const canTogglePause = (status: string) => status === "in_arbeit" || status === "pausiert";
export const canReportDone = (status: string) => ["neu", "geplant", "in_arbeit", "pausiert"].includes(status);

export const isOpenEntry = (e: MaTimeEntry) => e.ended_at === null && (e.status === "working" || e.status === "break");

const toDate = (value: string) => {
  const hasTz = /[zZ]|[+-]\d{2}:?\d{2}$/.test(value);
  return new Date(hasTz ? value : `${value}Z`);
};

const pad = (n: number) => String(n).padStart(2, "0");

export const dayKey = (d: Date) => `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`;

/** Netto-Arbeitszeit eines Eintrags in Minuten (laufende Einträge bis „jetzt“, laufende Pause abgezogen) */
export const entryNetMinutes = (e: MaTimeEntry, now: Date, openBreakStart?: Date | null) => {
  if (!e.started_at) return 0;
  const start = toDate(e.started_at).getTime();
  const end = e.ended_at ? toDate(e.ended_at).getTime() : now.getTime();
  let breaks = Number(e.total_break_minutes || 0);
  if (!e.ended_at && e.status === "break" && openBreakStart) {
    breaks += Math.max(0, Math.floor((now.getTime() - openBreakStart.getTime()) / 60000));
  }
  return Math.max(0, Math.floor((end - start) / 60000) - breaks);
};

/** Laufende Netto-Zeit in Millisekunden für die Live-Uhr (null = während einer Pause ohne bekannten Beginn) */
export const liveNetMs = (e: MaTimeEntry, now: Date, openBreakStart?: Date | null): number | null => {
  if (!e.started_at) return 0;
  const start = toDate(e.started_at).getTime();
  let breakMs = Number(e.total_break_minutes || 0) * 60000;
  if (e.status === "break") {
    if (!openBreakStart) return null;
    breakMs += Math.max(0, now.getTime() - openBreakStart.getTime());
  }
  return Math.max(0, now.getTime() - start - breakMs);
};

/** Heute erfasste Arbeits- und Pausenzeit (alle Aufträge) */
export const todayTotals = (entries: MaTimeEntry[], now: Date, openBreakStart?: Date | null) => {
  const today = dayKey(now);
  let workMinutes = 0;
  let breakMinutes = 0;
  for (const e of entries) {
    if (!e.started_at || dayKey(toDate(e.started_at)) !== today) continue;
    workMinutes += entryNetMinutes(e, now, openBreakStart);
    breakMinutes += Number(e.total_break_minutes || 0);
    if (!e.ended_at && e.status === "break" && openBreakStart) {
      breakMinutes += Math.max(0, Math.floor((now.getTime() - openBreakStart.getTime()) / 60000));
    }
  }
  return { workMinutes, breakMinutes };
};

/**
 * Pausenregel Arbeitszeitgesetz (§ 4 ArbZG): mehr als 6 Std. → 30 Min., mehr als 9 Std. → 45 Min.
 * § 3 ArbZG: höchstens 10 Std. am Tag.
 */
export const breakRule = (workMinutes: number, breakMinutes: number) => {
  const required = workMinutes > 540 ? 45 : workMinutes > 360 ? 30 : 0;
  return {
    required,
    missing: Math.max(0, required - breakMinutes),
    overMax: workMinutes > 600,
  };
};

export const fmtDuration = (minutes: number) => {
  const m = Math.max(0, Math.round(minutes));
  const h = Math.floor(m / 60);
  const rest = m % 60;
  if (h === 0) return `${rest} Min.`;
  return rest === 0 ? `${h} Std.` : `${h} Std. ${rest} Min.`;
};

export const fmtClock = (ms: number) => {
  const total = Math.floor(Math.max(0, ms) / 1000);
  return `${pad(Math.floor(total / 3600))}:${pad(Math.floor((total % 3600) / 60))}:${pad(total % 60)}`;
};

/** Datum + Uhrzeit in der Zeitzone des Geräts */
export const fmtDateTime = (value: string | null) => {
  if (!value) return "–";
  return new Intl.DateTimeFormat("de-DE", {
    day: "2-digit",
    month: "2-digit",
    year: "numeric",
    hour: "2-digit",
    minute: "2-digit",
  }).format(toDate(value));
};

export const fmtTime = (value: string | Date | null) => {
  if (!value) return "–";
  const d = typeof value === "string" ? toDate(value) : value;
  return new Intl.DateTimeFormat("de-DE", { hour: "2-digit", minute: "2-digit" }).format(d);
};

export const fmtDate = (value: string | null) => {
  if (!value) return "";
  const [y, m, d] = value.slice(0, 10).split("-");
  return y && m && d ? `${d}.${m}.${y}` : value;
};

export const fmtPeriod = (start: string | null, end: string | null) => {
  const s = fmtDate(start);
  const e = fmtDate(end);
  if (s && e) return s === e ? s : `${s} – ${e}`;
  if (s) return `ab ${s}`;
  if (e) return `bis ${e}`;
  return "";
};

const ORDER_RANK: Record<string, number> = { in_arbeit: 0, pausiert: 1, geplant: 2, neu: 3, zur_pruefung: 4 };

/** Laufender Auftrag zuerst, dann nach Status und Starttermin */
export const sortOrders = <T extends MaOrder>(orders: T[], activeOrderId: string | null) =>
  [...orders].sort((a, b) => {
    if (activeOrderId) {
      if (String(a.id) === activeOrderId) return -1;
      if (String(b.id) === activeOrderId) return 1;
    }
    const r = (ORDER_RANK[a.status] ?? 9) - (ORDER_RANK[b.status] ?? 9);
    if (r !== 0) return r;
    return String(a.start_date || "9999").localeCompare(String(b.start_date || "9999"));
  });

/** Verständliche Fehlermeldungen statt Datenbank-Text */
export const friendlyError = (err: unknown, fallback: string) => {
  const msg = String(err instanceof Error ? err.message : (err as { message?: string })?.message ?? err ?? "");
  const low = msg.toLowerCase();
  if (low.includes("bereits ein offener arbeitseintrag"))
    return "Auf einem anderen Auftrag läuft schon eine Arbeitszeit. Bitte dort zuerst „Arbeit beenden“ drücken.";
  if (low.includes("kein laufender arbeitseintrag") || low.includes("kein pausierter arbeitseintrag"))
    return "Die Stechuhr hat sich inzwischen geändert. Bitte die Seite neu laden.";
  if (low.includes("bereits eine offene pause")) return "Die Pause läuft bereits.";
  if (low.includes("keine berechtigung") || low.includes("nicht gefunden") || low.includes("row-level security"))
    return "Dieser Auftrag ist dir nicht (mehr) zugeteilt oder bereits abgeschlossen. Bitte die Seite neu laden.";
  if (low.includes("failed to fetch") || low.includes("network") || low.includes("load failed"))
    return "Keine Internetverbindung. Bitte gleich noch einmal versuchen.";
  if (low.includes("mime") || low.includes("payload too large") || low.includes("exceeded the maximum") || low.includes("bildformat"))
    return "Das Foto konnte nicht hochgeladen werden (Format oder Größe). Bitte ein JPG- oder PNG-Foto verwenden.";
  if (/^[A-ZÄÖÜ].{5,140}[.!]$/.test(msg) && !/[_{}]|sql|postgres|violates|constraint/i.test(msg)) return msg;
  return fallback;
};
