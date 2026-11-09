// Materialverwaltung: Datenbank-Aufrufe + Hilfsfunktionen
import { supabase } from "../../lib/supabase";

export type Material = {
  id: number;
  tenant_id: number;
  name: string;
  description: string | null;
  category: string | null;
  unit: string;
  stock_quantity: number;
  minimum_quantity: number;
  purchase_price: number | null;
  supplier: string | null;
  storage_location: string | null;
  is_active: boolean;
};

export type Movement = {
  id: number;
  movement_type: string;
  quantity: number;
  stock_before: number | null;
  stock_after: number | null;
  order_id: number | null;
  performed_by: number | null;
  note: string | null;
  created_at: string;
};

export type UsageLog = {
  id: number;
  assignment_id: number;
  quantity: number;
  action: string;
  note: string | null;
  created_at: string;
  material_price_at_use?: number | null;
};

/** Verständliche Fehlermeldung (Meldungen unserer Funktionen sind schon deutsch) */
export function materialError(err: unknown, fallback: string) {
  const msg = String((err as { message?: string })?.message ?? err ?? "");
  const low = msg.toLowerCase();
  if (low.includes("could not find the function") || low.includes("does not exist"))
    return "Die Datenbank ist noch nicht aktualisiert. Bitte die SQL-Anweisung „Material Stufe 1“ ausführen.";
  if (low.includes("failed to fetch") || low.includes("network")) return "Keine Internetverbindung. Bitte gleich noch einmal versuchen.";
  if (low.includes("row-level security") || low.includes("permission denied")) return "Dafür fehlt die Berechtigung.";
  if (/^(Nicht genügend|Es sind nur|Das Material|Material wurde|Der Empfänger|Auftrag nicht|Zuweisung nicht|Die Menge|Keine Berechtigung|Nur )/.test(msg))
    return msg.replace(/(\d+)\.00\b/g, "$1");
  return fallback;
}

const call = async (fn: string, args: Record<string, unknown>, fallback: string) => {
  const { data, error } = await supabase.rpc(fn, args);
  if (error) throw new Error(materialError(error, fallback));
  return data;
};

export const assignToOrder = (orderId: number, materialId: number, userId: number, quantity: number) =>
  call("material_assign_to_order", { p_order_id: orderId, p_material_id: materialId, p_user_id: userId, p_quantity: quantity }, "Material konnte nicht zugewiesen werden.");

export const cancelAssignment = (assignmentId: number) =>
  call("material_cancel_assignment", { p_assignment_id: assignmentId }, "Zuweisung konnte nicht storniert werden.");

export const confirmHandover = (assignmentId: number) =>
  call("material_confirm_handover", { p_assignment_id: assignmentId }, "Übernahme konnte nicht bestätigt werden.");

export const bookUsage = (assignmentId: number, quantity: number, action: string, note: string) =>
  call("material_book_usage", { p_assignment_id: assignmentId, p_quantity: quantity, p_action: action, p_note: note || null }, "Buchung konnte nicht gespeichert werden.");

export const stockIn = (materialId: number, quantity: number, initial: boolean, note: string) =>
  call("material_stock_in", { p_material_id: materialId, p_quantity: quantity, p_initial: initial, p_note: note || null }, "Wareneingang konnte nicht gebucht werden.");

export async function loadMovements(tenantId: number, materialId: number): Promise<Movement[]> {
  const { data, error } = await supabase
    .from("material_stock_movements")
    .select("id, movement_type, quantity, stock_before, stock_after, order_id, performed_by, note, created_at")
    .eq("tenant_id", tenantId)
    .eq("material_id", materialId)
    .order("created_at", { ascending: false })
    .limit(100);
  if (error) throw new Error(materialError(error, "Verlauf konnte nicht geladen werden."));
  return (data as Movement[]) || [];
}

// ---------- Formatierung ----------

export const parseNum = (s: string): number => {
  const n = Number(String(s ?? "").replace(/\s/g, "").replace(",", "."));
  return Number.isFinite(n) ? n : NaN;
};

export const fmtQty = (n: number | null | undefined) =>
  n == null ? "–" : new Intl.NumberFormat("de-DE", { maximumFractionDigits: 2 }).format(Number(n));

export const fmtMoney = (n: number | null | undefined, currency: string) =>
  n == null
    ? "–"
    : new Intl.NumberFormat("de-DE", { style: "currency", currency: currency || "EUR" }).format(Number(n));

export const MOVEMENT_LABELS: Record<string, string> = {
  initial_stock: "Anfangsbestand",
  purchase: "Wareneingang",
  assignment: "An Auftrag",
  consumption: "Verbrauch",
  return: "Zurück ins Lager",
  damage: "Beschädigt",
  inventory: "Inventur",
  manual_adjustment: "Korrektur",
};

export const USAGE_LABELS: Record<string, string> = {
  used: "Verbraucht",
  returned: "Zurück ins Lager",
  damaged: "Beschädigt",
  left_on_site: "Auf Baustelle gelassen",
};

export const isLow = (m: Pick<Material, "stock_quantity" | "minimum_quantity">) =>
  Number(m.minimum_quantity || 0) > 0 && Number(m.stock_quantity || 0) <= Number(m.minimum_quantity || 0);

// ---------- Verlauf mit Personen und Baustellen ----------

