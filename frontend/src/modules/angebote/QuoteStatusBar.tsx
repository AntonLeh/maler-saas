import { useState } from "react";
import { showAlert, showConfirm } from "../../lib/dialogs";
import { inDays, setQuoteStatus, setQuoteValidUntil, type SettableStatus } from "./api";
import { formatDate, quoteStatusKey } from "./status";

type Props = {
  tenantId: number;
  quote: { id: number; status: string; valid_until: string | null };
  onChanged: () => Promise<void> | void;
};

export default function QuoteStatusBar({ tenantId, quote, onChanged }: Props) {
  const [busy, setBusy] = useState(false);
  const raw = (quote.status || "draft").toLowerCase();
  const key = quoteStatusKey(quote);

  const run = async (fn: () => Promise<void>) => {
    setBusy(true);
    try {
      await fn();
      await onChanged();
    } catch (e: unknown) {
      await showAlert((e as { message?: string })?.message || "Das hat nicht geklappt.", { tone: "error", title: "Das hat nicht geklappt" });
    } finally {
      setBusy(false);
    }
  };

  const status = (s: SettableStatus) => run(() => setQuoteStatus(tenantId, quote.id, s));
  const reject = async () => {
    if (await showConfirm("Angebot als abgelehnt markieren? Sie können es später wieder öffnen.", { confirmLabel: "Ja, abgelehnt" })) {
      await status("rejected");
    }
  };
  const extend = () => run(() => setQuoteValidUntil(tenantId, quote.id, inDays(30)));

  if (raw === "accepted") {
    return (
      <div className="ag-status-bar">
        <span>Status:</span> Angenommen – der Auftrag wurde erstellt.
      </div>
    );
  }

  return (
    <>
      <div className="ag-status-bar">
        <span>Status ändern:</span>
        {raw === "draft" && (
          <button type="button" className="btn btn-secondary btn-small" disabled={busy} onClick={() => status("sent")}>
            Als gesendet markieren
          </button>
        )}
        {raw === "sent" && (
          <button type="button" className="btn btn-secondary btn-small" disabled={busy} onClick={() => status("draft")}>
            Zurück auf Entwurf
          </button>
        )}
        {raw !== "rejected" ? (
          <button type="button" className="btn btn-secondary btn-small" disabled={busy} onClick={reject}>
            Als abgelehnt markieren
          </button>
        ) : (
          <button type="button" className="btn btn-secondary btn-small" disabled={busy} onClick={() => status("sent")}>
            Wieder öffnen
          </button>
        )}
      </div>

      {key === "expired" && (
        <div className="ag-valid-warn">
          <span>Das Angebot ist seit {formatDate(quote.valid_until)} abgelaufen.</span>
          <button type="button" className="btn btn-secondary btn-small" disabled={busy} onClick={extend}>
            Gültig bis {formatDate(inDays(30))} verlängern
          </button>
        </div>
      )}
      {!quote.valid_until && raw !== "rejected" && (
        <div className="ag-valid-warn">
          <span>Für dieses Angebot ist keine Gültigkeit hinterlegt.</span>
          <button type="button" className="btn btn-secondary btn-small" disabled={busy} onClick={extend}>
            Gültig bis {formatDate(inDays(30))} setzen
          </button>
        </div>
      )}
    </>
  );
}
