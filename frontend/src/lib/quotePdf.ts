import { jsPDF } from "jspdf";
import autoTable from "jspdf-autotable";

type QuotePdfParams = {
  quoteDetail: any;
  quoteItems: any[];
  companySettings: any;
  currencySymbol: string;
  customers?: any[];
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

const getCustomerName = (customer: any) => {
  if (!customer) return "-";

  if (customer.company_name) return customer.company_name;

  const fullName = `${customer.first_name ?? ""} ${
    customer.last_name ?? ""
  }`.trim();

  return fullName || customer.name || "-";
};

const getCustomerAddressLines = (customer: any) => {
  if (!customer) return ["-"];

  return [
    getCustomerName(customer),
    customer.street ?? customer.address ?? "",
    `${customer.zip ?? customer.postal_code ?? ""} ${
      customer.city ?? ""
    }`.trim(),
  ].filter(Boolean);
};

const getQuoteNumber = (quoteDetail: any) => {
  return (
    quoteDetail?.quote_number ??
    quoteDetail?.offer_number ??
    quoteDetail?.number ??
    quoteDetail?.id ??
    "-"
  );
};

const getItemTotal = (item: any) => {
  const quantity = Number(item.quantity ?? item.qty ?? 0);
  const unitPrice = Number(item.unit_price ?? item.price ?? 0);

  return Number(
    item.total_price ??
      item.line_total ??
      item.total ??
      item.amount ??
      quantity * unitPrice
  );
};

export function generateQuotePdf({
  quoteDetail,
  quoteItems,
  companySettings,
  currencySymbol,
  customers = [],
}: QuotePdfParams) {
  const doc = new jsPDF("p", "mm", "a4");

  const pageWidth = doc.internal.pageSize.getWidth();
  const marginLeft = 14;
  const marginRight = 14;

  const customer =
    quoteDetail?.customer ??
    quoteDetail?.customers ??
    quoteDetail?.customer_data ??
    customers.find((customer) => customer.id === quoteDetail?.customer_id) ??
    null;

  const quoteNumber = getQuoteNumber(quoteDetail);

  const companyName =
    companySettings?.company_name ??
    companySettings?.companyName ??
    companySettings?.name ??
    companySettings?.firma ??
    "Malerbetrieb";

  const companyAddressLine = [
    companySettings?.street ??
      companySettings?.company_street ??
      companySettings?.address_street ??
      "",
    `${companySettings?.zip ??
      companySettings?.company_zip ??
      companySettings?.address_zip ??
      ""} ${
      companySettings?.city ??
      companySettings?.company_city ??
      companySettings?.address_city ??
      ""
    }`.trim(),
  ].filter(Boolean);

  const companyContactLine = [
    companySettings?.phone ?? companySettings?.company_phone ?? "",
    companySettings?.email ?? companySettings?.company_email ?? "",
  ].filter(Boolean);

  const billingAddressLines = getCustomerAddressLines(customer);

  const orderAddressLines = [
    quoteDetail?.address_street ??
      quoteDetail?.object_street ??
      quoteDetail?.site_street ??
      "",
    `${quoteDetail?.address_zip ??
      quoteDetail?.object_zip ??
      quoteDetail?.site_zip ??
      ""} ${
      quoteDetail?.address_city ??
      quoteDetail?.object_city ??
      quoteDetail?.site_city ??
      ""
    }`.trim(),
  ].filter(Boolean);

  doc.setFont("helvetica", "normal");

  // Firma oben
  // Firma oben mit optionalem Logo
// Logo oben links
if (companySettings?.logo_url) {
  try {
    doc.addImage(companySettings.logo_url, "PNG", marginLeft, 8, 75, 28);
  } catch (error) {
    console.warn("Logo konnte nicht in die PDF eingefügt werden:", error);
  }
}

  // Dokumenttitel rechts
  doc.setFontSize(24);
  doc.setFont("helvetica", "bold");
  doc.text("ANGEBOT", pageWidth - marginRight, 18, { align: "right" });

  doc.setFont("helvetica", "normal");
  doc.setFontSize(9);
  doc.text(`Nr.: ${quoteNumber}`, pageWidth - marginRight, 27, {
    align: "right",
  });
  doc.text(
    `Datum: ${formatDate(quoteDetail?.quote_date ?? quoteDetail?.created_at)}`,
    pageWidth - marginRight,
    33,
    { align: "right" }
  );
  doc.text(
    `Gültig bis: ${formatDate(quoteDetail?.valid_until)}`,
    pageWidth - marginRight,
    39,
    { align: "right" }
  );

  // Linie
  doc.setLineWidth(0.3);
  doc.line(marginLeft, 46, pageWidth - marginRight, 46);

  // Adressen
  doc.setFontSize(10);
  doc.setFont("helvetica", "bold");
  doc.text("Rechnungsadresse", marginLeft, 58);

  doc.setFont("helvetica", "normal");
  doc.setFontSize(9);
  doc.text(billingAddressLines, marginLeft, 66);

  doc.setFontSize(10);
  doc.setFont("helvetica", "bold");
  doc.text("Auftragsadresse", 112, 58);

  doc.setFont("helvetica", "normal");
  doc.setFontSize(9);
  doc.text(orderAddressLines.length > 0 ? orderAddressLines : ["-"], 112, 66);

  // Titel / Beschreibung
  let y = 92;

  doc.setFontSize(12);
  doc.setFont("helvetica", "bold");
  doc.text(quoteDetail?.title ?? "Angebot", marginLeft, y);

  y += 7;

  if (quoteDetail?.description) {
    doc.setFont("helvetica", "normal");
    doc.setFontSize(9);
    const descriptionLines = doc.splitTextToSize(
      quoteDetail.description,
      pageWidth - marginLeft - marginRight
    );
    const introText =
  companySettings?.quote_intro_text ||
  "Vielen Dank für Ihre Anfrage. Wir freuen uns, Ihnen folgendes Angebot unterbreiten zu dürfen.";

const introLines = doc.splitTextToSize(introText, 180);

doc.setFont("helvetica", "normal");
doc.setFontSize(9);
doc.text(introLines, marginLeft, y);

y += introLines.length * 5 + 0;
  }

  // Positionen
  const tableRows = (quoteItems ?? []).map((item) => {
    const quantity = Number(item.quantity ?? item.qty ?? 0);
    const unitPrice = Number(item.unit_price ?? item.price ?? 0);
    const total = getItemTotal(item);

    const parts = String(item.title ?? "").split("–");
    const area = parts.length > 1 ? parts[0].trim() : item.area_name ?? "-";
    const title =
      parts.length > 1 ? parts.slice(1).join("–").trim() : item.title ?? "-";

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
  });

  autoTable(doc, {
    startY: y,
    head: [["Bereich", "Leistung", "Menge", "Einzelpreis", "Gesamt"]],
    body:
      tableRows.length > 0
        ? tableRows
        : [["-", "Keine Positionen vorhanden", "-", "-", "-"]],
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
    margin: { left: marginLeft, right: marginRight },
  });

  const finalY = (doc as any).lastAutoTable?.finalY ?? y + 20;
  y = finalY + 12;

  const subtotal = Number(quoteDetail?.subtotal ?? 0);
  const discountAmount = Number(quoteDetail?.discount_amount ?? 0);
  const subtotalAfterDiscount = Number(
    quoteDetail?.subtotal_after_discount ?? subtotal - discountAmount
  );
  const taxRate = Number(quoteDetail?.tax_rate ?? 0);
  const taxAmount = Number(quoteDetail?.tax_amount ?? 0);
  const totalAmount = Number(quoteDetail?.total_amount ?? 0);

  if (y > 240) {
    doc.addPage();
    y = 30;
  }

  const labelX = 120;
  const valueX = 196;

  doc.setFontSize(9);
  doc.setFont("helvetica", "normal");

  doc.text("Netto vor Rabatt:", labelX, y);
  doc.text(formatMoney(subtotal, currencySymbol), valueX, y, {
    align: "right",
  });

  if (discountAmount > 0) {
    y += 7;

    const discountLabel =
      quoteDetail?.discount_type === "percent"
        ? `Rabatt (${Number(quoteDetail?.discount_value ?? 0).toFixed(2)} %):`
        : "Rabatt:";

    doc.text(discountLabel, labelX, y);
    doc.text(`- ${formatMoney(discountAmount, currencySymbol)}`, valueX, y, {
      align: "right",
    });

    y += 7;
    doc.text("Netto nach Rabatt:", labelX, y);
    doc.text(formatMoney(subtotalAfterDiscount, currencySymbol), valueX, y, {
      align: "right",
    });
  }

  y += 7;
  doc.text(`MwSt. ${taxRate.toFixed(2)} %:`, labelX, y);
  doc.text(formatMoney(taxAmount, currencySymbol), valueX, y, {
    align: "right",
  });

  y += 9;
  doc.setFontSize(12);
  doc.setFont("helvetica", "bold");
  doc.text("Brutto:", labelX, y);
  doc.text(formatMoney(totalAmount, currencySymbol), valueX, y, {
    align: "right",
  });

  // Hinweis unten
  // Texte unter dem Angebot
y += 18;

if (y > 245) {
  doc.addPage();
  y = 30;
}

doc.setFont("helvetica", "normal");
doc.setFontSize(8);

const footerText =
  companySettings?.quote_footer_text ||
  "Vielen Dank für Ihre Anfrage. Wir freuen uns auf die Zusammenarbeit.";

const footerTextLines = doc.splitTextToSize(footerText, 180);
doc.text(footerTextLines, marginLeft, y);

y += footerTextLines.length *  5 + 6;

if (companySettings?.quote_terms_text) {
  if (y > 250) {
    doc.addPage();
    y = 30;
  }

  doc.setFont("helvetica", "bold");
  doc.text("Hinweise / Bedingungen", marginLeft, y);

  y += 6;

  doc.setFont("helvetica", "normal");
  const termsLines = doc.splitTextToSize(companySettings.quote_terms_text, 180);
  doc.text(termsLines, marginLeft, y);
}

  // Seitenfuß
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
  companySettings?.vat_id
    ? `MwSt-Nr.: ${companySettings.vat_id}`
    : "",
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

  doc.save(`Angebot-${quoteNumber}.pdf`);
}