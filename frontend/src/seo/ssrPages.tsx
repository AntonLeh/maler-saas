// Nur für den Build: rendert die öffentlichen Produktseiten vorab zu fertigem HTML (für Google).
// Wird von seoPrerender.ts geladen – nie im Browser. Klick-Funktionen sind hier leer;
// im Browser übernimmt danach die echte App.
import type { ComponentType } from "react";
import { renderToString } from "react-dom/server";
import MalerSoftwarePage from "../pages/MalerSoftwarePage";
import AufmassAngebotePage from "../pages/AufmassAngebotePage";
import AuftragsverwaltungPage from "../pages/AuftragsverwaltungPage";
import ZeiterfassungPage from "../pages/ZeiterfassungPage";
import MaterialverwaltungPage from "../pages/MaterialverwaltungPage";
import RechnungenPage from "../pages/RechnungenPage";
import KundenportalPage from "../pages/KundenportalPage";
import LeistungsbewertungPage from "../pages/LeistungsbewertungPage";
import FeatureLandingPage from "../pages/feature/FeatureLandingPage";
import { featurePageFor } from "../pages/feature/featurePages";

type AnyProps = Record<string, unknown>;
const noop = () => {};
const handlers = { onRegister: noop, onLogin: noop, onOpenImpressum: noop, onOpenDatenschutz: noop, onOpenAgb: noop };

/** Seite → Komponente; zusätzlich die Quelldatei, um ihre CSS-Datei im Build zu finden */
export const SSR_PAGES: Record<string, { component: ComponentType<AnyProps>; source: string }> = {
  "/maler-software": { component: MalerSoftwarePage as unknown as ComponentType<AnyProps>, source: "src/pages/MalerSoftwarePage.tsx" },
  "/aufmass-angebote": { component: AufmassAngebotePage as unknown as ComponentType<AnyProps>, source: "src/pages/AufmassAngebotePage.tsx" },
  "/auftragsverwaltung": { component: AuftragsverwaltungPage as unknown as ComponentType<AnyProps>, source: "src/pages/AuftragsverwaltungPage.tsx" },
  "/zeiterfassung": { component: ZeiterfassungPage as unknown as ComponentType<AnyProps>, source: "src/pages/ZeiterfassungPage.tsx" },
  "/materialverwaltung": { component: MaterialverwaltungPage as unknown as ComponentType<AnyProps>, source: "src/pages/MaterialverwaltungPage.tsx" },
  "/rechnungen": { component: RechnungenPage as unknown as ComponentType<AnyProps>, source: "src/pages/RechnungenPage.tsx" },
  "/kundenportal": { component: KundenportalPage as unknown as ComponentType<AnyProps>, source: "src/pages/KundenportalPage.tsx" },
  "/leistungsbewertung": { component: LeistungsbewertungPage as unknown as ComponentType<AnyProps>, source: "src/pages/LeistungsbewertungPage.tsx" },
};

/** Fertiges HTML der Seite oder null (dann bleibt es bei Überschrift + Kurztext) */
export function renderPage(path: string): { html: string; source: string | null } | null {
  const known = SSR_PAGES[path];
  if (known) {
    const C = known.component;
    return { html: renderToString(<C {...handlers} />), source: known.source };
  }
  const feature = featurePageFor(path);
  if (feature) return { html: renderToString(<FeatureLandingPage page={feature} {...handlers} />), source: null };
  return null;
}
