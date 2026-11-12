// Projektleiter-Dashboard: Stechuhr für Personen ohne App (Leiharbeiter, Subunternehmer …)
import { useCallback, useEffect, useMemo, useState } from "react";
import * as api from "./api";
import type { ClockOpen } from "./api";
import { EMPLOYMENT } from "../mitarbeiter-arten/logic";
import { fmtH, hm, nameOf, suggestedBreak, typeOf } from "./logic";
import type { Person } from "./logic";
import "./st.css";

type Order = { id: string | number; title: string; address_city?: string | null; status?: string };
type Props = {
  people: Person[];
  orders: Order[]; // Aufträge, die ich leite
  assignments: { order_id: string | number; user_id: number }[];
};

const DONE = new Set(["fertig", "abgerechnet", "storniert"]);

export default function TeamClock({ people, orders, assignments }: Props) {
  const [open, setOpen] = useState<ClockOpen[]>([]);
  const [error, setError] = useState("");
  const [now, setNow] = useState(() => Date.now());
  const [busy, setBusy] = useState<number | null>(null);
  const [pick, setPick] = useState<Record<number, string>>({});
  const [stopping, setStopping] = useState<{ userId: number; pause: string } | null>(null);

  const active = orders.filter((o) => !DONE.has(String(o.status ?? "")));
  const team = useMemo(() => {
    const ids = new Set(active.map((o) => String(o.id)));
    return people
      .filter((p) => p.app_access === false && p.is_active !== false && (p.role_id === 3 || p.role_id === 4))
      .map((p) => ({ p, orders: active.filter((o) => assignments.some((a) => Number(a.user_id) === Number(p.id) && String(a.order_id) === String(o.id) && ids.has(String(o.id)))) }))
      .filter((x) => x.orders.length > 0)
      .sort((a, b) => nameOf(a.p).localeCompare(nameOf(b.p), "de"));
  }, [people, active, assignments]);

  const load = useCallback(async () => {
    try {
      setOpen(await api.clockStatus());
      setError("");
    } catch (e) {
      setError((e as Error).message);
    }
  }, []);

  useEffect(() => {
    if (!team.length) return;
    void load();
    const t = window.setInterval(() => setNow(Date.now()), 30000);
    return () => window.clearInterval(t);
  }, [team.length, load]);

  if (!team.length) return null;

  const orderTitle = (id: number) => {
    const o = orders.find((x) => String(x.id) === String(id));
    return o ? `${o.title}${o.address_city ? ` (${o.address_city})` : ""}` : `Auftrag ${id}`;
  };

  const start = async (userId: number, orderId: string) => {
    if (!orderId) return setError("Bitte zuerst den Auftrag wählen.");
    setBusy(userId);
    try {
      await api.clockStart(userId, Number(orderId));
      await load();
    } catch (e) {
      setError((e as Error).message);
    } finally {
      setBusy(null);
    }
  };

  const stop = async () => {
    if (!stopping) return;
    setBusy(stopping.userId);
    try {
      await api.clockStop(stopping.userId, Number(stopping.pause) || 0);
      setStopping(null);
      await load();
    } catch (e) {
      setError((e as Error).message);
    } finally {
      setBusy(null);
    }
  };

  return (
    <section className="pm-card st-clock">
      <h2>Stechuhr für Mitarbeiter ohne App</h2>
      <p className="st-small">Leiharbeiter und Subunternehmer ohne eigenen Zugang: Sie tragen Beginn und Ende der Arbeit für sie ein.</p>
      {error && <p className="st-msg err">{error}</p>}
      <ul className="st-clock-list">
        {team.map(({ p, orders: mine }) => {
          const run = open.find((o) => o.user_id === Number(p.id));
          const gross = run ? (now - new Date(run.started_at).getTime()) / 60000 : 0;
          const sel = pick[p.id] ?? (mine.length === 1 ? String(mine[0].id) : "");
          return (
            <li key={p.id} className={run ? "running" : ""}>
              <div className="st-clock-who">
                <b>{nameOf(p)}</b>
                <small>{EMPLOYMENT[typeOf(p)].short}</small>
                {run ? (
                  <small className="st-clock-run">
                    ● arbeitet seit {hm(run.started_at)} · {fmtH(gross)} Std. · {orderTitle(run.order_id)}
                  </small>
                ) : (
                  <small>nicht eingestempelt</small>
                )}
              </div>
              {run ? (
                stopping?.userId === p.id ? (
                  <div className="st-clock-stop">
                    <label>
                      Pause
                      <input inputMode="numeric" value={stopping.pause} onChange={(e) => setStopping({ ...stopping, pause: e.target.value.replace(/\D/g, "") })} />
                      min
                    </label>
                    <button type="button" className="btn btn-secondary" onClick={() => setStopping(null)}>
                      Zurück
                    </button>
                    <button type="button" className="btn btn-primary" onClick={stop} disabled={busy === p.id}>
                      Ende speichern
                    </button>
                  </div>
                ) : (
                  <button type="button" className="btn btn-danger" onClick={() => setStopping({ userId: p.id, pause: String(suggestedBreak(gross)) })}>
                    ■ Ende
                  </button>
                )
              ) : (
                <div className="st-clock-start">
                  {mine.length > 1 && (
                    <select value={sel} onChange={(e) => setPick({ ...pick, [p.id]: e.target.value })} aria-label="Auftrag">
                      <option value="">Auftrag wählen</option>
                      {mine.map((o) => (
                        <option key={o.id} value={String(o.id)}>
                          {o.title}
                        </option>
                      ))}
                    </select>
                  )}
                  {mine.length === 1 && <small>{mine[0].title}</small>}
                  <button type="button" className="btn btn-primary" onClick={() => start(p.id, sel)} disabled={busy === p.id}>
                    ▶ Beginn
                  </button>
                </div>
              )}
            </li>
          );
        })}
      </ul>
    </section>
  );
}
