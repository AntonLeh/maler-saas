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
