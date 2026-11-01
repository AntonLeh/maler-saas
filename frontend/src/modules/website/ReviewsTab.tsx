import { useState } from "react";
import type { WebsiteReview, WebsiteReviewOverview } from "./types";
import * as api from "./api";

function formatDate(iso: string) {
  return new Date(iso).toLocaleDateString("de-DE", { day: "2-digit", month: "2-digit", year: "numeric" });
}

function Stars({ value }: { value: number }) {
  const full = Math.max(0, Math.min(5, Math.round(value)));
  return (
    <span className="ws-stars" aria-label={`${value} von 5 Sternen`}>
      {"★".repeat(full)}
      <span className="ws-stars-off">{"★".repeat(5 - full)}</span>
    </span>
  );
}

export default function ReviewsTab({
  tenantId,
  overview,
  onChanged,
  onError,
  onSuccess,
}: {
  tenantId: number;
  overview: WebsiteReviewOverview | null;
  onChanged: () => Promise<void> | void;
  onError: (msg: string) => void;
  onSuccess: (msg: string) => void;
}) {
  const [busyId, setBusyId] = useState<number | null>(null);

  const run = async (id: number, fn: () => Promise<void>, msg: string) => {
    setBusyId(id);
    try {
      await fn();
      await onChanged();
      onSuccess(msg);
    } catch (e) {
      onError((e as Error).message);
    } finally {
      setBusyId(null);
    }
  };

  if (!overview) return <p className="tk-empty">Bewertungen werden geladen …</p>;

  const avg = overview.average != null ? Number(overview.average) : null;
  const pending = overview.items.filter((i) => !i.approved);
  const shown = overview.items.filter((i) => i.approved);

  const renderCard = (r: WebsiteReview) => (
    <article key={r.review_id} className={`ws-lead${r.approved ? "" : " ws-lead-new"}`}>
      <div className="ws-lead-head">
        <span>
          <Stars value={r.overall_rating} /> <strong>{r.display_name}</strong>
          {r.city ? `, ${r.city}` : ""}
        </span>
        <span className="tk-muted">{formatDate(r.created_at)}</span>
      </div>
      {r.order_title && <div className="tk-muted ws-rv-order">Auftrag: {r.order_title}</div>}
      <p className="ws-lead-msg">{r.comment ? `„${r.comment}“` : <span className="tk-muted">(ohne Kommentar)</span>}</p>
      <div className="ws-row ws-rv-actions">
        {r.approved ? (
          <button
            type="button"
            className="btn btn-secondary btn-small"
            disabled={busyId === r.review_id}
            onClick={() => run(r.review_id, () => api.setReviewApproved(tenantId, r.review_id, false), "Die Bewertung wird nicht mehr gezeigt.")}
          >
            Von der Website nehmen
          </button>
        ) : (
          <button
            type="button"
            className="btn btn-primary btn-small"
            disabled={busyId === r.review_id}
            onClick={() => run(r.review_id, () => api.setReviewApproved(tenantId, r.review_id, true), "Die Bewertung erscheint jetzt auf Ihrer Website.")}
          >
            Auf der Website zeigen
          </button>
        )}
        <button
          type="button"
          className="ws-link ws-danger"
          disabled={busyId === r.review_id}
          onClick={() =>
            window.confirm(
              "Zustimmung entfernen? Nutzen Sie das, wenn der Kunde seine Einwilligung widerruft. Die Bewertung bleibt intern erhalten, kann aber nicht mehr veröffentlicht werden."
            ) && run(r.review_id, () => api.removeReviewConsent(tenantId, r.review_id), "Zustimmung entfernt.")
          }
        >
          Widerruf: Zustimmung entfernen
        </button>
      </div>
    </article>
  );

  return (
    <div className="ws-stack">
      <section className="ws-panel">
        <h3>So funktioniert es</h3>
        <p className="tk-muted ws-rv-intro">
          Nach Abschluss eines Auftrags bewerten Ihre Kunden die Arbeit im Kundenportal. Dort können sie ankreuzen, dass ihre Bewertung auf Ihrer
          Website erscheinen darf. Nur diese Bewertungen sehen Sie hier, und Sie entscheiden, welche gezeigt werden. Texte können nicht verändert
          werden. Mitarbeiterbewertungen bleiben immer intern.
        </p>
      </section>

      <div className="ws-rv-stats">
        <div className="ws-rv-stat">
          <strong>{avg != null ? avg.toFixed(1).replace(".", ",") : "–"}</strong>
          {avg != null && <Stars value={avg} />}
          <span className="tk-muted">Durchschnitt aus allen {overview.count} Bewertungen</span>
        </div>
        <div className="ws-rv-stat">
          <strong>{shown.length}</strong>
          <span className="tk-muted">auf der Website gezeigt</span>
        </div>
        <div className="ws-rv-stat">
          <strong>{pending.length}</strong>
          <span className="tk-muted">warten auf Ihre Freigabe</span>
        </div>
      </div>
      {overview.count > 0 && overview.count < 3 && shown.length === 0 && (
        <p className="tk-muted">
          Der Bereich „Kundenbewertungen“ erscheint auf der Website, sobald Sie eine Bewertung freigeben oder mindestens 3 Bewertungen vorliegen.
        </p>
      )}

      {overview.items.length === 0 ? (
        <p className="tk-empty">
          Noch keine Bewertungen mit Zustimmung zur Veröffentlichung. Sobald ein Kunde im Kundenportal bewertet und zustimmt, erscheint die Bewertung hier.
        </p>
      ) : (
        <div className="ws-leads">
          {pending.length > 0 && <h3 className="ws-rv-head">Neu – noch nicht auf der Website</h3>}
          {pending.map(renderCard)}
          {shown.length > 0 && <h3 className="ws-rv-head">Auf der Website</h3>}
          {shown.map(renderCard)}
        </div>
      )}

      <p className="tk-muted">
        Fair und rechtssicher: Der Durchschnitt auf der Website wird immer aus allen Bewertungen berechnet, auch aus kritischen
        {overview.without_consent > 0 ? ` (davon ${overview.without_consent} ohne Zustimmung, die nur anonym mitzählen)` : ""}. Welche Texte Sie
        zeigen, entscheiden Sie selbst.
      </p>
    </div>
  );
}
