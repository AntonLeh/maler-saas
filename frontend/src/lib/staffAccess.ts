// Gesperrtes Abo / offene Zahlung: Admins sehen sofort die Sperrseite.
// Projektleiter und Mitarbeiter dürfen noch STAFF_GRACE_DAYS Tage weiterarbeiten (mit Hinweis), danach Sperrseite.

export const STAFF_GRACE_DAYS = 3;
export const LOCKED_STATUSES = ["payment_required", "blocked"];

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

/** Seit wann ist gesperrt? Testphase: deren Ende; sonst die letzte Änderung am Abo. */
export function lockedSince(sub: SubLike): Date | null {
  if (!sub) return null;
  const raw = (sub.status === "blocked" && sub.trial_ends_at) || sub.updated_at || sub.expires_at;
  const d = raw ? new Date(raw) : null;
  return d && !Number.isNaN(d.getTime()) ? d : null;
}

export function staffAccess(sub: SubLike, now = new Date()): StaffAccess {
  if (!sub || !LOCKED_STATUSES.includes(String(sub.status))) return { state: "ok" };
  const since = lockedSince(sub);
  if (!since) return { state: "locked" };
  const until = new Date(since.getTime() + STAFF_GRACE_DAYS * DAY);
  const left = until.getTime() - now.getTime();
  if (left <= 0) return { state: "locked" };
  return { state: "grace", until, daysLeft: Math.max(1, Math.ceil(left / DAY)) };
}
