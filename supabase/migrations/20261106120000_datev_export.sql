-- =====================================================================
-- Buchhaltung Schritt 5: Steuerberater-Paket + DATEV-Export
-- Einstellungen für den DATEV-Export (Berater-/Mandantennummer, Kontenrahmen, Kontenzuordnung) je Betrieb.
-- Kann mehrfach ausgeführt werden.
-- =====================================================================
alter table public.company_settings
  add column if not exists datev_settings jsonb;
