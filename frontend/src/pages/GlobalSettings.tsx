import { bicError, ibanError } from "../lib/bankCheck";
import { CountryHint } from "../modules/land/CountryHint";
import { DE_REGIONS } from "../modules/urlaub/logic";
import { useEffect, useState } from "react";
import { supabase } from "../lib/supabase";
import { showConfirm } from "../lib/dialogs";
import DataExportSection from "../modules/export/DataExportSection";
import "./gs.css";

type CompanySettings = {
  id: number;
  tenant_id: number;
  invoice_prefix: string | null;
  quote_prefix: string | null;
  currency: string;
  currency_symbol: string | null;
  tax_rate_default: number;
  country?: string | null;
  small_business?: boolean | null;
  labor_share_percent?: number | null;
  holiday_region?: string | null;
  payment_term_days: number;
  partial_payment_term_days: number;
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

const COUNTRY_PRESETS: Record<string, { tax: number; currency: string; symbol: string }> = {
  Deutschland: { tax: 19, currency: "EUR", symbol: "€" },
  Österreich: { tax: 20, currency: "EUR", symbol: "€" },
  Schweiz: { tax: 8.1, currency: "CHF", symbol: "CHF" },
};

/** Freitext aus der Registrierung („Deutschland“, „DE“, „Austria“ …) auf die Auswahl abbilden */
function normalizeCountry(value: unknown): string {
  const v = String(value ?? "").trim().toLowerCase();
  if (["at", "aut", "österreich", "oesterreich", "austria"].includes(v)) return "Österreich";
  if (["ch", "che", "schweiz", "switzerland", "suisse", "svizzera"].includes(v)) return "Schweiz";
  return "Deutschland";
}

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
}: 
GlobalSettingsProps) {
  const [settings, setSettings] = useState<CompanySettings | null>(null);
  const [currency, setCurrency] = useState("EUR");
  const [currencySymbol, setCurrencySymbol] = useState("€");
  const [defaultHourlyRate, setDefaultHourlyRate] = useState("0");
  const [defaultInternalHourlyRate, setDefaultInternalHourlyRate] = useState("0");
  const [defaultCustomerHourlyRate, setDefaultCustomerHourlyRate] = useState("0");
  const [defaultSpecialHourlyRate, setDefaultSpecialHourlyRate] = useState("0");
  const [taxRateDefault, setTaxRateDefault] = useState("19");
  const [country, setCountry] = useState("Deutschland");
  const [holidayRegion, setHolidayRegion] = useState("");
  const [smallBusiness, setSmallBusiness] = useState(false);
  const [laborShare, setLaborShare] = useState("70");
  const [paymentTermDays, setPaymentTermDays] = useState("14");
  const [partialPaymentTermDays, setPartialPaymentTermDays] = useState("14");
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
  const [deletedPositionIds, setDeletedPositionIds] = useState<number[]>([]);
  const [tab, setTab] = useState<"firma" | "steuer" | "preise" | "texte" | "kalender" | "daten">("firma");
  const [dirty, setDirty] = useState(false);

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

setCountry(normalizeCountry(loadedSettings.country));
setSmallBusiness(loadedSettings.small_business === true);
setLaborShare(String(loadedSettings.labor_share_percent ?? 70));
setHolidayRegion(loadedSettings.holiday_region ?? "");
setTaxRateDefault(
  loadedSettings.tax_rate_default !== null &&
    loadedSettings.tax_rate_default !== undefined
    ? String(loadedSettings.tax_rate_default)
    : "19"
);

setPaymentTermDays(
  loadedSettings.payment_term_days !== null &&
    loadedSettings.payment_term_days !== undefined
    ? String(loadedSettings.payment_term_days)
    : "14"
);

setPartialPaymentTermDays(
  loadedSettings.partial_payment_term_days !== null &&
    loadedSettings.partial_payment_term_days !== undefined
    ? String(loadedSettings.partial_payment_term_days)
    : "14"
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
        setCountry("Deutschland");
        setLaborShare("70");
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

const editPosition = (id: number, patch: Partial<AdditionalQuotePosition>) => {
  setAdditionalPositions((prev) => prev.map((p) => (p.id === id ? { ...p, ...patch } : p)));
  setDirty(true);
};

const addPosition = () => {
  setAdditionalPositions((prev) => [...prev, { id: Math.min(0, ...prev.map((x) => x.id)) - 1, tenant_id: tenantId, title: "", description: "", unit: "pauschal", unit_price: 0, is_active: true, created_at: "" }]);
  setDirty(true);
};

const removePosition = async (p: AdditionalQuotePosition) => {
  if (!(await showConfirm(`Zusatzposition „${p.title || "ohne Namen"}“ löschen? Bestehende Angebote bleiben unverändert.`, { danger: true, confirmLabel: "Löschen" }))) return;
  setAdditionalPositions((prev) => prev.filter((x) => x.id !== p.id));
  if (p.id > 0) setDeletedPositionIds((prev) => [...prev, p.id]);
  setDirty(true);
};

/** Zusatzpositionen speichern: ändern, neu anlegen, löschen */
const savePositions = async (): Promise<boolean> => {
  const missing = additionalPositions.find((p) => !p.title.trim());
  if (missing) {
    setTab("preise");
    setErrorMessage("Bitte jeder Zusatzposition eine Bezeichnung geben (oder die leere Position löschen).");
    return false;
  }
  try {
    setSaving(true);
    for (const id of deletedPositionIds) {
      const { error } = await supabase.from("additional_quote_positions").delete().eq("id", id).eq("tenant_id", tenantId);
      if (error) throw error;
    }
    for (const p of additionalPositions) {
      const row = {
        title: p.title.trim(),
        description: (p.description ?? "").trim() || null,
        unit: p.unit || "pauschal",
        unit_price: Number(String(p.unit_price).replace(",", ".")) || 0,
        is_active: p.is_active,
      };
      const { error } =
        p.id > 0
          ? await supabase.from("additional_quote_positions").update(row).eq("id", p.id).eq("tenant_id", tenantId)
          : await supabase.from("additional_quote_positions").insert({ ...row, tenant_id: tenantId });
      if (error) throw error;
    }
    setDeletedPositionIds([]);
    await loadAdditionalPositions();
    return true;
  } catch (err) {
    const error = err as { message?: string };
    console.error("Fehler beim Speichern der Zusatzpositionen:", error);
    setTab("preise");
    setErrorMessage(
      /row-level security|permission/i.test(error?.message ?? "")
        ? "Zusatzpositionen konnten nicht gespeichert werden – dafür fehlt noch das Datenbank-Update (SQL „Zusatzpositionen“)."
        : error?.message || "Zusatzpositionen konnten nicht gespeichert werden."
    );
    return false;
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

    const handleSave = async (): Promise<boolean> => {
  try {
    const {
      data: { session },
    } = await supabase.auth.getSession();


    const bankProblem = ibanError(companyIban) || bicError(companyBic);
    if (bankProblem) {
      setMessage(null);
      setErrorMessage(bankProblem);
      const field = document.getElementById(ibanError(companyIban) ? "companyIban" : "companyBic");
      field?.scrollIntoView({ behavior: "smooth", block: "center" });
      field?.focus();
      return false;
    }

    setSaving(true);
    setErrorMessage(null);
    setMessage(null);

    const hourlyRateValue = Number(defaultHourlyRate);
    const internalHourlyRateValue = Number(defaultInternalHourlyRate);
    const customerHourlyRateValue = Number(defaultCustomerHourlyRate);
    const specialHourlyRateValue = Number(defaultSpecialHourlyRate);
    const taxRateValue = Number(taxRateDefault);
    const paymentTermDaysValue = Number(paymentTermDays);

    if (
  !Number.isInteger(paymentTermDaysValue) ||
  paymentTermDaysValue < 1 ||
  paymentTermDaysValue > 365
) {
  setErrorMessage("Das Zahlungsziel muss zwischen 1 und 365 Tagen liegen.");
  return false;
}

const partialPaymentTermDaysValue = Number(partialPaymentTermDays);

if (
  !Number.isInteger(partialPaymentTermDaysValue) ||
  partialPaymentTermDaysValue < 1 ||
  partialPaymentTermDaysValue > 365
) {
  setErrorMessage(
    "Das Zahlungsziel für Abschlagsrechnungen muss zwischen 1 und 365 Tagen liegen."
  );
  return false;
}

    if (Number.isNaN(hourlyRateValue) || hourlyRateValue < 0) {
      setErrorMessage("Bitte einen gültigen bisherigen Standard-Stundensatz eingeben.");
      return false;
    }

    if (Number.isNaN(specialHourlyRateValue) || specialHourlyRateValue < 0) {
      setErrorMessage("Bitte einen gültigen Sonderleistungs-Stundensatz eingeben.");
      return false;
    }

    if (Number.isNaN(internalHourlyRateValue) || internalHourlyRateValue < 0) {
      setErrorMessage("Bitte einen gültigen internen Standard-Stundensatz eingeben.");
      return false;
    }

    if (Number.isNaN(customerHourlyRateValue) || customerHourlyRateValue < 0) {
      setErrorMessage("Bitte einen gültigen Kunden-Stundensatz eingeben.");
      return false;
    }

    if (Number.isNaN(taxRateValue) || taxRateValue < 0) {
      setErrorMessage("Bitte einen gültigen Standard-Steuersatz eingeben.");
      return false;
    }

    const laborShareValue = Number(String(laborShare).replace(",", "."));
    if (Number.isNaN(laborShareValue) || laborShareValue < 0 || laborShareValue > 100) {
      setErrorMessage("Der Lohnanteil muss zwischen 0 und 100 % liegen.");
      return false;
    }

    const payload = {
      tenant_id: tenantId,
      currency: currency.trim() || "EUR",
      currency_symbol: currencySymbol.trim() || "€",
      default_hourly_rate: hourlyRateValue,
      default_internal_hourly_rate: internalHourlyRateValue,
      default_customer_hourly_rate: customerHourlyRateValue,
      default_special_hourly_rate: specialHourlyRateValue,
      tax_rate_default: smallBusiness ? 0 : taxRateValue,
      // Kleinunternehmer – erst nach dem Update „Kleinunternehmer“ vorhanden, vorher weglassen
      ...(smallBusiness || (settings && "small_business" in settings) ? { small_business: smallBusiness } : {}),
      country,
      // erst nach dem Datenbank-Update vorhanden
      ...(settings && "labor_share_percent" in settings ? { labor_share_percent: laborShareValue } : {}),
      ...(settings && "holiday_region" in settings ? { holiday_region: country === "Deutschland" ? holidayRegion || null : null } : {}),
      payment_term_days: paymentTermDaysValue,
      partial_payment_term_days: partialPaymentTermDaysValue,
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
    setCountry(normalizeCountry(savedSettings.country));
    setSmallBusiness(savedSettings.small_business === true);
    setLaborShare(String(savedSettings.labor_share_percent ?? 70));
    setHolidayRegion(savedSettings.holiday_region ?? "");

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
    return true;
  } catch (error: any) {
    console.error("Fehler beim Speichern der Einstellungen:", error);
    setErrorMessage(
      error?.message || "Die Einstellungen konnten nicht gespeichert werden."
    );
    return false;
  } finally {
    setSaving(false);
  }
};

  // ---------- Reiter, ein Speichern-Knopf, Warnung bei ungespeicherten Änderungen ----------
  useEffect(() => {
    if (!dirty) return;
    const warn = (e: BeforeUnloadEvent) => e.preventDefault();
    window.addEventListener("beforeunload", warn);
    return () => window.removeEventListener("beforeunload", warn);
  }, [dirty]);

  const saveAll = async () => {
    if (ibanError(companyIban) || bicError(companyBic)) {
      setTab("steuer");
      setMessage(null);
      setErrorMessage(ibanError(companyIban) || bicError(companyBic));
      return;
    }
    const ok = await handleSave();
    if (!ok) return;
    const posOk = await savePositions();
    if (posOk) {
      setDirty(false);
      setMessage("Alle Einstellungen wurden gespeichert.");
    }
  };

  const leave = async () => {
    if (dirty && !(await showConfirm("Sie haben ungespeicherte Änderungen. Seite trotzdem verlassen?", { confirmLabel: "Verlassen", cancelLabel: "Zurück" }))) return;
    onBack();
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

  const preset = COUNTRY_PRESETS[country];
  const TABS: { id: SettingsTab; label: string }[] = [
    { id: "firma", label: "Firma" },
    { id: "steuer", label: "Steuer & Zahlung" },
    { id: "preise", label: "Preise & Kalkulation" },
    { id: "texte", label: "Angebotstexte" },
    { id: "kalender", label: "Kalender & Urlaub" },
    { id: "daten", label: "Daten" },
  ];

  return (
    <section className="single-page-section gs-root">
      <div className="card">
        <div className="page-topbar">
          <div>
            <h2>Einstellungen</h2>
            <p>Firmendaten, Steuer, Preise und Vorgaben für Angebote und Rechnungen.</p>
          </div>
          <button type="button" className="btn btn-secondary" onClick={leave}>
            Zurück zum Dashboard
          </button>
        </div>

        {settings && <CountryHint settings={settings} />}
        {message && !dirty && <div className="success-message">{message}</div>}
        {errorMessage && <div className="error-message">{errorMessage}</div>}

        <nav className="gs-tabs" aria-label="Bereiche der Einstellungen">
          {TABS.map((t) => (
            <button key={t.id} type="button" className={tab === t.id ? "on" : ""} onClick={() => setTab(t.id)}>
              {t.label}
            </button>
          ))}
        </nav>

        <div className="gs-body" onChangeCapture={() => setDirty(true)}>
          {tab === "firma" && (
            <div className="gs-section">
              <p className="gs-lead">Diese Angaben stehen auf Ihren Angeboten und Rechnungen.</p>
              <div className="gs-grid">
                <Field id="companyName" label="Firmenname" wide>
                  <input id="companyName" value={companyName} onChange={(e) => setCompanyName(e.target.value)} placeholder="Malerbetrieb Muster GmbH" />
                </Field>
                <Field id="companyStreet" label="Straße und Hausnummer" wide>
                  <input id="companyStreet" value={companyStreet} onChange={(e) => setCompanyStreet(e.target.value)} />
                </Field>
                <Field id="companyZip" label="PLZ">
                  <input id="companyZip" value={companyZip} onChange={(e) => setCompanyZip(e.target.value)} inputMode="numeric" />
                </Field>
                <Field id="companyCity" label="Ort">
                  <input id="companyCity" value={companyCity} onChange={(e) => setCompanyCity(e.target.value)} />
                </Field>
                <Field id="companyPhone" label="Telefon">
                  <input id="companyPhone" type="tel" value={companyPhone} onChange={(e) => setCompanyPhone(e.target.value)} />
                </Field>
                <Field id="companyEmail" label="E-Mail">
                  <input id="companyEmail" type="email" value={companyEmail} onChange={(e) => setCompanyEmail(e.target.value)} />
                </Field>
                <Field id="companyWebsite" label="Website" wide>
                  <input id="companyWebsite" value={companyWebsite} onChange={(e) => setCompanyWebsite(e.target.value)} placeholder="www.ihre-firma.de" />
                </Field>
                <Field id="companyLogo" label="Firmenlogo" hint="PNG, JPG oder WebP. Erscheint oben auf Angeboten und Rechnungen." wide>
                  <div className="gs-logo">
                    {companyLogoUrl ? <img src={companyLogoUrl} alt="Firmenlogo" /> : <span className="gs-logo-empty">Noch kein Logo</span>}
                    <label className="btn btn-secondary gs-file">
                      {uploadingLogo ? "Wird hochgeladen …" : companyLogoUrl ? "Logo ändern" : "Logo hochladen"}
                      <input
                        id="companyLogo"
                        type="file"
                        accept="image/png,image/jpeg,image/webp"
                        hidden
                        onChange={(e) => {
                          const file = e.target.files?.[0];
                          if (file) {
                            setDirty(true);
                            void handleLogoUpload(file);
                          }
                        }}
                      />
                    </label>
                  </div>
                </Field>
              </div>
            </div>
          )}

          {tab === "steuer" && (
            <div className="gs-section">
              <h3>Land und Mehrwertsteuer</h3>
              <div className="gs-grid">
                <Field id="companyCountry" label="Land des Betriebs" hint="Danach richten sich Währung, Steuersatz und die Pflichthinweise auf Rechnungen.">
                  <select
                    id="companyCountry"
                    value={country}
                    onChange={async (e) => {
                      const next = e.target.value;
                      setCountry(next);
                      const p = COUNTRY_PRESETS[next];
                      if (
                        p &&
                        (await showConfirm(`Steuersatz und Währung für ${next} übernehmen (${p.tax} %, ${p.symbol})?`, {
                          confirmLabel: "Ja, übernehmen",
                          cancelLabel: "Nein",
                        }))
                      ) {
                        if (!smallBusiness) setTaxRateDefault(String(p.tax));
                        setCurrency(p.currency);
                        setCurrencySymbol(p.symbol);
                      }
                    }}
                  >
                    <option value="Deutschland">Deutschland</option>
                    <option value="Österreich">Österreich</option>
                    <option value="Schweiz">Schweiz</option>
                  </select>
                </Field>
                <Field id="taxRateDefault" label="Mehrwertsteuer (%)" hint={preset ? `Üblich in ${country}: ${preset.tax.toLocaleString("de-DE")} %` : undefined}>
                  <input
                    id="taxRateDefault"
                    type="number"
                    step="0.01"
                    min="0"
                    value={smallBusiness ? "0" : taxRateDefault}
                    disabled={smallBusiness}
                    onChange={(e) => setTaxRateDefault(e.target.value)}
                  />
                </Field>
                <div className="gs-field gs-wide">
                  <label className="gs-check">
                    <input
                      type="checkbox"
                      checked={smallBusiness}
                      onChange={(e) => {
                        const on = e.target.checked;
                        setSmallBusiness(on);
                        setTaxRateDefault(on ? "0" : String(COUNTRY_PRESETS[country]?.tax ?? 19));
                      }}
                    />
                    {country === "Schweiz" ? "Nicht MWST-pflichtig (keine Mehrwertsteuer)" : "Kleinunternehmer (keine Umsatzsteuer)"}
                  </label>
                  <small>
                    {country === "Österreich"
                      ? "Kleinunternehmerregelung nach § 6 Abs. 1 Z 27 UStG (Umsatz bis 55.000 € im Jahr)."
                      : country === "Schweiz"
                      ? "Für Betriebe unter 100.000 CHF Jahresumsatz, die nicht im MWST-Register eingetragen sind."
                      : "Kleinunternehmerregelung nach § 19 UStG (Vorjahr bis 25.000 €, laufendes Jahr bis 100.000 €)."}{" "}
                    Angebote und Rechnungen sind dann ohne Steuer und erhalten den Pflichthinweis. Im Zweifel mit dem Steuerberater klären.
                  </small>
                </div>
                <Field id="companyTaxNumber" label="Steuernummer">
                  <input id="companyTaxNumber" value={companyTaxNumber} onChange={(e) => setCompanyTaxNumber(e.target.value)} />
                </Field>
                <Field id="companyVatId" label={country === "Schweiz" ? "MWST-Nummer (UID)" : "USt-IdNr."}>
                  <input id="companyVatId" value={companyVatId} onChange={(e) => setCompanyVatId(e.target.value)} placeholder={country === "Schweiz" ? "CHE-123.456.789 MWST" : country === "Österreich" ? "ATU12345678" : "DE123456789"} />
                </Field>
              </div>
              <details className="gs-advanced">
                <summary>Erweitert: Währung von Hand ändern</summary>
                <div className="gs-grid">
                  <Field id="currency" label="Währungscode">
                    <input id="currency" value={currency} onChange={(e) => setCurrency(e.target.value.toUpperCase())} placeholder="EUR" />
                  </Field>
                  <Field id="currencySymbol" label="Währungssymbol">
                    <input id="currencySymbol" value={currencySymbol} onChange={(e) => setCurrencySymbol(e.target.value)} placeholder="€" />
                  </Field>
                </div>
              </details>

              <h3>Bankverbindung</h3>
              <div className="gs-grid">
                <Field id="companyBankName" label="Bank">
                  <input id="companyBankName" value={companyBankName} onChange={(e) => setCompanyBankName(e.target.value)} />
                </Field>
                <Field id="companyIban" label="IBAN" error={ibanError(companyIban)}>
                  <input id="companyIban" value={companyIban} onChange={(e) => setCompanyIban(e.target.value)} placeholder="DE00 0000 0000 0000 0000 00" />
                </Field>
                <Field id="companyBic" label="BIC" error={bicError(companyBic)}>
                  <input id="companyBic" value={companyBic} onChange={(e) => setCompanyBic(e.target.value)} />
                </Field>
              </div>

              <h3>Zahlungsziele</h3>
              <div className="gs-grid">
                <Field id="paymentTermDays" label="Rechnungen (Tage)">
                  <input id="paymentTermDays" type="number" step="1" min="1" max="365" value={paymentTermDays} onChange={(e) => setPaymentTermDays(e.target.value)} />
                </Field>
                <Field id="partialPaymentTermDays" label="Abschlagsrechnungen (Tage)">
                  <input id="partialPaymentTermDays" type="number" step="1" min="1" max="365" value={partialPaymentTermDays} onChange={(e) => setPartialPaymentTermDays(e.target.value)} />
                </Field>
              </div>
            </div>
          )}

          {tab === "preise" && (
            <div className="gs-section">
              <h3>Stundensätze und Kalkulation</h3>
              <div className="gs-grid">
                <Field id="defaultCustomerHourlyRate" label={`Kunden-Stundensatz (${currencySymbol})`} hint="Was Sie dem Kunden pro Stunde berechnen (Vorschlag in Angeboten und bei Regiearbeiten).">
                  <input id="defaultCustomerHourlyRate" type="number" step="0.01" min="0" value={defaultCustomerHourlyRate} onChange={(e) => setDefaultCustomerHourlyRate(e.target.value)} />
                </Field>
                <Field id="defaultInternalHourlyRate" label={`Interner Stundensatz (${currencySymbol})`} hint="Was Sie eine Arbeitsstunde intern kostet – für Auswertungen und Nachkalkulation.">
                  <input id="defaultInternalHourlyRate" type="number" step="0.01" min="0" value={defaultInternalHourlyRate} onChange={(e) => setDefaultInternalHourlyRate(e.target.value)} />
                </Field>
                <Field
                  id="laborShare"
                  label="Lohnanteil (%)"
                  hint={`Anteil der Arbeitskosten an Ihren Preisen. Daraus schlägt MalerSaaS die geplanten Stunden eines Auftrags vor.${country === "Deutschland" ? " Auf Rechnungen an Privatkunden wird er für den Steuerabzug nach § 35a EStG ausgewiesen." : ""}`}
                >
                  <input id="laborShare" type="number" step="1" min="0" max="100" value={laborShare} onChange={(e) => setLaborShare(e.target.value)} />
                </Field>
              </div>

              <h3>Zusatzpositionen</h3>
              <p className="gs-lead">Fertige Positionen, die Sie im Angebot mit einem Klick hinzufügen – z. B. Anfahrt, Endreinigung, Sondermüll.</p>
              {loadingAdditionalPositions && <p className="gs-muted">Lädt …</p>}
              {additionalPositionsMessage && <p className="gs-muted">{additionalPositionsMessage}</p>}
              <div className="gs-positions">
                {additionalPositions.map((p) => (
                  <div key={p.id} className={`gs-pos${p.is_active ? "" : " off"}`}>
                    <div className="gs-pos-main">
                      <input value={p.title} onChange={(e) => editPosition(p.id, { title: e.target.value })} aria-label="Bezeichnung" placeholder="Bezeichnung" />
                      <input value={p.description ?? ""} onChange={(e) => editPosition(p.id, { description: e.target.value })} aria-label="Beschreibung" placeholder="Beschreibung (freiwillig)" />
                    </div>
                    <select value={p.unit} onChange={(e) => editPosition(p.id, { unit: e.target.value })} aria-label="Einheit">
                      {unitOptions(p.unit).map((u) => (
                        <option key={u} value={u}>
                          {u}
                        </option>
                      ))}
                    </select>
                    <label className="gs-price">
                      <input type="number" step="0.01" min="0" value={p.unit_price} onChange={(e) => editPosition(p.id, { unit_price: e.target.value as unknown as number })} aria-label="Preis" />
                      <span>{currencySymbol}</span>
                    </label>
                    <label className="gs-check small">
                      <input type="checkbox" checked={p.is_active} onChange={(e) => editPosition(p.id, { is_active: e.target.checked })} />
                      aktiv
                    </label>
                    <button type="button" className="gs-del" onClick={() => removePosition(p)} aria-label={`${p.title || "Position"} löschen`} title="Löschen">
                      🗑
                    </button>
                  </div>
                ))}
                {additionalPositions.length === 0 && !loadingAdditionalPositions && <p className="gs-muted">Noch keine Zusatzpositionen.</p>}
                <button type="button" className="btn btn-secondary gs-add" onClick={addPosition}>
                  + Neue Position
                </button>
              </div>
            </div>
          )}

          {tab === "texte" && (
            <div className="gs-section">
              <p className="gs-lead">Diese Texte erscheinen auf jedem neuen Angebot. Im einzelnen Angebot können Sie sie weiterhin anpassen.</p>
              <div className="gs-texts">
                <div>
                  <Field id="quoteIntroText" label="Einleitung (über den Positionen)" wide>
                    <textarea id="quoteIntroText" rows={4} value={quoteIntroText} onChange={(e) => setQuoteIntroText(e.target.value)} placeholder="Vielen Dank für Ihre Anfrage. Gerne bieten wir Ihnen folgende Leistungen an:" />
                  </Field>
                  <Field id="quoteFooterText" label="Schluss (unter den Positionen)" wide>
                    <textarea id="quoteFooterText" rows={4} value={quoteFooterText} onChange={(e) => setQuoteFooterText(e.target.value)} placeholder="Wir freuen uns auf Ihren Auftrag." />
                  </Field>
                  <Field id="quoteTermsText" label="Bedingungen / Hinweise" wide>
                    <textarea id="quoteTermsText" rows={4} value={quoteTermsText} onChange={(e) => setQuoteTermsText(e.target.value)} placeholder="Das Angebot ist 30 Tage gültig." />
                  </Field>
                </div>
                <aside className="gs-preview" aria-label="Vorschau">
                  <small>Vorschau</small>
                  <b>Angebot Nr. 2026-001</b>
                  <p>{quoteIntroText || <i>Einleitung …</i>}</p>
                  <div className="gs-preview-pos">
                    <span>1 · Wände streichen</span>
                    <span>…</span>
                  </div>
                  <p>{quoteFooterText || <i>Schluss …</i>}</p>
                  {quoteTermsText && <p className="gs-preview-terms">{quoteTermsText}</p>}
                </aside>
              </div>
            </div>
          )}

          {tab === "kalender" && (
            <div className="gs-section">
              {country === "Deutschland" ? (
                <div className="gs-grid">
                  <Field
                    id="holidayRegion"
                    label="Bundesland (für Feiertage)"
                    hint={settings && !("holiday_region" in settings) ? "Dafür fehlt noch das Datenbank-Update (SQL „Urlaub“)." : "Feiertage zählen nicht als Urlaubs- oder Arbeitstage (Urlaub & Abwesenheiten, Soll-Stunden)."}
                    wide
                  >
                    <select id="holidayRegion" value={holidayRegion} onChange={(e) => setHolidayRegion(e.target.value)} disabled={!!settings && !("holiday_region" in settings)}>
                      <option value="">Bitte wählen – sonst nur bundesweite Feiertage</option>
                      {DE_REGIONS.map((r) => (
                        <option key={r.code} value={r.code}>
                          {r.label}
                        </option>
                      ))}
                    </select>
                  </Field>
                </div>
              ) : (
                <p className="gs-lead">Für {country} werden die landesweiten gesetzlichen Feiertage verwendet.</p>
              )}
            </div>
          )}

          {tab === "daten" && <DataExportSection tenantId={tenantId} country={country} currencySymbol={currencySymbol} />}
        </div>

        {tab !== "daten" && (
          <div className={`gs-savebar${dirty ? " dirty" : ""}`}>
            <span>{dirty ? "Ungespeicherte Änderungen" : settings?.updated_at ? `Gespeichert · ${new Date(settings.updated_at).toLocaleString("de-DE", { dateStyle: "short", timeStyle: "short" })}` : ""}</span>
            <button type="button" className="btn btn-primary" onClick={saveAll} disabled={saving || uploadingLogo}>
              {saving ? "Speichert …" : "Alles speichern"}
            </button>
          </div>
        )}
      </div>
    </section>
  );
}

type SettingsTab = "firma" | "steuer" | "preise" | "texte" | "kalender" | "daten";

const UNITS = ["pauschal", "Stk", "m²", "m", "lfm", "Std", "kg", "l"];
const unitOptions = (current: string) => (UNITS.includes(current) || !current ? UNITS : [current, ...UNITS]);

function Field({ id, label, hint, error, wide, children }: { id: string; label: string; hint?: string; error?: string | null; wide?: boolean; children: React.ReactNode }) {
  return (
    <div className={`gs-field${wide ? " gs-wide" : ""}`}>
      <label htmlFor={id}>{label}</label>
      {children}
      {error ? <small className="gs-err">{error}</small> : hint ? <small>{hint}</small> : null}
    </div>
  );
}
