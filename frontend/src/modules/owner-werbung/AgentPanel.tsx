// Content- & Planungs-Agent: Einstellungen, Plan vorschlagen, übernehmen, Texte vorbereiten
import { useEffect, useRef, useState } from "react";
import * as api from "./api";
import * as L from "./logic";
import type { AgentGoal, AgentSettings, Post, Proposal } from "./logic";

type Props = {
  posts: Post[];
  onPostsChanged: () => Promise<void> | void;
  onClose: () => void;
  onShowApproval: () => void;
};

const dateDe = (d: string) => new Date(`${d}T12:00:00`).toLocaleDateString("de-DE", { weekday: "short", day: "2-digit", month: "2-digit" });
const GOAL_SHORT: Record<AgentGoal, string> = { tipp: "Tipp", funktion: "Funktion", testphase: "Testphase", saison: "Saison" };

export default function AgentPanel({ posts, onPostsChanged, onClose, onShowApproval }: Props) {
  const [s, setS] = useState<AgentSettings | null | undefined>(undefined);
  const [start, setStart] = useState(L.nextMonday());
  const [weeks, setWeeks] = useState(4);
  const [proposals, setProposals] = useState<(Proposal & { on: boolean })[] | null>(null);
  const [busy, setBusy] = useState("");
  const [msg, setMsg] = useState<{ text: string; ok: boolean } | null>(null);
  const [progress, setProgress] = useState<{ done: number; total: number } | null>(null);
  const stopRef = useRef(false);

  useEffect(() => {
    let cancel = false;
    void api.loadAgent().then((r) => !cancel && setS(r));
    return () => {
      cancel = true;
      stopRef.current = true;
    };
  }, []);

  const withoutTexts = posts.filter((p) => p.source === "agent" && !L.hasTexts(p) && p.status !== "veroeffentlicht");
  const waiting = posts.filter(L.needsApproval).filter(L.hasTexts);

  if (s === undefined) return <div className="ow2-card ow2-agent">Lädt …</div>;
  if (s === null)
    return (
      <div className="ow2-card ow2-agent">
        <p className="ow2-msg err">Für den Agenten fehlt noch das Datenbank-Update (SQL „Owner-Agent“).</p>
        <button type="button" className="btn btn-secondary" onClick={onClose}>
          Schließen
        </button>
      </div>
    );

  const set = (patch: Partial<AgentSettings>) => setS({ ...s, ...patch });
  const toggleDay = (n: number) => {
    const next = s.weekdays.includes(n) ? s.weekdays.filter((d) => d !== n) : [...s.weekdays, n].sort();
    if (next.length) set({ weekdays: next });
  };
  const toggleChannel = (k: string) => {
    const next = s.channels.includes(k) ? s.channels.filter((c) => c !== k) : [...s.channels, k];
    if (next.length) set({ channels: next });
  };
  const pct = L.mixPercent(s.mix);

  const saveSettings = async (quiet = false) => {
    try {
      await api.saveAgent(s);
      if (!quiet) setMsg({ text: "Einstellungen gespeichert.", ok: true });
    } catch (e) {
      setMsg({ text: (e as Error).message, ok: false });
    }
  };

  const propose = async () => {
    setMsg(null);
    setBusy("plan");
    setProposals(null);
    try {
      await api.saveAgent(s).catch(() => undefined);
      const items = await api.proposePlan({ start, weeks, weekdays: s.weekdays, mix: s.mix, youtube_per_month: s.youtube_per_month });
      setProposals(items.map((it) => ({ ...it, on: true })));
    } catch (e) {
      setMsg({ text: (e as Error).message, ok: false });
    } finally {
      setBusy("");
    }
  };

  const runPrepare = async (ids: number[]) => {
    if (!ids.length) return;
    stopRef.current = false;
    setBusy("prepare");
    setProgress({ done: 0, total: ids.length });
    let done = 0;
    let failedRounds = 0;
    try {
      while (!stopRef.current) {
        const r = await api.prepare(ids);
        done += r.done;
        setProgress({ done: Math.min(done, ids.length), total: ids.length });
        await onPostsChanged();
        if (r.remaining <= 0) break;
        if (r.done === 0 && ++failedRounds >= 2) {
          setMsg({ text: "Einige Texte konnten nicht erstellt werden. Bitte später erneut „Texte schreiben“ tippen.", ok: false });
          break;
        }
      }
      if (done >= ids.length) setMsg({ text: `Fertig: ${done} Beiträge vorbereitet. Bitte prüfen und freigeben.`, ok: true });
    } catch (e) {
      setMsg({ text: (e as Error).message, ok: false });
    } finally {
      setBusy("");
      setProgress(null);
    }
  };

  const accept = async () => {
    const chosen = (proposals ?? []).filter((p) => p.on && p.topic.trim());
    if (!chosen.length) return setMsg({ text: "Bitte mindestens einen Vorschlag auswählen.", ok: false });
    setBusy("accept");
    setMsg(null);
    try {
      const saved = await api.acceptProposals(chosen, s.channels);
      setProposals(null);
      await onPostsChanged();
      await runPrepare(saved.map((p) => p.id));
    } catch (e) {
      setMsg({ text: (e as Error).message, ok: false });
      setBusy("");
    }
  };

  const edit = (i: number, patch: Partial<Proposal & { on: boolean }>) => setProposals((list) => (list ?? []).map((p, j) => (j === i ? { ...p, ...patch } : p)));
  const chosenCount = (proposals ?? []).filter((p) => p.on).length;

  return (
    <div className="ow2-card ow2-agent">
      <div className="ow2-agent-head">
        <div>
          <h3>🤖 Content- & Planungs-Agent</h3>
          <p className="ow2-small">Der Agent plant Themen, schreibt die Texte und wählt Grafik-Vorlage und Screenshot vor. Veröffentlicht wird nur, was Sie freigeben.</p>
        </div>
        <button type="button" className="btn btn-secondary" onClick={onClose} disabled={busy === "prepare"}>
          Schließen
        </button>
      </div>

      {(waiting.length > 0 || withoutTexts.length > 0) && (
        <div className="ow2-agent-status">
          {waiting.length > 0 && (
            <button type="button" className="ow2-pill warn" onClick={onShowApproval}>
              ✋ {waiting.length} {waiting.length === 1 ? "Beitrag wartet" : "Beiträge warten"} auf Freigabe
            </button>
          )}
          {withoutTexts.length > 0 && busy !== "prepare" && (
            <button type="button" className="ow2-pill" onClick={() => runPrepare(withoutTexts.map((p) => p.id))}>
              ✍️ Texte für {withoutTexts.length} {withoutTexts.length === 1 ? "Beitrag" : "Beiträge"} schreiben
            </button>
          )}
        </div>
      )}

      <div className="ow2-form">
        <div className="ow2-field">
          <label>Wochentage</label>
          <div className="ow2-days">
            {L.WEEKDAY_SHORT.map((d, i) => (
              <button key={d} type="button" className={s.weekdays.includes(i + 1) ? "on" : ""} onClick={() => toggleDay(i + 1)}>
                {d}
              </button>
            ))}
          </div>
          <small>{s.weekdays.length} Beiträge pro Woche</small>
        </div>
        <div className="ow2-field">
          <label>Kanäle</label>
          <div className="ow2-days">
            {L.AGENT_CHANNELS.map((c) => (
              <button key={c.key} type="button" className={s.channels.includes(c.key) ? "on wide" : "wide"} onClick={() => toggleChannel(c.key)}>
                {c.label}
              </button>
            ))}
          </div>
          <label className="ow2-inline">
            YouTube-Erklärvideos pro Monat
            <select value={s.youtube_per_month} onChange={(e) => set({ youtube_per_month: Number(e.target.value) })}>
              {[0, 1, 2, 3, 4].map((n) => (
                <option key={n} value={n}>
                  {n}
                </option>
              ))}
            </select>
          </label>
        </div>
        <div className="ow2-field full">
          <label>Mischung</label>
          <div className="ow2-mix">
            {L.AGENT_GOALS.map((g) => (
              <label key={g}>
                <span>
                  {L.GOAL_LABELS[g]} <b>{pct[g]} %</b>
                </span>
                <input type="range" min={0} max={100} step={5} value={s.mix[g]} onChange={(e) => set({ mix: { ...s.mix, [g]: Number(e.target.value) } })} />
              </label>
            ))}
          </div>
        </div>
        <div className="ow2-field full">
          <label className="ow2-check ow2-auto">
            <input type="checkbox" checked={s.auto_enabled} onChange={(e) => set({ auto_enabled: e.target.checked })} />
            <span>
              <b>Automatikmodus</b> – ab dem 25. jedes Monats plant der Agent den Folgemonat selbst und schreibt in den Tagen danach die Texte. Sie bekommen eine Nachricht,
              sobald alles zur Freigabe bereitliegt.
              {s.last_plan_month && <small> Zuletzt automatisch geplant: {s.last_plan_month}</small>}
            </span>
          </label>
          <div className="ow2-actions left">
            <button type="button" className="btn btn-secondary" onClick={() => saveSettings()} disabled={!!busy}>
              Einstellungen speichern
            </button>
          </div>
        </div>
      </div>

      <div className="ow2-agent-plan">
        <h4>Plan jetzt vorschlagen</h4>
        <div className="ow2-form">
          <div className="ow2-field">
            <label>Ab</label>
            <input type="date" value={start} onChange={(e) => setStart(e.target.value)} />
          </div>
          <div className="ow2-field">
            <label>Zeitraum</label>
            <select value={weeks} onChange={(e) => setWeeks(Number(e.target.value))}>
              {[1, 2, 4, 6, 8].map((w) => (
                <option key={w} value={w}>
                  {w} {w === 1 ? "Woche" : "Wochen"} (≈ {w * s.weekdays.length} Beiträge)
                </option>
              ))}
            </select>
          </div>
        </div>
        <div className="ow2-actions left">
          <button type="button" className="btn btn-primary" onClick={propose} disabled={!!busy}>
            {busy === "plan" ? "Agent plant … (ca. 30–60 Sek.)" : "🤖 Plan vorschlagen"}
          </button>
        </div>
      </div>

      {msg && <p className={`ow2-msg ${msg.ok ? "ok" : "err"}`}>{msg.text}</p>}

      {progress && (
        <div className="ow2-progress">
          <span>
            ✍️ Texte werden geschrieben: {progress.done} von {progress.total} (je Beitrag ca. 20 Sek., 3 gleichzeitig)
          </span>
          <i style={{ width: `${(progress.done / Math.max(1, progress.total)) * 100}%` }} />
          <button type="button" className="ow2-link" onClick={() => (stopRef.current = true)}>
            Anhalten
          </button>
        </div>
      )}

      {proposals && (
        <div className="ow2-proposals">
          <div className="ow2-prop-head">
            <b>{proposals.length} Vorschläge</b>
            <button type="button" className="ow2-link" onClick={() => setProposals(proposals.map((p) => ({ ...p, on: chosenCount < proposals.length })))}>
              {chosenCount < proposals.length ? "Alle auswählen" : "Keine auswählen"}
            </button>
          </div>
          {proposals.map((p, i) => (
            <div key={i} className={`ow2-prop${p.on ? "" : " off"}`}>
              <input type="checkbox" checked={p.on} onChange={(e) => edit(i, { on: e.target.checked })} aria-label="übernehmen" />
              <div className="ow2-prop-main">
                <div className="ow2-prop-row">
                  <input type="date" value={p.date} onChange={(e) => edit(i, { date: e.target.value })} title={dateDe(p.date)} />
                  <select value={p.goal} onChange={(e) => edit(i, { goal: e.target.value as AgentGoal })}>
                    {L.AGENT_GOALS.map((g) => (
                      <option key={g} value={g}>
                        {GOAL_SHORT[g]}
                      </option>
                    ))}
                  </select>
                  {p.youtube && <span className="ow2-yt">▶ YouTube</span>}
                </div>
                <input className="ow2-prop-topic" value={p.topic} onChange={(e) => edit(i, { topic: e.target.value })} />
                <input className="ow2-prop-hook" value={p.hook} onChange={(e) => edit(i, { hook: e.target.value })} placeholder="Aufhänger" />
                <small>💡 {p.reason}</small>
              </div>
            </div>
          ))}
          <div className="ow2-actions">
            <button type="button" className="btn btn-secondary" onClick={() => setProposals(null)} disabled={!!busy}>
              Verwerfen
            </button>
            <button type="button" className="btn btn-primary" onClick={accept} disabled={!!busy || !chosenCount}>
              {busy === "accept" ? "Speichert …" : `Übernehmen & Texte schreiben (${chosenCount})`}
            </button>
          </div>
        </div>
      )}
    </div>
  );
}
