# Modul Fachkräfte-Pool

- Öffentlich: `/fachkraefte` (Anmeldung), `/fachkraefte/profil?t=…` (eigenes Profil, Link aus E-Mail), `/fachkraefte/anfrage?t=…` (Kontaktanfrage beantworten). Eingebunden in `App.tsx` über den Pfad.
- App: Modul „Fachkräfte“ (Dashboard-Button) für Admins mit laufendem Abo: Suche im Umkreis, Kontakt anfragen, „Meine Anfragen“.
- Server: Edge-Funktion `talent-pool` (`--no-verify-jwt`), Tabellen aus `20261103240000_fachkraefte_pool.sql` (nur Service-Rolle).
- Datenschutz: Betriebe sehen kein Name/Kontakt/PLZ, nur Ort + gerundete Entfernung. Kontaktdaten erst nach Zustimmung.
- Fristen: unbestätigt 7 Tage, sichtbar 90 Tage nach letzter Bestätigung (Erinnerung nach 42 Tagen), Löschung nach 12 Monaten.
- Postleitzahl → Koordinaten über die eingebaute Tabelle `supabase/functions/talent-pool/plz.ts` (WZB plz_geocoord, Apache 2.0; Ortsnamen © OpenStreetMap, ODbL). Die Tabelle `talent_geo_cache` wird derzeit nicht genutzt.
