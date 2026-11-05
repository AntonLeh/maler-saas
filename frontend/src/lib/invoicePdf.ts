import { jsPDF } from "jspdf";
import autoTable from "jspdf-autotable";

type InvoicePdfParams = {
  invoice: any;
  invoiceItems?: any[];
  order?: any;
  customer?: any;
  companySettings?: any;
  partialInvoices?: any[];
  currencySymbol?: string;
};

const formatMoney = (
  value: number | string | null | undefined,
  currencySymbol: string
) => {
  const numberValue = Number(value ?? 0);

  return `${numberValue.toLocaleString("de-DE", {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  })} ${currencySymbol}`;
};

const formatDate = (value: string | null | undefined) => {
  if (!value) return "-";

  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return "-";

  return date.toLocaleDateString("de-DE", {
    day: "2-digit",
    month: "2-digit",
    year: "numeric",
  });
};

/** Firmenland aus den Einstellungen (Freitext) -> DE | AT | CH */
export const countryCode = (value: unknown): "DE" | "AT" | "CH" => {
  const v = String(value ?? "").trim().toLowerCase();
  if (["at", "aut", "österreich", "oesterreich", "austria"].includes(v)) return "AT";
  if (["ch", "che", "schweiz", "switzerland", "suisse", "svizzera"].includes(v)) return "CH";
  return "DE";
};

const vatIdLabel = (country: "DE" | "AT" | "CH") => (country === "AT" ? "UID-Nr." : country === "CH" ? "MWST-Nr." : "USt-IdNr.");

/** Hinweise unter der Summe (nur für Rechnungen mit eingefrorenen Angaben) */
export function legalNotes(invoice: any, country: "DE" | "AT" | "CH", currencySymbol: string): string[] {
  const notes: string[] = [];
  if (invoice?.reverse_charge) {
    notes.push(
      country === "AT"
        ? "Übergang der Steuerschuld auf den Leistungsempfänger gemäß § 19 Abs. 1a UStG (Bauleistungen)."
        : "Steuerschuldnerschaft des Leistungsempfängers gemäß § 13b UStG."
    );
  }
  if (country === "DE" && invoice?.is_private_customer && invoice?.document_type !== "cancellation") {
    if (invoice?.labor_amount != null && Number(invoice.labor_amount) > 0) {
      notes.push(
        `Im Rechnungsbetrag enthaltene Arbeitskosten (§ 35a EStG): ${formatMoney(invoice.labor_amount, currencySymbol)} inkl. USt (${Number(
          invoice.labor_share_percent ?? 0
        ).toLocaleString("de-DE", { maximumFractionDigits: 2 })} % des Rechnungsbetrags).`
      );
    }
    notes.push(
      "Hinweis: Sie sind gesetzlich verpflichtet, diese Rechnung, einen Zahlungsbeleg oder eine andere beweiskräftige Unterlage zwei Jahre lang aufzubewahren (§ 14b Abs. 1 Satz 5 UStG)."
    );
  }
  return notes;
}

/** Leistungszeitraum als Text */
export function servicePeriodText(invoice: any): string | null {
  const start = invoice?.service_period_start;
  const end = invoice?.service_period_end;
  if (!start && !end) return null;
  const label = invoice?.invoice_type === "partial" ? "Voraussichtlicher Leistungszeitraum" : start && end && start !== end ? "Leistungszeitraum" : "Leistungsdatum";
  if (start && end && start !== end) return `${label}: ${formatDate(start)} – ${formatDate(end)}`;
  return `${label}: ${formatDate(end ?? start)}`;
}

/** Eingefrorene Angaben einer Rechnung (null = alte Rechnung, Daten wie bisher live laden) */
export function snapshotSources(invoice: any): Omit<InvoicePdfParams, "invoice" | "currencySymbol"> & { currencySymbol: string } | null {
  const snap = invoice?.snapshot;
  if (!snap || typeof snap !== "object") return null;
  const company = snap.company ?? {};
  return {
    invoiceItems: Array.isArray(snap.items) ? snap.items : [],
    order: snap.order ?? null,
    customer: snap.customer ?? null,
    companySettings: company,
    // Abschläge, die bei Erstellung noch offen waren, sind in der Schlussrechnung aufgegangen
    partialInvoices: (Array.isArray(snap.partials) ? snap.partials : []).map((p: any) => ({
      ...p,
      status: p.status === "paid" ? "paid" : "credited",
    })),
    currencySymbol: company.currency_symbol || "€",
  };
}

