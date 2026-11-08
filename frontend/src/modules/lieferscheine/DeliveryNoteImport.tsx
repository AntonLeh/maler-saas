// Lieferschein einlesen (Materialverwaltung): Foto/PDF → KI liest Positionen → prüfen → Wareneingang ins Lager oder direkt zum Auftrag.

import { useEffect, useMemo, useState } from "react";
import * as api from "./api";
import type { DeliveryNote, MaterialLite, OrderLite, Recognized } from "./api";
import "./lieferscheine.css";

type Props = {
  tenantId: number;
  onBooked: () => void;
};

type Row = {
  include: boolean;
  source: api.RecognizedLine;
  materialId: string; // "" = neu anlegen
  newName: string;
  newUnit: string;
  quantity: string;
  price: string;
};

const fmtNum = (n: number | null | undefined) => (n == null ? "" : String(Math.round(n * 1000) / 1000).replace(".", ","));
const parseNum = (s: string): number | null => {
  const n = Number(String(s).replace(/\s/g, "").replace(",", "."));
  return Number.isFinite(n) ? n : null;
};
const fmtDate = (iso: string | null) => (iso ? new Date(`${iso.slice(0, 10)}T12:00:00`).toLocaleDateString("de-DE") : "");

/** Einkaufspreis je Materialeinheit aus dem Lieferschein-Preis (z. B. Preis je Eimer → je Liter) */
function pricePerMaterialUnit(l: api.RecognizedLine): number | null {
  if (l.unit_price_net == null) return null;
  if (!l.material_id || !l.quantity_in_material_unit) return l.unit_price_net;
  return Math.round(((l.unit_price_net * l.quantity) / l.quantity_in_material_unit) * 100) / 100;
}

function toRow(l: api.RecognizedLine): Row {
  return {
    include: true,
    source: l,
    materialId: l.material_id ? String(l.material_id) : "",
    newName: l.new_name,
    newUnit: l.new_unit,
    quantity: fmtNum(l.material_id ? l.quantity_in_material_unit ?? l.quantity : l.quantity),
    price: fmtNum(pricePerMaterialUnit(l)),
  };
}

function guessOrder(reference: string, orders: OrderLite[]): string {
  const ref = reference.toLowerCase();
  if (ref.length < 3) return "";
  const hit = orders.find((o) => {
    const t = o.title.toLowerCase();
    return (t.length >= 4 && ref.includes(t)) || (ref.length >= 4 && t.includes(ref));
  });
  return hit ? String(hit.id) : "";
}

