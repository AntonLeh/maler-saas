import { jsPDF } from "jspdf";

type ReminderPdfParams = {
  reminder: any;
  invoice: any;
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

  if (Number.isNaN(date.getTime())) {
    return "-";
  }

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

const getReminderTitle = (level: number) => {
  switch (level) {
    case 1:
      return "1. MAHNUNG";

    case 2:
      return "2. MAHNUNG";

    case 3:
      return "3. MAHNUNG";

    default:
      return "MAHNUNG";
  }
};

const getReminderIntro = (level: number) => {
  switch (level) {
    case 1:
      return (
        "Bei der Prüfung unserer offenen Forderungen haben wir festgestellt, " +
        "dass die unten aufgeführte Rechnung noch nicht beglichen wurde. " +
        "Möglicherweise wurde die Zahlung lediglich übersehen."
      );

    case 2:
      return (
        "Trotz unserer ersten Mahnung konnten wir bislang keinen Zahlungseingang " +
        "für die unten aufgeführte Rechnung feststellen. Wir bitten Sie daher, " +
        "den noch offenen Betrag innerhalb der neuen Zahlungsfrist zu begleichen."
      );

    case 3:
      return (
        "Trotz unserer bisherigen Mahnungen ist die unten aufgeführte Rechnung " +
        "weiterhin offen. Wir fordern Sie hiermit nochmals auf, den ausstehenden " +
        "Betrag innerhalb der angegebenen Zahlungsfrist zu begleichen."
      );

    default:
      return (
        "Die unten aufgeführte Rechnung ist weiterhin offen. " +
        "Bitte begleichen Sie den ausstehenden Betrag innerhalb der angegebenen Frist."
      );
  }
};

export function generateReminderPdf({
  reminder,
  invoice,
  customer = null,
  companySettings = {},
  currencySymbol = "€",
}: ReminderPdfParams) {
  const doc = new jsPDF("p", "mm", "a4");

  const pageWidth = doc.internal.pageSize.getWidth();

  const marginLeft = 14;
  const marginRight = 14;

  const invoiceNumber = getInvoiceNumber(invoice);
  const reminderLevel = Number(reminder?.reminder_level ?? 1);

  const reminderTitle = getReminderTitle(reminderLevel);

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

  // Logo
  if (companySettings?.logo_url) {
    try {
      doc.addImage(
        companySettings.logo_url,
        "PNG",
        marginLeft,
        8,
        75,
        28
      );
    } catch (error) {
      console.warn(
        "Logo konnte nicht in die Mahnungs-PDF eingefügt werden:",
        error
      );
    }
  }

  // Dokumenttitel
  doc.setFontSize(24);
  doc.setFont("helvetica", "bold");

  doc.text(
    reminderTitle,
    pageWidth - marginRight,
    18,
    {
      align: "right",
    }
  );

  doc.setFont("helvetica", "normal");
  doc.setFontSize(9);

  doc.text(
    `Rechnung: ${invoiceNumber}`,
    pageWidth - marginRight,
    27,
    {
      align: "right",
    }
  );

  doc.text(
    `Mahndatum: ${formatDate(reminder?.reminder_date)}`,
    pageWidth - marginRight,
    33,
    {
      align: "right",
    }
  );

  doc.text(
    `Neue Frist: ${formatDate(reminder?.new_due_date)}`,
    pageWidth - marginRight,
    39,
    {
      align: "right",
    }
  );

  // Linie
  doc.setLineWidth(0.3);

  doc.line(
    marginLeft,
    46,
    pageWidth - marginRight,
    46
  );

  // Empfänger
  doc.setFontSize(10);
  doc.setFont("helvetica", "bold");

  doc.text(
    "Empfänger",
    marginLeft,
    58
  );

  doc.setFont("helvetica", "normal");
  doc.setFontSize(9);

  const customerName =
    customer?.company_name ||
    `${customer?.first_name ?? ""} ${
      customer?.last_name ?? ""
    }`.trim() ||
    customer?.name ||
    invoice?.customer_name ||
    `Kunde-ID: ${invoice?.customer_id ?? "-"}`;

  const billingAddressLines = [
    customerName,
    customer?.street ??
      customer?.address ??
      invoice?.customer_street ??
      "",
    `${
      customer?.zip ??
      customer?.postal_code ??
      invoice?.customer_zip ??
      ""
    } ${
      customer?.city ??
      invoice?.customer_city ??
      ""
    }`.trim(),
  ].filter(Boolean);

  doc.text(
    billingAddressLines.length > 0
      ? billingAddressLines
      : ["-"],
    marginLeft,
    66
  );

  // Betreff
  let y = 96;

  doc.setFontSize(12);
  doc.setFont("helvetica", "bold");

  doc.text(
    `${reminderLevel}. Mahnung zur Rechnung ${invoiceNumber}`,
    marginLeft,
    y
  );

  y += 10;

  doc.setFontSize(9);
  doc.setFont("helvetica", "normal");

  const introText = getReminderIntro(reminderLevel);

  const introLines = doc.splitTextToSize(
    introText,
    pageWidth - marginLeft - marginRight
  );

  doc.text(
    introLines,
    marginLeft,
    y
  );

  y += introLines.length * 5 + 10;

  // Rechnungsdaten
  doc.setFont("helvetica", "bold");
  doc.setFontSize(10);

  doc.text(
    "Offene Rechnung",
    marginLeft,
    y
  );

  y += 9;

  doc.setFont("helvetica", "normal");
  doc.setFontSize(9);

  const labelX = marginLeft;
  const valueX = 78;

  doc.text(
    "Rechnungsnummer:",
    labelX,
    y
  );

  doc.text(
    String(invoiceNumber),
    valueX,
    y
  );

  y += 7;

  doc.text(
    "Rechnungsdatum:",
    labelX,
    y
  );

  doc.text(
    formatDate(
      invoice?.invoice_date ??
        invoice?.created_at
    ),
    valueX,
    y
  );

  y += 7;

  doc.text(
    "Ursprünglich fällig:",
    labelX,
    y
  );

  doc.text(
    formatDate(invoice?.due_date),
    valueX,
    y
  );

  y += 7;

  doc.text(
    "Mahndatum:",
    labelX,
    y
  );

  doc.text(
    formatDate(reminder?.reminder_date),
    valueX,
    y
  );

  y += 7;

  doc.setFont("helvetica", "bold");

  doc.text(
    "Neues Zahlungsziel:",
    labelX,
    y
  );

  doc.text(
    formatDate(reminder?.new_due_date),
    valueX,
    y
  );

  // Betrag
  y += 18;

  doc.setLineWidth(0.2);

  doc.line(
    marginLeft,
    y,
    pageWidth - marginRight,
    y
  );

  y += 12;

  doc.setFontSize(12);
  doc.setFont("helvetica", "bold");

  doc.text(
    "Offener Betrag:",
    marginLeft,
    y
  );

  doc.text(
    formatMoney(
      invoice?.total_amount,
      currencySymbol
    ),
    pageWidth - marginRight,
    y,
    {
      align: "right",
    }
  );

  y += 14;

  doc.setFontSize(9);
  doc.setFont("helvetica", "normal");

  const paymentText =
    `Bitte überweisen Sie den offenen Betrag bis spätestens ` +
    `${formatDate(reminder?.new_due_date)} auf das unten angegebene Konto.`;

  const paymentLines = doc.splitTextToSize(
    paymentText,
    pageWidth - marginLeft - marginRight
  );

  doc.text(
    paymentLines,
    marginLeft,
    y
  );

  y += paymentLines.length * 5 + 8;

  const crossingText =
    "Sollte sich Ihre Zahlung mit dieser Mahnung überschnitten haben, betrachten Sie dieses Schreiben bitte als gegenstandslos.";

  const crossingLines = doc.splitTextToSize(
    crossingText,
    pageWidth - marginLeft - marginRight
  );

  doc.text(
    crossingLines,
    marginLeft,
    y
  );

  // Bankdaten
  if (
    companySettings?.bank_name ||
    companySettings?.iban ||
    companySettings?.bic
  ) {
    y += crossingLines.length * 5 + 14;

    doc.setFont("helvetica", "bold");
    doc.setFontSize(10);

    doc.text(
      "Bankverbindung",
      marginLeft,
      y
    );

    y += 8;

    doc.setFont("helvetica", "normal");
    doc.setFontSize(9);

    if (companySettings?.bank_name) {
      doc.text(
        `Bank: ${companySettings.bank_name}`,
        marginLeft,
        y
      );

      y += 6;
    }

    if (companySettings?.iban) {
      doc.text(
        `IBAN: ${companySettings.iban}`,
        marginLeft,
        y
      );

      y += 6;
    }

    if (companySettings?.bic) {
      doc.text(
        `BIC: ${companySettings.bic}`,
        marginLeft,
        y
      );
    }
  }

  // Seitenfuß
  doc.setDrawColor(180);

  doc.line(
    marginLeft,
    276,
    pageWidth - marginRight,
    276
  );

  doc.setFont("helvetica", "normal");
  doc.setFontSize(7);
  doc.setTextColor(90);

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
    companySettings?.iban
      ? `IBAN: ${companySettings.iban}`
      : "",
    companySettings?.bic
      ? `BIC: ${companySettings.bic}`
      : "",
  ].filter(Boolean);

  if (footerLeft.length) {
    doc.text(
      footerLeft,
      marginLeft,
      281
    );
  }

  if (footerCenter.length) {
    doc.text(
      footerCenter,
      pageWidth / 2,
      281,
      {
        align: "center",
      }
    );
  }

  if (footerRight.length) {
    doc.text(
      footerRight,
      pageWidth - marginRight,
      281,
      {
        align: "right",
      }
    );
  }

  doc.setFontSize(7);

  doc.text(
    "Seite 1 von 1",
    pageWidth - marginRight,
    292,
    {
      align: "right",
    }
  );

  doc.setTextColor(0);

  // Dateiname
  doc.save(
    `${reminderLevel}-Mahnung-${invoiceNumber}.pdf`
  );
}