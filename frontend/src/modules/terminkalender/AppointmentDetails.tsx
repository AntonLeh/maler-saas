import { useState } from "react";
import type { Appointment, CalendarCustomer, CalendarOrder, CalendarPerson } from "./types";
import { customerName, personName, typeLabel } from "./types";
import { formatRange } from "./dateUtils";
import { Modal, StatusBadge } from "./ui";

type Props = {
  appointment: Appointment;
  customer?: CalendarCustomer;
  order?: CalendarOrder;
  assignee?: CalendarPerson;
  projectManagers: CalendarPerson[];
  busy: boolean;
  onClose: () => void;
  onEdit: () => void;
  onForward: (projectManagerId: number, note: string) => void;
  onCancelAppointment: () => void;
  onReactivate: () => void;
  onDelete: () => void;
};

export default function AppointmentDetails({
  appointment: a,
  customer,
  order,
  assignee,
  projectManagers,
  busy,
  onClose,
  onEdit,
  onForward,
  onCancelAppointment,
  onReactivate,
  onDelete,
}: Props) {
  const [forwardTo, setForwardTo] = useState(
    a.assigned_to ? String(a.assigned_to) : projectManagers[0] ? String(projectManagers[0].id) : ""
  );
  const [note, setNote] = useState("");
  const [confirmDelete, setConfirmDelete] = useState(false);

  const isCancelled = a.status === "abgesagt";
  const forwardLabel =
    a.status === "geplant" ? "Weiterleiten" : a.status === "abgelehnt" ? "Neu weiterleiten" : "Erneut senden";

  return (
    <Modal
      title={a.title}
      onClose={onClose}
      footer={
        confirmDelete ? (
          <>
            <span className="tk-foot-text">Termin wirklich löschen?</span>
            <button type="button" className="btn btn-secondary" onClick={() => setConfirmDelete(false)} disabled={busy}>
              Nein
            </button>
            <button type="button" className="btn btn-danger" onClick={onDelete} disabled={busy}>
              Ja, löschen
            </button>
          </>
        ) : (
          <>
            <button type="button" className="tk-link-danger" onClick={() => setConfirmDelete(true)} disabled={busy}>
              Löschen
            </button>
            <span className="tk-foot-spacer" />
            {isCancelled ? (
              <button type="button" className="btn btn-secondary" onClick={onReactivate} disabled={busy}>
                Wieder aktivieren
              </button>
            ) : (
              <button type="button" className="btn btn-secondary" onClick={onCancelAppointment} disabled={busy}>
                Absagen
              </button>
            )}
            <button type="button" className="btn btn-primary" onClick={onEdit} disabled={busy}>
              Bearbeiten
            </button>
          </>
        )
      }
    >
      <div className="tk-detail-head">
        <StatusBadge status={a.status} />
        <span className="tk-type">{typeLabel(a.appointment_type)}</span>
        {a.source === "ki_telefon" && <span className="tk-type">🤖 KI-Telefon</span>}
      </div>

      <dl className="tk-detail-list">
        <dt>Wann</dt>
        <dd>{formatRange(a.starts_at, a.ends_at)}</dd>
        {a.location && (
          <>
            <dt>Ort</dt>
            <dd>
              {a.location}{" "}
              <a
                className="tk-map-link"
                href={`https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(a.location)}`}
                target="_blank"
                rel="noreferrer"
              >
                Karte
              </a>
            </dd>
          </>
        )}
        {(a.contact_name || a.contact_phone) && (
          <>
            <dt>Kontakt</dt>
            <dd>
              {a.contact_name}
              {a.contact_phone && (
                <>
                  {a.contact_name ? " · " : ""}
                  <a className="tk-map-link" href={`tel:${a.contact_phone.replace(/[^\d+]/g, "")}`}>
                    {a.contact_phone}
                  </a>
                </>
              )}
            </dd>
          </>
        )}
        {customer && (
          <>
            <dt>Kunde</dt>
            <dd>{customerName(customer)}</dd>
          </>
        )}
        {order && (
          <>
            <dt>Auftrag</dt>
            <dd>{order.title}</dd>
          </>
        )}
        {a.description && (
          <>
            <dt>Notiz</dt>
            <dd className="tk-pre">{a.description}</dd>
          </>
        )}
        <dt>Projektleiter</dt>
        <dd>{a.assigned_to ? personName(assignee) : "noch nicht zugewiesen"}</dd>
        {a.forward_note && a.assigned_to && (
          <>
            <dt>Hinweis an PL</dt>
            <dd className="tk-pre">{a.forward_note}</dd>
          </>
        )}
        {a.response_note && (
          <>
            <dt>Antwort</dt>
            <dd className="tk-pre">{a.response_note}</dd>
          </>
        )}
      </dl>

      {!isCancelled && (
        <div className="tk-forward-box">
          <strong>An Projektleiter weiterleiten</strong>
          {projectManagers.length === 0 ? (
            <p className="tk-muted">Es sind noch keine aktiven Projektleiter angelegt.</p>
          ) : (
            <>
              <div className="tk-forward-row">
                <select value={forwardTo} onChange={(e) => setForwardTo(e.target.value)} aria-label="Projektleiter">
                  {projectManagers.map((pm) => (
                    <option key={pm.id} value={String(pm.id)}>
                      {personName(pm)}
                    </option>
                  ))}
                </select>
                <button
                  type="button"
                  className="btn btn-primary btn-small"
                  disabled={busy || !forwardTo}
                  onClick={() => onForward(Number(forwardTo), note)}
                >
                  {forwardLabel}
                </button>
              </div>
              <input
                value={note}
                onChange={(e) => setNote(e.target.value)}
                placeholder="Hinweis an den Projektleiter (optional)"
                aria-label="Hinweis"
              />
              <p className="tk-muted">Der Projektleiter bekommt zusätzlich eine Nachricht im Postfach.</p>
            </>
          )}
        </div>
      )}
    </Modal>
  );
}
