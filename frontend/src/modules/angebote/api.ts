// Angebote: Positionen bearbeiten/löschen/hinzufügen, Status setzen, Gültigkeit.
// Die Summen des Angebots rechnet die Datenbank selbst neu (Trigger auf quote_items).
import { supabase } from "../../lib/supabase";

export type ItemPatch = {
  title: string;
  description: string | null;
  quantity: number;
  unit: string;
  unit_price: number;
};

export async function updateQuoteItem(tenantId: number, itemId: number, patch: ItemPatch) {
  const { error } = await supabase.from("quote_items").update(patch).eq("id", itemId).eq("tenant_id", tenantId);
  if (error) throw error;
}

export async function deleteQuoteItem(tenantId: number, itemId: number) {
  const { error } = await supabase.from("quote_items").delete().eq("id", itemId).eq("tenant_id", tenantId);
  if (error) throw error;
}

export async function addQuoteItem(tenantId: number, quoteId: number, sortOrder: number, item: ItemPatch) {
  const { error } = await supabase.from("quote_items").insert({
    tenant_id: tenantId,
    quote_id: quoteId,
    sort_order: sortOrder,
    item_type: "service",
    ...item,
  });
  if (error) throw error;
}

export type SettableStatus = "draft" | "sent" | "rejected";

export async function setQuoteStatus(tenantId: number, quoteId: number, status: SettableStatus) {
  const { error } = await supabase.from("quotes").update({ status }).eq("id", quoteId).eq("tenant_id", tenantId);
  if (error) throw error;
}

export async function setQuoteValidUntil(tenantId: number, quoteId: number, date: string | null) {
  const { error } = await supabase.from("quotes").update({ valid_until: date }).eq("id", quoteId).eq("tenant_id", tenantId);
  if (error) throw error;
}

/** Datum in N Tagen als YYYY-MM-DD (lokal). */
export function inDays(days: number, from = new Date()): string {
  const d = new Date(from.getFullYear(), from.getMonth(), from.getDate() + days);
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
}
