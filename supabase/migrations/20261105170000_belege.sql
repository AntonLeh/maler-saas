-- =====================================================================
-- Buchhaltung Schritt 2: Belege & Ausgaben
--  - Tabelle expenses (nur Admins), Beträge: brutto + Steuersatz -> netto/Vorsteuer (oder Steuerbetrag bei gemischten Sätzen)
--  - Beleg-Datei im privaten Bucket „receipts“ (Ordner = tenant_id), nie überschreib- oder löschbar (GoBD)
--  - Monatsabschluss (expense_periods): danach sind die Belege des Monats gesperrt
--  - Löschen gibt es nicht; Fehlerfassungen werden „ungültig“ markiert (mit Grund)
--  - expense_ai_log: Zähler für die KI-Belegerkennung (Funktion receipt-ai)
-- Kann mehrfach ausgeführt werden.
-- =====================================================================

create table if not exists public.expenses (
  id bigserial primary key,
  tenant_id bigint not null references public.tenants(id) on delete cascade,
  receipt_date date not null,
  supplier text not null,
  description text,
  category text not null default 'sonstiges',
  gross_amount numeric(12,2) not null,
  tax_rate numeric(5,2),               -- null = gemischte Sätze, Steuerbetrag wird direkt eingegeben
  tax_amount numeric(12,2) not null default 0,
  net_amount numeric(12,2) not null default 0,
  paid boolean not null default true,
  payment_method text,
  order_id bigint references public.orders(id) on delete set null,
  file_path text,
  file_name text,
  file_type text,
  ai_extracted boolean not null default false,
  voided boolean not null default false,
  void_reason text,
  locked boolean not null default false,
  notes text,
  created_by bigint,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint expenses_category_chk check (category in ('material', 'werkzeug', 'fahrzeug', 'subunternehmer', 'miete', 'versicherung', 'buero', 'sonstiges')),
  constraint expenses_payment_chk check (payment_method is null or payment_method in ('bar', 'karte', 'ueberweisung', 'lastschrift', 'paypal')),
  constraint expenses_amount_chk check (gross_amount >= 0 and tax_amount >= 0 and tax_amount <= gross_amount)
);

create index if not exists expenses_tenant_date_idx on public.expenses (tenant_id, receipt_date desc);
create index if not exists expenses_order_idx on public.expenses (order_id) where order_id is not null;

create table if not exists public.expense_periods (
  tenant_id bigint not null references public.tenants(id) on delete cascade,
  period_year integer not null,
  period_month integer not null check (period_month between 1 and 12),
  locked_at timestamptz not null default now(),
  locked_by bigint,
  primary key (tenant_id, period_year, period_month)
);

create table if not exists public.expense_ai_log (
  id bigserial primary key,
  tenant_id bigint not null references public.tenants(id) on delete cascade,
  created_at timestamptz not null default now()
);
create index if not exists expense_ai_log_tenant_idx on public.expense_ai_log (tenant_id, created_at desc);

-- ---------- Beträge berechnen + Sperren ----------
create or replace function public.expenses_guard()
returns trigger
language plpgsql
security definer
set search_path to 'public'
as $$
declare
  v_allowed text[] := array['paid', 'payment_method', 'updated_at', 'locked'];
begin
  if tg_op = 'DELETE' then
    if coalesce(current_setting('malersaas.allow_expense_delete', true), '') = 'on' then
      return old;
    end if;
    raise exception 'Belege können nicht gelöscht werden. Bitte als „ungültig“ markieren.';
  end if;

  if tg_op = 'UPDATE' then
    if new.tenant_id <> old.tenant_id then
      raise exception 'Unzulässige Änderung';
    end if;
    -- die Beleg-Datei bleibt immer dieselbe
    if old.file_path is not null and new.file_path is distinct from old.file_path then
      raise exception 'Die Beleg-Datei kann nicht ausgetauscht werden. Bitte den Beleg ungültig machen und neu erfassen.';
    end if;
    if old.voided and not new.voided then
      raise exception 'Ein ungültiger Beleg kann nicht wieder aktiviert werden.';
    end if;
    -- abgeschlossener Monat: nur noch Zahlungsstatus änderbar
    if old.locked and (to_jsonb(new) - v_allowed) is distinct from (to_jsonb(old) - v_allowed) then
      raise exception 'Der Monat ist abgeschlossen – dieser Beleg kann nicht mehr geändert werden.';
    end if;
  end if;

  -- in abgeschlossenen Monat nichts neu eintragen oder hineinverschieben
  if (tg_op = 'INSERT' or new.receipt_date is distinct from old.receipt_date) and exists (
    select 1 from public.expense_periods p
    where p.tenant_id = new.tenant_id
      and p.period_year = extract(year from new.receipt_date)::int
      and p.period_month = extract(month from new.receipt_date)::int
  ) then
    raise exception 'Der Monat % ist bereits abgeschlossen.', to_char(new.receipt_date, 'MM/YYYY');
  end if;

  -- Beträge: mit Steuersatz -> automatisch, sonst (gemischt) eingegebener Steuerbetrag
  if new.tax_rate is not null then
    new.net_amount := round(new.gross_amount / (1 + new.tax_rate / 100), 2);
    new.tax_amount := round(new.gross_amount - new.net_amount, 2);
  else
    new.tax_amount := coalesce(new.tax_amount, 0);
    new.net_amount := round(new.gross_amount - new.tax_amount, 2);
  end if;
  new.supplier := trim(new.supplier);
  new.updated_at := now();
  if tg_op = 'INSERT' then
    new.locked := false;
  end if;
  return new;
