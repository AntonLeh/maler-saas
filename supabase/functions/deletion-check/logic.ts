// Löschfristen: wer bekommt eine Vorwarnung (7 Tage vorher), wer ist fällig

export type DueRow = {
  tenant_id: number;
  company_name: string;
  email: string | null;
  reason: string | null;
  ended_at: string;
  due_at: string;
  warned_at: string | null;
};

export const WARN_DAYS = 7;
const DAY = 86400000;

export const fmtDate = (iso: string) => {
  const d = new Date(iso);
  return `${String(d.getUTCDate()).padStart(2, "0")}.${String(d.getUTCMonth() + 1).padStart(2, "0")}.${d.getUTCFullYear()}`;
};

/** Vorwarnung nötig: Löschung in höchstens 7 Tagen, noch nicht fällig, noch nicht gewarnt (oder Frist hat sich verschoben) */
export function needsWarning(r: DueRow, warnedDueAt: string | null, now = Date.now()): boolean {
  const due = new Date(r.due_at).getTime();
  if (!r.email) return false;
  if (due - now > WARN_DAYS * DAY) return false;
  if (due <= now) return false;
  return !warnedDueAt || Math.abs(new Date(warnedDueAt).getTime() - due) > DAY;
}

export const isDue = (r: DueRow, now = Date.now()) => new Date(r.due_at).getTime() <= now;

export function warningMail(r: DueRow) {
  const due = fmtDate(r.due_at);
  const ended = fmtDate(r.ended_at);
  const why = r.reason === "Abo beendet" ? `Ihr Abo bei MalerSaaS ist am ${ended} ausgelaufen.` : `Ihre kostenlose Testphase bei MalerSaaS ist am ${ended} abgelaufen.`;
  const subject = `Ihre Daten bei MalerSaaS werden am ${due} gelöscht`;
  const text = `Guten Tag,

${why} Wie in unseren AGB (Punkt 21) beschrieben, werden die Daten Ihres Betriebs 30 Tage danach endgültig gelöscht – das ist am ${due}.

Sie möchten MalerSaaS weiter nutzen?
Melden Sie sich an und wählen Sie unter „Tarife“ ein Abo. Dann bleiben alle Daten erhalten.

Sie möchten nicht weitermachen?
Bitte sichern Sie vorher Ihre Daten: anmelden → „Einstellungen“ → „Alle Daten exportieren“. Sie erhalten eine ZIP-Datei mit Kunden, Aufträgen, Angeboten, Rechnungen und Belegen. Denken Sie an Ihre gesetzlichen Aufbewahrungspflichten für Rechnungen und Belege.

Bei Fragen antworten Sie einfach auf diese E-Mail.

Mit freundlichen Grüßen
Ihr MalerSaaS-Team`;
  return { subject, text };
}
