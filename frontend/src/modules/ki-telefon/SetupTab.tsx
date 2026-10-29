import { useState } from "react";
import type { AiPhoneAgent, AiPhoneSettings, Provider } from "./types";
import { DYNAMIC_VARIABLES, firstMessage, setupUrls, systemPrompt, toolsFor } from "./setup";

type Props = {
  settings: AiPhoneSettings;
  agent: AiPhoneAgent | null;
  busy: boolean;
  onActivate: () => void;
  onRegenerateKey: () => void;
};

function formatDateTime(iso: string | null) {
  if (!iso) return "–";
  return new Date(iso).toLocaleString("de-DE", { day: "2-digit", month: "2-digit", year: "numeric", hour: "2-digit", minute: "2-digit" });
}

function ActivationPanel({ agent, busy, onActivate }: { agent: AiPhoneAgent | null; busy: boolean; onActivate: () => void }) {
  const hasAgent = !!agent?.agent_id;
  const steps = [
    { label: "KI-Assistent angelegt", done: hasAgent },
    { label: "Telefonnummer verbunden", done: !!agent?.phone_number },
  ];
  return (
    <section className="kt-panel kt-activate">
      <h3>KI-Assistent</h3>
      {!hasAgent ? (
        <>
          <p>
            Mit einem Klick wird dein persönlicher KI-Assistent eingerichtet – mit deinem Firmennamen, deiner Begrüßung,
            deutscher Stimme und Zugriff auf deinen Terminkalender.
          </p>
          <button type="button" className="btn btn-primary" onClick={onActivate} disabled={busy}>
            {busy ? "Wird eingerichtet … (bis zu 30 Sek.)" : "KI-Telefon aktivieren"}
          </button>
        </>
      ) : (
        <>
          <ul className="kt-steps">
            {steps.map((st) => (
              <li key={st.label} className={st.done ? "kt-step-done" : "kt-step-open"}>
                <span aria-hidden="true">{st.done ? "✓" : "○"}</span> {st.label}
                {st.label.startsWith("Telefon") && agent?.phone_number && <strong> {agent.phone_number}</strong>}
              </li>
            ))}
          </ul>
          {!agent?.phone_number && (
            <p className="tk-muted">
              Die Telefonnummer wird im nächsten Schritt automatisch beantragt. Bis dahin kann der Assistent im Browser
              getestet werden.
            </p>
          )}
          <div className="kt-test-row">
            <button type="button" className="btn btn-secondary btn-small" onClick={onActivate} disabled={busy}>
              {busy ? "Wird aktualisiert …" : "Assistent jetzt aktualisieren"}
            </button>
            <span className="tk-muted">Zuletzt aktualisiert: {formatDateTime(agent?.synced_at ?? null)}</span>
          </div>
        </>
      )}
      {agent?.last_error && (
        <div className="tk-notice tk-notice-error kt-activate-error">
          <span>Letzter Versuch fehlgeschlagen: {agent.last_error}</span>
        </div>
      )}
    </section>
  );
}

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

export default function SetupTab({ settings, agent, busy, onActivate, onRegenerateKey }: Props) {
  const [provider, setProvider] = useState<Provider>("elevenlabs");
  const [confirmRegen, setConfirmRegen] = useState(false);
  const urls = setupUrls(settings.webhook_key, provider);

  return (
    <div className="kt-setup">
      <ActivationPanel agent={agent} busy={busy} onActivate={onActivate} />

      <details className="kt-manual">
        <summary>Technische Details / manuelle Einrichtung (nur für Experten)</summary>
        <div className="kt-manual-body">
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
            Für den Test im Browser reichen die vier Werkzeuge. Die Adresse „Gesprächsende“ trägst du erst ein, wenn die KI
            eine echte Telefonnummer hat.
          </p>
        )}
        {provider === "retell" && (
          <p className="tk-muted">
            Lege im Agent diese dynamischen Variablen an: {DYNAMIC_VARIABLES.map((v) => `{{${v}}}`).join(", ")}.
            Bei jeder Custom Function: Methode POST, „Payload: args only“ <strong>ausgeschaltet</strong> lassen.
          </p>
        )}
        {provider === "vapi" && (
          <p className="tk-muted">
            Lege zusätzlich das Werkzeug <code>get_company_info</code> ohne Parameter an.
          </p>
        )}
      </section>

      <section className="kt-panel">
        <h3>3. Anweisungen für die KI (System-Prompt)</h3>
        <CopyBlock label="Erste Nachricht" value={firstMessage(provider, settings)} mono={false} />
        <CopyBlock label="System-Prompt" value={systemPrompt(provider)} mono={false} />
      </section>

      <section className="kt-panel">
        <h3>4. Werkzeuge anlegen</h3>
        <p className="tk-muted">
          Für jedes Werkzeug Name, Beschreibung und Parameter übernehmen. Die meisten Anbieter erlauben, die JSON-Beschreibung
          direkt einzufügen.
        </p>
        {toolsFor(provider).map((t) => (
          <div key={t.name} className="kt-tool">
            <p className="kt-url-where">
              <strong>{t.name}</strong> – {t.description}
            </p>
            {Object.keys(t.parameters.properties).length === 0 ? (
              <p className="tk-muted">Keine Parameter.</p>
            ) : (
              <table className="kt-params">
                <thead>
                  <tr>
                    <th>Parameter</th>
                    <th>Typ</th>
                    <th>Pflicht</th>
                    <th>Beschreibung</th>
                  </tr>
                </thead>
                <tbody>
                  {Object.entries(t.parameters.properties as Record<string, { type: string; description: string }>).map(
                    ([name, p]) => (
                      <tr key={name}>
                        <td>
                          <code>{name}</code>
                        </td>
                        <td>{p.type}</td>
                        <td>{t.parameters.required.includes(name) ? "ja" : "nein"}</td>
                        <td>{p.description}</td>
                      </tr>
                    )
                  )}
                </tbody>
              </table>
            )}
            <details className="kt-json">
              <summary>Als JSON anzeigen</summary>
              <CopyBlock label={t.name} value={JSON.stringify(t, null, 2)} />
            </details>
          </div>
        ))}
      </section>

      <section className="kt-panel">
        <h3>5. Rufumleitung einrichten</h3>
        <p>
          Beim eigenen Telefonanbieter eine Rufumleitung auf die Nummer der KI einrichten, am besten „bei besetzt“ und „nach
          20 Sekunden ohne Annahme“. So geht die KI nur ran, wenn niemand abnimmt.
        </p>
      </section>

        </div>
      </details>

      <section className="kt-panel kt-danger-zone">
        <h3>Schlüssel erneuern</h3>
        <p className="tk-muted">
          Falls eine Adresse in falsche Hände geraten ist. Ein automatisch eingerichteter Assistent wird danach von selbst
          aktualisiert.
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
