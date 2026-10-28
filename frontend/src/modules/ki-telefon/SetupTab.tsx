import { useState } from "react";
import type { AiPhoneSettings, Provider } from "./types";
import { DYNAMIC_VARIABLES, TOOL_DEFINITIONS, firstMessage, setupUrls, systemPrompt } from "./setup";

type Props = {
  settings: AiPhoneSettings;
  busy: boolean;
  onRegenerateKey: () => void;
};

const PROVIDERS: { value: Provider; label: string }[] = [
  { value: "elevenlabs", label: "ElevenLabs" },
  { value: "retell", label: "Retell AI" },
  { value: "vapi", label: "Vapi" },
];

function CopyBlock({ label, value, mono = true, secret = false }: { label: string; value: string; mono?: boolean; secret?: boolean }) {
  const [copied, setCopied] = useState(false);
  const [revealed, setRevealed] = useState(!secret);
  const copy = async () => {
    try {
      await navigator.clipboard.writeText(value);
      setCopied(true);
      window.setTimeout(() => setCopied(false), 1500);
    } catch {
      setRevealed(true);
    }
  };
  const shown = revealed ? value : value.replace(/key=[a-f0-9]+/i, "key=••••••••••••");
  return (
    <div className="kt-copy">
      <div className="kt-copy-head">
        <span>{label}</span>
        <span className="kt-copy-actions">
          {secret && (
            <button type="button" className="kt-link" onClick={() => setRevealed((v) => !v)}>
              {revealed ? "verbergen" : "anzeigen"}
            </button>
          )}
          <button type="button" className="btn btn-secondary btn-small" onClick={copy}>
            {copied ? "Kopiert ✓" : "Kopieren"}
          </button>
        </span>
      </div>
      <pre className={mono ? "kt-pre" : "kt-pre kt-pre-text"}>{shown}</pre>
    </div>
  );
}

export default function SetupTab({ settings, busy, onRegenerateKey }: Props) {
  const [provider, setProvider] = useState<Provider>("elevenlabs");
  const [confirmRegen, setConfirmRegen] = useState(false);
  const urls = setupUrls(settings.webhook_key, provider);

  return (
    <div className="kt-setup">
      <div className="tk-notice tk-notice-info">
        <span>
          Die Adressen enthalten einen geheimen Schlüssel für deinen Betrieb. Gib sie nur im Konto deines KI-Anbieters ein
          und nirgendwo sonst.
        </span>
      </div>

      <section className="kt-panel">
        <h3>1. Anbieter wählen</h3>
        <div className="tk-segment" role="tablist" aria-label="Anbieter">
          {PROVIDERS.map((p) => (
            <button
              key={p.value}
              type="button"
              role="tab"
              aria-selected={provider === p.value}
              className={provider === p.value ? "active" : ""}
              onClick={() => setProvider(p.value)}
            >
              {p.label}
            </button>
          ))}
        </div>
      </section>

      <section className="kt-panel">
        <h3>2. Adressen beim Anbieter eintragen</h3>
        {urls.map((u) => (
          <div key={u.label} className="kt-url">
            <p className="kt-url-where">
              <strong>{u.label}</strong> – {u.where}
            </p>
            <CopyBlock label="Adresse" value={u.url} secret />
          </div>
        ))}
        {provider === "elevenlabs" && (
          <p className="tk-muted">
            Lege im Agent diese dynamischen Variablen an: {DYNAMIC_VARIABLES.map((v) => `{{${v}}}`).join(", ")}. Als erste
            Nachricht trägst du <code>{"{{greeting}}"}</code> ein.
          </p>
        )}
        {provider === "retell" && (
          <p className="tk-muted">
            Bei jeder Custom Function: Methode POST, „Payload: args only“ <strong>ausgeschaltet</strong> lassen.
          </p>
        )}
        {provider === "vapi" && (
          <p className="tk-muted">
            Lege zusätzlich das Werkzeug <code>get_company_info</code> ohne Parameter an. Den Firmennamen trägst du bei Vapi
            selbst in die erste Nachricht ein.
          </p>
        )}
      </section>

      <section className="kt-panel">
        <h3>3. Anweisungen für die KI (System-Prompt)</h3>
        <CopyBlock label="Erste Nachricht" value={firstMessage(provider)} />
        <CopyBlock label="System-Prompt" value={systemPrompt(provider)} mono={false} />
      </section>

      <section className="kt-panel">
        <h3>4. Werkzeuge anlegen</h3>
        <p className="tk-muted">
          Für jedes Werkzeug Name, Beschreibung und Parameter übernehmen. Die meisten Anbieter erlauben, die JSON-Beschreibung
          direkt einzufügen.
        </p>
        {(provider === "vapi"
          ? [{ name: "get_company_info", description: "Liefert Firmenname, Datum und Besichtigungszeiten. Zu Beginn des Gesprächs einmal aufrufen.", parameters: { type: "object", properties: {}, required: [] } }, ...TOOL_DEFINITIONS]
          : TOOL_DEFINITIONS
        ).map((t) => (
          <CopyBlock key={t.name} label={t.name} value={JSON.stringify(t, null, 2)} />
        ))}
      </section>

      <section className="kt-panel">
        <h3>5. Rufumleitung einrichten</h3>
        <p>
          Beim eigenen Telefonanbieter eine Rufumleitung auf die Nummer der KI einrichten, am besten „bei besetzt“ und „nach
          20 Sekunden ohne Annahme“. So geht die KI nur ran, wenn niemand abnimmt.
        </p>
      </section>

      <section className="kt-panel kt-danger-zone">
        <h3>Schlüssel erneuern</h3>
        <p className="tk-muted">
          Falls eine Adresse in falsche Hände geraten ist. Danach musst du alle Adressen beim Anbieter neu eintragen.
        </p>
        {confirmRegen ? (
          <div className="tk-pm-buttons" style={{ justifyContent: "flex-start" }}>
            <button type="button" className="btn btn-secondary btn-small" onClick={() => setConfirmRegen(false)} disabled={busy}>
              Abbrechen
            </button>
            <button
              type="button"
              className="btn btn-danger btn-small"
              disabled={busy}
              onClick={() => {
                setConfirmRegen(false);
                onRegenerateKey();
              }}
            >
              Ja, neuen Schlüssel erzeugen
            </button>
          </div>
        ) : (
          <button type="button" className="tk-link-danger" onClick={() => setConfirmRegen(true)} disabled={busy}>
            Neuen Schlüssel erzeugen …
          </button>
        )}
      </section>
    </div>
  );
}
