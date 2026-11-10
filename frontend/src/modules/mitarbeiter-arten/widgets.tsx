// Kleine Bausteine für die Mitarbeiterliste (werden direkt in App.tsx genutzt)
import { EMPLOYMENT, EMPLOYMENT_ORDER } from "./logic";
import type { EmploymentType } from "./logic";
import "./ea.css";

const typeOf = (t: string | null | undefined): EmploymentType => (t && t in EMPLOYMENT ? (t as EmploymentType) : "gewerblich");

export function EmploymentBadges({ type, appAccess }: { type?: string | null; appAccess?: boolean | null }) {
  const e = EMPLOYMENT[typeOf(type)];
  return (
    <div style={{ display: "flex", gap: 6, flexWrap: "wrap", margin: "4px 0" }}>
      <span className="ea-chip" style={{ background: e.bg, color: e.color }}>
        {e.short}
      </span>
      {appAccess === false && <span className="ea-noapp">ohne App</span>}
    </div>
  );
}

type Emp = { role_id: number; employment_type?: string | null };

export function EmploymentFilter({ employees, value, onChange }: { employees: Emp[]; value: string; onChange: (v: string) => void }) {
  const staff = employees.filter((e) => e.role_id === 3 || e.role_id === 4);
  const counts = new Map<EmploymentType, number>();
  staff.forEach((e) => counts.set(typeOf(e.employment_type), (counts.get(typeOf(e.employment_type)) ?? 0) + 1));
  const used = EMPLOYMENT_ORDER.filter((k) => counts.get(k));
  if (used.length < 2 && !value) return null; // nur eine Art → kein Filter nötig
  return (
    <div className="ea-filter" role="group" aria-label="Nach Beschäftigungsart filtern">
      <button type="button" className={!value ? "on" : ""} onClick={() => onChange("")}>
        Alle
      </button>
      {used.map((k) => (
        <button key={k} type="button" className={value === k ? "on" : ""} onClick={() => onChange(value === k ? "" : k)}>
          {EMPLOYMENT[k].short}
          <span>{counts.get(k)}</span>
        </button>
      ))}
    </div>
  );
}
