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
