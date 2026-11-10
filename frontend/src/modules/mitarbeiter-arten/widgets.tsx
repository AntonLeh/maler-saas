// Kleine Bausteine für die Mitarbeiterliste (werden direkt in App.tsx genutzt)
import { useState } from "react";
import { showAlert } from "../../lib/dialogs";
import * as api from "./api";
import {
  EMPLOYMENT,
  EMPLOYMENT_ORDER,
  EXIT_FILTER,
  EXIT_REASONS,
} from "./logic";
import type { EmploymentType } from "./logic";
import "./ea.css";

const typeOf = (t: string | null | undefined): EmploymentType =>
  t && t in EMPLOYMENT ? (t as EmploymentType) : "gewerblich";
const de = (d: string) => new Date(`${d}T12:00:00`).toLocaleDateString("de-DE");
const todayIso = () => {
  const d = new Date();
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
};

export function EmploymentBadges({
  type,
  appAccess,
  isActive,
  exitDate,
}: {
  type?: string | null;
  appAccess?: boolean | null;
  isActive?: boolean | null;
  exitDate?: string | null;
}) {
  const e = EMPLOYMENT[typeOf(type)];
  return (
    <div style={{ display: "flex", gap: 6, flexWrap: "wrap", margin: "4px 0" }}>
      <span className="ea-chip" style={{ background: e.bg, color: e.color }}>
        {e.short}
      </span>
      {isActive === false ? (
        <span className="ea-exit">
          ausgeschieden{exitDate ? ` am ${de(exitDate)}` : ""}
        </span>
      ) : (
        appAccess === false && <span className="ea-noapp">ohne App</span>
      )}
    </div>
  );
}

type Emp = {
  role_id: number;
  employment_type?: string | null;
  is_active?: boolean | null;
};

export function EmploymentFilter({
  employees,
  value,
  onChange,
}: {
  employees: Emp[];
  value: string;
  onChange: (v: string) => void;
}) {
  const staff = employees.filter(
    (e) => (e.role_id === 3 || e.role_id === 4) && e.is_active !== false,
  );
  const exited = employees.filter((e) => e.is_active === false).length;
  const counts = new Map<EmploymentType, number>();
  staff.forEach((e) =>
    counts.set(
      typeOf(e.employment_type),
      (counts.get(typeOf(e.employment_type)) ?? 0) + 1,
    ),
  );
  const used = EMPLOYMENT_ORDER.filter((k) => counts.get(k));
  if (used.length < 2 && !exited && !value) return null; // nichts zu filtern
  return (
    <div className="ea-filter" role="group" aria-label="Mitarbeiter filtern">
      <button
        type="button"
        className={!value ? "on" : ""}
        onClick={() => onChange("")}
      >
        Alle aktiven
      </button>
      {used.length > 1 &&
        used.map((k) => (
          <button
            key={k}
            type="button"
            className={value === k ? "on" : ""}
            onClick={() => onChange(value === k ? "" : k)}
          >
            {EMPLOYMENT[k].short}
            <span>{counts.get(k)}</span>
          </button>
        ))}
      {exited > 0 && (
        <button
          type="button"
          className={value === EXIT_FILTER ? "on" : ""}
          onClick={() => onChange(value === EXIT_FILTER ? "" : EXIT_FILTER)}
        >
          Ausgeschieden
          <span>{exited}</span>
        </button>
      )}
    </div>
  );
}

type Person = {
  id: number;
  tenant_id: number;
  role_id: number;
  first_name: string | null;
  last_name: string | null;
  employment_type?: string | null;
  app_access?: boolean | null;
  is_active?: boolean | null;
};

