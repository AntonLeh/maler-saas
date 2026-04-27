import { useEffect, useState } from "react";
import { supabase } from "../lib/supabase";

type CompanySettings = {
  id: number;
  tenant_id: number;
  invoice_prefix: string | null;
  quote_prefix: string | null;
  currency: string;
  currency_symbol: string | null;
  tax_rate_default: number;
  default_hourly_rate: number | null;
  default_internal_hourly_rate: number | null;
  default_customer_hourly_rate: number | null;
  default_special_hourly_rate: number | null;
default_material_markup: number | null;

company_name: string | null;
street: string | null;
zip: string | null;
city: string | null;
phone: string | null;
email: string | null;
website: string | null;
tax_number: string | null;
vat_id: string | null;
bank_name: string | null;
iban: string | null;
bic: string | null;

logo_url: string | null;

quote_intro_text: string | null;
quote_footer_text: string | null;
quote_terms_text: string | null;

primary_color: string | null;
created_at: string;
updated_at: string;
};

type AdditionalQuotePosition = {
  id: number;
  tenant_id: number;
  title: string;
  description: string | null;
  unit: string;
  unit_price: number;
  is_active: boolean;
  created_at: string;
};

type GlobalSettingsProps = {
  tenantId: number;
  onBack: () => void;
};

