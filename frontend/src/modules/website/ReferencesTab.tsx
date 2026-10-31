import { useEffect, useState } from "react";
import type { OrderImage, OrderOption, WebsiteImage, WebsiteReference } from "./types";
import * as api from "./api";

type Props = {
  tenantId: number;
  userId: number;
  references: WebsiteReference[];
  onChanged: () => Promise<void> | void;
  onError: (msg: string) => void;
  onSuccess: (msg: string) => void;
};

const MAX_IMAGES = 8;

function formatDate(iso: string | null) {
  if (!iso) return "";
  return new Date(iso).toLocaleDateString("de-DE", { day: "2-digit", month: "2-digit", year: "numeric" });
}

function Editor({
  tenantId,
  userId,
  existing,
  onClose,
  onSaved,
  onError,
}: {
  tenantId: number;
  userId: number;
  existing: WebsiteReference | null;
  onClose: () => void;
  onSaved: (msg: string) => void;
  onError: (msg: string) => void;
}) {
  const [orders, setOrders] = useState<OrderOption[]>([]);
  const [orderId, setOrderId] = useState(existing?.order_id ?? "");
  const [orderImages, setOrderImages] = useState<OrderImage[]>([]);
  const [loadingImages, setLoadingImages] = useState(false);
  const [picked, setPicked] = useState<number[]>([]); // Bild-IDs aus dem Auftrag
  const [files, setFiles] = useState<File[]>([]);
  const [kept, setKept] = useState<WebsiteImage[]>(existing?.images ?? []);
  const [title, setTitle] = useState(existing?.title ?? "");
  const [city, setCity] = useState(existing?.city ?? "");
  const [text, setText] = useState(existing?.text ?? "");
  const [consent, setConsent] = useState(existing?.consent_confirmed ?? false);
  const [busy, setBusy] = useState("");

  useEffect(() => {
    api.loadOrders(tenantId).then(setOrders).catch((e) => onError((e as Error).message));
  }, [tenantId, onError]);

  useEffect(() => {
    if (!orderId) {
      setOrderImages([]);
      return;
    }
    let cancelled = false;
    setLoadingImages(true);
    api
      .loadOrderImages(tenantId, orderId)
      .then((imgs) => !cancelled && setOrderImages(imgs))
      .catch((e) => onError((e as Error).message))
      .finally(() => !cancelled && setLoadingImages(false));
    return () => {
      cancelled = true;
    };
  }, [tenantId, orderId, onError]);

  const chooseOrder = (id: string) => {
    setOrderId(id);
    setPicked([]);
    const o = orders.find((x) => x.id === id);
    if (o && !existing) {
      if (!title.trim()) setTitle(o.title);
      if (!city.trim() && o.address_city) setCity(o.address_city);
    }
  };

  const total = kept.length + picked.length + files.length;
  const togglePick = (id: number) =>
    setPicked((prev) => (prev.includes(id) ? prev.filter((u) => u !== id) : prev.length + kept.length + files.length >= MAX_IMAGES ? prev : [...prev, id]));

  const save = async (status: "entwurf" | "veroeffentlicht") => {
    if (!title.trim()) return onError("Bitte einen Titel eingeben.");
    if (total === 0) return onError("Bitte mindestens ein Bild auswählen.");
    if (status === "veroeffentlicht" && !consent) return onError("Zum Veröffentlichen muss die Zustimmung des Kunden bestätigt werden.");
    const uploaded: WebsiteImage[] = [];
    try {
      let n = 0;
      const all = picked.length + files.length;
      for (const id of picked) {
        const src = orderImages.find((im) => im.id === id);
        if (!src) continue;
        setBusy(`Bilder werden vorbereitet (${++n}/${all}) …`);
        uploaded.push(await api.copyOrderImage(tenantId, src.url));
      }
      for (const f of files) {
        setBusy(`Bilder werden vorbereitet (${++n}/${all}) …`);
        uploaded.push(await api.uploadImage(tenantId, await api.processImage(f), "ref"));
      }
      setBusy("Wird gespeichert …");
      const images = [...kept, ...uploaded].map((im) => ({ ...im, alt: im.alt || `${title.trim()}${city.trim() ? ` in ${city.trim()}` : ""}` }));
      await api.saveReference(
        tenantId,
        userId,
        { order_id: orderId || null, title: title.trim(), text: text.trim() || null, city: city.trim() || null, images, consent_confirmed: consent, status },
        existing
      );
      // Entfernte alte Bilder löschen
      const removed = (existing?.images ?? []).filter((im) => !kept.some((k) => k.path === im.path)).map((im) => im.path);
      await api.removeImages(removed);
      onSaved(status === "veroeffentlicht" ? "Referenz ist jetzt auf der Website zu sehen." : "Referenz als Entwurf gespeichert.");
    } catch (e) {
      await api.removeImages(uploaded.map((u) => u.path));
      onError((e as Error).message);
    } finally {
      setBusy("");
    }
  };

  return (
    <section className="ws-panel ws-editor">
      <h3>{existing ? "Referenz bearbeiten" : "Neue Referenz"}</h3>

      <label className="tk-field">
        <span>Aus Auftrag übernehmen (optional)</span>
        <select value={orderId} onChange={(e) => chooseOrder(e.target.value)}>
          <option value="">– ohne Auftrag, eigene Fotos –</option>
          {orders.map((o) => (
            <option key={o.id} value={o.id}>
              {o.title}
              {o.address_city ? ` · ${o.address_city}` : ""} · {o.status}
            </option>
          ))}
        </select>
      </label>

      {orderId && (
        <div className="ws-pick">
          <span className="ws-label">Baustellenbilder des Auftrags – zum Auswählen antippen</span>
          {loadingImages ? (
            <p className="tk-muted">Bilder werden geladen …</p>
          ) : orderImages.length === 0 ? (
            <p className="tk-muted">Zu diesem Auftrag gibt es noch keine Fotos.</p>
          ) : (
            <div className="ws-grid">
              {orderImages.map((im) => {
                const sel = picked.includes(im.id);
                return (
                  <button key={im.id} type="button" className={`ws-tile${sel ? " selected" : ""}`} onClick={() => togglePick(im.id)} aria-pressed={sel}>
                    <img src={im.url} alt="" loading="lazy" />
                    {sel && <span className="ws-tile-badge">{picked.indexOf(im.id) + kept.length + 1}</span>}
                  </button>
                );
              })}
            </div>
          )}
        </div>
      )}

      {kept.length > 0 && (
        <div className="ws-pick">
          <span className="ws-label">Bilder dieser Referenz</span>
          <div className="ws-grid">
            {kept.map((im) => (
              <div key={im.path} className="ws-tile selected">
                <img src={im.url} alt={im.alt ?? ""} />
                <button type="button" className="ws-tile-remove" onClick={() => setKept((p) => p.filter((k) => k.path !== im.path))} aria-label="Bild entfernen">
                  ×
                </button>
              </div>
            ))}
          </div>
        </div>
      )}

      <div className="ws-row">
        <label className="btn btn-secondary btn-small">
          + Eigene Fotos hinzufügen
          <input
            type="file"
            accept="image/jpeg,image/png,image/webp"
            multiple
            hidden
            onChange={(e) => {
              const list = Array.from(e.target.files ?? []);
              setFiles((prev) => [...prev, ...list].slice(0, Math.max(0, MAX_IMAGES - kept.length - picked.length)));
              e.target.value = "";
            }}
          />
        </label>
        {files.length > 0 && (
          <span className="tk-muted">
            {files.length} Foto(s) ausgewählt ·{" "}
            <button type="button" className="ws-link" onClick={() => setFiles([])}>
              zurücksetzen
            </button>
          </span>
        )}
        <span className="tk-muted">
          {total}/{MAX_IMAGES} Bilder · das erste Bild ist das Hauptbild
        </span>
      </div>

      <div className="tk-form">
        <label className="tk-field">
          <span>Titel *</span>
          <input value={title} onChange={(e) => setTitle(e.target.value)} maxLength={90} placeholder="z. B. Wohnzimmer in warmem Sandton" />
        </label>
        <label className="tk-field">
          <span>Ort (nur der Ort, keine Straße!)</span>
          <input value={city} onChange={(e) => setCity(e.target.value)} maxLength={60} placeholder="z. B. Wittlich" />
        </label>
        <label className="tk-field tk-span-2">
          <span>Kurzbeschreibung</span>
          <textarea rows={3} value={text} onChange={(e) => setText(e.target.value)} maxLength={400} placeholder="Was wurde gemacht? z. B. Wände gespachtelt, in zwei Farbtönen gestrichen, Türen lackiert." />
        </label>
      </div>

      <div className="tk-notice tk-notice-info ws-privacy">
        <span>
          Vor dem Veröffentlichen bitte prüfen: Sind auf den Fotos <strong>Personen, Familienfotos, Namen, Hausnummern oder Autokennzeichen</strong>{" "}
          zu sehen? Dann das Foto weglassen. Standortdaten aus den Fotos werden automatisch entfernt.
        </span>
      </div>
      <label className="ws-check ws-consent">
        <input type="checkbox" checked={consent} onChange={(e) => setConsent(e.target.checked)} />
        <span>
          Der Kunde hat zugestimmt, dass Fotos seines Projekts (ohne Adresse) auf unserer Website gezeigt werden. <em>Pflicht zum Veröffentlichen.</em>
        </span>
      </label>

      <div className="ws-row">
        <button type="button" className="btn btn-primary" disabled={!!busy || !consent} onClick={() => save("veroeffentlicht")}>
          {busy || "Auf der Website veröffentlichen"}
        </button>
        <button type="button" className="btn btn-secondary" disabled={!!busy} onClick={() => save("entwurf")}>
          Als Entwurf speichern
        </button>
        <button type="button" className="btn btn-secondary" disabled={!!busy} onClick={onClose}>
          Abbrechen
        </button>
      </div>
    </section>
  );
}

