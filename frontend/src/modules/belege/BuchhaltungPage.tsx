import { useState } from "react";
import BelegePage from "./BelegePage";
import UstPage from "./UstPage";
import OffenePostenPage from "./OffenePostenPage";
import "../terminkalender/terminkalender.css";
import "./belege.css";

type Tab = "belege" | "ust" | "op";

/** Buchhaltung (nur Admins): Reiter „Belege & Ausgaben“ und „Umsatzsteuer“ */
export default function BuchhaltungPage(props: {
  tenantId: number;
  country?: string | null;
  aiAllowed: boolean;
  currencySymbol?: string | null;
  onBack: () => void;
  onOpenInvoices?: () => void;
}) {
  const [tab, setTab] = useState<Tab>(() => {
    try {
      const t = sessionStorage.getItem("buchhaltung:tab");
      return t === "ust" || t === "op" ? t : "belege";
    } catch {
      return "belege";
    }
  });
  const open = (t: Tab) => {
    setTab(t);
    try {
      sessionStorage.setItem("buchhaltung:tab", t);
    } catch {
      /* egal */
    }
  };

  return (
    <section className="single-page-section tk-root bl-app">
      <div className="card form-page-card tk-card">
        <div className="page-topbar">
          <div>
            <h1>Buchhaltung</h1>
            <p className="tk-muted">Belege erfassen, Umsatzsteuer und offene Posten im Blick behalten.</p>
          </div>
          <button type="button" className="btn btn-secondary" onClick={props.onBack}>
            Zurück zum Dashboard
          </button>
        </div>

        <div className="tk-segment bl-tabs" role="tablist" aria-label="Bereich">
          <button type="button" role="tab" aria-selected={tab === "belege"} className={tab === "belege" ? "active" : ""} onClick={() => open("belege")}>
            Belege &amp; Ausgaben
          </button>
          <button type="button" role="tab" aria-selected={tab === "ust"} className={tab === "ust" ? "active" : ""} onClick={() => open("ust")}>
            Umsatzsteuer
          </button>
          <button type="button" role="tab" aria-selected={tab === "op"} className={tab === "op" ? "active" : ""} onClick={() => open("op")}>
            Offene Posten
          </button>
        </div>

        {tab === "belege" && <BelegePage {...props} embedded />}
        {tab === "ust" && <UstPage tenantId={props.tenantId} country={props.country} currencySymbol={props.currencySymbol} />}
        {tab === "op" && <OffenePostenPage tenantId={props.tenantId} currencySymbol={props.currencySymbol} onOpenInvoices={props.onOpenInvoices} />}
      </div>
    </section>
  );
}
