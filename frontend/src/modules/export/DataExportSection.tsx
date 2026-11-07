// Einstellungen → „Alle Daten exportieren“
import { useState } from "react";
import { showAlert } from "../../lib/dialogs";
import { loadTaxMethod } from "../belege/api";
import type { Country } from "../belege/types";

const toCountry = (c: string): Country => (/schweiz|^ch$/i.test(c) ? "CH" : /österreich|oesterreich|^at$/i.test(c) ? "AT" : "DE");

export default function DataExportSection(props: { tenantId: number; country: string; currencySymbol: string; compact?: boolean }) {
  const [busy, setBusy] = useState(false);
  const [progress, setProgress] = useState("");

  const run = async () => {
    setBusy(true);
    setProgress("Export wird vorbereitet …");
    try {
      const { exportAllData } = await import("./exportAll");
      const method = await loadTaxMethod(props.tenantId).catch(() => "soll" as const);
      const { fileName, warnings } = await exportAllData({
        tenantId: props.tenantId,
        country: toCountry(props.country),
        method,
        currencySymbol: props.currencySymbol || "€",
        onProgress: setProgress,
      });
      await showAlert(
        `Die Datei „${fileName}“ wurde heruntergeladen.${warnings.length ? `\n\nHinweise:\n• ${warnings.join("\n• ")}` : ""}`,
        { tone: "success", title: "Export fertig" }
      );
    } catch (e) {
      console.error(e);
      await showAlert(e instanceof Error ? e.message : "Der Export ist fehlgeschlagen.", { tone: "error", title: "Das hat nicht geklappt" });
    } finally {
      setBusy(false);
      setProgress("");
    }
  };

  return (
    <div className={props.compact ? undefined : "settings-section"}>
      {!props.compact && <h3>Datenexport</h3>}
      <p style={{ marginTop: 0, color: "#475569", display: props.compact ? "none" : undefined }}>
        Laden Sie alle Daten Ihres Betriebs als ZIP-Datei herunter: Rechnungen (PDF), Belege, Rechnungsausgangsbuch und alle Listen
        (Kunden, Aufträge, Angebote, Zeiten, Website …) als Tabellen für Excel. Sinnvoll als Sicherung – und vor einer Kündigung.
      </p>
      <button type="button" className="btn btn-secondary" onClick={run} disabled={busy}>
        {busy ? "Export läuft …" : "Alle Daten exportieren"}
      </button>
      {busy && progress && <p style={{ marginTop: 8, color: "#64748b" }}>{progress}</p>}
    </div>
  );
}
