// E-Rechnung nach EN 16931 in der CII-Syntax (UN/CEFACT Cross Industry Invoice D16B)
//  - profile "xrechnung": XRechnung 3.0 (zusätzliche deutsche Regeln BR-DE-*, z. B. Käuferreferenz, Kontaktdaten, E-Mail-Adressen)
//  - profile "en16931":   ZUGFeRD 2 / Factur-X, Profil EN 16931 (COMFORT) – wird ins PDF eingebettet
// Reine Erzeugung aus der Rechnung und ihren eingefrorenen Angaben (snapshot) – ohne Datenbank.

/* eslint-disable @typescript-eslint/no-explicit-any */

export type EInvoiceProfile = "xrechnung" | "en16931";

export const GUIDELINE: Record<EInvoiceProfile, string> = {
  xrechnung: "urn:cen.eu:en16931:2017#compliant#urn:xeinkauf.de:kosit:xrechnung_3.0",
  en16931: "urn:cen.eu:en16931:2017",
};

const esc = (v: unknown) =>
  String(v ?? "")
    // eslint-disable-next-line no-control-regex -- Steuerzeichen sind in XML nicht erlaubt
    .replace(/[\u0000-\u0008\u000b\u000c\u000e-\u001f]/g, "")
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;");
const r2 = (n: number) => Math.round((Number(n) || 0) * 100) / 100;
const amt = (n: number) => r2(n).toFixed(2);
const qty = (n: number) => (Math.round((Number(n) || 0) * 10000) / 10000).toFixed(4).replace(/\.?0+$/, "") || "0";
const d102 = (iso: unknown) => String(iso ?? "").slice(0, 10).replace(/-/g, "");
const clean = (v: unknown) => String(v ?? "").replace(/\s+/g, " ").trim();

/** Einheiten (UN/ECE Rec. 20) aus den Einheiten der Angebotspositionen */
export function unitCode(unit: unknown): string {
  const u = clean(unit).toLowerCase().replace(/\.$/, "");
  if (["m²", "m2", "qm", "m^2"].includes(u)) return "MTK";
  if (["m³", "m3", "cbm"].includes(u)) return "MTQ";
  if (["m", "lfm", "lfdm", "meter", "lm"].includes(u)) return "MTR";
  if (["std", "h", "stunde", "stunden", "hour"].includes(u)) return "HUR";
  if (["tag", "tage", "day"].includes(u)) return "DAY";
  if (["l", "liter", "ltr"].includes(u)) return "LTR";
  if (["kg"].includes(u)) return "KGM";
  if (["psch", "pauschal", "pausch", "pau"].includes(u)) return "LS";
  if (["monat", "month"].includes(u)) return "MON";
  return "H87"; // Stück
}

const countryIso = (v: unknown): string => {
  const t = clean(v).toLowerCase();
  if (["at", "aut", "österreich", "oesterreich", "austria"].includes(t)) return "AT";
  if (["ch", "che", "schweiz", "switzerland", "suisse"].includes(t)) return "CH";
  return "DE";
};

export type EInvoiceIssue = { field: string; message: string };

