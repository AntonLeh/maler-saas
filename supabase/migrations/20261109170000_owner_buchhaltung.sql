-- Owner-Buchhaltung Spanien (autónomo) – 09.11.2026
-- Einnahmen kommen aus Stripe (Edge Function owner-books), Ausgaben erfasst der Plattform-Inhaber selbst.
-- Zugriff ausschließlich für den Plattform-Inhaber (Rolle 1).

create table if not exists public.owner_income (
  id bigserial primary key,
  stripe_id text not null unique,
  kind text not null default 'invoice' check (kind in ('invoice', 'credit_note')),
  number text,
  issue_date date not null,
  paid_at timestamptz,
  customer_name text,
  customer_email text,
  customer_country text,
  customer_tax_id text,
  tenant_id bigint,
  currency text not null default 'EUR',
  net numeric(12,2) not null default 0,
  tax numeric(12,2) not null default 0,
  total numeric(12,2) not null default 0,
  fx_rate numeric(14,6) not null default 1,
  net_eur numeric(12,2) not null default 0,
  tax_eur numeric(12,2) not null default 0,
  total_eur numeric(12,2) not null default 0,
  tax_rate numeric(6,2),
  tax_country text,
  taxability text,
  treatment text not null default 'es' check (treatment in ('es', 'eu_b2b', 'eu_no_vat_id', 'oss', 'non_eu', 'other')),
  description text,
  invoice_pdf text,
  retencion numeric(12,2) not null default 0,
  treatment_locked boolean not null default false,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
create index if not exists owner_income_date_idx on public.owner_income (issue_date);

create table if not exists public.owner_expenses (
  id bigserial primary key,
  issue_date date not null,
  supplier text not null,
  supplier_country text,
  supplier_tax_id text,
  invoice_number text,
  category text not null default 'sonstiges',
  treatment text not null default 'es_iva' check (treatment in ('es_iva', 'eu_isp', 'non_eu_isp', 'sin_iva')),
  currency text not null default 'EUR',
  amount_original numeric(12,2),
  net numeric(12,2) not null,
  iva_rate numeric(6,2) not null default 21,
  iva numeric(12,2) not null default 0,
  total numeric(12,2) not null default 0,
  iva_deductible boolean not null default true,
  irpf_deductible boolean not null default true,
  note text,
  file_path text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
create index if not exists owner_expenses_date_idx on public.owner_expenses (issue_date);

create table if not exists public.owner_book_settings (
  id int primary key default 1 check (id = 1),
  nif text,
  full_name text,
  address text,
  difficult_pct numeric(5,2) not null default 5,
  difficult_cap numeric(10,2) not null default 2000,
  minoracion numeric(6,2) not null default 100,
  books_start date not null default date '2026-11-03',
  last_sync_at timestamptz,
  updated_at timestamptz not null default now()
);
insert into public.owner_book_settings (id) values (1) on conflict (id) do nothing;

alter table public.owner_income enable row level security;
alter table public.owner_expenses enable row level security;
alter table public.owner_book_settings enable row level security;

drop policy if exists owner_income_all on public.owner_income;
create policy owner_income_all on public.owner_income for all to authenticated
  using (public.current_role_id() = 1) with check (public.current_role_id() = 1);

drop policy if exists owner_expenses_all on public.owner_expenses;
create policy owner_expenses_all on public.owner_expenses for all to authenticated
  using (public.current_role_id() = 1) with check (public.current_role_id() = 1);

drop policy if exists owner_book_settings_all on public.owner_book_settings;
create policy owner_book_settings_all on public.owner_book_settings for all to authenticated
  using (public.current_role_id() = 1) with check (public.current_role_id() = 1);

-- Ablage für Ausgaben-Belege (privat)
insert into storage.buckets (id, name, public)
values ('owner-receipts', 'owner-receipts', false)
on conflict (id) do nothing;

drop policy if exists owner_receipts_all on storage.objects;
create policy owner_receipts_all on storage.objects for all to authenticated
  using (bucket_id = 'owner-receipts' and public.current_role_id() = 1)
  with check (bucket_id = 'owner-receipts' and public.current_role_id() = 1);
