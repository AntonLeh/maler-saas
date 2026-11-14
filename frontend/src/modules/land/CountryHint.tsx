// Gelber Hinweis, wenn Währung oder Steuersatz nicht zum Land des Betriebs passen
import { useEffect, useState } from "react";
import { supabase } from "../../lib/supabase";
import { countryMismatch, normalizeCountry } from "./logic";
import type { CountrySettings } from "./logic";
import "./land.css";

export function CountryHint({ tenantId, settings, onOpenSettings }: { tenantId?: number | null; settings?: CountrySettings | null; onOpenSettings?: () => void }) {
  const [loaded, setLoaded] = useState<CountrySettings | null>(null);
  useEffect(() => {
    if (settings !== undefined || !tenantId) return;
    let cancel = false;
    void supabase
      .from("company_settings")
      .select("country, currency, tax_rate_default, small_business")
      .eq("tenant_id", tenantId)
      .maybeSingle()
      .then(({ data }) => !cancel && setLoaded((data as CountrySettings) ?? null));
    return () => {
      cancel = true;
    };
  }, [tenantId, settings]);
  const s = settings !== undefined ? settings : loaded;
  const issues = countryMismatch(s);
  if (!s || !issues.length) return null;
  return (
    <div className="land-hint" role="status">
      <b>Bitte Land, Währung und Steuersatz prüfen</b>
      <span>
        Für {normalizeCountry(s.country)} passt nicht: {issues.join(", ")}. Bitte in den Einstellungen das richtige Land wählen und einmal speichern – sonst stehen
        falsche Werte auf Angeboten und Rechnungen.
      </span>
      {onOpenSettings && (
        <button type="button" className="btn btn-secondary" onClick={onOpenSettings}>
          Zu den Einstellungen
        </button>
      )}
    </div>
  );
}
