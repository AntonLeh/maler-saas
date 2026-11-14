// MalerTreff: Bausteine für externe Mitglieder (Nachweis hochladen, Hinweis auf MalerSaaS)
import { useRef, useState } from "react";
import * as api from "./api";
import { EXTERNAL_KINDS, PROOF_MAX_MB, PROOF_TYPES } from "./logic";
import type { Member } from "./logic";

export function ProofCard({ me, onDone }: { me: Member; onDone: () => void }) {
  const input = useRef<HTMLInputElement>(null);
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState<string | null>(null);
  const what = EXTERNAL_KINDS.find((k) => k.id === me.kind)?.proof ?? "Gewerbenachweis";

  const pick = async (file: File | undefined) => {
    if (!file) return;
    setBusy(true);
    setErr(null);
    try {
      await api.uploadProof(file);
      onDone();
    } catch (e) {
      setErr((e as Error).message);
    } finally {
      setBusy(false);
      if (input.current) input.current.value = "";
    }
  };

  const submitted = me.proof_status === "eingereicht";
  return (
    <div className="cm-proof">
      <h3>{submitted ? "Danke – Ihr Nachweis wird geprüft" : "Noch ein Schritt: Nachweis hochladen"}</h3>
      {me.proof_status === "abgelehnt" && (
        <p className="cm-msg err">
          Ihr letzter Nachweis wurde nicht angenommen. Grund: {(me.proof_note ?? "–").replace(/[.!?]+$/, "")}. Bitte laden Sie einen neuen Nachweis hoch.
        </p>
      )}
      {submitted ? (
        <p>
          Wir prüfen Ihren Nachweis in der Regel innerhalb von 1–2 Werktagen. Sie bekommen eine E-Mail, sobald Ihr Konto freigeschaltet ist. Falls etwas nicht passt, können
          Sie hier einen neuen Nachweis hochladen.
        </p>
      ) : (
        <p>
          Damit im MalerTreff nur echte Betriebe und Zulieferer mitmachen, prüfen wir einmalig Ihren Nachweis: <b>{what}</b>.
        </p>
      )}
      <ul className="cm-small cm-proof-list">
        <li>PDF oder Foto (JPG, PNG), höchstens {PROOF_MAX_MB} MB</li>
        <li>Nur die Moderation sieht die Datei; sie wird 30 Tage nach der Prüfung automatisch gelöscht</li>
        <li>Persönliche Angaben, die wir nicht brauchen (z. B. Geburtsdatum), dürfen Sie schwärzen</li>
      </ul>
      {err && <p className="cm-msg err">{err}</p>}
      <button type="button" className={`btn ${submitted ? "btn-secondary" : "btn-primary"}`} disabled={busy} onClick={() => input.current?.click()}>
        {busy ? "Wird hochgeladen …" : submitted ? "Anderen Nachweis hochladen" : "📄 Nachweis hochladen"}
      </button>
      <input ref={input} type="file" accept={PROOF_TYPES} hidden onChange={(e) => pick(e.target.files?.[0])} />
    </div>
  );
}

/** Dezenter Hinweis für externe Malerbetriebe */
export function MalerSaaSHint() {
  return (
    <a className="cm-hint" href="/" target="_blank" rel="noreferrer">
      <span>🎨</span>
      <span>
        <b>Büro einfacher machen?</b> Aufmaß, Angebote, Zeiterfassung und Rechnungen in einer App – MalerSaaS 14 Tage kostenlos testen.
      </span>
    </a>
  );
}
