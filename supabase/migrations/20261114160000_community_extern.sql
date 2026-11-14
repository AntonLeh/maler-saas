-- MalerTreff: Konten für Externe (Betriebe ohne MalerSaaS, Zulieferer, Privatpersonen) – 14.11.2026
-- Anmeldung mit signup_type 'community' (die Automatik für neue Malerbetriebe reagiert nur auf 'company').

alter table public.community_settings add column if not exists external_signup boolean not null default false;

alter table public.community_members add column if not exists website text;
alter table public.community_members add column if not exists impressum_url text;
alter table public.community_members add column if not exists proof_path text;
alter table public.community_members add column if not exists proof_status text;
alter table public.community_members add column if not exists proof_note text;
alter table public.community_members add column if not exists proof_decided_at timestamptz;
do $$ begin
  alter table public.community_members add constraint community_members_proof_status_chk
    check (proof_status is null or proof_status in ('fehlt', 'eingereicht', 'geprueft', 'abgelehnt'));
exception when duplicate_object then null; end $$;

-- Sichtbar: Owner, Schalter „für alle“, Beta-Betriebe – und Externe, solange „Anmeldung für Externe offen“ an ist
create or replace function public.community_enabled_for_me()
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select coalesce(public.current_role_id() = 1, false)
      or coalesce((select s.enabled or public.current_tenant_id() = any (s.beta_tenants)
                     or (s.external_signup and auth.uid() is not null and public.current_app_user_id() is null)
                   from public.community_settings s where s.id = 1), false);
$$;

-- Für die öffentliche Seite: Ist die Anmeldung für Externe offen?
create or replace function public.community_signup_open()
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select coalesce((select external_signup from public.community_settings where id = 1), false);
$$;

-- Für die öffentliche Seite: Anmeldung offen? Welche Regel-Fassung gilt?
create or replace function public.community_public_info()
returns jsonb
language sql
stable
security definer
set search_path = public
as $$
  select jsonb_build_object('signup_open', s.external_signup, 'rules_version', s.rules_version)
  from public.community_settings s where s.id = 1;
$$;

-- Owner: Anmeldung für Externe öffnen/schließen
create or replace function public.community_external_set(p_on boolean)
returns void
language plpgsql
security definer
set search_path = public
as $$
begin
  if public.current_role_id() is distinct from 1 then raise exception 'Nur für den Plattform-Owner.'; end if;
  update public.community_settings set external_signup = coalesce(p_on, false), updated_at = now() where id = 1;
end;
$$;
