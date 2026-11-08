// Automatischer Entwurf des Aufmaßes auf dem Gerät (falls die Seite unerwartet geschlossen wird).
// Fotos können nicht im Entwurf gespeichert werden.

import type { SiteVisitFormState } from "./types";

const PREFIX = "malersaas-aufmass-entwurf";
export type Draft = { savedAt: string; editingId: number | null; form: SiteVisitFormState };

const key = (tenantId: number) => `${PREFIX}-${tenantId}`;

export function readDraft(tenantId: number): Draft | null {
  try {
    const raw = localStorage.getItem(key(tenantId));
    if (!raw) return null;
    const d = JSON.parse(raw) as Draft;
    return d && d.form && Array.isArray(d.form.rooms) ? d : null;
  } catch {
    return null;
  }
}

export function writeDraft(tenantId: number, editingId: number | null, form: SiteVisitFormState) {
  try {
    localStorage.setItem(key(tenantId), JSON.stringify({ savedAt: new Date().toISOString(), editingId, form }));
  } catch {
    // Speicher voll oder gesperrt – dann eben ohne Entwurf
  }
}

export function clearSiteVisitDraft(tenantId: number | null | undefined) {
  if (tenantId == null) return;
  try {
    localStorage.removeItem(key(tenantId));
  } catch {
    // egal
  }
}

/** Hat das Formular Inhalt, der sich zu sichern lohnt? */
export function hasContent(f: SiteVisitFormState): boolean {
  return (
    !!f.customer_id ||
    !!f.title.trim() ||
    !!f.notes.trim() ||
    f.rooms.some((r) => r.room_name.trim() || r.length_m || r.width_m || r.height_m || r.manual_wall_area_sqm || r.notes.trim()) ||
    f.windows.length + f.doors.length + f.radiators.length + f.custom_services.length > 0
  );
}
