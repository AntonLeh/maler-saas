-- Mitarbeiter: Beschäftigungsart, App-Zugang ja/nein, Vergütungsdaten (nur Admin) – 10.11.2026
-- Bestehende Mitarbeiter: "Festangestellt – gewerblich" mit App-Zugang, Stundensatz bleibt.

alter table public.app_users add column if not exists employment_type text not null default 'gewerblich';
alter table public.app_users drop constraint if exists app_users_employment_type_check;
alter table public.app_users add constraint app_users_employment_type_check
  check (employment_type in ('gewerblich', 'angestellt', 'azubi', 'minijob', 'leiharbeit', 'sub'));

alter table public.app_users add column if not exists app_access boolean not null default true;

-- Personen ohne App-Zugang (z. B. Subunternehmer) brauchen nicht zwingend eine E-Mail
alter table public.app_users alter column email drop not null;

-- Vergütung und Firmendaten: eigene Tabelle, nur für den Admin des Betriebs lesbar
create table if not exists public.employee_pay (
  user_id bigint primary key references public.app_users (id) on delete cascade,
  tenant_id bigint not null,
  pay_type text not null default 'stunde' check (pay_type in ('stunde', 'monat')),
  hourly_wage numeric(10, 2) check (hourly_wage is null or hourly_wage >= 0),
  monthly_salary numeric(10, 2) check (monthly_salary is null or monthly_salary >= 0),
  weekly_hours numeric(5, 2) check (weekly_hours is null or (weekly_hours > 0 and weekly_hours <= 80)),
  overhead_pct numeric(6, 2) check (overhead_pct is null or (overhead_pct >= 0 and overhead_pct <= 300)),
  rate_manual boolean not null default false,
  training_year smallint check (training_year is null or training_year between 1 and 4),
  agency_name text,
  agency_rate numeric(10, 2) check (agency_rate is null or agency_rate >= 0),
  assignment_start date,
  sub_company text,
  sub_street text,
  sub_zip text,
  sub_city text,
  sub_vat_id text,
  sub_billing text check (sub_billing is null or sub_billing in ('stunde', 'pauschale', 'aufmass')),
  sub_rate numeric(10, 2) check (sub_rate is null or sub_rate >= 0),
  notes text,
  updated_at timestamptz not null default now()
);
create index if not exists employee_pay_tenant_idx on public.employee_pay (tenant_id);

alter table public.employee_pay enable row level security;

drop policy if exists employee_pay_admin on public.employee_pay;
create policy employee_pay_admin on public.employee_pay for all to authenticated
  using (public.current_role_id() = 2 and tenant_id = public.current_tenant_id())
  with check (
    public.current_role_id() = 2
    and tenant_id = public.current_tenant_id()
    and exists (select 1 from public.app_users u where u.id = user_id and u.tenant_id = employee_pay.tenant_id)
  );

-- App-Zugang nur über die Funktion create-employee-auth ändern (dort wird das Login an-/abgeschaltet)
create or replace function public.app_users_protect_access()
returns trigger
language plpgsql
as $$
begin
  if new.app_access is distinct from old.app_access and current_user in ('authenticated', 'anon') then
    new.app_access := old.app_access;
  end if;
  return new;
end;
$$;

drop trigger if exists app_users_protect_access on public.app_users;
create trigger app_users_protect_access before update on public.app_users
  for each row execute function public.app_users_protect_access();
