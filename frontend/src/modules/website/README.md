# Modul: Website (ab Tarif Professional)

Jeder Betrieb bekommt eine fertige, für Handy und Google optimierte Firmen-Website, die er in der App gestaltet.

## Bausteine

| Teil | Ort |
| --- | --- |
| Datenbank, öffentliche Funktionen, Bildspeicher | `supabase/migrations/20261031120000_website.sql` |
| Öffentliche Seite (Server-HTML) | `frontend/api/site.ts` + Rewrites in `frontend/vercel.json` |
| Editor in der App | `frontend/src/modules/website/` |

## Funktionen

- **Gestaltung:** 3 Vorlagen (Klassisch, Modern, Frisch), Hauptfarbe, Titelbild, Stärken, Leistungen, Über uns,
  Einsatzgebiet, Erreichbarkeit, Bereiche ein/aus, Google-Titel und -Beschreibung, Web-Adresse.
  Logo, Telefon, Adresse kommen aus `company_settings`.
- **Referenzen:** aus Baustellenbildern eines Auftrags oder eigenen Fotos. Bilder werden im Browser verkleinert und neu
  kodiert (entfernt EXIF/GPS) und in den öffentlichen Bucket `website-media` kopiert. Veröffentlichen nur mit bestätigter
  Zustimmung des Kunden (auch in der Datenbank erzwungen). Nur Ort, keine Adresse.
- **Anfragen:** Kontaktformular → Tabelle `website_leads` (Spam-Schutz: verstecktes Feld, Mindestzeit, max. 30/Stunde),
  optional E-Mail an den Betrieb über Brevo.
- **Impressum und Datenschutz** werden erzeugt (Vorlage, ohne Gewähr). Keine Cookies, kein Tracking, keine externen Schriften.
- **SEO:** Server-HTML, Titel/Beschreibung, Canonical, Open Graph, JSON-LD `HousePainter`, `sitemap.xml`, `robots.txt`.
- Unveröffentlichte Website nur per Vorschau-Link (`?vorschau=<token>`, `noindex`). Ohne aktives Abo ist die Seite offline.

## Adressen

- `https://maler-saas.com/w/<slug>` (Start), `/impressum`, `/datenschutz`
- Später möglich: `<slug>.maler-saas.com` und eigene Domains (Spalte `custom_domain` ist vorbereitet).

## Einrichtung

1. SQL-Datei `supabase/migrations/20261031120000_website.sql` im Supabase SQL-Editor ausführen.
2. Optional in Vercel (Project → Settings → Environment Variables) für E-Mails bei neuen Anfragen:
   `BREVO_API_KEY`, `BREVO_SENDER_EMAIL`.
3. Branch pushen → Vercel erstellt eine Vorschau-Version, dort `/w/<slug>?vorschau=…` testen.
