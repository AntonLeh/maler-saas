// Owner-Übersicht: Registrierungen der letzten 30 Tage nach Herkunft
import { useEffect, useState } from "react";
import * as api from "./api";
import { sourceLabel } from "./success";
import type { OriginData } from "./success";

type T = { id: number; created_at: string; is_platform: boolean };

export default function OriginSummary({ tenants, onOpen }: { tenants: T[]; onOpen: () => void }) {
  const [origins, setOrigins] = useState<Map<number, OriginData> | null>(null);
  const [since] = useState(() => new Date(Date.now() - 30 * 86400000).toISOString().slice(0, 10));
  useEffect(() => {
    let cancel = false;
    void api.loadOrigins().then((m) => !cancel && setOrigins(m));
    return () => {
      cancel = true;
    };
  }, []);
  if (!origins) return null;
  const recent = tenants.filter((t) => !t.is_platform && t.created_at.slice(0, 10) >= since);
  if (!recent.length) return null;
  const counts = new Map<string, number>();
  for (const t of recent) {
    const s = origins.get(t.id)?.source || "direkt";
    counts.set(s, (counts.get(s) ?? 0) + 1);
  }
  const list = [...counts.entries()].sort((a, b) => (a[0] === "direkt" ? 1 : b[0] === "direkt" ? -1 : b[1] - a[1]));
  return (
    <div className="ow2-origins">
      <strong>Registrierungen (30 Tage) nach Herkunft:</strong>
      {list.map(([s, n]) => (
        <span key={s} className="chip">
          {sourceLabel(s)} {n}
        </span>
      ))}
      <button type="button" className="ow2-link" onClick={onOpen}>
        📈 Auswertung
      </button>
    </div>
  );
}
