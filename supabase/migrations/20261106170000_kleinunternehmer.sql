-- =====================================================================
-- Kleinunternehmer / nicht MWST-pflichtig (Deutschland § 19 UStG, Österreich § 6 Abs. 1 Z 27 UStG, Schweiz)
-- Schalter in den Einstellungen. Wird beim Erstellen einer Rechnung mit eingefroren (snapshot)
-- und sorgt für den Pflichthinweis „keine Umsatzsteuer“ auf der Rechnung.
-- Nur eine neue Spalte – bestehende Daten bleiben unverändert. Kann mehrfach ausgeführt werden.
-- =====================================================================

alter table public.company_settings
  add column if not exists small_business boolean not null default false;
