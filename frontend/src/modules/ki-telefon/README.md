# Modul: KI-Telefon (nur Business / Enterprise)

Eine Sprach-KI nimmt Anrufe an, wenn im Betrieb niemand abhebt, vergibt Besichtigungstermine direkt in den
Terminkalender und notiert Rückrufwünsche.

## Bausteine

| Teil | Ort |
| --- | --- |
| Datenbank | `supabase/migrations/20261028140000_ki_telefon.sql` |
| Schnittstelle für den KI-Anbieter | `supabase/functions/ai-phone/` (`index.ts`, Terminlogik in `slots.ts`) |
| Admin-Oberfläche | `frontend/src/modules/ki-telefon/` |

Unterstützte Anbieter: **ElevenLabs Agents**, **Retell AI**, **Vapi**. Die genauen Adressen, den System-Prompt und
die Werkzeug-Definitionen zeigt die App unter *KI-Telefon → Einrichtung*.

## Einrichtung

1. SQL-Datei im Supabase SQL-Editor ausführen (fügt neue Tabellen hinzu und 3 Spalten in `appointments`).
2. Schnittstelle veröffentlichen:
   ```bash
   npx supabase login
   npx supabase link --project-ref udzgxfjmpeygylgrcdsc
   npx supabase functions deploy ai-phone --no-verify-jwt
   ```
   `--no-verify-jwt` ist nötig, weil der KI-Anbieter kein Supabase-Login hat. Geschützt ist die Schnittstelle
   über den geheimen Schlüssel pro Betrieb (`webhook_key`) in der Adresse.
3. In der App: *KI-Telefon → Einstellungen* einschalten, Zeiten festlegen.
4. *Einrichtung*: Adressen, Prompt und Werkzeuge beim Anbieter eintragen.
5. Rufumleitung der Betriebsnummer auf die KI-Nummer.

## Automatische Einrichtung (empfohlen)

Alle KI-Assistenten laufen zentral über **ein** ElevenLabs-Konto des Plattform-Betreibers.
Der Kunde klickt unter *KI-Telefon → Einrichtung* auf **„KI-Telefon aktivieren“**; die Schnittstelle legt dann
Agent und Werkzeuge per ElevenLabs-API an (bzw. aktualisiert sie beim Speichern der Einstellungen).

Einmalig einrichten:
1. SQL-Datei `supabase/migrations/20261029120000_ki_telefon_agent.sql` ausführen.
2. Secrets setzen und Schnittstelle neu veröffentlichen:
   ```bash
   npx supabase secrets set ELEVENLABS_API_KEY=<schlüssel> ELEVENLABS_TEMPLATE_AGENT_ID=<agent-id-der-vorlage> AI_PHONE_HOOK_TOKEN=<zufällig, min. 24 Zeichen> --project-ref udzgxfjmpeygylgrcdsc
   npx supabase functions deploy ai-phone --no-verify-jwt --project-ref udzgxfjmpeygylgrcdsc
   ```
   - Der **Vorlage-Agent** liefert Stimme und KI-Modell. Ändert man dort die Stimme, übernehmen alle Kunden sie beim nächsten „Aktualisieren“.
   - Alternativ ohne Vorlage: `ELEVENLABS_VOICE_ID` und optional `ELEVENLABS_LLM` (Standard `gemini-2.5-flash`).
3. In ElevenLabs einmalig den **Post-Call-Webhook** (Workspace-Einstellungen) auf
   `https://udzgxfjmpeygylgrcdsc.supabase.co/functions/v1/ai-phone?hook=<AI_PHONE_HOOK_TOKEN>` setzen.
   Der Betrieb wird über die `agent_id` erkannt (Tabelle `ai_phone_agents`).

Der ElevenLabs-API-Schlüssel braucht Schreibrechte für Agents/ElevenAgents (Agents und Tools).

## Preise und Minuten-Guthaben