export default function ReferencesTab({ tenantId, userId, references, onChanged, onError, onSuccess }: Props) {
  const [editing, setEditing] = useState<WebsiteReference | "new" | null>(null);
  const [busyId, setBusyId] = useState<number | null>(null);

  const setStatus = async (ref: WebsiteReference, status: "entwurf" | "veroeffentlicht") => {
    if (status === "veroeffentlicht" && !ref.consent_confirmed) {
      setEditing(ref);
      onError("Bitte zuerst die Zustimmung des Kunden bestätigen.");
      return;
    }
    setBusyId(ref.id);
    try {
      await api.saveReference(
        tenantId,
        userId,
        { order_id: ref.order_id, title: ref.title, text: ref.text, city: ref.city, images: ref.images, consent_confirmed: ref.consent_confirmed, status },
        ref
      );
      await onChanged();
    } catch (e) {
      onError((e as Error).message);
    } finally {
      setBusyId(null);
    }
  };

  const remove = async (ref: WebsiteReference) => {
    if (!window.confirm(`Referenz „${ref.title}“ mit allen Bildern löschen?`)) return;
    setBusyId(ref.id);
    try {
      await api.deleteReference(tenantId, ref);
      await onChanged();
      onSuccess("Referenz gelöscht.");
    } catch (e) {
      onError((e as Error).message);
    } finally {
      setBusyId(null);
    }
  };

  if (editing) {
    return (
      <Editor
        tenantId={tenantId}
        userId={userId}
        existing={editing === "new" ? null : editing}
        onClose={() => setEditing(null)}
        onError={onError}
        onSaved={async (msg) => {
          setEditing(null);
          await onChanged();
          onSuccess(msg);
        }}
      />
    );
  }

  return (
    <div className="ws-stack">
      <div className="ws-row ws-row-between">
        <p className="tk-muted ws-intro">
          Zeigen Sie fertige Arbeiten mit Fotos von der Baustelle. Neue Referenzen machen die Website lebendig und helfen bei Google.
        </p>
        <button type="button" className="btn btn-primary" onClick={() => setEditing("new")}>
          + Neue Referenz
        </button>
      </div>
      {references.length === 0 ? (
        <p className="tk-empty">Noch keine Referenzen. Tipp: Nach jedem abgeschlossenen Auftrag 3–5 schöne Fotos auswählen.</p>
      ) : (
        <div className="ws-refs">
          {references.map((r) => (
            <article key={r.id} className="ws-ref">
              {r.images?.[0] ? <img src={r.images[0].url} alt={r.images[0].alt ?? r.title} loading="lazy" /> : <div className="ws-ref-noimg">kein Bild</div>}
              <div className="ws-ref-body">
                <span className={`tk-badge ${r.status === "veroeffentlicht" ? "tk-status-bestaetigt" : "tk-status-geplant"}`}>
                  {r.status === "veroeffentlicht" ? `online seit ${formatDate(r.published_at)}` : "Entwurf"}
                </span>
                <strong>{r.title}</strong>
                <span className="tk-muted">
                  {r.city || "ohne Ort"} · {r.images?.length ?? 0} Bild(er)
                </span>
                <div className="ws-ref-actions">
                  <button type="button" className="btn btn-secondary btn-small" onClick={() => setEditing(r)} disabled={busyId === r.id}>
                    Bearbeiten
                  </button>
                  {r.status === "veroeffentlicht" ? (
                    <button type="button" className="btn btn-secondary btn-small" onClick={() => setStatus(r, "entwurf")} disabled={busyId === r.id}>
                      Ausblenden
                    </button>
                  ) : (
                    <button type="button" className="btn btn-primary btn-small" onClick={() => setStatus(r, "veroeffentlicht")} disabled={busyId === r.id}>
                      Veröffentlichen
                    </button>
                  )}
                  <button type="button" className="ws-link ws-danger" onClick={() => remove(r)} disabled={busyId === r.id}>
                    Löschen
                  </button>
                </div>
              </div>
            </article>
          ))}
        </div>
      )}
    </div>
  );
}
