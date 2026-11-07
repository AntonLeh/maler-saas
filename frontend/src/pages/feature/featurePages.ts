// Inhalte der Funktions-Unterseiten (für Besucher und Google)
// Jede Seite: eigene Adresse, Titel, Beschreibung, Inhalt und häufige Fragen.

export type FeaturePageData = {
  path: string;
  seoTitle: string;
  seoDescription: string;
  badge: string;
  h1: string;
  intro: string[];
  plan: string;
  /** kleine Übersicht rechts neben dem Titel */
  visual: { title: string; rows: { label: string; value: string }[]; chips: string[] };
  highlightsTitle: string;
  highlights: { title: string; text: string }[];
  stepsTitle?: string;
  steps?: { title: string; text: string }[];
  benefitsTitle: string;
  benefits: string[];
  faqs: { q: string; a: string }[];
  related: { href: string; label: string }[];
};

export const FEATURE_PAGES: FeaturePageData[] = [
  {
    path: "/buchhaltung",
    seoTitle: "Buchhaltung für Malerbetriebe – Belege, Umsatzsteuer, DATEV | MalerSaaS",
    seoDescription:
      "Belege per Handy erfassen, KI liest sie aus, Umsatzsteuer-Übersicht mit ELSTER-Kennzahlen, offene Posten und Steuerberater-Paket mit DATEV-Export – Buchhaltung für Malerbetriebe.",
    badge: "Buchhaltung & Steuerberater",
    h1: "Buchhaltung für Malerbetriebe – ohne Schuhkarton voller Belege.",
    intro: [
      "Belege fotografieren, die KI liest Lieferant, Datum, Betrag und Steuer aus. Umsatzsteuer, offene Rechnungen und das Paket für den Steuerberater sind dann nur noch ein Klick.",
      "Alles, was in MalerSaaS an Rechnungen entsteht, fließt automatisch mit ein – doppeltes Abtippen entfällt.",
    ],
    plan: "Buchhaltung ist in allen Tarifen enthalten. Die KI-Belegerkennung gibt es ab dem Tarif Business – und in der kostenlosen Testphase.",
    visual: {
      title: "Umsatzsteuer Oktober",
      rows: [
        { label: "Umsatzsteuer", value: "4.712,30 €" },
        { label: "Vorsteuer aus Belegen", value: "– 1.208,45 €" },
        { label: "An das Finanzamt", value: "3.503,85 €" },
      ],
      chips: ["ELSTER-Kennzahlen", "DATEV-Export", "GoBD"],
    },
    highlightsTitle: "Vier Bereiche – alles an einem Ort",
    highlights: [
      {
        title: "Belege & Ausgaben",
        text: "Eingangsrechnungen und Quittungen per Handykamera oder als PDF erfassen, Kategorie wählen, optional einem Auftrag zuordnen. Die KI liest die wichtigsten Angaben aus, auch Fremdwährungen mit dem EZB-Tageskurs. Doppelt erfasste Belege werden erkannt.",
      },
      {
        title: "Umsatzsteuer",
        text: "Umsatzsteuer minus Vorsteuer je Monat, Quartal oder Jahr – nach Soll oder Ist. Mit den Kennzahlen für die Voranmeldung in ELSTER, in Österreich für die U30 und in der Schweiz für die MWST-Abrechnung (auch Saldosteuersatz).",
      },
      {
        title: "Offene Posten",
        text: "Welche Rechnungen sind offen, welche überfällig? Mit Fälligkeiten, Mahnstufen und einem Klick zum Markieren als bezahlt.",
      },
      {
        title: "Paket für den Steuerberater",
        text: "Eine ZIP-Datei mit allen Rechnungen als PDF, den Belegen, Rechnungsausgangsbuch, Belegliste, Umsatzsteuer-Übersicht und – in Deutschland – dem Buchungsstapel im DATEV-Format (SKR03 oder SKR04).",
      },
    ],
    stepsTitle: "So läuft der Monat",
    steps: [
      { title: "Beleg fotografieren", text: "Direkt nach dem Einkauf im Großhandel – die KI füllt die Felder aus." },
      { title: "Rechnungen schreiben", text: "Ihre Ausgangsrechnungen landen automatisch in der Buchhaltung." },
      { title: "Monat abschließen", text: "Ein Klick sperrt den Monat – so bleibt alles unverändert und prüfbar." },
      { title: "Paket senden", text: "Steuerberater-Paket herunterladen und weitergeben – fertig." },
    ],
    benefitsTitle: "Darauf können Sie sich verlassen",
    benefits: [
      "Belege werden nicht gelöscht, sondern höchstens als „ungültig“ markiert (Aufbewahrungspflicht).",
      "Abgeschlossene Monate lassen sich nicht mehr ändern.",
      "Ausländische Umsatzsteuer wird nicht als Vorsteuer gezählt.",
      "Für Deutschland, Österreich und die Schweiz.",
    ],
    faqs: [
      {
        q: "Ersetzt MalerSaaS meinen Steuerberater?",
        a: "Nein. MalerSaaS bereitet Ihre Zahlen sauber vor und liefert Ihrem Steuerberater alles in einem Paket – die Steuererklärung und Beratung bleiben bei ihm. Das spart ihm Zeit und Ihnen Kosten.",
      },
      {
        q: "Kann mein Steuerberater die Daten in DATEV einlesen?",
        a: "Ja. Das Paket enthält einen Buchungsstapel im DATEV-Format (EXTF), wahlweise mit Konten nach SKR03 oder SKR04. Die Kontenzuordnung lässt sich anpassen.",
      },
      {
        q: "Wie gut erkennt die KI meine Belege?",
        a: "Sie liest Lieferant, Datum, Beträge, Steuersatz und Währung aus Fotos und PDFs. Sie prüfen die Werte kurz und speichern – bei gemischten Steuersätzen oder ausländischen Belegen weist die App darauf hin.",
      },
    ],
    related: [
      { href: "/rechnungen", label: "Rechnungen & E-Rechnung" },
      { href: "/auswertungen", label: "Auswertungen" },
    ],
  },

  {
    path: "/ki-telefon",
    seoTitle: "KI-Telefonassistent für Malerbetriebe – nie mehr Anrufe verpassen | MalerSaaS",
    seoDescription:
      "Der KI-Telefonassistent nimmt Anrufe an, wenn Sie auf der Baustelle sind: beantwortet Fragen, vergibt Besichtigungstermine direkt in Ihren Kalender und notiert Rückrufwünsche.",
    badge: "KI-Telefonassistent",
    h1: "Kein verpasster Auftrag mehr, weil gerade niemand abheben konnte.",
    intro: [
      "Sie stehen auf der Leiter, das Telefon klingelt – und der Kunde ruft beim nächsten Maler an. Der KI-Telefonassistent nimmt den Anruf freundlich an, beantwortet Fragen zu Ihrem Betrieb und vereinbart gleich einen Besichtigungstermin.",
      "Nach jedem Gespräch bekommen Sie eine Zusammenfassung per E-Mail. Termine stehen direkt im Kalender von MalerSaaS.",
    ],
    plan: "Ab dem Tarif Business. Die Telefonminuten werden dazugebucht, sekundengenau abgerechnet und verfallen nicht.",
    visual: {
      title: "Anruf 10:42 Uhr",
      rows: [
        { label: "Anrufer", value: "Frau Becker" },
        { label: "Anliegen", value: "Wohnzimmer streichen" },
        { label: "Ergebnis", value: "Besichtigung Do., 9:00" },
      ],
      chips: ["Termin eingetragen", "E-Mail gesendet"],
    },
    highlightsTitle: "Was der Assistent am Telefon erledigt",
    highlights: [
      {
        title: "Besichtigungstermine vergeben",
        text: "Er prüft, ob die Adresse in Ihrem Einsatzgebiet liegt, schlägt freie Zeiten vor und trägt den Termin mit Name, Adresse und Telefonnummer direkt in Ihren Kalender ein.",
      },
      {
        title: "Fragen beantworten",
        text: "Leistungen, Einsatzgebiet, Erreichbarkeit – der Assistent antwortet mit dem Wissen, das Sie ihm über Ihren Betrieb mitgeben. Preise oder feste Zusagen nennt er bewusst nicht.",
      },
      {
        title: "Rückrufwünsche notieren",
        text: "Möchte jemand lieber mit Ihnen persönlich sprechen, nimmt er den Rückrufwunsch mit Anliegen und Telefonnummer auf.",
      },
      {
        title: "Nachrichten ausrichten",
        text: "Lieferanten, Kunden oder Mitarbeiter können eine Nachricht hinterlassen – Sie lesen sie in Ruhe nach Feierabend.",
      },
    ],
    stepsTitle: "So richten Sie ihn ein",
    steps: [
      { title: "Einrichtung buchen", text: "Im Bereich „KI-Telefon“ der App – inklusive Startguthaben an Minuten." },
      { title: "Betrieb beschreiben", text: "Begrüßung, Leistungen, Einsatzgebiet und Besichtigungszeiten festlegen." },
      { title: "Nummer erhalten", text: "Sie bekommen eine eigene Telefonnummer für den Assistenten." },
      { title: "Rufumleitung einstellen", text: "Ihre bestehende Firmennummer leitet z. B. weiter, wenn nicht abgenommen wird." },
    ],
    benefitsTitle: "Warum sich das lohnt",
    benefits: [
      "Rund um die Uhr erreichbar – auch abends und am Wochenende.",
      "Ihre Kunden behalten ihre gewohnte Nummer.",
      "Keine Bürokraft nur fürs Telefon nötig.",
      "Jedes Gespräch ist als Zusammenfassung nachvollziehbar.",
    ],
    faqs: [
      {
        q: "Merken die Anrufer, dass sie mit einer KI sprechen?",
        a: "Der Assistent stellt sich ehrlich als digitaler KI-Assistent Ihres Betriebs vor und spricht natürlich und freundlich. Wer lieber mit einem Menschen spricht, kann einen Rückruf bekommen.",
      },
      {
        q: "Kann ich meine bisherige Telefonnummer behalten?",
        a: "Ja. Sie richten bei Ihrem Telefonanbieter eine Rufumleitung ein, z. B. nur dann, wenn Sie nicht abnehmen. So landen nur die verpassten Anrufe beim Assistenten.",
      },
      {
        q: "Was passiert, wenn der Ort außerhalb meines Einsatzgebiets liegt?",
        a: "Dann vereinbart der Assistent keinen Besichtigungstermin, sondern nimmt einen Rückrufwunsch auf – Sie entscheiden selbst.",
      },
    ],
    related: [
      { href: "/firmen-website", label: "Firmen-Website mit Terminbuchung" },
      { href: "/auftragsverwaltung", label: "Aufträge & Planung" },
    ],
  },

  {
    path: "/firmen-website",
    seoTitle: "Website für Malerbetriebe – mit Terminbuchung und Stellenanzeigen | MalerSaaS",
    seoDescription:
      "Eigene Website für Ihren Malerbetrieb mit eigener Domain, Referenzen, Bewertungen, Online-Terminbuchung für Besichtigungen, Stellenanzeigen und KI-Chat – direkt aus MalerSaaS.",
    badge: "Eigene Firmen-Website",
    h1: "Die Website für Ihren Malerbetrieb – direkt aus Ihrer Software.",
    intro: [
      "Ohne Agentur und ohne Baukasten-Frust: Ihre Website entsteht aus den Angaben, die ohnehin in MalerSaaS stehen – Leistungen, Einsatzgebiet, Referenzfotos und Bewertungen.",
      "Besucher buchen Besichtigungstermine online, bewerben sich auf Ihre Stellen oder stellen Fragen an den KI-Chat. Anfragen landen direkt in der App.",
    ],
    plan: "Im Tarif Enterprise enthalten – und in der kostenlosen Testphase zum Ausprobieren.",
    visual: {
      title: "www.ihr-malerbetrieb.de",
      rows: [
        { label: "Online-Termin", value: "Besichtigung gebucht" },
        { label: "Neue Bewerbung", value: "Maler-Geselle" },
        { label: "Anfrage", value: "Fassade, 3 Fotos" },
      ],
      chips: ["Eigene Domain", "Für Google optimiert", "Handy-tauglich"],
    },
    highlightsTitle: "Alles, was eine Handwerker-Website braucht",
    highlights: [
      {
        title: "Online-Terminbuchung",
        text: "Kunden wählen einen freien Besichtigungstermin – er steht sofort in Ihrem Kalender. Ihre Zeiten und die Dauer legen Sie selbst fest.",
      },
      {
        title: "Referenzen & Bewertungen",
        text: "Zeigen Sie Ihre besten Arbeiten mit Fotos. Kundenbewertungen erscheinen nur mit Zustimmung der Kunden.",
      },
      {
        title: "Stellenanzeigen & Bewerbungen",
        text: "„Wir stellen ein“ – Stellen in wenigen Minuten anlegen, Bewerbungen kommen direkt in die App.",
      },
      {
        title: "Anfragen mit Fotos & KI-Chat",
        text: "Interessenten schicken Anfragen mit Fotos. Der KI-Chat beantwortet Fragen rund um die Uhr und führt Interessenten zur Online-Terminbuchung.",
      },
    ],
    stepsTitle: "In vier Schritten online",
    steps: [
      { title: "Design wählen", text: "Farben, Logo und Startbild festlegen." },
      { title: "Texte schreiben", text: "Die KI-Schreibhilfe macht Vorschläge für Ihre Texte." },
      { title: "Veröffentlichen", text: "Sofort unter Ihrer Adresse bei maler-saas.com erreichbar." },
      { title: "Eigene Domain", text: "Optional mit Ihrer eigenen Domain verbinden, z. B. www.ihr-malerbetrieb.de." },
    ],
    benefitsTitle: "Für Google gebaut",
    benefits: [
      "Seiten werden auf dem Server fertig erzeugt – Google sieht sofort den ganzen Inhalt.",
      "Jede Seite hat Titel, Beschreibung und Vorschau für soziale Netzwerke, dazu eine Sitemap.",
      "Strukturierte Daten für Malerbetrieb, Leistungen, häufige Fragen und Stellenanzeigen.",
      "Eine bestimmte Platzierung kann allerdings niemand garantieren.",
    ],
    faqs: [
      {
        q: "Brauche ich Programmierkenntnisse?",
        a: "Nein. Sie füllen Felder aus und laden Fotos hoch – den Rest erledigt MalerSaaS. Änderungen sind sofort online.",
      },
      {
        q: "Kann ich meine bestehende Domain verwenden?",
        a: "Ja. Sie verbinden Ihre Domain mit wenigen Einträgen bei Ihrem Domain-Anbieter; die App zeigt Ihnen genau, welche.",
      },
      {
        q: "Wer kümmert sich um Impressum und Datenschutz?",
        a: "Im Reiter „Rechtliches“ hinterlegen Sie Ihre Angaben; Impressum und Datenschutzhinweise werden auf der Website angezeigt. Für den Inhalt sind Sie als Betrieb verantwortlich.",
      },
    ],
    related: [
      { href: "/ki-telefon", label: "KI-Telefonassistent" },
      { href: "/fachkraefte-finden", label: "Fachkräfte-Pool" },
    ],
  },

  {
    path: "/fachkraefte-finden",
    seoTitle: "Maler und Subunternehmer finden – Fachkräfte-Pool | MalerSaaS",
    seoDescription:
      "Personal fehlt, Auftrag wartet? Im Fachkräfte-Pool von MalerSaaS finden Malerbetriebe Gesellen, Meister, Helfer und Subunternehmer aus ihrer Region.",
    badge: "Fachkräfte-Pool",
    h1: "Maler und Subunternehmer aus Ihrer Region finden.",
    intro: [
      "Ein großer Auftrag kommt rein, aber das Team ist ausgelastet? Im Fachkräfte-Pool tragen sich Maler, Gesellen, Meister, Helfer und Subunternehmer ein, die Arbeit suchen.",
      "Sie suchen nach Ort und Umkreis, sehen Qualifikation und Verfügbarkeit und schicken eine Kontaktanfrage – direkt aus MalerSaaS.",
    ],
    plan: "Im Tarif Enterprise enthalten – und in der kostenlosen Testphase. Für Fachkräfte ist der Eintrag kostenlos.",
    visual: {
      title: "Fachkräfte im Umkreis von 30 km",
      rows: [
        { label: "Malergeselle", value: "verfügbar ab sofort" },
        { label: "Subunternehmer", value: "2 Personen" },
        { label: "Malermeister", value: "Teilzeit" },
      ],
      chips: ["Kontaktanfrage", "Umkreissuche"],
    },
    highlightsTitle: "So funktioniert der Pool",
    highlights: [
      {
        title: "Umkreissuche",
        text: "Fachkräfte in Ihrer Nähe finden – gefiltert nach Rolle wie Geselle, Meister, Helfer, Azubi oder Subunternehmer.",
      },
      {
        title: "Klare Profile",
        text: "Qualifikation, Erfahrung, Einsatzradius und Verfügbarkeit auf einen Blick.",
      },
      {
        title: "Kontaktanfrage",
        text: "Sie schicken eine Anfrage, die Fachkraft entscheidet selbst, ob sie ihre Kontaktdaten freigibt. Das schützt beide Seiten.",
      },
      {
        title: "Auch für Ihre Stellenanzeigen",
        text: "Zusammen mit der Firmen-Website erscheinen Ihre offenen Stellen online und Bewerbungen landen direkt in der App.",
      },
    ],
    benefitsTitle: "Vorteile für Ihren Betrieb",
    benefits: [
      "Schneller Ersatz bei Krankheit oder Auftragsspitzen.",
      "Kein Umweg über teure Personalvermittler.",
      "Datenschutzfreundlich: Kontaktdaten nur mit Zustimmung der Fachkraft.",
    ],
    faqs: [
      {
        q: "Ich suche selbst Arbeit – wie komme ich in den Pool?",
        a: "Ganz einfach und kostenlos unter maler-saas.com/fachkraefte. Sie bestimmen selbst, was in Ihrem Profil steht, und können es jederzeit pausieren oder löschen.",
      },
      {
        q: "Sieht jeder meine Telefonnummer?",
        a: "Nein. Betriebe sehen Ihr Profil ohne Kontaktdaten. Erst wenn Sie eine Anfrage annehmen, erhält der Betrieb Ihre Kontaktdaten.",
      },
    ],
    related: [
      { href: "/fachkraefte", label: "Als Fachkraft eintragen" },
      { href: "/firmen-website", label: "Firmen-Website mit Stellenanzeigen" },
    ],
  },

  {
    path: "/auswertungen",
    seoTitle: "Auswertungen & Kennzahlen für Malerbetriebe – Umsatz, Deckungsbeitrag | MalerSaaS",
    seoDescription:
      "Umsatz, Lohn- und Materialkosten, Deckungsbeitrag pro Auftrag, Top-Kunden und Mitarbeiterleistung: Das Unternehmer-Cockpit von MalerSaaS zeigt, wo Ihr Malerbetrieb steht.",
    badge: "Auswertungen",
    h1: "Wissen, welche Aufträge sich lohnen.",
    intro: [
      "Viele Malerbetriebe merken erst bei der Jahresabrechnung, wo Geld verloren ging. Das Unternehmer-Cockpit von MalerSaaS zeigt es laufend: Umsatz, Lohnkosten, Materialkosten und Deckungsbeitrag – pro Auftrag und für den ganzen Betrieb.",
      "Die Zahlen entstehen automatisch aus Zeiterfassung, Material und Rechnungen. Kein Excel, keine doppelte Pflege.",
    ],
    plan: "Ab dem Tarif Business – und in der kostenlosen Testphase.",
    visual: {
      title: "Unternehmer-Cockpit",
      rows: [
        { label: "Umsatz", value: "184.300 €" },
        { label: "Lohn- & Materialkosten", value: "121.900 €" },
        { label: "Deckungsbeitrag", value: "62.400 €" },
      ],
      chips: ["pro Auftrag", "A/B/C-Kunden"],
    },
    highlightsTitle: "Ihre Zahlen auf einen Blick",
    highlights: [
      {
        title: "Auftragsanalyse",
        text: "Umsatz, Lohnkosten und Deckungsbeitrag für jeden Auftrag – damit Sie künftig genauer kalkulieren.",
      },
      {
        title: "Kundenanalyse",
        text: "Umsatz pro Kunde, Top-10-Kunden, offene Forderungen und Einteilung in A-, B- und C-Kunden.",
      },
      {
        title: "Arbeitsstunden & Material",
        text: "Stunden und Lohnkosten je Mitarbeiter, Materialverbrauch und Materialkosten – und wo die Wirtschaftlichkeit leidet.",
      },
      {
        title: "Leistungsmanagement",
        text: "Faire Leistungsbewertung, Bonusregeln und „Mitarbeiter des Monats“ – motivierend statt kontrollierend.",
      },
    ],
    benefitsTitle: "Was Ihnen das bringt",
    benefits: [
      "Verlustaufträge erkennen, bevor sie sich wiederholen.",
      "Besser kalkulieren – mit echten Zahlen aus Ihren eigenen Aufträgen.",
      "Wissen, welche Kunden sich lohnen.",
      "Grundlage für Gespräche mit Bank und Steuerberater.",
    ],
    faqs: [
      {
        q: "Muss ich dafür extra Daten eingeben?",
        a: "Nein. Die Auswertungen entstehen aus dem, was ohnehin in MalerSaaS erfasst wird: Arbeitszeiten, Material, Angebote und Rechnungen.",
      },
      {
        q: "Wer kann die Auswertungen sehen?",
        a: "Nur Inhaber und Admins. Mitarbeiter sehen keine Umsätze oder Lohnkosten.",
      },
    ],
    related: [
      { href: "/zeiterfassung", label: "Zeiterfassung" },
      { href: "/leistungsbewertung", label: "Leistungsbewertung" },
    ],
  },
];

export const featurePageFor = (path: string) => FEATURE_PAGES.find((p) => p.path === path.replace(/\/+$/, "")) ?? null;
