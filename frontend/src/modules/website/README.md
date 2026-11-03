# Modul: Website (ab Tarif Professional)

Jeder Betrieb bekommt eine fertige, für Handy und Google optimierte Firmen-Website, die er in der App gestaltet.

## Bausteine

| Teil | Ort |
| --- | --- |
| Datenbank, öffentliche Funktionen, Bildspeicher | `supabase/migrations/20261031120000_website.sql` |
| Kundenbewertungen auf der Website | `supabase/migrations/20261101120000_website_bewertungen.sql` |
| Kontaktformular mit Leistungen und Fotos | `supabase/migrations/20261102120000_website_anfragen_fotos.sql` |
| Öffentliche Seite (Server-HTML) | `frontend/api/site.ts` + Rewrites in `frontend/vercel.json` |
| Editor in der App | `frontend/src/modules/website/` |

## Funktionen

- **Gestaltung:** 3 Vorlagen (Klassisch, Modern, Frisch), Hauptfarbe, Titelbild, Stärken, Leistungen, Über uns,
  Einsatzgebiet, Erreichbarkeit, Bereiche ein/aus, Google-Titel und -Beschreibung, Web-Adresse.
  Logo, Telefon, Adresse kommen aus `company_settings`.
- **Referenzen:** aus Baustellenbildern eines Auftrags oder eigenen Fotos. Bilder werden im Browser verkleinert und neu
  kodiert (entfernt EXIF/GPS) und in den öffentlichen Bucket `website-media` kopiert. Veröffentlichen nur mit bestätigter
  Zustimmung des Kunden (auch in der Datenbank erzwungen). Nur Ort, keine Adresse.
- **Kundenbewertungen:** aus dem Kundenportal (`customer_reviews`, unverändert). Der Kunde kann beim Bewerten freiwillig
  ankreuzen, dass Sterne und Kommentar mit „Vorname N., Ort“ auf der Website erscheinen dürfen (`website_review_consents`,
  Wortlaut wird gespeichert). Der Betrieb gibt einzelne Bewertungen frei, kann Texte aber nicht ändern. Der Durchschnitt
  wird immer aus allen Bewertungen berechnet. Mitarbeiterbewertungen sind nie öffentlich. Bereich erscheint ab einer
  freigegebenen Bewertung oder ab 3 Bewertungen.
- **Leistungen mit Symbolen:** Symbol wird anhand des Namens gewählt oder im Editor festgelegt (`services[].icon`).
  Die Symbol-Liste steht doppelt: `SERVICE_ICONS` in `frontend/api/site.ts` und `ServiceIcon.tsx` (gleiche Schlüssel).
- **Eigene Seite pro Leistung:** `/w/<slug>/<leistung>` (z. B. `/fassadenanstrich`), H1 „Leistung in Ort und Umgebung“,
  eigener Text (`services[].details`) oder Standardtext je Symbol, „Das ist enthalten“ (`included`), häufige Fragen
  (`faq`, JSON-LD `FAQPage`), eigenes Bild (`image`), passende Referenzen, Bewertungen, Formular mit vorausgewählter
  Leistung, JSON-LD `Service`, in `sitemap.xml`. Nach Umbenennen leiten alte Adressen (`aliases`) per 301 weiter.
  Vorschlagstexte stehen nur in `site.ts`; der Editor holt sie über `/api/site?action=vorschlaege&icon=…`. Bewusst keine Seiten pro Ort (Google wertet viele
  fast gleiche Ortsseiten als Brückenseiten ab).
- **Projektseiten:** `/<slug>/projekt-<titel>-<id>` mit Galerie (Vollbild), Vorher/Nachher-Regler (Bilder mit `kind`
  vorher/nachher), passender Leistung, weiteren Projekten, Formular; in `sitemap.xml`, alter Titel → 301.
- **So läuft's ab:** fester Bereich mit 4 Schritten, abschaltbar (`sections.process`).
- **Anfragen:** Kontaktformular → Tabelle `website_leads`, Leistungen zum Anklicken (`services`), bis zu 3 Fotos
  (im Browser auf 1600 px verkleinert, ohne EXIF/GPS; Tabelle `website_lead_photos`, werden mit der Anfrage gelöscht;
  hängen auch an der E-Mail). Ohne das Datenbank-Update fällt das Formular automatisch
  auf die alte Funktion zurück (ohne Fotos). Spam-Schutz: verstecktes Feld, Mindestzeit, max. 30/Stunde.
  Optional E-Mail an den Betrieb über Brevo.
