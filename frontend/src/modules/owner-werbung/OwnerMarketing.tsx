// Owner-Werbung: Social-Media-Beiträge für MalerSaaS (Facebook, Instagram, LinkedIn, Kurzvideo, YouTube)
import { useCallback, useEffect, useMemo, useState } from "react";
import { showConfirm } from "../../lib/dialogs";
import * as api from "./api";
import * as L from "./logic";
import type { ChannelKey, GraphicData, Goal, Post, Status, Texts } from "./logic";
import GraphicEditor from "./GraphicEditor";
import { resolveImage } from "./api";
import { renderToBlob } from "./graphic";
import "./ow2.css";

const today = () => new Date().toISOString().slice(0, 10);
const dateDe = (d: string) => new Date(`${d.slice(0, 10)}T12:00:00`).toLocaleDateString("de-DE", { weekday: "short", day: "2-digit", month: "2-digit" });

function saveBlob(blob: Blob, name: string) {
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = name;
  a.click();
  setTimeout(() => URL.revokeObjectURL(url), 3000);
}

async function copy(text: string) {
  try {
    await navigator.clipboard.writeText(text);
    return true;
  } catch {
    const ta = document.createElement("textarea");
    ta.value = text;
    ta.style.position = "fixed";
    ta.style.opacity = "0";
    document.body.appendChild(ta);
    ta.select();
    const ok = document.execCommand("copy");
    ta.remove();
    return ok;
  }
}

// =====================================================================
// Neuer Beitrag
// =====================================================================
function Creator({ onCreated, onCancel }: { onCreated: (p: Post) => void; onCancel: () => void }) {
  const [topic, setTopic] = useState(L.TOPICS[0]);
  const [custom, setCustom] = useState("");
  const [goal, setGoal] = useState<Goal>("funktion");
  const [keywords, setKeywords] = useState("");
  const [youtube, setYoutube] = useState(false);
  const [uploads, setUploads] = useState<string[]>([]);
  const [busy, setBusy] = useState("");
  const [error, setError] = useState("");

  const addFiles = async (files: FileList | null) => {
    if (!files?.length) return;
    setBusy("upload");
    setError("");
    try {
      const list = [...uploads];
      for (const f of Array.from(files).slice(0, 4 - uploads.length)) list.push(await api.uploadImage(f));
      setUploads(list);
    } catch (e) {
      setError((e as Error).message);
    } finally {
      setBusy("");
    }
  };

  const create = async () => {
    const t = topic === "__frei" ? custom.trim() : topic;
    if (!t) return setError("Bitte ein Thema wählen oder eintippen.");
    setBusy("ai");
    setError("");
    try {
      const r = await api.generate({ topic: t, goal, keywords: keywords.trim(), youtube, image_paths: uploads });
      const post = await api.savePost(null, {
        topic: t,
        goal,
        keywords: keywords.trim() || null,
        title: r.title || t,
        texts: r.texts,
        images: uploads,
        graphic: api.defaultGraphic(goal, r.graphic, uploads[0] ?? null),
        utm_campaign: L.campaignSlug(r.title || t),
        status: "entwurf",
      });
      onCreated(post);
    } catch (e) {
      setError((e as Error).message);
      setBusy("");
    }
  };

  return (
    <div className="ow2-card ow2-creator">
      <h3>Neuer Beitrag</h3>
      <div className="ow2-form">
        <div className="ow2-field">
          <label>Thema</label>
          <select value={topic} onChange={(e) => setTopic(e.target.value)}>
            {L.TOPICS.map((t) => (
              <option key={t} value={t}>
                {t}
              </option>
            ))}
            <option value="__frei">Eigenes Thema …</option>
          </select>
          {topic === "__frei" && <input value={custom} onChange={(e) => setCustom(e.target.value)} placeholder="z. B. 5 Tipps für schnellere Angebote" autoFocus />}
        </div>
        <div className="ow2-field">
          <label>Ziel</label>
          <div className="ow2-seg">
            {(Object.keys(L.GOAL_LABELS) as Goal[]).map((g) => (
              <button key={g} type="button" className={goal === g ? "on" : ""} onClick={() => setGoal(g)}>
                {L.GOAL_LABELS[g]}
              </button>
            ))}
          </div>
        </div>
        <div className="ow2-field full">
          <label>Stichworte (optional)</label>
          <textarea
            value={keywords}
            onChange={(e) => setKeywords(e.target.value)}
            rows={3}
            placeholder="z. B. Herbst, Innenarbeiten; Zielgruppe kleine Betriebe; neu: Anzahl Anstriche je Raum"
          />
        </div>
        <div className="ow2-field">
          <label>Eigene Bilder / Screenshots (optional, bis 4)</label>
          <label className="ow2-upload">
            <input type="file" accept="image/*" multiple onChange={(e) => addFiles(e.target.files)} disabled={!!busy || uploads.length >= 4} />
            {busy === "upload" ? "Lädt hoch …" : uploads.length ? `${uploads.length} Bild(er) – weitere hinzufügen` : "📷 Bilder auswählen"}
          </label>
          <small>Die KI sieht sich die Bilder an. Für die Grafik gibt es außerdem fertige Screenshots der App.</small>
        </div>
        <div className="ow2-field">
          <label>Zusätzlich</label>
          <label className="ow2-check">
            <input type="checkbox" checked={youtube} onChange={(e) => setYoutube(e.target.checked)} /> YouTube-Erklärvideo (Titel, Beschreibung, Skript)
          </label>
          <small>Das Kurzvideo-Skript (Reel · Short · TikTok) ist immer dabei.</small>
        </div>
      </div>
      {error && <p className="ow2-msg err">{error}</p>}
      <div className="ow2-actions">
        <button type="button" className="btn btn-secondary" onClick={onCancel} disabled={busy === "ai"}>
          Abbrechen
        </button>
        <button type="button" className="btn btn-primary" onClick={create} disabled={!!busy}>
          {busy === "ai" ? "KI schreibt … (ca. 20 Sek.)" : "✨ Texte erstellen"}
        </button>
      </div>
    </div>
  );
}

