// YouTube-Erklärvideo: Drehanleitung (KI) + Anleitung Aufnahme/Schnitt/Hochladen
import { useState } from "react";
import * as api from "./api";
import type { Shotlist, Texts } from "./logic";

type Props = {
  topic: string;
  texts: Partial<Texts>;
  onChange: (patch: Partial<Texts>) => void;
};

export default function ShotlistPanel({ topic, texts, onChange }: Props) {
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const [done, setDone] = useState<Record<string, boolean>>({});
  const list: Shotlist | undefined = texts.youtube_shotlist;
  const total = list ? list.scenes.reduce((a, s) => a + (s.seconds || 0), 0) : 0;

  const create = async () => {
    setBusy(true);
    setError("");
    try {
      onChange({ youtube_shotlist: await api.shotlist(topic, texts.youtube_script ?? "") });
    } catch (e) {
      setError((e as Error).message);
    } finally {
      setBusy(false);
    }
  };

  const toggle = (k: string) => setDone((d) => ({ ...d, [k]: !d[k] }));

  return (
    <div className="ow2-shot">
      <div className="ow2-vhead">
        <h4>🎥 Drehanleitung (Bildschirmaufnahme mit Ihrer Stimme)</h4>
        <p className="ow2-small">Schritt für Schritt: was Sie vorbereiten, was Sie zeigen, was Sie sagen.</p>
      </div>
      <div className="ow2-actions left">
        <button type="button" className="btn btn-primary" onClick={create} disabled={busy}>
          {busy ? "KI erstellt die Drehanleitung …" : list ? "Drehanleitung neu erstellen" : "✨ Drehanleitung erstellen"}
        </button>
      </div>
      {error && <p className="ow2-msg err">{error}</p>}

      {list && (
        <>
          <h5>1. Vorbereitung</h5>
          <ul className="ow2-checks">
            {list.preparation.map((p, i) => (
              <li key={i}>
                <label>
                  <input type="checkbox" checked={!!done[`p${i}`]} onChange={() => toggle(`p${i}`)} /> {p}
                </label>
              </li>
            ))}
            <li>
              <label>
                <input type="checkbox" checked={!!done.dsgvo} onChange={() => toggle("dsgvo")} /> <b>Nur Demo-Daten zeigen</b> – keine echten Kunden, Mitarbeiter oder E-Mails im Bild (Datenschutz).
              </label>
            </li>
          </ul>

          <h5>2. Szenen ({Math.round(total / 60)}–{Math.ceil(total / 60) + 1} Minuten)</h5>
          <ol className="ow2-shots">
            {list.scenes.map((s, i) => (
              <li key={i} className={done[`s${i}`] ? "done" : ""}>
                <div className="ow2-shot-head">
                  <label>
                    <input type="checkbox" checked={!!done[`s${i}`]} onChange={() => toggle(`s${i}`)} /> <b>{s.title}</b>
                  </label>
                  <small>ca. {s.seconds} s</small>
                </div>
                <p>
                  <span>Bildschirm:</span> {s.screen}
                </p>
                <p>
                  <span>Klicken:</span> {s.actions}
                </p>
                <p className="say">
                  <span>Sagen:</span> „{s.say}“
                </p>
              </li>
            ))}
          </ol>
          {list.thumbnail && (
            <p className="ow2-small">
              <b>Vorschaubild-Idee:</b> {list.thumbnail}
            </p>
          )}
        </>
      )}

      <details className="ow2-howto">
        <summary>So nehmen Sie auf, schneiden und laden hoch</summary>
        <ol>
          <li>
            <b>Aufnehmen (Windows 11):</b> <kbd>Windows</kbd> + <kbd>Umschalt</kbd> + <kbd>R</kbd> öffnet das Snipping Tool im Videomodus. Bereich wählen
            (am besten das ganze Browserfenster), Mikrofon einschalten, „Start“. Jede Szene ruhig einzeln aufnehmen – Versprecher einfach wiederholen.
          </li>
          <li>
            <b>Ton:</b> Ein einfaches Headset oder das Handy-Mikrofon nah am Mund klingt besser als das Laptop-Mikrofon. Ruhiger Raum, Fenster zu.
          </li>
          <li>
            <b>Schneiden:</b> <b>Clipchamp</b> (bei Windows 11 dabei) öffnen → „Neues Video“ → Aufnahmen hineinziehen → Anfang/Ende abschneiden →
            Untertitel automatisch erzeugen („Untertitel“ → Deutsch) → „Exportieren“ in 1080p.
          </li>
          <li>
            <b>Hochladen:</b> YouTube Studio → „Erstellen“ → „Videos hochladen“. Titel und Beschreibung aus den Feldern oben kopieren, Vorschaubild hochladen
            (z. B. eine Grafik aus dem Grafik-Generator). Bei echter Stimme ist keine KI-Kennzeichnung nötig.
          </li>
          <li>
            <b>Danach:</b> Einen 30-Sekunden-Ausschnitt als Short hochladen – mit Hinweis „ganzes Video auf dem Kanal“.
          </li>
        </ol>
      </details>
    </div>
  );
}
