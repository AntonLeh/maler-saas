// Schweizer QR-Rechnung (Zahlteil mit Empfangsschein) nach den
// Implementation Guidelines QR-Rechnung v2.3/2.4 (SIX) – nur strukturierte Adressen (Typ „S“).
// Gilt für Betriebe in der Schweiz/Liechtenstein mit CH/LI-IBAN, Währung CHF oder EUR.

import QRCode from "qrcode";
import type { jsPDF } from "jspdf";

export type QrAddress = { name: string; street: string; houseNo: string; zip: string; city: string; country: string };

export type QrBillData = {
  iban: string;
  creditor: QrAddress;
  amount: number | null;
  currency: "CHF" | "EUR";
  debtor: QrAddress | null;
  refType: "QRR" | "SCOR" | "NON";
  reference: string;
  message: string;
};

const clean = (v: unknown, max: number) =>
  String(v ?? "")
    .replace(/[\r\n\t]+/g, " ")
    .replace(/\s+/g, " ")
    .trim()
    .slice(0, max);

/** „Musterstrasse 4a“ → Strasse und Hausnummer getrennt (für strukturierte Adressen) */
export function splitStreet(v: unknown): { street: string; houseNo: string } {
  const s = clean(v, 120);
  const m = s.match(/^(.*?)[\s,]+(\d+\s?[a-zA-Z]?(?:\s?[-/]\s?\d+\s?[a-zA-Z]?)?)$/);
  if (m && m[1]) return { street: clean(m[1], 70), houseNo: clean(m[2].replace(/\s+/g, ""), 16) };
  return { street: clean(s, 70), houseNo: "" };
}

export const ibanOf = (v: unknown) => String(v ?? "").replace(/\s+/g, "").toUpperCase();

/** QR-IBAN (Institut-ID 30000–31999) – verlangt eine QR-Referenz */
export function isQrIban(iban: string): boolean {
  if (!/^(CH|LI)\d{7}/.test(iban)) return false;
  const iid = Number(iban.slice(4, 9));
  return iid >= 30000 && iid <= 31999;
}

/** QR-Referenz: 26 Ziffern + Prüfziffer (Modulo 10 rekursiv) */
export function qrReference(numeric: string): string {
  const digits = numeric.replace(/\D/g, "").slice(-26).padStart(26, "0");
  const table = [0, 9, 4, 6, 8, 2, 7, 1, 3, 5];
  let carry = 0;
  for (const d of digits) carry = table[(carry + Number(d)) % 10];
  return digits + String((10 - carry) % 10);
}

const mod97 = (s: string) => {
  let rest = 0;
  for (const ch of s) {
    const v = /\d/.test(ch) ? ch : String(ch.charCodeAt(0) - 55);
    for (const d of v) rest = (rest * 10 + Number(d)) % 97;
  }
  return rest;
};

/** Creditor Reference nach ISO 11649 („RF…“), z. B. aus der Rechnungsnummer */
export function creditorReference(text: string): string {
  const body = text.toUpperCase().replace(/[^A-Z0-9]/g, "").slice(-21) || "0";
  const check = 98 - mod97(`${body}RF00`);
  return `RF${String(check).padStart(2, "0")}${body}`;
}

export function isValidCreditorReference(ref: string): boolean {
  const r = ref.replace(/\s/g, "").toUpperCase();
  return /^RF\d{2}[A-Z0-9]{1,21}$/.test(r) && mod97(r.slice(4) + r.slice(0, 4)) === 1;
}

function addressLines(a: QrAddress | null): string[] {
  if (!a) return ["", "", "", "", "", "", ""];
  return ["S", clean(a.name, 70), clean(a.street, 70), clean(a.houseNo, 16), clean(a.zip, 16), clean(a.city, 35), clean(a.country, 2).toUpperCase()];
}

/** Inhalt des Swiss QR Codes */
export function qrBillPayload(d: QrBillData): string {
  return [
    "SPC",
    "0200",
    "1",
    ibanOf(d.iban),
    ...addressLines(d.creditor),
    ...addressLines(null), // endgültiger Zahlungsempfänger: nicht verwendet
    d.amount != null ? d.amount.toFixed(2) : "",
    d.currency,
    ...addressLines(d.debtor),
    d.refType,
    d.refType === "NON" ? "" : d.reference.replace(/\s/g, ""),
    clean(d.message, 140),
    "EPD",
  ].join("\r\n");
}

