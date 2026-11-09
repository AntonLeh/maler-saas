// Projektleiter-Dashboard: Kennzahlen und „Braucht Aufmerksamkeit“ aus den geleiteten Aufträgen
export type PmOrder = {
  id: string | number;
  title: string;
  status: string;
  customer_id: string | number;
  address_city: string | null;
  start_date: string | null;
  end_date: string | null;
};
export type PmAssignment = { order_id: string | number; user_id: number; assignment_role: string };

export type AttentionReason = "review" | "no_team" | "no_material" | "overdue" | "start_today";
export type AttentionItem = { order: PmOrder; reason: AttentionReason; text: string };

const DONE = new Set(["fertig", "abgerechnet"]);

export const STATUS_LABELS: Record<string, string> = {
  neu: "Neu",
  geplant: "Geplant",
  in_arbeit: "In Arbeit",
  pausiert: "Pausiert",
  zur_pruefung: "Zur Prüfung",
  fertig: "Fertig",
  abgerechnet: "Abgerechnet",
};
export const statusLabel = (s: string) => STATUS_LABELS[s] ?? s ?? "-";

export function todayIso(now = new Date()): string {
  return `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, "0")}-${String(now.getDate()).padStart(2, "0")}`;
}

/** Mitarbeiter (ausführend) je Auftrag – der Projektleiter-Eintrag zählt nicht */
function teamSize(orderId: PmOrder["id"], assignments: PmAssignment[]): number {
  return assignments.filter((a) => String(a.order_id) === String(orderId) && a.assignment_role === "employee").length;
}

export function pmKpis(orders: PmOrder[], assignments: PmAssignment[], now = new Date()) {
  const today = todayIso(now);
  const active = orders.filter((o) => !DONE.has(o.status));
  return {
    active: active.length,
    inProgress: active.filter((o) => o.status === "in_arbeit").length,
    review: active.filter((o) => o.status === "zur_pruefung").length,
    noTeam: active.filter((o) => teamSize(o.id, assignments) === 0).length,
    startingToday: active.filter((o) => (o.start_date || "").slice(0, 10) === today).length,
  };
}

/** Wichtigstes zuerst: Freigabe → ohne Mitarbeiter → Enddatum überschritten → startet heute */
/** materialOrderIds: Aufträge, denen schon Material zugewiesen ist (fehlt = Prüfung aus) */
export function attentionList(
  orders: PmOrder[],
  assignments: PmAssignment[],
  now = new Date(),
  max = 6,
  materialOrderIds?: Set<string> | null
): AttentionItem[] {
  const today = todayIso(now);
  const out: AttentionItem[] = [];
  const seen = new Set<string>();
  const push = (o: PmOrder, reason: AttentionReason, text: string) => {
    const k = String(o.id);
    if (seen.has(k)) return;
    seen.add(k);
    out.push({ order: o, reason, text });
  };
  const active = orders.filter((o) => !DONE.has(o.status));
  for (const o of active) if (o.status === "zur_pruefung") push(o, "review", "Wartet auf deine Prüfung und Freigabe");
  for (const o of active) if (teamSize(o.id, assignments) === 0) push(o, "no_team", "Noch keine Mitarbeiter eingeteilt");
  if (materialOrderIds)
    for (const o of active)
      if (teamSize(o.id, assignments) > 0 && !materialOrderIds.has(String(o.id)))
        push(o, "no_material", "Material fehlt – Team ist eingeteilt, aber kein Material zugewiesen");
  for (const o of active) if (o.end_date && o.end_date.slice(0, 10) < today) push(o, "overdue", `Enddatum ${fmtDate(o.end_date)} überschritten`);
  for (const o of active) if ((o.start_date || "").slice(0, 10) === today) push(o, "start_today", "Startet heute");
  return out.slice(0, max);
}

export function fmtDate(v: string | null | undefined): string {
  const s = String(v ?? "").slice(0, 10);
  return /^\d{4}-\d{2}-\d{2}$/.test(s) ? `${s.slice(8, 10)}.${s.slice(5, 7)}.${s.slice(0, 4)}` : "";
}

export function greeting(now = new Date()): string {
  const h = now.getHours();
  return h < 11 ? "Guten Morgen" : h < 18 ? "Guten Tag" : "Guten Abend";
}
