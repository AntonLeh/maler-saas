import { useEffect, useState } from "react";
import { supabase } from "../lib/supabase";

type Props = {
  tenantId: number;
  onCompleted: () => void;
};

export default function CompanyOnboardingPage({ tenantId, onCompleted }: Props) {
  const [companyName, setCompanyName] = useState("");
  const [street, setStreet] = useState("");
  const [zip, setZip] = useState("");
  const [city, setCity] = useState("");
  const [country, setCountry] = useState("Deutschland");
  const [phone, setPhone] = useState("");
  const [email, setEmail] = useState("");
  const [website, setWebsite] = useState("");
  const [taxNumber, setTaxNumber] = useState("");
  const [vatId, setVatId] = useState("");
  const [bankName, setBankName] = useState("");
  const [iban, setIban] = useState("");
  const [bic, setBic] = useState("");

  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [message, setMessage] = useState("");

  useEffect(() => {
    const loadSettings = async () => {
      setLoading(true);

      const { data, error } = await supabase
        .from("company_settings")
        .select("*")
        .eq("tenant_id", tenantId)
        .single();

      if (error) {
        setMessage("Firmendaten konnten nicht geladen werden.");
        setLoading(false);
        return;
      }

      setCompanyName(data.company_name ?? "");
      setStreet(data.street ?? "");
      setZip(data.zip ?? "");
      setCity(data.city ?? "");
      setCountry(data.country ?? "Deutschland");
      setPhone(data.phone ?? "");
      setEmail(data.email ?? "");
      setWebsite(data.website ?? "");
      setTaxNumber(data.tax_number ?? "");
      setVatId(data.vat_id ?? "");
      setBankName(data.bank_name ?? "");
      setIban(data.iban ?? "");
      setBic(data.bic ?? "");

      setLoading(false);
    };

    loadSettings();
  }, [tenantId]);

  const handleSave = async (e: React.FormEvent) => {
    e.preventDefault();
    setSaving(true);
    setMessage("");

    const { error: settingsError } = await supabase
      .from("company_settings")
      .update({
        company_name: companyName,
        street,
        zip,
        city,
        country,
        phone,
        email,
        website,
        tax_number: taxNumber,
        vat_id: vatId,
        bank_name: bankName,
        iban,
        bic,
        onboarding_completed: true,
        updated_at: new Date().toISOString(),
      })
      .eq("tenant_id", tenantId);

    const { error: tenantError } = await supabase
      .from("tenants")
      .update({
        company_name: companyName,
        street,
        zip,
        city,
        country,
        phone,
        vat_number: vatId,
        updated_at: new Date().toISOString(),
      })
      .eq("id", tenantId);

    if (settingsError || tenantError) {
  console.error("settingsError:", settingsError);
  console.error("tenantError:", tenantError);
  setMessage("Fehler beim Speichern der Firmendaten. Details siehe Konsole.");
  setSaving(false);
  return;
}

    setSaving(false);
    onCompleted();
  };

  if (loading) {
    return <div className="card">Firmendaten werden geladen...</div>;
  }

  return (
    <div className="auth-wrapper">
      <div className="card" style={{ maxWidth: 760, margin: "40px auto" }}>
        <h1>Willkommen bei MalerSaaS</h1>
        <p>Bitte vervollständige zuerst deine Firmendaten.</p>

        <form onSubmit={handleSave}>
          <h3>Firma</h3>

          <input
            type="text"
            placeholder="Firmenname"
            value={companyName}
            onChange={(e) => setCompanyName(e.target.value)}
            required
          />

          <input
            type="text"
            placeholder="Straße und Hausnummer"
            value={street}
            onChange={(e) => setStreet(e.target.value)}
            required
          />

          <div className="form-row-2">
            <input
              type="text"
              placeholder="PLZ"
              value={zip}
              onChange={(e) => setZip(e.target.value)}
              required
            />

            <input
              type="text"
              placeholder="Ort"
              value={city}
              onChange={(e) => setCity(e.target.value)}
              required
            />
          </div>

          <input
            type="text"
            placeholder="Land"
            value={country}
            onChange={(e) => setCountry(e.target.value)}
          />

          <h3>Kontakt</h3>

          <input
            type="text"
            placeholder="Telefon"
            value={phone}
            onChange={(e) => setPhone(e.target.value)}
          />

          <input
            type="email"
            placeholder="Firmen-E-Mail"
            value={email}
            onChange={(e) => setEmail(e.target.value)}
          />

          <input
            type="text"
            placeholder="Website"
            value={website}
            onChange={(e) => setWebsite(e.target.value)}
          />

          <h3>Steuer & Bank</h3>

          <input
            type="text"
            placeholder="Steuernummer"
            value={taxNumber}
            onChange={(e) => setTaxNumber(e.target.value)}
          />

          <input
            type="text"
            placeholder="USt-ID / VAT-ID"
            value={vatId}
            onChange={(e) => setVatId(e.target.value)}
          />

          <input
            type="text"
            placeholder="Bankname"
            value={bankName}
            onChange={(e) => setBankName(e.target.value)}
          />

          <input
            type="text"
            placeholder="IBAN"
            value={iban}
            onChange={(e) => setIban(e.target.value)}
          />

          <input
            type="text"
            placeholder="BIC"
            value={bic}
            onChange={(e) => setBic(e.target.value)}
          />

          {message && <p style={{ color: "red" }}>{message}</p>}

          <button
            type="submit"
            className="btn"
            disabled={saving}
            style={{ width: "100%", marginTop: 20 }}
          >
            {saving ? "Speichern..." : "Firmendaten speichern und starten"}
          </button>
        </form>
      </div>
    </div>
  );
}