/** Knopf „Austritt“ bzw. „Wieder aufnehmen“ mit kleinem Formular darunter */
export function ExitControl({
  person,
  onDone,
}: {
  person: Person;
  onDone: (message: string) => void;
}) {
  const [open, setOpen] = useState(false);
  const [date, setDate] = useState(todayIso());
  const [reason, setReason] = useState(
    typeOf(person.employment_type) === "leiharbeit" ? "Einsatz beendet" : "",
  );
  const [start, setStart] = useState(todayIso());
  const [busy, setBusy] = useState(false);
  const name = `${person.first_name ?? ""} ${person.last_name ?? ""}`.trim();
  const exited = person.is_active === false;
  const leih = typeOf(person.employment_type) === "leiharbeit";
  if (person.role_id !== 3 && person.role_id !== 4) return null;

  const run = async () => {
    setBusy(true);
    try {
      if (exited) {
        await api.rejoinPerson(person.id);
        if (leih && start)
          await api
            .setAssignmentStart(person.id, person.tenant_id, start)
            .catch(() => undefined);
        onDone(
          `${name} ist wieder aufgenommen${person.app_access !== false ? " – die Anmeldung ist wieder freigegeben" : ""}.`,
        );
      } else {
        if (!date) return;
        await api.exitPerson(person.id, date, reason);
        onDone(
          `Austritt von ${name} zum ${de(date)} eingetragen. Stunden und Daten bleiben erhalten${person.app_access !== false ? ", die Anmeldung ist gesperrt" : ""}.`,
        );
      }
      setOpen(false);
    } catch (e) {
      await showAlert((e as Error).message, { tone: "error" });
    } finally {
      setBusy(false);
    }
  };

  return (
    <>
      <button
        type="button"
        className="btn btn-secondary btn-small"
        onClick={() => setOpen((o) => !o)}
      >
        {exited ? "Wieder aufnehmen" : "Austritt"}
      </button>
      {open && (
        <div className="ea-modal-bg" onClick={() => !busy && setOpen(false)}>
          <div
            className="ea-exitbox"
            role="dialog"
            aria-modal="true"
            onClick={(e) => e.stopPropagation()}
          >
            {exited ? (
              <>
                <b>{name} wieder aufnehmen?</b>
                {leih && (
                  <label className="ea-field">
                    <span>Neuer Einsatzbeginn</span>
                    <input
                      type="date"
                      value={start}
                      onChange={(e) => setStart(e.target.value)}
                    />
                  </label>
                )}
                <small>
                  {person.app_access !== false
                    ? "Die Anmeldung wird wieder freigegeben und zählt zur Mitarbeiterzahl Ihres Tarifs."
                    : "Ohne App-Zugang – zählt nicht zum Tarif."}
                </small>
              </>
            ) : (
              <>
                <b>Austritt von {name}</b>
                <label className="ea-field">
                  <span>Letzter Arbeitstag / Austritt</span>
                  <input
                    type="date"
                    value={date}
                    max={todayIso()}
                    onChange={(e) => setDate(e.target.value)}
                  />
                </label>
                <label className="ea-field">
                  <span>Grund (optional)</span>
                  <select
                    value={reason}
                    onChange={(e) => setReason(e.target.value)}
                  >
                    <option value="">–</option>
                    {EXIT_REASONS.map((r) => (
                      <option key={r} value={r}>
                        {r}
                      </option>
                    ))}
                  </select>
                </label>
                <small>
                  Die Person kann danach keinen Aufträgen mehr zugeteilt werden
                  {person.app_access !== false
                    ? " und sich nicht mehr anmelden"
                    : ""}
                  . Stunden, Fotos und Material bleiben für Abrechnung und
                  Nachkalkulation erhalten.
                </small>
              </>
            )}
            <div className="ea-exit-actions">
              <button
                type="button"
                className="btn btn-secondary btn-small"
                onClick={() => setOpen(false)}
              >
                Abbrechen
              </button>
              <button
                type="button"
                className="btn btn-primary btn-small"
                onClick={run}
                disabled={busy}
              >
                {busy
                  ? "…"
                  : exited
                    ? "Wieder aufnehmen"
                    : "Austritt eintragen"}
              </button>
            </div>
          </div>
        </div>
      )}
    </>
  );
}
