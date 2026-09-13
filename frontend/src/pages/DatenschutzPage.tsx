type DatenschutzPageProps = {
  onBack: () => void;
};

export default function DatenschutzPage({
  onBack,
}: DatenschutzPageProps) {
  return (
    <div className="legal-page">
      <div className="legal-card">
        <div className="legal-topbar">
          <div>
            <h1>Datenschutzerklärung</h1>

            <p>
              Informationen über die Verarbeitung personenbezogener
              Daten bei der Nutzung von MalerSaaS.
            </p>

            <p>
              <strong>Stand: 13. September 2026</strong>
            </p>
          </div>

          <button
            type="button"
            className="btn btn-secondary"
            onClick={onBack}
          >
            Zurück
          </button>
        </div>

        <section className="legal-section">
          <h2>1. Verantwortlicher</h2>

          <p>
            Verantwortlicher für die Verarbeitung personenbezogener
            Daten im Zusammenhang mit dem Betrieb der Website und der
            Plattform MalerSaaS ist:
          </p>

          <p>
            Anton Lehmann
            <br />
            C/ Muntanya 63
            <br />
            07420 Sa Pobla
            <br />
            Illes Balears
            <br />
            Spanien
            <br />
            E-Mail:{" "}
            <a href="mailto:info@maler-saas.com">
              info@maler-saas.com
            </a>
          </p>
        </section>

        <section className="legal-section">
          <h2>2. Anwendungsbereich</h2>

          <p>
            Diese Datenschutzerklärung gilt für die öffentliche
            Website von MalerSaaS, die Registrierung, die
            Benutzerkonten, die kostenpflichtigen Abonnements sowie
            die Nutzung aller innerhalb der Plattform angebotenen
            Funktionen.
          </p>

          <p>
            Sie informiert insbesondere Kunden, Interessenten,
            Administratoren, Projektleiter, Mitarbeiter,
            Subunternehmer, Ansprechpartner und Nutzer des
            Kundenportals über die Verarbeitung ihrer
            personenbezogenen Daten.
          </p>
        </section>

        <section className="legal-section">
          <h2>3. Verantwortlichkeit der Malerbetriebe</h2>

          <p>
            Unternehmen, die MalerSaaS einsetzen, können innerhalb der
            Plattform personenbezogene Daten ihrer eigenen Kunden,
            Mitarbeiter, Projektleiter, Subunternehmer und
            Ansprechpartner verarbeiten.
          </p>

          <p>
            Für diese Datenverarbeitungen ist grundsätzlich das
            jeweilige Unternehmen verantwortlich. Es entscheidet,
            welche Daten eingegeben werden und für welche
            betrieblichen Zwecke diese verwendet werden.
          </p>

          <p>
            MalerSaaS verarbeitet diese Daten grundsätzlich als
            Auftragsverarbeiter nach den Weisungen des jeweiligen
            Unternehmens.
          </p>

          <p>
            Betroffene Personen sollten sich bei Fragen zur
            betrieblichen Verarbeitung ihrer Daten zunächst an das
            Unternehmen wenden, das ihre Daten in MalerSaaS
            gespeichert hat.
          </p>
        </section>

        <section className="legal-section">
          <h2>4. Rechtsgrundlagen</h2>

          <p>
            Personenbezogene Daten werden nur verarbeitet, wenn eine
            gesetzliche Rechtsgrundlage besteht.
          </p>

          <p>Je nach Verarbeitung kommen insbesondere infrage:</p>

          <ul>
            <li>
              Artikel 6 Absatz 1 Buchstabe b DSGVO für die Anbahnung,
              Durchführung und Verwaltung eines Vertrags,
            </li>

            <li>
              Artikel 6 Absatz 1 Buchstabe c DSGVO zur Erfüllung
              gesetzlicher Verpflichtungen,
            </li>

            <li>
              Artikel 6 Absatz 1 Buchstabe f DSGVO zur Wahrung
              berechtigter Interessen,
            </li>

            <li>
              Artikel 6 Absatz 1 Buchstabe a DSGVO, wenn eine
              Einwilligung eingeholt wurde,
            </li>

            <li>
              Artikel 28 DSGVO für Verarbeitungen, die MalerSaaS im
              Auftrag seiner Unternehmenskunden durchführt.
            </li>
          </ul>

          <p>
            Berechtigte Interessen können insbesondere im sicheren
            und wirtschaftlichen Betrieb der Plattform, der
            Verhinderung von Missbrauch, der Fehleranalyse, der
            Bearbeitung von Anfragen sowie der Durchsetzung und
            Abwehr rechtlicher Ansprüche liegen.
          </p>
        </section>

        <section className="legal-section">
          <h2>5. Aufruf der öffentlichen Website</h2>

          <p>
            Beim Aufruf der Website können technisch erforderliche
            Verbindungs- und Protokolldaten verarbeitet werden.
          </p>

          <p>Dazu können gehören:</p>

          <ul>
            <li>IP-Adresse,</li>
            <li>Datum und Uhrzeit des Zugriffs,</li>
            <li>aufgerufene Seite oder Datei,</li>
            <li>übertragene Datenmenge,</li>
            <li>Browsertyp und Browserversion,</li>
            <li>Betriebssystem,</li>
            <li>Referrer-URL,</li>
            <li>HTTP-Statuscode,</li>
            <li>technische Fehler- und Sicherheitsinformationen.</li>
          </ul>

          <p>
            Die Verarbeitung erfolgt zur technischen Bereitstellung,
            Stabilität und Sicherheit der Website sowie zur Erkennung
            und Abwehr missbräuchlicher oder rechtswidriger Zugriffe.
          </p>

          <p>
            Rechtsgrundlage ist Artikel 6 Absatz 1 Buchstabe f DSGVO.
          </p>
        </section>

        <section className="legal-section">
          <h2>6. Registrierung und Benutzerkonto</h2>

          <p>
            Bei der Registrierung und Verwaltung eines
            Benutzerkontos können insbesondere folgende Daten
            verarbeitet werden:
          </p>

          <ul>
            <li>Name und Vorname,</li>
            <li>E-Mail-Adresse,</li>
            <li>Unternehmensname,</li>
            <li>Benutzerrolle und Berechtigungen,</li>
            <li>Mandanten- beziehungsweise Unternehmenszuordnung,</li>
            <li>Registrierungs- und Bestätigungsstatus,</li>
            <li>Zeitpunkt der Registrierung und letzter Anmeldung,</li>
            <li>technische Anmelde- und Sicherheitsinformationen.</li>
          </ul>

          <p>
            Diese Daten werden verarbeitet, um das Benutzerkonto
            anzulegen, den Zugang zu schützen, Berechtigungen
            zuzuordnen und die Funktionen von MalerSaaS
            bereitzustellen.
          </p>

          <p>
            Rechtsgrundlage ist Artikel 6 Absatz 1 Buchstabe b DSGVO.
            Sicherheitsmaßnahmen können zusätzlich auf Artikel 6
            Absatz 1 Buchstabe f DSGVO gestützt werden.
          </p>

          <p>
            Passwörter werden nicht im Klartext gespeichert. Die
            Authentifizierung erfolgt über technische
            Authentifizierungsdienste und kryptografisch geschützte
            Verfahren.
          </p>
        </section>

        <section className="legal-section">
          <h2>7. Unternehmens- und Vertragsdaten</h2>

          <p>
            Für die Einrichtung und Verwaltung eines
            Unternehmenskontos können insbesondere verarbeitet
            werden:
          </p>

          <ul>
            <li>Unternehmensname und Geschäftsanschrift,</li>
            <li>Telefonnummer und geschäftliche E-Mail-Adresse,</li>
            <li>Website,</li>
            <li>Steuer- und Umsatzsteuerangaben,</li>
            <li>Bank- und Rechnungsangaben,</li>
            <li>Logo und Unternehmensfarben,</li>
            <li>gebuchter Tarif und Abrechnungsperiode,</li>
            <li>Vertrags-, Zahlungs- und Abonnementstatus.</li>
          </ul>

          <p>
            Die Verarbeitung dient der Durchführung des
            Nutzungsvertrags, der Mandantenverwaltung, der
            Bereitstellung gebuchter Funktionen sowie der Abrechnung.
          </p>

          <p>
            Rechtsgrundlage ist Artikel 6 Absatz 1 Buchstabe b DSGVO.
            Gesetzlich erforderliche Aufbewahrungen erfolgen auf
            Grundlage von Artikel 6 Absatz 1 Buchstabe c DSGVO.
          </p>
        </section>

        <section className="legal-section">
          <h2>8. Kundendaten der Malerbetriebe</h2>

          <p>
            Unternehmenskunden können Daten ihrer eigenen Kunden und
            Ansprechpartner in MalerSaaS speichern.
          </p>

          <p>Dazu können insbesondere gehören:</p>

          <ul>
            <li>Name oder Unternehmensname,</li>
            <li>Anschrift und Objektanschrift,</li>
            <li>Telefonnummer und E-Mail-Adresse,</li>
            <li>Ansprechpartner,</li>
            <li>Rabatte und Konditionen,</li>
            <li>Angebote, Aufträge und Rechnungen,</li>
            <li>Nachrichten und Notizen,</li>
            <li>Bilder und Dokumente,</li>
            <li>Zugänge zum Kundenportal.</li>
          </ul>

          <p>
            Verantwortlicher für die Eingabe und Verwendung dieser
            Daten ist der jeweilige Unternehmenskunde. MalerSaaS
            verarbeitet die Daten zur Bereitstellung der Plattform
            im Auftrag dieses Unternehmens.
          </p>
        </section>

        <section className="legal-section">
          <h2>9. Mitarbeiter- und Benutzerdaten</h2>

          <p>
            Innerhalb von MalerSaaS können Unternehmen Daten ihrer
            Mitarbeiter, Projektleiter und sonstigen Benutzer
            verwalten.
          </p>

          <p>Dazu können insbesondere gehören:</p>

          <ul>
            <li>Name und Kontaktdaten,</li>
            <li>Benutzerrolle und Zugriffsberechtigungen,</li>
            <li>Beschäftigungs- und Tätigkeitsinformationen,</li>
            <li>Auftragszuweisungen,</li>
            <li>Arbeits-, Pausen- und Einsatzzeiten,</li>
            <li>hochgeladene Bilder und Dokumente,</li>
            <li>Materialübergaben und Materialverbräuche,</li>
            <li>Nachrichten,</li>
            <li>Leistungswerte, Punkte und Bonusinformationen.</li>
          </ul>

          <p>
            Das jeweilige Unternehmen ist dafür verantwortlich, dass
            die Verarbeitung arbeitsrechtlich und
            datenschutzrechtlich zulässig ist und die betroffenen
            Personen ordnungsgemäß informiert werden.
          </p>

          <p>
            Soweit erforderlich, muss das Unternehmen betriebliche
            Mitbestimmungsrechte, arbeitsvertragliche Regelungen und
            nationale Vorschriften zur Arbeitszeiterfassung
            beachten.
          </p>
        </section>

        <section className="legal-section">
          <h2>10. Aufträge, Angebote und Besichtigungen</h2>

          <p>
            Bei der Verwaltung von Besichtigungen, Angeboten und
            Aufträgen können insbesondere folgende Daten verarbeitet
            werden:
          </p>

          <ul>
            <li>Kunden- und Objektangaben,</li>
            <li>Raum-, Flächen- und Aufmaßdaten,</li>
            <li>Angaben zu Fenstern, Türen und Heizkörpern,</li>
            <li>Leistungsbeschreibungen und Preise,</li>
            <li>Rabatte und Zusatzpositionen,</li>
            <li>Status und zeitlicher Verlauf eines Auftrags,</li>
            <li>zugeordnete Mitarbeiter und Projektleiter,</li>
            <li>Bilder, Notizen und Dokumente.</li>
          </ul>

          <p>
            Die Verarbeitung erfolgt im Auftrag des jeweiligen
            Unternehmens zur Vorbereitung, Durchführung und
            Dokumentation seiner Kundenaufträge.
          </p>
        </section>

        <section className="legal-section">
          <h2>11. Arbeitszeiterfassung</h2>

          <p>
            Bei Nutzung der Zeiterfassung können insbesondere
            Beginn, Ende und Dauer von Arbeitszeiten und Pausen,
            Auftragszuordnung, Benutzerzuordnung sowie technische
            Zeitstempel verarbeitet werden.
          </p>

          <p>
            Verantwortlicher für die Zeiterfassung ist das
            Unternehmen, das MalerSaaS als Arbeitgeber oder
            Auftraggeber einsetzt.
          </p>

          <p>
            MalerSaaS verarbeitet diese Daten nach den Weisungen des
            jeweiligen Unternehmens.
          </p>

          <p>
            MalerSaaS führt keine heimliche Standortüberwachung durch,
            sofern eine solche Funktion nicht ausdrücklich eingeführt,
            transparent beschrieben und rechtlich zulässig
            konfiguriert wurde.
          </p>
        </section>

        <section className="legal-section">
          <h2>12. Bilder und Dokumente</h2>

          <p>
            Benutzer können Bilder und Dokumente zu Aufträgen,
            Nachrichten, Kunden, Materialien und anderen
            betrieblichen Vorgängen hochladen.
          </p>

          <p>
            Hochgeladene Dateien können personenbezogene Daten,
            Abbildungen von Personen, Objektinformationen oder andere
            vertrauliche Inhalte enthalten.
          </p>

          <p>
            Der jeweilige Unternehmenskunde ist dafür verantwortlich,
            dass die Dateien rechtmäßig erstellt, hochgeladen und
            verwendet werden und erforderliche Einwilligungen oder
            andere Rechtsgrundlagen vorliegen.
          </p>

          <p>
            Es sollen keine besonders schutzbedürftigen Daten
            hochgeladen werden, wenn dies für den vorgesehenen
            betrieblichen Zweck nicht erforderlich ist.
          </p>
        </section>

        <section className="legal-section">
          <h2>13. Materialverwaltung</h2>

          <p>
            Bei Nutzung der Materialverwaltung können
            Materialbestände, Lieferanten, Einkaufspreise,
            Lagerorte, Materialzuweisungen, Übergabebestätigungen,
            Verbräuche, Rückgaben, Schäden und auftragsbezogene
            Materialbuchungen verarbeitet werden.
          </p>

          <p>
            Soweit diese Informationen einem Mitarbeiter oder einer
            anderen Person zugeordnet werden, handelt es sich um
            personenbezogene Daten.
          </p>

          <p>
            Verantwortlich für die rechtmäßige Zuordnung und
            Verwendung dieser Informationen ist das jeweilige
            Unternehmen.
          </p>
        </section>

        <section className="legal-section">
          <h2>14. Nachrichtenfunktion</h2>

          <p>
            Über die Nachrichtenfunktion können Benutzer
            Direktnachrichten, Bilder und andere auftragsbezogene
            Informationen austauschen.
          </p>

          <p>
            Dabei können Absender, Empfänger, Nachrichteninhalt,
            Zeitpunkt, Lesestatus und zugehörige Dateien verarbeitet
            werden.
          </p>

          <p>
            Die Nachrichtenfunktion darf nur für rechtmäßige
            betriebliche Zwecke verwendet werden. Der jeweilige
            Unternehmenskunde ist für die Festlegung zulässiger
            Nutzungsregeln verantwortlich.
          </p>
        </section>

        <section className="legal-section">
          <h2>15. Leistungsbewertung und Bonusregeln</h2>

          <p>
            MalerSaaS kann Unternehmen Funktionen zur
            Leistungsbewertung ihrer Mitarbeiter bereitstellen.
          </p>

          <p>
            Dabei können vom Unternehmen definierte Kriterien,
            erreichte Punkte, nicht erfüllte Kriterien,
            Sternebewertungen, Ranglisten und Bonusinformationen
            verarbeitet werden.
          </p>

          <p>
            Die Kriterien und Bonusregeln werden vom jeweiligen
            Unternehmen festgelegt. MalerSaaS trifft keine eigenen
            arbeitsrechtlichen Entscheidungen über Mitarbeiter.
          </p>

          <p>
            Das Unternehmen bleibt für die Zulässigkeit,
            Nachvollziehbarkeit, Transparenz und faire Verwendung der
            Leistungsbewertung verantwortlich.
          </p>

          <p>
            Entscheidungen mit rechtlicher oder vergleichbar
            erheblicher Wirkung dürfen nicht ausschließlich auf einer
            automatisierten Auswertung beruhen, wenn dies nach
            Artikel 22 DSGVO oder anderen anwendbaren Vorschriften
            unzulässig ist.
          </p>

          <p>
            Das Unternehmen muss erforderlichenfalls eine menschliche
            Überprüfung ermöglichen und betroffene Mitarbeiter über
            die verwendeten Kriterien informieren.
          </p>
        </section>

        <section className="legal-section">
          <h2>16. Kundenportal</h2>

          <p>
            Unternehmen können ihren Kunden einen geschützten Zugang
            zu bestimmten Auftrags-, Angebots- oder
            Rechnungsinformationen bereitstellen.
          </p>

          <p>
            Der Zugriff kann über einen individuell erzeugten
            Zugangstoken oder einen anderen geschützten
            Zugangsmechanismus erfolgen.
          </p>

          <p>
            Zugangstoken müssen vertraulich behandelt werden und
            dürfen nur an berechtigte Personen weitergegeben werden.
          </p>

          <p>
            Der jeweilige Unternehmenskunde ist dafür verantwortlich,
            den Zugang zu sperren oder zu erneuern, wenn ein Token
            unbefugt weitergegeben wurde oder nicht mehr benötigt
            wird.
          </p>
        </section>

        <section className="legal-section">
          <h2>17. Kontakt- und Supportanfragen</h2>

          <p>
            Bei einer Kontakt- oder Supportanfrage können Name,
            E-Mail-Adresse, Unternehmen, Inhalt der Anfrage,
            technische Angaben und der weitere Kommunikationsverlauf
            verarbeitet werden.
          </p>

          <p>
            Die Verarbeitung erfolgt zur Bearbeitung der Anfrage und
            zur Durchführung vorvertraglicher oder vertraglicher
            Maßnahmen gemäß Artikel 6 Absatz 1 Buchstabe b DSGVO.
          </p>

          <p>
            Soweit die Anfrage nicht unmittelbar einen Vertrag
            betrifft, erfolgt die Verarbeitung auf Grundlage des
            berechtigten Interesses an der Bearbeitung geschäftlicher
            Anfragen gemäß Artikel 6 Absatz 1 Buchstabe f DSGVO.
          </p>
        </section>

        <section className="legal-section">
          <h2>18. Zahlungsabwicklung über Stripe</h2>

          <p>
            Für die Abwicklung von Abonnements und Zahlungen wird
            Stripe eingesetzt.
          </p>

          <p>
            Dabei können insbesondere Name, E-Mail-Adresse,
            Rechnungsanschrift, Zahlungsinformationen,
            Transaktionsdaten, Tarif, Betrag, Währung und
            Abonnementstatus an Stripe übermittelt werden.
          </p>

          <p>
            Vollständige Kreditkartendaten werden grundsätzlich nicht
            von MalerSaaS gespeichert, sondern direkt durch Stripe
            verarbeitet.
          </p>

          <p>
            Die Verarbeitung erfolgt zur Durchführung des Vertrags
            gemäß Artikel 6 Absatz 1 Buchstabe b DSGVO sowie zur
            Erfüllung gesetzlicher Pflichten gemäß Artikel 6 Absatz 1
            Buchstabe c DSGVO.
          </p>

          <p>
            Weitere Informationen enthält die{" "}
            <a
              href="https://stripe.com/privacy"
              target="_blank"
              rel="noreferrer"
            >
              Datenschutzerklärung von Stripe
            </a>
            .
          </p>
        </section>

        <section className="legal-section">
          <h2>19. Technische Bereitstellung durch Supabase</h2>

          <p>
            MalerSaaS nutzt Supabase insbesondere für Datenbanken,
            Benutzeranmeldung, Authentifizierung, Dateispeicherung und
            serverseitige Funktionen.
          </p>

          <p>
            Dabei können die innerhalb der Plattform gespeicherten
            Konto-, Unternehmens-, Kunden-, Mitarbeiter-, Auftrags-,
            Zeit-, Material-, Nachrichten- und Dokumentendaten
            verarbeitet werden.
          </p>

          <p>
            Supabase wird auf Grundlage einer
            Auftragsverarbeitungsvereinbarung und der geltenden
            Datenschutzvorschriften eingesetzt.
          </p>

          <p>
            Weitere Informationen enthält die{" "}
            <a
              href="https://supabase.com/privacy"
              target="_blank"
              rel="noreferrer"
            >
              Datenschutzerklärung von Supabase
            </a>
            .
          </p>
        </section>

        <section className="legal-section">
          <h2>20. Hosting und Auslieferung über Vercel</h2>

          <p>
            Die Website und Teile der technischen Anwendung werden
            über Vercel bereitgestellt und ausgeliefert.
          </p>

          <p>
            Dabei können insbesondere IP-Adressen, aufgerufene
            Seiten, Datum und Uhrzeit, Browser- und Geräteangaben,
            technische Protokolldaten sowie Sicherheitsinformationen
            verarbeitet werden.
          </p>

          <p>
            Der Einsatz erfolgt zur sicheren, schnellen und
            zuverlässigen Bereitstellung der Website und Plattform
            gemäß Artikel 6 Absatz 1 Buchstabe f DSGVO.
          </p>

          <p>
            Weitere Informationen enthält die{" "}
            <a
              href="https://vercel.com/legal/privacy-policy"
              target="_blank"
              rel="noreferrer"
            >
              Datenschutzerklärung von Vercel
            </a>
            .
          </p>
        </section>

        <section className="legal-section">
          <h2>21. E-Mail-Versand</h2>

          <p>
            Für Registrierungsbestätigungen, Sicherheitsnachrichten,
            vertragsbezogene Mitteilungen und Supportantworten können
            technische E-Mail-Dienstleister eingesetzt werden.
          </p>

          <p>
            Dabei können insbesondere Name, E-Mail-Adresse,
            Nachrichteninhalt, Versandzeitpunkt, Zustellstatus und
            technische Versandinformationen verarbeitet werden.
          </p>

          <p>
            Die Verarbeitung erfolgt zur Vertragsdurchführung gemäß
            Artikel 6 Absatz 1 Buchstabe b DSGVO, zur Erfüllung
            gesetzlicher Pflichten gemäß Artikel 6 Absatz 1
            Buchstabe c DSGVO oder zur sicheren Kommunikation gemäß
            Artikel 6 Absatz 1 Buchstabe f DSGVO.
          </p>
        </section>

        <section className="legal-section">
          <h2>22. Keine Analyse- oder Werbetracker</h2>

          <p>
            MalerSaaS verwendet derzeit keine externen
            Analyse-, Werbe- oder Marketing-Tracking-Systeme.
          </p>

          <p>
            Insbesondere werden derzeit kein Google Analytics, kein
            Meta- beziehungsweise Facebook-Pixel, kein TikTok-Pixel
            und kein Microsoft Clarity eingesetzt.
          </p>

          <p>
            Die Google Search Console dient ausschließlich der
            technischen Verwaltung und Überwachung der Auffindbarkeit
            der Website. Durch die Search Console wird auf der
            MalerSaaS-Website kein eigener Tracking-Code gesetzt.
          </p>
        </section>

        <section className="legal-section">
          <h2>23. Technisch notwendige Speicherungen</h2>

          <p>
            Für Anmeldung, Sitzungsverwaltung, Sicherheit und
            technische Funktionen können notwendige Cookies,
            Browser-Speicher oder vergleichbare Technologien
            eingesetzt werden.
          </p>

          <p>
            Diese Speicherungen sind erforderlich, damit Benutzer
            angemeldet bleiben, Berechtigungen zugeordnet und
            Sicherheitsfunktionen bereitgestellt werden können.
          </p>

          <p>
            Sie werden nicht zur Erstellung von Werbeprofilen oder
            zur seitenübergreifenden Nachverfolgung von Nutzern
            verwendet.
          </p>

          <p>
            Soweit diese Speicherung für die Bereitstellung eines
            ausdrücklich gewünschten Dienstes erforderlich ist,
            erfolgt sie auf Grundlage der einschlägigen gesetzlichen
            Vorschriften für technisch notwendige Speicherungen.
          </p>
        </section>

        <section className="legal-section">
          <h2>24. Empfänger personenbezogener Daten</h2>

          <p>
            Personenbezogene Daten werden nur weitergegeben, wenn
            dies zur Bereitstellung der Plattform, zur
            Vertragsdurchführung, zur Erfüllung gesetzlicher Pflichten
            oder zur Wahrung berechtigter Interessen erforderlich
            ist.
          </p>

          <p>Empfänger können insbesondere sein:</p>

          <ul>
            <li>Hosting- und Infrastruktur-Anbieter,</li>
            <li>Datenbank- und Speicherdienstleister,</li>
            <li>Authentifizierungs- und E-Mail-Dienstleister,</li>
            <li>Zahlungsdienstleister,</li>
            <li>Support- und Sicherheitsdienstleister,</li>
            <li>
              Steuerberater, Rechtsberater und andere beruflich zur
              Verschwiegenheit verpflichtete Berater,
            </li>
            <li>
              Behörden und Gerichte, soweit eine gesetzliche
              Verpflichtung besteht.
            </li>
          </ul>

          <p>
            Auftragsverarbeiter werden vertraglich verpflichtet,
            personenbezogene Daten nur nach Weisung und unter
            Einhaltung angemessener Sicherheitsmaßnahmen zu
            verarbeiten.
          </p>
        </section>

        <section className="legal-section">
          <h2>25. Datenübermittlung in Drittländer</h2>

          <p>
            Einige technische Dienstleister oder deren
            Unterauftragnehmer können ihren Sitz außerhalb der
            Europäischen Union oder des Europäischen
            Wirtschaftsraums haben.
          </p>

          <p>
            Eine Übermittlung personenbezogener Daten in ein
            Drittland erfolgt nur, wenn die gesetzlichen
            Voraussetzungen erfüllt sind.
          </p>

          <p>
            Hierfür können insbesondere ein
            Angemessenheitsbeschluss der Europäischen Kommission,
            Standardvertragsklauseln, zusätzliche
            Sicherheitsmaßnahmen oder andere gesetzlich anerkannte
            Garantien verwendet werden.
          </p>

          <p>
            Nähere Informationen können unter{" "}
            <a href="mailto:info@maler-saas.com">
              info@maler-saas.com
            </a>{" "}
            angefragt werden.
          </p>
        </section>

        <section className="legal-section">
          <h2>26. Speicherdauer</h2>

          <p>
            Personenbezogene Daten werden nur so lange gespeichert,
            wie dies für den jeweiligen Zweck erforderlich ist oder
            gesetzliche Aufbewahrungspflichten bestehen.
          </p>

          <p>
            Konto- und Vertragsdaten werden grundsätzlich während der
            Vertragslaufzeit gespeichert.
          </p>

          <p>
            Nach Beendigung des Vertrags können Kundendaten für einen
            begrenzten Zeitraum zur Datenrückgabe bereitgehalten
            werden. Nach den AGB beträgt diese Rückgabefrist
            grundsätzlich 30 Tage.
          </p>

          <p>
            Anschließend werden die Daten nach Maßgabe der
            Auftragsverarbeitungsvereinbarung und des technischen
            Löschkonzepts gelöscht oder anonymisiert, sofern keine
            gesetzlichen Aufbewahrungspflichten oder berechtigten
            Beweissicherungsinteressen entgegenstehen.
          </p>

          <p>
            Rechnungs-, Zahlungs- und steuerlich relevante Daten
            werden für die jeweils gesetzlich vorgeschriebenen
            Zeiträume aufbewahrt.
          </p>

          <p>
            Technische Protokoll- und Sicherheitsdaten werden
            gelöscht, sobald sie für Sicherheit, Fehleranalyse oder
            Missbrauchsabwehr nicht mehr erforderlich sind.
          </p>

          <p>
            Sicherungskopien werden innerhalb der regelmäßigen
            Sicherungs- und Löschzyklen überschrieben.
          </p>
        </section>

        <section className="legal-section">
          <h2>27. Datensicherheit</h2>

          <p>
            MalerSaaS trifft angemessene technische und
            organisatorische Maßnahmen, um personenbezogene Daten
            gegen Verlust, Veränderung, unbefugte Offenlegung und
            unbefugten Zugriff zu schützen.
          </p>

          <p>Dazu können insbesondere gehören:</p>

          <ul>
            <li>verschlüsselte Datenübertragung über HTTPS,</li>
            <li>geschützte Authentifizierungsverfahren,</li>
            <li>rollenbasierte Zugriffsberechtigungen,</li>
            <li>Mandantentrennung,</li>
            <li>Zugriffsbeschränkungen auf Datenbankebene,</li>
            <li>Protokollierung sicherheitsrelevanter Vorgänge,</li>
            <li>regelmäßige Sicherungs- und Aktualisierungsmaßnahmen.</li>
          </ul>

          <p>
            Trotz angemessener Sicherheitsmaßnahmen kann eine
            vollständige Sicherheit bei elektronischer
            Datenübertragung und -speicherung nicht garantiert
            werden.
          </p>
        </section>

        <section className="legal-section">
          <h2>28. Pflicht zur Bereitstellung von Daten</h2>

          <p>
            Bestimmte personenbezogene Daten sind erforderlich, um
            ein Benutzerkonto anzulegen, einen Vertrag abzuschließen,
            Zahlungen abzuwickeln und die gebuchten Funktionen
            bereitzustellen.
          </p>

          <p>
            Ohne diese erforderlichen Daten kann MalerSaaS den
            gewünschten Vertrag oder einzelne Funktionen
            möglicherweise nicht bereitstellen.
          </p>

          <p>
            Die Bereitstellung zusätzlicher, nicht erforderlicher
            Angaben ist grundsätzlich freiwillig.
          </p>
        </section>

        <section className="legal-section">
          <h2>29. Rechte betroffener Personen</h2>

          <p>
            Betroffene Personen haben nach Maßgabe der gesetzlichen
            Voraussetzungen insbesondere folgende Rechte:
          </p>

          <ul>
            <li>
              Recht auf Auskunft über die verarbeiteten
              personenbezogenen Daten,
            </li>

            <li>Recht auf Berichtigung unrichtiger Daten,</li>

            <li>Recht auf Löschung personenbezogener Daten,</li>

            <li>
              Recht auf Einschränkung der Verarbeitung,
            </li>

            <li>Recht auf Datenübertragbarkeit,</li>

            <li>
              Recht auf Widerspruch gegen bestimmte
              Datenverarbeitungen,
            </li>

            <li>
              Recht, eine erteilte Einwilligung jederzeit mit Wirkung
              für die Zukunft zu widerrufen,
            </li>

            <li>
              Recht, nicht einer ausschließlich automatisierten
              Entscheidung mit rechtlicher oder vergleichbar
              erheblicher Wirkung unterworfen zu werden, soweit
              Artikel 22 DSGVO anwendbar ist.
            </li>
          </ul>

          <p>
            Zur Ausübung der Rechte genügt eine Nachricht an{" "}
            <a href="mailto:info@maler-saas.com">
              info@maler-saas.com
            </a>
            .
          </p>

          <p>
            Vor der Bearbeitung einer Anfrage kann ein angemessener
            Nachweis der Identität verlangt werden, um unbefugte
            Auskünfte oder Änderungen zu verhindern.
          </p>

          <p>
            Betrifft die Anfrage Daten, die ein Unternehmenskunde in
            MalerSaaS gespeichert hat, wird die betroffene Person
            gegebenenfalls an dieses Unternehmen verwiesen oder die
            Anfrage in Abstimmung mit ihm bearbeitet.
          </p>
        </section>

        <section className="legal-section">
          <h2>30. Widerspruchsrecht</h2>

          <p>
            Werden personenbezogene Daten auf Grundlage von Artikel 6
            Absatz 1 Buchstabe f DSGVO verarbeitet, kann die
            betroffene Person aus Gründen, die sich aus ihrer
            besonderen Situation ergeben, jederzeit Widerspruch gegen
            die Verarbeitung einlegen.
          </p>

          <p>
            Die Verarbeitung wird danach eingestellt, sofern keine
            zwingenden schutzwürdigen Gründe für die Verarbeitung
            bestehen, die die Interessen, Rechte und Freiheiten der
            betroffenen Person überwiegen, oder die Verarbeitung der
            Geltendmachung, Ausübung oder Verteidigung von
            Rechtsansprüchen dient.
          </p>
        </section>

        <section className="legal-section">
          <h2>31. Beschwerderecht</h2>

          <p>
            Betroffene Personen haben das Recht, sich bei einer
            Datenschutzaufsichtsbehörde zu beschweren.
          </p>

          <p>
            Zuständige spanische Aufsichtsbehörde ist insbesondere:
          </p>

          <p>
            Agencia Española de Protección de Datos
            <br />
            C/ Jorge Juan, 6
            <br />
            28001 Madrid
            <br />
            Spanien
            <br />
            Website:{" "}
            <a
              href="https://www.aepd.es"
              target="_blank"
              rel="noreferrer"
            >
              www.aepd.es
            </a>
          </p>

          <p>
            Eine Beschwerde kann gegebenenfalls auch bei der
            Aufsichtsbehörde des gewöhnlichen Aufenthaltsortes, des
            Arbeitsplatzes oder des Ortes des vermuteten Verstoßes
            eingereicht werden.
          </p>
        </section>

        <section className="legal-section">
  <h2>32. Ansprechpartner für Datenschutz</h2>

  <p>
    Ansprechpartner für sämtliche Datenschutzanfragen im
    Zusammenhang mit MalerSaaS ist:
  </p>

  <p>
    Anton Lehmann
    <br />
    C/ Muntanya 63
    <br />
    07420 Sa Pobla
    <br />
    Illes Balears
    <br />
    Spanien
    <br />
    E-Mail:{" "}
    <a href="mailto:info@maler-saas.com">
      info@maler-saas.com
    </a>
  </p>

  <p>
    Ein Datenschutzbeauftragter ist derzeit nicht bestellt, da
    nach aktueller Einschätzung keine gesetzliche Verpflichtung
    zur Bestellung besteht.
  </p>

  <p>
    Sollte künftig eine gesetzliche Verpflichtung zur Bestellung
    eines Datenschutzbeauftragten entstehen, werden dessen
    Kontaktdaten an dieser Stelle veröffentlicht.
  </p>
</section>

        <section className="legal-section">
          <h2>33. Änderungen dieser Datenschutzerklärung</h2>

          <p>
            Diese Datenschutzerklärung kann angepasst werden, wenn
            sich die Plattform, die eingesetzten Dienstleister, die
            Datenverarbeitungen oder die gesetzlichen Anforderungen
            ändern.
          </p>

          <p>
            Die jeweils aktuelle Fassung wird auf der Website von
            MalerSaaS veröffentlicht.
          </p>

          <p>
            Bei wesentlichen Änderungen, die registrierte Benutzer
            betreffen, kann zusätzlich eine Information innerhalb der
            Plattform oder per E-Mail erfolgen.
          </p>
        </section>
      </div>
    </div>
  );
}