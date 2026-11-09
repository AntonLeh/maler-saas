// Owner-Buchhaltung (Spanien): reine Hilfsfunktionen, testbar ohne Netzwerk

export const EU = new Set([
  "AT", "BE", "BG", "CY", "CZ", "DE", "DK", "EE", "ES", "FI", "FR", "GR", "EL", "HR", "HU", "IE", "IT",
  "LT", "LU", "LV", "MT", "NL", "PL", "PT", "RO", "SE", "SI", "SK",
]);

export type Treatment = "es" | "eu_b2b" | "eu_no_vat_id" | "oss" | "non_eu" | "other";

const r2 = (n: number) => Math.round(n * 100) / 100;
const cents = (v: unknown) => (typeof v === "number" ? v / 100 : 0);

/**
 * Steuerart einer Stripe-Rechnung bestimmen (Sitz des Verkäufers: Spanien).
 *  es           – spanische IVA berechnet (Kunde in Spanien oder Privatkunde unter der EU-Schwelle)
 *  eu_b2b       – EU-Firma mit USt-IdNr., Reverse Charge  → 303 Casilla 59 + Modelo 349 (Clave S)
 *  oss          – ausländische EU-Mehrwertsteuer berechnet (OSS) → Casilla 123 + Modelo 369
 *  non_eu       – Kunde außerhalb der EU (z. B. Schweiz): nicht steuerbar → Casilla 120
 *  eu_no_vat_id – EU-Kunde ohne USt-IdNr. und ohne Steuer → bitte prüfen
 *  other        – Spanien ohne Steuer o. Ä. → bitte prüfen
 */
export function classify(input: {
  country: string | null;
  taxId: string | null;
  tax: number;
  taxCountry: string | null;
  taxRate: number | null;
  taxability: string | null;
}): Treatment {
  const c = (input.country || "").toUpperCase();
  const tc = (input.taxCountry || "").toUpperCase();
  if (input.tax > 0) {
    if (tc === "ES" || (!tc && (c === "ES" || input.taxRate === 21))) return "es";
    return "oss";
  }
  if (input.taxability === "reverse_charge") return "eu_b2b";
  if (c === "ES") return "other";
  if (c && !EU.has(c)) return "non_eu";
  if (c && EU.has(c)) return input.taxId ? "eu_b2b" : "eu_no_vat_id";
  return "other";
}

/** Felder einer Stripe-Rechnung (API-Version 2024-06-20) in eine Einnahmen-Zeile übersetzen (Beträge in Originalwährung) */
// deno-lint-ignore no-explicit-any
export function mapInvoice(inv: any) {
  const total = cents(inv.total);
  const net = inv.total_excluding_tax != null ? cents(inv.total_excluding_tax) : cents(inv.subtotal);
  const tax = r2(total - net);
  // deno-lint-ignore no-explicit-any
  const taxes: any[] = Array.isArray(inv.total_tax_amounts) ? inv.total_tax_amounts : [];
  const first = taxes.find((t) => (t?.amount ?? 0) > 0) ?? taxes[0] ?? null;
  const rateObj = first && typeof first.tax_rate === "object" ? first.tax_rate : null;
  const taxRate = rateObj?.percentage ?? rateObj?.effective_percentage ?? (net > 0 && tax > 0 ? r2((tax / net) * 100) : 0);
  const taxCountry = rateObj?.country ?? null;
  const taxability = first?.taxability_reason ?? null;
  const country = inv.customer_address?.country ?? inv.customer_shipping?.address?.country ?? null;
  const taxId = Array.isArray(inv.customer_tax_ids) && inv.customer_tax_ids[0]?.value ? String(inv.customer_tax_ids[0].value) : null;
  const ts = inv.status_transitions?.finalized_at ?? inv.created;
  const paid = inv.status_transitions?.paid_at ?? null;
  const tenant =
    inv.subscription_details?.metadata?.tenant_id ??
    inv.metadata?.tenant_id ??
    inv.lines?.data?.[0]?.metadata?.tenant_id ??
    null;
  const desc = inv.lines?.data?.[0]?.description ?? inv.description ?? null;
  return {
    stripe_id: String(inv.id),
    kind: "invoice" as const,
    number: inv.number ?? null,
    issue_date: new Date(ts * 1000).toISOString().slice(0, 10),
    paid_at: paid ? new Date(paid * 1000).toISOString() : null,
    customer_name: inv.customer_name ?? null,
    customer_email: inv.customer_email ?? null,
    customer_country: country,
    customer_tax_id: taxId,
    tenant_id: tenant && /^\d+$/.test(String(tenant)) ? Number(tenant) : null,
    currency: String(inv.currency || "eur").toUpperCase(),
    net: r2(net),
    tax,
    total: r2(total),
    tax_rate: taxRate != null ? Number(taxRate) : null,
    tax_country: taxCountry,
    taxability,
    treatment: classify({ country, taxId, tax, taxCountry, taxRate: taxRate != null ? Number(taxRate) : null, taxability }),
    description: desc ? String(desc).slice(0, 300) : null,
    invoice_pdf: inv.invoice_pdf ?? null,
  };
}

