import { useState } from "react";
import { entryNetMinutes, fmtDateTime, fmtDuration, statusLabel } from "../mitarbeiter/logic";
import "./auftraege.css";

type Person = { id: number; first_name: string | null; last_name: string | null };

export type HistoryEntry = {
  id: number;
  user_id: number;
  status: string | null;
  note: string | null;
  created_at: string;
  images?: { id: number; image_url: string }[];
};

export type OrderTimeEntry = {
  id: number;
  user_id: number;
  order_id: number | string;
  started_at: string | null;
  ended_at: string | null;
  total_break_minutes: number | null;
  status: string;
};

const personName = (people: Person[], id: number) => {
  const p = people.find((x) => Number(x.id) === Number(id));
  const name = p ? `${p.first_name || ""} ${p.last_name || ""}`.trim() : "";
  return name || "Mitarbeiter";
};

function Lightbox({ url, onClose }: { url: string; onClose: () => void }) {
  return (
    <div className="ao-lightbox" onClick={onClose} role="dialog" aria-modal="true">
      <button type="button" onClick={onClose} aria-label="Schließen">
        ✕
      </button>
      <img src={url} alt="Foto groß" onClick={(e) => e.stopPropagation()} />
    </div>
  );
}

function Photos({ images, onOpen }: { images: { id: number; image_url: string }[]; onOpen: (url: string) => void }) {
  if (!images.length) return null;
  return (
    <div className="ao-photos">
      {images.map((img) => (
        <button key={img.id} type="button" onClick={() => onOpen(img.image_url)} aria-label="Foto groß anzeigen">
          <img src={img.image_url} alt="Fortschrittsfoto" loading="lazy" />
        </button>
      ))}
    </div>
  );
}

/** Prüfbereich, wenn ein Mitarbeiter den Auftrag fertig gemeldet hat */
export function OrderReviewBox({
  history,
  timeEntries,
  people,
  busy,
  onApprove,
  onReturn,
}: {
  history: HistoryEntry[];
  timeEntries: OrderTimeEntry[];
  people: Person[];
  busy: boolean;
  onApprove: () => void;
  onReturn: () => void;
}) {
  const [preview, setPreview] = useState<string | null>(null);
  const last = history[0] ?? null; // neuester Eintrag = Abschlussmeldung
  const now = new Date();
  const finished = timeEntries.filter((e) => e.started_at);
  const perPerson = new Map<number, number>();
  for (const e of finished) perPerson.set(e.user_id, (perPerson.get(e.user_id) || 0) + entryNetMinutes(e, now));
  const total = [...perPerson.values()].reduce((s, m) => s + m, 0);
  const allImages = history.flatMap((h) => h.images || []);

  return (
    <section className="ao-review">
      <div className="ao-review-head">
        <span className="ao-badge">🔎 Fertig gemeldet – bitte prüfen</span>
        {last && (
          <small>
            von <b>{personName(people, last.user_id)}</b> · {fmtDateTime(last.created_at)}
          </small>
        )}
      </div>

      {last?.note && <blockquote className="ao-quote">{last.note}</blockquote>}

      {allImages.length > 0 ? (
        <>
          <p className="ao-label">Fotos zum Auftrag ({allImages.length})</p>
          <Photos images={allImages} onOpen={setPreview} />
        </>
      ) : (
        <p className="ao-muted">Zu diesem Auftrag wurden keine Fotos hochgeladen.</p>
      )}

      <div className="ao-hours">
        <p className="ao-label">Erfasste Arbeitszeit: {fmtDuration(total)}</p>
        {perPerson.size > 0 && (
          <ul>
            {[...perPerson.entries()].map(([uid, mins]) => (
              <li key={uid}>
                {personName(people, uid)}: <b>{fmtDuration(mins)}</b>
              </li>
            ))}
          </ul>
        )}
      </div>

      <div className="ao-review-actions">
        <button type="button" className="btn btn-primary" onClick={onApprove} disabled={busy}>
          ✓ Abnehmen (Fertig)
        </button>
        <button type="button" className="btn btn-secondary" onClick={onReturn} disabled={busy}>
          ↩ Zurück an Mitarbeiter
        </button>
      </div>

      {preview && <Lightbox url={preview} onClose={() => setPreview(null)} />}
    </section>
  );
}

/** Auftragsverlauf als Karten mit Fotos */
export function OrderHistory({ history, people }: { history: HistoryEntry[]; people: Person[] }) {
  const [preview, setPreview] = useState<string | null>(null);
  return (
    <div className="ao-history">
      <h3>Auftragsverlauf</h3>
      {history.length === 0 ? (
        <p className="ao-muted">Noch keine Fortschrittseinträge vorhanden.</p>
      ) : (
        <ul>
          {history.map((entry) => (
            <li key={entry.id}>
              <div className="ao-history-meta">
                <b>{personName(people, entry.user_id)}</b>
                <span>{fmtDateTime(entry.created_at)}</span>
                {entry.status && <span className={`ao-status s-${entry.status}`}>{statusLabel(entry.status)}</span>}
              </div>
              {entry.note && <p>{entry.note}</p>}
              <Photos images={entry.images || []} onOpen={setPreview} />
            </li>
          ))}
        </ul>
      )}
      {preview && <Lightbox url={preview} onClose={() => setPreview(null)} />}
    </div>
  );
}
