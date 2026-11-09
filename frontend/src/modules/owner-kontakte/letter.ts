// Brief als PDF nach DIN 5008 (Form B) – passend für Fensterumschläge DL/C6 und für Pingen (Anschrift links)
import { jsPDF } from "jspdf";
import { addressLines, fill } from "./logic";
import type { Contact } from "./logic";

const SENDER = { name: "Anton Lehmann · MalerSaaS", street: "C/ Muntanya 63", city: "07420 Sa Pobla", country: "Spanien", email: "info@maler-saas.com", web: "maler-saas.com" };

let logoCache: string | null | undefined;
async function logoDataUrl(): Promise<string | null> {
  if (logoCache !== undefined) return logoCache;
  try {
    const res = await fetch("/images/logo.png");
    const blob = await res.blob();
    logoCache = await new Promise<string>((resolve, reject) => {
      const r = new FileReader();
      r.onload = () => resolve(String(r.result));
      r.onerror = reject;
      r.readAsDataURL(blob);
    });
  } catch {
    logoCache = null;
  }
  return logoCache;
}

function page(doc: jsPDF, c: Contact, subject: string, body: string, date: string, logo: string | null) {
  const L = 25; // linker Rand (mm)
  const R = 20;
  const W = 210 - L - R;
  doc.setFont("helvetica", "normal");
  // Kopf: Logo + Absender rechts
  if (logo) doc.addImage(logo, "PNG", 165, 12, 18, 18);
  doc.setFontSize(9);
  doc.setTextColor(15, 23, 42);
  doc.setFont("helvetica", "bold");
  doc.text("MalerSaaS", 125, 36);
  doc.setFont("helvetica", "normal");
  doc.setTextColor(71, 85, 105);
  [SENDER.name.replace(" · MalerSaaS", ""), SENDER.street, `${SENDER.city}, ${SENDER.country}`, SENDER.email, SENDER.web].forEach((l, i) => doc.text(l, 125, 41 + i * 4.2));
  // Anschriftfeld Form B: 20 mm links, 45 mm oben, 85 × 45 mm; Rücksendeangabe oben
  doc.setFontSize(7);
  doc.setTextColor(100, 116, 139);
  doc.text(`${SENDER.name} · ${SENDER.street} · ${SENDER.city} · ${SENDER.country.toUpperCase()}`, 20, 50);
  doc.setDrawColor(203, 213, 225);
  doc.line(20, 51.5, 105, 51.5);
  doc.setFontSize(10.5);
  doc.setTextColor(15, 23, 42);
  addressLines(c).forEach((l, i) => doc.text(l, 20, 60 + i * 4.8));
  // Datum
  doc.setFontSize(10);
  doc.text(`Sa Pobla, ${date}`, 125, 72);
  // Betreff
  doc.setFont("helvetica", "bold");
  doc.setFontSize(11);
  const subj = doc.splitTextToSize(fill(subject, c), W);
  doc.text(subj, L, 103);
  // Text
  doc.setFont("helvetica", "normal");
  doc.setFontSize(10.5);
  let y = 103 + subj.length * 5.2 + 7;
  const text = fill(body, c).replace(/\r/g, "");
  for (const para of text.split(/\n{2,}/)) {
    const lines = doc.splitTextToSize(para.replace(/\n/g, " ").trim(), W);
    if (y + lines.length * 5 > 270) {
      doc.addPage();
      y = 25;
    }
    doc.text(lines, L, y);
    y += lines.length * 5 + 4;
  }
  // Unterschrift
  y += 10;
  doc.text("Anton Lehmann", L, Math.min(y, 275));
  doc.setFontSize(8);
  doc.setTextColor(100, 116, 139);
  doc.text("Anton Lehmann · MalerSaaS · C/ Muntanya 63 · 07420 Sa Pobla · Spanien · info@maler-saas.com · maler-saas.com", 105, 287, { align: "center" });
}

/** Ein PDF mit einem Brief je Kontakt (jeder Brief beginnt auf einer neuen Seite) */
export async function buildLetters(contacts: Contact[], subject: string, body: string, date = new Date()): Promise<Blob> {
  const doc = new jsPDF({ unit: "mm", format: "a4" });
  const logo = await logoDataUrl();
  const d = date.toLocaleDateString("de-DE", { day: "2-digit", month: "2-digit", year: "numeric" });
  contacts.forEach((c, i) => {
    if (i > 0) doc.addPage();
    page(doc, c, subject, body, d, logo);
  });
  return doc.output("blob");
}

export async function blobToBase64(b: Blob): Promise<string> {
  const buf = new Uint8Array(await b.arrayBuffer());
  let s = "";
  for (let i = 0; i < buf.length; i += 0x8000) s += String.fromCharCode(...buf.subarray(i, i + 0x8000));
  return btoa(s);
}
