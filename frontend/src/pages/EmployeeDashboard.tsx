import { useState } from "react";
import { supabase } from "../lib/supabase";

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

type ProgressImage = {
  id: number;
  tenant_id: number;
  progress_id: number;
  user_id: number;
  image_url: string;
  file_path: string | null;
  created_at: string;
  order_id: number;
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
  progressImages: ProgressImage[];
  timeEntries: TimeEntry[];
  onOpenMessages: () => void;
  unreadMessages: number;
  onUpdateOrderStatus: (orderId: string, newStatus: string) => Promise<void>;
  onCreateProgress: (orderId: string, note: string) => Promise<any>;
  onReloadProgress: () => Promise<void>;
  onReloadOrders: () => Promise<void>;
  onDeleteProgressImage: (imageId: number, filePath: string | null) => Promise<void>;
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
  progressImages = [],
  timeEntries = [],
  onUpdateOrderStatus,
  onCreateProgress,
  onReloadProgress,
  onReloadOrders,
  onDeleteProgressImage,
  onStartWork,
  onStartBreak,
  onEndBreak,
  onEndWork,
  onOpenMessages,
  unreadMessages,
}: EmployeeDashboardProps) {

  const [savingOrderId, setSavingOrderId] = useState<string | null>(null);
  const [savingProgressOrderId, setSavingProgressOrderId] = useState<string | null>(null);
  const [startingWorkOrderId, setStartingWorkOrderId] = useState<string | null>(null);
  const [startingBreakTimeEntryId, setStartingBreakTimeEntryId] = useState<number | null>(null);
  const [endingBreakTimeEntryId, setEndingBreakTimeEntryId] = useState<number | null>(null);
  const [endingWorkTimeEntryId, setEndingWorkTimeEntryId] = useState<number | null>(null);
  const [message, setMessage] = useState("");
  const [finishNoteErrorOrderId, setFinishNoteErrorOrderId] = useState<string | null>(null);
  const [selectedImagePreview, setSelectedImagePreview] = useState<string | null>(null);
  const [progressNotes, setProgressNotes] = useState<Record<string, string>>({});
  const [selectedProgressImages, setSelectedProgressImages] = useState<
  Record<string, File[]>
>({});

const handleProgressImageChange = (
  orderId: string,
  files: File[]
) => {
  if (files.length > 4) {
    setMessage("Bitte maximal 4 Bilder pro Fortschritt auswählen.");
    files = files.slice(0, 4);
  }

  setSelectedProgressImages((prev) => ({
    ...prev,
    [orderId]: files,
  }));
};

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
      case "zur_pruefung":
        return "status-badge status-zur-pruefung";
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

  const handleCompleteOrder = async (orderId: string) => {
  const note = (progressNotes[orderId] || "").trim();

  if (!note) {
  setFinishNoteErrorOrderId(orderId);
  return;
}

setFinishNoteErrorOrderId(null);

  setSavingProgressOrderId(orderId);
  setMessage("");

  try {
    await handleSaveProgress(orderId);

    await onUpdateOrderStatus(orderId, "zur_pruefung");

    await onReloadProgress();
    await onReloadOrders();

    setMessage("Auftrag wurde fertig gemeldet.");
  } catch (error) {
    console.error("Fehler beim Fertigmelden des Auftrags:", error);
    setMessage(
      `Auftrag konnte nicht fertig gemeldet werden: ${
        error instanceof Error ? error.message : "Unbekannter Fehler"
      }`
    );
  } finally {
    setSavingProgressOrderId(null);
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
  const imageFiles = selectedProgressImages[orderId] || [];

  if (!note && imageFiles.length === 0) {
    setMessage("Bitte eine Fortschrittsnotiz oder ein Bild hinzufügen.");
    return;
  }

  setSavingProgressOrderId(orderId);
  setMessage("");

  try {
    const savedProgress = await onCreateProgress(
      orderId,
      note || "Fortschrittsbild hochgeladen."
    );
    console.log("SAVED PROGRESS:", savedProgress);
    console.log("IMAGE FILE:", imageFiles);

    if (imageFiles.length > 0 && savedProgress?.id) {
  for (const imageFile of imageFiles) {
    const fileExt = imageFile.name.split(".").pop();

    const filePath =
      `${orderId}/progress-${savedProgress.id}-${Date.now()}-` +
      `${Math.random().toString(36).slice(2)}.${fileExt}`;

    const { error: uploadError } = await supabase.storage
      .from("order-progress-images")
      .upload(filePath, imageFile, {
        cacheControl: "3600",
        upsert: true,
      });

    if (uploadError) {
      throw uploadError;
    }

    const { data: publicUrlData } = supabase.storage
      .from("order-progress-images")
      .getPublicUrl(filePath);

    const imageUrl = publicUrlData.publicUrl;

    const { error: imageInsertError } = await supabase
      .from("order_progress_images")
      .insert({
        tenant_id: savedProgress.tenant_id,
        order_id: Number(orderId),
        progress_id: savedProgress.id,
        user_id: savedProgress.user_id,
        image_url: imageUrl,
        file_path: filePath,
      });

    if (imageInsertError) {
      throw imageInsertError;
    }
  }
}

    setProgressNotes((prev) => ({
      ...prev,
      [orderId]: "",
    }));

    setSelectedProgressImages((prev) => ({
      ...prev,
      [orderId]: [],
    }));

    await onReloadProgress();
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

<section className="action-bar">
  <button
    type="button"
    className="btn btn-primary"
    onClick={onOpenMessages}
  >
    Nachrichten {unreadMessages > 0 ? `(${unreadMessages})` : ""}
  </button>
</section>

          <section className="single-page-section">
          <div className="card">
            <h2>Meine Aufträge</h2>

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
                    <div
  key={order.id}
  className="card"
  style={{
    marginBottom: "1rem",
    border: openTimeEntry ? "2px solid #22c55e" : "1px solid #e5e7eb",
    background: openTimeEntry ? "#f0fdf4" : "#ffffff",
    boxShadow: openTimeEntry
      ? "0 6px 20px rgba(34,197,94,0.15)"
      : undefined,
  }}
>
                      <div className="page-topbar">

                        {openTimeEntry && (
  <div
    style={{
      display: "inline-block",
      marginBottom: "10px",
      padding: "6px 12px",
      borderRadius: "999px",
      background: "#22c55e",
      color: "#fff",
      fontWeight: 700,
      fontSize: "0.85rem",
    }}
  >
    🟢 AKTIV
  </div>
)}
                        <div>
                          <h3>{order.title}</h3>
                          <p>{order.description || "Keine Beschreibung"}</p>
                        </div>

                        <span className={getStatusClass(order.status)}>
  {order.status === "zur_pruefung"
    ? "🔎 Zur Prüfung"
    : order.status.replaceAll("_", " ")}
</span>
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
                        <label>
                        Neue Fortschrittsnotiz / Abschlussnotiz
                        <span style={{ color: "#f60707", fontWeight: 700 }}> *</span>
                        </label>
                        {finishNoteErrorOrderId === order.id && (
  <p
    className="info-text"
    style={{
      marginTop: "4px",
      marginBottom: "8px",
      fontWeight: 600,
      color: "#b91c1c",
    }}
  >
    Für „Auftrag fertig melden“ bitte eine kurze Abschlussnotiz eintragen.
  </p>
)}
                        <textarea
                          value={progressNotes[order.id] || ""}
                          onChange={(e) =>
                            handleProgressInputChange(order.id, e.target.value)
                          }
                          rows={3}
                          placeholder="z. B. Grundierung abgeschlossen, Wohnzimmer erste Wand gestrichen ..."
                        />
                      </div>

                      <div className="form-group">
  <label>Fortschrittsbild</label>
  <input
  type="file"
  accept="image/png,image/jpeg,image/webp"
  multiple
  onChange={(e) =>
    handleProgressImageChange(
      order.id,
      Array.from(e.target.files || [])
    )
  }
/>

  {selectedProgressImages[order.id]?.length > 0 && (
  <div className="info-text">
    <strong>{selectedProgressImages[order.id].length} Bild(er) ausgewählt:</strong>
    <ul style={{ margin: "6px 0 0 18px" }}>
      {selectedProgressImages[order.id].map((file) => (
        <li key={file.name}>{file.name}</li>
      ))}
    </ul>
  </div>
)}
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

<div
  style={{
    marginTop: "18px",
    paddingTop: "18px",
    borderTop: "2px solid #e5e7eb",
  }}
>
  <h4 style={{ marginBottom: "10px" }}>Auftrag abschließen</h4>

  <div className="form-actions">
    <button
      type="button"
      className="btn btn-danger"
      onClick={() => handleCompleteOrder(order.id)}
      disabled={
        savingProgressOrderId === order.id ||
        order.status === "fertig"
      }
    >
      {order.status === "fertig"
        ? "Auftrag ist fertig"
        : "Auftrag fertig melden"}
    </button>
  </div>
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

{progressImages.filter((img) => img.progress_id === entry.id).length > 0 && (
  <div
    style={{
      display: "grid",
      gridTemplateColumns: "repeat(auto-fit, minmax(140px, 1fr))",
      gap: "10px",
      marginTop: "12px",
    }}
  >
    {progressImages
      .filter((img) => img.progress_id === entry.id)
      .map((img) => (
        <div
  key={img.id}
  style={{
    position: "relative",
  }}
>
  <button
    type="button"
    onClick={async () => {
  const confirmed = window.confirm(
    "Möchtest du dieses Bild wirklich löschen?"
  );

  if (!confirmed) return;

  await onDeleteProgressImage(img.id, img.file_path);
}}
    style={{
      position: "absolute",
      top: "6px",
      right: "6px",
      width: "28px",
      height: "28px",
      borderRadius: "50%",
      border: "none",
      background: "rgba(220,38,38,0.9)",
      color: "#fff",
      fontWeight: 700,
      cursor: "pointer",
      zIndex: 2,
    }}
  >
    ✕
  </button>

  <button
  type="button"
  onClick={() => setSelectedImagePreview(img.image_url)}
  style={{
    padding: 0,
    border: "none",
    background: "transparent",
    width: "100%",
    cursor: "pointer",
  }}
>
  <img
    src={img.image_url}
    alt="Fortschritt"
    style={{
      width: "100%",
      height: "140px",
      borderRadius: "10px",
      border: "1px solid #ddd",
      objectFit: "cover",
    }}
  />
</button>
</div>
      ))}
  </div>
)}
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

{selectedImagePreview && (
  <div
    onClick={() => setSelectedImagePreview(null)}
    style={{
      position: "fixed",
      inset: 0,
      background: "rgba(0,0,0,0.85)",
      zIndex: 9999,
      display: "flex",
      alignItems: "center",
      justifyContent: "center",
      padding: "20px",
    }}
  >
    <button
      type="button"
      onClick={(e) => {
        e.stopPropagation();
        setSelectedImagePreview(null);
      }}
      style={{
        position: "absolute",
        top: "18px",
        right: "18px",
        width: "42px",
        height: "42px",
        borderRadius: "50%",
        border: "none",
        background: "#fff",
        color: "#111",
        fontSize: "22px",
        fontWeight: 700,
        cursor: "pointer",
      }}
    >
      ✕
    </button>

    <img
      src={selectedImagePreview}
      alt="Fortschritt groß"
      onClick={(e) => e.stopPropagation()}
      style={{
        maxWidth: "100%",
        maxHeight: "85vh",
        borderRadius: "14px",
        background: "#fff",
        objectFit: "contain",
      }}
    />
  </div>
)}

    </div>
  );
}