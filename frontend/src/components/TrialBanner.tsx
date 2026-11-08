// Hinweis „Kostenlose Testphase“ auf dem Dashboard: zählt die verbleibenden Tage herunter (am letzten Tag Stunden)

import { useEffect, useState } from "react";

type TrialBannerProps = {
  /** Ende der Testphase (ISO) – daraus wird live gerechnet */
  endsAt?: string | null;
  /** Rückfall, falls kein Enddatum übergeben wird */
  daysLeft?: number;
  totalDays?: number;
  onUpgrade: () => void;
};

const HOUR = 3600000;
const DAY = 24 * HOUR;

export default function TrialBanner({ endsAt, daysLeft, totalDays = 14, onUpgrade }: TrialBannerProps) {
  const [now, setNow] = useState(() => Date.now());
  useEffect(() => {
    const id = window.setInterval(() => setNow(Date.now()), 60000);
    return () => window.clearInterval(id);
  }, []);

  const end = endsAt ? new Date(endsAt).getTime() : now + (daysLeft ?? 0) * DAY;
  const msLeft = Math.max(0, end - now);
  const days = Math.ceil(msLeft / DAY);
  const hours = Math.ceil(msLeft / HOUR);
  const over = msLeft <= 0;
  const urgent = !over && days <= 3;
  const pct = Math.max(0, Math.min(100, (msLeft / (totalDays * DAY)) * 100));
  const dateText = new Date(end).toLocaleDateString("de-DE", { day: "2-digit", month: "2-digit", year: "numeric" });

  const big = days <= 1 ? (hours <= 1 ? "noch weniger als 1 Stunde" : `noch ${hours} Stunden`) : `noch ${days} Tage`;

  return (
    <div className={`trial-banner${urgent ? " urgent" : ""}${over ? " over" : ""}`} role="status">
      <div className="trial-banner-count" aria-hidden="true">
        <b>{over ? "0" : days <= 1 ? hours : days}</b>
        <span>{over ? "Tage" : days <= 1 ? (hours === 1 ? "Stunde" : "Std.") : "Tage"}</span>
      </div>
      <div className="trial-banner-text">
        <strong>{over ? "Ihre kostenlose Testphase ist beendet" : `Kostenlose Testphase – ${big}`}</strong>
        <span>
          {over
            ? "Wählen Sie einen Tarif, um MalerSaaS weiter zu nutzen."
            : `Alle Funktionen frei bis ${dateText}. Danach endet die Testphase automatisch – es entstehen keine Kosten.`}
        </span>
        <div className="trial-banner-bar" aria-hidden="true">
          <i style={{ width: `${pct}%` }} />
        </div>
      </div>
      <button type="button" className="btn btn-primary" onClick={onUpgrade}>
        Tarif wählen
      </button>
    </div>
  );
}
