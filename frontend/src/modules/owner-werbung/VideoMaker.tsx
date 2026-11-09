// Kurzvideo erstellen (Reel · Short · TikTok): Szenen aus dem Skript, Bild je Szene, optional KI-Stimme
import { useEffect, useMemo, useRef, useState } from "react";
import * as api from "./api";
import { SCREENSHOTS, renderToBlob } from "./graphic";
import type { GraphicData, Texts } from "./logic";
import { canRecord, fileExt, parseScript, renderVideo } from "./video";
import type { Scene } from "./video";

type Props = {
  texts: Partial<Texts>;
  uploads: string[];
  graphic: GraphicData;
  fileBase: string;
  onChange: (patch: Partial<Texts>) => void;
};

const GRAPHIC = "__grafik";

export default function VideoMaker({ texts, uploads, graphic, fileBase, onChange }: Props) {
  // Vorschlag: Mittelszenen zeigen das Bild der Grafik, erste und letzte Szene nur Text
  const parsed = useMemo(
    () => parseScript(texts.video_script ?? "").map((sc, i, all) => ({ ...sc, image: i > 0 && i < all.length - 1 ? graphic.image : null })),
    [texts.video_script, graphic.image]
  );
  const scenes: Scene[] = texts.video_scenes?.length ? texts.video_scenes : parsed;
  const voice = texts.video_voice ?? "female";
  const [uploadUrls, setUploadUrls] = useState<Record<string, string>>({});
  const [busy, setBusy] = useState("");
  const [progress, setProgress] = useState(0);
  const [error, setError] = useState("");
  const [result, setResult] = useState<{ url: string; name: string; mime: string; seconds: number } | null>(null);
  const previewRef = useRef<HTMLCanvasElement | null>(null);
  const supported = canRecord();

  useEffect(() => {
    let cancelled = false;
    Promise.all(uploads.map(async (p) => [p, await api.imageUrl(p).catch(() => "")] as const)).then((pairs) => {
      if (!cancelled) setUploadUrls(Object.fromEntries(pairs));
    });
    return () => {
      cancelled = true;
    };
  }, [uploads]);

  useEffect(() => () => {
    if (result) URL.revokeObjectURL(result.url);
  }, [result]);

  const setScenes = (next: Scene[]) => onChange({ video_scenes: next });
  const update = (i: number, patch: Partial<Scene>) => setScenes(scenes.map((s, k) => (k === i ? { ...s, ...patch } : s)));
  const ensureEditable = () => (texts.video_scenes?.length ? scenes : parsed);

  const resolve = async (img: string | null): Promise<string | null> => {
    if (!img) return null;
    if (img === GRAPHIC) {
      const blob = await renderToBlob({ ...graphic, format: "4x5", imageUrl: await api.resolveImage(graphic.image).catch(() => null), footer: "maler-saas.com" });
      return URL.createObjectURL(blob);
    }
    return api.resolveImage(img);
  };

  const create = async () => {
    setError("");
    setResult(null);
    const list = ensureEditable().filter((s) => s.text.trim());
    if (!list.length) return setError("Bitte mindestens eine Szene mit Text anlegen.");
    try {
      let audio: (ArrayBuffer | null)[] = list.map(() => null);
      if (voice !== "none") {
        audio = [];
        for (let i = 0; i < list.length; i++) {
          setBusy(`Stimme ${i + 1} von ${list.length} …`);
          audio.push(await api.voice(list[i].text, voice));
        }
      }
      setBusy("Bilder werden geladen …");
      const imageUrls = await Promise.all(list.map((s) => resolve(s.image).catch(() => null)));
      setBusy("Video wird aufgenommen …");
      setProgress(0);
      const r = await renderVideo({ scenes: list, imageUrls, audio, preview: previewRef.current, onProgress: setProgress });
      imageUrls.forEach((u) => u?.startsWith("blob:") && URL.revokeObjectURL(u));
      setResult({ url: URL.createObjectURL(r.blob), name: `${fileBase}-reel.${fileExt(r.mime)}`, mime: r.mime, seconds: r.seconds });
    } catch (e) {
      setError((e as Error).message);
    } finally {
      setBusy("");
    }
  };

  const thumbs = (i: number, current: string | null) => (
    <div className="ow2-thumbs small">
      <button type="button" className={!current ? "on none" : "none"} onClick={() => update(i, { image: null })}>
        Nur Text
      </button>
      <button type="button" className={current === GRAPHIC ? "on none" : "none"} onClick={() => update(i, { image: GRAPHIC })}>
        Grafik
      </button>
      {uploads.map((p) => (
        <button key={p} type="button" className={current === p ? "on" : ""} onClick={() => update(i, { image: p })}>
          {uploadUrls[p] ? <img src={uploadUrls[p]} alt="" /> : "…"}
        </button>
      ))}
      {SCREENSHOTS.map((s) => (
        <button key={s.url} type="button" className={current === s.url ? "on" : ""} onClick={() => update(i, { image: s.url })} title={s.label}>
          <img src={s.url} alt={s.label} loading="lazy" />
        </button>
      ))}
    </div>
  );

  return (
    <div className="ow2-video">
      <div className="ow2-vhead">
        <h4>🎬 Video erstellen</h4>
        <p className="ow2-small">Hochkant 1080 × 1920 für Instagram-Reel, YouTube-Short und TikTok. Jede Szene: ein Bild + der Text als Einblendung.</p>
      </div>

      {!supported && <p className="ow2-msg err">Dieser Browser kann keine Videos erstellen. Bitte Chrome, Edge oder Safari (aktuelle Version) verwenden.</p>}

      <div className="ow2-field">
        <label>Stimme</label>
        <div className="ow2-seg">
          {(
            [
              ["female", "Weibliche KI-Stimme"],
              ["male", "Männliche KI-Stimme"],
              ["none", "Ohne Stimme"],
            ] as const
          ).map(([k, l]) => (
            <button key={k} type="button" className={voice === k ? "on" : ""} onClick={() => onChange({ video_voice: k })}>
              {l}
            </button>
          ))}
        </div>
        <small>
          {voice === "none"
            ? "Ohne Stimme bestimmt die Szenendauer die Länge. Tipp: Musik können Sie direkt in Instagram/TikTok hinzufügen."
            : "Die Stimme liest den Szenentext (ElevenLabs, wenige Cent je Video). Beim Hochladen bitte „KI-generiert“ kennzeichnen."}
        </small>
      </div>

      <div className="ow2-scenes">
        {scenes.map((s, i) => (
          <div key={i} className="ow2-scene">
            <div className="ow2-scene-head">
              <b>Szene {i + 1}</b>
              {s.hint && <small>Idee: {s.hint}</small>}
              <span>
                {voice === "none" && (
                  <input
                    className="ow2-sec"
                    type="number"
                    min={1.5}
                    max={12}
                    step={0.5}
                    value={s.seconds}
                    onChange={(e) => update(i, { seconds: Number(e.target.value) || 3 })}
                    aria-label="Sekunden"
                  />
                )}
                {voice === "none" && " s"}
                <button type="button" className="ow2-x" onClick={() => setScenes(scenes.filter((_, k) => k !== i))} aria-label="Szene löschen" title="Szene löschen">
                  ✕
                </button>
              </span>
            </div>
            <textarea rows={2} value={s.text} maxLength={220} onChange={(e) => update(i, { text: e.target.value })} />
            {thumbs(i, s.image)}
          </div>
        ))}
        <div className="ow2-actions left">
          <button type="button" className="btn btn-secondary" onClick={() => setScenes([...scenes, { text: "", image: null, seconds: 3 }])} disabled={scenes.length >= 10}>
            + Szene
          </button>
          {texts.video_scenes?.length ? (
            <button type="button" className="btn btn-secondary" onClick={() => onChange({ video_scenes: [] })}>
              Szenen neu aus Skript
            </button>
          ) : null}
        </div>
      </div>

      <div className="ow2-vrender">
        <div className="ow2-vpreview">
          {result ? <video src={result.url} controls playsInline /> : <canvas ref={previewRef} />}
        </div>
        <div className="ow2-vside">
          <button type="button" className="btn btn-primary" onClick={create} disabled={!!busy || !supported}>
            {busy || "🎬 Video erstellen"}
          </button>
          {busy.startsWith("Video") && (
            <>
              <div className="ow2-bar">
                <i style={{ width: `${Math.round(progress * 100)}%` }} />
              </div>
              <p className="ow2-small">Die Aufnahme läuft in Echtzeit – bitte dieses Fenster geöffnet und im Vordergrund lassen.</p>
            </>
          )}
          {error && <p className="ow2-msg err">{error}</p>}
          {result && (
            <>
              <a className="btn btn-primary" href={result.url} download={result.name}>
                ⬇ Video herunterladen ({result.seconds} s)
              </a>
              {!result.mime.includes("mp4") && (
                <p className="ow2-msg err">
                  Ihr Browser hat ein WebM-Video erstellt. TikTok und YouTube nehmen es an, Instagram nicht immer – für Instagram bitte in aktuellem Chrome/Edge erstellen.
                </p>
              )}
              <button type="button" className="btn btn-secondary" onClick={() => setResult(null)}>
                Neu erstellen
              </button>
            </>
          )}
        </div>
      </div>
    </div>
  );
}
