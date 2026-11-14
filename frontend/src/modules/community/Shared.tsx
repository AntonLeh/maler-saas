// MalerTreff: gemeinsame Bausteine (Autor, Fotos, Melden-Dialog)
import { useEffect, useState } from "react";
import * as api from "./api";
import { initials, MEMBER_KINDS, REASONS, timeAgo } from "./logic";
import type { Author, ReportReason, TargetType } from "./logic";

export function AuthorLine({ a, at, onOpen, edited }: { a: Author | null; at?: string; onOpen?: (id: number) => void; edited?: boolean }) {
  if (!a) return <div className="cm-author">Gelöschtes Mitglied</div>;
  return (
    <div className="cm-author">
      <span className={`cm-avatar k-${a.kind}`} aria-hidden>
        {initials(a.name)}
      </span>
      <div className="cm-author-text">
        <button type="button" className="cm-name" onClick={() => onOpen?.(a.id)} disabled={!onOpen}>
          {a.name}
        </button>
        <span className={`cm-badge k-${a.kind}`}>{a.is_mod && a.kind !== "team" ? "Moderation" : MEMBER_KINDS[a.kind]}</span>
        <small>
          {[a.company, a.region].filter(Boolean).join(" · ")}
          {at && <> · {timeAgo(at)}</>}
          {edited && " · bearbeitet"}
        </small>
      </div>
    </div>
  );
}

/** Fotos als Raster; Klick öffnet die Großansicht */
export function Photos({ paths, small }: { paths: string[]; small?: boolean }) {
  const [urls, setUrls] = useState<Record<string, string>>({});
  const [open, setOpen] = useState<string | null>(null);
  const key = paths.join("|");
  useEffect(() => {
    let cancel = false;
    if (!key) return;
    void api.imageUrls(key.split("|")).then((u) => {
      if (!cancel) setUrls(u);
    });
    return () => {
      cancel = true;
    };
  }, [key]);
  if (!paths.length) return null;
  return (
    <>
      <div className={`cm-photos n${Math.min(paths.length, 4)}${small ? " small" : ""}`}>
        {paths.map((p) => (
          <button type="button" key={p} onClick={(e) => (e.stopPropagation(), setOpen(p))} aria-label="Foto vergrößern">
            {urls[p] ? <img src={urls[p]} alt="" loading="lazy" /> : <span className="cm-photo-wait" />}
          </button>
        ))}
      </div>
      {open && urls[open] && (
        <div className="cm-lightbox" onClick={() => setOpen(null)} role="dialog" aria-label="Foto">
          <img src={urls[open]} alt="" />
          <button type="button" className="cm-lightbox-x" aria-label="Schließen">
            ✕
          </button>
        </div>
      )}
    </>
  );
}

/** Melden mit Grund – zeigt danach die Eingangsbestätigung */
export function ReportDialog({ type, id, onClose }: { type: TargetType; id: number; onClose: () => void }) {
  const [reason, setReason] = useState<ReportReason | "">("");
  const [note, setNote] = useState("");
  const [busy, setBusy] = useState(false);
  const [done, setDone] = useState<string | null>(null);
  const [err, setErr] = useState<string | null>(null);
  const what = type === "post" ? "Beitrag" : type === "comment" ? "Antwort" : "Mitglied";
  const send = async () => {
    if (!reason) return setErr("Bitte einen Grund wählen.");
    setBusy(true);
    setErr(null);
    try {
      setDone(await api.report(type, id, reason, note));
    } catch (e) {
      setErr((e as Error).message);
    } finally {
      setBusy(false);
    }
  };
  return (
    <div className="cm-overlay" onClick={onClose}>
      <div className="cm-dialog" onClick={(e) => e.stopPropagation()} role="dialog" aria-label={`${what} melden`}>
        <h3>{what} melden</h3>
        {done ? (
          <>
            <p className="cm-msg ok">{done}</p>
            <div className="cm-actions">
              <button type="button" className="btn btn-primary" onClick={onClose}>
                Schließen
              </button>
            </div>
          </>
        ) : (
          <>
            <p className="cm-small">Warum verstößt der Inhalt gegen die Regeln oder gegen das Gesetz?</p>
            <div className="cm-reasons">
              {REASONS.map((r) => (
                <label key={r.id} className={reason === r.id ? "on" : ""}>
                  <input type="radio" name="reason" checked={reason === r.id} onChange={() => setReason(r.id)} />
                  {r.label}
                </label>
              ))}
            </div>
            {reason === "gefahr" && <p className="cm-msg warn">Bei akuter Gefahr rufen Sie bitte sofort die Polizei (110 / 133 / 117) oder den Notruf 112.</p>}
            <label className="cm-field">
              <span>Erläuterung (freiwillig)</span>
              <textarea rows={3} maxLength={1000} value={note} onChange={(e) => setNote(e.target.value)} placeholder="Was genau ist das Problem?" />
            </label>
            {err && <p className="cm-msg err">{err}</p>}
            <div className="cm-actions">
              <button type="button" className="btn btn-secondary" onClick={onClose}>
                Abbrechen
              </button>
              <button type="button" className="btn btn-primary" onClick={send} disabled={busy}>
                {busy ? "Senden…" : "Melden"}
              </button>
            </div>
          </>
        )}
      </div>
    </div>
  );
}