/** Stripe-Gutschrift (Credit Note) → negative Einnahme mit der Steuerart der ursprünglichen Rechnung */
// deno-lint-ignore no-explicit-any
export function mapCreditNote(cn: any, original: ReturnType<typeof mapInvoice> | null) {
  const total = cents(cn.total);
  const net = cn.total_excluding_tax != null ? cents(cn.total_excluding_tax) : cents(cn.subtotal);
  const tax = r2(total - net);
  return {
    stripe_id: String(cn.id),
    kind: "credit_note" as const,
    number: cn.number ?? null,
    issue_date: new Date(cn.created * 1000).toISOString().slice(0, 10),
    paid_at: null,
    customer_name: original?.customer_name ?? null,
    customer_email: original?.customer_email ?? null,
    customer_country: original?.customer_country ?? null,
    customer_tax_id: original?.customer_tax_id ?? null,
    tenant_id: original?.tenant_id ?? null,
    currency: String(cn.currency || "eur").toUpperCase(),
    net: -r2(net),
    tax: -tax,
    total: -r2(total),
    tax_rate: original?.tax_rate ?? null,
    tax_country: original?.tax_country ?? null,
    taxability: original?.taxability ?? null,
    treatment: original?.treatment ?? ("other" as Treatment),
    description: `Gutschrift${original?.number ? ` zu ${original.number}` : ""}`,
    invoice_pdf: cn.pdf ?? null,
  };
}

/** Beträge in Euro umrechnen */
export function withEur<T extends { net: number; tax: number; total: number }>(row: T, rate: number) {
  return { ...row, fx_rate: rate, net_eur: r2(row.net * rate), tax_eur: r2(row.tax * rate), total_eur: r2(row.total * rate) };
}

// ---------- KI-Beleg (Ausgaben) ----------

export const EXPENSE_CATEGORIES = [
  "software", "werbung", "telefon", "gestoria", "buero", "hardware", "reisen", "fortbildung", "bank", "sozialversicherung", "sonstiges",
] as const;

