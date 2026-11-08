// Angebots-Status: deutsche Bezeichnung, Farbe, "abgelaufen" aus dem Gültig-bis-Datum
export type QuoteStatusKey = "draft" | "sent" | "accepted" | "rejected" | "expired" | "other";

export type QuoteLike = {
  status: string | null;
  valid_until?: string | null;
};

const LABELS: Record<QuoteStatusKey, string> = {
  draft: "Entwurf",
  sent: "Gesendet",
  accepted: "Angenommen",
  rejected: "Abgelehnt",
  expired: "Abgelaufen",
  other: "Unbekannt",
};

export function todayIso(now = new Date()): string {
  const y = now.getFullYear();
  const m = String(now.getMonth() + 1).padStart(2, "0");
  const d = String(now.getDate()).padStart(2, "0");
  return `${y}-${m}-${d}`;
}

/** Offene Angebote (Entwurf/Gesendet) gelten nach dem Gültig-bis-Datum als abgelaufen. */
export function quoteStatusKey(q: QuoteLike, today = todayIso()): QuoteStatusKey {
  const s = (q.status || "draft").toLowerCase();
  if (s === "accepted") return "accepted";
  if (s === "rejected" || s === "declined") return "rejected";
  if (s === "draft" || s === "sent") {
    if (q.valid_until && q.valid_until.slice(0, 10) < today) return "expired";
    return s;
  }
  if (s === "expired") return "expired";
  return "other";
}

export function quoteStatusLabel(q: QuoteLike, today = todayIso()): string {
  const key = quoteStatusKey(q, today);
  return key === "other" ? q.status || "-" : LABELS[key];
}

export const STATUS_FILTERS: { key: "all" | "open" | QuoteStatusKey; label: string }[] = [
  { key: "all", label: "Alle" },
  { key: "open", label: "Offen" },
  { key: "draft", label: "Entwurf" },
  { key: "sent", label: "Gesendet" },
  { key: "accepted", label: "Angenommen" },
  { key: "rejected", label: "Abgelehnt" },
  { key: "expired", label: "Abgelaufen" },
];

export function isOpen(key: QuoteStatusKey): boolean {
  return key === "draft" || key === "sent";
}

export function formatMoney(value: number | null | undefined, symbol = "€"): string {
  const n = Number(value || 0);
  return `${n.toLocaleString("de-DE", { minimumFractionDigits: 2, maximumFractionDigits: 2 })} ${symbol}`;
}

export function formatDate(value: string | null | undefined): string {
  if (!value) return "-";
  const d = new Date(value);
  return Number.isNaN(d.getTime()) ? "-" : d.toLocaleDateString("de-DE");
}

/** Abschlagszahlungen: wie bei den Rechnungen ab Business, Enterprise und in der Testphase. */
export function depositAllowed(sub: { plan?: string | null; status?: string | null } | null | undefined): boolean {
  if (!sub) return false;
  return sub.status === "trialing" || sub.plan === "business" || sub.plan === "enterprise";
}
