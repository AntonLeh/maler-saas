// Prüfung von IBAN (Prüfziffer nach ISO 13616) und BIC – leer ist erlaubt

const IBAN_LENGTH: Record<string, number> = { DE: 22, AT: 20, CH: 21, LI: 21, ES: 24, FR: 27, IT: 27, NL: 18, BE: 16, LU: 20, PL: 28, CZ: 24, DK: 18, PT: 25 };

/** Fehlermeldung oder null */
export function ibanError(value: string): string | null {
  const iban = value.replace(/\s+/g, "").toUpperCase();
  if (!iban) return null;
  if (!/^[A-Z]{2}\d{2}[A-Z0-9]{10,30}$/.test(iban)) return "Die IBAN hat ein ungültiges Format (z. B. DE89 3704 0044 0532 0130 00).";
  const len = IBAN_LENGTH[iban.slice(0, 2)];
  if (len && iban.length !== len) return `Eine IBAN aus ${iban.slice(0, 2)} hat ${len} Zeichen – eingegeben sind ${iban.length}.`;
  const moved = iban.slice(4) + iban.slice(0, 4);
  let rest = 0;
  for (const ch of moved) {
    const digits = /\d/.test(ch) ? ch : String(ch.charCodeAt(0) - 55);
    for (const d of digits) rest = (rest * 10 + Number(d)) % 97;
  }
  if (rest !== 1) return "Die IBAN ist nicht korrekt (Prüfziffer stimmt nicht) – bitte auf Tippfehler prüfen.";
  return null;
}

export function bicError(value: string): string | null {
  const bic = value.replace(/\s+/g, "").toUpperCase();
  if (!bic) return null;
  if (!/^[A-Z]{4}[A-Z]{2}[A-Z0-9]{2}([A-Z0-9]{3})?$/.test(bic)) return "Die BIC ist ungültig – sie hat 8 oder 11 Zeichen (z. B. COBADEFFXXX).";
  return null;
}