export default function GlobalSettings({
  tenantId,
  onBack,
}: GlobalSettingsProps) {
  const [settings, setSettings] = useState<CompanySettings | null>(null);
  const [currency, setCurrency] = useState("EUR");
  const [currencySymbol, setCurrencySymbol] = useState("€");
  const [defaultHourlyRate, setDefaultHourlyRate] = useState("0");
  const [defaultInternalHourlyRate, setDefaultInternalHourlyRate] = useState("0");
  const [defaultCustomerHourlyRate, setDefaultCustomerHourlyRate] = useState("0");
  const [defaultSpecialHourlyRate, setDefaultSpecialHourlyRate] = useState("0");
  const [taxRateDefault, setTaxRateDefault] = useState("19");
  const [companyName, setCompanyName] = useState("");
  const [companyStreet, setCompanyStreet] = useState("");
  const [companyZip, setCompanyZip] = useState("");
  const [companyCity, setCompanyCity] = useState("");
  const [companyPhone, setCompanyPhone] = useState("");
  const [companyEmail, setCompanyEmail] = useState("");
  const [companyWebsite, setCompanyWebsite] = useState("");
  const [companyTaxNumber, setCompanyTaxNumber] = useState("");
  const [companyVatId, setCompanyVatId] = useState("");
  const [companyBankName, setCompanyBankName] = useState("");
  const [companyIban, setCompanyIban] = useState("");
  const [companyBic, setCompanyBic] = useState("");
  const [companyLogoUrl, setCompanyLogoUrl] = useState("");
  const [uploadingLogo, setUploadingLogo] = useState(false);

  const [quoteIntroText, setQuoteIntroText] = useState("");
  const [quoteFooterText, setQuoteFooterText] = useState("");
  const [quoteTermsText, setQuoteTermsText] = useState("");

  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [message, setMessage] = useState<string | null>(null);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);

  const [additionalPositions, setAdditionalPositions] = useState<AdditionalQuotePosition[]>([]);
  const [loadingAdditionalPositions, setLoadingAdditionalPositions] = useState(false);
  const [additionalPositionsMessage, setAdditionalPositionsMessage] = useState<string | null>(null);

  const loadSettings = async () => {
    try {
      setLoading(true);
      setErrorMessage(null);
      setMessage(null);

      const { data, error } = await supabase
        .from("company_settings")
        .select("*")
        .eq("tenant_id", tenantId)
        .maybeSingle();

      if (error) {
        throw error;
      }

      if (data) {
        const loadedSettings = data as CompanySettings;
        setSettings(loadedSettings);
        setCurrency(loadedSettings.currency || "EUR");
        setCurrencySymbol(loadedSettings.currency_symbol || "€");
       setDefaultHourlyRate(
  loadedSettings.default_hourly_rate !== null &&
    loadedSettings.default_hourly_rate !== undefined
    ? String(loadedSettings.default_hourly_rate)
    : "0"
);

setDefaultInternalHourlyRate(
  loadedSettings.default_internal_hourly_rate !== null &&
    loadedSettings.default_internal_hourly_rate !== undefined
    ? String(loadedSettings.default_internal_hourly_rate)
    : loadedSettings.default_hourly_rate !== null &&
      loadedSettings.default_hourly_rate !== undefined
    ? String(loadedSettings.default_hourly_rate)
    : "0"
);

setDefaultCustomerHourlyRate(
  loadedSettings.default_customer_hourly_rate !== null &&
    loadedSettings.default_customer_hourly_rate !== undefined
    ? String(loadedSettings.default_customer_hourly_rate)
    : loadedSettings.default_hourly_rate !== null &&
      loadedSettings.default_hourly_rate !== undefined
    ? String(loadedSettings.default_hourly_rate)
    : "0"
);

setDefaultSpecialHourlyRate(
  loadedSettings.default_special_hourly_rate !== null &&
    loadedSettings.default_special_hourly_rate !== undefined
    ? String(loadedSettings.default_special_hourly_rate)
    : "0"
);

setTaxRateDefault(
  loadedSettings.tax_rate_default !== null &&
    loadedSettings.tax_rate_default !== undefined
    ? String(loadedSettings.tax_rate_default)
    : "19"
);
setCompanyName(loadedSettings.company_name || "");
setCompanyStreet(loadedSettings.street || "");
setCompanyZip(loadedSettings.zip || "");
setCompanyCity(loadedSettings.city || "");
setCompanyPhone(loadedSettings.phone || "");
setCompanyEmail(loadedSettings.email || "");
setCompanyWebsite(loadedSettings.website || "");
setCompanyTaxNumber(loadedSettings.tax_number || "");
setCompanyVatId(loadedSettings.vat_id || "");
setCompanyBankName(loadedSettings.bank_name || "");
setCompanyIban(loadedSettings.iban || "");
setCompanyBic(loadedSettings.bic || "");
setCompanyLogoUrl(loadedSettings.logo_url || "");
setQuoteIntroText(loadedSettings.quote_intro_text || "");
setQuoteFooterText(loadedSettings.quote_footer_text || "");
setQuoteTermsText(loadedSettings.quote_terms_text || "");
      } else {
        setSettings(null);
        setCurrency("EUR");
        setCurrencySymbol("€");
        setDefaultHourlyRate("0");
        setDefaultInternalHourlyRate("0");
        setDefaultCustomerHourlyRate("0");
        setDefaultSpecialHourlyRate("0");
        setTaxRateDefault("19");
        setCompanyName("");
        setCompanyStreet("");
        setCompanyZip("");
        setCompanyCity("");
        setCompanyPhone("");
        setCompanyEmail("");
        setCompanyWebsite("");
        setCompanyTaxNumber("");
        setCompanyVatId("");
        setCompanyBankName("");
        setCompanyIban("");
        setCompanyBic("");
        setCompanyLogoUrl("");
        setQuoteIntroText("");
        setQuoteFooterText("");
        setQuoteTermsText("");
      }
    } catch (error: any) {
      console.error("Fehler beim Laden der Einstellungen:", error);
      setErrorMessage(
        error?.message || "Die Einstellungen konnten nicht geladen werden."
      );
    } finally {
      setLoading(false);
    }
  };

const loadAdditionalPositions = async () => {
  try {
    setLoadingAdditionalPositions(true);
    setAdditionalPositionsMessage(null);

    const { data, error } = await supabase
      .from("additional_quote_positions")
      .select("*")
      .eq("tenant_id", tenantId)
      .order("title", { ascending: true });

    if (error) throw error;

    setAdditionalPositions((data || []) as AdditionalQuotePosition[]);
  } catch (error: any) {
    console.error("Fehler beim Laden der Zusatzpositionen:", error);
    setAdditionalPositionsMessage(
      error?.message || "Zusatzpositionen konnten nicht geladen werden."
    );
  } finally {
    setLoadingAdditionalPositions(false);
  }
};

