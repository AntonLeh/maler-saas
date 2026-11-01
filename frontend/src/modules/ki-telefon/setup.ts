import { supabaseUrl } from "../../lib/supabase";
import type { Provider } from "./types";

export function baseUrl(key: string, provider: Provider): string {
  return `${supabaseUrl}/functions/v1/ai-phone?key=${key}&provider=${provider}`;
}

export type SetupUrl = { label: string; where: string; url: string };

export function setupUrls(key: string, provider: Provider): SetupUrl[] {
  const base = baseUrl(key, provider);
  if (provider === "elevenlabs") {
    return [
      { label: "Werkzeug get_company_info", where: "Agent → Tools → Add tool → Webhook (POST)", url: `${base}&tool=get_company_info` },
      { label: "Werkzeug get_free_slots", where: "Agent → Tools → Add tool → Webhook (POST)", url: `${base}&tool=get_free_slots` },
      { label: "Werkzeug book_appointment", where: "Agent → Tools → Add tool → Webhook (POST)", url: `${base}&tool=book_appointment` },
      { label: "Werkzeug create_callback", where: "Agent → Tools → Add tool → Webhook (POST)", url: `${base}&tool=create_callback` },
      {
        label: "Gesprächsende (später, für Zusammenfassungen und Minuten)",
        where: "Einstellungen → Webhooks → Post-call webhook",
        url: `${base}&action=call-ended`,
      },
    ];
  }
  if (provider === "retell") {
    return [
      {
        label: "Eine Adresse für alles",
        where:
          "Telefonnummer → Inbound Webhook, Agent → Webhook URL und bei jeder Custom Function als URL (POST)",
        url: base,
      },
    ];
  }
  return [
    {
      label: "Server URL",
      where: "Assistant → Advanced → Server URL (für Werkzeuge und End-of-Call-Report)",
      url: base,
    },
  ];
}

export const COMPANY_INFO_TOOL = {
  name: "get_company_info",
  description:
    "Liefert Firmenname, heutiges Datum, Uhrzeit und Besichtigungszeiten. Zu Beginn jedes Gesprächs einmal aufrufen.",
  parameters: { type: "object", properties: {}, required: [] as string[] },
};

export function toolsFor(provider: Provider) {
  return provider === "retell" ? TOOL_DEFINITIONS : [COMPANY_INFO_TOOL, ...TOOL_DEFINITIONS];
}

export const TOOL_DEFINITIONS = [
  {
    name: "get_free_slots",
    description:
      "Liefert freie Besichtigungstermine des Malerbetriebs. Vor jedem Terminvorschlag aufrufen. Niemals Termine erfinden.",
    parameters: {
      type: "object",
      properties: {
        from_date: { type: "string", description: "Frühestes Datum im Format JJJJ-MM-TT, optional" },
        daypart: { type: "string", enum: ["vormittag", "nachmittag"], description: "Bevorzugte Tageszeit, optional" },
      },
      required: [] as string[],
    },
  },
  {
    name: "book_appointment",
    description:
      "Trägt einen Besichtigungstermin verbindlich ein. Erst aufrufen, wenn der Anrufer einen Termin aus get_free_slots gewählt hat und Name, Telefonnummer und Adresse bekannt sind.",
    parameters: {
      type: "object",
      properties: {
        start: { type: "string", description: "Exakt der Wert 'start' aus get_free_slots, z. B. 2026-11-03T10:00" },
        name: { type: "string", description: "Vor- und Nachname des Anrufers" },
        phone: { type: "string", description: "Rückrufnummer" },
        address: { type: "string", description: "Adresse des Objekts: Straße, Hausnummer, PLZ, Ort" },
        concern: { type: "string", description: "Kurz: was soll gemacht werden" },
        email: { type: "string", description: "E-Mail, optional" },
      },
      required: ["start", "name", "phone", "address"],
    },
  },
  {
    name: "create_callback",
    description: "Nimmt einen Rückrufwunsch für den Betrieb auf (z. B. Fragen zu Angeboten, Rechnungen, Reklamationen).",
    parameters: {
      type: "object",
      properties: {
        name: { type: "string", description: "Name des Anrufers" },
        phone: { type: "string", description: "Rückrufnummer" },
        concern: { type: "string", description: "Anliegen in einem Satz" },
        preferred_time: { type: "string", description: "Wann der Rückruf passt, optional" },
      },
      required: ["phone", "concern"],
    },
  },
];

