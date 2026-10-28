import { useCallback, useEffect, useState } from "react";
import "../terminkalender/terminkalender.css";
import "./ki-telefon.css";
import type { AiAppointment, AiCall, AiPhoneSettings, CallbackRequest } from "./types";
import { OUTCOME_LABELS } from "./types";
import * as api from "./api";
import SettingsTab from "./SettingsTab";
import SetupTab from "./SetupTab";

type Tab = "overview" | "settings" | "setup";

type Props = {
  tenantId: number;
  currentUserId: number;
  onBack: () => void;
  onOpenCalendar: () => void;
};

function formatDateTime(iso: string) {
  return new Date(iso).toLocaleString("de-DE", {
    weekday: "short",
    day: "2-digit",
    month: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
  });
}

function formatDuration(seconds: number | null) {
  if (!seconds) return "–";
  const m = Math.floor(seconds / 60);
  const s = seconds % 60;
  return m ? `${m}:${String(s).padStart(2, "0")} Min.` : `${s} Sek.`;
}

function CallbackCard({
  cb,
  busy,
  onDone,
  onReopen,
}: {
  cb: CallbackRequest;
  busy: boolean;
  onDone: (note: string) => void;
  onReopen: () => void;
}) {
  const [note, setNote] = useState("");
  const [closing, setClosing] = useState(false);
  const done = cb.status === "erledigt";

  return (
    <article className={`kt-callback${done ? " kt-done" : ""}`}>
      <div className="kt-callback-head">
        <div>
          <strong>{cb.caller_name || "Unbekannter Anrufer"}</strong>
          <span className="tk-muted">{formatDateTime(cb.created_at)}</span>
        </div>
        {cb.caller_phone && (
          <a className="btn btn-primary btn-small kt-call-btn" href={`tel:${cb.caller_phone.replace(/[^\d+]/g, "")}`}>
            📞 {cb.caller_phone}
          </a>
        )}
      </div>
      {cb.concern && <p className="kt-concern">{cb.concern}</p>}
      {cb.preferred_time && <p className="tk-muted">Passt am besten: {cb.preferred_time}</p>}
      {done ? (
        <div className="kt-callback-foot">
          <span className="tk-badge tk-status-bestaetigt">Erledigt</span>
          {cb.note && <span className="tk-muted">{cb.note}</span>}
          <button type="button" className="kt-link" onClick={onReopen} disabled={busy}>
            wieder öffnen
          </button>
        </div>
      ) : closing ? (
        <div className="kt-callback-foot">
          <input value={note} onChange={(e) => setNote(e.target.value)} placeholder="Notiz (optional), z. B. Angebot zugesagt" autoFocus />
          <button type="button" className="btn btn-secondary btn-small" onClick={() => setClosing(false)} disabled={busy}>
            Abbrechen
          </button>
          <button type="button" className="btn btn-primary btn-small" onClick={() => onDone(note)} disabled={busy}>
            Speichern
          </button>
        </div>
      ) : (
        <div className="kt-callback-foot">
          <button type="button" className="btn btn-secondary btn-small" onClick={() => setClosing(true)} disabled={busy}>
            ✓ Erledigt
          </button>
        </div>
      )}
    </article>
  );
}

