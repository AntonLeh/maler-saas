// Daten für das Rechnungs-PDF laden – gleiche Logik wie in der Rechnungsliste (InvoicesPage),
// damit z. B. das Steuerberater-Paket auch alte Rechnungen ohne eingefrorene Angaben erzeugen kann.
import { supabase } from "./supabase";
import { snapshotSources } from "./invoicePdf";

/* eslint-disable @typescript-eslint/no-explicit-any */
export async function loadInvoicePdfSources(invoice: any, tenantId: number) {
  const frozen = snapshotSources(invoice);
  if (frozen) return frozen;

  const { data: order } = await supabase.from("orders").select("*").eq("id", invoice.order_id).maybeSingle();
  const { data: customer } = await supabase.from("customers").select("*").eq("id", invoice.customer_id).maybeSingle();
  const { data: companySettings } = await supabase.from("company_settings").select("*").eq("tenant_id", tenantId).maybeSingle();

  let quoteId = order?.accepted_quote_id ?? order?.quote_id ?? order?.generated_quote_id ?? null;
  if (!quoteId && order?.id) {
    const { data: quote } = await supabase
      .from("quotes")
      .select("id")
      .eq("order_id", Number(order.id))
      .eq("status", "accepted")
      .order("created_at", { ascending: false })
      .limit(1)
      .maybeSingle();
    quoteId = quote?.id ?? null;
  }
  let invoiceItems: any[] = [];
  if (quoteId) {
    const { data: items } = await supabase.from("quote_items").select("*").eq("quote_id", quoteId).order("id", { ascending: true });
    invoiceItems = items || [];
  }
  let partialInvoices: any[] = [];
  if (invoice.invoice_type === "final") {
    const { data } = await supabase
      .from("invoices")
      .select("id, invoice_number, invoice_date, subtotal, tax_amount, total_amount, status, paid_at, partial_type, partial_value")
      .eq("tenant_id", tenantId)
      .eq("order_id", invoice.order_id)
      .eq("invoice_type", "partial")
      .neq("status", "cancelled")
      .order("invoice_date", { ascending: true });
    partialInvoices = data || [];
  }
  return { invoiceItems, order, customer, companySettings: companySettings ?? {}, partialInvoices, currencySymbol: companySettings?.currency_symbol || "€" };
}
