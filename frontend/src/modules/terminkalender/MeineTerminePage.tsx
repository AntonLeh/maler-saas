import { useCallback, useEffect, useMemo, useState } from "react";
import "./terminkalender.css";
import type { Appointment, CalendarCustomer, CalendarOrder } from "./types";
import { customerName, typeLabel } from "./types";
import { formatRange } from "./dateUtils";
import * as api from "./api";
import { Notice, StatusBadge } from "./ui";

type Props = {
  currentUserId: number;
  onBack: () => void;
};

function AppointmentCard({
  appointment: a,
  customer,
  order,
  busy,
  onRespond,
}: {
  appointment: Appointment;
  customer?: CalendarCustomer;
  order?: CalendarOrder;
  busy: boolean;
  onRespond?: (accept: boolean, note: string) => void;
}) {
  const [note, setNote] = useState("");
  const [declining, setDeclining] = useState(false);
  const canRespond = !!onRespond && (a.status === "weitergeleitet" || a.status === "bestaetigt");

  return (
    <article className={`tk-pm-card tk-border-${a.status}`}>
      <div className="tk-pm-card-head">
        <div>
          <h3>{a.title}</h3>
          <p className="tk-pm-when">{formatRange(a.starts_at, a.ends_at)}</p>
        </div>
        <div className="tk-pm-badges">
          <StatusBadge status={a.status} />
          <span className="tk-type">{typeLabel(a.appointment_type)}</span>
        </div>
      </div>

      <dl className="tk-detail-list">
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
        {a.forward_note && (
          <>
            <dt>Hinweis</dt>
            <dd className="tk-pre">{a.forward_note}</dd>
          </>
        )}
        {a.response_note && (
          <>
            <dt>Deine Antwort</dt>
            <dd className="tk-pre">{a.response_note}</dd>
          </>
        )}
      </dl>

      {canRespond && a.status === "weitergeleitet" && (
        <div className="tk-pm-actions">
          {declining ? (
            <>
              <input
                value={note}
                onChange={(e) => setNote(e.target.value)}
                placeholder="Grund / Alternativvorschlag (optional)"
                aria-label="Grund"
                autoFocus
              />
              <div className="tk-pm-buttons">
                <button type="button" className="btn btn-secondary btn-small" onClick={() => setDeclining(false)} disabled={busy}>
                  Zurück
                </button>
                <button type="button" className="btn btn-danger btn-small" onClick={() => onRespond?.(false, note)} disabled={busy}>
                  Ablehnen senden
                </button>
              </div>
            </>
          ) : (
            <div className="tk-pm-buttons">
              <button type="button" className="btn btn-secondary btn-small" onClick={() => setDeclining(true)} disabled={busy}>
                Ablehnen
              </button>
              <button type="button" className="btn btn-primary btn-small" onClick={() => onRespond?.(true, "")} disabled={busy}>
                Bestätigen
              </button>
            </div>
          )}
        </div>
      )}

      {canRespond && a.status === "bestaetigt" && (
        <div className="tk-pm-actions">
          {declining ? (
            <>
              <input
                value={note}
                onChange={(e) => setNote(e.target.value)}
                placeholder="Warum kannst du doch nicht?"
                aria-label="Grund"
                autoFocus
              />
              <div className="tk-pm-buttons">
                <button type="button" className="btn btn-secondary btn-small" onClick={() => setDeclining(false)} disabled={busy}>
                  Zurück
                </button>
                <button type="button" className="btn btn-danger btn-small" onClick={() => onRespond?.(false, note)} disabled={busy}>
                  Absage senden
                </button>
              </div>
            </>
          ) : (
            <button type="button" className="tk-link-danger" onClick={() => setDeclining(true)} disabled={busy}>
              Doch nicht möglich?
            </button>
          )}
        </div>
      )}
    </article>
  );
}

