// Urlaub: Hinweis im Chef-Dashboard, „Abwesend“-Karte für Projektleiter, Warnung bei der Zuteilung
import { useEffect, useState } from "react";
import * as api from "./api";
import type { TeamAbsence } from "./api";
import { addDays, balance, canBeAbsent, deShort, EMPTY_LEAVE, fmtNum, hasLeave, KINDS, personName, todayIso } from "./logic";
import type { Absence, UPerson } from "./logic";
import "./ur.css";

const range = (a: { start_date: string; end_date: string }) => (a.start_date === a.end_date ? deShort(a.start_date) : `${deShort(a.start_date)} – ${deShort(a.end_date)}`);

// ---------- Chef-Dashboard ----------
export function AbsenceBar({ tenantId, people, onOpen }: { tenantId: number; people: UPerson[]; onOpen: () => void }) {
  const [data, setData] = useState<{ abs: Absence[]; rest: { p: UPerson; rest: number }[]; pending: number } | null>(null);
  useEffect(() => {
    let cancel = false;
    (async () => {
      const today = todayIso();
      const now = new Date();
      const [abs, leaves, cal] = await Promise.all([api.loadAbsences(tenantId, `${now.getFullYear()}-01-01`), api.loadLeaves(tenantId), api.loadCalendar(tenantId)]);
      if (cancel || !abs) return;
      const rest =
        now.getMonth() >= 9
          ? people
              .filter((p) => hasLeave(p) && p.is_active !== false && (leaves.get(p.id)?.vacation_days ?? 0) > 0)
              .map((p) => ({ p, rest: balance(leaves.get(p.id) ?? EMPTY_LEAVE(p.id, tenantId), now.getFullYear(), abs, cal, p.exit_date, today).rest }))
              .filter((x) => x.rest > 0)
          : [];
      setData({ abs: abs.filter((a) => a.status === "genehmigt" && a.end_date >= today && a.start_date <= addDays(today, 14)), rest, pending: abs.filter((a) => a.status === "beantragt").length });
    })();
    return () => {
      cancel = true;
    };
  }, [tenantId, people]);

  if (!data) return null;
  const today = todayIso();
  const name = (id: number) => personName(people.find((p) => p.id === Number(id)));
  const now = data.abs.filter((a) => a.start_date <= today);
  const soon = data.abs.filter((a) => a.start_date > today);
  return (
    <div className="ur-bar">
      <div>
        <strong>🏖 Urlaub & Abwesenheiten</strong>
        <span>
          {now.length ? `Heute abwesend: ${now.map((a) => `${name(a.user_id)} (${KINDS[a.kind].short})`).join(", ")}` : "Heute sind alle da."}
          {soon.length > 0 && ` · Demnächst: ${soon.slice(0, 4).map((a) => `${name(a.user_id)} ${range(a)}`).join(", ")}${soon.length > 4 ? " …" : ""}`}
        </span>
        {data.pending > 0 && <span className="ur-bar-warn">📨 {data.pending === 1 ? "1 offener Antrag" : `${data.pending} offene Anträge`} – bitte genehmigen oder ablehnen</span>}
        {data.rest.length > 0 && <span className="ur-bar-warn">Resturlaub offen: {data.rest.map((x) => `${personName(x.p)} ${fmtNum(x.rest)} T.`).join(", ")}</span>}
      </div>
      <button type="button" className="btn btn-secondary btn-small" onClick={onOpen}>
        Öffnen
      </button>
    </div>
  );
}

// ---------- Projektleiter: wer fehlt (ohne Grund) ----------
export function TeamAbsenceCard({ people }: { people: UPerson[] }) {
  const [list, setList] = useState<TeamAbsence[]>([]);
  useEffect(() => {
    const t = todayIso();
    void api.loadTeamAbsences(t, addDays(t, 14)).then(setList);
  }, []);
  const team = new Set(people.filter(canBeAbsent).map((p) => p.id));
  const mine = list.filter((a) => team.has(Number(a.user_id))).sort((a, b) => a.start_date.localeCompare(b.start_date));
  if (!mine.length) return null;
  const today = todayIso();
  return (
    <section className="pm-card ur-pm">
      <h2>Abwesend (nächste 14 Tage)</h2>
      <ul>
        {mine.map((a, i) => (
          <li key={i} className={a.start_date <= today ? "now" : ""}>
            <b>{personName(people.find((p) => p.id === Number(a.user_id)))}</b>
            <span>{a.start_date <= today ? `abwesend bis ${deShort(a.end_date)}` : range(a)}</span>
          </li>
        ))}
      </ul>
    </section>
  );
}

// ---------- Warnung bei der Zuteilung ----------
export function AbsenceAssignWarning({ selected, from, to }: { selected: UPerson[]; from?: string | null; to?: string | null }) {
  const [list, setList] = useState<TeamAbsence[]>([]);
  const f = (from || "").slice(0, 10);
  const t = (to || from || "").slice(0, 10);
  const valid = !!f && !!t && t >= f;
  useEffect(() => {
    if (!valid) return;
    let cancel = false;
    void api.loadTeamAbsences(f, t).then((r) => !cancel && setList(r));
    return () => {
      cancel = true;
    };
  }, [f, t, valid]);
  if (!valid) return null;
  const hits = selected
    .map((p) => ({ p, a: list.filter((a) => Number(a.user_id) === Number(p.id)) }))
    .filter((x) => x.a.length);
  if (!hits.length) return null;
  return (
    <div className="ur-assign">
      <strong>🏖 Im Auftragszeitraum abwesend</strong>
      {hits.map(({ p, a }) => (
        <p key={p.id}>
          <b>{personName(p)}:</b> {a.map(range).join(", ")}
        </p>
      ))}
    </div>
  );
}