const getInvoiceNumber = (invoice: any) => {
  return (
    invoice?.invoice_number ??
    invoice?.number ??
    invoice?.id ??
    "-"
  );
};


export function generateInvoicePdf({
  invoice,
  invoiceItems = [],
  order = null,
  customer = null,
  companySettings = {},
  partialInvoices = [],
  currencySymbol = "€",
}: InvoicePdfParams) {
  const doc = new jsPDF("p", "mm", "a4");

  const pageWidth = doc.internal.pageSize.getWidth();
  const marginLeft = 14;
  const marginRight = 14;

  const invoiceNumber = getInvoiceNumber(invoice);
  // Neue Rechnungen (mit eingefrorenen Angaben) bekommen die Pflichtangaben; alte bleiben wie bisher
  const frozen = !!invoice?.snapshot;
  const isCancellation = invoice?.document_type === "cancellation";
  const country = countryCode(companySettings?.country);
  const cancelsRef = invoice?.snapshot?.cancels ?? null;

  const companyName =
    companySettings?.company_name ??
    companySettings?.companyName ??
    companySettings?.name ??
    companySettings?.firma ??
    "Malerbetrieb";

  const companyAddressLine = [
    companySettings?.street ?? "",
    `${companySettings?.zip ?? ""} ${companySettings?.city ?? ""}`.trim(),
  ].filter(Boolean);

  const companyContactLine = [
    companySettings?.phone ?? "",
    companySettings?.email ?? "",
  ].filter(Boolean);

  doc.setFont("helvetica", "normal");

  // Logo oben links
  if (companySettings?.logo_url) {
    try {
      doc.addImage(companySettings.logo_url, "PNG", marginLeft, 8, 60, 38);
    } catch (error) {
      console.warn("Logo konnte nicht in die PDF eingefügt werden:", error);
    }
  }

  // Dokumenttitel rechts
const isPartialInvoice = invoice?.invoice_type === "partial";
const isFinalInvoiceWithPartials =
  invoice?.invoice_type === "final" &&
  (
    Number(invoice?.paid_partial_amount ?? 0) > 0 ||
    Number(invoice?.open_partial_amount ?? 0) > 0
  );

doc.setFontSize(isCancellation || isPartialInvoice || isFinalInvoiceWithPartials ? 20 : 24);
doc.setFont("helvetica", "bold");

const documentTitle = isCancellation
  ? "STORNORECHNUNG"
  : isPartialInvoice
  ? "ABSCHLAGSRECHNUNG"
  : isFinalInvoiceWithPartials
  ? "SCHLUSSRECHNUNG"
  : "RECHNUNG";

doc.text(
  documentTitle,
  pageWidth - marginRight,
  18,
  { align: "right" }
);
  doc.setFont("helvetica", "normal");
  doc.setFontSize(9);
  doc.text(`Nr.: ${invoiceNumber}`, pageWidth - marginRight, 27, {
    align: "right",
  });
  doc.text(
    `Datum: ${formatDate(invoice?.invoice_date ?? invoice?.created_at)}`,
    pageWidth - marginRight,
    33,
    { align: "right" }
  );
  if (!isCancellation) {
    doc.text(
      `Fällig bis: ${formatDate(invoice?.due_date)}`,
      pageWidth - marginRight,
      39,
      { align: "right" }
    );
  }

  // Linie
  doc.setLineWidth(0.3);
  doc.line(marginLeft, 46, pageWidth - marginRight, 46);

  // Rechnungsadresse
  doc.setFontSize(10);
  doc.setFont("helvetica", "bold");
  doc.text("Rechnungsadresse", marginLeft, 58);

  doc.setFont("helvetica", "normal");
  doc.setFontSize(9);

    const customerName =
    customer?.company_name ||
    `${customer?.first_name ?? ""} ${customer?.last_name ?? ""}`.trim() ||
    customer?.name ||
    invoice?.customer_name ||
    `Kunde-ID: ${invoice?.customer_id ?? "-"}`;

  const billingAddressLines = [
    customerName,
    customer?.street ?? customer?.address ?? invoice?.customer_street ?? "",
    `${customer?.zip ?? customer?.postal_code ?? invoice?.customer_zip ?? ""} ${
      customer?.city ?? invoice?.customer_city ?? ""
    }`.trim(),
  ].filter(Boolean);

  doc.text(billingAddressLines.length > 0 ? billingAddressLines : ["-"], marginLeft, 66);

  // Auftragsdaten
  doc.setFontSize(10);
  doc.setFont("helvetica", "bold");
  doc.text("Auftragsdaten", 112, 58);

  doc.setFont("helvetica", "normal");
  doc.setFontSize(9);
    const orderAddressLines = [
    order?.address_street ?? order?.object_street ?? "",
    `${order?.address_zip ?? order?.object_zip ?? ""} ${
      order?.address_city ?? order?.object_city ?? ""
    }`.trim(),
  ].filter(Boolean);

  const orderLines = orderAddressLines.length > 0 ? orderAddressLines : [`Auftrag-ID: ${invoice?.order_id ?? "-"}`];
  doc.text(orderLines, 112, 66);
  const periodText = frozen ? servicePeriodText(invoice) : null;
  if (periodText) {
    doc.text(periodText, 112, 66 + orderLines.length * 4.5 + 1);
  }

  // Einleitung
  let y = 92;

  doc.setFontSize(12);
  doc.setFont("helvetica", "bold");
  const invoiceHeading = isCancellation
  ? "Stornorechnung"
  : isPartialInvoice
  ? "Abschlagsrechnung"
  : isFinalInvoiceWithPartials
  ? "Schlussrechnung"
  : "Rechnung";

doc.text(
  `${invoiceHeading} ${invoiceNumber}`,
  marginLeft,
  y
);

  y += 8;

  doc.setFont("helvetica", "normal");
  doc.setFontSize(9);

  const introText = isCancellation
  ? `Hiermit stornieren wir die Rechnung ${cancelsRef?.invoice_number ?? ""}${
      cancelsRef?.invoice_date ? ` vom ${formatDate(cancelsRef.invoice_date)}` : ""
    } vollständig. Der Rechnungsbetrag wird mit dieser Stornorechnung aufgehoben.${
      invoice?.cancel_reason ? ` Grund: ${invoice.cancel_reason}` : ""
    }`
  : isPartialInvoice
  ? `Gemäß der vereinbarten Zahlungsregelung berechnen wir mit dieser Abschlagsrechnung ${
      invoice?.partial_type === "percent"
        ? `${Number(invoice?.partial_value ?? 0).toLocaleString("de-DE", {
            maximumFractionDigits: 2,
          })} %`
        : formatMoney(invoice?.partial_value, currencySymbol)
    } des vereinbarten Auftragswertes von ${formatMoney(
      invoice?.base_amount,
      currencySymbol
    )}. Die nachfolgenden Positionen zeigen den zugrunde liegenden Auftragsumfang.`
  : isFinalInvoiceWithPartials
? Number(invoice?.open_partial_amount ?? 0) > 0 &&
  Number(invoice?.paid_partial_amount ?? 0) > 0
  ? "Mit dieser Schlussrechnung rechnen wir den Auftrag vollständig ab. Bereits geleistete Abschlagszahlungen werden vom Gesamtauftragswert abgezogen. Noch offene Abschlagsrechnungen gehen in dieser Schlussrechnung auf."
  : Number(invoice?.open_partial_amount ?? 0) > 0
  ? "Mit dieser Schlussrechnung rechnen wir den Auftrag vollständig ab. Die noch offene Abschlagsrechnung geht in dieser Schlussrechnung auf und wird nicht zusätzlich zur Schlussrechnung fällig."
  : "Mit dieser Schlussrechnung rechnen wir den Auftrag vollständig ab. Die bereits geleistete Abschlagszahlung wird vom Gesamtauftragswert abgezogen."
: companySettings?.invoice_intro_text ||
    "Vielen Dank für Ihren Auftrag. Wir stellen Ihnen folgende Leistungen in Rechnung.";

  const introLines = doc.splitTextToSize(
    introText,
    pageWidth - marginLeft - marginRight
  );

  doc.text(introLines, marginLeft, y);
  y += introLines.length * 5 + 6;

  // Positionen / Summen
   const tableRows = isCancellation
    ? [["-", `Storno der Rechnung ${cancelsRef?.invoice_number ?? ""}`.trim(), "1,00", formatMoney(invoice?.subtotal, currencySymbol), formatMoney(invoice?.subtotal, currencySymbol)]]
    : invoiceItems.length > 0
      ? invoiceItems.map((item: any) => {
          const quantity = Number(item.quantity ?? 0);
          const unitPrice = Number(item.unit_price ?? 0);
          const total = Number(item.total_price ?? item.line_total ?? quantity * unitPrice);

          const parts = String(item.title ?? "").split("–");
          const area =
            parts.length > 1 ? parts[0].trim() : item.area_name ?? "-";

          const title =
            parts.length > 1
              ? parts.slice(1).join("–").trim()
              : item.title ?? "-";

          return [
            area,
            title,
            `${quantity.toLocaleString("de-DE", {
              minimumFractionDigits: 2,
              maximumFractionDigits: 2,
            })} ${item.unit ?? ""}`.trim(),
            formatMoney(unitPrice, currencySymbol),
            formatMoney(total, currencySymbol),
          ];
        })
      : [["-", "Keine Positionen gefunden", "-", "-", "-"]];

  autoTable(doc, {
    startY: y,
    head: [["Bereich", "Leistung", "Menge", "Einzelpreis", "Gesamt"]],
    body: tableRows,
    styles: {
      fontSize: 8,
      cellPadding: 2.2,
      overflow: "linebreak",
    },
    headStyles: {
      fillColor: [45, 45, 45],
      textColor: [255, 255, 255],
      fontStyle: "bold",
    },
    alternateRowStyles: {
      fillColor: [245, 245, 245],
    },
    columnStyles: {
      0: { cellWidth: 34 },
      1: { cellWidth: 70 },
      2: { cellWidth: 25, halign: "right" },
      3: { cellWidth: 28, halign: "right" },
      4: { cellWidth: 28, halign: "right" },
    },
    margin: {
      left: marginLeft,
      right: marginRight,
    },
  });

  const finalY = (doc as any).lastAutoTable?.finalY ?? y + 20;
  y = finalY + 14;

  // Zahlungsblock
  if (y > 230) {
    doc.addPage();
    y = 30;
  }

  const labelX = 120;
const valueX = 196;

doc.setFontSize(9);
doc.setFont("helvetica", "normal");

if (isPartialInvoice && !isCancellation) {
  const baseAmount = Number(invoice?.base_amount ?? 0);
  const partialAmount = Number(invoice?.total_amount ?? 0);
  const remainingAmount = Math.max(baseAmount - partialAmount, 0);

  doc.text("Auftragswert:", labelX, y);
  doc.text(formatMoney(baseAmount, currencySymbol), valueX, y, {
    align: "right",
  });

  y += 7;

  const partialLabel =
    invoice?.partial_type === "percent"
      ? `Abschlag ${Number(invoice?.partial_value ?? 0).toLocaleString(
          "de-DE",
          {
            maximumFractionDigits: 2,
          }
        )} %:`
      : "Abschlag:";

  doc.text(partialLabel, labelX, y);
  doc.text(
    `- ${formatMoney(partialAmount, currencySymbol)}`,
    valueX,
    y,
    {
      align: "right",
    }
  );

  y += 7;

  doc.setFont("helvetica", "bold");
  doc.text("Verbleibender Auftragswert:", labelX, y);
  doc.text(formatMoney(remainingAmount, currencySymbol), valueX, y, {
    align: "right",
  });

  y += 12;
  doc.setFont("helvetica", "normal");
}

if (isFinalInvoiceWithPartials && !isCancellation) {
  const baseAmount = Number(invoice?.base_amount ?? 0);
  const paidPartialAmount = Number(invoice?.paid_partial_amount ?? 0);
  const openPartialAmount = Number(invoice?.open_partial_amount ?? 0);

  doc.text("Gesamt-Auftragswert:", labelX, y);
  doc.text(formatMoney(baseAmount, currencySymbol), valueX, y, {
    align: "right",
  });

  y += 7;

  const paidPartials = partialInvoices.filter(
    (partial: any) => partial.status === "paid"
  );

  for (const partial of paidPartials) {
    doc.text(
      `Bezahlt ${partial.invoice_number}:`,
      labelX,
      y
    );

    doc.text(
      `- ${formatMoney(partial.total_amount, currencySymbol)}`,
      valueX,
      y,
      { align: "right" }
    );

    y += 7;
  }

  const includedPartials = partialInvoices.filter(
    (partial: any) => partial.status === "credited"
  );

  for (const partial of includedPartials) {
    doc.text(
  `${partial.invoice_number} (übernommen):`,
  labelX,
  y
);

    doc.text(
      formatMoney(partial.total_amount, currencySymbol),
      valueX,
      y,
      { align: "right" }
    );

    y += 7;
  }

  if (paidPartials.length === 0 && paidPartialAmount > 0) {
    doc.text("Bereits bezahlt:", labelX, y);
    doc.text(
      `- ${formatMoney(paidPartialAmount, currencySymbol)}`,
      valueX,
      y,
      { align: "right" }
    );
    y += 7;
  }

  if (includedPartials.length === 0 && openPartialAmount > 0) {
    doc.text(
      "Offener Abschlag – in Schlussrechnung übernommen:",
      labelX,
      y
    );
    doc.text(
      formatMoney(openPartialAmount, currencySymbol),
      valueX,
      y,
      { align: "right" }
    );
    y += 7;
  }

  y += 5;
}

doc.text(
  isPartialInvoice ? "Netto Abschlagsrechnung:" : "Netto:",
  labelX,
  y
);

doc.text(formatMoney(invoice?.subtotal, currencySymbol), valueX, y, {
  align: "right",
});

y += 7;

if (frozen && invoice?.reverse_charge) {
  doc.text(country === "AT" ? "USt. (Reverse Charge):" : "USt. (§ 13b UStG):", labelX, y);
  doc.text("entfällt", valueX, y, { align: "right" });
} else {
  doc.text(
    `MwSt. ${Number(invoice?.tax_rate ?? 0).toFixed(2)} %:`,
    labelX,
    y
  );

  doc.text(formatMoney(invoice?.tax_amount, currencySymbol), valueX, y, {
    align: "right",
  });
}

y += 9;

doc.setFontSize(12);
doc.setFont("helvetica", "bold");

doc.text(isCancellation ? "Gesamt (Storno):" : "Zu zahlen:", labelX, y);

doc.text(formatMoney(invoice?.total_amount, currencySymbol), valueX, y, {
  align: "right",
});

// Pflichthinweise (§ 13b / § 35a / § 14b)
const notes = frozen ? legalNotes(invoice, country, currencySymbol) : [];
if (notes.length) {
  y += 12;
  doc.setFont("helvetica", "normal");
  doc.setFontSize(8);
  for (const note of notes) {
    const lines = doc.splitTextToSize(note, pageWidth - marginLeft - marginRight);
    if (y + lines.length * 4 > 270) {
      doc.addPage();
      y = 30;
    }
    doc.text(lines, marginLeft, y);
    y += lines.length * 4 + 2;
  }
}

  // Seitenfuß
  const pageCount = doc.getNumberOfPages();

  const footerLeft = [
    companyName,
    ...companyAddressLine,
    ...companyContactLine,
  ].filter(Boolean);

  const footerCenter = [
    companySettings?.website || "",
    companySettings?.tax_number
      ? `Steuernummer: ${companySettings.tax_number}`
      : "",
    companySettings?.vat_id ? `${frozen ? vatIdLabel(country) : "MwSt-Nr."}: ${companySettings.vat_id}` : "",
  ].filter(Boolean);

  const footerRight = [
    companySettings?.bank_name || "",
    companySettings?.iban ? `IBAN: ${companySettings.iban}` : "",
    companySettings?.bic ? `BIC: ${companySettings.bic}` : "",
  ].filter(Boolean);

  for (let i = 1; i <= pageCount; i += 1) {
    doc.setPage(i);

    doc.setDrawColor(180);
    doc.line(marginLeft, 276, pageWidth - marginRight, 276);

    doc.setFont("helvetica", "normal");
    doc.setFontSize(7);
    doc.setTextColor(90);

    if (footerLeft.length) {
      doc.text(footerLeft, marginLeft, 281);
    }

    if (footerCenter.length) {
      doc.text(footerCenter, pageWidth / 2, 281, {
        align: "center",
      });
    }

    if (footerRight.length) {
      doc.text(footerRight, pageWidth - marginRight, 281, {
        align: "right",
      });
    }

    doc.setFontSize(7);
    doc.text(`Seite ${i} von ${pageCount}`, pageWidth - marginRight, 292, {
      align: "right",
    });

    doc.setTextColor(0);
  }

  doc.save(`${isCancellation ? "Stornorechnung" : "Rechnung"}-${invoiceNumber}.pdf`);
}