export const DYNAMIC_VARIABLES = [
  "company_name",
  "greeting",
  "today",
  "current_time",
  "visit_hours",
  "visit_duration",
  "extra_instructions",
  "service_available",
];

export function systemPrompt(provider: Provider): string {
  const viaTool = provider !== "retell";
  const v = (name: string) => (viaTool ? `(siehe get_company_info: ${name})` : `{{${name}}}`);
  const intro =
    viaTool
      ? "Rufe zu Beginn des Gesprächs einmal das Werkzeug get_company_info auf und nutze die Angaben daraus.\n\n"
      : "";
  return `${intro}Du bist der freundliche telefonische KI-Assistent von ${v("company_name")}, einem Malerbetrieb. Heute ist ${v(
    "today"
  )}, ${v("current_time")}.

GRUNDREGELN
- Du hast dich in der Begrüßung als KI-Assistent vorgestellt. Wenn jemand fragt, bestätige ehrlich, dass du eine KI bist.
- Sprich Deutsch, sieze die Anrufer, antworte kurz und natürlich – wie eine freundliche Bürokraft.
- Lass den Anrufer immer ausreden. Warte bei Adressen, Namen und Telefonnummern geduldig, auch wenn er kurz überlegt, und unterbrich nicht.
- Nenne keine Preise, keine Kostenschätzungen und keine Ausführungstermine. Dafür ist die Besichtigung bzw. ein Rückruf da.
- Erfinde nie Termine oder Informationen. Wenn du etwas nicht weißt, biete einen Rückruf an.
- Wenn ein Werkzeug "ok": false zurückgibt, folge genau dem Hinweis in "message".
- Dienst verfügbar: ${v("service_available")}. Steht dort "nein", entschuldige dich, bitte um einen späteren Anruf und beende das Gespräch.

DEINE AUFGABEN
1. Besichtigungstermine vereinbaren (Dauer ${v("visit_duration")}, mögliche Zeiten: ${v("visit_hours")}).
2. Rückrufwünsche aufnehmen.
3. Einfache Fragen zur Erreichbarkeit beantworten.

ABLAUF BESICHTIGUNG
1. Frage kurz, worum es geht (z. B. welche Räume, Fassade, ungefähre Größe).
2. Frage nach einem Wunschtag oder Vormittag/Nachmittag und rufe get_free_slots auf.
3. Biete zwei bis drei passende Termine an.
4. Hat sich der Anrufer entschieden, erfrage: vollständigen Namen, Adresse des Objekts (Straße, Hausnummer, PLZ, Ort) und die Rückrufnummer. Frage, ob die Nummer, von der angerufen wird, passt.
5. Wiederhole Termin und Adresse kurz und rufe dann book_appointment auf. Verwende für "start" exakt den Wert aus get_free_slots.
6. Bestätige den Termin und sage, dass sich der Betrieb bei Änderungen meldet.

ABLAUF RÜCKRUF
Frage nach Name, Rückrufnummer, Anliegen und wann es zeitlich passt. Rufe dann create_callback auf und bestätige.

ZUSÄTZLICHE HINWEISE DES BETRIEBS
${v("extra_instructions")}

Verabschiede dich zum Schluss freundlich.`;
}

export function firstMessage(
  provider: Provider,
  settings: { greeting: string | null; company_name: string | null }
): string {
  if (provider === "retell") return "{{greeting}}";
  return (
    settings.greeting ||
    `Guten Tag, Sie sprechen mit dem digitalen KI-Assistenten von ${
      settings.company_name || "[Firmenname]"
    }. Wie kann ich Ihnen helfen?`
  );
}
