// Auftrag bearbeiten: geplante Stunden (nur Chef änderbar) mit Vorschlag aus dem Angebot und Soll-Ist
import { useState } from "react";
import { supabase } from "../../lib/supabase";
import { fmtHours, hoursState, suggestHours } from "./planHours";
import type { QuoteItemLite } from "./planHours";

type Props = {
  value: string;
  onChange: (v: string) => void;
  canEdit: boolean;
  actualHours: number;
  quoteId: number | null;
  customerRate: number;
  laborPct: number;
};

export default function PlannedHoursField({ value, onChange, canEdit, actualHours, quoteId, customerRate, laborPct }: Props) {
  const [hint, setHint] = useState("");
  const [busy, setBusy] = useState(false);
  const planned = Number(value.replace(",", ".")) || 0;
  const st = hoursState(planned, actualHours);

  const suggest = async () => {
    if (!quoteId) return setHint("Zu diesem Auftrag gibt es kein Angebot – bitte die Stunden selbst eintragen.");
    if (!customerRate) return setHint("Bitte zuerst in den Einstellungen den Kunden-Stundensatz hinterlegen.");
    setBusy(true);
    try {
      const { data, error } = await supabase.from("quote_items").select("title, quantity, unit, unit_price, line_total, item_type").eq("quote_id", quoteId);
      if (error) throw error;
      const r = suggestHours((data ?? []) as QuoteItemLite[], customerRate, laborPct);
      if (!r.hours) return setHint("Aus dem Angebot ließ sich kein Vorschlag berechnen.");
      onChange(String(r.hours).replace(".", ","));
      setHint(
        `Vorschlag ${fmtHours(r.hours)} Std.: ${r.direct ? `${fmtHours(r.direct)} Std. aus „Std.“-Positionen + ` : ""}${r.amount.toLocaleString("de-DE", { maximumFractionDigits: 0 })} € × ${laborPct} % Lohnanteil ÷ ${customerRate.toLocaleString("de-DE")} €/Std. – bitte prüfen und speichern.`
      );
    } catch {
      setHint("Das Angebot konnte nicht geladen werden.");
    } finally {
      setBusy(false);
    }
  };

  return (
    <div className="ao-row ao-planned">
      <div className="form-group ao-field">
        <label htmlFor="ao-planned">Geplante Stunden</label>
        {canEdit ? (
          <div className="ao-planned-input">
            <input id="ao-planned" inputMode="decimal" value={value} onChange={(e) => onChange(e.target.value.replace(/[^\d,.]/g, ""))} placeholder="z. B. 80" />
            <button type="button" className="btn btn-secondary" onClick={suggest} disabled={busy}>
              {busy ? "…" : "Vorschlag aus Angebot"}
            </button>
          </div>
        ) : (
          <p className="ao-planned-ro">{planned ? `${fmtHours(planned)} Std.` : "nicht festgelegt"}</p>
        )}
        {hint && <small className="ao-planned-hint">{hint}</small>}
      </div>
      <div className="form-group ao-field">
        <label>Erfasst bisher</label>
        <div className={`ao-planned-bar ${st ? `h-${st}` : ""}`}>
          <b>{fmtHours(actualHours)} Std.</b>
          {planned > 0 && (
            <>
              <span>
                von {fmtHours(planned)} Std. · {actualHours > planned ? `${fmtHours(actualHours - planned)} Std. über Plan` : `noch ${fmtHours(planned - actualHours)} Std.`}
              </span>
              <i>
                <em style={{ width: `${Math.min(100, (actualHours / planned) * 100)}%` }} />
              </i>
            </>
          )}
        </div>
      </div>
    </div>
  );
}