/** Prüft die Daten – null = in Ordnung, sonst Grund */
export function qrBillProblem(d: QrBillData): string | null {
  const iban = ibanOf(d.iban);
  if (!/^(CH|LI)\d{19}$/.test(iban)) return "Für die QR-Rechnung wird eine Schweizer oder Liechtensteiner IBAN benötigt.";
  if (mod97(iban.slice(4) + iban.slice(0, 4)) !== 1) return "Die IBAN ist nicht korrekt.";
  if (!d.creditor.name || !d.creditor.zip || !d.creditor.city || !d.creditor.country) return "Firmenname und Adresse sind unvollständig.";
  if (isQrIban(iban) && d.refType !== "QRR") return "Eine QR-IBAN braucht eine QR-Referenz.";
  if (!isQrIban(iban) && d.refType === "QRR") return "Eine QR-Referenz geht nur mit einer QR-IBAN.";
  if (d.amount != null && !(d.amount >= 0.01 && d.amount <= 999999999.99)) return "Betrag ausserhalb des erlaubten Bereichs.";
  return null;
}

// ---------- Darstellung ----------

const groupIban = (iban: string) => ibanOf(iban).replace(/(.{4})/g, "$1 ").trim();
export const formatReference = (type: QrBillData["refType"], ref: string) => {
  const r = ref.replace(/\s/g, "");
  if (type === "QRR") return `${r.slice(0, 2)} ${r.slice(2).replace(/(.{5})/g, "$1 ").trim()}`;
  return r.replace(/(.{4})/g, "$1 ").trim();
};
const formatAmount = (n: number) => {
  const [int, dec] = n.toFixed(2).split(".");
  return `${int.replace(/\B(?=(\d{3})+(?!\d))/g, " ")}.${dec}`;
};
const pt = (p: number) => p * 0.3528; // Punkt → mm

function corners(doc: jsPDF, x: number, y: number, w: number, h: number) {
  const l = 3;
  doc.setLineWidth(0.2);
  doc.setDrawColor(0);
  doc.lines([[l, 0]], x, y);
  doc.lines([[0, l]], x, y);
  doc.lines([[-l, 0]], x + w, y);
  doc.lines([[0, l]], x + w, y);
  doc.lines([[l, 0]], x, y + h);
  doc.lines([[0, -l]], x, y + h);
  doc.lines([[-l, 0]], x + w, y + h);
  doc.lines([[0, -l]], x + w, y + h);
}

function drawQr(doc: jsPDF, payload: string, x: number, y: number, size: number) {
  const qr = QRCode.create(payload, { errorCorrectionLevel: "M" });
  const n = qr.modules.size;
  const m = size / n;
  doc.setFillColor(0, 0, 0);
  for (let r = 0; r < n; r += 1) {
    let c = 0;
    while (c < n) {
      if (!qr.modules.get(r, c)) {
        c += 1;
        continue;
      }
      let len = 1;
      while (c + len < n && qr.modules.get(r, c + len)) len += 1;
      doc.rect(x + c * m, y + r * m, len * m + 0.01, m + 0.01, "F");
      c += len;
    }
  }
  // Schweizerkreuz 7 × 7 mm in der Mitte
  const cx = x + size / 2;
  const cy = y + size / 2;
  doc.setFillColor(255, 255, 255);
  doc.rect(cx - 3.5, cy - 3.5, 7, 7, "F");
  doc.setFillColor(0, 0, 0);
  doc.rect(cx - 3.1, cy - 3.1, 6.2, 6.2, "F");
  doc.setFillColor(255, 255, 255);
  const arm = 6.2 * (20 / 32);
  const w = 6.2 * (6 / 32);
  doc.rect(cx - w / 2, cy - arm / 2, w, arm, "F");
  doc.rect(cx - arm / 2, cy - w / 2, arm, w, "F");
}

