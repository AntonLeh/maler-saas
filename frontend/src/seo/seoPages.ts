// Öffentliche Seiten, für die beim Bauen eine eigene fertige HTML-Datei entsteht (für Google).
// Titel und Beschreibung müssen zu den <SeoMeta>-Angaben der jeweiligen Seite passen.
// Neue öffentliche Seite?  Hier eintragen + in vercel.json (Weiterleitung) + in public/sitemap.xml.
// Die Funktions-Unterseiten (featurePages.ts) kommen automatisch dazu.

import { FEATURE_PAGES } from "../pages/feature/featurePages";

export type SeoPage = {
  path: string;
  title: string;
  description: string;
  h1: string;
  intro: string;
};

const PAGES: SeoPage[] = [
  {
    path: "/maler-software",
    title: "Maler Software & Malerprogramm für Malerbetriebe | MalerSaaS",
    description:
      "Maler Software aus der Cloud: Aufmaß, Angebot, Aufträge, Zeiterfassung und Rechnung in einem Malerprogramm. 14 Tage kostenlos testen – endet automatisch.",
    h1: "Maler Software für Ihren Malerbetrieb",
    intro:
      "MalerSaaS ist die Branchensoftware für Maler und Lackierer: Aufmaß, Angebote, Aufträge, Mitarbeiter, Zeiterfassung, Material und Rechnungen in einem Malerprogramm – im Browser, auf Tablet und Handy.",
  },
  {
    path: "/aufmass-angebote",
    title: "Aufmaß & Angebote für Malerbetriebe | MalerSaaS",
    description:
      "Digitales Aufmaß und Angebote für Malerbetriebe: Maße und Leistungen beim Kunden erfassen, Angebote kalkulieren und direkt in Aufträge überführen.",
    h1: "Aufmaß erfassen und Angebote direkt daraus erstellen",
    intro: "",
  },
  {
    path: "/auftragsverwaltung",
    title: "Auftragsverwaltung für Malerbetriebe | MalerSaaS",
    description:
      "Digitale Auftragsverwaltung für Malerbetriebe: Aufträge organisieren, Mitarbeiter zuweisen, Baustellenfortschritt verfolgen und alle wichtigen Informationen zentral verwalten.",
    h1: "Aufträge planen, Mitarbeiter koordinieren und Fortschritt verfolgen",
    intro: "",
  },
  {
    path: "/zeiterfassung",
    title: "Zeiterfassung für Malerbetriebe | MalerSaaS",
    description:
      "Digitale Zeiterfassung für Malerbetriebe: Arbeitsbeginn, Pausen und Arbeitsende direkt auf dem Auftrag erfassen und Nettozeiten automatisch auswerten.",
    h1: "Arbeitszeiten direkt auf der Baustelle erfassen",
    intro: "",
  },
  {
    path: "/materialverwaltung",
    title: "Materialverwaltung für Malerbetriebe | MalerSaaS",
    description:
      "Digitale Materialverwaltung für Malerbetriebe: Lagerbestand, Mindestbestand, Lieferanten, Lagerorte und Materialverbrauch zentral mit MalerSaaS verwalten.",
    h1: "Material und Lagerbestand zentral verwalten",
    intro: "",
  },
  {
    path: "/rechnungen",
    title: "Rechnungssoftware für Malerbetriebe | MalerSaaS",
    description:
      "Rechnungen für Malerbetriebe digital erstellen und verwalten: Fälligkeiten, Zahlungsstatus, Abschlagsrechnungen, Schlussrechnungen und Rechnungs-PDFs mit MalerSaaS.",
    h1: "Rechnungen erstellen und Zahlungen im Blick behalten",
    intro: "",
  },
  {
    path: "/kundenportal",
    title: "Kundenportal für Malerbetriebe | MalerSaaS",
    description:
      "Digitales Kundenportal für Malerbetriebe: Angebote bestätigen, Projektstatus verfolgen und Baustellenfortschritt mit Bildern transparent für Kunden bereitstellen.",
    h1: "Kunden jederzeit transparent über ihr Projekt informieren",
    intro: "",
  },
  {
    path: "/leistungsbewertung",
    title: "Leistungsbewertung für Malerbetriebe | MalerSaaS",
    description:
      "Mitarbeiterleistung im Malerbetrieb digital auswerten: individuelle Bewertungskriterien, Punktesysteme, Bonusregeln und Mitarbeiter-Rankings mit MalerSaaS.",
    h1: "Mitarbeiterleistung transparent und nachvollziehbar bewerten",
    intro: "",
  },
  {
    path: "/fachkraefte",
    title: "Fachkräfte-Pool für Maler: Arbeit im Malerhandwerk finden | MalerSaaS",
    description:
      "Maler, Helfer und Subunternehmer: Tragen Sie sich kostenlos in den Fachkräfte-Pool ein. Malerbetriebe in Ihrer Nähe finden Sie – Ihre Kontaktdaten erhalten sie nur mit Ihrer Zustimmung.",
    h1: "Arbeit im Malerhandwerk finden – kostenlos",
    intro: "",
  },
];

export const SEO_PAGES: SeoPage[] = [
  ...PAGES,
  ...FEATURE_PAGES.map((p) => ({
    path: p.path,
    title: p.seoTitle,
    description: p.seoDescription,
    h1: p.h1,
    intro: p.intro[0] ?? "",
  })),
];
