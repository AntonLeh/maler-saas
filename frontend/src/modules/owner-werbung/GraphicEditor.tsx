import { useEffect, useRef, useState } from "react";
import { FORMATS, SCREENSHOTS, TEMPLATES, render } from "./graphic";
import type { Format, Template } from "./graphic";
import type { GraphicData, LibImage } from "./logic";
import * as api from "./api";
import { resolveImage } from "./api";

type Props = {
  value: GraphicData;
  uploads: string[];
  onChange: (g: GraphicData) => void;
  onDownload: () => void;
  busy: boolean;
  /** Bildbibliothek (Design-Agent): passende Vorschläge zuerst */
  library?: LibImage[];
  suggested?: LibImage[];
};

export default function GraphicEditor({ value, uploads, onChange, onDownload, busy, library = [], suggested = [] }: Props) {
  const canvasRef = useRef<HTMLCanvasElement | null>(null);
  const [uploadUrls, setUploadUrls] = useState<Record<string, string>>({});
  const [showAll, setShowAll] = useState(false);
  const libShown = showAll ? library : suggested;
  const libKey = libShown.map((i) => i.path).join("|");
  const [libUrls, setLibUrls] = useState<Record<string, string>>({});
  useEffect(() => {
    let cancelled = false;
    const paths = libKey ? libKey.split("|") : [];
    Promise.all(paths.map(async (p) => [p, await api.imageUrl(p).catch(() => "")] as const)).then((pairs) => {
      if (!cancelled) setLibUrls((old) => ({ ...old, ...Object.fromEntries(pairs) }));
    });
    return () => {
      cancelled = true;
    };
  }, [libKey]);

  useEffect(() => {
    let cancelled = false;
    Promise.all(uploads.map(async (p) => [p, await api.imageUrl(p).catch(() => "")] as const)).then((pairs) => {
      if (!cancelled) setUploadUrls(Object.fromEntries(pairs));
    });
    return () => {
      cancelled = true;
    };
  }, [uploads]);

  useEffect(() => {
    let cancelled = false;
    const t = window.setTimeout(async () => {
      const imageUrl = await resolveImage(value.image).catch(() => null);
      if (cancelled || !canvasRef.current) return;
      await render(canvasRef.current, {
        template: value.template,
        format: value.format,
        headline: value.headline,
        subline: value.subline,
        points: value.points,
        imageUrl,
        footer: "maler-saas.com",
      });
    }, 150);
    return () => {
      cancelled = true;
      window.clearTimeout(t);
    };
  }, [value]);

  const set = (patch: Partial<GraphicData>) => onChange({ ...value, ...patch });
  const points = [...value.points, "", "", ""].slice(0, 3);

  return (
    <div className="ow2-graphic">
      <div className="ow2-gcontrols">
        <div className="ow2-field">
          <label>Vorlage</label>
          <div className="ow2-seg">
            {(Object.keys(TEMPLATES) as Template[]).map((t) => (
              <button key={t} type="button" className={value.template === t ? "on" : ""} onClick={() => set({ template: t })}>
                {TEMPLATES[t]}
              </button>
            ))}
          </div>
        </div>
        <div className="ow2-field">
          <label>Format</label>
          <div className="ow2-seg">
            {(Object.keys(FORMATS) as Format[]).map((f) => (
              <button key={f} type="button" className={value.format === f ? "on" : ""} onClick={() => set({ format: f })}>
                {FORMATS[f].label}
              </button>
            ))}
          </div>
        </div>
        <div className="ow2-field">
          <label>Überschrift</label>
          <input value={value.headline} maxLength={60} onChange={(e) => set({ headline: e.target.value })} />
        </div>
        <div className="ow2-field">
          <label>Unterzeile</label>
          <input value={value.subline} maxLength={120} onChange={(e) => set({ subline: e.target.value })} />
        </div>
        <div className="ow2-field">
          <label>Stichpunkte</label>
          {points.map((p, i) => (
            <input
              key={i}
              value={p}
              maxLength={50}
              placeholder={`Punkt ${i + 1}`}
              onChange={(e) => {
                const next = [...points];
                next[i] = e.target.value;
                set({ points: next });
              }}
            />
          ))}
        </div>
        {library.length > 0 && (
          <div className="ow2-field">
            <label>
              {showAll ? "Alle Bilder aus Ihrer Bibliothek" : "Passend aus Ihrer Bibliothek"}
              <button type="button" className="ow2-link" onClick={() => setShowAll(!showAll)}>
                {showAll ? "Nur passende" : `Alle (${library.length})`}
              </button>
            </label>
            <div className="ow2-thumbs">
              {libShown.map((img) => (
                <button
                  key={img.path}
                  type="button"
                  className={value.image === img.path ? "on" : ""}
                  title={img.description ?? ""}
                  onClick={() => set({ image: img.path, template: value.template === "funktion" ? value.template : "foto" })}
                >
                  {libUrls[img.path] ? <img src={libUrls[img.path]} alt={img.description ?? ""} /> : "…"}
                  {img.realistic && <span>KI-Label</span>}
                </button>
              ))}
            </div>
          </div>
        )}
        <div className="ow2-field">
          <label>Bild</label>
          <div className="ow2-thumbs">
            <button type="button" className={!value.image ? "on none" : "none"} onClick={() => set({ image: null })}>
              Ohne
            </button>
            {uploads.map((p) => (
              <button key={p} type="button" className={value.image === p ? "on" : ""} onClick={() => set({ image: p })} title="Eigenes Bild">
                {uploadUrls[p] ? <img src={uploadUrls[p]} alt="" /> : "…"}
              </button>
            ))}
            {SCREENSHOTS.map((s) => (
              <button key={s.url} type="button" className={value.image === s.url ? "on" : ""} onClick={() => set({ image: s.url })} title={s.label}>
                <img src={s.url} alt={s.label} loading="lazy" />
                <span>{s.label}</span>
              </button>
            ))}
          </div>
        </div>
        <button type="button" className="btn btn-primary" onClick={onDownload} disabled={busy}>
          {busy ? "Erstellt …" : "⬇ Grafik als PNG"}
        </button>
      </div>
      <div className={`ow2-preview f${value.format}`}>
        <canvas ref={canvasRef} />
      </div>
    </div>
  );
}
