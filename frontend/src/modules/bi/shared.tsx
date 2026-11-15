// Zeitraum-Auswahl der BI-Seiten
import { PERIODS } from "./logic";
import type { PeriodKey } from "./logic";

export function PeriodTabs({ value, onChange }: { value: PeriodKey; onChange: (p: PeriodKey) => void }) {
  return (
    <div className="bi2-periods" role="tablist" aria-label="Zeitraum">
      {PERIODS.map((p) => (
        <button key={p.key} type="button" role="tab" aria-selected={value === p.key} className={value === p.key ? "on" : ""} onClick={() => onChange(p.key)}>
          {p.label}
        </button>
      ))}
    </div>
  );
}
