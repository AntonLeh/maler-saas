// Bildbibliothek: eigene Bilder (z. B. Nano Banana) hochladen, von der KI beschreiben lassen, für den Design-Agenten
import { useEffect, useRef, useState } from "react";
import { showConfirm } from "../../lib/dialogs";
import * as api from "./api";
import type { LibImage } from "./logic";

type Props = { onClose: () => void };

function Thumb({ path }: { path: string }) {
  const [url, setUrl] = useState("");
  useEffect(() => {
    let cancel = false;
    void api
      .imageUrl(path)
      .then((u) => !cancel && setUrl(u))
      .catch(() => undefined);
    return () => {
      cancel = true;
    };
  }, [path]);
  return url ? <img src={url} alt="" loading="lazy" /> : <span className="ow2-lib-ph">…</span>;
}

export default function ImageLibrary({ onClose }: Props) {
  const [images, setImages] = useState<LibImage[] | null | undefined>(undefined);
  const [busy, setBusy] = useState("");
  const [progress, setProgress] = useState<{ label: string; done: number; total: number } | null>(null);
  const [msg, setMsg] = useState<{ ok: boolean; text: string } | null>(null);
  const [edit, setEdit] = useState<LibImage | null>(null);
  const [filter, setFilter] = useState("");
  const stopRef = useRef(false);

  const reload = async () => setImages(await api.loadImages());
  useEffect(() => {
    let cancel = false;
    void api.loadImages().then((r) => !cancel && setImages(r));
    return () => {
      cancel = true;
      stopRef.current = true;
    };
  }, []);

  const describe = async (ids: number[] = []) => {
    stopRef.current = false;
    setBusy("tag");
    const total = ids.length || (images ?? []).filter((i) => !i.description).length;
    let done = 0;
    let idle = 0;
    setProgress({ label: "KI beschreibt die Bilder", done: 0, total });
    try {
      while (!stopRef.current) {
        const r = await api.tagImages(ids);
        done += r.done;
        setProgress({ label: "KI beschreibt die Bilder", done: Math.min(done, total), total });
        await reload();
        if (r.remaining <= 0 || ids.length) break;
        if (r.done === 0 && ++idle >= 2) {
          setMsg({ ok: false, text: "Einige Bilder konnten nicht beschrieben werden. Bitte später erneut versuchen oder die Beschreibung selbst eintragen." });
          break;
        }
      }
    } catch (e) {
      setMsg({ ok: false, text: (e as Error).message });
    } finally {
      setBusy("");
      setProgress(null);
    }
  };

  const upload = async (files: FileList | null) => {
    if (!files?.length) return;
    setMsg(null);
    setBusy("upload");
    const list = Array.from(files).filter((f) => f.type.startsWith("image/")).slice(0, 60);
    const ids: number[] = [];
    try {
      for (let i = 0; i < list.length; i++) {
        setProgress({ label: "Bilder werden hochgeladen", done: i, total: list.length });
        const img = await api.uploadLibraryImage(list[i]);
        ids.push(img.id);
      }
      await reload();
    } catch (e) {
      setMsg({ ok: false, text: (e as Error).message });
      setBusy("");
      setProgress(null);
      return;
    }
    setBusy("");
    setProgress(null);
    if (ids.length) await describe();
  };

  const saveEdit = async () => {
    if (!edit) return;
    try {
      await api.updateImage(edit.id, { description: edit.description, tags: edit.tags, realistic: edit.realistic, ai_generated: edit.ai_generated });
      setEdit(null);
      await reload();
    } catch (e) {
      setMsg({ ok: false, text: (e as Error).message });
    }
  };

  const remove = async (img: LibImage) => {
    if (!(await showConfirm("Dieses Bild aus der Bibliothek löschen? Beiträge, die es schon verwenden, verlieren das Bild.", { danger: true, confirmLabel: "Löschen" }))) return;
    try {
      await api.deleteImage(img);
      setEdit(null);
      await reload();
    } catch (e) {
      setMsg({ ok: false, text: (e as Error).message });
    }
  };

  const f = filter.trim().toLowerCase();
  const visible = (images ?? []).filter((i) => !f || `${i.description ?? ""} ${i.tags.join(" ")}`.toLowerCase().includes(f));
  const untagged = (images ?? []).filter((i) => !i.description).length;

  return (
    <div className="ow2-card ow2-lib">
      <div className="ow2-agent-head">
        <div>
          <h3>🖼 Bildbibliothek</h3>
          <p className="ow2-small">
            Laden Sie Ihre Bilder hier einmal hoch. Die KI beschreibt jedes Bild, und der Agent wählt für jeden Beitrag automatisch das passende aus (Vorlage „Foto mit Text“).
          </p>
        </div>
        <button type="button" className="btn btn-secondary" onClick={onClose} disabled={!!busy}>
          Schließen
        </button>
      </div>

      {images === null ? (
        <p className="ow2-msg err">Für die Bildbibliothek fehlt noch das Datenbank-Update (SQL „Owner-Bilder“).</p>
      ) : images === undefined ? (
        <p className="ow2-empty">Lädt …</p>
      ) : (
        <>
          <div className="ow2-lib-bar">
            <label className={`btn btn-primary ow2-upload-btn${busy ? " disabled" : ""}`}>
              <input type="file" accept="image/*" multiple disabled={!!busy} onChange={(e) => void upload(e.target.files)} />
              📷 Bilder hochladen
            </label>
            {untagged > 0 && !busy && (
              <button type="button" className="ow2-pill" onClick={() => describe()}>
                ✨ {untagged} {untagged === 1 ? "Bild" : "Bilder"} beschreiben lassen
              </button>
            )}
            <input className="ow2-lib-search" value={filter} onChange={(e) => setFilter(e.target.value)} placeholder="Suchen, z. B. winter, fassade, team" />
            <span className="ow2-small">{images.length} Bilder</span>
          </div>

          {progress && (
            <div className="ow2-progress">
              <span>
                {progress.label}: {progress.done} von {progress.total}
              </span>
              <i style={{ width: `${(progress.done / Math.max(1, progress.total)) * 100}%` }} />
              {busy === "tag" && (
                <button type="button" className="ow2-link" onClick={() => (stopRef.current = true)}>
                  Anhalten
                </button>
              )}
            </div>
          )}
          {msg && <p className={`ow2-msg ${msg.ok ? "ok" : "err"}`}>{msg.text}</p>}

          {images.length === 0 ? (
            <p className="ow2-empty">Noch keine Bilder. Tippen Sie auf „📷 Bilder hochladen“ und wählen Sie mehrere Bilder auf einmal aus (bis 60 je Durchgang).</p>
          ) : (
            <div className="ow2-lib-grid">
              {visible.map((img) => (
                <button key={img.id} type="button" className={`ow2-lib-item${edit?.id === img.id ? " on" : ""}`} onClick={() => setEdit({ ...img })}>
                  <Thumb path={img.path} />
                  <span className="ow2-lib-desc">{img.description || <em>noch ohne Beschreibung</em>}</span>
                  <span className="ow2-lib-meta">
                    {img.realistic && <b title="Beim Posten auf Facebook/Instagram das KI-Label einschalten">KI-Label</b>}
                    {img.last_used_at && <i>benutzt {new Date(img.last_used_at).toLocaleDateString("de-DE")}</i>}
                  </span>
                </button>
              ))}
            </div>
          )}

          {edit && (
            <div className="ow2-lib-edit">
              <div className="ow2-lib-edit-img">
                <Thumb path={edit.path} />
              </div>
              <div className="ow2-lib-edit-form">
                <div className="ow2-field">
                  <label>Beschreibung</label>
                  <input value={edit.description ?? ""} maxLength={160} onChange={(e) => setEdit({ ...edit, description: e.target.value })} />
                </div>
                <div className="ow2-field">
                  <label>Stichworte (mit Komma getrennt)</label>
                  <input
                    value={edit.tags.join(", ")}
                    onChange={(e) =>
                      setEdit({
                        ...edit,
                        tags: e.target.value
                          .split(",")
                          .map((t) => t.trim().toLowerCase())
                          .filter(Boolean)
                          .slice(0, 12),
                      })
                    }
                  />
                </div>
                <label className="ow2-check">
                  <input type="checkbox" checked={edit.realistic} onChange={(e) => setEdit({ ...edit, realistic: e.target.checked })} /> Wirkt wie ein echtes Foto (Menschen/Szenen) – beim Posten „KI-Label“
                  einschalten
                </label>
                <label className="ow2-check">
                  <input type="checkbox" checked={edit.ai_generated} onChange={(e) => setEdit({ ...edit, ai_generated: e.target.checked })} /> Mit KI erstellt
                </label>
                <div className="ow2-actions left">
                  <button type="button" className="btn btn-primary" onClick={saveEdit}>
                    Speichern
                  </button>
                  <button type="button" className="btn btn-secondary" onClick={() => describe([edit.id])} disabled={!!busy}>
                    ✨ Neu beschreiben
                  </button>
                  <button type="button" className="btn btn-secondary" onClick={() => remove(edit)}>
                    Löschen
                  </button>
                  <button type="button" className="ow2-link" onClick={() => setEdit(null)}>
                    Schließen
                  </button>
                </div>
              </div>
            </div>
          )}
        </>
      )}
    </div>
  );
}
