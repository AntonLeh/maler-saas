// Reine Logik der KI-Belegerkennung (ohne Datenbank) – damit sie sich einfach testen lässt.

export const CATEGORIES = ["material", "werkzeug", "fahrzeug", "subunternehmer", "miete", "versicherung", "buero", "sonstiges"] as const;
export const PAYMENTS = ["bar", "karte", "ueberweisung", "lastschrift", "paypal"] as const;

export const SYSTEM_PROMPT = `Du liest Belege (Kassenbons, Quittungen, Eingangsrechnungen) für die Buchhaltung eines Malerbetriebs in Deutschland, Österreich oder der Schweiz.
Lies die Angaben genau so ab, wie sie auf dem Beleg stehen. Rate nichts: Was du nicht sicher lesen kannst, lässt du weg.
Rufe am Ende IMMER das Werkzeug „beleg_daten“ mit den gefundenen Angaben auf.

Regeln:
- receipt_date: Belegdatum (Rechnungs- bzw. Kaufdatum) im Format JJJJ-MM-TT.
- supplier: Name des Verkäufers/Lieferanten (z. B. „Bauhaus“, „Brillux GmbH“, „Aral“), ohne Adresse.
- gross_amount: Endbetrag inkl. Steuer (Gesamt/Summe/zu zahlen) als Zahl mit Punkt, z. B. 119.95.
- tax_rate: der Steuersatz in Prozent, wenn auf dem Beleg nur EIN Satz vorkommt (z. B. 19, 7, 20, 10, 13, 8.1, 2.6, 0). Kommen mehrere Sätze vor, lass tax_rate weg und gib in tax_amount die Summe aller Steuerbeträge an.
- tax_amount: ausgewiesene Steuer (MwSt./USt.) gesamt, falls lesbar.
- category: material (Farbe, Lacke, Tapete, Spachtel, Abdeckmaterial, Baustoffe), werkzeug (Werkzeug, Geräte, Leitern, Maschinen), fahrzeug (Tanken, Werkstatt, Parken, Maut), subunternehmer, miete, versicherung, buero (Büro, Telefon, Software, Porto), sonstiges.
- description: kurze Beschreibung in 2–8 Wörtern, was gekauft wurde (z. B. „Dispersionsfarbe und Abdeckfolie“).
- payment_method: bar, karte, ueberweisung, lastschrift oder paypal – nur wenn auf dem Beleg erkennbar (z. B. „EC-Karte“, „Bar“).
- Ist das Bild kein Beleg oder unlesbar, setze not_a_receipt auf true.`;

export const TOOL = {
  name: "beleg_daten",
  description: "Die vom Beleg abgelesenen Angaben zurückgeben",
  input_schema: {
    type: "object",
    properties: {
      not_a_receipt: { type: "boolean" },
      receipt_date: { type: "string", description: "JJJJ-MM-TT" },
      supplier: { type: "string" },
      gross_amount: { type: "number" },
      tax_rate: { type: "number" },
      tax_amount: { type: "number" },
      category: { type: "string", enum: [...CATEGORIES] },
      description: { type: "string" },
      payment_method: { type: "string", enum: [...PAYMENTS] },
    },
  },
};

const num = (v: unknown): number | null => {
  const n = typeof v === "number" ? v : Number(String(v ?? "").replace(/[^\d.,-]/g, "").replace(/\.(?=\d{3}(\D|$))/g, "").replace(",", "."));
  return Number.isFinite(n) ? Math.round(n * 100) / 100 : null;
};

/** Werkzeug-Ausgabe prüfen und säubern – nur plausible Werte gehen an das Formular */
export function cleanResult(input: any): { ok: true; data: Record<string, unknown> } | { ok: false; error: string } {
  if (!input || typeof input !== "object") return { ok: false, error: "Die KI konnte den Beleg nicht lesen." };
  if (input.not_a_receipt === true) return { ok: false, error: "Auf dem Bild ist kein lesbarer Beleg zu erkennen." };
  const out: Record<string, unknown> = {};
  const date = String(input.receipt_date ?? "").trim();
  if (/^\d{4}-\d{2}-\d{2}$/.test(date)) {
    const d = new Date(`${date}T12:00:00Z`);
    const now = Date.now();
    // nicht in der Zukunft (1 Tag Toleranz) und nicht älter als 11 Jahre
    if (!Number.isNaN(d.getTime()) && d.getTime() <= now + 86_400_000 && d.getTime() >= now - 11 * 365 * 86_400_000) out.receipt_date = date;
  }
  const supplier = String(input.supplier ?? "").replace(/\s+/g, " ").trim().slice(0, 120);
  if (supplier) out.supplier = supplier;
  const gross = num(input.gross_amount);
  if (gross !== null && gross >= 0 && gross < 1_000_000) out.gross_amount = gross; // 0 € erlaubt (z. B. Gutschrift/kostenloser Monat – nur zur Aufbewahrung)
  const rate = num(input.tax_rate);
  if (rate !== null && rate >= 0 && rate <= 30) out.tax_rate = rate;
  const tax = num(input.tax_amount);
  if (tax !== null && tax >= 0 && (gross === null || tax <= gross)) out.tax_amount = tax;
  if (CATEGORIES.includes(input.category)) out.category = input.category;
  const desc = String(input.description ?? "").replace(/\s+/g, " ").trim().slice(0, 200);
  if (desc) out.description = desc;
  if (PAYMENTS.includes(input.payment_method)) out.payment_method = input.payment_method;
  if (!Object.keys(out).length) return { ok: false, error: "Die KI konnte auf dem Beleg nichts sicher lesen. Bitte die Angaben selbst eintragen." };
  return { ok: true, data: out };
}

export function mediaTypeFor(path: string, blobType = ""): string | null {
  const t = blobType.toLowerCase();
  if (["image/jpeg", "image/png", "image/webp", "application/pdf"].includes(t)) return t;
  const ext = path.toLowerCase().split(".").pop();
  return ext === "jpg" || ext === "jpeg" ? "image/jpeg" : ext === "png" ? "image/png" : ext === "webp" ? "image/webp" : ext === "pdf" ? "application/pdf" : null;
}

export function toolInput(content: any[]): any {
  const t = (Array.isArray(content) ? content : []).find((c) => c?.type === "tool_use" && c?.name === "beleg_daten");
  return t?.input ?? null;
}

/** Bytes -> Base64 (in Stücken, damit große Dateien den Stapel nicht sprengen) */
export function encodeBase64(bytes: Uint8Array): string {
  let bin = "";
  for (let i = 0; i < bytes.length; i += 0x8000) bin += String.fromCharCode(...bytes.subarray(i, i + 0x8000));
  return btoa(bin);
}
