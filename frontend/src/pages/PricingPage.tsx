import React, { useEffect, useState } from "react";
import { showAlert, showConfirm } from "../lib/dialogs";
import { SEAT_MONTHLY, euro, firstYearMonthly, firstYearPrice, monthlyEquivalent, planPriceFor, seatPriceFor, type BillingInterval } from "../lib/prices";
import { loadSeatInfo, saveSeats, type SeatInfo } from "../lib/seats";

type PricingPageProps = {
  currentPlan?: string;
  isTrial?: boolean;
  subscriptionStatus?: string;
  /** aktuelle Abrechnungsart des bezahlten Abos */
  currentInterval?: BillingInterval;
  onBack: () => void;
  onUpgrade?: (plan: string, interval: BillingInterval) => Promise<void>;
  /** für die Zusatzmitarbeiter */
  tenantId?: number | null;
  /** nach einer Änderung der Zusatzplätze (Abo neu laden) */
  onChanged?: () => void;
};

const plans = [
  {
    id: "starter",
    name: "Starter",
    color: "#6b7280",
    features: [
      "3 Mitarbeiter mit App-Zugang inklusive",
      "Kundenverwaltung",
      "Auftragsverwaltung",
      "Angebote & Rechnungen",
      "Buchhaltung: Belege, Umsatzsteuer, offene Posten",
      "E-Rechnung (ZUGFeRD & XRechnung)",
      "Zeiterfassung",
      "PWA App",
      "Fortschrittsnotizen",
      "Basis-Support",
    ],
  },

  {
    id: "professional",
    name: "Professional",
    color: "#2563eb",
    recommended: true,
    features: [
      "6 Mitarbeiter mit App-Zugang inklusive",
      "Alles aus Starter",
      "Kundenportal",
      "Materialverwaltung",
      "Projektleiter",
      "Bilder & Baudokumentation",
      "Premium-Support",
    ],
  },

  {
    id: "business",
    name: "Business",
    color: "#d97706",
    features: [
  "9 Mitarbeiter mit App-Zugang inklusive",
  "Alles aus Professional",
  "KPI & Reports",
  "Erweiterte Auswertungen",
  "Mitarbeiter-Bewertungssystem",
  "Leistungs- & Umsatzstatistiken",
  "KI-Telefonassistent (Minuten zubuchbar)",
  "KI-Belegerkennung",
  "Abschlagsrechnungen",
  "API-Zugriff",
  "Mehr Speicherplatz",
  "Prioritäts-Support",
],
  },

  {
    id: "enterprise",
    name: "Enterprise",
    color: "#7c3aed",
    features: [
  "12 Mitarbeiter mit App-Zugang inklusive",
  "Alles aus Business",
  "Eigene Firmen-Website mit eigener Domain",
  "Online-Terminbuchung für Besichtigungen",
  "Stellenanzeigen & Bewerbungen („Wir stellen ein“)",
  "Fachkräfte-Pool: Maler & Subunternehmer finden",
  "KI-Chatassistent auf der Website",
  "KI-Schreibhilfe für Website-Texte",
  "Individuelle Unternehmensanpassungen",
  "Persönlicher Premium-Support",
],
  },
];