// =====================================================================
// Beitrag bearbeiten
// =====================================================================
function Editor({ post, onSaved, onClose, onDeleted }: { post: Post; onSaved: (p: Post) => void; onClose: () => void; onDeleted: () => void }) {
  const [texts, setTexts] = useState<Partial<Texts>>(post.texts || {});
  const [title, setTitle] = useState(post.title);
  const [graphic, setGraphic] = useState<GraphicData>(post.graphic ?? api.defaultGraphic(post.goal));
  const [status, setStatus] = useState<Status>(post.status);
  const [planned, setPlanned] = useState(post.planned_for ?? "");
  const [published, setPublished] = useState<string[]>(post.published_channels ?? []);
  const [channel, setChannel] = useState<ChannelKey>("facebook");
  const [busy, setBusy] = useState("");
  const [msg, setMsg] = useState<{ text: string; ok: boolean } | null>(null);
  const campaign = post.utm_campaign || L.campaignSlug(post.title);

  const channels = L.CHANNELS.filter((c) => c.key !== "youtube" || texts.youtube_title || texts.youtube_script);
  const dirty =
    JSON.stringify([texts, title, graphic, status, planned, published]) !==
    JSON.stringify([post.texts || {}, post.title, post.graphic ?? api.defaultGraphic(post.goal), post.status, post.planned_for ?? "", post.published_channels ?? []]);

  useEffect(() => {
    if (!msg?.ok) return;
    const t = window.setTimeout(() => setMsg(null), 3500);
    return () => window.clearTimeout(t);
  }, [msg]);

  const save = async (extra: Partial<Post> = {}) => {
    setBusy("save");
    try {
      const st = extra.status ?? status;
      const saved = await api.savePost(post.id, {
        title: title.trim() || post.topic,
        texts,
        graphic,
        status: st,
        planned_for: (extra.planned_for !== undefined ? extra.planned_for : planned) || null,
        published_channels: extra.published_channels ?? published,
        utm_campaign: campaign,
      });
      onSaved(saved);
      setMsg({ text: "Gespeichert.", ok: true });
    } catch (e) {
      setMsg({ text: (e as Error).message, ok: false });
    } finally {
      setBusy("");
    }
  };

  const graphicBlob = async () =>
    renderToBlob({ ...graphic, imageUrl: await resolveImage(graphic.image).catch(() => null), footer: "maler-saas.com" });

  const downloadGraphic = async () => {
    setBusy("png");
    try {
      saveBlob(await graphicBlob(), `${campaign}-${graphic.format}.png`);
    } catch (e) {
      setMsg({ text: (e as Error).message, ok: false });
    } finally {
      setBusy("");
    }
  };

  const copyChannel = async (key: ChannelKey) => {
    const ok = await copy(L.channelText(texts, key, campaign));
    setMsg({ text: ok ? "Text kopiert – beim Posten ins Textfeld einfügen." : "Kopieren nicht möglich – bitte Text markieren.", ok });
  };

  const share = async (key: ChannelKey) => {
    const text = L.channelText(texts, key, campaign);
    await copy(text);
    try {
      const file = new File([await graphicBlob()], `${campaign}.png`, { type: "image/png" });
      if (navigator.canShare?.({ files: [file] })) {
        await navigator.share({ files: [file], text });
        return;
      }
      saveBlob(file, file.name);
      setMsg({ text: "Grafik heruntergeladen und Text kopiert.", ok: true });
    } catch (e) {
      if ((e as Error).name !== "AbortError") setMsg({ text: "Teilen nicht möglich – Grafik herunterladen und Text kopieren.", ok: false });
    }
  };

  const togglePublished = async (key: ChannelKey) => {
    const next = published.includes(key) ? published.filter((k) => k !== key) : [...published, key];
    setPublished(next);
    const allMain = ["facebook", "instagram", "linkedin"].every((k) => next.includes(k));
    const st: Status = allMain ? "veroeffentlicht" : status === "veroeffentlicht" ? (planned ? "geplant" : "entwurf") : status;
    setStatus(st);
    await save({ published_channels: next, status: st });
  };

  const remove = async () => {
    if (!(await showConfirm(`Beitrag „${post.title}“ löschen?`, { danger: true, confirmLabel: "Löschen" }))) return;
    try {
      await api.deletePost(post);
      onDeleted();
    } catch (e) {
      setMsg({ text: (e as Error).message, ok: false });
    }
  };

  const close = async () => {
    if (dirty && !(await showConfirm("Änderungen sind nicht gespeichert. Trotzdem schließen?", { confirmLabel: "Schließen", cancelLabel: "Weiter bearbeiten" }))) return;
    onClose();
  };

  const cur = L.CHANNELS.find((c) => c.key === channel)!;
  const fieldsFor = (key: ChannelKey): { k: keyof Texts; label: string; rows: number }[] =>
    key === "video"
      ? [
          { k: "video_script", label: "Skript (zum Aufnehmen)", rows: 8 },
          { k: "video_caption", label: "Beschreibung zum Video", rows: 3 },
        ]
      : key === "youtube"
        ? [
            { k: "youtube_title", label: "Titel", rows: 1 },
            { k: "youtube_description", label: "Beschreibung", rows: 6 },
            { k: "youtube_script", label: "Skript", rows: 12 },
          ]
        : [{ k: key as keyof Texts, label: "Text", rows: 12 }];

  return (
    <div className="ow2-editor">
      <div className="ow2-ed-head">
        <input className="ow2-title" value={title} onChange={(e) => setTitle(e.target.value)} aria-label="Titel" />
        <div className="ow2-ed-actions">
          <button type="button" className="btn btn-secondary" onClick={remove}>
            Löschen
          </button>
          <button type="button" className="btn btn-secondary" onClick={close}>
            Schließen
          </button>
          <button type="button" className="btn btn-primary" onClick={() => save()} disabled={busy === "save"}>
            {busy === "save" ? "Speichert …" : dirty ? "Speichern •" : "Speichern"}
          </button>
        </div>
      </div>
      {msg && <p className={`ow2-msg ${msg.ok ? "ok" : "err"}`}>{msg.text}</p>}

      <div className="ow2-plan">
        <div className="ow2-field">
          <label>Status</label>
          <div className="ow2-seg">
            {(Object.keys(L.STATUS_LABELS) as Status[]).map((s) => (
              <button key={s} type="button" className={status === s ? "on" : ""} onClick={() => setStatus(s)}>
                {L.STATUS_LABELS[s]}
              </button>
            ))}
          </div>
        </div>
        <div className="ow2-field">
          <label>Geplant für</label>
          <input
            type="date"
            value={planned}
            onChange={(e) => {
              setPlanned(e.target.value);
              if (e.target.value && status === "entwurf") setStatus("geplant");
            }}
          />
        </div>
        <div className="ow2-field">
          <label>Kennung für die Auswertung (UTM)</label>
          <code className="ow2-code">{campaign}</code>
        </div>
      </div>

      <h3 className="ow2-h3">Grafik</h3>
      <GraphicEditor value={graphic} uploads={post.images ?? []} onChange={setGraphic} onDownload={downloadGraphic} busy={busy === "png"} />

      <h3 className="ow2-h3">Texte</h3>
      <div className="ow2-tabs" role="tablist">
        {channels.map((c) => (
          <button key={c.key} type="button" role="tab" aria-selected={channel === c.key} className={channel === c.key ? "on" : ""} onClick={() => setChannel(c.key)}>
            {published.includes(c.key) ? "✓ " : ""}
            {c.label}
          </button>
        ))}
      </div>
      <div className="ow2-channel">
        {fieldsFor(channel).map((f) => {
          const v = String(texts[f.k] ?? "");
          return (
            <div key={f.k} className="ow2-field">
              <label>
                {f.label}
                <span className={v.length > cur.max ? "over" : ""}>{v.length} Zeichen</span>
              </label>
              {f.rows === 1 ? (
                <input value={v} onChange={(e) => setTexts({ ...texts, [f.k]: e.target.value })} />
              ) : (
                <textarea value={v} rows={f.rows} onChange={(e) => setTexts({ ...texts, [f.k]: e.target.value })} />
              )}
            </div>
          );
        })}
        <p className="ow2-small">
          {channel === "instagram" || channel === "video"
            ? `Auf Instagram sind Links nicht anklickbar. Link für Ihre Bio: ${L.utmLink("instagram", "bio")}`
            : `{LINK} wird beim Kopieren ersetzt durch: ${L.utmLink(cur.utm, campaign)}`}
        </p>
        <div className="ow2-actions left">
          <button type="button" className="btn btn-primary" onClick={() => copyChannel(channel)}>
            📋 Text kopieren
          </button>
          {channel !== "youtube" && channel !== "video" && (
            <button type="button" className="btn btn-secondary" onClick={() => share(channel)}>
              📤 Teilen (Handy) / Grafik + Text
            </button>
          )}
          {channel === "instagram" && (
            <button type="button" className="btn btn-secondary" onClick={async () => setMsg({ text: (await copy(L.utmLink("instagram", "bio"))) ? "Bio-Link kopiert." : "Kopieren nicht möglich.", ok: true })}>
              🔗 Bio-Link kopieren
            </button>
          )}
          {cur.open && (
            <a className="btn btn-secondary" href={cur.open} target="_blank" rel="noreferrer">
              {cur.label.split(" ")[0]} öffnen ↗
            </a>
          )}
          <button type="button" className={`btn ${published.includes(channel) ? "btn-secondary" : "btn-secondary"}`} onClick={() => togglePublished(channel)}>
            {published.includes(channel) ? "✓ Veröffentlicht (zurücknehmen)" : "Als veröffentlicht markieren"}
          </button>
        </div>
      </div>
    </div>
  );
}

