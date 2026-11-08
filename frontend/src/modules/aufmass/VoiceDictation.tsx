import { useEffect, useRef, useState } from "react";
import { sendDictation, type VoiceData } from "./voice";

type Props = { onResult: (data: VoiceData) => void };
type Phase = "idle" | "recording" | "working" | "done" | "error";

const MAX_SECONDS = 10 * 60;

function pickMime(): string {
  const options = ["audio/webm;codecs=opus", "audio/webm", "audio/mp4", "audio/ogg;codecs=opus"];
  for (const m of options) if (typeof MediaRecorder !== "undefined" && MediaRecorder.isTypeSupported?.(m)) return m;
  return "";
}

const mmss = (s: number) => `${Math.floor(s / 60)}:${String(s % 60).padStart(2, "0")}`;

/** „🎤 Aufmaß diktieren“ – Aufnahme im Browser, Auswertung auf dem Server */
export default function VoiceDictation({ onResult }: Props) {
  const [phase, setPhase] = useState<Phase>("idle");
  const [seconds, setSeconds] = useState(0);
  const [message, setMessage] = useState("");
  const [transcript, setTranscript] = useState("");
  const [usage, setUsage] = useState("");
  const recRef = useRef<MediaRecorder | null>(null);
  const chunksRef = useRef<Blob[]>([]);
  const timerRef = useRef<number | null>(null);
  const streamRef = useRef<MediaStream | null>(null);

  const supported = typeof window !== "undefined" && !!navigator.mediaDevices?.getUserMedia && typeof MediaRecorder !== "undefined";

  const cleanup = () => {
    if (timerRef.current) window.clearInterval(timerRef.current);
    timerRef.current = null;
    streamRef.current?.getTracks().forEach((t) => t.stop());
    streamRef.current = null;
  };
  useEffect(() => cleanup, []);

  const start = async () => {
    setMessage("");
    setTranscript("");
    try {
      const stream = await navigator.mediaDevices.getUserMedia({ audio: { echoCancellation: true, noiseSuppression: true } });
      streamRef.current = stream;
      const mime = pickMime();
      const rec = mime ? new MediaRecorder(stream, { mimeType: mime }) : new MediaRecorder(stream);
      chunksRef.current = [];
      rec.ondataavailable = (e) => e.data.size && chunksRef.current.push(e.data);
      rec.onstop = () => void finish(rec.mimeType || mime || "audio/webm");
      rec.start(1000);
      recRef.current = rec;
      setSeconds(0);
      setPhase("recording");
      timerRef.current = window.setInterval(() => {
        setSeconds((s) => {
          if (s + 1 >= MAX_SECONDS) stop();
          return s + 1;
        });
      }, 1000);
    } catch {
      cleanup();
      setPhase("error");
      setMessage("Kein Zugriff auf das Mikrofon. Bitte erlauben Sie den Mikrofon-Zugriff für diese Seite (Schloss-Symbol neben der Adresse) und versuchen Sie es erneut.");
    }
  };

  const stop = () => {
    const rec = recRef.current;
    if (rec && rec.state !== "inactive") rec.stop();
    recRef.current = null;
  };

  const cancel = () => {
    const rec = recRef.current;
    if (rec) {
      rec.onstop = null;
      if (rec.state !== "inactive") rec.stop();
    }
    recRef.current = null;
    cleanup();
    setPhase("idle");
  };

  const finish = async (type: string) => {
    cleanup();
    const blob = new Blob(chunksRef.current, { type });
    chunksRef.current = [];
    if (blob.size < 1000) {
      setPhase("error");
      setMessage("Die Aufnahme war zu kurz. Bitte noch einmal diktieren.");
      return;
    }
    setPhase("working");
    const res = await sendDictation(blob);
    if (res.transcript) setTranscript(res.transcript);
    if (res.used != null && res.limit != null) setUsage(`${res.used} von ${res.limit} Diktaten in diesem Monat genutzt`);
    if (!res.ok || !res.data) {
      setPhase("error");
      setMessage(res.error || "Das Diktat konnte nicht ausgewertet werden.");
      return;
    }
    onResult(res.data);
    const n = res.data.rooms.length;
    setPhase("done");
    setMessage(
      `${n === 1 ? "1 Bereich" : `${n} Bereiche`} übernommen${res.data.services.length ? ` und ${res.data.services.length} Sonderleistung(en)` : ""}. Bitte die Angaben kurz prüfen.`,
    );
  };

  if (!supported) {
    return (
      <div className="am-voice">
        <p className="am-voice-hint">
          Dieser Browser unterstützt keine Aufnahme. Tipp: Mit dem 🎤 auf der Handy-Tastatur können Sie in jedes Feld diktieren.
        </p>
      </div>
    );
  }

  return (
    <div className={`am-voice ${phase}`}>
      {phase === "recording" ? (
        <div className="am-voice-rec">
          <span className="am-voice-dot" aria-hidden />
          <b>Aufnahme läuft · {mmss(seconds)}</b>
          <span className="am-voice-hint">Raum für Raum sprechen, z. B. „Wohnzimmer fünf mal vier, Höhe zwei fünfzig, zwei Fenster eins zwanzig mal eins vierzig, Decke streichen, zwei Anstriche“.</span>
          <div className="am-voice-actions">
            <button type="button" className="btn btn-primary" onClick={stop}>✓ Fertig</button>
            <button type="button" className="btn btn-secondary" onClick={cancel}>Abbrechen</button>
          </div>
        </div>
      ) : phase === "working" ? (
        <div className="am-voice-rec">
          <span className="am-voice-spin" aria-hidden />
          <b>Diktat wird ausgewertet …</b>
          <span className="am-voice-hint">Das dauert meist 5 bis 20 Sekunden.</span>
        </div>
      ) : (
        <>
          <button type="button" className="am-voice-btn" onClick={start}>
            <span aria-hidden>🎤</span>
            <span>
              <b>Aufmaß diktieren</b>
              <small>Räume, Maße, Fenster, Türen und Anstriche einfach ansagen – die KI füllt das Formular aus.</small>
            </span>
          </button>
          {message && <p className={`am-voice-msg ${phase === "error" ? "err" : "ok"}`} role={phase === "error" ? "alert" : "status"}>{message}</p>}
          {transcript && (
            <details className="am-voice-text">
              <summary>Erkannter Text anzeigen</summary>
              <p>{transcript}</p>
            </details>
          )}
          {usage && <small className="am-voice-hint">{usage}</small>}
        </>
      )}
    </div>
  );
}
