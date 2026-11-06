// Kundenart für Rechnungen: Privatkunde (§ 35a-Hinweise) oder Firma, optional § 13b (Bauunternehmen)

import type { CustomerKind } from "../lib/customerKind";

export type CustomerTaxValues = {
  customer_kind?: CustomerKind;
  reverse_charge?: boolean;
  vat_id?: string;
  einvoice_email?: string;
  buyer_reference?: string;
};

export default function CustomerTaxFields({
  kind,
  reverseCharge,
  companyName,
  vatId = "",
  einvoiceEmail = "",
  buyerReference = "",
  onChange,
}: {
  kind: CustomerKind;
  reverseCharge: boolean;
  companyName: string;
  vatId?: string;
  einvoiceEmail?: string;
  buyerReference?: string;
  onChange: (values: CustomerTaxValues) => void;
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
      {effectiveBusiness && (
        <div style={{ marginTop: 12, padding: "10px 12px", border: "1px solid #e2e8f0", borderRadius: 8 }}>
          <strong style={{ display: "block", marginBottom: 4 }}>E-Rechnung (optional)</strong>
          <small style={{ display: "block", color: "#64748b", marginBottom: 8 }}>
            Nur nötig, wenn die Firma eine E-Rechnung verlangt. Die Angaben werden beim Erstellen der Rechnung übernommen.
          </small>
          <label style={{ display: "block", marginTop: 6 }}>USt-IdNr. des Kunden</label>
          <input type="text" value={vatId} placeholder="z. B. DE123456789" onChange={(e) => onChange({ vat_id: e.target.value })} />
          <label style={{ display: "block", marginTop: 6 }}>E-Mail für E-Rechnungen</label>
          <input type="email" value={einvoiceEmail} placeholder="z. B. rechnung@firma.de (leer = normale E-Mail)" onChange={(e) => onChange({ einvoice_email: e.target.value })} />
          <label style={{ display: "block", marginTop: 6 }}>Käuferreferenz / Leitweg-ID</label>
          <input type="text" value={buyerReference} placeholder="nur wenn der Kunde eine vorgibt (Behörden: Leitweg-ID)" onChange={(e) => onChange({ buyer_reference: e.target.value })} />
        </div>
      )}
    </div>
  );
}
