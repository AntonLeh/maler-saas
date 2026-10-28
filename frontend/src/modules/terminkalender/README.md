# Modul: Terminkalender

Admin plant Termine und leitet sie an Projektleiter weiter. Der Projektleiter bestätigt oder lehnt ab.

## Einrichtung (einmalig)

1. Supabase Dashboard → **SQL Editor** → Inhalt von
   `supabase/migrations/20261028120000_terminkalender.sql` einfügen → **Run**.
   Legt nur die neue Tabelle `appointments` und die Funktion `appointment_respond` an.
   Bestehende Tabellen werden nicht verändert.
2. Frontend deployen wie gewohnt.

## Funktionen

**Admin** (Kachel „Termine (7 Tage)“ im Dashboard)
- Monats-, Wochen- und Listenansicht, Filter nach Projektleiter
- Termin anlegen, bearbeiten, absagen, löschen
- Optional mit Kunde und Auftrag verknüpfen (Adresse wird übernommen)
- An Projektleiter weiterleiten, mit Hinweis
- Wird ein weitergeleiteter Termin zeitlich oder örtlich geändert, bekommt der Projektleiter ihn automatisch erneut zur Bestätigung

**Projektleiter** (Button „Meine Termine“ im Projektleiter-Dashboard)
- Offene Anfragen bestätigen oder mit Begründung ablehnen
- Bestätigte Termine nachträglich absagen („Doch nicht möglich?“)

**Benachrichtigung:** Weiterleiten, Antworten und Absagen erzeugen eine Nachricht im bestehenden
Nachrichtensystem (Tabelle `messages`), also mit dem vorhandenen Ungelesen-Zähler.

## Status

`geplant` → `weitergeleitet` → `bestaetigt` / `abgelehnt`, jederzeit `abgesagt`

## Dateien

| Datei | Inhalt |
| --- | --- |
| `index.ts` | Öffentliche Schnittstelle des Moduls |
| `TerminkalenderPage.tsx` | Admin-Kalender |
| `MeineTerminePage.tsx` | Projektleiter-Ansicht |
| `AppointmentForm.tsx` / `AppointmentDetails.tsx` | Formular und Detailansicht |
| `CalendarViews.tsx` | Monat / Woche / Liste |
| `widgets.tsx` | Dashboard-Kachel und Button |
| `api.ts` | Alle Supabase-Zugriffe |
| `terminkalender.css` | Styles, alle mit Präfix `tk-` |

## Einbindung in bestehende Dateien

Nur ergänzt, nichts umgeschrieben:
- `App.tsx`: Import, zwei Seitennamen (`terminkalender`, `meine-termine`), Kachel im Admin-Dashboard, Anzeige der beiden Seiten, zwei Props an das Projektleiter-Dashboard
- `pages/ProjectManagerDashboard.tsx`: zwei optionale Props und der Button „Meine Termine“

Zum Entfernen: diese Stellen löschen und den Ordner `modules/terminkalender` entfernen.