const updateAdditionalPositionValue = (
  id: number,
  field: "unit_price" | "is_active",
  value: string | boolean
) => {
  setAdditionalPositions((prev) =>
    prev.map((position) =>
      position.id === id
        ? {
            ...position,
            [field]: value,
          }
        : position
    )
  );
};

const saveAdditionalPositions = async () => {
  try {
    setSaving(true);
    setErrorMessage(null);
    setAdditionalPositionsMessage(null);

    for (const position of additionalPositions) {
      const { error } = await supabase
        .from("additional_quote_positions")
        .update({
          unit_price: Number(position.unit_price) || 0,
          is_active: position.is_active,
        })
        .eq("id", position.id)
        .eq("tenant_id", tenantId);

      if (error) throw error;
    }

    setAdditionalPositionsMessage("Zusatzpositionen wurden gespeichert.");
    await loadAdditionalPositions();
  } catch (error: any) {
    console.error("Fehler beim Speichern der Zusatzpositionen:", error);
    setAdditionalPositionsMessage(
      error?.message || "Zusatzpositionen konnten nicht gespeichert werden."
    );
  } finally {
    setSaving(false);
  }
};

  useEffect(() => {
  if (!tenantId) return;
  loadSettings();
  loadAdditionalPositions();
}, [tenantId]);

