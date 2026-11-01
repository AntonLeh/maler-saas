import { useEffect, useState } from "react";
import { countNewLeads } from "./api";

/** Button für die Aktionsleiste im Admin-Dashboard (zeigt neue Website-Anfragen) */
export function WebsiteButton({ tenantId, hasAccess, onOpen }: { tenantId: number; hasAccess: boolean; onOpen: () => void }) {
  const [count, setCount] = useState(0);
  useEffect(() => {
    if (!hasAccess) return;
    let cancelled = false;
    countNewLeads(tenantId)
      .then((n) => !cancelled && setCount(n))
      .catch(() => undefined);
    return () => {
      cancelled = true;
    };
  }, [tenantId, hasAccess]);
  return (
    <button type="button" className="btn btn-analysis" onClick={onOpen}>
      {hasAccess ? "🌐" : "🔒"} Website{hasAccess && count > 0 ? ` (${count} Anfrage${count > 1 ? "n" : ""})` : ""}
    </button>
  );
}
