// Rechnungsdateien erzeugen: ZUGFeRD-PDF (Standard für neue Rechnungen) und XRechnung (XML)
import { generateInvoicePdf } from "./invoicePdf";
import { buildCii, eInvoiceIssues, type EInvoiceIssue } from "./einvoice";
import { loadPdfFonts, toZugferdPdf } from "./zugferd";

/* eslint-disable @typescript-eslint/no-explicit-any */

export type InvoicePdfResult = { blob: Blob; zugferd: boolean; issues: EInvoiceIssue[] };

const fileBase = (invoice: any) =>
  `${invoice?.document_type === "cancellation" ? "Stornorechnung" : "Rechnung"}-${String(invoice?.invoice_number ?? invoice?.id ?? "")
    .replace(/[\\/:*?"<>|]+/g, "-")
    .trim()}`;

/** PDF der Rechnung; neue Rechnungen (mit eingefrorenen Angaben) als ZUGFeRD (PDF/A-3 mit eingebetteten Rechnungsdaten) */
export async function buildInvoicePdf(invoice: any, sources: any): Promise<InvoicePdfResult> {
  const issues = invoice?.snapshot ? eInvoiceIssues(invoice, "en16931") : [];
  if (invoice?.snapshot && issues.length === 0) {
    try {
      const fonts = await loadPdfFonts();
      const ab = generateInvoicePdf({ invoice, ...sources, output: "arraybuffer", fonts }) as ArrayBuffer;
      const company = invoice.snapshot.company ?? {};
      const bytes = await toZugferdPdf(ab, buildCii(invoice, "en16931"), {
        title: `${invoice.document_type === "cancellation" ? "Stornorechnung" : "Rechnung"} ${invoice.invoice_number}`,
        author: String(company.company_name ?? ""),
      });
      return { blob: new Blob([bytes as BlobPart], { type: "application/pdf" }), zugferd: true, issues };
    } catch (e) {
      console.error("ZUGFeRD konnte nicht erstellt werden – normales PDF", e);
      issues.push({ field: "zugferd", message: "Die E-Rechnungsdaten konnten technisch nicht eingebettet werden." });
    }
  }
  const blob = generateInvoicePdf({ invoice, ...sources, output: "blob" }) as Blob;
  return { blob, zugferd: false, issues };
}

function download(blob: Blob, name: string) {
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = name;
  document.body.appendChild(a);
  a.click();
  a.remove();
  setTimeout(() => URL.revokeObjectURL(url), 30000);
}

/** PDF herunterladen; gibt zurück, ob es eine E-Rechnung (ZUGFeRD) ist und was ggf. fehlte */
export async function downloadInvoicePdf(invoice: any, sources: any): Promise<InvoicePdfResult> {
  const res = await buildInvoicePdf(invoice, sources);
  download(res.blob, `${fileBase(invoice)}.pdf`);
  return res;
}

/** XRechnung (XML) herunterladen – wirft eine Meldung mit den fehlenden Angaben */
export function downloadXRechnung(invoice: any) {
  const issues = eInvoiceIssues(invoice, "xrechnung");
  if (issues.length) {
    throw new Error(`Die XRechnung kann noch nicht erstellt werden:\n\n• ${issues.map((i) => i.message).join("\n• ")}`);
  }
  const xml = buildCii(invoice, "xrechnung");
  download(new Blob([xml], { type: "application/xml" }), `XRechnung-${fileBase(invoice).replace(/^Rechnung-/, "").replace(/^Stornorechnung-/, "Storno-")}.xml`);
}

/** Text für den Hinweis, wenn eine Firmenrechnung ohne E-Rechnungsdaten erstellt wurde */
export function zugferdHint(res: InvoicePdfResult, invoice: any): string | null {
  if (res.zugferd || !invoice?.snapshot || invoice?.is_private_customer) return null;
  return `Die Rechnung wurde als normales PDF erstellt (ohne E-Rechnungsdaten), weil Angaben fehlen:\n\n• ${res.issues
    .map((i) => i.message)
    .join("\n• ")}\n\nAb 2027/2028 müssen Rechnungen an Firmen E-Rechnungen sein.`;
}
