// MalerTreff-Redaktion (nur Owner): Starter-Beiträge vom MalerSaaS-Team vorschlagen lassen, prüfen, veröffentlichen
import { useEffect, useState } from "react";
import { showConfirm } from "../../lib/dialogs";
import * as ow from "../owner-werbung/api";
import type { CommunityDraft } from "../owner-werbung/api";
import type { LibImage } from "../owner-werbung/logic";
import * as api from "./api";
import { TOPICS } from "./logic";
import type { Member } from "./logic";

type Draft = CommunityDraft & { key: string; busy?: string; done?: string; error?: string };
const STORE = "malertreff-redaktion-entwuerfe";
const AI_LABEL = "Symbolbild (KI-generiert)";

function loadStored(): Draft[] {
  try {
    const v = JSON.parse(localStorage.getItem(STORE) || "[]");
    return Array.isArray(v) ? v.filter((d) => d && typeof d.body === "string") : [];
  } catch {
    return [];
  }
}
function store(list: Draft[]) {
  try {
    localStorage.setItem(STORE, JSON.stringify(list.filter((d) => !d.done).map(({ busy: _b, error: _e, ...d }) => (void _b, void _e, d))));
  } catch {
    /* Speicher nicht verfügbar – Entwürfe gelten dann nur bis zum Neuladen */
  }
}

export function RedaktionPanel({ me }: { me: Member }) {
  const [drafts, setDrafts] = useState<Draft[]>(loadStored);
  const [count, setCount] = useState(5);
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState<string | null>(null);

  const update = (key: string, patch: Partial<Draft>) =>
    setDrafts((list) => {
      const next = list.map((d) => (d.key === key ? { ...d, ...patch } : d));
      store(next);
      return next;
    });

  const generate = async () => {
    setBusy(true);
    setErr(null);
    try {
      const mine = await api.feed({ author: me.id }).catch(() => []);
      const existing = [...mine.map((p) => p.body.slice(0, 120)), ...drafts.map((d) => d.body.slice(0, 120))];
      const items = await ow.communityDrafts(count, existing);
      setDrafts((list) => {
        const next = [...items.map((d, i) => ({ ...d, key: `${Date.now()}-${i}` })), ...list];
        store(next);
        return next;
      });
    } catch (e) {
      setErr((e as Error).message);
    } finally {
      setBusy(false);
    }
  };

  const publish = async (d: Draft) => {
    if (d.body.trim().length < 10) return update(d.key, { error: "Bitte einen Text schreiben." });
    update(d.key, { busy: "publish", error: undefined });
    try {
      let paths: string[] = [];
      if (d.image_path) {
        const blob = await ow.downloadLibraryImage(d.image_path);
        paths = await api.uploadImages([new File([blob], "bild.jpg", { type: blob.type || "image/jpeg" })]);
      }
      const label = paths.length && d.image_ai !== false && !d.body.includes(AI_LABEL) ? `\n\n🖼️ ${AI_LABEL}` : "";
      const id = await api.createPost(d.kind, d.topic, `${d.body.trim()}${label}`, paths, true);
      const status = await api.aiCheck("post", id).catch(() => "unveraendert");
      update(d.key, {
        busy: undefined,
        done: status === "pruefung" ? "Veröffentlicht – die KI-Vorprüfung hat ihn zur Moderation gelegt. Bitte dort freigeben." : "Veröffentlicht im Feed.",
      });
    } catch (e) {
      update(d.key, { busy: undefined, error: (e as Error).message });
    }
  };

  const toArticle = async (d: Draft) => {
    if (!d.keyword) return update(d.key, { error: "Kein Suchbegriff vorhanden." });
    update(d.key, { busy: "article", error: undefined });
    try {
      const a = await ow.articleDraftFromKeyword(d.keyword, "Aus einem MalerTreff-Beitrag des MalerSaaS-Teams");
      update(d.key, { busy: undefined, error: undefined, keyword: `${d.keyword} ✓`, image_hint: `Ratgeber-Entwurf „${a.title}“ liegt unter Owner → Werbung → Ratgeber.` });
    } catch (e) {
      update(d.key, { busy: undefined, error: (e as Error).message });
    }
  };

  const discard = async (d: Draft) => {
    if (!d.done && !(await showConfirm("Diesen Vorschlag verwerfen?", { confirmLabel: "Verwerfen" }))) return;
    setDrafts((list) => {
      const next = list.filter((x) => x.key !== d.key);
      store(next);
      return next;
    });
  };

  return (
    <div className="cm-redaktion">
      <p className="cm-small">
        Die KI schlägt Beiträge vor, die Sie als <b>MalerSaaS-Team</b> veröffentlichen: etwa 4 von 5 sind reine Fachtipps oder Diskussionsfragen, höchstens jeder fünfte ist
        ein klar gekennzeichneter MalerSaaS-Tipp. Bitte jeden Vorschlag lesen und bei Bedarf anpassen – veröffentlicht wird erst auf Ihren Klick.
      </p>
      <div className="cm-actions left">
        <select value={count} onChange={(e) => setCount(Number(e.target.value))} aria-label="Anzahl">
          <option value={5}>5 Vorschläge (4 Fachtipps, 1 MalerSaaS-Tipp)</option>
          <option value={10}>10 Vorschläge (8 Fachtipps, 2 MalerSaaS-Tipps)</option>
        </select>
        <button type="button" className="btn btn-primary" onClick={generate} disabled={busy}>
          {busy ? "Wird erstellt … (ca. 30 Sek.)" : "✨ Vorschläge erstellen"}
        </button>
      </div>
      {err && <p className="cm-msg err">{err}</p>}
      {drafts.length === 0 && !busy && <div className="cm-empty">Noch keine Vorschläge. Klicken Sie auf „Vorschläge erstellen“.</div>}
      {drafts.map((d) => (
        <div key={d.key} className={`cm-card cm-draft${d.done ? " done" : ""}`}>
          <div className="cm-tags">
            <span className={`cm-kind ${d.product ? "k-anzeige" : d.kind === "frage" ? "k-frage" : "k-tipp"}`}>
              {d.product ? "💡 MalerSaaS-Tipp" : d.kind === "frage" ? "❓ Diskussionsfrage" : "🛠️ Fachtipp"}
            </span>
            <select value={d.topic} onChange={(e) => update(d.key, { topic: e.target.value })} disabled={!!d.done} aria-label="Thema">
              {TOPICS.map((t) => (
                <option key={t.id} value={t.id}>
                  {t.label}
                </option>
              ))}
            </select>
          </div>
          {d.done ? (
            <p className="cm-msg ok">{d.done}</p>
          ) : (
            <textarea rows={8} value={d.body} maxLength={5000} onChange={(e) => update(d.key, { body: e.target.value })} aria-label="Text" />
          )}
          {!d.done && <DraftImage path={d.image_path} ai={d.image_ai !== false} disabled={!!d.busy} onChange={(patch) => update(d.key, patch)} />}
          {d.keyword && <p className="cm-small">Suchbegriff für Google: „{d.keyword}“{d.image_hint.startsWith("Ratgeber-Entwurf") ? ` – ${d.image_hint}` : ""}</p>}
          {d.error && <p className="cm-msg err">{d.error}</p>}
          <div className="cm-actions left">
            {!d.done && (
              <button type="button" className="btn btn-primary" disabled={!!d.busy} onClick={() => publish(d)}>
                {d.busy === "publish" ? "Wird veröffentlicht …" : "Im MalerTreff veröffentlichen"}
              </button>
            )}
            {!d.keyword.endsWith("✓") && (
              <button type="button" className="btn btn-secondary" disabled={!!d.busy} onClick={() => toArticle(d)}>
                {d.busy === "article" ? "Artikel wird geschrieben … (ca. 1 Min.)" : "📰 Als Ratgeber-Entwurf"}
              </button>
            )}
            <button type="button" className="btn btn-secondary" disabled={!!d.busy} onClick={() => discard(d)}>
              {d.done ? "Ausblenden" : "Verwerfen"}
            </button>
          </div>
        </div>
      ))}
    </div>
  );
}