export default function DeliveryNoteImport({ tenantId, onBooked }: Props) {
  const [open, setOpen] = useState(false);
  const [busy, setBusy] = useState("");
  const [error, setError] = useState("");
  const [done, setDone] = useState("");
  const [filePath, setFilePath] = useState<string | null>(null);
  const [fileUrl, setFileUrl] = useState<string | null>(null);
  const [head, setHead] = useState<Omit<Recognized, "lines">>({ supplier: "", note_date: null, note_number: "", reference: "" });
  const [rows, setRows] = useState<Row[] | null>(null);
  const [materials, setMaterials] = useState<MaterialLite[]>([]);
  const [orders, setOrders] = useState<OrderLite[]>([]);
  const [target, setTarget] = useState<"warehouse" | "order">("warehouse");
  const [orderId, setOrderId] = useState("");
  const [usage, setUsage] = useState("");
  const [notes, setNotes] = useState<DeliveryNote[] | null>(null);
  const [notesError, setNotesError] = useState("");

  const reloadNotes = () =>
    api
      .loadNotes(tenantId)
      .then((n) => {
        setNotes(n);
        setNotesError("");
      })
      .catch((e) => setNotesError((e as Error).message));

  useEffect(() => {
    if (!open) return;
    let cancelled = false;
    Promise.all([api.loadMaterials(tenantId), api.loadOpenOrders(tenantId)])
      .then(([m, o]) => {
        if (cancelled) return;
        setMaterials(m);
        setOrders(o);
      })
      .catch((e) => !cancelled && setError((e as Error).message));
    api
      .loadNotes(tenantId)
      .then((n) => !cancelled && setNotes(n))
      .catch((e) => !cancelled && setNotesError((e as Error).message));
    return () => {
      cancelled = true;
    };
  }, [open, tenantId]);

  const reset = () => {
    setFilePath(null);
    setFileUrl(null);
    setRows(null);
    setHead({ supplier: "", note_date: null, note_number: "", reference: "" });
    setTarget("warehouse");
    setOrderId("");
    setError("");
  };

  const onFile = async (file: File) => {
    reset();
    setDone("");
    try {
      setBusy("Lieferschein wird hochgeladen …");
      const path = await api.uploadNote(tenantId, file);
      setFilePath(path);
      api.noteFileUrl(path).then(setFileUrl);
      setBusy("Die KI liest den Lieferschein … (ca. 10–30 Sekunden)");
      const { data, used, limit } = await api.recognize(path);
      setHead({ supplier: data.supplier, note_date: data.note_date, note_number: data.note_number, reference: data.reference });
      setRows(data.lines.map(toRow));
      setUsage(limit ? `KI-Erkennungen diesen Monat: ${used} von ${limit}` : "");
      const guess = guessOrder(data.reference, orders);
      if (guess) {
        setTarget("order");
        setOrderId(guess);
      }
    } catch (e) {
      setError((e as Error).message);
    } finally {
      setBusy("");
    }
  };

  const update = (i: number, patch: Partial<Row>) => setRows((prev) => (prev ? prev.map((r, k) => (k === i ? { ...r, ...patch } : r)) : prev));

  const included = useMemo(() => (rows ?? []).filter((r) => r.include), [rows]);
  const problems = useMemo(() => {
    const p: string[] = [];
    included.forEach((r, i) => {
      const q = parseNum(r.quantity);
      if (q == null || q <= 0) p.push(`Position ${i + 1}: Menge fehlt`);
      if (!r.materialId && !r.newName.trim()) p.push(`Position ${i + 1}: Name für das neue Material fehlt`);
      if (r.price.trim() && parseNum(r.price) == null) p.push(`Position ${i + 1}: Preis ist keine Zahl`);
    });
    if (target === "order" && !orderId) p.push("Bitte einen Auftrag wählen");
    return p;
  }, [included, target, orderId]);

  const book = async () => {
    setError("");
    if (!included.length) return setError("Bitte mindestens eine Position auswählen.");
    if (problems.length) return setError(problems[0]);
    try {
      setBusy("Wareneingang wird gebucht …");
      const userId = await api.currentAppUserId();
      if (!userId) throw new Error("Benutzerprofil nicht gefunden. Bitte neu anmelden.");
      let pm: number | null = null;
      if (target === "order") {
        pm = await api.projectManagerOf(Number(orderId));
        if (!pm) throw new Error("Diesem Auftrag ist kein Projektleiter zugeordnet. Bitte zuerst einen Projektleiter eintragen oder ins Lager buchen.");
      }
      const res = await api.bookDeliveryNote({
        tenantId,
        userId,
        filePath,
        head,
        target,
        orderId: target === "order" ? Number(orderId) : null,
        projectManagerId: pm,
        materials,
        lines: included.map((r) => ({
          material_id: r.materialId ? Number(r.materialId) : null,
          new_name: r.newName,
          new_unit: r.newUnit,
          quantity: parseNum(r.quantity) ?? 0,
          unit_price: r.price.trim() ? parseNum(r.price) : null,
        })),
      });
      const order = orders.find((o) => String(o.id) === orderId);
      const where = target === "order" ? `direkt zum Auftrag „${order?.title ?? ""}“` : "ins Lager";
      setDone(
        `✅ ${res.booked} Position(en) ${where} gebucht${res.created ? `, ${res.created} neue(s) Material(ien) angelegt` : ""}.` +
          (res.failed.length ? ` Nicht gebucht: ${res.failed.join("; ")}` : "")
      );
      reset();
      reloadNotes();
      onBooked();
    } catch (e) {
      setError((e as Error).message);
    } finally {
      setBusy("");
    }
  };

  if (!open) {
    return (
      <div className="dn-entry">
        <button type="button" className="btn btn-primary" onClick={() => setOpen(true)}>
          📷 Lieferschein einlesen
        </button>
        <span className="dn-muted">Foto oder PDF – die KI liest die Positionen und bucht sie nach Ihrer Prüfung.</span>
      </div>
    );
  }

  const orderTitle = (id: number | null) => orders.find((o) => o.id === id)?.title ?? (id ? `Auftrag ${id}` : "");

  return (
    <div className="dn-panel">
      <div className="dn-head">
        <h3>📷 Lieferschein einlesen</h3>
        <button
          type="button"
          className="btn btn-secondary"
          onClick={() => {
            reset();
            setOpen(false);
          }}
          disabled={!!busy}
        >
          Schließen
        </button>
      </div>

      {done && <p className="dn-ok">{done}</p>}
      {error && <p className="dn-error">{error}</p>}

      {!rows && (
        <div className="dn-pick">
          <label className={`btn btn-primary${busy ? " disabled" : ""}`}>
            📷 Foto aufnehmen
            <input
              type="file"
              accept="image/*"
              capture="environment"
              hidden
              disabled={!!busy}
              onChange={(e) => {
                const f = e.target.files?.[0];
                e.target.value = "";
                if (f) onFile(f);
              }}
            />
          </label>
          <label className={`btn btn-secondary${busy ? " disabled" : ""}`}>
            Datei wählen (Foto oder PDF)
            <input
              type="file"
              accept="image/jpeg,image/png,image/webp,application/pdf"
              hidden
              disabled={!!busy}
              onChange={(e) => {
                const f = e.target.files?.[0];
                e.target.value = "";
                if (f) onFile(f);
              }}
            />
          </label>
          <span className="dn-muted">Tipp: Lieferschein flach hinlegen, gut ausleuchten, alle Zeilen im Bild.</span>
        </div>
      )}

      {busy && <p className="dn-busy">{busy}</p>}

      {rows && (
        <>
          <div className="dn-grid">
            <label className="form-group">
              <span>Lieferant</span>
              <input value={head.supplier} onChange={(e) => setHead({ ...head, supplier: e.target.value })} />
            </label>
            <label className="form-group">
              <span>Datum</span>
              <input type="date" value={head.note_date ?? ""} onChange={(e) => setHead({ ...head, note_date: e.target.value || null })} />
            </label>
            <label className="form-group">
              <span>Lieferschein-Nr.</span>
              <input value={head.note_number} onChange={(e) => setHead({ ...head, note_number: e.target.value })} />
            </label>
            <label className="form-group">
              <span>Kommission / Bauvorhaben</span>
              <input value={head.reference} onChange={(e) => setHead({ ...head, reference: e.target.value })} />
            </label>
          </div>
          {fileUrl && (
            <a className="dn-link" href={fileUrl} target="_blank" rel="noopener noreferrer">
              Lieferschein ansehen ↗
            </a>
          )}

          <div className="dn-target">
            <strong>Wohin geht das Material?</strong>
            <label>
              <input type="radio" name="dn-target" checked={target === "warehouse"} onChange={() => setTarget("warehouse")} /> Ins Lager
            </label>
            <label>
              <input type="radio" name="dn-target" checked={target === "order"} onChange={() => setTarget("order")} /> Direkt zu einem Auftrag (Projektleiter)
            </label>
            {target === "order" && (
              <select value={orderId} onChange={(e) => setOrderId(e.target.value)}>
                <option value="">– Auftrag wählen –</option>
                {orders.map((o) => (
                  <option key={o.id} value={o.id}>
                    {o.title}
                    {o.address_city ? ` · ${o.address_city}` : ""}
                  </option>
                ))}
              </select>
            )}
            {target === "order" && <small className="dn-muted">Der Lagerbestand bleibt unverändert; das Material erscheint in der Materialliste des Auftrags beim Projektleiter.</small>}
          </div>

          <div className="dn-lines">
            {rows.map((r, i) => {
              const m = materials.find((x) => String(x.id) === r.materialId);
              const unit = m ? m.unit : r.newUnit || "Stk";
              return (
                <div key={i} className={`dn-line${r.include ? "" : " off"}`}>
                  <label className="dn-line-top">
                    <input type="checkbox" checked={r.include} onChange={(e) => update(i, { include: e.target.checked })} />
                    <span>
                      <b>{r.source.description}</b>
                      <small>
                        {r.source.article_number ? `Art.-Nr. ${r.source.article_number} · ` : ""}
                        geliefert: {fmtNum(r.source.quantity)} {r.source.unit}
                        {r.source.unit_price_net != null ? ` · ${fmtNum(r.source.unit_price_net)} € netto je ${r.source.unit}` : ""}
                      </small>
                    </span>
                    <em className={`dn-conf ${r.source.confidence}`}>{r.source.confidence === "hoch" ? "sicher" : r.source.confidence === "mittel" ? "prüfen" : "unsicher"}</em>
                  </label>
                  {r.include && (
                    <div className="dn-line-form">
                      <label className="form-group dn-wide">
                        <span>Material</span>
                        <select
                          value={r.materialId}
                          onChange={(e) => {
                            const id = e.target.value;
                            update(i, { materialId: id, newName: id ? r.newName : r.newName || r.source.description, newUnit: id ? r.newUnit : r.newUnit || r.source.unit });
                          }}
                        >
                          <option value="">➕ Neu anlegen</option>
                          {materials.map((x) => (
                            <option key={x.id} value={x.id}>
                              {x.name} ({x.unit})
                            </option>
                          ))}
                        </select>
                      </label>
                      {!r.materialId && (
                        <>
                          <label className="form-group dn-wide">
                            <span>Name des neuen Materials</span>
                            <input value={r.newName} onChange={(e) => update(i, { newName: e.target.value })} maxLength={120} />
                          </label>
                          <label className="form-group">
                            <span>Einheit</span>
                            <input value={r.newUnit} onChange={(e) => update(i, { newUnit: e.target.value })} maxLength={20} />
                          </label>
                        </>
                      )}
                      <label className="form-group">
                        <span>Menge ({unit})</span>
                        <input inputMode="decimal" value={r.quantity} onChange={(e) => update(i, { quantity: e.target.value })} />
                      </label>
                      <label className="form-group">
                        <span>EK netto je {unit}</span>
                        <input inputMode="decimal" value={r.price} onChange={(e) => update(i, { price: e.target.value })} placeholder="optional" />
                      </label>
                    </div>
                  )}
                </div>
              );
            })}
          </div>

          <div className="dn-actions">
            <button type="button" className="btn btn-primary" onClick={book} disabled={!!busy || !included.length}>
              ✅ Wareneingang buchen ({included.length} Position{included.length === 1 ? "" : "en"})
            </button>
            <button type="button" className="btn btn-secondary" onClick={reset} disabled={!!busy}>
              Verwerfen
            </button>
            {usage && <small className="dn-muted">{usage}</small>}
          </div>
          <p className="dn-muted">Ein Lieferschein ist kein Buchhaltungsbeleg – die Rechnung des Händlers erfassen Sie wie gewohnt unter „Belege & Ausgaben“.</p>
        </>
      )}

      <details className="dn-history">
        <summary>Letzte Lieferscheine</summary>
        {notesError ? (
          <p className="dn-muted">{notesError}</p>
        ) : notes === null ? (
          <p className="dn-muted">Wird geladen …</p>
        ) : notes.length === 0 ? (
          <p className="dn-muted">Noch keine Lieferscheine eingelesen.</p>
        ) : (
          <ul>
            {notes.map((n) => (
              <li key={n.id}>
                <span>
                  <b>{n.supplier || "Lieferant unbekannt"}</b>
                  {n.note_number ? ` · Nr. ${n.note_number}` : ""} · {fmtDate(n.note_date || n.created_at)} · {n.lines.length} Position(en) →{" "}
                  {n.target === "order" ? `Auftrag „${orderTitle(n.order_id)}“` : "Lager"}
                </span>
                {n.file_path && (
                  <button
                    type="button"
                    className="dn-link"
                    onClick={async () => {
                      const url = await api.noteFileUrl(n.file_path!);
                      if (url) window.open(url, "_blank", "noopener");
                    }}
                  >
                    ansehen ↗
                  </button>
                )}
              </li>
            ))}
          </ul>
        )}
      </details>
    </div>
  );
}