| Paket | Preis (netto) | Inhalt |
| --- | --- | --- |
| Einrichtung (einmalig) | 49 € | Assistent, Telefonnummer, 300 Minuten |
| 300 Minuten | 45 € | |
| 1.000 Minuten | 135 € | |

- Bezahlung über Stripe Checkout (Funktion `ai-phone-billing`, eigener Webhook-Endpunkt).
- Guthaben in `ai_phone_billing`, jede Bewegung in `ai_minute_ledger` (doppelte Buchungen ausgeschlossen).
- Abbuchung sekundengenau nach jedem Gespräch (Post-Call-Webhook). Minuten verfallen nicht.
- Ohne bezahlte Einrichtung oder bei Guthaben ≤ 0: KI entschuldigt sich kurz und legt auf.
- E-Mail an den Betrieb bei 50 Restminuten und bei 0.
- Der bestehende `stripe-webhook` überspringt Zahlungen mit `metadata.kind = "ai_minutes"` (eine ergänzte Abfrage).

Einrichtung:
1. SQL-Datei `supabase/migrations/20261029140000_ki_telefon_guthaben.sql` ausführen.
2. In Stripe drei Preise anlegen (einmalig, EUR, netto) und einen Webhook-Endpunkt
   `https://udzgxfjmpeygylgrcdsc.supabase.co/functions/v1/ai-phone-billing?action=webhook`
   für `checkout.session.completed` und `checkout.session.async_payment_succeeded`.
3. Secrets setzen und veröffentlichen:
   ```bash
   npx supabase secrets set STRIPE_PRICE_AI_SETUP=price_… STRIPE_PRICE_AI_300=price_… STRIPE_PRICE_AI_1000=price_… STRIPE_AI_WEBHOOK_SECRET=whsec_… --project-ref udzgxfjmpeygylgrcdsc
   npx supabase functions deploy stripe-webhook --project-ref udzgxfjmpeygylgrcdsc
   npx supabase functions deploy ai-phone-billing --no-verify-jwt --project-ref udzgxfjmpeygylgrcdsc
   npx supabase functions deploy ai-phone --no-verify-jwt --project-ref udzgxfjmpeygylgrcdsc
   ```
   Optional `STRIPE_AUTOMATIC_TAX=true`, wenn Stripe Tax genutzt wird.
4. Gutschrift von Hand (z. B. Kulanz, Test):
   ```sql
   select * from ai_minutes_apply(<tenant_id>, 300*60, 'korrektur', 'gutschrift-<datum>-1', 0, 'EUR', false, 'Kulanz');
   ```

## Telefonnummer (Twilio, Deutschland)

Jeder Betrieb bekommt eine **Ortsnummer mit seiner eigenen Vorwahl**. Der Admin beantragt sie unter
*KI-Telefon → Einrichtung → Telefonnummer* (Betriebsdaten + Nachweis hochladen). Die Funktion `ai-phone-number`
reicht alles bei Twilio ein; nach der Freigabe (meist 1–3 Werktage) wird automatisch eine passende Nummer gekauft,
bei ElevenLabs importiert und dem Assistenten zugeordnet. Der Betrieb bekommt eine E-Mail und sieht in der App eine
Anleitung zur Rufumleitung.

- Nachweise: Handelsregisterauszug (≤ 3 Monate) **oder** Gewerbeanmeldung + Schreiben vom Finanzamt mit Steuernummer.
  Die Adresse muss im Ortsnetz der Vorwahl liegen und genau mit dem Nachweis übereinstimmen.
- Die Dateien werden **nicht** in Supabase gespeichert, sondern direkt an Twilio übergeben.
- Pflichtfelder liest die Funktion zur Laufzeit aus dem Twilio-Regelwerk (DE/local/business). Vor dem Einreichen prüft
  Twilio die Unterlagen automatisch (Evaluation); fehlt etwas, sieht der Admin die Meldung und kann korrigieren.
