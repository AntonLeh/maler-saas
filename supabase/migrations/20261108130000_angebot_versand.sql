-- =====================================================================
-- Angebote per E-Mail versenden: Versandprotokoll um Angebote erweitern
--  * neue Spalte quote_id
--  * erlaubte Arten: Rechnung, Mahnung und jetzt auch Angebot
-- Bestehende Einträge bleiben unverändert. Kann mehrfach ausgeführt werden.
-- =====================================================================

alter table public.document_emails
  add column if not exists quote_id bigint references public.quotes(id) on delete set null;

alter table public.document_emails drop constraint if exists document_emails_kind_check;
alter table public.document_emails
  add constraint document_emails_kind_check check (kind in ('invoice', 'reminder', 'quote'));

create index if not exists document_emails_quote_idx on public.document_emails (quote_id);
