import type { AiPhoneBilling, MinuteLedgerEntry, MinutePackage } from "./types";
import { LOW_BALANCE_MINUTES, MINUTE_PACKAGES } from "./types";

const euro = (n: number) => n.toLocaleString("de-DE", { style: "currency", currency: "EUR", minimumFractionDigits: n % 1 ? 2 : 0 });

function formatDate(iso: string) {
  return new Date(iso).toLocaleDateString("de-DE", { day: "2-digit", month: "2-digit", year: "numeric" });
}

/** Guthaben, Nachkauf und letzte Käufe */
export default function BillingPanel({
  billing,
  purchases,
  busy,
  onBuy,
}: {
  billing: AiPhoneBilling;
  purchases: MinuteLedgerEntry[];
  busy: boolean;
  onBuy: (pkg: MinutePackage) => void;
}) {
  const minutes = Math.max(0, Math.floor(Number(billing.balance_seconds) / 60));
  const state = minutes <= 0 ? "empty" : minutes <= LOW_BALANCE_MINUTES ? "low" : "ok";
  const packs = MINUTE_PACKAGES.filter((p) => p.key !== "setup");

  return (
    <section className={`kt-panel kt-billing kt-billing-${state}`}>
      <div className="kt-billing-head">
        <div>
          <span className="kt-billing-label">Minuten-Guthaben</span>
          <strong className="kt-billing-value">{minutes.toLocaleString("de-DE")} Min.</strong>
        </div>
        {state === "empty" && (
          <span className="tk-badge tk-status-abgelehnt">Aufgebraucht – Anrufe werden nicht angenommen</span>
        )}
        {state === "low" && <span className="tk-badge tk-status-weitergeleitet">Bald aufgebraucht</span>}
      </div>

      <div className="kt-packs">
        {packs.map((p) => (
          <div key={p.key} className="kt-pack">
            <div>
              <strong>{p.label}</strong>
              <span className="tk-muted">
                {euro(p.net)} zzgl. MwSt. · {((p.net / p.minutes) * 100).toFixed(1).replace(".", ",")} ct/Min.
              </span>
            </div>
            <button type="button" className="btn btn-primary btn-small" onClick={() => onBuy(p.key)} disabled={busy}>
              Zahlungspflichtig kaufen
            </button>
          </div>
        ))}
      </div>
      <p className="tk-muted kt-billing-note">
        Abgerechnet wird sekundengenau. Gekaufte Minuten verfallen nicht. Bei {LOW_BALANCE_MINUTES} Restminuten bekommst du
        eine E-Mail.
      </p>

      {purchases.length > 0 && (
        <details className="kt-purchases">
          <summary>Letzte Käufe</summary>
          <ul>
            {purchases.map((e) => (
              <li key={e.id}>
                <span>{formatDate(e.created_at)}</span>
                <span>{e.note || (e.reason === "korrektur" ? "Gutschrift" : "Kauf")}</span>
                <span>+{Math.round(e.delta_seconds / 60)} Min.</span>
                <span>{e.amount_net != null ? `${euro(Number(e.amount_net))} netto` : "–"}</span>
              </li>
            ))}
          </ul>
        </details>
      )}
    </section>
  );
}