export type HistoryEntry = {
  key: string;
  at: string;
  kind: "move" | "usage";
  label: string;
  /** +/− Lagerbestand; null = Bestand unverändert (z. B. Verbrauch) */
  delta: number | null;
  quantity: number;
  stockAfter: number | null;
  by: string | null; // wer hat gebucht
  to: string | null; // an wen ging das Material
  site: string | null; // Baustelle
  note: string | null;
};

type RawMove = Movement & { from_holder_type: string | null; from_holder_id: number | null; to_holder_type: string | null; to_holder_id: number | null };
type RawUsage = { id: number; user_id: number | null; order_id: number | null; quantity: number; action: string; note: string | null; created_at: string };

export async function loadHistory(tenantId: number, materialId: number): Promise<HistoryEntry[]> {
  const [mRes, uRes] = await Promise.all([
    supabase
      .from("material_stock_movements")
      .select("id, movement_type, quantity, stock_before, stock_after, order_id, performed_by, note, created_at, from_holder_type, from_holder_id, to_holder_type, to_holder_id")
      .eq("tenant_id", tenantId)
      .eq("material_id", materialId)
      .order("created_at", { ascending: false })
      .limit(150),
    supabase
      .from("material_consumption_logs")
      .select("id, user_id, order_id, quantity, action, note, created_at")
      .eq("tenant_id", tenantId)
      .eq("material_id", materialId)
      .order("created_at", { ascending: false })
      .limit(150),
  ]);
  if (mRes.error) throw new Error(materialError(mRes.error, "Verlauf konnte nicht geladen werden."));
  const moves = (mRes.data as RawMove[]) || [];
  const usages = (uRes.data as RawUsage[]) || [];

  // Namen und Baustellen nachladen
  const userIds = [...new Set([
    ...moves.flatMap((m) => [m.performed_by, m.to_holder_type === "employee" || m.to_holder_type === "project_manager" ? m.to_holder_id : null, m.from_holder_type === "employee" ? m.from_holder_id : null]),
    ...usages.map((u) => u.user_id),
  ].filter((x): x is number => x != null))];
  const orderIds = [...new Set([...moves.map((m) => m.order_id), ...usages.map((u) => u.order_id)].filter((x): x is number => x != null))];
  const [pRes, oRes] = await Promise.all([
    userIds.length ? supabase.from("app_users").select("id, first_name, last_name").in("id", userIds) : Promise.resolve({ data: [] }),
    orderIds.length ? supabase.from("orders").select("id, title, address_street, address_city").in("id", orderIds) : Promise.resolve({ data: [] }),
  ]);
  const people = new Map<number, string>(
    ((pRes.data as { id: number; first_name: string | null; last_name: string | null }[]) || []).map((p) => [
      Number(p.id),
      `${p.first_name || ""} ${p.last_name || ""}`.trim() || "Unbekannt",
    ])
  );
  const sites = new Map<number, string>(
    ((oRes.data as { id: number; title: string | null; address_street: string | null; address_city: string | null }[]) || []).map((o) => [
      Number(o.id),
      [o.title || `Auftrag #${o.id}`, [o.address_street, o.address_city].filter(Boolean).join(", ")].filter(Boolean).join(" – "),
    ])
  );
  const who = (id: number | null) => (id == null ? null : people.get(Number(id)) ?? null);
  const site = (id: number | null) => (id == null ? null : sites.get(Number(id)) ?? `Auftrag #${id}`);

  const entries: HistoryEntry[] = moves.map((m) => {
    const label = MOVEMENT_LABELS[m.movement_type] || m.movement_type;
    const delta = m.stock_after != null && m.stock_before != null ? Number(m.stock_after) - Number(m.stock_before) : null;
    const toPerson = m.to_holder_type === "employee" || m.to_holder_type === "project_manager" ? who(m.to_holder_id) : null;
    const note = (m.note || "").trim();
    const boring = !note || note === label || /^Wareneingang( über die Materialverwaltung)?\.?$/.test(note) || /^Material aus Lager entnommen/.test(note) || /^Aus dem Lager entnommen/.test(note) || /^Restmaterial zurück ins Lager\.?$/.test(note);
    return {
      key: `m${m.id}`,
      at: m.created_at,
      kind: "move",
      label,
      delta,
      quantity: Number(m.quantity),
      stockAfter: m.stock_after,
      by: who(m.performed_by),
      to: toPerson,
      site: site(m.order_id),
      note: boring ? null : note,
    };
  });

  // Verbrauch, Beschädigt, Auf Baustelle (Rückgaben stehen schon als Lagerbewegung drin,
  // außer bei alten Rückgaben ohne Lagerbuchung)
  for (const u of usages) {
    if (u.action === "returned") {
      const t = new Date(u.created_at).getTime();
      const covered = moves.some(
        (m) => m.movement_type === "return" && Number(m.quantity) === Number(u.quantity) && Math.abs(new Date(m.created_at).getTime() - t) < 60000
      );
      if (covered) continue;
    }
    entries.push({
      key: `u${u.id}`,
      at: u.created_at,
      kind: "usage",
      label: USAGE_LABELS[u.action] || u.action,
      delta: null,
      quantity: Number(u.quantity),
      stockAfter: null,
      by: who(u.user_id),
      to: null,
      site: site(u.order_id),
      note: u.note,
    });
  }

  return entries.sort((a, b) => b.at.localeCompare(a.at));
}
