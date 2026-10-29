// Automatisches Anlegen und Aktualisieren des KI-Agenten bei ElevenLabs
//
// Secrets (npx supabase secrets set ...):
//   ELEVENLABS_API_KEY            API-Schlüssel des zentralen ElevenLabs-Kontos (Pflicht)
//   ELEVENLABS_TEMPLATE_AGENT_ID  Vorlage-Agent: Stimme und KI-Modell werden von dort übernommen (empfohlen)
// Alternativ zur Vorlage:
//   ELEVENLABS_VOICE_ID           Stimme
//   ELEVENLABS_LLM                KI-Modell (Standard: gemini-2.5-flash)

const env = (k: string) => (globalThis as any).Deno?.env?.get(k) ?? "";
const apiBase = () => env("ELEVENLABS_API_URL") || "https://api.elevenlabs.io";

export type ToolIds = Record<string, string>;

type Settings = {
  tenant_id: number;
  webhook_key: string;
  greeting?: string | null;
  company_name?: string | null;
};

export function greetingFor(settings: Settings, company: string): string {
  return (
    (settings.greeting && settings.greeting.trim()) ||
    `Guten Tag, Sie sprechen mit dem digitalen KI-Assistenten von ${company}. Wie kann ich Ihnen helfen?`
  );
}

export function systemPrompt(): string {
  const v = (name: string) => `(siehe get_company_info: ${name})`;
  return `Rufe zu Beginn des Gesprächs einmal das Werkzeug get_company_info auf und nutze die Angaben daraus.

Du bist der freundliche telefonische KI-Assistent von ${v("company_name")}, einem Malerbetrieb. Heute ist ${v("today")}, ${v(
    "current_time"
  )}.

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

Verabschiede dich zum Schluss freundlich und beende dann das Gespräch.`;
}

const str = (description: string) => ({ type: "string", description });
// Gesprächs-ID automatisch mitschicken (verbindet Termin/Rückruf mit dem späteren Gesprächsprotokoll)
const CALL_ID = { type: "string", dynamic_variable: "system__conversation_id" };

/** Werkzeug-Definitionen im Format der ElevenLabs-API */
export function toolConfigs(functionUrl: string, key: string) {
  const url = (tool: string) => `${functionUrl}?key=${key}&provider=elevenlabs&tool=${tool}`;
  return {
    get_company_info: {
      type: "webhook",
      name: "get_company_info",
      description:
        "Liefert Firmenname, heutiges Datum, Uhrzeit und Besichtigungszeiten. Zu Beginn jedes Gesprächs einmal aufrufen.",
      api_schema: { url: url("get_company_info"), method: "GET" },
      response_timeout_secs: 10,
    },
    get_free_slots: {
      type: "webhook",
      name: "get_free_slots",
      description:
        "Liefert freie Besichtigungstermine des Malerbetriebs. Vor jedem Terminvorschlag aufrufen. Niemals Termine erfinden.",
      api_schema: {
        url: url("get_free_slots"),
        method: "POST",
        request_body_schema: {
          type: "object",
          description: "Wunschzeitraum des Anrufers für die Besichtigung.",
          required: [],
          properties: {
            call_id: CALL_ID,
            from_date: str("Frühestes gewünschtes Datum im Format JJJJ-MM-TT, nur wenn der Anrufer einen Wunschtag nennt"),
            daypart: {
              type: "string",
              description: "Bevorzugte Tageszeit, nur wenn der Anrufer eine nennt",
              enum: ["vormittag", "nachmittag"],
            },
          },
        },
      },
      response_timeout_secs: 15,
    },
    book_appointment: {
      type: "webhook",
      name: "book_appointment",
      description:
        "Trägt einen Besichtigungstermin verbindlich ein. Erst aufrufen, wenn der Anrufer einen Termin aus get_free_slots gewählt hat und Name, Telefonnummer und Adresse bekannt sind.",
      api_schema: {
        url: url("book_appointment"),
        method: "POST",
        request_body_schema: {
          type: "object",
          description: "Daten des Anrufers und gewählter Termin.",
          required: ["start", "name", "phone", "address"],
          properties: {
            call_id: CALL_ID,
            start: str("Exakt der Wert start aus get_free_slots, z. B. 2026-11-03T10:00"),
            name: str("Vor- und Nachname des Anrufers"),
            phone: str("Rückrufnummer des Anrufers"),
            address: str("Adresse des Objekts: Straße, Hausnummer, PLZ, Ort"),
            concern: str("Kurz: was soll gemacht werden"),
            email: str("E-Mail-Adresse, nur wenn der Anrufer sie nennt"),
          },
        },
      },
      response_timeout_secs: 15,
    },
    create_callback: {
      type: "webhook",
      name: "create_callback",
      description:
        "Nimmt einen Rückrufwunsch für den Betrieb auf, z. B. bei Fragen zu Angeboten, Rechnungen, Reklamationen oder Notfällen.",
      api_schema: {
        url: url("create_callback"),
        method: "POST",
        request_body_schema: {
          type: "object",
          description: "Kontaktdaten und Anliegen für den Rückruf.",
          required: ["phone", "concern"],
          properties: {
            call_id: CALL_ID,
            name: str("Name des Anrufers"),
            phone: str("Rückrufnummer"),
            concern: str("Anliegen in einem Satz"),
            preferred_time: str("Wann der Rückruf zeitlich passt, nur wenn genannt"),
          },
        },
      },
      response_timeout_secs: 15,
    },
  };
}

