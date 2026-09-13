type AgbPageProps = {
  onBack: () => void;
};

export default function AgbPage({
  onBack,
}: AgbPageProps) {
  return (
    <div className="legal-page">
      <div className="legal-card">
        <div className="legal-topbar">
          <div>
            <h1>Allgemeine Geschäftsbedingungen</h1>
            <p>
              Nutzungsbedingungen für die B2B-SaaS-Plattform
              MalerSaaS
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
          <h2>1. Anbieter und Geltungsbereich</h2>

          <p>
            Anbieter der Plattform MalerSaaS und Vertragspartner des
            Kunden ist:
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
            Diese Allgemeinen Geschäftsbedingungen gelten für
            sämtliche Verträge über die Nutzung von MalerSaaS,
            einschließlich Testzugängen, Abonnements,
            Zusatzleistungen und Supportleistungen.
          </p>

          <p>
            MalerSaaS richtet sich ausschließlich an Unternehmer,
            juristische Personen und Organisationen, die bei Abschluss
            des Vertrags in Ausübung ihrer gewerblichen oder
            selbstständigen beruflichen Tätigkeit handeln.
          </p>

          <p>
            Verbraucher sind von der kostenpflichtigen Registrierung
            und Nutzung ausgeschlossen.
          </p>

          <p>
            Abweichende Geschäftsbedingungen des Kunden gelten nur,
            wenn MalerSaaS ihrer Geltung ausdrücklich in Textform
            zugestimmt hat.
          </p>
        </section>

        <section className="legal-section">
          <h2>2. Vertragsgegenstand</h2>

          <p>
            MalerSaaS ist eine mandantenfähige, internetbasierte
            Unternehmenssoftware für Maler- und Handwerksbetriebe.
          </p>

          <p>
            Je nach gebuchtem Tarif können insbesondere Kunden,
            Mitarbeiter, Angebote, Aufträge, Arbeitszeiten,
            Materialien, Nachrichten, Rechnungen, Kundenportale,
            Leistungsregeln und betriebliche Auswertungen verwaltet
            werden.
          </p>

          <p>
            Vertragsgegenstand ist die zeitlich begrenzte
            Bereitstellung des jeweils gebuchten Funktionsumfangs über
            das Internet.
          </p>

          <p>
            Nicht geschuldet sind ein bestimmter wirtschaftlicher
            Erfolg, eine bestimmte betriebliche Auslastung sowie eine
            steuerliche oder rechtliche Beratung.
          </p>

          <p>
            Der Kunde bleibt dafür verantwortlich, alle mit MalerSaaS
            erzeugten Dokumente und Daten vor ihrer geschäftlichen
            Verwendung zu prüfen.
          </p>
        </section>

        <section className="legal-section">
          <h2>3. Leistungsumfang</h2>

          <p>
            Der konkrete Leistungsumfang ergibt sich aus der
            Tarifbeschreibung, die dem Kunden bei Abschluss des
            Abonnements angezeigt wird.
          </p>

          <p>
            Produktdarstellungen, Vorschauen, Entwicklungspläne und
            Hinweise auf geplante Funktionen sind unverbindlich,
            sofern sie nicht ausdrücklich als verbindlicher
            Vertragsbestandteil vereinbart wurden.
          </p>

          <p>
            MalerSaaS darf technisch notwendige
            Weiterentwicklungen, Sicherheitsverbesserungen und
            zumutbare Änderungen der Benutzeroberfläche vornehmen,
            sofern die wesentlichen Funktionen des gebuchten Tarifs
            erhalten bleiben.
          </p>

          <p>
            Individuelle Anpassungen, Datenmigrationen, Schulungen,
            Beratungen und besondere Schnittstellen sind nur
            geschuldet, wenn sie gesondert vereinbart wurden.
          </p>
        </section>

        <section className="legal-section">
          <h2>4. Registrierung und Vertragsschluss</h2>

          <p>
            Für die Nutzung von MalerSaaS ist eine Registrierung
            erforderlich. Der Kunde ist verpflichtet, vollständige
            und richtige Angaben zu machen und diese aktuell zu
            halten.
          </p>

          <p>
            Die Darstellung der Tarife auf der Website stellt noch
            kein verbindliches Vertragsangebot dar. Der Kunde gibt
            durch Abschluss des elektronischen Bestellvorgangs ein
            verbindliches Angebot ab.
          </p>

          <p>
            Der Vertrag kommt zustande, sobald MalerSaaS den Zugang
            freischaltet, die Bestellung elektronisch bestätigt oder
            mit der Leistungserbringung beginnt.
          </p>

          <p>
            Eine automatisierte Eingangsbestätigung allein stellt
            keine Annahme dar, sofern sie nicht ausdrücklich als
            Auftragsbestätigung bezeichnet wird.
          </p>

          <p>
            Die Vertragssprache ist Deutsch, sofern nicht ausdrücklich
            eine andere Vertragssprache vereinbart wurde.
          </p>
        </section>

        <section className="legal-section">
          <h2>5. Kostenlose Testphase</h2>

          <p>
            MalerSaaS kann neuen Kunden eine kostenlose Testphase von
            14 Tagen zur Verfügung stellen.
          </p>

          <p>
            Der Umfang der während der Testphase verfügbaren
            Funktionen kann von dem Funktionsumfang eines
            kostenpflichtigen Tarifs abweichen.
          </p>

          <p>
            Die kostenlose Testphase endet nach 14 Tagen. Sie wird
            nicht ohne eine ausdrückliche kostenpflichtige Bestellung
            des Kunden in ein zahlungspflichtiges Abonnement
            umgewandelt.
          </p>

          <p>
            MalerSaaS darf Testzugänge einschränken oder sperren, wenn
            konkrete Anhaltspunkte für Missbrauch,
            Mehrfachregistrierungen oder eine rechtswidrige Nutzung
            bestehen.
          </p>
        </section>

        <section className="legal-section">
          <h2>6. Benutzerkonten und Rollen</h2>

          <p>
            Der Kunde benennt mindestens eine vertretungsberechtigte
            oder intern autorisierte Person als Administrator.
            Handlungen eines Administrators werden dem Kunden
            zugerechnet.
          </p>

          <p>
            Benutzerkonten dürfen nur für eigene Mitarbeiter,
            Projektleiter, Subunternehmer und andere berechtigte
            Personen angelegt werden, soweit der gebuchte Tarif und
            die zugewiesene Benutzerrolle dies erlauben.
          </p>

          <p>
            Benutzerkonten sind personenbezogen. Zugangsdaten dürfen
            nicht an andere Personen weitergegeben oder gemeinsam
            genutzt werden.
          </p>

          <p>
            Der Kunde ist für die Vergabe und regelmäßige Prüfung von
            Rollen, Zugängen und Berechtigungen verantwortlich.
          </p>

          <p>
            Zugänge ausgeschiedener oder nicht mehr berechtigter
            Personen müssen unverzüglich deaktiviert werden.
          </p>
        </section>

        <section className="legal-section">
          <h2>7. Tarife und Nutzungsgrenzen</h2>

          <p>
            MalerSaaS bietet unterschiedliche Tarife an. Die Tarife
            können sich insbesondere hinsichtlich Funktionsumfang,
            Benutzerzahl, Speicherplatz, Support und technischer
            Kontingente unterscheiden.
          </p>

          <p>
            Maßgeblich ist die Tarifbeschreibung, die dem Kunden beim
            Abschluss oder bei einer Änderung des Abonnements
            angezeigt wird.
          </p>

          <p>
            Vertraglich vereinbarte Nutzungsgrenzen dürfen nicht durch
            gemeinsam genutzte Benutzerkonten,
            Mehrfachregistrierungen, automatisierte Massenzugriffe
            oder vergleichbare Maßnahmen umgangen werden.
          </p>

          <p>
            Bei Überschreitung einer Nutzungsgrenze kann MalerSaaS
            einen Tarifwechsel oder die Buchung einer Zusatzleistung
            verlangen.
          </p>

          <p>
            Ein Wechsel in einen höheren Tarif kann sofort wirksam und
            anteilig berechnet werden. Ein Wechsel in einen
            niedrigeren Tarif wird grundsätzlich zum Ende der
            laufenden Abrechnungsperiode wirksam.
          </p>
        </section>

        <section className="legal-section">
          <h2>8. Preise, Steuern und Zahlung</h2>

          <p>
            Es gelten die Preise, die im Bestellprozess oder in einem
            individuellen Angebot angegeben werden.
          </p>

          <p>
            Die Preise verstehen sich, soweit nicht anders angegeben,
            netto zuzüglich der gesetzlich geschuldeten Umsatzsteuer
            oder vergleichbarer Abgaben.
          </p>

          <p>
            Wiederkehrende Entgelte werden für die vereinbarte
            Abrechnungsperiode im Voraus fällig.
          </p>

          <p>
            Die Zahlungsabwicklung kann über einen externen
            Zahlungsdienstleister, insbesondere Stripe, erfolgen.
          </p>

          <p>
            Der Kunde ermächtigt MalerSaaS beziehungsweise den
            beauftragten Zahlungsdienstleister, die fälligen Beträge
            über das gewählte Zahlungsmittel einzuziehen.
          </p>

          <p>
            Der Kunde muss seine Zahlungs- und Rechnungsdaten aktuell
            halten und für eine ausreichende Deckung des angegebenen
            Zahlungsmittels sorgen.
          </p>

          <p>
            Rechnungen werden elektronisch zur Verfügung gestellt
            oder per E-Mail versandt.
          </p>
        </section>

        <section className="legal-section">
          <h2>9. Zahlungsverzug</h2>

          <p>
            Bei Zahlungsverzug gelten die gesetzlichen Verzugszinsen
            und die gesetzlich zulässigen Beitreibungs- und
            Mahnkosten.
          </p>

          <p>
            MalerSaaS kann nach einer Mahnung und dem erfolglosen
            Ablauf einer angemessenen Zahlungsfrist den Zugang
            vorübergehend einschränken oder sperren.
          </p>

          <p>
            Der Kunde darf nur mit unbestrittenen oder rechtskräftig
            festgestellten Forderungen aufrechnen.
          </p>
        </section>

        <section className="legal-section">
          <h2>10. Pflichten des Kunden</h2>

          <p>
            Der Kunde stellt die für Einrichtung und Nutzung
            erforderlichen Angaben vollständig und richtig bereit.
          </p>

          <p>
            Er ist für geeignete Endgeräte, einen funktionierenden
            Internetzugang, aktuelle Browser sowie die Sicherheit
            seiner eigenen Systeme verantwortlich.
          </p>

          <p>
            Der Kunde muss alle mit MalerSaaS erzeugten Angebote,
            Rechnungen, Arbeitszeitdaten, Materialdaten,
            Leistungsbewertungen und Auswertungen vor ihrer
            Verwendung auf Richtigkeit und Vollständigkeit prüfen.
          </p>

          <p>
            Der Kunde bleibt für die Einhaltung steuerlicher,
            arbeitsrechtlicher, handelsrechtlicher und
            branchenspezifischer Vorschriften verantwortlich.
          </p>

          <p>
            Fehler, Sicherheitsvorfälle und erkennbare
            Unstimmigkeiten müssen unverzüglich an MalerSaaS gemeldet
            werden.
          </p>
        </section>

        <section className="legal-section">
          <h2>11. Zulässige Nutzung</h2>

          <p>
            MalerSaaS darf ausschließlich für rechtmäßige betriebliche
            Zwecke und im vertraglich vereinbarten Umfang genutzt
            werden.
          </p>

          <p>Untersagt sind insbesondere:</p>

          <ul>
            <li>das Speichern oder Verbreiten rechtswidriger Inhalte,</li>
            <li>
              die Verletzung von Persönlichkeits-, Datenschutz-,
              Urheber-, Marken- oder Geschäftsgeheimnisrechten,
            </li>
            <li>das Einschleusen von Schadsoftware,</li>
            <li>unbefugte Sicherheitsprüfungen oder Angriffe,</li>
            <li>die Umgehung von Zugriffsbeschränkungen,</li>
            <li>
              automatisierte Zugriffe, die zu einer Überlastung der
              Plattform führen können,
            </li>
            <li>
              der Weiterverkauf oder die unbefugte Bereitstellung der
              Plattform an Dritte,
            </li>
            <li>
              die Nutzung zur systematischen Entwicklung eines
              unmittelbar konkurrierenden Dienstes.
            </li>
          </ul>

          <p>
            Bei einem erheblichen Verstoß darf MalerSaaS betroffene
            Inhalte oder Benutzerzugänge unter Beachtung der
            Verhältnismäßigkeit sperren.
          </p>
        </section>

        <section className="legal-section">
          <h2>12. Kundendaten und Inhalte</h2>

          <p>
            Kundendaten sind alle Daten und Inhalte, die der Kunde
            oder seine Benutzer in MalerSaaS eingeben, hochladen,
            erzeugen oder über Schnittstellen übertragen.
          </p>

          <p>
            Sämtliche Rechte an den Kundendaten verbleiben beim Kunden
            oder bei den jeweiligen Rechteinhabern.
          </p>

          <p>
            Der Kunde räumt MalerSaaS für die Vertragsdauer die
            erforderlichen Rechte ein, Kundendaten zu speichern,
            technisch zu bearbeiten, zu übertragen und anzuzeigen,
            soweit dies für die Bereitstellung, Sicherheit,
            Fehlerbehebung und Datensicherung erforderlich ist.
          </p>

          <p>
            Der Kunde versichert, über die erforderlichen Rechte und
            Rechtsgrundlagen für die von ihm gespeicherten Inhalte zu
            verfügen.
          </p>

          <p>
            Kundendaten werden nicht ohne eine gesonderte transparente
            Rechtsgrundlage zum Training allgemein verwendbarer
            KI-Modelle verwendet.
          </p>

          <p>
            Vollständig anonymisierte und nicht auf Kunden oder
            Personen zurückführbare Betriebsdaten dürfen zur
            Verbesserung, Sicherheit und Kapazitätsplanung verwendet
            werden.
          </p>
        </section>

        <section className="legal-section">
          <h2>13. Datenschutz und Auftragsverarbeitung</h2>

          <p>
            Soweit MalerSaaS personenbezogene Daten im Auftrag des
            Kunden verarbeitet, schließen die Parteien eine
            gesonderte Auftragsverarbeitungsvereinbarung gemäß
            Artikel 28 DSGVO.
          </p>

          <p>
            Der Kunde ist grundsätzlich Verantwortlicher für die von
            ihm und seinen Benutzern in MalerSaaS verarbeiteten
            personenbezogenen Daten.
          </p>

          <p>
            Der Kunde stellt sicher, dass die Verarbeitung von Daten
            seiner Mitarbeiter, Kunden, Ansprechpartner,
            Subunternehmer und sonstigen Personen rechtmäßig erfolgt.
          </p>

          <p>
            Weitere Informationen über die Datenverarbeitung enthält
            die Datenschutzerklärung von MalerSaaS.
          </p>

          <p>
            Bei Widersprüchen zwischen diesen AGB und einer
            abgeschlossenen Auftragsverarbeitungsvereinbarung hat die
            Auftragsverarbeitungsvereinbarung für die betreffende
            Datenverarbeitung Vorrang.
          </p>
        </section>

        <section className="legal-section">
          <h2>14. Verfügbarkeit und Wartung</h2>

          <p>
            MalerSaaS bemüht sich um eine hohe Verfügbarkeit der
            Plattform.
          </p>

          <p>
            Eine bestimmte garantierte Verfügbarkeit oder
            Wiederherstellungszeit besteht nur, wenn sie in einem
            Tarif, einem Service-Level-Agreement oder einem
            individuellen Vertrag ausdrücklich zugesagt wurde.
          </p>

          <p>
            Nicht als von MalerSaaS zu vertretende Ausfallzeiten
            gelten insbesondere:
          </p>

          <ul>
            <li>angekündigte Wartungsarbeiten,</li>
            <li>dringende Sicherheits- oder Notfallwartungen,</li>
            <li>
              Störungen außerhalb des Einflussbereichs von MalerSaaS,
            </li>
            <li>
              Ausfälle von Internet-, Telekommunikations- oder
              Stromnetzen,
            </li>
            <li>Fälle höherer Gewalt,</li>
            <li>
              Angriffe Dritter trotz angemessener
              Sicherheitsmaßnahmen,
            </li>
            <li>vom Kunden oder seinen Benutzern verursachte Störungen.</li>
          </ul>

          <p>
            Planbare Wartungsarbeiten werden nach Möglichkeit in
            nutzungsarmen Zeiten durchgeführt.
          </p>
        </section>

        <section className="legal-section">
          <h2>15. Support</h2>

          <p>
            Supportkanäle, Servicezeiten und Reaktionszeiten ergeben
            sich aus dem gebuchten Tarif oder einer individuellen
            Vereinbarung.
          </p>

          <p>
            Reaktionszeiten sind nur dann verbindlich, wenn sie
            ausdrücklich als verbindlich bezeichnet wurden.
          </p>

          <p>
            Der Kunde muss Fehlermeldungen so konkret wie möglich
            beschreiben und bei der Fehleranalyse in zumutbarem Umfang
            mitwirken.
          </p>

          <p>
            Zugangsdaten und Passwörter dürfen nicht an den Support
            übermittelt werden.
          </p>
        </section>

        <section className="legal-section">
          <h2>16. Mängel und Gewährleistung</h2>

          <p>
            Ein Mangel liegt vor, wenn MalerSaaS wesentlich von der
            vereinbarten Beschaffenheit abweicht und die
            vertragsgemäße Nutzung dadurch mehr als nur unerheblich
            beeinträchtigt wird.
          </p>

          <p>
            MalerSaaS kann nach eigener Wahl durch Fehlerbehebung,
            Aktualisierung, eine zumutbare Ersatzlösung oder erneute
            Leistung nacherfüllen.
          </p>

          <p>
            Gewährleistungsansprüche bestehen nicht, soweit eine
            Beeinträchtigung durch eine unzulässige Nutzung,
            ungeeignete technische Systeme des Kunden, Änderungen
            durch Dritte oder fehlende Mitwirkung des Kunden
            verursacht wurde.
          </p>

          <p>
            Schlägt die Nacherfüllung endgültig fehl oder wird sie
            unzumutbar verzögert, stehen dem Kunden die gesetzlichen
            Rechte nach Maßgabe der Haftungsregelungen zu.
          </p>
        </section>

        <section className="legal-section">
          <h2>17. Geistiges Eigentum</h2>

          <p>
            MalerSaaS, der Quellcode, die Datenbankstruktur, das
            Design, die Dokumentation, Marken, Logos und sonstige
            Anbieterinhalte sind rechtlich geschützt.
          </p>

          <p>
            Der Kunde erhält für die Vertragsdauer ein einfaches,
            nicht übertragbares und nicht unterlizenzierbares Recht,
            die Plattform im vereinbarten Umfang für eigene
            betriebliche Zwecke zu nutzen.
          </p>

          <p>
            Eine Vervielfältigung, Bearbeitung, Weitergabe,
            Dekompilierung oder sonstige Verwertung ist nur zulässig,
            soweit dies ausdrücklich vereinbart oder gesetzlich
            zwingend erlaubt ist.
          </p>

          <p>
            Feedback und Verbesserungsvorschläge darf MalerSaaS
            unentgeltlich verwenden, sofern dadurch keine
            vertraulichen Informationen oder Rechte des Kunden
            offengelegt werden.
          </p>
        </section>

        <section className="legal-section">
          <h2>18. Dienste Dritter und Schnittstellen</h2>

          <p>
            MalerSaaS kann für die Bereitstellung der Plattform
            Dienste Dritter einsetzen. Dazu können insbesondere
            Hosting, Datenspeicherung, Zahlungsabwicklung,
            Authentifizierung, E-Mail-Versand und externe
            Schnittstellen gehören.
          </p>

          <p>
            Für optionale Drittanbieterdienste, die der Kunde
            eigenständig verbindet oder beauftragt, können zusätzliche
            Bedingungen und Datenschutzinformationen des jeweiligen
            Drittanbieters gelten.
          </p>

          <p>
            Ändert oder beendet ein Drittanbieter eine externe
            Schnittstelle, darf MalerSaaS die betroffene Integration
            anpassen oder einstellen, wenn eine Fortführung technisch
            oder wirtschaftlich nicht zumutbar ist.
          </p>
        </section>

        <section className="legal-section">
          <h2>19. Vertraulichkeit</h2>

          <p>
            Beide Parteien behandeln alle als vertraulich
            gekennzeichneten oder ihrer Natur nach vertraulichen
            geschäftlichen, technischen und organisatorischen
            Informationen geheim.
          </p>

          <p>
            Vertrauliche Informationen dürfen ausschließlich zur
            Durchführung des Vertrags verwendet und nur solchen
            Personen zugänglich gemacht werden, die sie zur
            Vertragserfüllung benötigen.
          </p>

          <p>
            Die Vertraulichkeitspflicht gilt für fünf Jahre nach
            Vertragsende weiter.
          </p>

          <p>
            Für Geschäftsgeheimnisse und personenbezogene Daten gilt
            sie so lange, wie deren Schutzbedürftigkeit oder
            gesetzliche Pflichten fortbestehen.
          </p>
        </section>

        <section className="legal-section">
          <h2>20. Vertragslaufzeit und Kündigung</h2>

          <p>
            Der Vertrag beginnt mit der vereinbarten Freischaltung des
            kostenpflichtigen Tarifs.
          </p>

          <p>
            Bei monatlicher Abrechnung läuft der Vertrag auf
            unbestimmte Zeit und kann zum Ende der laufenden
            monatlichen Abrechnungsperiode gekündigt werden, sofern
            beim Vertragsschluss keine abweichende Regelung
            vereinbart wurde.
          </p>

          <p>
            Bei einer jährlichen oder anderen Vertragslaufzeit gelten
            die im Bestellprozess angezeigte Laufzeit und
            Verlängerungsregel.
          </p>

          <p>
            Die Kündigung kann über eine dafür vorgesehene
            Kontofunktion oder per E-Mail an{" "}
            <a href="mailto:info@maler-saas.com">
              info@maler-saas.com
            </a>{" "}
            erfolgen.
          </p>

          <p>
            Das Recht beider Parteien zur außerordentlichen Kündigung
            aus wichtigem Grund bleibt unberührt.
          </p>

          <p>
            Ein wichtiger Grund kann insbesondere bei erheblichem
            Zahlungsverzug, rechtswidriger Nutzung, Angriffen auf die
            Plattform oder einer wiederholten wesentlichen
            Vertragsverletzung vorliegen.
          </p>
        </section>

        <section className="legal-section">
          <h2>21. Datenexport und Löschung</h2>

          <p>
            Der Kunde soll seine Daten vor Vertragsende mithilfe der
            verfügbaren Exportfunktionen sichern.
          </p>

          <p>
            Soweit technisch verfügbar und rechtlich zulässig,
            ermöglicht MalerSaaS dem Kunden für 30 Tage nach
            Vertragsende einen angemessenen Export seiner Daten oder
            stellt diese auf Anfrage in einem gängigen Format bereit.
          </p>

          <p>
            Ein fortgesetzter produktiver Zugang zur Plattform ist
            nach Vertragsende nicht geschuldet.
          </p>

          <p>
            Nach Ablauf der Rückgabefrist werden Kundendaten nach
            Maßgabe der Auftragsverarbeitungsvereinbarung und des
            Löschkonzepts gelöscht oder anonymisiert, soweit keine
            gesetzlichen Aufbewahrungspflichten oder zwingenden
            rechtlichen Gründe entgegenstehen.
          </p>

          <p>
            Sicherungskopien werden innerhalb der regelmäßigen
            Sicherungs- und Löschzyklen überschrieben.
          </p>
        </section>

        <section className="legal-section">
          <h2>22. Änderungen von Preisen und Leistungen</h2>

          <p>
            MalerSaaS darf Preise für zukünftige
            Abrechnungsperioden ändern, wenn sich Kosten,
            Leistungsumfang, Marktbedingungen oder gesetzliche
            Anforderungen ändern.
          </p>

          <p>
            Preisänderungen werden mindestens sechs Wochen vor ihrem
            Wirksamwerden in Textform angekündigt.
          </p>

          <p>
            Bei einer Preiserhöhung oder einer nicht nur
            unerheblichen nachteiligen Änderung wesentlicher
            Leistungen kann der Kunde den Vertrag zum Zeitpunkt des
            Wirksamwerdens der Änderung außerordentlich kündigen.
          </p>

          <p>
            Auf das Kündigungsrecht und die dafür geltende Frist wird
            in der Änderungsmitteilung hingewiesen.
          </p>
        </section>

        <section className="legal-section">
          <h2>23. Änderungen dieser AGB</h2>

          <p>
            MalerSaaS darf diese AGB mit Wirkung für die Zukunft
            ändern, wenn dies aufgrund geänderter Gesetze,
            Rechtsprechung, Sicherheitsanforderungen, technischer
            Entwicklungen oder neuer Funktionen erforderlich ist.
          </p>

          <p>
            Wesentliche Änderungen werden mindestens sechs Wochen vor
            ihrem Inkrafttreten in Textform mitgeteilt.
          </p>

          <p>
            Soweit für eine Änderung eine ausdrückliche Zustimmung
            erforderlich ist, wird diese vom Kunden eingeholt.
          </p>

          <p>
            Andernfalls kann der Kunde den Vertrag bis zum
            Inkrafttreten der Änderung kündigen.
          </p>

          <p>
            Rein redaktionelle Änderungen und Änderungen zugunsten des
            Kunden können mit einer kürzeren Informationsfrist
            erfolgen.
          </p>
        </section>

        <section className="legal-section">
          <h2>24. Haftung</h2>

          <p>
            MalerSaaS haftet unbeschränkt bei Vorsatz, grober
            Fahrlässigkeit, Verletzung von Leben, Körper oder
            Gesundheit, arglistigem Verschweigen eines Mangels,
            ausdrücklich übernommenen Garantien und in Fällen
            zwingender gesetzlicher Haftung.
          </p>

          <p>
            Bei leicht fahrlässiger Verletzung einer wesentlichen
            Vertragspflicht ist die Haftung auf den bei
            Vertragsschluss vorhersehbaren und typischerweise
            eintretenden Schaden begrenzt.
          </p>

          <p>
            Soweit gesetzlich zulässig, ist die Haftung bei leichter
            Fahrlässigkeit je Schadensereignis und insgesamt pro
            Vertragsjahr auf die Nettoentgelte begrenzt, die der Kunde
            in den zwölf Monaten vor dem schadensauslösenden Ereignis
            für den betroffenen Dienst bezahlt hat.
          </p>

          <p>
            Soweit gesetzlich zulässig, haftet MalerSaaS nicht für
            mittelbare Schäden, Folgeschäden, entgangenen Gewinn,
            ausgebliebene Einsparungen oder Betriebsunterbrechungen.
          </p>

          <p>
            Bei Datenverlust ist die Haftung, soweit gesetzlich
            zulässig, auf den typischen Wiederherstellungsaufwand
            begrenzt, der bei angemessener Mitwirkung und
            Datensicherung durch den Kunden entstanden wäre.
          </p>

          <p>
            Zwingende Ansprüche nach dem Datenschutzrecht und anderen
            gesetzlichen Vorschriften bleiben unberührt.
          </p>
        </section>

        <section className="legal-section">
          <h2>25. Höhere Gewalt</h2>

          <p>
            Keine Partei haftet für Verzögerungen oder
            Leistungsausfälle, die durch Ereignisse außerhalb ihres
            zumutbaren Einflussbereichs verursacht werden.
          </p>

          <p>
            Dazu gehören insbesondere Naturereignisse, Krieg,
            Terroranschläge, behördliche Maßnahmen, großflächige
            Energie- oder Netzausfälle, Arbeitskämpfe und
            schwerwiegende Cyberangriffe trotz angemessener
            Schutzmaßnahmen.
          </p>

          <p>
            Dauert eine erhebliche Beeinträchtigung länger als 30
            Tage, kann jede Partei den betroffenen Leistungsteil in
            Textform kündigen.
          </p>

          <p>
            Im Voraus bezahlte Entgelte für danach nicht mehr
            erbrachte Leistungszeiträume werden anteilig erstattet.
          </p>
        </section>

        <section className="legal-section">
          <h2>26. Referenznennung</h2>

          <p>
            MalerSaaS darf den Namen, die Marke oder das Logo eines
            Kunden nur mit dessen vorheriger ausdrücklicher Zustimmung
            als Referenz verwenden.
          </p>

          <p>
            Eine erteilte Zustimmung kann jederzeit mit Wirkung für
            die Zukunft widerrufen werden.
          </p>
        </section>

        <section className="legal-section">
          <h2>27. Mitteilungen und Vertragsübertragung</h2>

          <p>
            Vertragsbezogene Mitteilungen dürfen an die im
            Benutzerkonto hinterlegten E-Mail-Adressen oder über eine
            eindeutig zugeordnete Mitteilungsfunktion erfolgen.
          </p>

          <p>
            Der Kunde ist verpflichtet, seine Kontaktdaten aktuell zu
            halten.
          </p>

          <p>
            Der Kunde darf Rechte und Pflichten aus dem Vertrag nur
            mit vorheriger Zustimmung von MalerSaaS übertragen.
          </p>

          <p>
            MalerSaaS darf den Vertrag im Rahmen einer Übertragung des
            Geschäftsbetriebs oder der Plattform auf einen
            Rechtsnachfolger übertragen, wenn die berechtigten
            Interessen des Kunden gewahrt bleiben.
          </p>
        </section>

        <section className="legal-section">
          <h2>28. Rechtswahl und Gerichtsstand</h2>

          <p>
            Es gilt das Recht des Königreichs Spanien unter Ausschluss
            des UN-Kaufrechts, soweit diese Rechtswahl gesetzlich
            zulässig ist.
          </p>

          <p>
            Zwingende gesetzliche Vorschriften, die unabhängig von
            dieser Rechtswahl gelten, bleiben unberührt.
          </p>

          <p>
            Für sämtliche Streitigkeiten aus oder im Zusammenhang mit
            diesem Vertrag sind, soweit eine entsprechende
            Gerichtsstandsvereinbarung wirksam getroffen werden kann,
            ausschließlich die sachlich zuständigen Gerichte in Palma
            de Mallorca, Spanien, zuständig.
          </p>

          <p>
            Bei Kunden mit Sitz in der Schweiz gilt diese Rechts- und
            Gerichtsstandsklausel nur im gesetzlich zulässigen Umfang
            und vorbehaltlich zwingender schweizerischer und
            international-privatrechtlicher Vorschriften.
          </p>
        </section>

        <section className="legal-section">
          <h2>29. Schlussbestimmungen</h2>

          <p>
            Der Vertrag besteht aus der Bestellung, der jeweiligen
            Leistungsbeschreibung, diesen AGB und einer
            gegebenenfalls abgeschlossenen
            Auftragsverarbeitungsvereinbarung.
          </p>

          <p>
            Individuelle Vereinbarungen zwischen MalerSaaS und dem
            Kunden haben Vorrang.
          </p>

          <p>
            Änderungen und Ergänzungen des Vertrags bedürfen
            mindestens der Textform, soweit gesetzlich keine strengere
            Form vorgeschrieben ist.
          </p>

          <p>
            Sollte eine Bestimmung dieser AGB ganz oder teilweise
            unwirksam oder undurchführbar sein, bleibt der übrige
            Vertrag wirksam. An die Stelle der unwirksamen Bestimmung
            tritt die gesetzliche Regelung.
          </p>

          <p>
            Maßgeblich ist die bei Vertragsschluss vereinbarte
            deutsche Fassung. Übersetzungen dienen ausschließlich der
            besseren Verständlichkeit, sofern sie nicht ausdrücklich
            als verbindlich vereinbart wurden.
          </p>
        </section>
      </div>
    </div>
  );
}