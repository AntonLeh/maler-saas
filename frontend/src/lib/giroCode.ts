// GiroCode (EPC-QR-Code, „Scan2Pay“): Banking-App scannen → Überweisung ist ausgefüllt.
// Standard: European Payments Council, EPC069-12 (Version 002, UTF-8). Nur für Euro-Überweisungen (SEPA).

import QRCode from "qrcode";
import type { jsPDF } from "jspdf";

const clean = (v: unknown) => String(v ?? "").replace(/\s+/g, " ").trim();

/** Inhalt des GiroCodes – oder null, wenn keiner möglich ist (keine IBAN, kein Euro, nichts zu zahlen) */
export function epcPayload(p: { name: unknown; iban: unknown; bic?: unknown; amount: number; currency?: string; reference: unknown }): string | null {
  const iban = clean(p.iban).replace(/\s/g, "").toUpperCase();
  const name = clean(p.name).slice(0, 70);
  const amount = Math.round((Number(p.amount) || 0) * 100) / 100;
  if ((p.currency ?? "EUR") !== "EUR") return null;
  if (!/^[A-Z]{2}\d{2}[A-Z0-9]{11,30}$/.test(iban) || !name) return null;
  if (!(amount >= 0.01 && amount <= 999999999.99)) return null;
  const bic = clean(p.bic).replace(/\s/g, "").toUpperCase();
  const text = clean(p.reference).slice(0, 140);
  return ["BCD", "002", "1", "SCT", /^[A-Z0-9]{8}([A-Z0-9]{3})?$/.test(bic) ? bic : "", name, iban, `EUR${amount.toFixed(2)}`, "", "", text].join("\n");
}

/** Zeichnet den QR-Code als Vektorgrafik (keine Bilddatei, gestochen scharf beim Druck) */
export function drawGiroCode(doc: jsPDF, payload: string, x: number, y: number, size: number) {
  const qr = QRCode.create(payload, { errorCorrectionLevel: "M" });
  const n = qr.modules.size;
  const quiet = 2; // Ruhezone in Modulen
  const m = size / (n + quiet * 2);
  doc.setFillColor(255, 255, 255);
  doc.rect(x, y, size, size, "F");
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
      // leicht überlappen, damit keine feinen Lücken zwischen den Feldern entstehen
      doc.rect(x + (quiet + c) * m, y + (quiet + r) * m, len * m + 0.01, m + 0.01, "F");
      c += len;
    }
  }
}
