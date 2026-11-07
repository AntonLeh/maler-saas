// Auftragsverarbeitungsvertrag (Art. 28 DSGVO) – öffentlich unter /avv,
// wird bei der Registrierung zusammen mit den AGB akzeptiert.
// Bei Änderungen: STAND anpassen und Kunden mind. 30 Tage vorher informieren (§ 12 Abs. 3, Anlage 3 nach § 5 Abs. 2).

import type { ReactNode } from "react";
import "./avv.css";
import { LEGAL_VERSIONS, standText } from "../../lib/legalVersions";

const AVV_STAND = standText(LEGAL_VERSIONS.avv);

type Props = { onBack: () => void };

const Ol = ({ items }: { items: ReactNode[] }) => (
  <ol>
    {items.map((x, i) => (
      <li key={i}>{x}</li>
    ))}
  </ol>
);

export default function AvvPage({ onBack }: Props) {
  return (
    <div className="legal-page avv-page">
      <div className="legal-card">
        <div className="legal-topbar">
          <div>
            <h1 lang="de">Auftrags&shy;verarbeitungs&shy;vertrag</h1>
            <p>nach Art. 28 DSGVO für die Nutzung von MalerSaaS</p>
            <p>
              <strong>Stand: {AVV_STAND}</strong>
            </p>
          </div>
          <div className="avv-actions">
            <button type="button" className="btn btn-secondary" onClick={() => window.print()}>
              Drucken / als PDF speichern
            </button>
            <button type="button" className="btn btn-secondary" onClick={onBack}>
              Zurück
            </button>
          </div>
        </div>

        <section className="legal-section">
          <p>
            Dieser Vertrag regelt, wie MalerSaaS personenbezogene Daten im Auftrag des Kunden verarbeitet. Er ergänzt Abschnitt 13 der{" "}
            <a href="/agb">AGB</a> und wird bei der Registrierung zusammen mit den AGB elektronisch abgeschlossen (Art. 28 Abs. 9 DSGVO).
          </p>
        </section>

        <section className="legal-section">
          <h2>§ 1 Parteien und Gegenstand</h2>
          <Ol
            items={[
              <><strong>Auftraggeber (Verantwortlicher)</strong> ist der Betrieb, der sich bei MalerSaaS registriert und ein Konto führt („Kunde“).</>,
              <><strong>Auftragnehmer (Auftragsverarbeiter)</strong> ist Anton Lehmann, MalerSaaS, C/ Muntanya 63, 07420 Sa Pobla, Spanien, info@maler-saas.com („MalerSaaS“).</>,
              <><strong>Gegenstand</strong> ist die Bereitstellung der Software MalerSaaS (Web-App und PWA) nach dem Hauptvertrag (AGB und gewählter Tarif). Dabei verarbeitet MalerSaaS personenbezogene Daten, die der Kunde und seine Nutzer eingeben, hochladen oder über Zusatzfunktionen erzeugen (z. B. Kundenportal, Firmen-Website, KI-Telefonassistent).</>,
              <>Art und Zweck der Verarbeitung, Datenarten und betroffene Personen stehen in <strong>Anlage 1</strong>.</>,
              <><strong>Laufzeit:</strong> Dieser Vertrag gilt, solange MalerSaaS Daten des Kunden verarbeitet, also bis zur endgültigen Löschung nach § 9.</>,
              <><strong>Abgrenzung:</strong> Daten, die MalerSaaS als eigener Verantwortlicher verarbeitet (z. B. Vertrags- und Abrechnungsdaten des Kunden selbst, Zahlungsabwicklung, Reichweitenmessung der eigenen Website, Fachkräfte-Pool-Einträge), fallen nicht unter diesen Vertrag. Dafür gilt die <a href="/datenschutz">Datenschutzerklärung</a> von MalerSaaS.</>,
            ]}
          />
        </section>

        <section className="legal-section">
          <h2>§ 2 Weisungen</h2>
          <Ol
            items={[
              "MalerSaaS verarbeitet die Daten nur auf dokumentierte Weisung des Kunden. Weisungen sind dieser Vertrag, der Hauptvertrag und die Einstellungen und Aktionen, die der Kunde in MalerSaaS vornimmt (z. B. Anlegen, Ändern, Löschen, Exportieren, E-Mail-Versand).",
              "Weitere Weisungen erteilt der Kunde in Textform an info@maler-saas.com.",
              "Ist MalerSaaS der Ansicht, dass eine Weisung gegen Datenschutzrecht verstößt, weist MalerSaaS den Kunden unverzüglich darauf hin und darf die Ausführung bis zur Klärung aussetzen.",
              "MalerSaaS verwendet die Daten nicht für eigene Zwecke, insbesondere nicht für Werbung und nicht zum Training von KI-Modellen.",
            ]}
          />
        </section>

        <section className="legal-section">
          <h2>§ 3 Vertraulichkeit</h2>
          <p>
            MalerSaaS setzt nur Personen ein, die zur Vertraulichkeit verpflichtet sind oder einer gesetzlichen Verschwiegenheitspflicht unterliegen. Auf Kundendaten wird nur zugegriffen, soweit es für Betrieb, Sicherheit oder Support nötig ist; für Support nur auf Anfrage des Kunden.
          </p>
        </section>

        <section className="legal-section">
          <h2>§ 4 Sicherheit der Verarbeitung</h2>
          <p>
            MalerSaaS trifft die technischen und organisatorischen Maßnahmen nach Art. 32 DSGVO, die in <strong>Anlage 2</strong> beschrieben sind. MalerSaaS darf sie an den Stand der Technik anpassen, solange das Schutzniveau nicht sinkt.
          </p>
        </section>

        <section className="legal-section">
          <h2>§ 5 Unterauftragsverarbeiter</h2>
          <Ol
            items={[
              <>Der Kunde erteilt die allgemeine Genehmigung, Unterauftragsverarbeiter einzusetzen. Die bei Vertragsschluss eingesetzten stehen in <strong>Anlage 3</strong>.</>,
              "MalerSaaS informiert den Kunden mindestens 30 Tage vorher per E-Mail über neue oder ersetzte Unterauftragsverarbeiter. Der Kunde kann innerhalb dieser Frist aus wichtigem datenschutzrechtlichem Grund widersprechen. Kommt keine Einigung zustande, kann der Kunde den Hauptvertrag außerordentlich kündigen.",
              "MalerSaaS verpflichtet jeden Unterauftragsverarbeiter vertraglich auf ein gleichwertiges Datenschutzniveau.",
              "Übermittlungen in Drittländer erfolgen nur mit geeigneten Garantien nach Art. 44 ff. DSGVO, insbesondere EU-US Data Privacy Framework oder EU-Standardvertragsklauseln.",
            ]}
          />
        </section>

        <section className="legal-section">
          <h2>§ 6 Rechte betroffener Personen</h2>
          <p>
            MalerSaaS unterstützt den Kunden bei Anfragen betroffener Personen (Auskunft, Berichtigung, Löschung, Einschränkung, Datenübertragbarkeit, Widerspruch). Die meisten Anfragen kann der Kunde selbst in MalerSaaS erledigen (Bearbeiten, Löschen, Export). Wendet sich eine betroffene Person direkt an MalerSaaS, leitet MalerSaaS die Anfrage an den Kunden weiter.
          </p>
        </section>

        <section className="legal-section">
          <h2>§ 7 Unterstützungspflichten</h2>
          <p>
            MalerSaaS unterstützt den Kunden im angemessenen Umfang bei Datenschutz-Folgenabschätzungen, vorherigen Konsultationen und Pflichten nach Art. 32 bis 36 DSGVO.
          </p>
        </section>

        <section className="legal-section">
          <h2>§ 8 Datenschutzverletzungen</h2>
          <p>
            MalerSaaS meldet dem Kunden eine Verletzung des Schutzes personenbezogener Daten unverzüglich, möglichst innerhalb von 48 Stunden nach Kenntnis, per E-Mail an die im Konto hinterlegte Adresse. Die Meldung enthält die nach Art. 33 Abs. 3 DSGVO verfügbaren Angaben. Die Meldung an die Aufsichtsbehörde und an Betroffene bleibt Aufgabe des Kunden.
          </p>
        </section>

        <section className="legal-section">
          <h2>§ 9 Löschung und Rückgabe</h2>
          <Ol
            items={[
              "Der Kunde kann seine Daten während der Laufzeit jederzeit selbst exportieren („Alle Daten exportieren“: ZIP mit Rechnungen als PDF, Belegen und Listen als CSV).",
              "Nach Ende der Testphase ohne Buchung oder nach Vertragsende löscht MalerSaaS alle Daten des Kunden nach 30 Tagen endgültig (AGB Abschnitt 21). 7 Tage vorher erhält der Kunde eine Erinnerung per E-Mail. Auf Wunsch wird früher gelöscht.",
              "Gesetzliche Aufbewahrungspflichten (z. B. für Rechnungen und Belege) erfüllt der Kunde selbst; dafür exportiert er die Daten vor der Löschung.",
              "In Datensicherungen der Dienstleister können Daten bis zu deren regulärem Ablauf weiter vorhanden sein; sie werden nicht wiederhergestellt oder anders genutzt.",
            ]}
          />
        </section>

        <section className="legal-section">
          <h2>§ 10 Nachweise und Kontrollen</h2>
          <p>
            MalerSaaS stellt dem Kunden auf Anfrage die Informationen bereit, die zum Nachweis der Pflichten aus diesem Vertrag nötig sind (z. B. diesen Vertrag, die technischen und organisatorischen Maßnahmen, die Verträge und Zertifikate der Unterauftragsverarbeiter). Kontrollen vor Ort sind nach Anmeldung mit angemessener Frist (in der Regel 30 Tage) während der Geschäftszeiten möglich; Kosten trägt der Kunde, außer die Kontrolle deckt einen Verstoß von MalerSaaS auf.
          </p>
        </section>

        <section className="legal-section">
          <h2>§ 11 Haftung</h2>
          <p>Die Haftung richtet sich nach Art. 82 DSGVO. Im Übrigen gelten die Haftungsregeln des Hauptvertrags (AGB).</p>
        </section>

        <section className="legal-section">
          <h2>§ 12 Schlussbestimmungen</h2>
          <Ol
            items={[
              "Bei Widersprüchen hat dieser Vertrag für die Datenverarbeitung im Auftrag Vorrang vor den AGB.",
              "Sollte eine Bestimmung unwirksam sein, bleibt der Rest wirksam.",
              "Änderungen dieses Vertrags teilt MalerSaaS mindestens 30 Tage vorher per E-Mail mit; Anlage 3 wird nach § 5 Abs. 2 geändert.",
              "Es gilt das Recht, das für den Hauptvertrag gewählt ist.",
            ]}
          />
        </section>

        <section className="legal-section">
          <h2>Anlage 1: Daten, betroffene Personen und Zwecke</h2>
          <p>Verarbeitet wird nur, was der Kunde in MalerSaaS nutzt; nicht genutzte Funktionen erzeugen keine Daten.</p>
          <div className="avv-table-wrap">
            <table className="avv-table">
              <thead>
                <tr>
                  <th>Betroffene Personen</th>
                  <th>Datenarten</th>
                  <th>Zweck / Funktion</th>
                </tr>
              </thead>
              <tbody>
                {[
                  ["Nutzer des Kunden (Inhaber, Projektleiter, Mitarbeiter)", "Name, E-Mail, Telefon, Rolle, Anmeldedaten, interner Stundensatz", "Benutzerkonten, Rechte, Kalkulation"],
                  ["Mitarbeiter des Kunden", "Arbeitszeiten, Pausen, Auftragszuordnung, Leistungsbewertungen, Bonusregeln", "Zeiterfassung, Nachkalkulation, Leistungsbewertung"],
                  ["Kunden des Kunden (Privat- und Firmenkunden)", "Name, Firma, Anschrift, E-Mail, Telefon, USt-IdNr., Rabatte, Notizen", "Kundenverwaltung, Angebote, Aufträge"],
                  ["Kunden des Kunden", "Aufmaße, Angebote, Aufträge, Rechnungen, Mahnungen, Zahlungsstatus, Baustellenfotos", "Auftragsabwicklung, E-Rechnung, Kundenportal, E-Mail-Versand"],
                  ["Anrufer beim KI-Telefonassistenten", "Telefonnummer, Gesprächsinhalt, Zusammenfassung, Termin- und Rückrufwünsche", "Anrufannahme, Terminbuchung"],
                  ["Besucher der Firmen-Website des Kunden", "Kontakt- und Terminanfragen, Bewerbungen, Chatnachrichten", "Firmen-Website, Online-Terminbuchung, Stellenanzeigen"],
                  ["Lieferanten und Geschäftspartner", "Name, Kontaktdaten, Belege, Beträge", "Buchhaltung, Materialverwaltung"],
                ].map((r) => (
                  <tr key={r[0] + r[1]}>
                    {r.map((c) => (
                      <td key={c}>{c}</td>
                    ))}
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
          <p>
            <strong>Art der Verarbeitung:</strong> Erheben, Speichern, Ordnen, Anzeigen, Auswerten, Übermitteln (z. B. E-Mail-Versand im Auftrag), Exportieren und Löschen.
          </p>
          <p>
            <strong>Besondere Kategorien (Art. 9 DSGVO):</strong> werden nicht bewusst verarbeitet. Der Kunde soll keine Gesundheitsdaten o. Ä. in Freitextfelder eintragen.
          </p>
        </section>

        <section className="legal-section">
          <h2>Anlage 2: Technische und organisatorische Maßnahmen</h2>
          <p>Die Daten liegen in einer Supabase-Datenbank in der Region eu-west-1 (Irland); die Rechenzentren betreibt Amazon Web Services.</p>
          <div className="avv-table-wrap">
            <table className="avv-table">
              <thead>
                <tr>
                  <th>Bereich (Art. 32 DSGVO)</th>
                  <th>Maßnahmen bei MalerSaaS</th>
                </tr>
              </thead>
              <tbody>
                {[
                  ["Zutrittskontrolle", "Keine eigenen Server. Rechenzentren der Dienstleister (AWS über Supabase, Vercel) mit Zutrittskontrolle und Zertifizierungen wie ISO 27001 / SOC 2."],
                  ["Zugangskontrolle", "Anmeldung mit E-Mail und Passwort, Passwörter nur als Hash gespeichert; Sitzungen mit zeitlich begrenzten Tokens. Verwaltungszugänge (Supabase, Vercel, GitHub, Stripe) nur durch den Inhaber, geschützt durch starke Passwörter und Zwei-Faktor-Anmeldung."],
                  ["Zugriffskontrolle", "Rollen (Admin, Projektleiter, Mitarbeiter) mit abgestuften Rechten. Mandantentrennung auf Datenbankebene (Row Level Security): jeder Betrieb sieht nur seine eigenen Daten. Geheime Schlüssel nur in Serverfunktionen, nie im Browser."],
                  ["Weitergabekontrolle", "Verschlüsselte Übertragung (HTTPS/TLS) für App, Schnittstellen und E-Mail-Versand. Datenbank und Dateispeicher beim Dienstleister verschlüsselt gespeichert."],
                  ["Eingabekontrolle", "Protokolle der Datenbank- und Serverfunktionen beim Dienstleister; Rechnungen und Belege nach dem Festschreiben gegen Änderung und Löschung gesperrt (GoBD); Versandnachweis für per E-Mail versendete Dokumente."],
                  ["Verfügbarkeitskontrolle", "Tägliche Datensicherung der Datenbank; Begrenzungen gegen Missbrauch (z. B. E-Mail-Versand, Kontaktformular); Export aller Daten durch den Kunden jederzeit möglich."],
                  ["Trennungsgebot", "Mandantentrennung per Firmen-Kennung in jeder Tabelle; getrennte Test- und Produktivumgebung."],
                  ["Auftragskontrolle", "Auftragsverarbeitungsverträge mit allen Unterauftragsverarbeitern (Anlage 3); kein Zugriff auf Kundendaten ohne Anlass."],
                  ["Datenschutzfreundliche Voreinstellungen", "Keine Werbetracker; Reichweitenmessung nur für die öffentliche Website, ohne angemeldete Nutzer; Löschung 30 Tage nach Vertragsende."],
                  ["Überprüfung", "Regelmäßige Aktualisierung von Abhängigkeiten und Sicherheitsprüfungen des Codes; Anpassung dieser Maßnahmen bei Änderungen."],
                ].map((r) => (
                  <tr key={r[0]}>
                    <th scope="row">{r[0]}</th>
                    <td>{r[1]}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </section>

        <section className="legal-section">
          <h2>Anlage 3: Unterauftragsverarbeiter</h2>
          <p>
            Stripe ist nicht aufgeführt, weil Stripe Zahlungsdaten als eigener Verantwortlicher verarbeitet. Anthropic, ElevenLabs und Twilio werden nur genutzt, wenn der Kunde die jeweilige Funktion verwendet (KI-Belegerkennung, KI-Telefon, Website-Chat, Schreibhilfe).
          </p>
          <div className="avv-table-wrap">
            <table className="avv-table">
              <thead>
                <tr>
                  <th>Dienstleister</th>
                  <th>Leistung</th>
                  <th>Datenstandort</th>
                  <th>Garantie / Vertrag</th>
                </tr>
              </thead>
              <tbody>
                {[
                  ["Supabase (Supabase Inc., USA)", "Datenbank, Anmeldung, Dateispeicher, Serverfunktionen", "Irland (AWS eu-west-1)", "Auftragsverarbeitungsvertrag mit EU-Standardvertragsklauseln"],
                  ["Vercel (Vercel Inc., USA)", "Auslieferung von Website und App, Serverfunktionen", "weltweites Auslieferungsnetz, Serverfunktionen ggf. USA", "Auftragsverarbeitungsvertrag mit EU-Standardvertragsklauseln"],
                  ["Brevo (Sendinblue, Deutschland/Frankreich)", "E-Mail- und SMS-Versand, u. a. Rechnungen im Auftrag des Kunden", "EU", "Datenschutzvereinbarung als Teil der Nutzungsbedingungen"],
                  ["Anthropic (USA)", "KI: Belegerkennung, Hilfe-Chat, Website-Chat, Schreibhilfe", "USA", "Auftragsverarbeitungsvertrag als Teil der Geschäftsbedingungen; keine Nutzung für KI-Training"],
                  ["ElevenLabs (Eleven Labs Inc., USA)", "Sprach-KI des KI-Telefonassistenten", "USA", "Auftragsverarbeitungsvertrag über die Nutzungsbedingungen"],
                  ["Twilio (USA)", "Telefonnummern und Anrufweiterleitung", "USA", "Data Protection Addendum"],
                  ["IONOS (IONOS SE, Deutschland)", "Postfach info@maler-saas.com (Support-E-Mails)", "Deutschland", "Auftragsverarbeitungsvertrag als Teil der AGB"],
                ].map((r) => (
                  <tr key={r[0]}>
                    {r.map((c) => (
                      <td key={c}>{c}</td>
                    ))}
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </section>
      </div>
    </div>
  );
}
