-- MalerTreff: Beitritt für Externe, Startinformation erweitert – 14.11.2026

create or replace function public.community_access()
returns jsonb
language plpgsql
stable
security definer
set search_path = public
as $$
declare
  s public.community_settings;
  m public.community_members;
  v_role int := public.current_role_id();
  v_mod boolean := public.community_is_mod();
begin
  select * into s from public.community_settings where id = 1;
  select * into m from public.community_members where auth_user_id = auth.uid();
  return jsonb_build_object(
    'enabled', public.community_enabled_for_me(),
    'rules_version', s.rules_version,
    'is_owner', coalesce(v_role = 1, false),
    'is_mod', v_mod,
    'external', auth.uid() is not null and public.current_app_user_id() is null,
    'signup_open', s.external_signup,
    'member', case when m.id is null then null else jsonb_build_object(
      'id', m.id, 'kind', m.kind, 'status', m.status, 'display_name', m.display_name, 'company', m.company,
      'trade', m.trade, 'region', m.region, 'bio', m.bio, 'rules_version', m.rules_version, 'warnings', m.warnings,
      'website', m.website, 'impressum_url', m.impressum_url, 'proof_status', m.proof_status, 'proof_note', m.proof_note) end,
    'unread', coalesce((select count(*) from public.community_notices n where n.member_id = m.id and n.read_at is null), 0),
    'staff_pending', case when v_role = 2 then (select count(*) from public.community_members x
                       where x.tenant_id = public.current_tenant_id() and x.kind = 'mitarbeiter' and x.status = 'wartet') else 0 end,
    'verify_pending', case when v_mod then (select count(*) from public.community_members x
                        where x.kind in ('betrieb', 'zulieferer') and x.app_user_id is null and x.status = 'wartet' and x.proof_status = 'eingereicht') else 0 end
  );
end;
$$;

-- Externes Mitglied aus den Angaben der Anmeldung anlegen (nur intern aufgerufen)
create or replace function public.community_join_external(p_rules_version text)
returns bigint
language plpgsql
security definer
set search_path = public
as $$
declare
  u record;
  md jsonb;
  v_kind text;
  v_first text;
  v_last text;
  v_name text;
  v_id bigint;
begin
  select id, email_confirmed_at, raw_user_meta_data into u from auth.users where id = auth.uid();
  md := coalesce(u.raw_user_meta_data, '{}'::jsonb);
  if md ->> 'signup_type' is distinct from 'community' then raise exception 'Bitte zuerst ein MalerTreff-Konto erstellen.'; end if;
  if u.email_confirmed_at is null then raise exception 'Bitte zuerst Ihre E-Mail-Adresse bestätigen.'; end if;
  if coalesce((md ->> 'age16')::boolean, false) is not true then raise exception 'Die Community ist erst ab 16 Jahren.'; end if;
  v_kind := md ->> 'community_kind';
  if v_kind not in ('betrieb', 'zulieferer', 'privat') then raise exception 'Unbekannter Kontotyp.'; end if;
  v_first := left(trim(coalesce(md ->> 'first_name', '')), 40);
  v_last := left(trim(coalesce(md ->> 'last_name', '')), 40);
  if v_first = '' or v_last = '' then raise exception 'Vor- und Nachname fehlen.'; end if;
  v_name := case when v_kind = 'privat' then v_first || ' ' || left(v_last, 1) || '.' else v_first || ' ' || v_last end;

  insert into public.community_members (auth_user_id, kind, display_name, company, trade, region, website, impressum_url,
                                        status, proof_status, rules_version, rules_accepted_at)
  values (auth.uid(), v_kind, v_name,
          case when v_kind = 'privat' then null else nullif(left(trim(coalesce(md ->> 'company', '')), 120), '') end,
          nullif(left(trim(coalesce(md ->> 'trade', '')), 80), ''),
          nullif(left(trim(coalesce(md ->> 'region', '')), 80), ''),
          case when v_kind = 'zulieferer' then nullif(left(trim(coalesce(md ->> 'website', '')), 200), '') end,
          case when v_kind = 'zulieferer' then nullif(left(trim(coalesce(md ->> 'impressum_url', '')), 200), '') end,
          case when v_kind = 'privat' then 'aktiv' else 'wartet' end,
          case when v_kind = 'privat' then null else 'fehlt' end,
          p_rules_version, now())
  returning id into v_id;
  if v_kind = 'privat' then
    insert into public.community_notices (member_id, kind, text) values (v_id, 'freigabe', 'Willkommen im MalerTreff! Stellen Sie gern gleich Ihre erste Frage.');
  end if;
  return v_id;
end;
$$;