type ImgPatch = Partial<Pick<Draft, "image_path" | "image_ai" | "error">>;

/** Bild eines Entwurfs: ansehen, KI-Kennzeichnung an/aus, aus der Bibliothek wählen, eigenes Foto hochladen, entfernen */
function DraftImage({ path, ai, disabled, onChange }: { path: string | null; ai: boolean; disabled: boolean; onChange: (p: ImgPatch) => void }) {
  const [url, setUrl] = useState<string | null>(null);
  const [picker, setPicker] = useState(false);
  const [uploading, setUploading] = useState(false);
  useEffect(() => {
    let cancel = false;
    setUrl(null);
    if (path)
      void ow
        .imageUrl(path)
        .then((u) => !cancel && setUrl(u))
        .catch(() => undefined);
    return () => {
      cancel = true;
    };
  }, [path]);

  const upload = async (file: File | undefined) => {
    if (!file) return;
    setUploading(true);
    onChange({ error: undefined });
    try {
      const img = await ow.uploadLibraryImage(file);
      await ow.updateImage(img.id, { ai_generated: false }).catch(() => undefined);
      void ow.tagImages([img.id]).catch(() => undefined); // Beschreibung für spätere Bildauswahl
      onChange({ image_path: img.path, image_ai: false });
    } catch (e) {
      onChange({ error: (e as Error).message });
    } finally {
      setUploading(false);
    }
  };

  const buttons = (
    <div className="cm-draft-img-btns">
      <button type="button" className="cm-link" disabled={disabled || uploading} onClick={() => setPicker(true)}>
        🖼️ {path ? "Anderes Bild aus Bibliothek" : "Bild aus Bibliothek"}
      </button>
      <label className={`cm-link${disabled || uploading ? " off" : ""}`}>
        📷 {uploading ? "Wird hochgeladen …" : path ? "Eigenes Foto stattdessen" : "Eigenes Foto hochladen"}
        <input
          type="file"
          accept="image/*"
          hidden
          disabled={disabled || uploading}
          onChange={(e) => {
            void upload(e.target.files?.[0]);
            e.target.value = "";
          }}
        />
      </label>
      {path && (
        <button type="button" className="cm-link danger" disabled={disabled || uploading} onClick={() => onChange({ image_path: null })}>
          ✕ Bild entfernen
        </button>
      )}
    </div>
  );

  return (
    <>
      {path ? (
        <div className="cm-draft-img">
          {url ? <img src={url} alt="" /> : <span className="cm-photo-wait" />}
          <div>
            <label className="cm-check small">
              <input type="checkbox" checked={ai} disabled={disabled} onChange={(e) => onChange({ image_ai: e.target.checked })} />
              Als „🖼️ {AI_LABEL}“ kennzeichnen
            </label>
            {!ai && <p className="cm-small">Nur abhaken, wenn es ein echtes Foto ist – KI-Bilder müssen gekennzeichnet werden.</p>}
            {buttons}
          </div>
        </div>
      ) : (
        <div className="cm-draft-noimg">
          <span className="cm-small">Ohne Bild.</span>
          {buttons}
        </div>
      )}
      {picker && (
        <LibraryPicker
          current={path}
          onClose={() => setPicker(false)}
          onPick={(img) => {
            setPicker(false);
            onChange({ image_path: img.path, image_ai: img.ai_generated !== false, error: undefined });
          }}
        />
      )}
    </>
  );
}