export const SCAN_PROMPT = `Du liest Eingangsrechnungen und Belege für die Buchhaltung eines Selbstständigen (autónomo) mit Sitz in Spanien (Mallorca), der eine Software (SaaS) betreibt.
Lies Datum, Lieferant, Land des Lieferanten (ISO-Code, z. B. ES, IE, DE, US), Steuernummer des Lieferanten (NIF/CIF oder USt-IdNr./VAT-ID, falls vorhanden), Rechnungsnummer, Nettobetrag, IVA-Satz und IVA-Betrag, Gesamtbetrag und Währung.
Bestimme die steuerliche Behandlung aus Sicht des spanischen Empfängers:
- "es_iva": spanischer Lieferant mit spanischer IVA auf der Rechnung.
- "eu_isp": Lieferant aus einem anderen EU-Land ohne IVA (Reverse Charge / inversión del sujeto pasivo), z. B. Google Ireland, Stripe, Meta Ireland.
- "non_eu_isp": Lieferant außerhalb der EU ohne Mehrwertsteuer (z. B. aus den USA wie Vercel, Supabase, Anthropic, OpenAI, ElevenLabs, Twilio).
- "sin_iva": Belege ohne IVA, die keine Dienstleistung mit Steuerumkehr sind (z. B. Cuota de autónomos / Seguridad Social, Bankgebühren, Tasas, Versicherungen).
Wähle eine Kategorie: software (Server, Hosting, KI-Dienste, Software-Abos), werbung, telefon (Telefon/Internet), gestoria (Steuerberatung), buero, hardware, reisen, fortbildung, bank (Bank- und Zahlungsgebühren), sozialversicherung (Cuota de autónomos), sonstiges.
Steht auf der Rechnung ausländische Mehrwertsteuer (z. B. deutsche 19 %), nimm "es_iva" NICHT – gib dann tax_rate und tax_amount wie gedruckt an und behandle sie als "sin_iva" mit Hinweis in note (nicht abziehbar).
Rufe immer das Werkzeug gasto_daten auf. Unbekannte Felder weglassen.`;

export const SCAN_TOOL = {
  name: "gasto_daten",
  description: "Ausgelesene Daten eines Belegs",
  input_schema: {
    type: "object",
    properties: {
      issue_date: { type: "string", description: "Rechnungsdatum YYYY-MM-DD" },
      supplier: { type: "string" },
      supplier_country: { type: "string", description: "ISO-3166 Alpha-2" },
      supplier_tax_id: { type: "string" },
      invoice_number: { type: "string" },
      currency: { type: "string", description: "ISO-Währung, z. B. EUR, USD" },
      net_amount: { type: "number" },
      tax_rate: { type: "number" },
      tax_amount: { type: "number" },
      gross_amount: { type: "number" },
      treatment: { type: "string", enum: ["es_iva", "eu_isp", "non_eu_isp", "sin_iva"] },
      category: { type: "string", enum: [...EXPENSE_CATEGORIES] },
      note: { type: "string" },
    },
    required: ["supplier"],
  },
};

// deno-lint-ignore no-explicit-any
export function cleanScan(input: any) {
  if (!input || typeof input !== "object") return null;
  const num = (v: unknown) => (typeof v === "number" && Number.isFinite(v) ? Math.round(v * 100) / 100 : null);
  const str = (v: unknown, max = 120) => (typeof v === "string" && v.trim() ? v.trim().slice(0, max) : null);
  const date = str(input.issue_date, 10);
  const treatment = ["es_iva", "eu_isp", "non_eu_isp", "sin_iva"].includes(input.treatment) ? input.treatment : null;
  const category = (EXPENSE_CATEGORIES as readonly string[]).includes(input.category) ? input.category : "sonstiges";
  let net = num(input.net_amount);
  const tax = num(input.tax_amount);
  const gross = num(input.gross_amount);
  if (net == null && gross != null) net = Math.round((gross - (tax ?? 0)) * 100) / 100;
  return {
    issue_date: date && /^\d{4}-\d{2}-\d{2}$/.test(date) ? date : null,
    supplier: str(input.supplier) ?? "",
    supplier_country: str(input.supplier_country, 2)?.toUpperCase() ?? null,
    supplier_tax_id: str(input.supplier_tax_id, 40),
    invoice_number: str(input.invoice_number, 60),
    currency: (str(input.currency, 3) ?? "EUR").toUpperCase(),
    net_amount: net,
    tax_rate: num(input.tax_rate),
    tax_amount: tax,
    gross_amount: gross,
    treatment,
    category,
    note: str(input.note, 300),
  };
}
