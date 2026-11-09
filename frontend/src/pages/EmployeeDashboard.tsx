import { useEffect, useMemo, useRef, useState } from "react";
import { supabase } from "../lib/supabase";
import EmployeeMaterialsSection from "./EmployeeMaterialsSection";
import { showConfirm } from "../lib/dialogs";
import { greeting } from "../modules/projektleiter/logic";
import {
  breakRule,
  canReportDone,
  canTogglePause,
  entryNetMinutes,
  fmtClock,
  fmtDate,
  fmtDateTime,
  fmtDuration,
  fmtPeriod,
  fmtTime,
  friendlyError,
  isOpenEntry,
  liveNetMs,
  sortOrders,
  statusLabel,
  todayTotals,
} from "../modules/mitarbeiter/logic";
import { compressImage, fileExtension } from "../modules/mitarbeiter/images";
import "../modules/mitarbeiter/ma.css";

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
  tenantId: number;
  currentUserId: number;
  onLogout: () => void;
  orders: EmployeeOrder[];
  progressEntries: ProgressEntry[];
  progressImages: ProgressImage[];
  timeEntries: TimeEntry[];
  onOpenMessages: () => void;
  unreadMessages: number;
  onUpdateOrderStatus: (orderId: string, newStatus: string) => Promise<void>;
  onCreateProgress: (orderId: string, note: string) => Promise<{ id: number; tenant_id: number; user_id: number } | null>;
  onReloadProgress: () => Promise<void>;
  onReloadOrders: () => Promise<void>;
  onDeleteProgressImage: (imageId: number, filePath: string | null) => Promise<void>;
  onStartWork: (orderId: string) => Promise<void>;
  onStartBreak: (timeEntryId: number) => Promise<void>;
  onEndBreak: (timeEntryId: number) => Promise<void>;
  onEndWork: (timeEntryId: number) => Promise<void>;
  /** Firmenname für die Kopfzeile */
  companyName?: string;
  onImpressum?: () => void;
  onDatenschutz?: () => void;
  /** Eingebettet (z. B. „Meine Ausführungsaufträge“ beim Projektleiter): ohne eigene Kopfzeile */
  embedded?: boolean;
};

type Tab = "zeit" | "fortschritt" | "material" | "verlauf";
type Notice = { orderId: string | null; text: string; tone: "ok" | "err" | "warn" };

const MAX_PHOTOS = 4;

function PhotoThumb({ file, onRemove }: { file: File; onRemove: () => void }) {
  const url = useMemo(() => URL.createObjectURL(file), [file]);
  useEffect(() => () => URL.revokeObjectURL(url), [url]);
  return (
    <div className="ma-thumb">
      {url && <img src={url} alt="" />}
      <button type="button" onClick={onRemove} aria-label="Foto entfernen">
        ✕
      </button>
    </div>
  );
}

