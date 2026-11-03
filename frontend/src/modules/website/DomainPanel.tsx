import { useEffect, useState } from "react";
import type { Website } from "./types";
import type { DnsRecord, DomainState } from "./api";
import { domainAction } from "./api";

/**
 * Eigene Domain verbinden: Domain eingeben → DNS-Einträge beim eigenen Anbieter setzen → prüfen.
 * Die Domain wird ausschließlich über die Funktion website-domain gesetzt (trägt sie bei Vercel ein).
 */
export default function DomainPanel({ website, onError }: { website: Website; onError: (msg: string) => void }) {
  const [state, setState] = useState<DomainState>({
    domain: website.custom_domain ?? null,
    status: website.custom_domain_status ?? null,
    records: [],
    problem: website.custom_domain_error ?? "",
  });
  const [input, setInput] = useState("");
  const [busy, setBusy] = useState<"" | "connect" | "check" | "disconnect">("");
  const [copied, setCopied] = useState("");

  const run = async (action: "connect" | "check" | "disconnect", domain?: string) => {
    setBusy(action);
    try {
      setState(await domainAction(action, domain));
      if (action === "connect") setInput("");
    } catch (e) {
      onError((e as Error).message);
    } finally {
      setBusy("");
    }
  };

  // Bei wartender Domain: Anleitung (DNS-Einträge) direkt laden
  useEffect(() => {
    if (website.custom_domain && website.custom_domain_status !== "active") {
      domainAction("check").then(setState).catch(() => undefined);
    }
  }, [website.custom_domain, website.custom_domain_status]);

  const copy = async (text: string) => {
    try {
      await navigator.clipboard.writeText(text);
      setCopied(text);
      window.setTimeout(() => setCopied(""), 1500);
    } catch {
      /* Zwischenablage nicht verfügbar */
    }
  };

  return (
    <section className="ws-panel">
      <h3>Eigene Domain</h3>
      <p className="tk-muted ws-dom-intro">Änderungen hier wirken sofort – „Änderungen speichern“ ist dafür nicht nötig.</p>

      {!state.domain ? (
        <>
          <p className="tk-muted ws-dom-intro">
            Sie haben schon eine Domain, z. B. <strong>maler-mustermann.de</strong>? Dann erscheint Ihre Website direkt unter dieser Adresse – mit
            sicherer Verbindung (https). Die Domain bleibt bei Ihrem bisherigen Anbieter (IONOS, Strato, …), Sie ändern dort nur zwei Einträge.
          </p>
          <div className="ws-row">
            <input
              className="ws-dom-input"
              value={input}
              onChange={(e) => setInput(e.target.value)}
              placeholder="maler-mustermann.de"
              aria-label="Eigene Domain"
              onKeyDown={(e) => e.key === "Enter" && input.trim() && run("connect", input)}
            />
            <button type="button" className="btn btn-primary btn-small" disabled={!input.trim() || !!busy} onClick={() => run("connect", input)}>
              {busy === "connect" ? "Wird verbunden …" : "Domain verbinden"}
            </button>
          </div>
        </>
      ) : (
        <>
          <div className={`ws-dom-status${state.status === "active" ? " ok" : ""}`}>
            <strong>{state.domain}</strong>
            <span>{state.status === "active" ? "● Aktiv – Ihre Website ist unter dieser Adresse erreichbar." : "○ Wartet auf die DNS-Einträge"}</span>
          </div>

          {state.status !== "active" && (
            <>
              <p className="ws-dom-step">
                Melden Sie sich bei Ihrem Domain-Anbieter an (z. B. IONOS, Strato, All-Inkl) und öffnen Sie die <strong>DNS-Einstellungen</strong> der
                Domain. Legen Sie diese Einträge an bzw. ändern Sie vorhandene Einträge mit gleichem Namen:
              </p>
              {state.records.length > 0 ? (
                <div className="ws-dom-table" role="table" aria-label="DNS-Einträge">
                  <div className="ws-dom-row ws-dom-head" role="row">
                    <span role="columnheader">Typ</span>
                    <span role="columnheader">Name / Host</span>
                    <span role="columnheader">Wert / Ziel</span>
                  </div>
                  {state.records.map((r: DnsRecord) => (
                    <div key={`${r.type}${r.name}`} className="ws-dom-row" role="row">
                      <span role="cell">
                        <strong>{r.type}</strong>
                      </span>
                      <span role="cell">
                        <code>{r.name}</code>
                      </span>
                      <span role="cell">
                        <code>{r.value}</code>{" "}
                        <button type="button" className="ws-link" onClick={() => copy(r.value)}>
                          {copied === r.value ? "kopiert ✓" : "kopieren"}
                        </button>
                        {r.note && <small className="tk-muted ws-block">{r.note}</small>}
                      </span>
                    </div>
                  ))}
                </div>
              ) : (
                <p className="tk-muted">Die Einträge werden geladen …</p>
              )}
              <p className="tk-muted ws-dom-hint">
                Wichtig: Einen vorhandenen A-Eintrag für „@“ bzw. CNAME für „www“ bitte <strong>ersetzen</strong>, nicht zusätzlich anlegen. E-Mail-Einträge
                (MX) bleiben unverändert – Ihre E-Mail-Adressen funktionieren weiter. Die Umstellung dauert meist wenige Minuten, manchmal bis zu 24
                Stunden.
              </p>
              {state.problem && <div className="tk-notice tk-notice-info">{state.problem}</div>}
            </>
          )}

          <div className="ws-row">
            {state.status !== "active" && (
              <button type="button" className="btn btn-primary btn-small" disabled={!!busy} onClick={() => run("check")}>
                {busy === "check" ? "Wird geprüft …" : "Jetzt prüfen"}
              </button>
            )}
            {state.status === "active" && (
              <a className="btn btn-secondary btn-small" href={`https://${state.domain}`} target="_blank" rel="noreferrer">
                Website ansehen
              </a>
            )}
            <button
              type="button"
              className="ws-link ws-danger"
              disabled={!!busy}
              onClick={() =>
                window.confirm("Domain trennen? Ihre Website ist danach wieder nur unter der Maler-SaaS-Adresse erreichbar.") && run("disconnect")
              }
            >
              Domain trennen
            </button>
          </div>
        </>
      )}
    </section>
  );
}
