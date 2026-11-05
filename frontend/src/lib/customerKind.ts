// Kundenart für Rechnungen (Spalte customers.is_business: null = aus Firmenname ableiten)

export type CustomerKind = "auto" | "private" | "business";

export const kindFromCustomer = (isBusiness: boolean | null | undefined): CustomerKind =>
  isBusiness === true ? "business" : isBusiness === false ? "private" : "auto";

export const isBusinessFromKind = (kind: CustomerKind): boolean | null =>
  kind === "business" ? true : kind === "private" ? false : null;
