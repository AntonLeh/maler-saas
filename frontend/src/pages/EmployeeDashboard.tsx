import { useState } from "react";

const formatDateTime = (value: string) => {
  const hasTimezone = /[zZ]|[+\-]\d{2}:\d{2}$/.test(value);
  const normalizedValue = hasTimezone ? value : `${value}Z`;

  return new Intl.DateTimeFormat("de-DE", {
    timeZone: "Europe/Madrid",
    day: "2-digit",
    month: "2-digit",
    year: "numeric",
    hour: "2-digit",
    minute: "2-digit",
    second: "2-digit",
  }).format(new Date(normalizedValue));
};

const formatDateOnly = (value: string | null) => {
  if (!value) return "-";

  const parts = value.split("-");
  if (parts.length !== 3) return value;

  const [year, month, day] = parts;
  return `${day}.${month}.${year}`;
};

type EmployeeOrder = {
  id: string;
  title: string;
  description: string | null;
  status: string;
  address_street: string | null;
  address_zip: string | null;
  address_city: string | null;
  start_date: string | null;
  end_date: string | null;
};

type ProgressEntry = {
  id: number;
  order_id: string;
  note: string;
  created_at: string;
};

type TimeEntry = {
  id: number;
  user_id: number;
  order_id: number;
  work_date: string;
  started_at: string | null;
  ended_at: string | null;
  total_break_minutes: number;
  status: string;
  created_at: string;
};

type EmployeeDashboardProps = {
  userName: string;
  userEmail: string;
  onLogout: () => void;
  orders: EmployeeOrder[];
  progressEntries: ProgressEntry[];
  timeEntries: TimeEntry[];
  onUpdateOrderStatus: (orderId: string, newStatus: string) => Promise<void>;
  onCreateProgress: (orderId: string, note: string) => Promise<void>;
  onStartWork: (orderId: string) => Promise<void>;
  onStartBreak: (timeEntryId: number) => Promise<void>;
  onEndBreak: (timeEntryId: number) => Promise<void>;
  onEndWork: (timeEntryId: number) => Promise<void>;
};