export default function MeineTerminePage({ currentUserId, onBack }: Props) {
  const [appointments, setAppointments] = useState<Appointment[]>([]);
  const [customers, setCustomers] = useState<CalendarCustomer[]>([]);
  const [orders, setOrders] = useState<CalendarOrder[]>([]);
  const [loading, setLoading] = useState(true);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const [success, setSuccess] = useState("");
  const [showOld, setShowOld] = useState(false);

  const reload = useCallback(async () => {
    setLoading(true);
    try {
      const list = await api.loadMyAppointments(currentUserId);
      setAppointments(list);
      const [cs, os] = await Promise.all([
        api.loadCustomersByIds(list.map((a) => a.customer_id).filter((id): id is number => id !== null)),
        api.loadOrdersByIds(list.map((a) => a.order_id).filter((id): id is number => id !== null)),
      ]);
      setCustomers(cs);
      setOrders(os);
    } catch (e) {
      setError((e as Error).message);
    } finally {
      setLoading(false);
    }
  }, [currentUserId]);

  useEffect(() => {
    void reload();
  }, [reload]);

  const groups = useMemo(() => {
    const now = Date.now();
    const open = appointments.filter((a) => a.status === "weitergeleitet");
    const upcoming = appointments.filter((a) => a.status === "bestaetigt" && new Date(a.ends_at).getTime() >= now);
    const other = appointments
      .filter((a) => !open.includes(a) && !upcoming.includes(a))
      .sort((x, y) => y.starts_at.localeCompare(x.starts_at));
    return { open, upcoming, other };
  }, [appointments]);

  const respond = (a: Appointment, accept: boolean, note: string) => {
    setBusy(true);
    setError("");
    api
      .respondToAppointment(a, currentUserId, accept, note)
      .then(() => {
        setSuccess(accept ? "Termin bestätigt. Der Admin wurde informiert." : "Absage gesendet. Der Admin wurde informiert.");
        return reload();
      })
      .catch((e: Error) => setError(e.message))
      .finally(() => setBusy(false));
  };

  const find = <T extends { id: number }>(list: T[], id: number | null) =>
    id === null ? undefined : list.find((x) => String(x.id) === String(id));

  const renderCards = (list: Appointment[], withActions: boolean) =>
    list.map((a) => (
      <AppointmentCard
        key={a.id + a.updated_at}
        appointment={a}
        customer={find(customers, a.customer_id)}
        order={find(orders, a.order_id)}
        busy={busy}
        onRespond={withActions ? (accept, note) => respond(a, accept, note) : undefined}
      />
    ));

  return (
    <div className="dashboard-page tk-root">
      <div className="dashboard-container">
        <div className="page-topbar">
          <div>
            <h1>Meine Termine</h1>
            <p>Termine, die dir vom Büro weitergeleitet wurden.</p>
          </div>
          <button type="button" className="btn btn-secondary" onClick={onBack}>
            Zurück zum Dashboard
          </button>
        </div>

        {error && (
          <Notice kind="error" onClose={() => setError("")}>
            {error}
          </Notice>
        )}
        {success && (
          <Notice kind="success" onClose={() => setSuccess("")}>
            {success}
          </Notice>
        )}

        {loading && appointments.length === 0 ? (
          <p className="tk-empty">Termine werden geladen …</p>
        ) : (
          <>
            <section className="tk-pm-section">
              <h2>
                Zu bestätigen <span className="tk-count">{groups.open.length}</span>
              </h2>
              {groups.open.length === 0 ? (
                <p className="tk-empty">Keine offenen Anfragen.</p>
              ) : (
                <div className="tk-pm-grid">{renderCards(groups.open, true)}</div>
              )}
            </section>

            <section className="tk-pm-section">
              <h2>
                Kommende Termine <span className="tk-count">{groups.upcoming.length}</span>
              </h2>
              {groups.upcoming.length === 0 ? (
                <p className="tk-empty">Keine bestätigten Termine.</p>
              ) : (
                <div className="tk-pm-grid">{renderCards(groups.upcoming, true)}</div>
              )}
            </section>

            {groups.other.length > 0 && (
              <section className="tk-pm-section">
                <button type="button" className="tk-toggle" onClick={() => setShowOld((v) => !v)}>
                  {showOld ? "▾" : "▸"} Vergangene, abgelehnte und abgesagte Termine ({groups.other.length})
                </button>
                {showOld && <div className="tk-pm-grid">{renderCards(groups.other, false)}</div>}
              </section>
            )}
          </>
        )}
      </div>
    </div>
  );
}
