// Aufmaß per Sprache – Prompt, Werkzeug-Schema und Bereinigung (ohne Netzwerk, testbar)

export const SYSTEM_PROMPT = `Du bist ein Assistent für Malerbetriebe in Deutschland. Ein Maler hat beim Kunden ein Aufmaß diktiert.
Wandle den diktierten Text in strukturierte Daten um und rufe dafür das Werkzeug „aufmass“ auf.

Regeln:
- Jeder genannte Raum/Bereich wird ein Eintrag in "rooms" (z. B. Wohnzimmer, Bad, Flur, Treppenhaus, Fassade). Ohne Namen: name leer lassen.
- Maße immer in Metern als Zahl. Gesprochene Zahlen umrechnen: „zwei fünfzig“ = 2.5, „zwei Meter fünfzig“ = 2.5, „eins zwanzig“ = 1.2, „fünf mal vier“ = Länge 5, Breite 4, „zweihundertfünfzig Zentimeter“ = 2.5.
- „Höhe“ / „hoch“ / „Raumhöhe“ = height_m. Gilt eine Höhe ausdrücklich für alle Räume („alle Räume zwei fünfzig hoch“), trage sie bei jedem Raum ein.
- Fenster, Türen und Heizkörper mit Anzahl und Maßen (Breite × Höhe) dem jeweiligen Raum zuordnen. „Zwei Fenster eins zwanzig mal eins vierzig“ = count 2, width 1.2, height 1.4. Ohne Maße: Maße weglassen.
- paint_ceiling: true, wenn die Decke gestrichen werden soll („Decke mit“, „Decke streichen“). false, wenn ausdrücklich nicht („ohne Decke“, „Decke nicht“). Sonst weglassen.
- wall_coats / ceiling_coats: Anzahl Anstriche 1–3 („zwei Anstriche“, „zweimal streichen“). Gilt „zweimal streichen“ ohne Angabe, dann für die Wände. Sonst weglassen.
- Wird eine Wandfläche direkt genannt („Wandfläche 45 Quadratmeter“), manual_wall_area_sqm setzen.
- Sonstige Hinweise zum Raum (z. B. „vorher spachteln“, „Schimmel an der Außenwand“, „Tapete runter“) kurz in notes.
- Zusätzliche Arbeiten mit Stundenangabe („zwei Stunden abkleben“) in "services" (title, hours). Allgemeine Hinweise ohne Raum in "general_notes".
- Nichts erfinden: Was nicht gesagt wurde, weglassen. Füllwörter, Korrekturen („nein, Moment, fünf zwanzig“) beachten – es gilt die letzte Angabe.
- Ist der Text kein Aufmaß, rufe das Werkzeug mit leerem "rooms" auf.`;

const opening = (extra: Record<string, unknown> = {}) => ({
  type: "array",
  items: {
    type: "object",
    properties: { count: { type: "integer" }, width_m: { type: "number" }, height_m: { type: "number" }, ...extra },
  },
});

export const TOOL = {
  name: "aufmass",
  description: "Die aus dem Diktat erkannten Räume, Maße und Arbeiten zurückgeben",
  input_schema: {
    type: "object",
    properties: {
      rooms: {
        type: "array",
        items: {
          type: "object",
          properties: {
            name: { type: "string" },
            length_m: { type: "number" },
            width_m: { type: "number" },
            height_m: { type: "number" },
            manual_wall_area_sqm: { type: "number" },
            paint_ceiling: { type: "boolean" },
            wall_coats: { type: "integer" },
            ceiling_coats: { type: "integer" },
            notes: { type: "string" },
            windows: opening(),
            doors: opening(),
            radiators: opening({ type: { type: "string" } }),
          },
        },
      },
      services: {
        type: "array",
        items: { type: "object", properties: { title: { type: "string" }, hours: { type: "number" }, description: { type: "string" } } },
      },
      general_notes: { type: "string" },
    },
    required: ["rooms"],
  },
};

export type Opening = { count: number; width_m: number | null; height_m: number | null; type?: string };
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
  windows: Opening[];
  doors: Opening[];
  radiators: Opening[];
};
export type VoiceResult = { rooms: VoiceRoom[]; services: { title: string; hours: number; description: string }[]; general_notes: string };

const num = (v: unknown, min: number, max: number): number | null => {
  const n = typeof v === "string" ? Number(v.replace(",", ".")) : Number(v);
  if (!Number.isFinite(n) || n <= min || n > max) return null;
  return Math.round(n * 100) / 100;
};
const int = (v: unknown, min: number, max: number, dflt: number) => {
  const n = Math.round(Number(v));
  return Number.isFinite(n) && n >= min && n <= max ? n : dflt;
};
const str = (v: unknown, max: number) => String(v ?? "").replace(/\s+/g, " ").trim().slice(0, max);

function openings(list: unknown, withType = false): Opening[] {
  if (!Array.isArray(list)) return [];
  return list.slice(0, 30).map((o: any) => ({
    count: int(o?.count, 1, 50, 1),
    width_m: num(o?.width_m, 0, 20),
    height_m: num(o?.height_m, 0, 20),
    ...(withType ? { type: str(o?.type, 60) } : {}),
  }));
}

export function cleanResult(input: Record<string, unknown> | null): VoiceResult {
  const rooms = Array.isArray(input?.rooms) ? (input!.rooms as any[]) : [];
  const services = Array.isArray(input?.services) ? (input!.services as any[]) : [];
  return {
    rooms: rooms.slice(0, 40).map((r) => ({
      name: str(r?.name, 80),
      length_m: num(r?.length_m, 0, 200),
      width_m: num(r?.width_m, 0, 200),
      height_m: num(r?.height_m, 0, 50),
      manual_wall_area_sqm: num(r?.manual_wall_area_sqm, 0, 10000),
      paint_ceiling: typeof r?.paint_ceiling === "boolean" ? r.paint_ceiling : null,
      wall_coats: int(r?.wall_coats, 1, 3, 1),
      ceiling_coats: int(r?.ceiling_coats, 1, 3, 1),
      notes: str(r?.notes, 500),
      windows: openings(r?.windows),
      doors: openings(r?.doors),
      radiators: openings(r?.radiators, true),
    })),
    services: services
      .slice(0, 20)
      .map((s) => ({ title: str(s?.title, 120), hours: num(s?.hours, 0, 1000) ?? 0, description: str(s?.description, 300) }))
      .filter((s) => s.title),
    general_notes: str(input?.general_notes, 1000),
  };
}

export function toolInput(content: { type: string; input?: unknown; text?: string }[]): Record<string, unknown> | null {
  const tool = content?.find((b) => b.type === "tool_use" && b.input && typeof b.input === "object");
  if (tool) return tool.input as Record<string, unknown>;
  const text = (content ?? []).filter((b) => b.type === "text").map((b) => b.text ?? "").join("\n");
  const s = text.indexOf("{");
  const e = text.lastIndexOf("}");
  if (s < 0 || e <= s) return null;
  try {
    return JSON.parse(text.slice(s, e + 1));
  } catch {
    return null;
  }
}

export const monthlyLimit = (status: string | undefined, env: (k: string) => string | undefined) =>
  status === "trialing"
    ? Number(env("AUFMASS_VOICE_TRIAL_LIMIT") ?? 30) || 30
    : Number(env("AUFMASS_VOICE_MONTHLY_LIMIT") ?? 100) || 100;