export default function PricingPage({
  currentPlan,
  isTrial = false,
  subscriptionStatus,
  currentInterval = "month",
  onBack,
  onUpgrade,
  tenantId,
  onChanged,
}: PricingPageProps) {
  // Jahrespreise zuerst zeigen; Monatspreise per Umschalter
  const [interval, setInterval] = useState<BillingInterval>("year");
  const order = ["starter", "professional", "business", "enterprise"];
  // Rückmeldung nach dem Klick, bis die Stripe-Seite geladen ist (dauert einige Sekunden)
  const [busyPlan, setBusyPlan] = useState<string | null>(null);
  // Zusatzmitarbeiter
  const [seatInfo, setSeatInfo] = useState<SeatInfo | null>(null);
  const [seatDraft, setSeatDraft] = useState(0);
  const [seatBusy, setSeatBusy] = useState(false);
  useEffect(() => {
    let alive = true;
    loadSeatInfo(tenantId).then((i) => {
      if (!alive) return;
      setSeatInfo(i);
      setSeatDraft(i?.extra_seats ?? 0);
    });
    return () => {
      alive = false;
    };
  }, [tenantId]);
  const isTrialNow = isTrial || subscriptionStatus === "trialing";
  const paidNow = subscriptionStatus === "active" && !isTrialNow;
  const seatInterval: BillingInterval = paidNow ? currentInterval : "month";
  const canEditSeats = !!seatInfo && (isTrialNow || ["active", "past_due"].includes(subscriptionStatus ?? ""));
  const saveSeatDraft = async () => {
    if (!seatInfo || seatDraft === seatInfo.extra_seats) return;
    const diff = seatDraft - seatInfo.extra_seats;
    const each = seatPriceFor(seatInterval);
    const per = seatInterval === "year" ? "Jahr" : "Monat";
    const text = isTrialNow
      ? `${seatDraft} zusätzliche${seatDraft === 1 ? "n" : ""} Mitarbeiter eintragen?\n\nIn der Testphase kostenlos. Wenn Sie einen Tarif buchen, kommen je zusätzlichem Mitarbeiter ${euro(SEAT_MONTHLY)} im Monat dazu (jährlich ${euro(SEAT_MONTHLY * 10)}).`
      : diff > 0
        ? `${diff} weitere${diff === 1 ? "n" : ""} Mitarbeiter mit App-Zugang buchen?\n\nJe ${euro(each)}/${per} netto. ${seatInterval === "year" ? "Der anteilige Betrag bis zum Ende Ihrer Jahreslaufzeit wird sofort abgerechnet." : "Der anteilige Betrag kommt auf die nächste Rechnung."}`
        : `${-diff} zusätzliche${-diff === 1 ? "n" : ""} Mitarbeiter abbestellen?\n\n${seatInterval === "year" ? "Bei jährlicher Zahlung gibt es dafür eine anteilige Gutschrift auf die nächste Rechnung." : "Die anteilige Gutschrift kommt auf die nächste Rechnung."}`;
    if (!(await showConfirm(text, { title: "Zusätzliche Mitarbeiter", confirmLabel: "Ja, speichern" }))) return;
    setSeatBusy(true);
    try {
      await saveSeats(seatDraft);
      const fresh = await loadSeatInfo(tenantId);
      setSeatInfo(fresh);
      setSeatDraft(fresh?.extra_seats ?? seatDraft);
      onChanged?.();
    } catch (e) {
      await showAlert(e instanceof Error ? e.message : String(e), { tone: "error", title: "Das hat nicht geklappt" });
    } finally {
      setSeatBusy(false);
    }
  };
  return (
  <section className="single-page-section">
    <style>{`
      .pricing-interval { display: inline-flex; gap: 4px; padding: 4px; margin: 0 0 18px; border-radius: 999px; background: #eef2f7; border: 1px solid #dbe3ee; }
      .pricing-interval button { border: 0; background: transparent; padding: 9px 18px; border-radius: 999px; font-weight: 700; color: #475569; cursor: pointer; }
      .pricing-interval button.on { background: #fff; color: #0f172a; box-shadow: 0 2px 8px rgba(15, 23, 42, 0.12); }
      .pricing-interval small { margin-left: 6px; font-size: 12px; font-weight: 800; color: #15803d; }
      .pricing-locked { margin: 8px 0 0; font-size: 13px; color: #64748b; line-height: 1.5; }
      .pricing-offer { margin: 0 0 8px; font-size: 0.9rem; font-weight: 700; color: #15803d; }
      .pricing-offer strong { color: #047857; }
      .pricing-was { text-decoration: line-through; color: #94a3b8; font-size: 1rem; font-weight: 600; margin-left: 8px; }
      .pricing-seats { margin-top: 22px; display: grid; gap: 12px; grid-template-columns: 1fr auto; align-items: center; }
      .pricing-seats h2 { margin: 0 0 4px; font-size: 1.1rem; }
      .pricing-seats p { margin: 0; color: #475569; font-size: 0.92rem; line-height: 1.5; }
      .pricing-stepper { display: inline-flex; align-items: center; gap: 8px; }
      .pricing-stepper button.step { width: 38px; height: 38px; border-radius: 10px; border: 1px solid #cbd5e1; background: #fff; font-size: 20px; font-weight: 700; cursor: pointer; }
      .pricing-stepper button.step:disabled { opacity: .4; cursor: default; }
      .pricing-stepper output { min-width: 34px; text-align: center; font-size: 1.2rem; font-weight: 800; }
      @media (max-width: 640px) { .pricing-seats { grid-template-columns: 1fr; } }
    `}</style>
    <div className="page-topbar">
      <div>
        <h1>Preise & Pläne</h1>
        <p>Wählen Sie den passenden Plan für Ihren Betrieb.</p>
      </div>

      <button type="button" className="btn btn-secondary" onClick={onBack}>
        Zurück zum Dashboard
      </button>
    </div>

    <div className="pricing-interval" role="radiogroup" aria-label="Abrechnung">
      <button type="button" role="radio" aria-checked={interval === "month"} className={interval === "month" ? "on" : ""} onClick={() => setInterval("month")}>
        Monatlich
      </button>
      <button type="button" role="radio" aria-checked={interval === "year"} className={interval === "year" ? "on" : ""} onClick={() => setInterval("year")}>
        Jährlich <small>1. Jahr 50 % günstiger</small>
      </button>
    </div>

    <div className="pricing-grid">
      {plans.map((plan) => {
        const isTrialingNow = isTrial || subscriptionStatus === "trialing";
        const isCurrent =
  currentPlan?.toLowerCase() === plan.id &&
  ["active", "trialing"].includes(subscriptionStatus ?? "") &&
  (isTrialingNow || currentInterval === interval);
        const paidYearly = subscriptionStatus === "active" && !isTrialingNow && currentInterval === "year";
        // im Jahresabo nur größerer Tarif, weiterhin jährlich
        const lockedByYear =
          paidYearly && (interval === "month" || order.indexOf(plan.id) <= order.indexOf(currentPlan ?? ""));
        const price = planPriceFor(plan.id, interval);
        // Einführungsrabatt gilt für das erste Jahresabo (nicht für bestehende Jahresabos)
        const showOffer = !paidYearly;
        const isTrialing =
  isTrial || subscriptionStatus === "trialing";

const canActivateCurrentTrialPlan =
  isCurrent && isTrialing;
        return (
          <div
            key={plan.id}
            className={`card pricing-card ${plan.recommended ? "pricing-card-recommended" : ""}`}
            style={{ borderColor: plan.color }}
          >
            {plan.recommended && (
              <div className="pricing-badge">
                EMPFOHLEN
              </div>
            )}

            <h2>{plan.name}</h2>

            <div className="pricing-price" style={{ color: plan.color }}>
              {euro(interval === "year" ? (showOffer ? firstYearMonthly(plan.id) : monthlyEquivalent(plan.id, "year")) : price)}
              <span>/Monat</span>
            </div>
            {interval === "year" && showOffer && (
              <div className="pricing-offer">im 1. Jahr, danach {euro(monthlyEquivalent(plan.id, "year"))}{"\u00a0/\u00a0Monat"}</div>
            )}
            <div style={{ fontSize: "0.85rem", color: "#6b7280", marginTop: "-4px", marginBottom: "8px" }}>
              {interval === "year" ? "jährliche Zahlung, netto" : "monatlich kündbar, netto"}
            </div>

            <div className="pricing-features">
              {plan.features.map((feature) => (
                <div key={feature}>✅ {feature}</div>
              ))}
            </div>

            {isCurrent && !canActivateCurrentTrialPlan ? (
  <button type="button" className="btn btn-secondary" disabled>
    Aktueller Plan
  </button>
) : lockedByYear ? (
  <p className="pricing-locked">Während Ihres Jahresabos ab Laufzeitende möglich – schreiben Sie uns an info@maler-saas.com.</p>
) : (
  <button
  type="button"
  className="btn btn-primary"
  onClick={async () => {
    // Bezahltes Abo: Tarif wird umgestellt (anteilige Verrechnung durch Stripe)
    const paid = subscriptionStatus === "active" && !isTrialing;
    if (paid && currentPlan && (currentPlan !== plan.id || currentInterval !== interval)) {
      const down = order.indexOf(plan.id) < order.indexOf(currentPlan);
      const loseWebsite = currentPlan === "enterprise" && plan.id !== "enterprise";
      const label = `${euro(price)}/${interval === "year" ? "Jahr" : "Monat"} netto`;
      const text =
        `Ihren Tarif auf ${plan.name}${interval === "year" ? " jährlich" : ""} (${label}) umstellen?\n\n` +
        (interval === "year"
          ? `Die Umstellung gilt sofort. Der Jahresbetrag wird abzüglich des bereits bezahlten Anteils sofort abgerechnet. Die Laufzeit beträgt 12 Monate.${currentInterval === "month" ? ` Im ersten Jahresabo gilt der Einführungsrabatt (1. Jahr ${euro(firstYearPrice(plan.id))} statt ${euro(price)}).` : ""}`
          : `Die Umstellung gilt sofort. Die Differenz wird anteilig mit der nächsten Rechnung verrechnet${down ? " (Gutschrift)" : ""}.`) +
        (loseWebsite ? "\n\nAchtung: Firmen-Website, KI-Chat, Online-Terminbuchung, Stellenanzeigen und Fachkräfte-Pool gibt es nur in Enterprise – Ihre Website geht dann offline (die Inhalte bleiben gespeichert)." : "");
      if (!(await showConfirm(text, { title: "Tarif umstellen?", confirmLabel: `Ja, auf ${plan.name} umstellen`, danger: loseWebsite }))) return;
    } else if (interval === "year") {
      const ok = await showConfirm(
        `${plan.name} jährlich buchen: im 1. Jahr ${euro(firstYearPrice(plan.id))} netto für 12 Monate (Einführungsrabatt), im Voraus fällig. Ab dem 2. Jahr ${euro(price)} netto pro Jahr.\n\nDer Vertrag verlängert sich um weitere 12 Monate, wenn er nicht bis zum Ende der Laufzeit gekündigt wird. Bei vorzeitiger Kündigung erfolgt keine anteilige Erstattung.${seatInfo && seatInfo.extra_seats > 0 ? `\n\nDazu ${seatInfo.extra_seats} zusätzliche Mitarbeiter je ${euro(SEAT_MONTHLY * 10)}/Jahr (im 1. Jahr ebenfalls 40 % günstiger).` : ""}`,
        { title: "Jahresabo buchen?", confirmLabel: "Weiter zur Bezahlung" },
      );
      if (!ok) return;
    }
    setBusyPlan(plan.id);
    // nach dem Neuzeichnen starten, damit „Wird geöffnet …“ sofort sichtbar ist
    window.setTimeout(() => {
      Promise.resolve(onUpgrade?.(plan.id, interval)).finally(() => window.setTimeout(() => setBusyPlan(null), 8000));
    }, 0);
  }}
  disabled={busyPlan !== null}
>
  {busyPlan === plan.id
    ? "Wird geöffnet …"
    : canActivateCurrentTrialPlan
      ? `${plan.name} jetzt aktivieren`
      : subscriptionStatus === "active" && !isTrialing && currentPlan && (currentPlan !== plan.id || currentInterval !== interval)
        ? currentPlan === plan.id ? "Auf jährlich umstellen" : `Zu ${plan.name} wechseln`
        : "Plan wählen"}
</button>
)}
          </div>
        );
      })}
    </div>

    {canEditSeats && seatInfo && (
      <div className="card pricing-seats">
        <div>
          <h2>Zusätzliche Mitarbeiter</h2>
          <p>
            Ihr Tarif enthält {seatInfo.base_users} Mitarbeiter mit App-Zugang – Sie als Inhaber zählen nicht mit,
            Subunternehmer und Mitarbeiter ohne App-Zugang auch nicht. Jeder weitere Mitarbeiter mit App-Zugang kostet{" "}
            {euro(SEAT_MONTHLY)} im Monat netto ({euro(SEAT_MONTHLY * 10)} bei jährlicher Zahlung).
            {isTrialNow ? " In der Testphase kostenlos." : ""}
          </p>
          <p style={{ marginTop: 6 }}>
            <strong>
              Belegt: {seatInfo.used} von {seatInfo.base_users + seatInfo.extra_seats}
            </strong>
          </p>
        </div>
        <div style={{ display: "grid", gap: 8, justifyItems: "start" }}>
          <div className="pricing-stepper" aria-label="Anzahl zusätzlicher Mitarbeiter">
            <button type="button" className="step" aria-label="weniger" disabled={seatBusy || seatDraft <= 0} onClick={() => setSeatDraft((n) => Math.max(0, n - 1))}>
              −
            </button>
            <output>{seatDraft}</output>
            <button type="button" className="step" aria-label="mehr" disabled={seatBusy || seatDraft >= 500} onClick={() => setSeatDraft((n) => Math.min(500, n + 1))}>
              +
            </button>
          </div>
          <button type="button" className="btn btn-primary" disabled={seatBusy || seatDraft === seatInfo.extra_seats} onClick={saveSeatDraft}>
            {seatBusy ? "Wird gespeichert …" : "Speichern"}
          </button>
        </div>
      </div>
    )}
  </section>
);
}