end;
$$;

drop trigger if exists expenses_guard on public.expenses;
create trigger expenses_guard
  before insert or update or delete on public.expenses
  for each row execute function public.expenses_guard();

-- ---------- Zugriff: nur Admins des Betriebs, kein Löschen ----------
alter table public.expenses enable row level security;
alter table public.expense_periods enable row level security;
alter table public.expense_ai_log enable row level security;

drop policy if exists expenses_admin_select on public.expenses;
create policy expenses_admin_select on public.expenses for select using (public.website_is_admin(tenant_id));
drop policy if exists expenses_admin_insert on public.expenses;
create policy expenses_admin_insert on public.expenses for insert with check (public.website_is_admin(tenant_id));
drop policy if exists expenses_admin_update on public.expenses;
create policy expenses_admin_update on public.expenses for update using (public.website_is_admin(tenant_id)) with check (public.website_is_admin(tenant_id));

drop policy if exists expense_periods_admin_select on public.expense_periods;
create policy expense_periods_admin_select on public.expense_periods for select using (public.website_is_admin(tenant_id));

-- ---------- Monat abschließen ----------
create or replace function public.lock_expense_month(p_year integer, p_month integer)
returns integer
language plpgsql
security definer
set search_path to 'public'
as $$
declare
  v_app_user_id bigint;
  v_tenant_id bigint;
  v_role_id integer;
  v_count integer;
begin
  select app_user_id, tenant_id, role_id into v_app_user_id, v_tenant_id, v_role_id
  from public.get_my_role_and_tenant();
  if v_app_user_id is null then
    raise exception 'Benutzerprofil nicht gefunden';
  end if;
  if v_role_id not in (1, 2) then
    raise exception 'Kein Zugriff';
  end if;
  if p_month not between 1 and 12 then
    raise exception 'Ungültiger Monat';
  end if;
  if make_date(p_year, p_month, 1) > date_trunc('month', current_date)::date then
    raise exception 'Ein zukünftiger Monat kann nicht abgeschlossen werden';
  end if;

  insert into public.expense_periods (tenant_id, period_year, period_month, locked_by)
  values (v_tenant_id, p_year, p_month, v_app_user_id)
  on conflict do nothing;

  update public.expenses
  set locked = true
  where tenant_id = v_tenant_id and not locked
    and receipt_date >= make_date(p_year, p_month, 1)
    and receipt_date < (make_date(p_year, p_month, 1) + interval '1 month')::date;
  get diagnostics v_count = row_count;
  return v_count;
end;
$$;
grant execute on function public.lock_expense_month(integer, integer) to authenticated;

-- ---------- Privater Speicher für Belege (Ordner = tenant_id) ----------
insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values ('receipts', 'receipts', false, 10485760, array['image/jpeg', 'image/png', 'image/webp', 'application/pdf'])
on conflict (id) do update set public = false, file_size_limit = 10485760,
  allowed_mime_types = array['image/jpeg', 'image/png', 'image/webp', 'application/pdf'];

drop policy if exists receipts_admin_insert on storage.objects;
create policy receipts_admin_insert on storage.objects
  for insert to authenticated
  with check (bucket_id = 'receipts' and public.website_is_admin(((storage.foldername(name))[1])::bigint));

drop policy if exists receipts_admin_select on storage.objects;
create policy receipts_admin_select on storage.objects
  for select to authenticated
  using (bucket_id = 'receipts' and public.website_is_admin(((storage.foldername(name))[1])::bigint));
-- bewusst KEINE update/delete-Regeln: Belege bleiben unverändert erhalten (GoBD, 10 Jahre)