- **Impressum und Datenschutz** werden erzeugt (Vorlage, ohne Gewähr). Keine Cookies, kein Tracking, keine externen Schriften.
- **SEO:** Server-HTML, Titel/Beschreibung, Canonical, Open Graph, JSON-LD `HousePainter`, `sitemap.xml`, `robots.txt`.
- Unveröffentlichte Website nur per Vorschau-Link (`?vorschau=<token>`, `noindex`). Ohne aktives Abo ist die Seite offline.

## KI-Schreibhilfe

„✨ Mit KI schreiben“ bei jeder Leistung (Kurztext, ausführlicher Text, Enthalten, Fragen), bei „Über uns“ und für
Überschrift/Google-Texte. Supabase-Funktion `supabase/functions/website-ai-text` (Anthropic Messages API, Ausgabe über
erzwungenes Werkzeug als JSON). Nur Admins, ab Professional, Monatslimit pro Betrieb (Tabelle `website_ai_usage`,
`supabase/migrations/20261102140000_website_ki_texte.sql`). Betriebsdaten kommen aus der Datenbank, nicht vom Browser.
Vorschläge werden erst nach „Übernehmen“ + „Speichern“ gespeichert.

Secrets: `ANTHROPIC_API_KEY` (Pflicht), `WEBSITE_AI_MODEL` (Standard `claude-sonnet-5-5`), `WEBSITE_AI_MONTHLY_LIMIT` (Standard 40).
Deploy: `npx supabase functions deploy website-ai-text --no-verify-jwt`

## Besucherzähler

Kleines Skript auf jeder Seite (`countScript` in `site.ts`) meldet per `sendBeacon` Seite + grobe Herkunft
(google/bing/social/direkt/andere) an `/api/site?action=hit` → `website_track`. Keine Cookies, keine IP, nur Tagessummen
(Tabelle `website_stats`, 13 Monate). Automatisierte Browser (`navigator.webdriver`) und die Vorschau zählen nicht.
Auswertung in der App unter Website → Statistik (`website_admin_stats`). Migration `20261103140000_website_statistik.sql`.

maler-saas.com selbst: Vercel Web Analytics (`@vercel/analytics` in `src/main.tsx`), ohne angemeldete Nutzer und
Kundenportal, URLs ohne Parameter. Muss im Vercel-Projekt unter „Analytics“ eingeschaltet werden.

## Eigene Adressen

- `betrieb.maler-saas.com`: `frontend/proxy.ts` (Vercel Routing Middleware, eingetragen in `vercel.json`) leitet Anfragen an
  Subdomains und fremde Domains intern an `/api/site?host=…&page=…`. maler-saas.com, www und *.vercel.app bleiben unberührt.
- Hauptadresse: eigene Domain (aktiv) > Subdomain (wenn `SITE_SUBDOMAINS=1` in Vercel und `SUBDOMAINS_ENABLED` in
  `types.ts`) > `maler-saas.com/w/<slug>`. Alle anderen Adressen leiten per 301 dorthin; die Vorschau (`?vorschau=`) nie.
- Eigene Domain: Funktion `supabase/functions/website-domain` (Vercel-API: Domain + Weiterleitung ohne/mit www, Prüfung,
  DNS-Anleitung). Spalten `custom_domain*` (`supabase/migrations/20261103120000_website_domains.sql`) sind gegen direkte
  Änderung durch Admins geschützt. Secrets: `VERCEL_TOKEN`, `VERCEL_PROJECT_ID`, optional `VERCEL_TEAM_ID`.

## Adressen

- `https://maler-saas.com/w/<slug>` (Start), `/impressum`, `/datenschutz`, `/<leistung>`
- Später möglich: `<slug>.maler-saas.com` und eigene Domains (Spalte `custom_domain` ist vorbereitet).

## Einrichtung

1. SQL-Dateien `supabase/migrations/20261031120000_website.sql` und `20261101120000_website_bewertungen.sql` und `20261102120000_website_anfragen_fotos.sql` im Supabase SQL-Editor ausführen.
2. Optional in Vercel (Project → Settings → Environment Variables) für E-Mails bei neuen Anfragen:
   `BREVO_API_KEY`, `BREVO_SENDER_EMAIL`.
3. Branch pushen → Vercel erstellt eine Vorschau-Version, dort `/w/<slug>?vorschau=…` testen.
