-- MalerTreff: Beitritt auch für Externe – 14.11.2026

-- Beitreten: Chef und Owner sofort aktiv, Mitarbeiter warten auf den Chef, Externe über community_join_external
create or replace function public.community_join(p_rules_version text)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  s public.community_settings;
  v_uid bigint := public.current_app_user_id();
  v_role int := public.current_role_id();
  u record;
  v_company text;
  v_city text;
  v_kind text;
  v_name text;
  v_id bigint;
begin
  if auth.uid() is null then raise exception 'Nicht angemeldet.'; end if;
  if not public.community_enabled_for_me() then raise exception 'Die Community ist noch nicht freigeschaltet.'; end if;
  select * into s from public.community_settings where id = 1;
  if p_rules_version is distinct from s.rules_version then raise exception 'Bitte die aktuellen Community-Regeln bestätigen.'; end if;

  -- schon Mitglied: nur neue Regeln bestätigen
  update public.community_members set rules_version = s.rules_version, rules_accepted_at = now()
  where auth_user_id = auth.uid() returning id into v_id;
  if v_id is not null then return public.community_access(); end if;

  -- Externe (ohne MalerSaaS-Konto): Mitglied aus den Angaben der Anmeldung
  if v_uid is null then
    perform public.community_join_external(s.rules_version);
    return public.community_access();
  end if;
  if v_role is null then raise exception 'Bitte zuerst anmelden.'; end if;
  select * into u from public.app_users where id = v_uid;
  select cs.company_name, cs.city into v_company, v_city from public.company_settings cs where cs.tenant_id = u.tenant_id;
  v_kind := case when v_role = 1 then 'team' when v_role = 2 then 'betrieb' else 'mitarbeiter' end;
  v_name := coalesce(nullif(trim(coalesce(u.first_name, '') || ' ' || coalesce(u.last_name, '')), ''), 'Mitglied');

  insert into public.community_members (auth_user_id, app_user_id, tenant_id, kind, display_name, company, region, status, is_moderator, rules_version, rules_accepted_at)
  values (auth.uid(), v_uid, u.tenant_id, v_kind, left(v_name, 80),
          case when v_kind = 'team' then 'MalerSaaS' else left(v_company, 120) end,
          case when v_kind = 'team' then null else left(v_city, 80) end,
          case when v_kind = 'mitarbeiter' then 'wartet' else 'aktiv' end,
          v_kind = 'team', s.rules_version, now())
  returning id into v_id;

  if v_kind = 'mitarbeiter' then
    begin
      insert into public.messages (tenant_id, sender_id, recipient_id, order_id, message_type, message, image_url)
      select u.tenant_id, v_uid, a.id, null, 'direct',
             '💬 ' || v_name || ' möchte der MalerTreff-Community beitreten – bitte unter „Community“ freigeben (ab 16 Jahren).', null
      from public.app_users a where a.tenant_id = u.tenant_id and a.role_id = 2;
    exception when others then null;
    end;
  end if;
  return public.community_access();
end;
$$;
