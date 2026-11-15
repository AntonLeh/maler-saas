// Rechnungsliste: Status, Fälligkeit, Kennzahlen, Filter (ohne React, testbar)

export type InvLike = {
  id: number;
  invoice_number: string;
  invoice_date: string;
  due_date: string | null;
  customer_id: number;
  order_id: number;
  subtotal: number;
  total_amount: number;
  status: string;
  paid_at: string | null;
  document_type?: string | null;
  invoice_type?: string | null;
};
export type RemLike = { id: number; invoice_id: number; reminder_level: number; status: string; new_due_date: string | null; sent_at: string | null };

export const OPEN = ["open", "reminder1", "reminder2", "final_notice"];
export type Filter = "all" | "open" | "overdue" | "paid" | "cancelled";

export const isInvoice = (i: InvLike) => (i.document_type ?? "invoice") === "invoice";
export const isOpen = (i: InvLike) => isInvoice(i) && OPEN.includes(i.status);
export const todayIso = (d = new Date()) => `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;

/** Tage überfällig (0 = nicht überfällig) – nach der neuesten Mahnfrist, sonst nach dem Fälligkeitsdatum */
export function overdueDays(i: InvLike, reminders: RemLike[], today = todayIso()) {
  if (!isOpen(i)) return 0;
  const last = latestReminder(reminders);
  const due = (last?.new_due_date || i.due_date || "").slice(0, 10);
  if (!due || due >= today) return 0;
  return Math.round((Date.parse(`${today}T12:00:00Z`) - Date.parse(`${due}T12:00:00Z`)) / 86400000);
}

export const latestReminder = (rs: RemLike[]) => (rs.length ? [...rs].sort((a, b) => a.reminder_level - b.reminder_level)[rs.length - 1] : undefined);

export function statusLabel(i: InvLike, reminders: RemLike[]) {
  if (i.document_type === "cancellation") return { text: "Storno-Beleg", tone: "muted" };
  if (i.status === "paid") return { text: "Bezahlt", tone: "green" };
  if (i.status === "credited") return { text: "In Schlussrechnung verrechnet", tone: "muted" };
  if (i.status === "cancelled") return { text: "Storniert", tone: "muted" };
  if (isOpen(i)) {
    const r = latestReminder(reminders);
    if (r) return { text: `${r.reminder_level}. Mahnung${r.status === "created" ? " (noch nicht versendet)" : ""}`, tone: "red" };
    return overdueDays(i, reminders) > 0 ? { text: "Überfällig", tone: "red" } : { text: "Offen", tone: "blue" };
  }
  return { text: i.status, tone: "muted" };
}

export type NextStep = "paid" | "remind" | "sendReminder" | null;
/** Der eine passende Hauptschritt für die Zeile */
export function nextStep(i: InvLike, reminders: RemLike[], today = todayIso()): NextStep {
  if (!isOpen(i)) return null;
  const r = latestReminder(reminders);
  if (r?.status === "created") return "sendReminder";
  if (overdueDays(i, reminders, today) > 0 && (!r || r.reminder_level < 3)) return "remind";
  return "paid";
}

/** Darf (nächste) Mahnung erstellt werden? */
export function canRemind(i: InvLike, reminders: RemLike[], today = todayIso()) {
  if (!isOpen(i)) return false;
  const r = latestReminder(reminders);
  if (!r) return !!i.due_date && i.due_date.slice(0, 10) < today;
  if (r.reminder_level >= 3) return false;
  return !(r.new_due_date && r.new_due_date >= today);
}

export function kpis(invoices: InvLike[], remindersOf: (id: number) => RemLike[], today = todayIso()) {
  const open = invoices.filter(isOpen);
  const overdue = open.filter((i) => overdueDays(i, remindersOf(i.id), today) > 0);
  const dunned = open.filter((i) => remindersOf(i.id).length > 0);
  const month = today.slice(0, 7);
  const paid = invoices.filter((i) => isInvoice(i) && i.status === "paid" && (i.paid_at ?? "").slice(0, 7) === month);
  const sum = (xs: InvLike[]) => Math.round(xs.reduce((s, i) => s + Number(i.total_amount || 0), 0) * 100) / 100;
  return {
    open: { sum: sum(open), count: open.length },
    overdue: { sum: sum(overdue), count: overdue.length },
    dunned: { sum: sum(dunned), count: dunned.length },
    paidMonth: { sum: sum(paid), count: paid.length },
  };
}

export function matches(i: InvLike, f: Filter, remindersOf: (id: number) => RemLike[], today = todayIso()) {
  switch (f) {
    case "open":
      return isOpen(i);
    case "overdue":
      return overdueDays(i, remindersOf(i.id), today) > 0;
    case "paid":
      return isInvoice(i) && i.status === "paid";
    case "cancelled":
      return i.status === "cancelled" || i.document_type === "cancellation";
    default:
      return true;
  }
}
