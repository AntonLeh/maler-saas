import { useState } from "react";
import type { WebsiteLead } from "./types";
import * as api from "./api";

function formatDateTime(iso: string) {
  return new Date(iso).toLocaleString("de-DE", { day: "2-digit", month: "2-digit", year: "numeric", hour: "2-digit", minute: "2-digit" });
}

export default function LeadsTab({
  tenantId,
  leads,
  onChanged,
  onError,
}: {
  tenantId: number;
  leads: WebsiteLead[];
  onChanged: () => Promise<void> | void;
  onError: (msg: string) => void;
}) {
  const [busyId, setBusyId] = useState<number | null>(null);
  const [showDone, setShowDone] = useState(false);

  const run = async (id: number, fn: () => Promise<void>) => {
    setBusyId(id);
    try {
      await fn();
      await onChanged();
    } catch (e) {
      onError((e as Error).message);
    } finally {
      setBusyId(null);
    }
  };

  const open = leads.filter((l) => l.status === "neu");
  const done = leads.filter((l) => l.status === "erledigt");
  const list = showDone ? done : open;

  return (
    <div className="ws-stack">
      <div className="tk-segment" role="tablist" aria-label="Anfragen filtern">
        <button type="button" role="tab" aria-selected={!showDone} className={!showDone ? "active" : ""} onClick={() => setShowDone(false)}>
          Neu ({open.length})
        </button>
        <button type="button" role="tab" aria-selected={showDone} className={showDone ? "active" : ""} onClick={() => setShowDone(true)}>
          Erledigt ({done.length})
        </button>
      </div>
      {list.length === 0 ? (
        <p className="tk-empty">{showDone ? "Noch keine erledigten Anfragen." : "Keine neuen Anfragen. Anfragen über das Kontaktformular der Website erscheinen hier."}</p>
      ) : (
        <div className="ws-leads">
          {list.map((l) => (
            <article key={l.id} className={`ws-lead${l.status === "neu" ? " ws-lead-new" : ""}`}>
              <div className="ws-lead-head">
                <strong>{l.name}</strong>
                <span className="tk-muted">{formatDateTime(l.created_at)}</span>
              </div>
              <div className="ws-lead-contact">
                {l.phone && (
                  <a className="btn btn-primary btn-small" href={`tel:${l.phone.replace(/[^\d+]/g, "")}`}>
                    📞 {l.phone}
                  </a>
                )}
                {l.email && (
                  <a className="btn btn-secondary btn-small" href={`mailto:${l.email}?subject=${encodeURIComponent("Ihre Anfrage")}`}>
                    ✉️ {l.email}
                  </a>
                )}
              </div>
              <p className="ws-lead-msg">{l.message}</p>
              <div className="ws-row">
                {l.status === "neu" ? (
                  <button type="button" className="btn btn-secondary btn-small" disabled={busyId === l.id} onClick={() => run(l.id, () => api.setLeadStatus(tenantId, l.id, "erledigt"))}>
                    ✓ Erledigt
                  </button>
                ) : (
                  <button type="button" className="btn btn-secondary btn-small" disabled={busyId === l.id} onClick={() => run(l.id, () => api.setLeadStatus(tenantId, l.id, "neu"))}>
                    Wieder öffnen
                  </button>
                )}
                <button
                  type="button"
                  className="ws-link ws-danger"
                  disabled={busyId === l.id}
                  onClick={() => window.confirm("Anfrage endgültig löschen?") && run(l.id, () => api.deleteLead(tenantId, l.id))}
                >
                  Löschen
                </button>
              </div>
            </article>
          ))}
        </div>
      )}
      <p className="tk-muted">Datenschutz: Anfragen bitte löschen, sobald sie erledigt sind und nicht mehr gebraucht werden.</p>
    </div>
  );
}