- Plattform-Inhaber (role_id 1) kann das aktuelle Regelwerk abrufen: `ai-phone-number?action=requirements`.

Voraussetzung: Twilio-Konto mit **freigegebenem** Primary Business Profile (ISV) und Guthaben.

Einrichtung:
1. SQL-Datei `supabase/migrations/20261030120000_ki_telefon_nummer.sql` ausführen.
2. Secrets setzen und veröffentlichen:
   ```bash
   npx supabase secrets set TWILIO_ACCOUNT_SID=AC… TWILIO_AUTH_TOKEN=… TWILIO_NOTIFY_EMAIL=<deine E-Mail> --project-ref udzgxfjmpeygylgrcdsc
   npx supabase functions deploy ai-phone-number --no-verify-jwt --project-ref udzgxfjmpeygylgrcdsc
   npx supabase functions deploy ai-phone --no-verify-jwt --project-ref udzgxfjmpeygylgrcdsc
   ```
   `AI_PHONE_HOOK_TOKEN` (vorhanden) schützt den Status-Callback von Twilio.

Kosten: Ortsnummer ca. 1,35 $/Monat bei Twilio (im Business-Tarif enthalten), Gespräche laufen über ElevenLabs.

## Werkzeuge der KI

| Werkzeug | Zweck |
| --- | --- |
| `get_free_slots` | freie Besichtigungstermine (berücksichtigt Zeitfenster, bestehende Termine, Puffer, Vorlauf) |
| `book_appointment` | Termin eintragen (`source = 'ki_telefon'`, Status *geplant*), prüft erneut auf Doppelbuchung |
| `create_callback` | Rückrufwunsch speichern |
| `get_company_info` | Betriebsdaten (für Vapi, sonst über den Gesprächsbeginn) |

## Sicherheit und Regeln

- Zugriff nur bei Tarif *business* oder *enterprise* mit Status *active* oder *trialing*, wird in der Schnittstelle geprüft.
- Die KI bucht nur in freigegebene Zeitfenster. Ihre Termine erscheinen mit 🤖 im Kalender und müssen vom Admin
  an einen Projektleiter weitergeleitet werden.
- Die Begrüßung muss den Hinweis auf die KI enthalten (EU AI Act Art. 50, seit 2. August 2026). Die Einstellungsseite
  erzwingt das.
- Es werden keine Aufnahmen gespeichert, nur Zusammenfassung, Dauer und Ergebnis.

## Benachrichtigung

Neue Rückrufe und KI-Termine erscheinen als Zähler am Button *KI-Telefon* im Admin-Dashboard.

Zusätzlich per **E-Mail und/oder SMS** über [Brevo](https://www.brevo.com) (EU-Anbieter, Server in FR/DE),
pro Betrieb einstellbar unter *KI-Telefon → Einstellungen → Benachrichtigungen*.

Einrichtung:
1. SQL-Datei `supabase/migrations/20261028180000_ki_telefon_benachrichtigung.sql` ausführen.
2. Brevo-Konto anlegen, Absender-E-Mail bestätigen, API-Schlüssel erzeugen. Für SMS: SMS-Guthaben kaufen.
3. Secrets setzen und Schnittstelle neu veröffentlichen:
   ```bash
   npx supabase secrets set BREVO_API_KEY=<schlüssel> BREVO_SENDER_EMAIL=<absender@domain.de> --project-ref udzgxfjmpeygylgrcdsc
   npx supabase functions deploy ai-phone --no-verify-jwt --project-ref udzgxfjmpeygylgrcdsc
   ```
   Optional: `BREVO_SENDER_NAME`, `BREVO_SMS_SENDER` (max. 11 Zeichen), `APP_URL`.
4. In der App E-Mail/Handynummer eintragen, speichern, „Test-Benachrichtigung senden“.

Schlägt der Versand fehl, wird der Rückruf/Termin trotzdem gespeichert (Fehler stehen im Log der Edge Function).
