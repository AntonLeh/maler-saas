-- =====================================================================
-- Versand von Rechnungen und Mahnungen per E-Mail (über Brevo)
-- Protokoll: wann welche Rechnung/Mahnung an wen ging (Nachweis).
-- Eintragen darf nur die Funktion „send-document“ (Dienstkonto), lesen nur Admins des Betriebs.
-- Nur neue Tabelle – bestehende Daten bleiben unverändert. Kann mehrfach ausgeführt werden.
-- =====================================================================

create table if not exists public.document_emails (
  id bigserial primary key,
  tenant_id bigint not null references public.tenants(id) on delete cascade,
  kind text not null check (kind in ('invoice', 'reminder')),
  invoice_id bigint references public.invoices(id) on delete set null,
  reminder_id bigint,
  recipient text not null,
  copy_to text,
  subject text not null,
  attachments text[] not null default '{}',
  provider_message_id text,
  sent_by bigint,
  sent_at timestamptz not null default now()
);

create index if not exists document_emails_tenant_idx on public.document_emails (tenant_id, sent_at desc);
create index if not exists document_emails_invoice_idx on public.document_emails (invoice_id);

alter table public.document_emails enable row level security;

drop policy if exists document_emails_select on public.document_emails;
create policy document_emails_select on public.document_emails
  for select using (public.website_is_admin(tenant_id));
-- keine Insert/Update/Delete-Regeln: Einträge nur über die Funktion, nicht änderbar
