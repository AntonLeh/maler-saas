// Stand der Rechtstexte – wird auf den Seiten angezeigt und bei der Registrierung als Nachweis gespeichert.
// Bei einer Änderung des Textes hier das Datum anpassen (Format TT.MM.JJJJ wird auf den Seiten ausgeschrieben).
export const LEGAL_VERSIONS = {
  agb: "2026-09-13",
  avv: "2026-11-08",
  datenschutz: "2026-11-13",
} as const;

const MONTHS = ["Januar", "Februar", "März", "April", "Mai", "Juni", "Juli", "August", "September", "Oktober", "November", "Dezember"];
/** "2026-11-07" → "7. November 2026" */
export const standText = (iso: string) => {
  const [y, m, d] = iso.split("-").map(Number);
  return `${d}. ${MONTHS[m - 1]} ${y}`;
};
