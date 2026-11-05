// Kundenart für Rechnungen: Privatkunde (§ 35a-Hinweise) oder Firma, optional § 13b (Bauunternehmen)

import type { CustomerKind } from "../lib/customerKind";

export default function CustomerTaxFields({
  kind,
  reverseCharge,
  companyName,
  onChange,
}: {
  kind: CustomerKind;
  reverseCharge: boolean;
  companyName: string;
  onChange: (values: { customer_kind?: CustomerKind; reverse_charge?: boolean }) => void;
}) {
  const effectiveBusiness = kind === "business" || (kind === "auto" && companyName.trim() !== "");
  return (
    <div className="form-group">
      <label>Kundenart (für Rechnungen)</label>
      <select
        value={kind}
        onChange={(e) => {
          const next = e.target.value as CustomerKind;
          onChange({ customer_kind: next, ...(next === "private" ? { reverse_charge: false } : {}) });
        }}
      >
        <option value="auto">Automatisch ({companyName.trim() ? "Firma, weil Firmenname eingetragen" : "Privatkunde, weil kein Firmenname"})</option>
        <option value="private">Privatkunde</option>
        <option value="business">Firma / Gewerbe</option>
      </select>
      <small style={{ display: "block", color: "#64748b", marginTop: 4 }}>
        Bei Privatkunden enthält die Rechnung den Lohnanteil (§ 35a EStG) und den Hinweis zur Aufbewahrungspflicht.
      </small>
      {effectiveBusiness && (
        <label style={{ display: "flex", gap: 10, alignItems: "flex-start", justifyContent: "flex-start", marginTop: 10, fontWeight: 400, textAlign: "left" }}>
          <input
            type="checkbox"
            checked={reverseCharge}
            onChange={(e) => onChange({ reverse_charge: e.target.checked })}
            style={{ width: "auto", flex: "none", marginTop: 3 }}
          />
          <span>
            Bauunternehmen – Rechnung ohne Umsatzsteuer (Steuerschuldnerschaft des Leistungsempfängers, § 13b UStG)
            <small style={{ display: "block", color: "#64748b" }}>
              Nur ankreuzen, wenn der Kunde selbst Bauleistungen erbringt (z. B. Generalunternehmer, Bauträger mit eigener Bauleistung). Im Zweifel
              den Steuerberater fragen.
            </small>
          </span>
        </label>
      )}
    </div>
  );
}
