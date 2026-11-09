// Auftrag bearbeiten: reine Hilfsfunktionen (testbar)

export type AssignmentLite = { user_id: number | string; assignment_role: string };

/** Welche Zuteilungen müssen gelöscht / neu angelegt werden? (statt „alles löschen, alles neu“) */
export function diffAssignments(
  current: AssignmentLite[],
  projectManagerId: number | null,
  employeeIds: number[]
) {
  const key = (userId: number | string, role: string) => `${Number(userId)}|${role}`;
  const desired = new Map<string, { user_id: number; assignment_role: string }>();
  if (projectManagerId) desired.set(key(projectManagerId, "project_manager"), { user_id: projectManagerId, assignment_role: "project_manager" });
  for (const id of employeeIds) {
    if (id === projectManagerId) continue;
    desired.set(key(id, "employee"), { user_id: id, assignment_role: "employee" });
  }
  const existing = new Set(current.map((a) => key(a.user_id, a.assignment_role)));
  const toDelete = current.filter((a) => !desired.has(key(a.user_id, a.assignment_role)));
  const toInsert = [...desired.entries()].filter(([k]) => !existing.has(k)).map(([, v]) => v);
  return { toDelete, toInsert };
}

export type OrderFormLite = {
  customer_id: string;
  title: string;
  start_date: string;
  end_date: string;
};

/** Prüft das Formular. Gibt eine Meldung zurück oder null. */
export function validateOrderForm(form: OrderFormLite): string | null {
  if (!form.customer_id) return "Bitte einen Kunden auswählen.";
  if (!form.title.trim()) return "Bitte einen Auftragstitel eingeben.";
  if (form.start_date && form.end_date && form.end_date < form.start_date)
    return "Das Enddatum liegt vor dem Startdatum. Bitte prüfen.";
  return null;
}

/** Verständliche Fehlermeldung statt Datenbank-Text */
export function orderErrorText(err: unknown, fallback: string) {
  const msg = String((err as { message?: string })?.message ?? err ?? "").toLowerCase();
  if (msg.includes("row-level security") || msg.includes("permission denied"))
    return "Dafür fehlt die Berechtigung. Projektleiter können nur ihre eigenen Aufträge bearbeiten.";
  if (msg.includes("failed to fetch") || msg.includes("network"))
    return "Keine Internetverbindung. Bitte gleich noch einmal versuchen.";
  if (msg.includes("foreign key") || msg.includes("violates"))
    return "Die Daten passen nicht zusammen (z. B. Kunde oder Mitarbeiter wurde gelöscht). Bitte Seite neu laden.";
  return fallback;
}

/** Fingerabdruck des Formulars, um ungespeicherte Änderungen zu erkennen */
export const formSnapshot = (form: object, projectManagerId: string, employeeIds: string[]) =>
  JSON.stringify({ form, projectManagerId, employeeIds: [...employeeIds].sort() });
