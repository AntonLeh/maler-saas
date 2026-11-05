-- =====================================================================
-- Buchhaltung Schritt 3: Umsatzsteuer-Übersicht
-- Versteuerungsart des Betriebs: 'soll' (nach Rechnungsdatum, Standard) oder 'ist' (nach Zahlungseingang).
-- Kann mehrfach ausgeführt werden.
-- =====================================================================
alter table public.company_settings
  add column if not exists tax_method text not null default 'soll';

do $$ begin
  alter table public.company_settings add constraint company_settings_tax_method_chk check (tax_method in ('soll', 'ist'));
exception when duplicate_object then null; end $$;
