-- =====================================================================
-- Lieferscheine einlesen (Materialverwaltung)
--  * delivery_notes: eingelesene Lieferscheine mit den gebuchten Positionen (Nachweis: was kam wann wohin)
--  * Datei im privaten Speicher „delivery-notes“ (Ordner = tenant_id)
--  * Zugriff: Admins und Projektleiter des Betriebs (wie die Lagerbuchungen)
--  * expense_ai_log.kind: gemeinsamer KI-Zähler für Belege und Lieferscheine
-- Kann mehrfach ausgeführt werden.
-- =====================================================================

create or replace function public.material_staff(p_tenant_id bigint)
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select exists (
    select 1 from public.app_users u
     where u.auth_user_id = auth.uid()
       and u.tenant_id = p_tenant_id
       and u.role_id in (1, 2, 3)
       and coalesce(u.is_active, true)
  );
$$;
revoke all on function public.material_staff(bigint) from public, anon;
grant execute on function public.material_staff(bigint) to authenticated;

create table if not exists public.delivery_notes (
  id           bigserial primary key,
  tenant_id    bigint not null references public.tenants(id) on delete cascade,
  file_path    text,
  supplier     text,
  note_date    date,
  note_number  text,
  reference    text,
  -- warehouse = ins Lager, order = direkt zum Auftrag (Projektleiter)
  target       text not null default 'warehouse',
  order_id     bigint,
  -- [{ material_id, name, quantity, unit, unit_price, created }]
  lines        jsonb not null default '[]'::jsonb,
  booked_by    bigint,
  created_at   timestamptz not null default now(),
  constraint delivery_notes_target check (target in ('warehouse', 'order'))
);
create index if not exists delivery_notes_tenant_idx on public.delivery_notes (tenant_id, created_at desc);

alter table public.delivery_notes enable row level security;
drop policy if exists delivery_notes_staff_select on public.delivery_notes;
create policy delivery_notes_staff_select on public.delivery_notes for select using (public.material_staff(tenant_id));
drop policy if exists delivery_notes_staff_insert on public.delivery_notes;
create policy delivery_notes_staff_insert on public.delivery_notes for insert with check (public.material_staff(tenant_id));
grant select, insert on public.delivery_notes to authenticated;
grant usage, select on sequence public.delivery_notes_id_seq to authenticated;

alter table public.expense_ai_log add column if not exists kind text not null default 'beleg';

-- ---------- Speicher ----------
insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values ('delivery-notes', 'delivery-notes', false, 10485760, array['image/jpeg', 'image/png', 'image/webp', 'application/pdf'])
on conflict (id) do update set public = false, file_size_limit = 10485760,
  allowed_mime_types = array['image/jpeg', 'image/png', 'image/webp', 'application/pdf'];

drop policy if exists delivery_notes_staff_insert on storage.objects;
create policy delivery_notes_staff_insert on storage.objects
  for insert to authenticated
  with check (bucket_id = 'delivery-notes' and public.material_staff(((storage.foldername(name))[1])::bigint));

drop policy if exists delivery_notes_staff_read on storage.objects;
create policy delivery_notes_staff_read on storage.objects
  for select to authenticated
  using (bucket_id = 'delivery-notes' and public.material_staff(((storage.foldername(name))[1])::bigint));