function LibraryPicker({ current, onPick, onClose }: { current: string | null; onPick: (img: LibImage) => void; onClose: () => void }) {
  const [list, setList] = useState<LibImage[] | null | undefined>(undefined);
  const [q, setQ] = useState("");
  useEffect(() => {
    void ow.loadImages().then(setList);
  }, []);
  const words = q.toLowerCase().split(/\s+/).filter(Boolean);
  const shown = (list ?? []).filter((img) => {
    const hay = `${img.description ?? ""} ${img.tags.join(" ")}`.toLowerCase();
    return words.every((w) => hay.includes(w));
  });
  return (
    <div className="cm-overlay" role="dialog" aria-modal="true" aria-label="Bild aus Bibliothek wählen" onClick={onClose}>
      <div className="cm-dialog cm-picker" onClick={(e) => e.stopPropagation()}>
        <h3>Bild aus Ihrer Bibliothek</h3>
        <input type="search" placeholder="Suchen, z. B. Fassade, Winter, Büro …" value={q} onChange={(e) => setQ(e.target.value)} />
        {list === undefined && <p className="cm-muted">Lädt …</p>}
        {list === null && <p className="cm-msg err">Die Bildbibliothek konnte nicht geladen werden.</p>}
        {list && shown.length === 0 && <p className="cm-muted">Keine passenden Bilder. Neue Bilder laden Sie unter Owner → Werbung → Bilder hoch.</p>}
        <div className="cm-picker-grid">
          {shown.map((img) => (
            <PickerThumb key={img.id} img={img} active={img.path === current} onPick={() => onPick(img)} />
          ))}
        </div>
        <div className="cm-actions">
          <button type="button" className="btn btn-secondary" onClick={onClose}>
            Abbrechen
          </button>
        </div>
      </div>
    </div>
  );
}

function PickerThumb({ img, active, onPick }: { img: LibImage; active: boolean; onPick: () => void }) {
  const [url, setUrl] = useState<string | null>(null);
  useEffect(() => {
    let cancel = false;
    void ow
      .imageUrl(img.path)
      .then((u) => !cancel && setUrl(u))
      .catch(() => undefined);
    return () => {
      cancel = true;
    };
  }, [img.path]);
  return (
    <button type="button" className={`cm-picker-item${active ? " on" : ""}`} onClick={onPick} title={img.description ?? ""}>
      {url ? <img src={url} alt={img.description ?? ""} loading="lazy" /> : <span className="cm-photo-wait" />}
      <span className={`cm-picker-tag ${img.ai_generated !== false ? "ki" : "foto"}`}>{img.ai_generated !== false ? "KI" : "Foto"}</span>
    </button>
  );
}