// =====================================================================
// Übersicht
// =====================================================================
export default function OwnerMarketing({ onBack }: { onBack: () => void }) {
  const [posts, setPosts] = useState<Post[] | null>(null);
  const [error, setError] = useState("");
  const [creating, setCreating] = useState(false);
  const [openId, setOpenId] = useState<number | null>(null);
  const [filter, setFilter] = useState<Status | "alle">("alle");

  const load = useCallback(async () => {
    try {
      setPosts(await api.loadPosts());
      setError("");
    } catch (e) {
      setError((e as Error).message);
      setPosts([]);
    }
  }, []);

  useEffect(() => {
    // load setzt den Zustand erst nach dem Laden
    // eslint-disable-next-line react-hooks/set-state-in-effect
    void load();
  }, [load]);

  const sorted = useMemo(() => L.sortPosts(posts ?? []), [posts]);
  const due = useMemo(() => L.dueThisWeek(posts ?? [], today()), [posts]);
  const visible = filter === "alle" ? sorted : sorted.filter((p) => p.status === filter);
  const open = (posts ?? []).find((p) => p.id === openId) ?? null;
  const counts = (s: Status) => (posts ?? []).filter((p) => p.status === s).length;

  return (
    <section className="single-page-section ow2-root">
      <div className="card form-page-card ow2-main">
        <div className="ow2-top">
          <div>
            <h2>Werbung für MalerSaaS</h2>
            <p>Beiträge für Facebook, Instagram und LinkedIn · Kurzvideo-Skripte · Grafiken</p>
          </div>
          <div className="ow2-top-actions">
            {!open && !creating && (
              <button type="button" className="btn btn-primary" onClick={() => setCreating(true)}>
                + Neuer Beitrag
              </button>
            )}
            <button type="button" className="btn btn-secondary" onClick={onBack}>
              Zurück
            </button>
          </div>
        </div>

        {error && <p className="ow2-msg err">{error}</p>}

        {creating && (
          <Creator
            onCancel={() => setCreating(false)}
            onCreated={(p) => {
              setCreating(false);
              setPosts((list) => [p, ...(list ?? [])]);
              setOpenId(p.id);
            }}
          />
        )}

        {open ? (
          <Editor
            key={open.id}
            post={open}
            onSaved={(p) => setPosts((list) => (list ?? []).map((x) => (x.id === p.id ? p : x)))}
            onClose={() => setOpenId(null)}
            onDeleted={() => {
              setOpenId(null);
              void load();
            }}
          />
        ) : (
          !creating && (
            <>
              {due.length > 0 && (
                <div className="ow2-due">
                  <b>Diese Woche dran:</b>
                  {due.map((p) => (
                    <button key={p.id} type="button" onClick={() => setOpenId(p.id)}>
                      {p.planned_for && p.planned_for < today() ? "⚠️ " : ""}
                      {dateDe(p.planned_for!)} · {p.title}
                    </button>
                  ))}
                </div>
              )}
              <div className="ow2-seg ow2-filter">
                {(["alle", "geplant", "entwurf", "veroeffentlicht"] as const).map((f) => (
                  <button key={f} type="button" className={filter === f ? "on" : ""} onClick={() => setFilter(f)}>
                    {f === "alle" ? `Alle (${posts?.length ?? 0})` : `${L.STATUS_LABELS[f]} (${counts(f)})`}
                  </button>
                ))}
              </div>
              {posts === null ? (
                <p className="ow2-empty">Wird geladen …</p>
              ) : visible.length === 0 ? (
                <p className="ow2-empty">
                  Noch keine Beiträge. Tippen Sie auf <b>„+ Neuer Beitrag“</b> – die KI schreibt Texte für alle Kanäle, Sie gestalten die Grafik.
                </p>
              ) : (
                <ul className="ow2-list">
                  {visible.map((p) => (
                    <li key={p.id}>
                      <button type="button" onClick={() => setOpenId(p.id)}>
                        <span className={`ow2-status s-${p.status}`}>{L.STATUS_LABELS[p.status]}</span>
                        <span className="ow2-li-main">
                          <b>{p.title}</b>
                          <small>
                            {L.GOAL_LABELS[p.goal]} · {p.topic}
                            {p.planned_for ? ` · geplant ${dateDe(p.planned_for)}` : ""}
                          </small>
                        </span>
                        <span className="ow2-li-ch">
                          {["facebook", "instagram", "linkedin"].map((k) => (
                            <i key={k} className={p.published_channels?.includes(k) ? "on" : ""} title={k}>
                              {k === "facebook" ? "f" : k === "instagram" ? "ig" : "in"}
                            </i>
                          ))}
                        </span>
                      </button>
                    </li>
                  ))}
                </ul>
              )}
              <p className="ow2-note">
                Rechtlich: Die KI nennt nur echte Funktionen und Preise von MalerSaaS – keine erfundenen Kundenstimmen, Zahlen oder „Nr. 1“-Aussagen (UWG). Bitte Texte vor dem Posten kurz lesen.
              </p>
            </>
          )
        )}
      </div>
    </section>
  );
}