/** Fehlende Pflichtangaben (für die Meldung in der App) */
export function eInvoiceIssues(invoice: any, profile: EInvoiceProfile): EInvoiceIssue[] {
  const s = invoice?.snapshot ?? {};
  const c = s.company ?? {};
  const k = s.customer ?? {};
  const out: EInvoiceIssue[] = [];
  if (!invoice?.snapshot) out.push({ field: "snapshot", message: "Für ältere Rechnungen (vor dem 5.11.2026) kann keine E-Rechnung erzeugt werden." });
  if (!clean(c.company_name)) out.push({ field: "company_name", message: "Firmenname fehlt (Einstellungen)." });
  if (!clean(c.street) || !clean(c.zip) || !clean(c.city)) out.push({ field: "company_address", message: "Firmenadresse unvollständig (Einstellungen)." });
  if (!clean(c.vat_id) && !clean(c.tax_number)) out.push({ field: "company_tax", message: "USt-IdNr. oder Steuernummer fehlt (Einstellungen)." });
  if (!clean(c.iban)) out.push({ field: "iban", message: "IBAN fehlt (Einstellungen)." });
  if (!clean(k.street) || !clean(k.zip) || !clean(k.city)) out.push({ field: "customer_address", message: "Adresse des Kunden unvollständig." });
  if (invoice?.reverse_charge && !clean(c.vat_id)) out.push({ field: "company_vat", message: "Für § 13b-Rechnungen braucht die E-Rechnung Ihre USt-IdNr. (Einstellungen)." });
  if (invoice?.reverse_charge && !/^[A-Z]{2}[0-9A-Z]{2,13}$/i.test(clean(k.vat_id).replace(/\s/g, "")))
    out.push({ field: "customer_vat", message: "Für § 13b-Rechnungen braucht die E-Rechnung die USt-IdNr. des Kunden (z. B. DE123456789)." });
  if (profile === "xrechnung") {
    if (!clean(c.email)) out.push({ field: "company_email", message: "E-Mail-Adresse der Firma fehlt (Einstellungen)." });
    if (!clean(c.phone)) out.push({ field: "company_phone", message: "Telefonnummer der Firma fehlt (Einstellungen)." });
    if (!clean(k.einvoice_email) && !clean(k.email)) out.push({ field: "customer_email", message: "E-Mail-Adresse des Kunden (für E-Rechnungen) fehlt." });
  }
  return out;
}

type Line = { name: string; desc?: string; qty: number; unit: string; price: number; net: number };

/** Rechnungspositionen so aufbauen, dass die Summe genau dem Netto der Rechnung entspricht */
function buildLines(invoice: any): { lines: Line[]; allowance: number } {
  const s = invoice.snapshot ?? {};
  const isCancel = invoice.document_type === "cancellation";
  const net = r2(Math.abs(Number(invoice.subtotal) || 0));
  if (isCancel) {
    const ref = s.cancels?.invoice_number ?? "";
    return { lines: [{ name: `Storno der Rechnung ${ref}`.trim(), qty: 1, unit: "LS", price: net, net }], allowance: 0 };
  }
  if (invoice.invoice_type === "partial") {
    const pct = invoice.partial_type === "percent" && invoice.partial_value ? ` (${Number(invoice.partial_value).toLocaleString("de-DE")} %)` : "";
    const title = clean(s.order?.title) || clean(s.quote?.title);
    return { lines: [{ name: `Abschlagsrechnung${pct}${title ? ` – ${title}` : ""}`, qty: 1, unit: "LS", price: net, net }], allowance: 0 };
  }
  const items: any[] = Array.isArray(s.items) ? s.items : [];
  const lines: Line[] = items.map((it) => {
    const q = Number(it.quantity) || 1;
    const lineNet = r2(Number(it.total_price ?? it.line_total ?? q * (Number(it.unit_price) || 0)));
    return {
      name: clean(it.title || it.description || "Leistung").slice(0, 200),
      desc: clean(it.description && it.title ? it.description : "").slice(0, 500) || undefined,
      qty: q,
      unit: unitCode(it.unit),
      price: q ? Math.round((lineNet / q) * 10000) / 10000 : lineNet,
      net: lineNet,
    };
  });
  if (!lines.length) lines.push({ name: clean(s.order?.title) || "Leistungen laut Auftrag", qty: 1, unit: "LS", price: net, net });
  const discount = r2(Number(s.quote?.discount_amount) || 0);
  const itemsNet = r2(lines.reduce((a, l) => a + l.net, 0));
  // bereits bezahlte Abschläge (und Rundungsdifferenzen) als Minus-Position, damit die Summe dem Rechnungsnetto entspricht
  const rest = r2(itemsNet - discount - net);
  if (Math.abs(rest) >= 0.01) {
    const partials: any[] = (Array.isArray(s.partials) ? s.partials : []).filter((p: any) => p.status === "paid");
    const label = partials.length ? `abzüglich bezahlter Abschlagsrechnung${partials.length > 1 ? "en" : ""} ${partials.map((p) => p.invoice_number).join(", ")}` : "Ausgleich";
    lines.push({ name: label, qty: 1, unit: "LS", price: -rest, net: -rest });
  }
  return { lines, allowance: discount };
}

