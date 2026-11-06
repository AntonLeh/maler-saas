// Kundenart für Rechnungen (Spalte customers.is_business: null = aus Firmenname ableiten)

export type CustomerKind = "auto" | "private" | "business";

export const kindFromCustomer = (isBusiness: boolean | null | undefined): CustomerKind =>
  isBusiness === true ? "business" : isBusiness === false ? "private" : "auto";

export const isBusinessFromKind = (kind: CustomerKind): boolean | null =>
  kind === "business" ? true : kind === "private" ? false : null;

/** E-Rechnungs-Angaben des Kunden für das Speichern – leer und nie gesetzt: weglassen (läuft auch ohne die neuen Spalten) */
export function einvoiceCustomerFields(f: { vat_id: string; einvoice_email: string; buyer_reference: string; einvoice_had: boolean }) {
  const v = {
    vat_id: f.vat_id.replace(/\s+/g, " ").trim() || null,
    einvoice_email: f.einvoice_email.trim() || null,
    buyer_reference: f.buyer_reference.trim() || null,
  };
  if (!f.einvoice_had && !v.vat_id && !v.einvoice_email && !v.buyer_reference) return {};
  return v;
}
