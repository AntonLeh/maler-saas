-- =====================================================================
-- Belege & Ausgaben: Fremdwährungen
--  gross_amount/tax_amount/net_amount bleiben in der Währung des Betriebs (EUR bzw. CHF),
--  dazu Originalbetrag + Währung des Belegs + verwendeter Kurs (EZB-Referenzkurs oder eigener Betrag).
-- Kann mehrfach ausgeführt werden.
-- =====================================================================
alter table public.expenses
  add column if not exists original_currency text,
  add column if not exists original_amount numeric(12,2),
  add column if not exists exchange_rate numeric(14,6);

do $$ begin
  alter table public.expenses add constraint expenses_currency_chk check (original_currency is null or original_currency ~ '^[A-Z]{3}$');
exception when duplicate_object then null; end $$;