class ElevenLabsError extends Error {
  constructor(public status: number, message: string) {
    super(message);
  }
}

async function el(method: string, path: string, body?: unknown) {
  const res = await fetch(`${apiBase()}${path}`, {
    method,
    headers: { "xi-api-key": env("ELEVENLABS_API_KEY"), "content-type": "application/json" },
    body: body === undefined ? undefined : JSON.stringify(body),
    signal: AbortSignal.timeout(20000),
  });
  const text = await res.text();
  let data: any = {};
  try {
    data = text ? JSON.parse(text) : {};
  } catch {
    data = { raw: text };
  }
  if (!res.ok) {
    const detail = typeof data?.detail === "string" ? data.detail : JSON.stringify(data?.detail ?? data).slice(0, 300);
    throw new ElevenLabsError(res.status, `ElevenLabs ${method} ${path.split("?")[0]} → ${res.status}: ${detail}`);
  }
  return data;
}

/** Stimme, Sprachmodell und KI-Modell: aus Vorlage-Agent oder Secrets */
async function voiceAndModel() {
  const templateId = env("ELEVENLABS_TEMPLATE_AGENT_ID");
  let voiceId = env("ELEVENLABS_VOICE_ID");
  let ttsModel = "";
  let llm = env("ELEVENLABS_LLM");
  if (templateId) {
    const tpl = await el("GET", `/v1/convai/agents/${encodeURIComponent(templateId)}`);
    voiceId = voiceId || tpl?.conversation_config?.tts?.voice_id || "";
    ttsModel = tpl?.conversation_config?.tts?.model_id || "";
    llm = llm || tpl?.conversation_config?.agent?.prompt?.llm || "";
  }
  if (!voiceId) {
    throw new Error(
      "Keine Stimme festgelegt. Bitte ELEVENLABS_TEMPLATE_AGENT_ID (Vorlage-Agent) oder ELEVENLABS_VOICE_ID als Secret hinterlegen."
    );
  }
  return { voiceId, ttsModel, llm: llm || "gemini-2.5-flash" };
}

/** Werkzeuge anlegen oder aktualisieren; liefert die IDs */
async function syncTools(existing: ToolIds, configs: Record<string, any>): Promise<ToolIds> {
  const ids: ToolIds = {};
  for (const [name, cfg] of Object.entries(configs)) {
    const id = existing?.[name];
    if (id) {
      try {
        await el("PATCH", `/v1/convai/tools/${encodeURIComponent(id)}`, { tool_config: cfg });
        ids[name] = id;
        continue;
      } catch (e) {
        if (!(e instanceof ElevenLabsError) || e.status !== 404) throw e;
        // Werkzeug wurde gelöscht -> neu anlegen
      }
    }
    const created = await el("POST", "/v1/convai/tools", { tool_config: cfg });
    ids[name] = created.id;
  }
  return ids;
}

export type ProvisionInput = {
  settings: Settings;
  company: string;
  functionUrl: string;
  existing: { agent_id?: string | null; tool_ids?: ToolIds | null } | null;
};

export type ProvisionResult = { agentId: string; toolIds: ToolIds; created: boolean };

/** Agent für einen Betrieb anlegen oder aktualisieren */
export async function provisionAgent(input: ProvisionInput): Promise<ProvisionResult> {
  if (!env("ELEVENLABS_API_KEY")) {
    throw new Error("ELEVENLABS_API_KEY fehlt. Bitte als Secret in Supabase hinterlegen.");
  }
  const { voiceId, ttsModel, llm } = await voiceAndModel();
  const toolIds = await syncTools(input.existing?.tool_ids ?? {}, toolConfigs(input.functionUrl, input.settings.webhook_key));

  const tts: Record<string, unknown> = { voice_id: voiceId };
  if (ttsModel) tts.model_id = ttsModel;

  const agentBody = {
    name: `MalerSaaS – ${input.company} (#${input.settings.tenant_id})`.slice(0, 120),
    tags: ["maler-saas", `tenant-${input.settings.tenant_id}`],
    conversation_config: {
      agent: {
        first_message: greetingFor(input.settings, input.company),
        language: "de",
        prompt: {
          prompt: systemPrompt(),
          llm,
          tool_ids: Object.values(toolIds),
          built_in_tools: {
            end_call: { type: "system", name: "end_call", description: "", params: { system_tool_type: "end_call" } },
          },
        },
      },
      tts,
      turn: { turn_eagerness: "patient", speculative_turn: false },
      conversation: { max_duration_seconds: 900 },
    },
    // Zusammenfassungen nach dem Gespräch auf Deutsch (sonst oft Englisch)
    platform_settings: { summary_language: "de" },
  };

  const agentId = input.existing?.agent_id;
  if (agentId) {
    try {
      await el("PATCH", `/v1/convai/agents/${encodeURIComponent(agentId)}`, agentBody);
      return { agentId, toolIds, created: false };
    } catch (e) {
      if (!(e instanceof ElevenLabsError) || e.status !== 404) throw e;
      // Agent wurde bei ElevenLabs gelöscht -> neu anlegen
    }
  }
  const created = await el("POST", "/v1/convai/agents/create", agentBody);
  return { agentId: created.agent_id, toolIds, created: true };
}
