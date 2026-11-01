-- =====================================================================
-- KI-Telefon: Minuten-Guthaben
-- Neue Tabellen + eine Buchungsfunktion. Bestehende Tabellen bleiben unverändert.
-- Buchen darf nur die Schnittstelle (Service-Key); Admins sehen ihren Kontostand.
-- Kann gefahrlos mehrfach ausgeführt werden.
-- =====================================================================

begin;

-- Kontostand pro Betrieb
create table if not exists public.ai_phone_billing (
  tenant_id            bigint primary key references public.tenants(id) on delete cascade,
  setup_paid_at        timestamptz,
  balance_seconds      bigint  not null default 0,
  low_warning_sent     boolean not null default false,
  empty_warning_sent   boolean not null default false,
  updated_at           timestamptz not null default now()
);

-- Jede Bewegung (Kauf, Gespräch, Korrektur) – nachvollziehbar und doppelt-sicher
create table if not exists public.ai_minute_ledger (
  id             bigint generated always as identity primary key,
  tenant_id      bigint not null references public.tenants(id) on delete cascade,
  delta_seconds  bigint not null,
  reason         text   not null,
  reference      text   not null,
  amount_net     numeric(10,2),
  currency       text,
  note           text,
  created_at     timestamptz not null default now(),
  constraint ai_minute_ledger_reason_check check (reason in ('einrichtung', 'kauf', 'gespraech', 'korrektur')),
  constraint ai_minute_ledger_unique_ref unique (tenant_id, reference)
);

create index if not exists ai_minute_ledger_tenant_idx on public.ai_minute_ledger (tenant_id, created_at desc);

-- Atomare Buchung: dieselbe Referenz wird nie zweimal gebucht
create or replace function public.ai_minutes_apply(
  p_tenant_id  bigint,
  p_delta      bigint,
  p_reason     text,
  p_reference  text,
  p_amount_net numeric default null,
  p_currency   text    default null,
  p_setup      boolean default false,
  p_note       text    default null
)
returns table (balance_seconds bigint, applied boolean, low_warning_sent boolean, empty_warning_sent boolean)
language plpgsql
security definer
set search_path = public
as $$
declare
  v_inserted boolean := false;
begin
  insert into public.ai_minute_ledger (tenant_id, delta_seconds, reason, reference, amount_net, currency, note)
  values (p_tenant_id, p_delta, p_reason, p_reference, p_amount_net, p_currency, p_note)
  on conflict (tenant_id, reference) do nothing;
  v_inserted := found;

  insert into public.ai_phone_billing (tenant_id) values (p_tenant_id)
  on conflict (tenant_id) do nothing;

  if v_inserted then
    update public.ai_phone_billing b
       set balance_seconds    = b.balance_seconds + p_delta,
           setup_paid_at      = case when p_setup then coalesce(b.setup_paid_at, now()) else b.setup_paid_at end,
           low_warning_sent   = case when p_delta > 0 then false else b.low_warning_sent end,
           empty_warning_sent = case when p_delta > 0 then false else b.empty_warning_sent end,
           updated_at         = now()
     where b.tenant_id = p_tenant_id;
  end if;

  return query
    select b.balance_seconds, v_inserted, b.low_warning_sent, b.empty_warning_sent
      from public.ai_phone_billing b
     where b.tenant_id = p_tenant_id;
end;
$$;

revoke all on function public.ai_minutes_apply(bigint, bigint, text, text, numeric, text, boolean, text) from public;
revoke all on function public.ai_minutes_apply(bigint, bigint, text, text, numeric, text, boolean, text) from anon, authenticated;

alter table public.ai_phone_billing  enable row level security;
alter table public.ai_minute_ledger  enable row level security;

drop policy if exists ai_phone_billing_admin_select on public.ai_phone_billing;
create policy ai_phone_billing_admin_select on public.ai_phone_billing
  for select
  using (exists (select 1 from public.app_users u where u.auth_user_id = auth.uid() and u.tenant_id = ai_phone_billing.tenant_id and u.role_id in (1, 2)));

drop policy if exists ai_minute_ledger_admin_select on public.ai_minute_ledger;
create policy ai_minute_ledger_admin_select on public.ai_minute_ledger
  for select
  using (exists (select 1 from public.app_users u where u.auth_user_id = auth.uid() and u.tenant_id = ai_minute_ledger.tenant_id and u.role_id in (1, 2)));

commit;
