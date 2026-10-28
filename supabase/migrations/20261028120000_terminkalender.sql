-- =====================================================================
-- Modul: Terminkalender (Admin -> Projektleiter)
-- Nur NEUE Objekte. Bestehende Tabellen werden nicht verändert.
-- Ausführen: Supabase Dashboard -> SQL Editor -> Inhalt einfügen -> Run
-- Die Datei kann gefahrlos mehrfach ausgeführt werden.
-- =====================================================================

begin;

create table if not exists public.appointments (
  id               bigint generated always as identity primary key,
  tenant_id        bigint      not null references public.tenants(id)   on delete cascade,
  created_by       bigint               references public.app_users(id) on delete set null,
  assigned_to      bigint               references public.app_users(id) on delete set null,
  customer_id      bigint               references public.customers(id) on delete set null,
  order_id         bigint               references public.orders(id)    on delete set null,
  title            text        not null,
  appointment_type text        not null default 'sonstiges',
  description      text,
  location         text,
  starts_at        timestamptz not null,
  ends_at          timestamptz not null,
  -- geplant | weitergeleitet | bestaetigt | abgelehnt | abgesagt
  status           text        not null default 'geplant',
  forward_note     text,
  response_note    text,
  forwarded_at     timestamptz,
  responded_at     timestamptz,
  created_at       timestamptz not null default now(),
  updated_at       timestamptz not null default now(),
  constraint appointments_time_check   check (ends_at >= starts_at),
  constraint appointments_status_check check (status in ('geplant','weitergeleitet','bestaetigt','abgelehnt','abgesagt'))
);

create index if not exists appointments_tenant_starts_idx on public.appointments (tenant_id, starts_at);
create index if not exists appointments_assigned_idx      on public.appointments (assigned_to);

alter table public.appointments enable row level security;

-- Admin / Plattform-Owner (role_id 1, 2) der eigenen Firma: alles
drop policy if exists appointments_admin_all on public.appointments;
create policy appointments_admin_all on public.appointments
  for all
  using (
    exists (
      select 1 from public.app_users u
      where u.auth_user_id = auth.uid()
        and u.tenant_id = appointments.tenant_id
        and u.role_id in (1, 2)
    )
  )
  with check (
    exists (
      select 1 from public.app_users u
      where u.auth_user_id = auth.uid()
        and u.tenant_id = appointments.tenant_id
        and u.role_id in (1, 2)
    )
  );

-- Projektleiter: sieht nur Termine, die ihm zugewiesen sind
drop policy if exists appointments_assignee_select on public.appointments;
create policy appointments_assignee_select on public.appointments
  for select
  using (
    exists (
      select 1 from public.app_users u
      where u.auth_user_id = auth.uid()
        and u.id = appointments.assigned_to
    )
  );

-- Projektleiter bestätigt / lehnt ab: nur über diese Funktion,
-- damit er keine anderen Felder (Zeit, Titel, ...) ändern kann.
create or replace function public.appointment_respond(
  p_appointment_id bigint,
  p_accept boolean,
  p_note text default null
)
returns void
language plpgsql
security definer
set search_path = public
as $$
declare
  v_user_id bigint;
begin
  select u.id into v_user_id
  from public.app_users u
  where u.auth_user_id = auth.uid()
  limit 1;

  if v_user_id is null then
    raise exception 'Kein Benutzer gefunden';
  end if;

  update public.appointments a
     set status        = case when p_accept then 'bestaetigt' else 'abgelehnt' end,
         response_note = nullif(trim(p_note), ''),
         responded_at  = now(),
         updated_at    = now()
   where a.id = p_appointment_id
     and a.assigned_to = v_user_id
     and a.status in ('weitergeleitet', 'bestaetigt', 'abgelehnt');

  if not found then
    raise exception 'Termin nicht gefunden oder nicht dir zugewiesen';
  end if;
end;
$$;

revoke all on function public.appointment_respond(bigint, boolean, text) from public;
grant execute on function public.appointment_respond(bigint, boolean, text) to authenticated;

commit;
