import { jsPDF } from "jspdf";
import autoTable from "jspdf-autotable";

type InvoicePdfParams = {
  invoice: any;
  invoiceItems?: any[];
  order?: any;
  customer?: any;
  companySettings?: any;
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
  currencySymbol = "€",
}: InvoicePdfParams) {
  const doc = new jsPDF("p", "mm", "a4");

  const pageWidth = doc.internal.pageSize.getWidth();
  const marginLeft = 14;
  const marginRight = 14;

  const invoiceNumber = getInvoiceNumber(invoice);

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
      doc.addImage(companySettings.logo_url, "PNG", marginLeft, 8, 75, 28);
    } catch (error) {
      console.warn("Logo konnte nicht in die PDF eingefügt werden:", error);
    }
  }

  // Dokumenttitel rechts
  doc.setFontSize(24);
  doc.setFont("helvetica", "bold");
  doc.text("RECHNUNG", pageWidth - marginRight, 18, { align: "right" });

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
  doc.text(
    `Fällig bis: ${formatDate(invoice?.due_date)}`,
    pageWidth - marginRight,
    39,
    { align: "right" }
  );

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

  doc.text(
    orderAddressLines.length > 0
      ? orderAddressLines
      : [`Auftrag-ID: ${invoice?.order_id ?? "-"}`],
    112,
    66
  );

  // Einleitung
  let y = 92;

  doc.setFontSize(12);
  doc.setFont("helvetica", "bold");
  doc.text(`Rechnung ${invoiceNumber}`, marginLeft, y);

  y += 8;

  doc.setFont("helvetica", "normal");
  doc.setFontSize(9);

  const introText =
    companySettings?.invoice_intro_text ||
    "Vielen Dank für Ihren Auftrag. Wir stellen Ihnen folgende Leistungen in Rechnung.";

  const introLines = doc.splitTextToSize(
    introText,
    pageWidth - marginLeft - marginRight
  );

  doc.text(introLines, marginLeft, y);
  y += introLines.length * 5 + 6;

  // Positionen / Summen
   const tableRows =
    invoiceItems.length > 0
      ? invoiceItems.map((item: any) => {
          const quantity = Number(item.quantity ?? 0);
          const unitPrice = Number(item.unit_price ?? 0);
          const total = Number(item.total_price ?? quantity * unitPrice);

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

  doc.text("Netto:", labelX, y);
  doc.text(formatMoney(invoice?.subtotal, currencySymbol), valueX, y, {
    align: "right",
  });

  y += 7;
  doc.text(`MwSt. ${Number(invoice?.tax_rate ?? 0).toFixed(2)} %:`, labelX, y);
  doc.text(formatMoney(invoice?.tax_amount, currencySymbol), valueX, y, {
    align: "right",
  });

  y += 9;
  doc.setFontSize(12);
  doc.setFont("helvetica", "bold");
  doc.text("Zu zahlen:", labelX, y);
  doc.text(formatMoney(invoice?.total_amount, currencySymbol), valueX, y, {
    align: "right",
  });

  // Fußtext
  y += 18;

  if (y > 245) {
    doc.addPage();
    y = 30;
  }

  doc.setFont("helvetica", "normal");
  doc.setFontSize(8);

  const footerText =
    companySettings?.invoice_footer_text ||
    "Bitte überweisen Sie den Rechnungsbetrag innerhalb der angegebenen Zahlungsfrist.";

  const footerTextLines = doc.splitTextToSize(footerText, 180);
  doc.text(footerTextLines, marginLeft, y);

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
    companySettings?.vat_id ? `MwSt-Nr.: ${companySettings.vat_id}` : "",
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

  doc.save(`Rechnung-${invoiceNumber}.pdf`);
}