export function buildCii(invoice: any, profile: EInvoiceProfile): string {
  const s = invoice.snapshot ?? {};
  const c = s.company ?? {};
  const k = s.customer ?? {};
  const o = s.order ?? {};
  const cur = clean(c.currency) || (countryIso(c.country) === "CH" ? "CHF" : "EUR");
  const isCancel = invoice.document_type === "cancellation";
  const typeCode = isCancel ? "381" : invoice.invoice_type === "partial" ? "326" : "380";
  const rc = !!invoice.reverse_charge;
  const rate = rc ? 0 : r2(Number(invoice.tax_rate) || 0);
  const cat = rc ? "AE" : rate > 0 ? "S" : "E";
  const { lines, allowance } = buildLines(invoice);
  const lineTotal = r2(lines.reduce((a, l) => a + l.net, 0));
  const basis = r2(lineTotal - allowance);
  const tax = rc || rate === 0 ? 0 : r2(Math.abs(Number(invoice.tax_amount) || 0));
  const grand = r2(basis + tax);
  const sellerCountry = countryIso(c.country);
  const buyerCountry = countryIso(k.country || c.country);
  const buyerName = clean(k.company_name) || clean(`${k.first_name ?? ""} ${k.last_name ?? ""}`) || "Kunde";
  const buyerPerson = clean(k.company_name) ? clean(`${k.first_name ?? ""} ${k.last_name ?? ""}`) : "";
  const buyerEmail = clean(k.einvoice_email) || clean(k.email);
  const buyerRef = clean(k.buyer_reference) || (o.id ? `Auftrag ${o.id}` : clean(invoice.invoice_number));
  const notes: string[] = [];
  if (isCancel && s.cancels?.invoice_number) notes.push(`Stornorechnung zur Rechnung ${s.cancels.invoice_number}${invoice.cancel_reason ? `. Grund: ${clean(invoice.cancel_reason)}` : ""}`);
  if (rc) notes.push("Steuerschuldnerschaft des Leistungsempfängers gemäß § 13b UStG.");
  if (invoice.is_private_customer && invoice.labor_amount != null && Number(invoice.labor_amount) > 0 && !isCancel)
    notes.push(`Im Rechnungsbetrag enthaltene Arbeitskosten (§ 35a EStG): ${amt(Number(invoice.labor_amount))} ${cur} inkl. USt.`);
  if (invoice.is_private_customer && !isCancel)
    notes.push("Sie sind gesetzlich verpflichtet, diese Rechnung, einen Zahlungsbeleg oder eine andere beweiskräftige Unterlage zwei Jahre lang aufzubewahren (§ 14b Abs. 1 Satz 5 UStG).");

  const taxReg = [
    clean(c.vat_id) ? `<ram:SpecifiedTaxRegistration><ram:ID schemeID="VA">${esc(clean(c.vat_id).replace(/\s/g, ""))}</ram:ID></ram:SpecifiedTaxRegistration>` : "",
    clean(c.tax_number) ? `<ram:SpecifiedTaxRegistration><ram:ID schemeID="FC">${esc(clean(c.tax_number))}</ram:ID></ram:SpecifiedTaxRegistration>` : "",
  ].join("");
  const buyerVat = clean(k.vat_id).replace(/\s/g, "");
  const buyerTax = buyerVat
    ? /^[A-Z]{2}[0-9A-Z]{2,13}$/i.test(buyerVat)
      ? `<ram:SpecifiedTaxRegistration><ram:ID schemeID="VA">${esc(buyerVat.toUpperCase())}</ram:ID></ram:SpecifiedTaxRegistration>`
      : `<ram:SpecifiedTaxRegistration><ram:ID schemeID="FC">${esc(clean(k.vat_id))}</ram:ID></ram:SpecifiedTaxRegistration>`
    : "";
  const exemption = rc
    ? `<ram:ExemptionReason>Steuerschuldnerschaft des Leistungsempfängers</ram:ExemptionReason>`
    : cat === "E"
    ? `<ram:ExemptionReason>Kein Ausweis von Umsatzsteuer, da Kleinunternehmer gemäß § 19 UStG</ram:ExemptionReason>`
    : "";
  const vatCat = (withRate = true) =>
    `<ram:TypeCode>VAT</ram:TypeCode><ram:CategoryCode>${cat}</ram:CategoryCode>${withRate ? `<ram:RateApplicablePercent>${amt(rate)}</ram:RateApplicablePercent>` : ""}`;
  const start = invoice.service_period_start;
  const end = invoice.service_period_end;
  const delivery =
    start && end && start !== end
      ? ""
      : `<ram:ActualDeliverySupplyChainEvent><ram:OccurrenceDateTime><udt:DateTimeString format="102">${d102(end || start || invoice.invoice_date)}</udt:DateTimeString></ram:OccurrenceDateTime></ram:ActualDeliverySupplyChainEvent>`;
  const period =
    start && end && start !== end
      ? `<ram:BillingSpecifiedPeriod><ram:StartDateTime><udt:DateTimeString format="102">${d102(start)}</udt:DateTimeString></ram:StartDateTime><ram:EndDateTime><udt:DateTimeString format="102">${d102(end)}</udt:DateTimeString></ram:EndDateTime></ram:BillingSpecifiedPeriod>`
      : "";
  const due = invoice.due_date && !isCancel ? d102(invoice.due_date) : "";

  const lineXml = lines
    .map(
      (l, i) => `<ram:IncludedSupplyChainTradeLineItem>
<ram:AssociatedDocumentLineDocument><ram:LineID>${i + 1}</ram:LineID></ram:AssociatedDocumentLineDocument>
<ram:SpecifiedTradeProduct><ram:Name>${esc(l.name)}</ram:Name>${l.desc ? `<ram:Description>${esc(l.desc)}</ram:Description>` : ""}</ram:SpecifiedTradeProduct>
<ram:SpecifiedLineTradeAgreement><ram:NetPriceProductTradePrice><ram:ChargeAmount>${(Math.round(Math.abs(l.price) * 10000) / 10000).toFixed(4)}</ram:ChargeAmount></ram:NetPriceProductTradePrice></ram:SpecifiedLineTradeAgreement>
<ram:SpecifiedLineTradeDelivery><ram:BilledQuantity unitCode="${l.unit}">${l.net < 0 && l.price < 0 ? "-" : ""}${qty(l.qty)}</ram:BilledQuantity></ram:SpecifiedLineTradeDelivery>
<ram:SpecifiedLineTradeSettlement><ram:ApplicableTradeTax>${vatCat()}</ram:ApplicableTradeTax><ram:SpecifiedTradeSettlementLineMonetarySummation><ram:LineTotalAmount>${amt(l.net)}</ram:LineTotalAmount></ram:SpecifiedTradeSettlementLineMonetarySummation></ram:SpecifiedLineTradeSettlement>
</ram:IncludedSupplyChainTradeLineItem>`
    )
    .join("\n");

  const discountXml =
    allowance > 0
      ? `<ram:SpecifiedTradeAllowanceCharge><ram:ChargeIndicator><udt:Indicator>false</udt:Indicator></ram:ChargeIndicator><ram:ActualAmount>${amt(allowance)}</ram:ActualAmount><ram:Reason>Rabatt</ram:Reason><ram:CategoryTradeTax>${vatCat()}</ram:CategoryTradeTax></ram:SpecifiedTradeAllowanceCharge>`
      : "";

  return `<?xml version="1.0" encoding="UTF-8"?>
<rsm:CrossIndustryInvoice xmlns:rsm="urn:un:unece:uncefact:data:standard:CrossIndustryInvoice:100" xmlns:ram="urn:un:unece:uncefact:data:standard:ReusableAggregateBusinessInformationEntity:100" xmlns:qdt="urn:un:unece:uncefact:data:standard:QualifiedDataType:100" xmlns:udt="urn:un:unece:uncefact:data:standard:UnqualifiedDataType:100">
<rsm:ExchangedDocumentContext>
${profile === "xrechnung" ? `<ram:BusinessProcessSpecifiedDocumentContextParameter><ram:ID>urn:fdc:peppol.eu:2017:poacc:billing:01.0</ram:ID></ram:BusinessProcessSpecifiedDocumentContextParameter>` : ""}
<ram:GuidelineSpecifiedDocumentContextParameter><ram:ID>${GUIDELINE[profile]}</ram:ID></ram:GuidelineSpecifiedDocumentContextParameter>
</rsm:ExchangedDocumentContext>
<rsm:ExchangedDocument>
<ram:ID>${esc(invoice.invoice_number)}</ram:ID>
<ram:TypeCode>${typeCode}</ram:TypeCode>
<ram:IssueDateTime><udt:DateTimeString format="102">${d102(invoice.invoice_date)}</udt:DateTimeString></ram:IssueDateTime>
${notes.map((n) => `<ram:IncludedNote><ram:Content>${esc(n)}</ram:Content></ram:IncludedNote>`).join("\n")}
</rsm:ExchangedDocument>
<rsm:SupplyChainTradeTransaction>
${lineXml}
<ram:ApplicableHeaderTradeAgreement>
<ram:BuyerReference>${esc(buyerRef)}</ram:BuyerReference>
<ram:SellerTradeParty>
${!clean(c.vat_id) && clean(c.tax_number) ? `<ram:ID>${esc(clean(c.tax_number))}</ram:ID>` : ""}
<ram:Name>${esc(clean(c.company_name))}</ram:Name>
${profile === "xrechnung" || clean(c.phone) || clean(c.email) ? `<ram:DefinedTradeContact><ram:PersonName>${esc(clean(c.company_name))}</ram:PersonName>${clean(c.phone) ? `<ram:TelephoneUniversalCommunication><ram:CompleteNumber>${esc(clean(c.phone))}</ram:CompleteNumber></ram:TelephoneUniversalCommunication>` : ""}${clean(c.email) ? `<ram:EmailURIUniversalCommunication><ram:URIID>${esc(clean(c.email))}</ram:URIID></ram:EmailURIUniversalCommunication>` : ""}</ram:DefinedTradeContact>` : ""}
<ram:PostalTradeAddress><ram:PostcodeCode>${esc(clean(c.zip))}</ram:PostcodeCode><ram:LineOne>${esc(clean(c.street))}</ram:LineOne><ram:CityName>${esc(clean(c.city))}</ram:CityName><ram:CountryID>${sellerCountry}</ram:CountryID></ram:PostalTradeAddress>
${clean(c.email) ? `<ram:URIUniversalCommunication><ram:URIID schemeID="EM">${esc(clean(c.email))}</ram:URIID></ram:URIUniversalCommunication>` : ""}
${taxReg}
</ram:SellerTradeParty>
<ram:BuyerTradeParty>
<ram:Name>${esc(buyerName)}</ram:Name>
${buyerPerson ? `<ram:DefinedTradeContact><ram:PersonName>${esc(buyerPerson)}</ram:PersonName></ram:DefinedTradeContact>` : ""}
<ram:PostalTradeAddress><ram:PostcodeCode>${esc(clean(k.zip))}</ram:PostcodeCode><ram:LineOne>${esc(clean(k.street))}</ram:LineOne><ram:CityName>${esc(clean(k.city))}</ram:CityName><ram:CountryID>${buyerCountry}</ram:CountryID></ram:PostalTradeAddress>
${buyerEmail ? `<ram:URIUniversalCommunication><ram:URIID schemeID="EM">${esc(buyerEmail)}</ram:URIID></ram:URIUniversalCommunication>` : ""}
${buyerTax}
</ram:BuyerTradeParty>
</ram:ApplicableHeaderTradeAgreement>
<ram:ApplicableHeaderTradeDelivery>${delivery}</ram:ApplicableHeaderTradeDelivery>
<ram:ApplicableHeaderTradeSettlement>
<ram:PaymentReference>${esc(invoice.invoice_number)}</ram:PaymentReference>
<ram:InvoiceCurrencyCode>${cur}</ram:InvoiceCurrencyCode>
${
  clean(c.iban)
    ? `<ram:SpecifiedTradeSettlementPaymentMeans><ram:TypeCode>58</ram:TypeCode><ram:PayeePartyCreditorFinancialAccount><ram:IBANID>${esc(clean(c.iban).replace(/\s/g, ""))}</ram:IBANID>${clean(c.company_name) ? `<ram:AccountName>${esc(clean(c.company_name))}</ram:AccountName>` : ""}</ram:PayeePartyCreditorFinancialAccount>${clean(c.bic) ? `<ram:PayeeSpecifiedCreditorFinancialInstitution><ram:BICID>${esc(clean(c.bic).replace(/\s/g, ""))}</ram:BICID></ram:PayeeSpecifiedCreditorFinancialInstitution>` : ""}</ram:SpecifiedTradeSettlementPaymentMeans>`
    : `<ram:SpecifiedTradeSettlementPaymentMeans><ram:TypeCode>1</ram:TypeCode></ram:SpecifiedTradeSettlementPaymentMeans>`
}
<ram:ApplicableTradeTax><ram:CalculatedAmount>${amt(tax)}</ram:CalculatedAmount><ram:TypeCode>VAT</ram:TypeCode>${exemption}<ram:BasisAmount>${amt(basis)}</ram:BasisAmount><ram:CategoryCode>${cat}</ram:CategoryCode>${rc ? "<ram:ExemptionReasonCode>VATEX-EU-AE</ram:ExemptionReasonCode>" : ""}<ram:RateApplicablePercent>${amt(rate)}</ram:RateApplicablePercent></ram:ApplicableTradeTax>
${period}
${discountXml}
<ram:SpecifiedTradePaymentTerms>${isCancel ? "<ram:Description>Gutschrift/Storno – der Betrag wird mit der stornierten Rechnung verrechnet.</ram:Description>" : `<ram:Description>Zahlbar ohne Abzug${due ? ` bis ${invoice.due_date.slice(8, 10)}.${invoice.due_date.slice(5, 7)}.${invoice.due_date.slice(0, 4)}` : ""}.</ram:Description>${due ? `<ram:DueDateDateTime><udt:DateTimeString format="102">${due}</udt:DateTimeString></ram:DueDateDateTime>` : ""}`}</ram:SpecifiedTradePaymentTerms>
<ram:SpecifiedTradeSettlementHeaderMonetarySummation>
<ram:LineTotalAmount>${amt(lineTotal)}</ram:LineTotalAmount>
${allowance > 0 ? `<ram:AllowanceTotalAmount>${amt(allowance)}</ram:AllowanceTotalAmount>` : ""}
<ram:TaxBasisTotalAmount>${amt(basis)}</ram:TaxBasisTotalAmount>
<ram:TaxTotalAmount currencyID="${cur}">${amt(tax)}</ram:TaxTotalAmount>
<ram:GrandTotalAmount>${amt(grand)}</ram:GrandTotalAmount>
<ram:DuePayableAmount>${amt(grand)}</ram:DuePayableAmount>
</ram:SpecifiedTradeSettlementHeaderMonetarySummation>
${isCancel && s.cancels?.invoice_number ? `<ram:InvoiceReferencedDocument><ram:IssuerAssignedID>${esc(s.cancels.invoice_number)}</ram:IssuerAssignedID>${s.cancels.invoice_date ? `<ram:FormattedIssueDateTime><qdt:DateTimeString format="102">${d102(s.cancels.invoice_date)}</qdt:DateTimeString></ram:FormattedIssueDateTime>` : ""}</ram:InvoiceReferencedDocument>` : ""}
</ram:ApplicableHeaderTradeSettlement>
</rsm:SupplyChainTradeTransaction>
</rsm:CrossIndustryInvoice>
`;
}