/** Zeichnet Empfangsschein + Zahlteil unten auf die aktuelle Seite (A4, unterste 105 mm) */
export function drawQrBill(doc: jsPDF, d: QrBillData, font: string) {
  const top = 297 - 105;
  const payload = qrBillPayload(d);

  // Trennlinien + Hinweis
  doc.setDrawColor(0);
  doc.setLineWidth(0.2);
  doc.setLineDashPattern([1, 1], 0);
  doc.line(0, top, 210, top);
  doc.line(62, top, 62, 297);
  doc.setLineDashPattern([], 0);
  doc.setFont(font, "normal");
  doc.setFontSize(7);
  doc.setTextColor(0);
  doc.text("Vor der Einzahlung abzutrennen", 105, top - 1.5, { align: "center" });

  const debtorLines = d.debtor
    ? [d.debtor.name, [d.debtor.street, d.debtor.houseNo].filter(Boolean).join(" "), `${d.debtor.zip} ${d.debtor.city}`.trim()].filter(Boolean)
    : [];
  const creditorLines = [
    groupIban(d.iban),
    d.creditor.name,
    [d.creditor.street, d.creditor.houseNo].filter(Boolean).join(" "),
    `${d.creditor.zip} ${d.creditor.city}`.trim(),
  ].filter(Boolean);

  // ---------- Empfangsschein (links, 62 mm) ----------
  let x = 5;
  let y = top + 5;
  doc.setFont(font, "bold");
  doc.setFontSize(11);
  doc.text("Empfangsschein", x, y + pt(11));
  y += 7;
  const recHead = (t: string) => {
    doc.setFont(font, "bold");
    doc.setFontSize(6);
    y += pt(9);
    doc.text(t, x, y);
  };
  const recLines = (lines: string[]) => {
    doc.setFont(font, "normal");
    doc.setFontSize(8);
    for (const l of lines) {
      for (const part of doc.splitTextToSize(l, 52) as string[]) {
        y += pt(9);
        doc.text(part, x, y);
      }
    }
    y += pt(9);
  };
  recHead("Konto / Zahlbar an");
  recLines(creditorLines);
  if (d.refType !== "NON") {
    recHead("Referenz");
    recLines([formatReference(d.refType, d.reference)]);
  }
  if (debtorLines.length) {
    recHead("Zahlbar durch");
    recLines(debtorLines);
  } else {
    recHead("Zahlbar durch (Name/Adresse)");
    corners(doc, x, y + 1, 52, 20);
  }
  // Betrag
  y = top + 68;
  doc.setFont(font, "bold");
  doc.setFontSize(6);
  doc.text("Währung", x, y);
  doc.text("Betrag", x + 12, y);
  doc.setFont(font, "normal");
  doc.setFontSize(8);
  doc.text(d.currency, x, y + pt(11));
  if (d.amount != null) doc.text(formatAmount(d.amount), x + 12, y + pt(11));
  else corners(doc, x + 22, y - 2, 30, 10);
  doc.setFont(font, "bold");
  doc.setFontSize(6);
  doc.text("Annahmestelle", 57, top + 82, { align: "right" });

  // ---------- Zahlteil (rechts) ----------
  x = 67;
  doc.setFont(font, "bold");
  doc.setFontSize(11);
  doc.text("Zahlteil", x, top + 5 + pt(11));
  drawQr(doc, payload, x, top + 17, 46);
  y = top + 68;
  doc.setFont(font, "bold");
  doc.setFontSize(8);
  doc.text("Währung", x, y);
  doc.text("Betrag", x + 14, y);
  doc.setFont(font, "normal");
  doc.setFontSize(10);
  doc.text(d.currency, x, y + pt(13));
  if (d.amount != null) doc.text(formatAmount(d.amount), x + 14, y + pt(13));
  else corners(doc, x + 14, y + 2, 40, 15);

  x = 118;
  y = top + 5;
  const payHead = (t: string) => {
    doc.setFont(font, "bold");
    doc.setFontSize(8);
    y += pt(11);
    doc.text(t, x, y);
  };
  const payLines = (lines: string[]) => {
    doc.setFont(font, "normal");
    doc.setFontSize(10);
    for (const l of lines) {
      for (const part of doc.splitTextToSize(l, 87) as string[]) {
        y += pt(11);
        doc.text(part, x, y);
      }
    }
    y += pt(11);
  };
  payHead("Konto / Zahlbar an");
  payLines(creditorLines);
  if (d.refType !== "NON") {
    payHead("Referenz");
    payLines([formatReference(d.refType, d.reference)]);
  }
  if (d.message) {
    payHead("Zusätzliche Informationen");
    payLines([d.message]);
  }
  if (debtorLines.length) {
    payHead("Zahlbar durch");
    payLines(debtorLines);
  } else {
    payHead("Zahlbar durch (Name/Adresse)");
    corners(doc, x, y + 1, 65, 25);
  }
}
