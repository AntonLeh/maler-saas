import { useMemo, useState } from "react";
import type {
  Appointment,
  AppointmentInput,
  AppointmentType,
  CalendarCustomer,
  CalendarOrder,
  CalendarPerson,
} from "./types";
import {
  APPOINTMENT_TYPES,
  customerAddress,
  customerName,
  orderAddress,
  personName,
} from "./types";
import { toLocalInputValue } from "./dateUtils";
import { Modal, Notice } from "./ui";

type Props = {
  initial: Appointment | null;
  defaultStart: Date;
  customers: CalendarCustomer[];
  orders: CalendarOrder[];
  projectManagers: CalendarPerson[];
  saving: boolean;
  onCancel: () => void;
  onSave: (input: AppointmentInput, forwardTo: number | null, note: string) => void;
};

export default function AppointmentForm({
  initial,
  defaultStart,
  customers,
  orders,
  projectManagers,
  saving,
  onCancel,
  onSave,
}: Props) {
  const defaultEnd = new Date(defaultStart.getTime() + 60 * 60 * 1000);

  const [title, setTitle] = useState(initial?.title ?? "");
  const [type, setType] = useState<AppointmentType>(initial?.appointment_type ?? "besichtigung");
  const [start, setStart] = useState(
    toLocalInputValue(initial ? new Date(initial.starts_at) : defaultStart)
  );
  const [end, setEnd] = useState(toLocalInputValue(initial ? new Date(initial.ends_at) : defaultEnd));
  const [customerId, setCustomerId] = useState(initial?.customer_id ? String(initial.customer_id) : "");
  const [orderId, setOrderId] = useState(initial?.order_id ? String(initial.order_id) : "");
  const [location, setLocation] = useState(initial?.location ?? "");
  const [description, setDescription] = useState(initial?.description ?? "");
  const [forwardTo, setForwardTo] = useState("");
  const [note, setNote] = useState("");
  const [error, setError] = useState("");

  const visibleOrders = useMemo(
    () => (customerId ? orders.filter((o) => String(o.customer_id) === customerId) : orders),
    [orders, customerId]
  );

  // Nur bei neuen oder noch nicht weitergeleiteten Terminen direkt weiterleiten
  const canForwardHere = !initial || initial.status === "geplant";

  const handleStartChange = (value: string) => {
    // Endzeit mitverschieben, damit die Dauer gleich bleibt
    const oldStart = new Date(start).getTime();
    const oldEnd = new Date(end).getTime();
    const newStart = new Date(value).getTime();
    setStart(value);
    if (!Number.isNaN(oldStart) && !Number.isNaN(oldEnd) && !Number.isNaN(newStart)) {
      const duration = Math.max(oldEnd - oldStart, 15 * 60 * 1000);
      setEnd(toLocalInputValue(new Date(newStart + duration)));
    }
  };

  const handleOrderChange = (value: string) => {
    setOrderId(value);
    const order = orders.find((o) => String(o.id) === value);
    if (!order) return;
    if (order.customer_id && !customerId) setCustomerId(String(order.customer_id));
    if (!title.trim()) setTitle(order.title);
    if (!location.trim()) setLocation(orderAddress(order));
  };

  const handleCustomerChange = (value: string) => {
    setCustomerId(value);
    const order = orders.find((o) => String(o.id) === orderId);
    if (order && value && String(order.customer_id) !== value) setOrderId("");
    const customer = customers.find((c) => String(c.id) === value);
    if (customer && !location.trim()) setLocation(customerAddress(customer));
  };

  const submit = () => {
    setError("");
    const startDate = new Date(start);
    const endDate = new Date(end);
    if (!title.trim()) return setError("Bitte einen Titel eingeben.");
    if (Number.isNaN(startDate.getTime()) || Number.isNaN(endDate.getTime()))
      return setError("Bitte Beginn und Ende angeben.");
    if (endDate < startDate) return setError("Das Ende liegt vor dem Beginn.");

    onSave(
      {
        title: title.trim(),
        appointment_type: type,
        description: description.trim() || null,
        location: location.trim() || null,
        starts_at: startDate.toISOString(),
        ends_at: endDate.toISOString(),
        customer_id: customerId ? Number(customerId) : null,
        order_id: orderId ? Number(orderId) : null,
      },
      canForwardHere && forwardTo ? Number(forwardTo) : null,
      note
    );
  };

  return (
    <Modal
      title={initial ? "Termin bearbeiten" : "Neuer Termin"}
      onClose={onCancel}
      footer={
        <>
          <button type="button" className="btn btn-secondary" onClick={onCancel} disabled={saving}>
            Abbrechen
          </button>
          <button type="button" className="btn btn-primary" onClick={submit} disabled={saving}>
            {saving ? "Speichert…" : forwardTo && canForwardHere ? "Speichern & weiterleiten" : "Speichern"}
          </button>
        </>
      }
    >
      {error && <Notice kind="error">{error}</Notice>}

      <div className="tk-form">
        <label className="tk-field tk-span-2">
          <span>Titel *</span>
          <input
            value={title}
            onChange={(e) => setTitle(e.target.value)}
            placeholder="z. B. Besichtigung Wohnzimmer"
            autoFocus
          />
        </label>


        <div className="tk-field-pair">
          <label className="tk-field">
            <span>Beginn *</span>
            <input type="datetime-local" value={start} onChange={(e) => handleStartChange(e.target.value)} />
          </label>
          <label className="tk-field">
            <span>Ende *</span>
            <input type="datetime-local" value={end} onChange={(e) => setEnd(e.target.value)} />
          </label>
        </div>

        <label className="tk-field">
          <span>Kunde (optional)</span>
          <select value={customerId} onChange={(e) => handleCustomerChange(e.target.value)}>
            <option value="">– kein Kunde –</option>
            {customers.map((c) => (
              <option key={c.id} value={String(c.id)}>
                {customerName(c) || `Kunde ${c.id}`}
              </option>
            ))}
          </select>
        </label>

        <label className="tk-field">
          <span>Auftrag (optional)</span>
          <select value={orderId} onChange={(e) => handleOrderChange(e.target.value)}>
            <option value="">– kein Auftrag –</option>
            {visibleOrders.map((o) => (
              <option key={o.id} value={String(o.id)}>
                {o.title}
              </option>
            ))}
          </select>
        </label>

        <label className="tk-field">
          <span>Art</span>
          <select value={type} onChange={(e) => setType(e.target.value as AppointmentType)}>
            {APPOINTMENT_TYPES.map((t) => (
              <option key={t.value} value={t.value}>
                {t.label}
              </option>
            ))}
          </select>
        </label>

        <label className="tk-field">
          <span>Ort</span>
          <input
            value={location}
            onChange={(e) => setLocation(e.target.value)}
            placeholder="Adresse (wird aus Kunde/Auftrag übernommen)"
          />
        </label>

        <label className="tk-field tk-span-2">
          <span>Notiz</span>
          <textarea
            rows={3}
            value={description}
            onChange={(e) => setDescription(e.target.value)}
            placeholder="Was ist zu tun, was mitbringen …"
          />
        </label>

        {canForwardHere && (
          <div className="tk-forward-box tk-span-2">
            <label className="tk-field">
              <span>Direkt an Projektleiter weiterleiten (optional)</span>
              <select value={forwardTo} onChange={(e) => setForwardTo(e.target.value)}>
                <option value="">– später entscheiden –</option>
                {projectManagers.map((pm) => (
                  <option key={pm.id} value={String(pm.id)}>
                    {personName(pm)}
                  </option>
                ))}
              </select>
            </label>
            {forwardTo && (
              <label className="tk-field">
                <span>Hinweis an den Projektleiter</span>
                <input value={note} onChange={(e) => setNote(e.target.value)} placeholder="optional" />
              </label>
            )}
            {projectManagers.length === 0 && (
              <p className="tk-muted">Es sind noch keine aktiven Projektleiter angelegt.</p>
            )}
          </div>
        )}
      </div>
    </Modal>
  );
}
