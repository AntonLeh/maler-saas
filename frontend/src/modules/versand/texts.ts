// Vorschläge für Betreff und Text der E-Mails (im Dialog änderbar)
/* eslint-disable @typescript-eslint/no-explicit-any */

const money = (v: unknown, symbol = "€") =>
  `${Math.abs(Number(v) || 0).toLocaleString("de-DE", { minimumFractionDigits: 2, maximumFractionDigits: 2 })} ${symbol}`;
const date = (v: unknown) => {
  const s = String(v ?? "").slice(0, 10);
  return /^\d{4}-\d{2}-\d{2}$/.test(s) ? `${s.slice(8, 10)}.${s.slice(5, 7)}.${s.slice(0, 4)}` : "";
};

export function greeting(customer: any, isPrivate: boolean | null | undefined): string {
  const name = `${customer?.first_name ?? ""} ${customer?.last_name ?? ""}`.replace(/\s+/g, " ").trim();
  if (isPrivate !== false && name) return `Guten Tag ${name},`;
  return "Sehr geehrte Damen und Herren,";
}

export function invoiceMail(p: { invoice: any; customer: any; companyName: string; symbol?: string; cancelledNumber?: string | null }) {
  const { invoice, customer, companyName, symbol } = p;
  const nr = invoice.invoice_number;
  const hello = greeting(customer, invoice.is_private_customer);
  const bye = `Mit freundlichen Grüßen\n${companyName}`;
  if (invoice.document_type === "cancellation") {
    return {
      subject: `Stornorechnung ${nr}${companyName ? ` – ${companyName}` : ""}`,
      text: `${hello}\n\nanbei erhalten Sie die Stornorechnung ${nr}${p.cancelledNumber ? ` zur Rechnung ${p.cancelledNumber}` : ""}. Die ursprüngliche Rechnung ist damit aufgehoben.\n\n${bye}`,
    };
  }
  const what = invoice.invoice_type === "partial" ? "Abschlagsrechnung" : "Rechnung";
  const due = date(invoice.due_date);
  const pay = invoice.reverse_charge
    ? ""
    : `Bitte überweisen Sie den Betrag${due ? ` bis zum ${due}` : ""} auf das in der Rechnung angegebene Konto – am einfachsten mit dem GiroCode auf der Rechnung (mit der Banking-App scannen).\n\n`;
  return {
    subject: `${what} ${nr}${companyName ? ` – ${companyName}` : ""}`,
    text: `${hello}\n\nanbei erhalten Sie unsere ${what} ${nr} vom ${date(invoice.invoice_date)} über ${money(invoice.total_amount, symbol)}.\n\n${pay}Vielen Dank für Ihren Auftrag!\n\n${bye}`,
  };
}

export function reminderMail(p: { invoice: any; reminder: any; customer: any; companyName: string; symbol?: string }) {
  const { invoice, reminder, customer, companyName, symbol } = p;
  const level = Number(reminder?.reminder_level) || 1;
  const nr = invoice.invoice_number;
  const until = date(reminder?.new_due_date);
  const intro =
    level === 1
      ? `bei der Prüfung unserer offenen Forderungen haben wir festgestellt, dass unsere Rechnung ${nr} vom ${date(invoice.invoice_date)} über ${money(invoice.total_amount, symbol)} noch nicht beglichen wurde. Möglicherweise wurde die Zahlung nur übersehen.`
      : level === 2
      ? `trotz unserer ersten Mahnung konnten wir für unsere Rechnung ${nr} vom ${date(invoice.invoice_date)} über ${money(invoice.total_amount, symbol)} bislang keinen Zahlungseingang feststellen.`
      : `trotz unserer bisherigen Mahnungen ist unsere Rechnung ${nr} vom ${date(invoice.invoice_date)} über ${money(invoice.total_amount, symbol)} weiterhin offen.`;
  return {
    subject: `${level}. Mahnung zur Rechnung ${nr}${companyName ? ` – ${companyName}` : ""}`,
    text: `${greeting(customer, invoice.is_private_customer)}\n\n${intro}\n\nBitte überweisen Sie den offenen Betrag${until ? ` bis zum ${until}` : " umgehend"}. Die Mahnung finden Sie im Anhang.\n\nSollten Sie die Zahlung bereits veranlasst haben, betrachten Sie diese E-Mail bitte als gegenstandslos.\n\nMit freundlichen Grüßen\n${companyName}`,
  };
}

export function quoteMail(p: { quote: any; customer: any; companyName: string; symbol?: string }) {
  const { quote, customer, companyName, symbol } = p;
  const nr = quote.quote_number || "";
  const isPrivate = !(customer?.is_business ?? !!String(customer?.company_name ?? "").trim());
  const valid = date(quote.valid_until);
  return {
    subject: `Angebot ${nr}${companyName ? ` – ${companyName}` : ""}`.replace(/\s+/g, " ").trim(),
    text:
      `${greeting(customer, isPrivate)}\n\n` +
      `vielen Dank für Ihre Anfrage. Anbei erhalten Sie unser Angebot ${nr} über ${money(quote.total_amount, symbol)} (brutto).` +
      `${valid ? ` Das Angebot ist gültig bis zum ${valid}.` : ""}\n\n` +
      `Bei Fragen melden Sie sich gerne. Wir freuen uns auf Ihren Auftrag!\n\n` +
      `Mit freundlichen Grüßen\n${companyName}`,
  };
}