export default function EmployeeDashboard({
  userName,
  userEmail,
  onLogout,
  orders,
  progressEntries = [],
  timeEntries = [],
  onUpdateOrderStatus,
  onCreateProgress,
  onStartWork,
  onStartBreak,
  onEndBreak,
  onEndWork,
}: EmployeeDashboardProps) {

  const [savingOrderId, setSavingOrderId] = useState<string | null>(null);
  const [savingProgressOrderId, setSavingProgressOrderId] = useState<string | null>(null);
  const [startingWorkOrderId, setStartingWorkOrderId] = useState<string | null>(null);
  const [startingBreakTimeEntryId, setStartingBreakTimeEntryId] = useState<number | null>(null);
  const [endingBreakTimeEntryId, setEndingBreakTimeEntryId] = useState<number | null>(null);
  const [endingWorkTimeEntryId, setEndingWorkTimeEntryId] = useState<number | null>(null);
  const [message, setMessage] = useState("");
  const [progressNotes, setProgressNotes] = useState<Record<string, string>>({});

  const getStatusClass = (status: string) => {
    switch (status) {
      case "neu":
        return "status-badge status-neu";
      case "geplant":
        return "status-badge status-geplant";
      case "in_arbeit":
        return "status-badge status-inbearbeitung";
      case "pausiert":
        return "status-badge status-pausiert";
      case "fertig":
        return "status-badge status-fertig";
      case "abgerechnet":
        return "status-badge status-abgerechnet";
      default:
        return "status-badge";
    }
  };



  const handleStatusChange = async (orderId: string, newStatus: string) => {
    if (!newStatus) return;

    setSavingOrderId(orderId);
    setMessage("");

    try {
      await onUpdateOrderStatus(orderId, newStatus);
      setMessage("Status erfolgreich aktualisiert.");
    } catch (error) {
      console.error("Fehler beim Aktualisieren des Status:", error);
      setMessage(
        `Status konnte nicht aktualisiert werden: ${
          error instanceof Error ? error.message : "Unbekannter Fehler"
        }`
      );
    } finally {
      setSavingOrderId(null);
    }
  };

  const handleProgressInputChange = (orderId: string, value: string) => {
    setProgressNotes((prev) => ({
      ...prev,
      [orderId]: value,
    }));
  };

  const handleSaveProgress = async (orderId: string) => {
    const note = (progressNotes[orderId] || "").trim();

    if (!note) {
      setMessage("Bitte zuerst eine Fortschrittsnotiz eingeben.");
      return;
    }

    setSavingProgressOrderId(orderId);
    setMessage("");

    try {
      await onCreateProgress(orderId, note);
      setProgressNotes((prev) => ({
        ...prev,
        [orderId]: "",
      }));
      setMessage("Fortschritt erfolgreich gespeichert.");
    } catch (error) {
      console.error("Fehler beim Speichern des Fortschritts:", error);
      setMessage(
        `Fortschritt konnte nicht gespeichert werden: ${
          error instanceof Error ? error.message : "Unbekannter Fehler"
        }`
      );
    } finally {
      setSavingProgressOrderId(null);
    }
  };

  const handleStartWork = async (orderId: string) => {
  setStartingWorkOrderId(orderId);
  setMessage("");

  try {
    await onStartWork(orderId);
    setMessage("Arbeitsbeginn erfolgreich gespeichert.");
  } catch (error) {
    console.error("Fehler beim Starten der Arbeit:", error);
    setMessage(
      `Arbeitsbeginn konnte nicht gespeichert werden: ${
        error instanceof Error ? error.message : "Unbekannter Fehler"
      }`
    );
  } finally {
    setStartingWorkOrderId(null);
  }
};

const handleStartBreak = async (timeEntryId: number) => {
  setStartingBreakTimeEntryId(timeEntryId);
  setMessage("");

  try {
    await onStartBreak(timeEntryId);
    setMessage("Pause erfolgreich gestartet.");
  } catch (error) {
    console.error("Fehler beim Starten der Pause:", error);
    setMessage(
      `Pause konnte nicht gestartet werden: ${
        error instanceof Error ? error.message : "Unbekannter Fehler"
      }`
    );
  } finally {
    setStartingBreakTimeEntryId(null);
  }
};

const handleEndBreak = async (timeEntryId: number) => {
  setEndingBreakTimeEntryId(timeEntryId);
  setMessage("");

  try {
    await onEndBreak(timeEntryId);
    setMessage("Pause erfolgreich beendet.");
  } catch (error) {
    console.error("Fehler beim Beenden der Pause:", error);
    setMessage(
      `Pause konnte nicht beendet werden: ${
        error instanceof Error ? error.message : "Unbekannter Fehler"
      }`
    );
  } finally {
    setEndingBreakTimeEntryId(null);
  }
};

const handleEndWork = async (timeEntryId: number) => {
  setEndingWorkTimeEntryId(timeEntryId);
  setMessage("");

  try {
    await onEndWork(timeEntryId);
    setMessage("Arbeitstag erfolgreich beendet.");
  } catch (error) {
    console.error("Fehler beim Beenden der Arbeit:", error);
    setMessage(
      `Arbeitstag konnte nicht beendet werden: ${
        error instanceof Error ? error.message : "Unbekannter Fehler"
      }`
    );
  } finally {
    setEndingWorkTimeEntryId(null);
  }
};

  const getOrderProgressEntries = (orderId: string) => {
  return (progressEntries || []).filter((entry) => entry.order_id === orderId);
};

const getOpenTimeEntryForOrder = (orderId: string) => {
  return timeEntries.find(
    (entry) =>
      String(entry.order_id) === String(orderId) &&
      entry.ended_at === null &&
      (entry.status === "working" || entry.status === "break")
  );
};

const hasAnyOpenTimeEntry = () => {
  return timeEntries.some(
    (entry) =>
      entry.ended_at === null &&
      (entry.status === "working" || entry.status === "break")
  );
};

const getCompletedTimeEntriesForOrder = (orderId: string) => {
  return timeEntries.filter(
    (entry) =>
      String(entry.order_id) === String(orderId) &&
      entry.started_at !== null &&
      entry.ended_at !== null
  );
};

const getGrossMinutes = (entry: TimeEntry) => {
  if (!entry.started_at || !entry.ended_at) return 0;

  const start = new Date(entry.started_at).getTime();
  const end = new Date(entry.ended_at).getTime();

  return Math.max(0, Math.floor((end - start) / 1000 / 60));
};

const getNetMinutes = (entry: TimeEntry) => {
  const gross = getGrossMinutes(entry);
  return Math.max(0, gross - (entry.total_break_minutes || 0));
};

const formatMinutesToHours = (minutes: number) => {
  const hrs = Math.floor(minutes / 60);
  const mins = minutes % 60;
  return `${hrs} Std. ${mins} Min.`;
};

const getTotalNetMinutesForOrder = (orderId: string) => {
  return getCompletedTimeEntriesForOrder(orderId).reduce(
    (sum, entry) => sum + getNetMinutes(entry),
    0
  );
};

  return (
    <div className="dashboard-page">
      <div className="dashboard-container">
        <header className="topbar">
          <div className="topbar-left">
            <h1>Mitarbeiter-Dashboard</h1>
            <p className="topbar-subtitle">
              Hier sieht der Mitarbeiter nur seine eigenen Aufträge.
            </p>
          </div>

          <div className="topbar-right">
            <div className="user-box">
              <span className="user-label">Eingeloggt als</span>
              <strong>{userName}</strong>
              <span className="user-meta">{userEmail}</span>
            </div>

            <button onClick={onLogout} className="btn btn-secondary">
              Logout
            </button>
          </div>
        </header>

        <section className="single-page-section">
          <div className="card">
            <h2>Meine Aufträge</h2>
            <p>Es werden nur die dir zugewiesenen Aufträge angezeigt.</p>

            {message && <p className="info-text">{message}</p>}

            {orders.length === 0 ? (
              <div className="empty-state">
                <p>Aktuell sind dir keine Aufträge zugewiesen.</p>
              </div>
            ) : (
              <div className="list-grid">
                {orders.map((order) => {
                  const orderProgress = getOrderProgressEntries(order.id);
                  const openTimeEntry = getOpenTimeEntryForOrder(order.id);
                  const completedTimeEntries = getCompletedTimeEntriesForOrder(order.id);
                  const totalNetMinutes = getTotalNetMinutesForOrder(order.id);

                  return (
                    <div key={order.id} className="card" style={{ marginBottom: "1rem" }}>
                      <div className="page-topbar">
                        <div>
                          <h3>{order.title}</h3>
                          <p>{order.description || "Keine Beschreibung"}</p>
                        </div>

                        <span className={getStatusClass(order.status)}>{order.status}</span>
                      </div>

                      <p>
                        <strong>Ort:</strong>{" "}
                        {[order.address_street, order.address_zip, order.address_city]
                          .filter(Boolean)
                          .join(", ") || "-"}
                      </p>

                      <p>
                      <strong>Zeitraum:</strong> {formatDateOnly(order.start_date)} bis{" "}
                      {formatDateOnly(order.end_date)}
                      </p>
                        
                        <div className="form-group">
  <label>Stechuhr</label>

{openTimeEntry ? (
  <div className="info-text">
    Arbeit läuft seit {formatDateTime(openTimeEntry.started_at || "")}
    {" · "}Status: {openTimeEntry.status}
    {" · "}Pause gesamt: {openTimeEntry.total_break_minutes} Min.
    {" · "}Eintrag noch offen
  </div>
) : (
    <div className="info-text">
      Noch keine aktive Arbeitszeit auf diesem Auftrag.
    </div>
  )}

<div
  className="form-actions"
  style={{ marginTop: "0.5rem", display: "flex", gap: "0.5rem", flexWrap: "wrap" }}
>
  <button
    type="button"
    className="btn btn-primary"
    onClick={() => handleStartWork(order.id)}
    disabled={
      startingWorkOrderId === order.id ||
      (!!hasAnyOpenTimeEntry() && !openTimeEntry) ||
      !!openTimeEntry
    }
  >
    {startingWorkOrderId === order.id ? "Startet..." : "Arbeitsbeginn"}
  </button>

  <button
    type="button"
    className="btn btn-secondary"
    onClick={() => openTimeEntry && handleStartBreak(openTimeEntry.id)}
    disabled={
      !openTimeEntry ||
      openTimeEntry.status !== "working" ||
      startingBreakTimeEntryId === openTimeEntry?.id
    }
  >
    {startingBreakTimeEntryId === openTimeEntry?.id ? "Startet..." : "Pause starten"}
  </button>

  <button
    type="button"
    className="btn btn-secondary"
    onClick={() => openTimeEntry && handleEndBreak(openTimeEntry.id)}
    disabled={
      !openTimeEntry ||
      openTimeEntry.status !== "break" ||
      endingBreakTimeEntryId === openTimeEntry?.id
    }
  >
    {endingBreakTimeEntryId === openTimeEntry?.id ? "Beendet..." : "Pause beenden"}
  </button>

<button
  type="button"
  className="btn btn-danger"
  onClick={() => openTimeEntry && handleEndWork(openTimeEntry.id)}
  disabled={
    !openTimeEntry ||
    openTimeEntry.status === "break" ||
    endingWorkTimeEntryId === openTimeEntry?.id
  }
>
  {endingWorkTimeEntryId === openTimeEntry?.id ? "Beendet..." : "Arbeit beenden"}
</button>

</div>

  {!!hasAnyOpenTimeEntry() && !openTimeEntry && (
    <p className="info-text">
      Es läuft bereits eine aktive Zeiterfassung auf einem anderen Auftrag.
    </p>
  )}
</div>

<div style={{ marginTop: "1rem" }}>
  <h4>Zeitauswertung</h4>

  {completedTimeEntries.length === 0 ? (
    <p>Noch keine abgeschlossenen Zeiteinträge vorhanden.</p>
  ) : (
    <>
      <div className="info-text" style={{ marginBottom: "0.75rem" }}>
        Gesamt-Nettozeit auf diesem Auftrag: <strong>{formatMinutesToHours(totalNetMinutes)}</strong>
      </div>

      <div className="list-grid">
        {completedTimeEntries.map((entry) => {
          const grossMinutes = getGrossMinutes(entry);
          const netMinutes = getNetMinutes(entry);

          return (
            <div key={entry.id} className="customer-item">
              <div className="customer-meta">
                <span>Start: {entry.started_at ? formatDateTime(entry.started_at) : "-"}</span>
                <span>Ende: {entry.ended_at ? formatDateTime(entry.ended_at) : "-"}</span>
                <span>Pause: {entry.total_break_minutes} Min.</span>
              </div>

              <div style={{ marginTop: "0.5rem" }}>
                <strong>Brutto:</strong> {formatMinutesToHours(grossMinutes)}
              </div>
              <div>
                <strong>Netto:</strong> {formatMinutesToHours(netMinutes)}
              </div>
            </div>
          );
        })}
      </div>
    </>
  )}
</div>
                      <div className="form-group">
                        <label>Status ändern</label>
                        <select
                          value={order.status}
                          onChange={(e) => handleStatusChange(order.id, e.target.value)}
                          disabled={savingOrderId === order.id}
                        >
                          <option value="in_arbeit">In Arbeit</option>
                          <option value="pausiert">Pausiert</option>
                          <option value="fertig">Fertig</option>
                        </select>
                      </div>

                      <div className="form-group">
                        <label>Neue Fortschrittsnotiz</label>
                        <textarea
                          value={progressNotes[order.id] || ""}
                          onChange={(e) =>
                            handleProgressInputChange(order.id, e.target.value)
                          }
                          rows={3}
                          placeholder="z. B. Grundierung abgeschlossen, Wohnzimmer erste Wand gestrichen ..."
                        />
                      </div>

                      <div className="form-actions">
                        <button
                          type="button"
                          className="btn btn-primary"
                          onClick={() => handleSaveProgress(order.id)}
                          disabled={savingProgressOrderId === order.id}
                        >
                          {savingProgressOrderId === order.id
                            ? "Speichert..."
                            : "Fortschritt speichern"}
                        </button>
                      </div>

                      <div style={{ marginTop: "1rem" }}>
                        <h4>Verlauf</h4>

                        {orderProgress.length === 0 ? (
                          <p>Noch keine Fortschrittsnotizen vorhanden.</p>
                        ) : (
                          <div className="list-grid">
                            {orderProgress.map((entry) => (
                              <div key={entry.id} className="customer-item">
                                <div className="customer-meta">
                                  <span>
                                 {formatDateTime(entry.created_at)}
                                  </span>
                                </div>
                                <div style={{ marginTop: "0.5rem" }}>{entry.note}</div>
                              </div>
                            ))}
                          </div>
                        )}
                      </div>
                    </div>
                  );
                })}
              </div>
            )}
          </div>
        </section>
      </div>
    </div>
  );
}