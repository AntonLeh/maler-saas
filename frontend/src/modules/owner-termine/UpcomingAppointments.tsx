// Owner-Übersicht: Termine heute und morgen
import { useEffect, useState } from "react";
import * as api from "./api";
import * as L from "./logic";
import type { Occurrence } from "./logic";
import "./ot.css";

export default function UpcomingAppointments({ onOpen }: { onOpen: () => void }) {
  const [occ, setOcc] = useState<Occurrence[] | null>(null);

  useEffect(() => {
    const today = L.startOfDay(new Date());
    api
      .loadAppointments()
      .then((list) => setOcc(L.expand(list, today, L.addDays(today, 2))))
      .catch(() => setOcc(null)); // ohne SQL-Update einfach ausblenden
  }, []);

  if (occ === null) return null;
  const today = L.startOfDay(new Date());
  const tomorrow = L.addDays(today, 1);
  const days: [string, Occurrence[]][] = [
    ["Heute", L.onDay(occ, today)],
    ["Morgen", L.onDay(occ, tomorrow)],
  ];

  return (
    <div className="ot-upcoming">
      <div className="ot-up-head">
        <h3>📅 Termine</h3>
        <button type="button" className="ot-link" onClick={onOpen}>
          Kalender öffnen →
        </button>
      </div>
      <div className="ot-up-days">
        {days.map(([label, items]) => (
          <div key={label}>
            <h4>{label}</h4>
            {items.length === 0 ? (
              <p className="ot-none">Keine Termine</p>
            ) : (
              items.map((o) => {
                const k = L.KINDS[o.appt.kind] ?? L.KINDS.sonstiges;
                return (
                  <button key={o.key} type="button" className="ot-lrow" onClick={onOpen}>
                    <span className="ot-time">{L.timeLabel(o)}</span>
                    <span className="ot-dot" style={{ background: k.color }} />
                    <span className="ot-ltext">
                      <b>{o.appt.title}</b>
                      {o.appt.location && <small>{o.appt.location}</small>}
                    </span>
                  </button>
                );
              })
            )}
          </div>
        ))}
      </div>
    </div>
  );
}
