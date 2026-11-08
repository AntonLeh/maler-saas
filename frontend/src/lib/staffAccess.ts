// Gesperrtes Abo / offene Zahlung: Admins sehen sofort die Sperrseite.
// Projektleiter und Mitarbeiter dürfen noch STAFF_GRACE_DAYS Tage weiterarbeiten (mit Hinweis), danach Sperrseite.

export const STAFF_GRACE_DAYS = 3;
export const ENDED_STATUSES = ["canceled", "cancelled", "expired", "unpaid", "incomplete_expired"];
export const LOCKED_STATUSES = ["payment_required", "blocked", ...ENDED_STATUSES];

export type LockKind = "trial" | "payment" | "ended";

/** Gesperrt? Testphase abgelaufen (blocked), Zahlung offen (payment_required) oder Abo beendet (Stripe). */
export function lockKind(sub: SubLike): LockKind | null {
  const st = String(sub?.status ?? "");
  if (st === "blocked") return "trial";
  if (st === "payment_required") return "payment";
  if (ENDED_STATUSES.includes(st)) return "ended";
  return null;
}

export type SubLike = {
  status?: string | null;
  trial_ends_at?: string | null;
  updated_at?: string | null;
  expires_at?: string | null;
} | null | undefined;

export type StaffAccess =
  | { state: "ok" }
  | { state: "grace"; until: Date; daysLeft: number }
  | { state: "locked" };

const DAY = 24 * 60 * 60 * 1000;

/** Seit wann ist gesperrt? Testphase: deren Ende; Abo beendet: Enddatum; sonst die letzte Änderung am Abo. */
export function lockedSince(sub: SubLike): Date | null {
  if (!sub) return null;
  const kind = lockKind(sub);
  const raw =
    (kind === "trial" && sub.trial_ends_at) ||
    (kind === "ended" && sub.expires_at) ||
    sub.updated_at ||
    sub.expires_at;
  const d = raw ? new Date(raw) : null;
  return d && !Number.isNaN(d.getTime()) ? d : null;
}

export function staffAccess(sub: SubLike, now = new Date()): StaffAccess {
  if (!sub || !lockKind(sub)) return { state: "ok" };
  const since = lockedSince(sub);
  if (!since) return { state: "locked" };
  const until = new Date(since.getTime() + STAFF_GRACE_DAYS * DAY);
  const left = until.getTime() - now.getTime();
  if (left <= 0) return { state: "locked" };
  return { state: "grace", until, daysLeft: Math.max(1, Math.ceil(left / DAY)) };
}