const handleLogoUpload = async (file: File) => {
  try {
    setUploadingLogo(true);
    setErrorMessage(null);
    setMessage(null);

    const fileExt = file.name.split(".").pop();
    const fileName = `${tenantId}/logo-${Date.now()}.${fileExt}`;

    const { error: uploadError } = await supabase.storage
      .from("company-logos")
      .upload(fileName, file, {
        cacheControl: "3600",
        upsert: true,
      });

    if (uploadError) {
      throw uploadError;
    }

    const { data } = supabase.storage
      .from("company-logos")
      .getPublicUrl(fileName);

    const publicUrl = data.publicUrl;

    setCompanyLogoUrl(publicUrl);
    setMessage("Logo wurde hochgeladen. Bitte anschließend Einstellungen speichern.");
  } catch (error: any) {
    console.error("Fehler beim Hochladen des Logos:", error);
    setErrorMessage(error?.message || "Logo konnte nicht hochgeladen werden.");
  } finally {
    setUploadingLogo(false);
  }
};

    const handleSave = async () => {
  try {
    const {
      data: { session },
    } = await supabase.auth.getSession();

    console.log("SESSION USER:", session?.user);
    console.log("APP METADATA:", session?.user?.app_metadata);
    console.log("USER METADATA:", session?.user?.user_metadata);

    setSaving(true);
    setErrorMessage(null);
    setMessage(null);

    const hourlyRateValue = Number(defaultHourlyRate);
    const internalHourlyRateValue = Number(defaultInternalHourlyRate);
    const customerHourlyRateValue = Number(defaultCustomerHourlyRate);
    const specialHourlyRateValue = Number(defaultSpecialHourlyRate);
    const taxRateValue = Number(taxRateDefault);

    if (Number.isNaN(hourlyRateValue) || hourlyRateValue < 0) {
      setErrorMessage("Bitte einen gültigen bisherigen Standard-Stundensatz eingeben.");
      return;
    }

    if (Number.isNaN(specialHourlyRateValue) || specialHourlyRateValue < 0) {
      setErrorMessage("Bitte einen gültigen Sonderleistungs-Stundensatz eingeben.");
      return;
    }

    if (Number.isNaN(internalHourlyRateValue) || internalHourlyRateValue < 0) {
      setErrorMessage("Bitte einen gültigen internen Standard-Stundensatz eingeben.");
      return;
    }

    if (Number.isNaN(customerHourlyRateValue) || customerHourlyRateValue < 0) {
      setErrorMessage("Bitte einen gültigen Kunden-Stundensatz eingeben.");
      return;
    }

    if (Number.isNaN(taxRateValue) || taxRateValue < 0) {
      setErrorMessage("Bitte einen gültigen Standard-Steuersatz eingeben.");
      return;
    }

    const payload = {
      tenant_id: tenantId,
      currency: currency.trim() || "EUR",
      currency_symbol: currencySymbol.trim() || "€",
      default_hourly_rate: hourlyRateValue,
      default_internal_hourly_rate: internalHourlyRateValue,
      default_customer_hourly_rate: customerHourlyRateValue,
      default_special_hourly_rate: specialHourlyRateValue,
      tax_rate_default: taxRateValue,
      company_name: companyName.trim(),
      street: companyStreet.trim(),
      zip: companyZip.trim(),
      city: companyCity.trim(),
      phone: companyPhone.trim(),
      email: companyEmail.trim(),
      website: companyWebsite.trim(),
      tax_number: companyTaxNumber.trim(),
      vat_id: companyVatId.trim(),
      bank_name: companyBankName.trim(),
      iban: companyIban.trim(),
      bic: companyBic.trim(),
      logo_url: companyLogoUrl.trim(),
      quote_intro_text: quoteIntroText.trim(),
      quote_footer_text: quoteFooterText.trim(),
      quote_terms_text: quoteTermsText.trim(),
    };

    const { data, error } = await supabase
      .from("company_settings")
      .upsert(payload, { onConflict: "tenant_id" })
      .select()
      .single();

    if (error) throw error;

    const savedSettings = data as CompanySettings;

    setSettings(savedSettings);
    setCurrency(savedSettings.currency || "EUR");
    setCurrencySymbol(savedSettings.currency_symbol || "€");
    setDefaultHourlyRate(String(savedSettings.default_hourly_rate ?? 0));
    setDefaultInternalHourlyRate(
      String(
        savedSettings.default_internal_hourly_rate ??
          savedSettings.default_hourly_rate ??
          0
      )
    );
    setDefaultCustomerHourlyRate(
      String(
        savedSettings.default_customer_hourly_rate ??
          savedSettings.default_hourly_rate ??
          0
      )
    );
    setDefaultSpecialHourlyRate(String(savedSettings.default_special_hourly_rate ?? 0));
    setTaxRateDefault(String(savedSettings.tax_rate_default ?? 19));

    setCompanyName(savedSettings.company_name || "");
    setCompanyStreet(savedSettings.street || "");
    setCompanyZip(savedSettings.zip || "");
    setCompanyCity(savedSettings.city || "");
    setCompanyPhone(savedSettings.phone || "");
    setCompanyEmail(savedSettings.email || "");
    setCompanyWebsite(savedSettings.website || "");
    setCompanyTaxNumber(savedSettings.tax_number || "");
    setCompanyVatId(savedSettings.vat_id || "");
    setCompanyBankName(savedSettings.bank_name || "");
    setCompanyIban(savedSettings.iban || "");
    setCompanyBic(savedSettings.bic || "");
    setCompanyLogoUrl(savedSettings.logo_url || "");
    setQuoteIntroText(savedSettings.quote_intro_text || "");
    setQuoteFooterText(savedSettings.quote_footer_text || "");
    setQuoteTermsText(savedSettings.quote_terms_text || "");
    setMessage("Einstellungen wurden erfolgreich gespeichert.");
  } catch (error: any) {
    console.error("Fehler beim Speichern der Einstellungen:", error);
    setErrorMessage(
      error?.message || "Die Einstellungen konnten nicht gespeichert werden."
    );
  } finally {
    setSaving(false);
  }
};

  if (loading) {
    return (
      <section className="single-page-section">
        <div className="card">
          <h2>Einstellungen</h2>
          <p>Einstellungen werden geladen...</p>
        </div>
      </section>
    );
  }

  return (
    <section className="single-page-section">
      <div className="card">
        <div className="page-topbar">
  <div>
    <h2>Einstellungen</h2>
    <p>Zentrale Vorgaben für Preise, Währung und Standardwerte.</p>
  </div>

  <button
    type="button"
    className="btn btn-secondary"
    onClick={onBack}
  >
    Zurück zum Dashboard
  </button>
</div>

        {message && <div className="success-message">{message}</div>}
        {errorMessage && <div className="error-message">{errorMessage}</div>}

        <div className="settings-section">
          <h3>Preise &amp; Währung</h3>

          <div className="settings-grid">
            <div className="form-group">
              <label htmlFor="currency">Währungscode</label>
              <input
                id="currency"
                type="text"
                value={currency}
                onChange={(e) => setCurrency(e.target.value.toUpperCase())}
                placeholder="z. B. EUR"
              />
            </div>

            <div className="form-group">
              <label htmlFor="currencySymbol">Währungssymbol</label>
              <input
                id="currencySymbol"
                type="text"
                value={currencySymbol}
                onChange={(e) => setCurrencySymbol(e.target.value)}
                placeholder="z. B. €"
              />
            </div>

            <div className="form-group">
  <label htmlFor="defaultHourlyRate">Bisheriger Standard-Stundensatz</label>
  <input
    id="defaultHourlyRate"
    type="number"
    step="0.01"
    min="0"
    value={defaultHourlyRate}
    onChange={(e) => setDefaultHourlyRate(e.target.value)}
    placeholder="0.00"
  />
</div>

<div className="form-group">
  <label htmlFor="defaultInternalHourlyRate">
    Interner Standard-Stundensatz
  </label>
  <input
    id="defaultInternalHourlyRate"
    type="number"
    step="0.01"
    min="0"
    value={defaultInternalHourlyRate}
    onChange={(e) => setDefaultInternalHourlyRate(e.target.value)}
    placeholder="0.00"
  />
</div>

<div className="form-group">
  <label htmlFor="defaultCustomerHourlyRate">
    Kunden-Stundensatz
  </label>
  <input
    id="defaultCustomerHourlyRate"
    type="number"
    step="0.01"
    min="0"
    value={defaultCustomerHourlyRate}
    onChange={(e) => setDefaultCustomerHourlyRate(e.target.value)}
    placeholder="0.00"
  />
</div>

<div className="form-group">
  <label htmlFor="defaultSpecialHourlyRate">
    Sonderleistungs-Stundensatz
  </label>
  <input
    id="defaultSpecialHourlyRate"
    type="number"
    step="0.01"
    min="0"
    value={defaultSpecialHourlyRate}
    onChange={(e) => setDefaultSpecialHourlyRate(e.target.value)}
    placeholder="0.00"
  />
</div>

<div className="form-group">
  <label htmlFor="taxRateDefault">Standard-MwSt (%)</label>
  <input
    id="taxRateDefault"
    type="number"
    step="0.01"
    min="0"
    value={taxRateDefault}
    onChange={(e) => setTaxRateDefault(e.target.value)}
    placeholder="19"
  />
</div>
          </div>

          <div className="settings-actions">
            <button
              type="button"
              className="btn btn-primary"
              onClick={handleSave}
              disabled={saving}
            >
              {saving ? "Speichert..." : "Einstellungen speichern"}
            </button>
          </div>
        </div>

        <h3 style={{ marginTop: "30px" }}>Firmendaten für Angebote</h3>

  <div className="settings-grid">
  <div className="form-group">
    <label htmlFor="companyName">Firmenname</label>
    <input
      id="companyName"
      type="text"
      value={companyName}
      onChange={(e) => setCompanyName(e.target.value)}
      placeholder="z. B. Maler Mustermann GmbH"
    />
  </div>

  <div className="form-group">
    <label htmlFor="companyStreet">Straße</label>
    <input
      id="companyStreet"
      type="text"
      value={companyStreet}
      onChange={(e) => setCompanyStreet(e.target.value)}
      placeholder="Straße und Hausnummer"
    />
  </div>

  <div className="form-group">
    <label htmlFor="companyZip">PLZ</label>
    <input
      id="companyZip"
      type="text"
      value={companyZip}
      onChange={(e) => setCompanyZip(e.target.value)}
      placeholder="PLZ"
    />
  </div>

  <div className="form-group">
    <label htmlFor="companyCity">Ort</label>
    <input
      id="companyCity"
      type="text"
      value={companyCity}
      onChange={(e) => setCompanyCity(e.target.value)}
      placeholder="Ort"
    />
  </div>

  <div className="form-group">
    <label htmlFor="companyPhone">Telefon</label>
    <input
      id="companyPhone"
      type="text"
      value={companyPhone}
      onChange={(e) => setCompanyPhone(e.target.value)}
      placeholder="Telefonnummer"
    />
  </div>

  <div className="form-group">
    <label htmlFor="companyEmail">E-Mail</label>
    <input
      id="companyEmail"
      type="email"
      value={companyEmail}
      onChange={(e) => setCompanyEmail(e.target.value)}
      placeholder="firma@example.com"
    />
  </div>

  <div className="form-group">
    <label htmlFor="companyWebsite">Webseite</label>
    <input
      id="companyWebsite"
      type="text"
      value={companyWebsite}
      onChange={(e) => setCompanyWebsite(e.target.value)}
      placeholder="www.example.com"
    />
  </div>

  <div className="form-group">
    <label htmlFor="companyTaxNumber">Steuernummer</label>
    <input
      id="companyTaxNumber"
      type="text"
      value={companyTaxNumber}
      onChange={(e) => setCompanyTaxNumber(e.target.value)}
      placeholder="Steuernummer"
    />
  </div>

  <div className="form-group">
    <label htmlFor="companyVatId">USt-IdNr. / MwSt-Nr.</label>
    <input
      id="companyVatId"
      type="text"
      value={companyVatId}
      onChange={(e) => setCompanyVatId(e.target.value)}
      placeholder="USt-IdNr. / MwSt-Nr."
    />
  </div>

  <div className="form-group">
    <label htmlFor="companyBankName">Bank</label>
    <input
      id="companyBankName"
      type="text"
      value={companyBankName}
      onChange={(e) => setCompanyBankName(e.target.value)}
      placeholder="Bankname"
    />
  </div>

  <div className="form-group">
    <label htmlFor="companyIban">IBAN</label>
    <input
      id="companyIban"
      type="text"
      value={companyIban}
      onChange={(e) => setCompanyIban(e.target.value)}
      placeholder="IBAN"
    />
  </div>

  <div className="form-group">
    <label htmlFor="companyBic">BIC</label>
    <input
      id="companyBic"
      type="text"
      value={companyBic}
      onChange={(e) => setCompanyBic(e.target.value)}
      placeholder="BIC"
    />
  </div>
  <div className="form-group">
  <label htmlFor="companyLogo">Firmenlogo</label>
  <input
    id="companyLogo"
    type="file"
    accept="image/png,image/jpeg,image/webp"
    onChange={(e) => {
      const file = e.target.files?.[0];

      if (file) {
        handleLogoUpload(file);
      }
    }}
  />

  {uploadingLogo && <p className="info-text">Logo wird hochgeladen...</p>}

  {companyLogoUrl && (
    <div style={{ marginTop: "10px" }}>
      <img
        src={companyLogoUrl}
        alt="Firmenlogo"
        style={{
          maxWidth: "180px",
          maxHeight: "80px",
          objectFit: "contain",
          border: "1px solid #ddd",
          borderRadius: "8px",
          padding: "6px",
          background: "#fff",
        }}
      />
    </div>
  )}
</div>

<div className="form-group" style={{ gridColumn: "1 / -1" }}>
  <label htmlFor="quoteIntroText">Einleitungstext für Angebote</label>
  <textarea
    id="quoteIntroText"
    value={quoteIntroText}
    onChange={(e) => setQuoteIntroText(e.target.value)}
    rows={4}
    placeholder="Vielen Dank für Ihre Anfrage..."
  />
</div>

<div className="form-group" style={{ gridColumn: "1 / -1" }}>
  <label htmlFor="quoteFooterText">Schlusstext für Angebote</label>
  <textarea
    id="quoteFooterText"
    value={quoteFooterText}
    onChange={(e) => setQuoteFooterText(e.target.value)}
    rows={4}
    placeholder="Wir freuen uns auf die Zusammenarbeit..."
  />
</div>

<div className="form-group" style={{ gridColumn: "1 / -1" }}>
  <label htmlFor="quoteTermsText">Bedingungen / Hinweise</label>
  <textarea
    id="quoteTermsText"
    value={quoteTermsText}
    onChange={(e) => setQuoteTermsText(e.target.value)}
    rows={4}
    placeholder="Zahlungsziel 14 Tage netto..."
  />
</div>

</div>

        <div className="settings-section">
  <h3>Zusatzpositionen</h3>
  <p>Diese Positionen kann der Admin später im Angebot hinzufügen, z. B. Sondermüll, Endreinigung oder Anfahrt.</p>

  {loadingAdditionalPositions && (
    <p className="info-text">Zusatzpositionen werden geladen...</p>
  )}

  {additionalPositionsMessage && (
    <p className="info-text">{additionalPositionsMessage}</p>
  )}

  <div className="table-wrapper">
    <table>
      <thead>
        <tr>
          <th>Bezeichnung</th>
          <th>Einheit</th>
          <th>Preis</th>
          <th>Status</th>
        </tr>
      </thead>
      <tbody>
        {additionalPositions.length === 0 ? (
          <tr>
            <td colSpan={4}>Noch keine Zusatzpositionen vorhanden.</td>
          </tr>
        ) : (
          additionalPositions.map((position) => (
            <tr key={position.id}>
              <td>
                <strong>{position.title}</strong>
                {position.description && <div>{position.description}</div>}
              </td>
              <td>{position.unit}</td>
              <td>
  <input
    type="number"
    step="0.01"
    min="0"
    value={position.unit_price}
    onChange={(e) =>
      updateAdditionalPositionValue(
        position.id,
        "unit_price",
        e.target.value
      )
    }
  />{" "}
  {currencySymbol}
</td>

<td>
  <label style={{ display: "flex", gap: "8px", alignItems: "center" }}>
    <input
      type="checkbox"
      checked={position.is_active}
      onChange={(e) =>
        updateAdditionalPositionValue(
          position.id,
          "is_active",
          e.target.checked
        )
      }
    />
    {position.is_active ? "Aktiv" : "Inaktiv"}
  </label>
</td>
            </tr>
          ))
        )}
      </tbody>
    </table>
  </div>
</div>

<div className="settings-actions" style={{ marginTop: "20px" }}>
  <button
    type="button"
    className="btn btn-primary"
    onClick={saveAdditionalPositions}
    disabled={saving}
  >
    {saving ? "Speichert..." : "Zusatzpositionen speichern"}
  </button>
</div>

        <div className="settings-section">
          <h3>Aktuelle Werte</h3>

          <div className="settings-preview">
            <p>
              <strong>Währung:</strong> {currency}
            </p>
            <p>
              <strong>Symbol:</strong> {currencySymbol}
            </p>
            <p>
  <strong>Bisheriger Standard-Stundensatz:</strong> {defaultHourlyRate}
</p>
<p>
  <strong>Interner Standard-Stundensatz:</strong> {defaultInternalHourlyRate}
</p>
<p>
  <strong>Kunden-Stundensatz:</strong> {defaultCustomerHourlyRate}
</p>
<p>
  <strong>Sonderleistungs-Stundensatz:</strong> {defaultSpecialHourlyRate}
</p>
<p>
  <strong>Standard-MwSt:</strong> {taxRateDefault}%
</p>
            <p>
              <strong>Tenant ID:</strong> {tenantId}
            </p>
            {settings?.updated_at && (
              <p>
                <strong>Zuletzt aktualisiert:</strong>{" "}
                {new Date(settings.updated_at).toLocaleString("de-DE")}
              </p>
            )}
          </div>
        </div>
      </div>
    </section>
  );
}