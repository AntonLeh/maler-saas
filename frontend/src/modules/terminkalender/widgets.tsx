import { useEffect, useState } from "react";
import { supabase } from "../../lib/supabase";

/**
 * Kachel für das Admin-Dashboard (passt in das bestehende stats-grid).
 * Zeigt die Anzahl aktiver Termine der nächsten 7 Tage.
 * Fehler (z. B. Tabelle noch nicht angelegt) werden still als "–" angezeigt.
 */
export function TermineStatCard({ tenantId, onOpen }: { tenantId: number; onOpen: () => void }) {
  const [count, setCount] = useState<number | null>(null);

  useEffect(() => {
    let cancelled = false;
    const from = new Date();
    from.setHours(0, 0, 0, 0);
    const to = new Date(from);
    to.setDate(to.getDate() + 7);

    supabase
      .from("appointments")
      .select("id", { count: "exact", head: true })
      .eq("tenant_id", tenantId)
      .neq("status", "abgesagt")
      .gte("starts_at", from.toISOString())
      .lt("starts_at", to.toISOString())
      .then(({ count: c, error }) => {
        if (!cancelled) setCount(error ? null : c ?? 0);
      });

    return () => {
      cancelled = true;
    };
  }, [tenantId]);

  return (
    <button type="button" className="stat-card stat-card-clickable" onClick={onOpen}>
      <span className="stat-label">Termine (7 Tage)</span>
      <strong className="stat-value">{count ?? "–"}</strong>
    </button>
  );
}

/**
 * Button für das Projektleiter-Dashboard mit Anzahl offener Anfragen.
 */
export function MeineTermineButton({ userId, onOpen }: { userId: number; onOpen: () => void }) {
  const [open, setOpen] = useState(0);

  useEffect(() => {
    let cancelled = false;
    supabase
      .from("appointments")
      .select("id", { count: "exact", head: true })
      .eq("assigned_to", userId)
      .eq("status", "weitergeleitet")
      .then(({ count, error }) => {
        if (!cancelled && !error) setOpen(count ?? 0);
      });
    return () => {
      cancelled = true;
    };
  }, [userId]);

  return (
    <button type="button" className="btn btn-primary" onClick={onOpen}>
      Meine Termine {open > 0 ? `(${open} offen)` : ""}
    </button>
  );
}