export default function EmployeeDashboard({
  userName,
  userEmail,
  tenantId,
  currentUserId,
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
  companyName,
  onImpressum,
  onDatenschutz,
  embedded = false,
}: EmployeeDashboardProps) {
  const [now, setNow] = useState(() => new Date());
  const [breakStart, setBreakStart] = useState<Date | null>(null);
  const [expandedId, setExpandedId] = useState<string | null>(null);
  const [tabs, setTabs] = useState<Record<string, Tab>>({});
  const [busy, setBusy] = useState<string | null>(null);
  const [notice, setNotice] = useState<Notice | null>(null);
  const [notes, setNotes] = useState<Record<string, string>>({});
  const [photos, setPhotos] = useState<Record<string, File[]>>({});
  const [noteMissing, setNoteMissing] = useState<string | null>(null);
  const [showAllTimes, setShowAllTimes] = useState<Record<string, boolean>>({});
  const [preview, setPreview] = useState<string | null>(null);
  const noteRefs = useRef<Record<string, HTMLTextAreaElement | null>>({});

  const openEntry = useMemo(() => timeEntries.find((e) => isOpenEntry(e)) ?? null, [timeEntries]);
  const activeOrderId = openEntry ? String(openEntry.order_id) : null;
  const activeOrder = activeOrderId ? orders.find((o) => String(o.id) === activeOrderId) ?? null : null;
  const sortedOrders = useMemo(() => sortOrders(orders, activeOrderId), [orders, activeOrderId]);

  // Uhr: während der Arbeitszeit jede Sekunde, sonst jede Minute
  useEffect(() => {
    const id = window.setInterval(() => setNow(new Date()), openEntry ? 1000 : 60000);
    return () => window.clearInterval(id);
  }, [openEntry]);

  // Beginn der laufenden Pause (für die Live-Uhr)
  useEffect(() => {
    if (!openEntry || openEntry.status !== "break") {
      setBreakStart(null);
      return;
    }
    let cancelled = false;
    supabase
      .rpc("employee_open_break_started_at", { p_time_entry_id: openEntry.id })
      .then(({ data, error }) => {
        if (cancelled) return;
        setBreakStart(!error && data ? new Date(String(data)) : null);
      });
    return () => {
      cancelled = true;
    };
  }, [openEntry?.id, openEntry?.status]);

  // Beim Öffnen: laufenden Auftrag bzw. einzigen Auftrag aufklappen
  useEffect(() => {
    if (expandedId) return;
    if (activeOrderId) setExpandedId(activeOrderId);
    else if (orders.length === 1) setExpandedId(String(orders[0].id));
  }, [activeOrderId, orders.length]);

  // Erfolgsmeldungen nach ein paar Sekunden ausblenden
  useEffect(() => {
    if (!notice || notice.tone !== "ok") return;
    const id = window.setTimeout(() => setNotice(null), 5000);
    return () => window.clearTimeout(id);
  }, [notice]);

  const today = todayTotals(timeEntries, now, breakStart);
  const rule = breakRule(today.workMinutes, today.breakMinutes);
  const liveMs = openEntry ? liveNetMs(openEntry, now, breakStart) : null;
  const openOrdersCount = orders.filter((o) => o.status !== "zur_pruefung").length;

  const say = (orderId: string | null, text: string, tone: Notice["tone"] = "ok") => setNotice({ orderId, text, tone });

  const tabOf = (orderId: string): Tab => tabs[orderId] ?? "zeit";
  const setTab = (orderId: string, tab: Tab) => {
    setTabs((p) => ({ ...p, [orderId]: tab }));
    if (notice && notice.tone !== "ok") setNotice(null);
  };

  const toggleOrder = (orderId: string) => {
    setExpandedId((cur) => (cur === orderId ? null : orderId));
    if (notice?.orderId && notice.orderId !== orderId) setNotice(null);
  };

  const scrollToOrder = (orderId: string) => {
    setExpandedId(orderId);
    window.setTimeout(() => document.getElementById(`ma-order-${orderId}`)?.scrollIntoView({ behavior: "smooth", block: "start" }), 50);
  };

  // ---------- Stechuhr ----------

  const startWork = async (orderId: string) => {
    setBusy(`start-${orderId}`);
    setNotice(null);
    try {
      await onStartWork(orderId);
      await onReloadOrders();
      say(orderId, "Arbeitsbeginn gespeichert. Die Stechuhr läuft.");
    } catch (e) {
      say(orderId, friendlyError(e, "Arbeitsbeginn konnte nicht gespeichert werden."), "err");
    } finally {
      setBusy(null);
    }
  };

  const startBreak = async () => {
    if (!openEntry) return;
    setBusy("break");
    setNotice(null);
    try {
      await onStartBreak(openEntry.id);
      setBreakStart(new Date());
      say(null, "Pause gestartet. Gute Erholung!");
    } catch (e) {
      say(null, friendlyError(e, "Pause konnte nicht gestartet werden."), "err");
    } finally {
      setBusy(null);
    }
  };

  const endBreak = async () => {
    if (!openEntry) return;
    setBusy("break");
    setNotice(null);
    try {
      await onEndBreak(openEntry.id);
      say(null, "Pause beendet. Die Arbeitszeit läuft weiter.");
    } catch (e) {
      say(null, friendlyError(e, "Pause konnte nicht beendet werden."), "err");
    } finally {
      setBusy(null);
    }
  };

  /** Pausenregel prüfen, bevor die Arbeit beendet wird. false = abgebrochen */
  const confirmBreakRule = async () => {
    const t = todayTotals(timeEntries, new Date(), breakStart);
    const r = breakRule(t.workMinutes, t.breakMinutes);
    if (r.missing <= 0) return true;
    return showConfirm(
      `Du hast heute ${fmtDuration(t.workMinutes)} gearbeitet und ${fmtDuration(t.breakMinutes)} Pause erfasst.\n\n` +
        `Nach dem Arbeitszeitgesetz sind bei mehr als ${t.workMinutes > 540 ? "9" : "6"} Stunden Arbeit mindestens ${r.required} Minuten Pause vorgeschrieben – es fehlen ${r.missing} Minuten.\n\n` +
        `Falls du die Pause gemacht, aber nicht in der Stechuhr erfasst hast, sag bitte im Büro Bescheid.`,
      { title: "Pause zu kurz", tone: "warning", confirmLabel: "Trotzdem beenden", cancelLabel: "Zurück" }
    );
  };

  const endWork = async () => {
    if (!openEntry || openEntry.status !== "working") return;
    if (!(await confirmBreakRule())) return;
    setBusy("end");
    setNotice(null);
    try {
      await onEndWork(openEntry.id);
      say(null, "Arbeit beendet. Schönen Feierabend!");
    } catch (e) {
      say(null, friendlyError(e, "Arbeit konnte nicht beendet werden."), "err");
    } finally {
      setBusy(null);
    }
  };

  // ---------- Fortschritt ----------

  const addPhotos = (orderId: string, list: FileList | null) => {
    const picked = Array.from(list || []).filter((f) => f.type.startsWith("image/") || /\.(heic|heif)$/i.test(f.name));
    if (picked.length === 0) return;
    setPhotos((prev) => {
      const merged = [...(prev[orderId] || []), ...picked];
      if (merged.length > MAX_PHOTOS) say(orderId, `Bitte höchstens ${MAX_PHOTOS} Fotos auf einmal hochladen.`, "warn");
      return { ...prev, [orderId]: merged.slice(0, MAX_PHOTOS) };
    });
  };

  const removePhoto = (orderId: string, index: number) =>
    setPhotos((prev) => ({ ...prev, [orderId]: (prev[orderId] || []).filter((_, i) => i !== index) }));

  /** Speichert Notiz + Fotos. Wirft bei Fehlern (Meldung schon gesetzt). */
  const saveProgressCore = async (orderId: string, fallbackNote: string) => {
    const note = (notes[orderId] || "").trim();
    const files = photos[orderId] || [];
    if (!note && files.length === 0) {
      say(orderId, "Bitte eine Notiz schreiben oder ein Foto hinzufügen.", "warn");
      throw new Error("leer");
    }

    let saved: Awaited<ReturnType<typeof onCreateProgress>> = null;
    try {
      saved = await onCreateProgress(orderId, note || fallbackNote);
    } catch (e) {
      say(orderId, friendlyError(e, "Die Notiz konnte nicht gespeichert werden. Bitte noch einmal versuchen."), "err");
      throw e;
    }
    setNotes((p) => ({ ...p, [orderId]: "" }));

    const failed: File[] = [];
    let uploaded = 0;
    let lastError: unknown = null;
    if (saved?.id) {
      for (const original of files) {
        try {
          const file = await compressImage(original);
          const filePath = `${orderId}/progress-${saved.id}-${Date.now()}-${Math.random().toString(36).slice(2)}.${fileExtension(file)}`;
          const { error: upErr } = await supabase.storage
            .from("order-progress-images")
            .upload(filePath, file, { cacheControl: "3600", upsert: false, contentType: file.type });
          if (upErr) throw upErr;
          const { error: insErr } = await supabase.from("order_progress_images").insert({
            tenant_id: saved.tenant_id,
            order_id: Number(orderId),
            progress_id: saved.id,
            user_id: saved.user_id,
            image_url: filePath,
            file_path: filePath,
          });
          if (insErr) {
            await supabase.storage.from("order-progress-images").remove([filePath]);
            throw insErr;
          }
          uploaded += 1;
        } catch (e) {
          console.error("Foto-Upload fehlgeschlagen:", e);
          lastError = e;
          failed.push(original);
        }
      }
      if (uploaded > 0) {
        const { error: evErr } = await supabase.rpc("create_progress_images_business_event", {
          p_order_id: Number(orderId),
          p_image_count: uploaded,
        });
        if (evErr) console.warn("Benachrichtigung zu Fotos nicht erstellt:", evErr);
      }
    } else if (files.length > 0) {
      failed.push(...files);
    }

    setPhotos((p) => ({ ...p, [orderId]: failed }));
    await onReloadProgress();

    if (failed.length > 0) {
      const reason = friendlyError(lastError, "Bitte die Internetverbindung prüfen und die Fotos noch einmal speichern.");
      say(orderId, `Die Notiz wurde gespeichert, aber ${failed.length} Foto(s) nicht. ${reason}`, "err");
      throw new Error("fotos");
    }
    return uploaded;
  };

  const saveProgress = async (orderId: string) => {
    setBusy(`save-${orderId}`);
    setNotice(null);
    try {
      const count = await saveProgressCore(orderId, "Fotos hochgeladen.");
      say(orderId, count > 0 ? `Gespeichert – mit ${count} Foto(s).` : "Fortschritt gespeichert.");
    } catch {
      /* Meldung ist gesetzt */
    } finally {
      setBusy(null);
    }
  };

  const setPause = async (order: EmployeeOrder, status: "in_arbeit" | "pausiert") => {
    if (order.status === status) return;
    setBusy(`status-${order.id}`);
    setNotice(null);
    try {
      await onUpdateOrderStatus(order.id, status);
      say(order.id, status === "pausiert" ? "Auftrag ist pausiert." : "Auftrag ist wieder in Arbeit.");
    } catch (e) {
      say(order.id, friendlyError(e, "Status konnte nicht geändert werden."), "err");
    } finally {
      setBusy(null);
    }
  };

  const reportDone = async (order: EmployeeOrder) => {
    const orderId = String(order.id);
    const note = (notes[orderId] || "").trim();
    if (!note) {
      setNoteMissing(orderId);
      say(orderId, "Bitte schreib kurz auf, was erledigt wurde – das ist die Abschlussnotiz für das Büro.", "warn");
      noteRefs.current[orderId]?.focus();
      return;
    }
    setNoteMissing(null);

    const timerHere = openEntry && String(openEntry.order_id) === orderId ? openEntry : null;
    if (timerHere) {
      const ok = await showConfirm(
        "Deine Arbeitszeit auf diesem Auftrag läuft noch.\n\nSoll die Arbeit jetzt beendet und der Auftrag fertig gemeldet werden?",
        { title: "Stechuhr läuft noch", tone: "warning", confirmLabel: "Arbeit beenden & melden" }
      );
      if (!ok) return;
      if (!(await confirmBreakRule())) return;
    } else {
      const ok = await showConfirm(
        "Auftrag jetzt fertig melden?\n\nDas Büro bekommt Bescheid und prüft den Auftrag. Danach kannst du den Status nicht mehr selbst ändern.",
        { title: "Fertig melden", confirmLabel: "Ja, fertig melden" }
      );
      if (!ok) return;
    }

    setBusy(`done-${orderId}`);
    setNotice(null);
    try {
      if (timerHere) {
        try {
          if (timerHere.status === "break") await onEndBreak(timerHere.id);
          await onEndWork(timerHere.id);
        } catch (e) {
          say(orderId, friendlyError(e, "Die Arbeitszeit konnte nicht beendet werden. Bitte zuerst oben „Arbeit beenden“ drücken."), "err");
          return;
        }
      }
      try {
        await saveProgressCore(orderId, note);
      } catch {
        return; // Meldung gesetzt, Auftrag NICHT fertig gemeldet
      }
      try {
        await onUpdateOrderStatus(orderId, "zur_pruefung");
      } catch (e) {
        say(orderId, `Die Notiz ist gespeichert, aber der Auftrag wurde nicht fertig gemeldet. ${friendlyError(e, "Bitte noch einmal versuchen.")}`, "err");
        return;
      }
      await Promise.all([onReloadProgress(), onReloadOrders()]);
      say(orderId, "Danke! Der Auftrag ist fertig gemeldet und wird vom Büro geprüft.");
    } finally {
      setBusy(null);
    }
  };

  const deleteImage = async (orderId: string, img: ProgressImage) => {
    const ok = await showConfirm("Dieses Foto wirklich löschen?", { danger: true, confirmLabel: "Ja, löschen" });
    if (!ok) return;
    setBusy(`img-${img.id}`);
    try {
      await onDeleteProgressImage(img.id, img.file_path);
      say(orderId, "Foto gelöscht.");
    } catch (e) {
      say(orderId, friendlyError(e, "Das Foto konnte nicht gelöscht werden."), "err");
    } finally {
      setBusy(null);
    }
  };

  // ---------- Darstellung ----------

  const noticeBox = (orderId: string | null) =>
    notice && notice.orderId === orderId ? (
      <p className={`ma-notice ${notice.tone}`} role={notice.tone === "err" ? "alert" : "status"}>
        {notice.text}
      </p>
    ) : null;

  const timerCard = (
    <section className={`ma-timer ${openEntry ? (openEntry.status === "break" ? "is-break" : "is-working") : "is-idle"}`}>
      {openEntry ? (
        <>
          <div className="ma-timer-top">
            <span className="ma-pill">{openEntry.status === "break" ? "☕ Pause" : "● Arbeit läuft"}</span>
            <button type="button" className="ma-link" onClick={() => scrollToOrder(String(openEntry.order_id))}>
              {activeOrder?.title || "Zum Auftrag"} →
            </button>
          </div>
          <div className="ma-clock" aria-live="off">
            {liveMs === null ? "Pause" : fmtClock(liveMs)}
          </div>
          <p className="ma-timer-sub">
            {openEntry.status === "break"
              ? breakStart
                ? `Pause seit ${fmtTime(breakStart)} Uhr`
                : "Pause läuft"
              : `Seit ${fmtTime(openEntry.started_at)} Uhr · Pause bisher ${fmtDuration(openEntry.total_break_minutes || 0)}`}
          </p>
          <div className="ma-timer-actions">
            {openEntry.status === "working" ? (
              <>
                <button type="button" className="ma-btn ghost" onClick={startBreak} disabled={!!busy}>
                  {busy === "break" ? "…" : "Pause starten"}
                </button>
                <button type="button" className="ma-btn stop" onClick={endWork} disabled={!!busy}>
                  {busy === "end" ? "…" : "Arbeit beenden"}
                </button>
              </>
            ) : (
              <button type="button" className="ma-btn go" onClick={endBreak} disabled={!!busy}>
                {busy === "break" ? "…" : "Pause beenden"}
              </button>
            )}
          </div>
        </>
      ) : (
        <>
          <div className="ma-timer-top">
            <span className="ma-pill">Stechuhr</span>
          </div>
          <p className="ma-timer-idle">
            Gerade läuft keine Arbeitszeit. Öffne unten einen Auftrag und tippe auf <b>„Arbeitsbeginn“</b>.
          </p>
        </>
      )}
      <p className="ma-timer-today">
        Heute gearbeitet: <b>{fmtDuration(today.workMinutes)}</b> · Pause: <b>{fmtDuration(today.breakMinutes)}</b>
      </p>
      {openEntry?.status === "working" && rule.missing > 0 && (
        <p className="ma-law">
          ⚠️ Du arbeitest heute schon über {today.workMinutes > 540 ? "9" : "6"} Stunden. Laut Arbeitszeitgesetz stehen dir
          mindestens {rule.required} Minuten Pause zu – bitte jetzt <b>„Pause starten“</b>.
        </p>
      )}
      {rule.overMax && (
        <p className="ma-law">⚠️ Mehr als 10 Stunden Arbeit am Tag sind laut Arbeitszeitgesetz nicht erlaubt. Bitte sprich mit dem Büro.</p>
      )}
      {noticeBox(null)}
    </section>
  );

  const renderTimeTab = (order: EmployeeOrder) => {
    const id = String(order.id);
    const here = openEntry && String(openEntry.order_id) === id;
    const done = timeEntries
      .filter((e) => String(e.order_id) === id && e.started_at && e.ended_at)
      .sort((a, b) => String(b.started_at).localeCompare(String(a.started_at)));
    const total = done.reduce((s, e) => s + entryNetMinutes(e, now), 0);
    const shown = showAllTimes[id] ? done : done.slice(0, 5);
    return (
      <div className="ma-pane">
        {here ? (
          <p className="ma-hint ok">
            {openEntry!.status === "break" ? "Du machst gerade Pause" : "Deine Arbeitszeit läuft"} auf diesem Auftrag – seit {fmtTime(openEntry!.started_at)} Uhr.
            Pause und Feierabend steuerst du oben in der Stechuhr.
          </p>
        ) : openEntry ? (
          <p className="ma-hint">
            Die Stechuhr läuft gerade auf „{activeOrder?.title || "einem anderen Auftrag"}“. Bitte dort zuerst „Arbeit beenden“.
          </p>
        ) : (
          <button type="button" className="ma-btn go big" onClick={() => startWork(id)} disabled={!!busy}>
            {busy === `start-${id}` ? "Startet …" : "▶ Arbeitsbeginn"}
          </button>
        )}

        <div className="ma-subhead">
          <h4>Meine Zeiten auf diesem Auftrag</h4>
          {done.length > 0 && <span>Gesamt: {fmtDuration(total)}</span>}
        </div>
        {done.length === 0 ? (
          <p className="ma-empty">Noch keine abgeschlossenen Zeiten.</p>
        ) : (
          <ul className="ma-times">
            {shown.map((e) => (
              <li key={e.id}>
                <span>{fmtDate(String(e.started_at).slice(0, 10)) || fmtDateTime(e.started_at)}</span>
                <span>
                  {fmtTime(e.started_at)}–{fmtTime(e.ended_at)} Uhr
                </span>
                <span>Pause {fmtDuration(e.total_break_minutes || 0)}</span>
                <b>{fmtDuration(entryNetMinutes(e, now))}</b>
              </li>
            ))}
          </ul>
        )}
        {done.length > 5 && (
          <button type="button" className="ma-link" onClick={() => setShowAllTimes((p) => ({ ...p, [id]: !p[id] }))}>
            {showAllTimes[id] ? "Weniger anzeigen" : `Alle ${done.length} Einträge anzeigen`}
          </button>
        )}
      </div>
    );
  };

  const renderProgressTab = (order: EmployeeOrder) => {
    const id = String(order.id);
    const files = photos[id] || [];
    return (
      <div className="ma-pane">
        {canTogglePause(order.status) ? (
          <div className="ma-field">
            <label>Status</label>
            <div className="ma-seg" role="group" aria-label="Status">
              {(["in_arbeit", "pausiert"] as const).map((s) => (
                <button
                  key={s}
                  type="button"
                  className={order.status === s ? "on" : ""}
                  aria-pressed={order.status === s}
                  onClick={() => setPause(order, s)}
                  disabled={!!busy}
                >
                  {statusLabel(s)}
                </button>
              ))}
            </div>
          </div>
        ) : order.status === "zur_pruefung" ? (
          <p className="ma-hint ok">✓ Fertig gemeldet – das Büro prüft den Auftrag. Notizen und Fotos kannst du trotzdem noch ergänzen.</p>
        ) : (
          <p className="ma-hint">Der Status wechselt automatisch auf „In Arbeit“, sobald du unter „Arbeitszeit“ den Arbeitsbeginn drückst.</p>
        )}

        <div className="ma-field">
          <label htmlFor={`ma-note-${id}`}>Notiz</label>
          <textarea
            id={`ma-note-${id}`}
            ref={(el) => {
              noteRefs.current[id] = el;
            }}
            className={noteMissing === id ? "missing" : ""}
            value={notes[id] || ""}
            onChange={(e) => {
              setNotes((p) => ({ ...p, [id]: e.target.value }));
              if (noteMissing === id) setNoteMissing(null);
            }}
            rows={3}
            placeholder="z. B. Wohnzimmer grundiert, Decke 1. Anstrich fertig …"
          />
        </div>

        <div className="ma-field">
          <label>Fotos (höchstens {MAX_PHOTOS})</label>
          <div className="ma-thumbs">
            {files.map((f, i) => (
              <PhotoThumb key={`${f.name}-${f.size}-${i}`} file={f} onRemove={() => removePhoto(id, i)} />
            ))}
            {files.length < MAX_PHOTOS && (
              <label className="ma-add-photo">
                <input
                  type="file"
                  accept="image/*"
                  multiple
                  onChange={(e) => {
                    addPhotos(id, e.target.files);
                    e.target.value = "";
                  }}
                />
                <span>📷</span>
                <small>Foto hinzufügen</small>
              </label>
            )}
          </div>
          <p className="ma-small">
            Bitte keine Personen, Autokennzeichen oder private Unterlagen des Kunden fotografieren. Die Fotos sehen das Büro und ggf. der Kunde im Kundenportal.
          </p>
        </div>

        <button type="button" className="ma-btn primary" onClick={() => saveProgress(id)} disabled={!!busy}>
          {busy === `save-${id}` ? "Speichert …" : "Fortschritt speichern"}
        </button>

        {canReportDone(order.status) && (
          <div className="ma-done">
            <div>
              <b>Arbeiten abgeschlossen?</b>
              <small>Notiz oben eintragen (z. B. was erledigt wurde), dann fertig melden. Das Büro bekommt Bescheid.</small>
            </div>
            <button type="button" className="ma-btn done" onClick={() => reportDone(order)} disabled={!!busy}>
              {busy === `done-${id}` ? "Meldet …" : "✓ Auftrag fertig melden"}
            </button>
          </div>
        )}
      </div>
    );
  };

  const renderHistoryTab = (order: EmployeeOrder) => {
    const id = String(order.id);
    const entries = progressEntries.filter((e) => String(e.order_id) === id);
    if (entries.length === 0) return <p className="ma-empty">Noch keine Notizen oder Fotos.</p>;
    return (
      <ul className="ma-history">
        {entries.map((entry) => {
          const imgs = progressImages.filter((img) => img.progress_id === entry.id);
          return (
            <li key={entry.id}>
              <small>{fmtDateTime(entry.created_at)}</small>
              <p>{entry.note}</p>
              {imgs.length > 0 && (
                <div className="ma-gallery">
                  {imgs.map((img) => (
                    <div key={img.id} className="ma-gimg">
                      <button type="button" className="ma-gopen" onClick={() => setPreview(img.image_url)} aria-label="Foto groß anzeigen">
                        <img src={img.image_url} alt="Fortschrittsfoto" loading="lazy" />
                      </button>
                      {img.user_id === currentUserId && (
                        <button
                          type="button"
                          className="ma-gdel"
                          onClick={() => deleteImage(id, img)}
                          disabled={busy === `img-${img.id}`}
                          aria-label="Foto löschen"
                        >
                          ✕
                        </button>
                      )}
                    </div>
                  ))}
                </div>
              )}
            </li>
          );
        })}
      </ul>
    );
  };

  const TAB_LABELS: Record<Tab, string> = {
    zeit: "Arbeitszeit",
    fortschritt: "Fortschritt",
    material: "Material",
    verlauf: "Verlauf",
  };

  return (
    <div className={embedded ? "ma-root ma-embedded" : "dashboard-page ma-root"}>
      <div className={embedded ? "" : "dashboard-container"}>
        {!embedded && (
          <header className="ma-head">
            <div>
              {companyName && <span className="ma-kicker">{companyName}</span>}
              <h1>
                {greeting(now)}, {userName.split(" ")[0] || userName}
              </h1>
              <p className="ma-muted">
                {new Intl.DateTimeFormat("de-DE", { weekday: "long", day: "numeric", month: "long" }).format(now)}
              </p>
            </div>
            <div className="ma-user">
              <div>
                <strong>{userName}</strong>
                <span>{userEmail}</span>
              </div>
              <button type="button" onClick={onLogout} className="btn btn-secondary">
                Abmelden
              </button>
            </div>
          </header>
        )}

        {timerCard}

        {!embedded && (
          <div className="ma-kpis">
            <div>
              <span>Offene Aufträge</span>
              <b>{openOrdersCount}</b>
            </div>
            <div>
              <span>Fertig gemeldet</span>
              <b>{orders.length - openOrdersCount}</b>
            </div>
            <button type="button" onClick={onOpenMessages} className={unreadMessages > 0 ? "has-new" : ""}>
              <span>Nachrichten</span>
              <b>{unreadMessages > 0 ? unreadMessages : "✉"}</b>
              <small>{unreadMessages > 0 ? (unreadMessages === 1 ? "neue Nachricht" : "neue Nachrichten") : "öffnen"}</small>
            </button>
          </div>
        )}

        <section className="ma-orders">
          <h2>Meine Aufträge</h2>
          {sortedOrders.length === 0 ? (
            <p className="ma-empty card-like">Aktuell sind dir keine Aufträge zugeteilt. Sobald das Büro dich einteilt, erscheinen sie hier.</p>
          ) : (
            sortedOrders.map((order) => {
              const id = String(order.id);
              const open = expandedId === id;
              const running = activeOrderId === id;
              const address = [order.address_street, [order.address_zip, order.address_city].filter(Boolean).join(" ")]
                .filter(Boolean)
                .join(", ");
              const period = fmtPeriod(order.start_date, order.end_date);
              const historyCount = progressEntries.filter((e) => String(e.order_id) === id).length;
              const tab = tabOf(id);
              return (
                <article key={id} id={`ma-order-${id}`} className={`ma-order${open ? " open" : ""}${running ? " running" : ""}`}>
                  <button type="button" className="ma-order-head" onClick={() => toggleOrder(id)} aria-expanded={open}>
                    <span className="ma-order-main">
                      <b>{order.title}</b>
                      {address && <small>📍 {address}</small>}
                      {period && <small>📅 {period}</small>}
                    </span>
                    <span className="ma-order-side">
                      {running && <span className="ma-live">läuft</span>}
                      <span className={`ma-status s-${order.status}`}>{statusLabel(order.status)}</span>
                      <span className="ma-chev" aria-hidden>
                        {open ? "▴" : "▾"}
                      </span>
                    </span>
                  </button>

                  {open && (
                    <div className="ma-order-body">
                      {order.description && <p className="ma-desc">{order.description}</p>}
                      {address && (
                        <a
                          className="ma-link"
                          href={`https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(address)}`}
                          target="_blank"
                          rel="noreferrer"
                        >
                          Route in Google Maps öffnen ↗
                        </a>
                      )}
                      <div className="ma-tabs" role="tablist">
                        {(Object.keys(TAB_LABELS) as Tab[]).map((t) => (
                          <button key={t} type="button" role="tab" aria-selected={tab === t} className={tab === t ? "on" : ""} onClick={() => setTab(id, t)}>
                            {TAB_LABELS[t]}
                            {t === "verlauf" && historyCount > 0 ? ` (${historyCount})` : ""}
                          </button>
                        ))}
                      </div>
                      {noticeBox(id)}
                      {tab === "zeit" && renderTimeTab(order)}
                      {tab === "fortschritt" && renderProgressTab(order)}
                      {tab === "material" && (
                        <div className="ma-pane">
                          <EmployeeMaterialsSection tenantId={tenantId} orderId={order.id} currentUserId={currentUserId} />
                        </div>
                      )}
                      {tab === "verlauf" && renderHistoryTab(order)}
                    </div>
                  )}
                </article>
              );
            })
          )}
        </section>

        {!embedded && (onImpressum || onDatenschutz) && (
          <footer className="ma-foot">
            {onImpressum && (
              <button type="button" onClick={onImpressum}>
                Impressum
              </button>
            )}
            {onDatenschutz && (
              <button type="button" onClick={onDatenschutz}>
                Datenschutz
              </button>
            )}
          </footer>
        )}
      </div>

      {preview && (
        <div className="ma-preview" onClick={() => setPreview(null)} role="dialog" aria-modal="true">
          <button type="button" onClick={() => setPreview(null)} aria-label="Schließen">
            ✕
          </button>
          <img src={preview} alt="Fortschrittsfoto groß" onClick={(e) => e.stopPropagation()} />
        </div>
      )}
    </div>
  );
}
