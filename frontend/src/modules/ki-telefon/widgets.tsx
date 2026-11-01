import { useEffect, useState } from "react";
import { loadOpenCount } from "./api";

/**
 * Button für die Aktionsleiste im Admin-Dashboard.
 * Business/Enterprise: zeigt offene Rückrufe + zu prüfende KI-Termine.
 * Andere Tarife: Schloss-Symbol, Klick führt zur Info-Seite.
 */
export function KiTelefonButton({
  tenantId,
  hasAccess,
  onOpen,
}: {
  tenantId: number;
  hasAccess: boolean;
  onOpen: () => void;
}) {
  const [open, setOpen] = useState(0);

  // Rückkehr von der Stripe-Bezahlseite (?ki_kauf=...) -> direkt zum KI-Telefon
  useEffect(() => {
    if (hasAccess && new URLSearchParams(window.location.search).has("ki_kauf")) onOpen();
    // nur einmal beim Laden
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [hasAccess]);

  useEffect(() => {
    if (!hasAccess) return;
    let cancelled = false;
    loadOpenCount(tenantId)
      .then((n) => !cancelled && setOpen(n))
      .catch(() => undefined);
    return () => {
      cancelled = true;
    };
  }, [tenantId, hasAccess]);

  return (
    <button type="button" className="btn btn-analysis" onClick={onOpen}>
      {hasAccess ? "📞" : "🔒"} KI-Telefon{hasAccess && open > 0 ? ` (${open} neu)` : ""}
    </button>
  );
}
