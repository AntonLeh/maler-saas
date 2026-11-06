-- =====================================================================
-- Steuerabrechnung Schweiz: Abrechnungsmethode (effektiv / Saldosteuersatz) und bewilligter Saldosteuersatz
-- Format: {"ch_method": "effective" | "saldo", "saldo_rate": 5.3}
-- Nur eine neue Spalte – bestehende Daten bleiben unverändert. Kann mehrfach ausgeführt werden.
-- =====================================================================

alter table public.company_settings
  add column if not exists vat_report jsonb;