export default function KiTelefonPage({ tenantId, currentUserId, onBack, onOpenCalendar }: Props) {
  const [tab, setTab] = useState<Tab>("overview");
  const [settings, setSettings] = useState<AiPhoneSettings | null>(null);
  const [callbacks, setCallbacks] = useState<CallbackRequest[]>([]);
  const [calls, setCalls] = useState<AiCall[]>([]);
  const [aiAppointments, setAiAppointments] = useState<AiAppointment[]>([]);
  const [month, setMonth] = useState({ seconds: 0, calls: 0 });
  const [showDone, setShowDone] = useState(false);
  const [loading, setLoading] = useState(true);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const [success, setSuccess] = useState("");

  const reload = useCallback(async () => {
    setLoading(true);
    try {
      const [s, cb, cl, ap, m] = await Promise.all([
        api.loadOrCreateSettings(tenantId),
        api.loadCallbacks(tenantId),
        api.loadCalls(tenantId),
        api.loadAiAppointmentsToReview(tenantId),
        api.loadMonthSeconds(tenantId),
      ]);
      setSettings(s);
      setCallbacks(cb);
      setCalls(cl);
      setAiAppointments(ap);
      setMonth(m);
    } catch (e) {
      setError((e as Error).message);
    } finally {
      setLoading(false);
    }
  }, [tenantId]);

  useEffect(() => {
    void reload();
  }, [reload]);

  const run = async (fn: () => Promise<void>, okMsg?: string) => {
    setBusy(true);
    setError("");
    setSuccess("");
    try {
      await fn();
      if (okMsg) setSuccess(okMsg);
    } catch (e) {
      setError((e as Error).message);
    } finally {
      setBusy(false);
    }
  };

  const openCallbacks = callbacks.filter((c) => c.status === "offen");
  const doneCallbacks = callbacks.filter((c) => c.status === "erledigt");
  const minutes = Math.ceil(month.seconds / 60);

  return (
    <section className="single-page-section tk-root kt-root">
      <div className="card form-page-card tk-card">
        <div className="page-topbar">
          <div>
            <h1>KI-Telefon</h1>
            <p>Die KI nimmt Anrufe an, vergibt Besichtigungstermine und notiert Rückrufwünsche.</p>
          </div>
          <div className="tk-topbar-actions">
            <button type="button" className="btn btn-secondary" onClick={onBack}>
              Zurück
            </button>
          </div>
        </div>

        {settings && !settings.enabled && tab === "overview" && (
          <div className="tk-notice tk-notice-info">
            <span>Das KI-Telefon ist noch ausgeschaltet. Unter „Einstellungen“ einschalten, unter „Einrichtung“ verbinden.</span>
          </div>
        )}
        {error && (
          <div className="tk-notice tk-notice-error" role="alert">
            <span>{error}</span>
            <button type="button" className="tk-icon-btn" onClick={() => setError("")} aria-label="Ausblenden">
              ×
            </button>
          </div>
        )}
        {success && (
          <div className="tk-notice tk-notice-success" role="status">
            <span>{success}</span>
          </div>
        )}

        <div className="tk-segment kt-tabs" role="tablist" aria-label="Bereich">
          {(
            [
              ["overview", `Übersicht${openCallbacks.length + aiAppointments.length ? ` (${openCallbacks.length + aiAppointments.length})` : ""}`],
              ["settings", "Einstellungen"],
              ["setup", "Einrichtung"],
            ] as [Tab, string][]
          ).map(([t, label]) => (
            <button key={t} type="button" role="tab" aria-selected={tab === t} className={tab === t ? "active" : ""} onClick={() => setTab(t)}>
              {label}
            </button>
          ))}
        </div>

        {loading && !settings ? (
          <p className="tk-empty">Wird geladen …</p>
        ) : !settings ? null : tab === "settings" ? (
          <SettingsTab
            key={settings.updated_at}
            settings={settings}
            saving={busy}
            onSave={(values) =>
              run(async () => {
                setSettings(await api.saveSettings(tenantId, values));
              }, "Einstellungen gespeichert.")
            }
          />
        ) : tab === "setup" ? (
          <SetupTab
            settings={settings}
            busy={busy}
            onRegenerateKey={() =>
              run(async () => {
                setSettings(await api.regenerateKey(tenantId));
              }, "Neuer Schlüssel erzeugt. Bitte die Adressen beim Anbieter aktualisieren.")
            }
          />
        ) : (
          <div className="kt-overview">
            <div className="tk-stats">
              <span className="tk-stat tk-status-weitergeleitet">
                <strong>{openCallbacks.length}</strong> Rückrufe offen
              </span>
              <span className="tk-stat tk-status-geplant">
                <strong>{aiAppointments.length}</strong> KI-Termine zu prüfen
              </span>
              <span className="tk-stat tk-status-bestaetigt">
                <strong>{month.calls}</strong> Anrufe diesen Monat
              </span>
              <span className="tk-stat tk-status-geplant">
                <strong>{minutes}</strong> Minuten diesen Monat
              </span>
            </div>

            <section className="kt-section">
              <h2>Rückrufwünsche</h2>
              {openCallbacks.length === 0 ? (
                <p className="tk-empty">Keine offenen Rückrufe.</p>
              ) : (
                <div className="kt-cards">
                  {openCallbacks.map((cb) => (
                    <CallbackCard
                      key={cb.id}
                      cb={cb}
                      busy={busy}
                      onDone={(note) =>
                        run(async () => {
                          await api.markCallbackDone(cb.id, currentUserId, note);
                          await reload();
                        })
                      }
                      onReopen={() => undefined}
                    />
                  ))}
                </div>
              )}
              {doneCallbacks.length > 0 && (
                <>
                  <button type="button" className="tk-toggle" onClick={() => setShowDone((v) => !v)}>
                    {showDone ? "▾" : "▸"} Erledigte Rückrufe ({doneCallbacks.length})
                  </button>
                  {showDone && (
                    <div className="kt-cards">
                      {doneCallbacks.map((cb) => (
                        <CallbackCard
                          key={cb.id}
                          cb={cb}
                          busy={busy}
                          onDone={() => undefined}
                          onReopen={() =>
                            run(async () => {
                              await api.reopenCallback(cb.id);
                              await reload();
                            })
                          }
                        />
                      ))}
                    </div>
                  )}
                </>
              )}
            </section>

            <section className="kt-section">
              <div className="kt-section-head">
                <h2>Von der KI gebuchte Termine</h2>
                <button type="button" className="btn btn-secondary btn-small" onClick={onOpenCalendar}>
                  Im Terminkalender öffnen
                </button>
              </div>
              <p className="tk-muted">
                Diese Termine sind eingetragen, aber noch keinem Projektleiter zugewiesen. Im Terminkalender anklicken und
                weiterleiten.
              </p>
              {aiAppointments.length === 0 ? (
                <p className="tk-empty">Keine Termine zu prüfen.</p>
              ) : (
                <div className="kt-list">
                  {aiAppointments.map((a) => (
                    <div key={a.id} className="kt-list-row">
                      <span className="kt-when">{formatDateTime(a.starts_at)}</span>
                      <span className="kt-main">
                        <strong>{a.contact_name || a.title}</strong>
                        {a.location && <span className="tk-muted">{a.location}</span>}
                      </span>
                      {a.contact_phone && (
                        <a className="kt-link" href={`tel:${a.contact_phone.replace(/[^\d+]/g, "")}`}>
                          {a.contact_phone}
                        </a>
                      )}
                    </div>
                  ))}
                </div>
              )}
            </section>

            <section className="kt-section">
              <h2>Letzte Anrufe</h2>
              {calls.length === 0 ? (
                <p className="tk-empty">Noch keine Anrufe.</p>
              ) : (
                <div className="kt-list">
                  {calls.map((c) => (
                    <div key={c.id} className="kt-list-row kt-call-row">
                      <span className="kt-when">{formatDateTime(c.started_at ?? c.created_at)}</span>
                      <span className="kt-main">
                        <strong>{c.caller_number || "Unbekannte Nummer"}</strong>
                        {c.summary && <span className="kt-summary">{c.summary}</span>}
                      </span>
                      <span className="kt-side">
                        {c.outcome && (
                          <span className={`tk-badge ${c.outcome === "termin" ? "tk-status-bestaetigt" : c.outcome === "rueckruf" ? "tk-status-weitergeleitet" : "tk-status-geplant"}`}>
                            {OUTCOME_LABELS[c.outcome] ?? c.outcome}
                          </span>
                        )}
                        <span className="tk-muted">{formatDuration(c.duration_seconds)}</span>
                      </span>
                    </div>
                  ))}
                </div>
              )}
            </section>
          </div>
        )}
      </div>
    </section>
  );
}
