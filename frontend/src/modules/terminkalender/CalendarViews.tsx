import type { Appointment } from "./types";
import {
  WEEKDAYS_SHORT,
  addDays,
  formatDateLong,
  formatTime,
  isSameDay,
  overlapsDay,
  startOfMonth,
  startOfWeek,
} from "./dateUtils";
import { AppointmentChip, StatusBadge } from "./ui";

type ViewProps = {
  anchor: Date;
  appointments: Appointment[];
  nameFor: (a: Appointment) => string;
  onSelect: (a: Appointment) => void;
  onCreateAt: (day: Date) => void;
};

function forDay(appointments: Appointment[], day: Date) {
  return appointments
    .filter((a) => overlapsDay(a.starts_at, a.ends_at, day))
    .sort((x, y) => x.starts_at.localeCompare(y.starts_at));
}

export function MonthView({ anchor, appointments, onSelect, onCreateAt }: Omit<ViewProps, "nameFor">) {
  const first = startOfMonth(anchor);
  const gridStart = startOfWeek(first);
  const days = Array.from({ length: 42 }, (_, i) => addDays(gridStart, i));
  const today = new Date();
  const MAX = 3;

  return (
    <div className="tk-month">
      {WEEKDAYS_SHORT.map((d) => (
        <div key={d} className="tk-month-weekday">
          {d}
        </div>
      ))}
      {days.map((day) => {
        const items = forDay(appointments, day);
        const outside = day.getMonth() !== first.getMonth();
        return (
          <div
            key={day.toISOString()}
            className={`tk-month-cell${outside ? " tk-outside" : ""}${isSameDay(day, today) ? " tk-today" : ""}`}
            onClick={() => onCreateAt(day)}
            role="button"
            tabIndex={0}
            onKeyDown={(e) => {
              if (e.key === "Enter") onCreateAt(day);
            }}
            aria-label={`Termin am ${formatDateLong(day)} anlegen`}
          >
            <span className="tk-month-daynum">{day.getDate()}</span>
            <div className="tk-month-items">
              {items.slice(0, MAX).map((a) => (
                <AppointmentChip key={a.id} appointment={a} compact onClick={() => onSelect(a)} />
              ))}
              {items.length > MAX && <span className="tk-more">+{items.length - MAX} weitere</span>}
            </div>
            {items.length > 0 && <span className="tk-dot-count">{items.length}</span>}
          </div>
        );
      })}
    </div>
  );
}

export function WeekView({ anchor, appointments, nameFor, onSelect, onCreateAt }: ViewProps) {
  const start = startOfWeek(anchor);
  const days = Array.from({ length: 7 }, (_, i) => addDays(start, i));
  const today = new Date();

  return (
    <div className="tk-week">
      {days.map((day, i) => {
        const items = forDay(appointments, day);
        return (
          <div key={day.toISOString()} className={`tk-week-col${isSameDay(day, today) ? " tk-today" : ""}`}>
            <div className="tk-week-head">
              <span>{WEEKDAYS_SHORT[i]}</span>
              <strong>{day.toLocaleDateString("de-DE", { day: "2-digit", month: "2-digit" })}</strong>
            </div>
            <div className="tk-week-items">
              {items.map((a) => (
                <AppointmentChip key={a.id} appointment={a} onClick={() => onSelect(a)} assigneeName={nameFor(a)} />
              ))}
              <button type="button" className="tk-add-slot" onClick={() => onCreateAt(day)}>
                + Termin
              </button>
            </div>
          </div>
        );
      })}
    </div>
  );
}

export function ListView({ appointments, nameFor, onSelect }: Omit<ViewProps, "anchor" | "onCreateAt">) {
  if (appointments.length === 0) {
    return <p className="tk-empty">Keine Termine in diesem Zeitraum.</p>;
  }

  const groups = new Map<string, Appointment[]>();
  const sorted = [...appointments].sort((x, y) => x.starts_at.localeCompare(y.starts_at));
  for (const a of sorted) {
    const key = new Date(a.starts_at).toDateString();
    groups.set(key, [...(groups.get(key) ?? []), a]);
  }

  return (
    <div className="tk-list">
      {[...groups.entries()].map(([key, items]) => (
        <section key={key} className="tk-list-group">
          <h3>{formatDateLong(new Date(key))}</h3>
          {items.map((a) => (
            <button key={a.id} type="button" className="tk-list-row" onClick={() => onSelect(a)}>
              <span className="tk-list-time">
                {formatTime(a.starts_at)}–{formatTime(a.ends_at)}
              </span>
              <span className="tk-list-main">
                <strong>
                  {a.source === "ki_telefon" && "🤖 "}
                  {a.title}
                </strong>
                {a.location && <span className="tk-muted">{a.location}</span>}
              </span>
              <span className="tk-list-side">
                <StatusBadge status={a.status} />
                <span className="tk-muted">{nameFor(a)}</span>
              </span>
            </button>
          ))}
        </section>
      ))}
    </div>
  );
}
