// Aufmaß per Sprache: Aufnahme an den Server schicken und Ergebnis ins Formular übernehmen
import { supabase, supabaseUrl } from "../../lib/supabase";
import type { SiteVisitFormState, SiteVisitRoomForm } from "./types";

export type VoiceOpening = { count: number; width_m: number | null; height_m: number | null; type?: string };
export type VoiceRoom = {
  name: string;
  length_m: number | null;
  width_m: number | null;
  height_m: number | null;
  manual_wall_area_sqm: number | null;
  paint_ceiling: boolean | null;
  wall_coats: number;
  ceiling_coats: number;
  notes: string;
  windows: VoiceOpening[];
  doors: VoiceOpening[];
  radiators: VoiceOpening[];
};
export type VoiceData = { rooms: VoiceRoom[]; services: { title: string; hours: number; description: string }[]; general_notes: string };
export type VoiceResponse = { ok: boolean; error?: string; transcript?: string; data?: VoiceData; used?: number; limit?: number };

export async function sendDictation(audio: Blob): Promise<VoiceResponse> {
  const { data } = await supabase.auth.getSession();
  const token = data.session?.access_token;
  if (!token) return { ok: false, error: "Bitte melden Sie sich erneut an." };
  const ext = audio.type.includes("mp4") || audio.type.includes("aac") ? "m4a" : audio.type.includes("ogg") ? "ogg" : "webm";
  const fd = new FormData();
  fd.append("audio", audio, `aufmass.${ext}`);
  try {
    const res = await fetch(`${supabaseUrl}/functions/v1/aufmass-voice`, { method: "POST", headers: { Authorization: `Bearer ${token}` }, body: fd });
    const json = (await res.json().catch(() => null)) as VoiceResponse | null;
    return json ?? { ok: false, error: "Die Antwort des Servers war unvollständig. Bitte noch einmal versuchen." };
  } catch {
    return { ok: false, error: "Keine Verbindung zum Server. Bitte prüfen Sie Ihre Internetverbindung." };
  }
}

/** Zahl → Formularwert mit Komma ("2,5") */
const de = (n: number | null | undefined) => (n == null ? "" : String(n).replace(".", ","));

/** Erkannte Räume, Öffnungen und Arbeiten an das Formular anhängen (bestehende Einträge bleiben) */
export function mergeVoice(prev: SiteVisitFormState, data: VoiceData, nextId: () => number): { next: SiteVisitFormState; firstRoomId: number | null } {
  const rooms: SiteVisitRoomForm[] = [];
  const windows = [...prev.windows];
  const doors = [...prev.doors];
  const radiators = [...prev.radiators];
  for (const r of data.rooms) {
    const id = nextId();
    rooms.push({
      temp_id: id,
      room_name: r.name || "",
      length_m: de(r.length_m),
      width_m: de(r.width_m),
      height_m: de(r.height_m),
      notes: r.notes || "",
      paint_ceiling: r.paint_ceiling ?? true,
      manual_wall_area_sqm: de(r.manual_wall_area_sqm),
      wall_coats: r.wall_coats || 1,
      ceiling_coats: r.ceiling_coats || 1,
    });
    for (const w of r.windows) windows.push({ temp_id: nextId(), room_temp_id: id, count_items: String(w.count || 1), width_m: de(w.width_m), height_m: de(w.height_m), notes: "" });
    for (const d of r.doors) doors.push({ temp_id: nextId(), room_temp_id: id, count_items: String(d.count || 1), width_m: de(d.width_m), height_m: de(d.height_m), frame_included: true, notes: "" });
    for (const h of r.radiators) radiators.push({ temp_id: nextId(), room_temp_id: id, count_items: String(h.count || 1), width_m: de(h.width_m), height_m: de(h.height_m), radiator_type: h.type || "", notes: "" });
  }
  // leere Platzhalter-Räume (ohne Namen und Maße) durch das Diktat ersetzen
  const keep = prev.rooms.filter((x) => x.room_name.trim() || x.length_m || x.width_m || x.height_m || x.manual_wall_area_sqm || x.notes.trim());
  const services = [
    ...prev.custom_services,
    ...data.services.map((s) => ({ temp_id: nextId(), title: s.title, description: s.description || "", hours: de(s.hours) })),
  ];
  const notes = data.general_notes ? [prev.notes.trim(), data.general_notes].filter(Boolean).join("\n") : prev.notes;
  return {
    next: { ...prev, rooms: [...keep, ...rooms], windows, doors, radiators, custom_services: services, notes },
    firstRoomId: rooms[0]?.temp_id ?? null,
  };
}
