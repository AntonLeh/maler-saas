-- Community Stufe 1: Zugang, Beitritt, Freigabe durch den Chef, Owner-Einstellungen, Foto-Speicher – 14.11.2026

-- Ist die Community für mich sichtbar? (Owner immer, sonst Schalter oder Beta-Betrieb)
create or replace function public.community_enabled_for_me()
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select coalesce(public.current_role_id() = 1, false)
      or coalesce((select s.enabled or public.current_tenant_id() = any (s.beta_tenants) from public.community_settings s where s.id = 1), false);
$$;

-- Bin ich Moderator? (Owner immer)
create or replace function public.community_is_mod()
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select coalesce(public.current_role_id() = 1, false)
      or exists (select 1 from public.community_members m where m.auth_user_id = auth.uid() and m.is_moderator and m.status = 'aktiv');
$$;

-- Darf ich lesen und schreiben? (aktives Mitglied, Community freigeschaltet)
create or replace function public.community_can_use()
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select public.community_enabled_for_me()
     and exists (select 1 from public.community_members m where m.auth_user_id = auth.uid() and m.status = 'aktiv');
$$;

create or replace function public.community_my_id()
returns bigint
language sql
stable
security definer
set search_path = public
as $$
  select m.id from public.community_members m where m.auth_user_id = auth.uid();
$$;

-- Startinformation für die Seite
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
begin
  select * into s from public.community_settings where id = 1;
  select * into m from public.community_members where auth_user_id = auth.uid();
  return jsonb_build_object(
    'enabled', public.community_enabled_for_me(),
    'rules_version', s.rules_version,
    'is_owner', coalesce(v_role = 1, false),
    'is_mod', public.community_is_mod(),
    'member', case when m.id is null then null else jsonb_build_object(
      'id', m.id, 'kind', m.kind, 'status', m.status, 'display_name', m.display_name, 'company', m.company,
      'trade', m.trade, 'region', m.region, 'bio', m.bio, 'rules_version', m.rules_version, 'warnings', m.warnings) end,
    'unread', coalesce((select count(*) from public.community_notices n where n.member_id = m.id and n.read_at is null), 0),
    'staff_pending', case when v_role = 2 then (select count(*) from public.community_members x
                       where x.tenant_id = public.current_tenant_id() and x.kind = 'mitarbeiter' and x.status = 'wartet') else 0 end
  );
end;
$$;

-- Beitreten (MalerSaaS-Konten). Chef und Owner sind sofort aktiv, Mitarbeiter warten auf die Freigabe durch den Chef.
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

  if v_uid is null or v_role is null then raise exception 'Bitte zuerst anmelden.'; end if;
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

-- Chef: Mitarbeiter-Anfragen und freigeschaltete Mitarbeiter
create or replace function public.community_staff_list()
returns jsonb
language sql
stable
security definer
set search_path = public
as $$
  select coalesce(jsonb_agg(jsonb_build_object('id', m.id, 'display_name', m.display_name, 'status', m.status, 'created_at', m.created_at)
                            order by m.status desc, m.display_name), '[]'::jsonb)
  from public.community_members m
  where public.current_role_id() = 2 and m.tenant_id = public.current_tenant_id() and m.kind = 'mitarbeiter';
$$;

-- Chef: freigeben (Alter ab 16 bestätigen), ablehnen oder Freigabe entziehen
create or replace function public.community_staff_decide(p_member bigint, p_action text, p_confirm_16 boolean)
returns void
language plpgsql
security definer
set search_path = public
as $$
declare
  m public.community_members;
begin
  if public.current_role_id() is distinct from 2 then raise exception 'Nur der Chef kann Mitarbeiter freigeben.'; end if;
  select * into m from public.community_members where id = p_member and kind = 'mitarbeiter' and tenant_id = public.current_tenant_id();
  if m.id is null then raise exception 'Mitarbeiter nicht gefunden.'; end if;
  if p_action = 'freigeben' then
    if not coalesce(p_confirm_16, false) then raise exception 'Bitte bestätigen, dass der Mitarbeiter mindestens 16 Jahre alt ist.'; end if;
    if m.status = 'gesperrt' then raise exception 'Dieses Mitglied wurde von der Moderation gesperrt.'; end if;
    update public.community_members set status = 'aktiv', approved_by = public.current_app_user_id(), approved_at = now() where id = m.id;
    insert into public.community_notices (member_id, kind, text) values (m.id, 'freigabe', 'Willkommen im MalerTreff! Ihr Chef hat Sie freigeschaltet.');
  elsif p_action = 'ablehnen' and m.status = 'wartet' then
    delete from public.community_members where id = m.id;
  elsif p_action = 'entziehen' and m.status = 'aktiv' then
    update public.community_members set status = 'wartet', approved_by = null, approved_at = null where id = m.id;
  else
    raise exception 'Diese Aktion ist nicht möglich.';
  end if;
end;
$$;

-- Eigenes Profil ändern (Name und Firma kommen aus dem Konto)
create or replace function public.community_profile_update(p_trade text, p_region text, p_bio text)
returns void
language plpgsql
security definer
set search_path = public
as $$
begin
  update public.community_members
  set trade = nullif(left(trim(coalesce(p_trade, '')), 80), ''),
      region = nullif(left(trim(coalesce(p_region, '')), 80), ''),
      bio = nullif(left(trim(coalesce(p_bio, '')), 500), '')
  where auth_user_id = auth.uid() and status <> 'gesperrt';
  if not found then raise exception 'Profil kann nicht geändert werden.'; end if;
end;
$$;

-- Profil eines Mitglieds ansehen
create or replace function public.community_profile(p_member bigint)
returns jsonb
language sql
stable
security definer
set search_path = public
as $$
  select jsonb_build_object('id', m.id, 'kind', m.kind, 'display_name', m.display_name, 'company', m.company, 'trade', m.trade,
           'region', m.region, 'bio', m.bio, 'since', m.created_at, 'is_mod', m.is_moderator or m.kind = 'team',
           'posts', (select count(*) from public.community_posts p where p.author_id = m.id and p.status = 'sichtbar'),
           'solutions', (select count(*) from public.community_posts p where p.status = 'sichtbar'
                           and p.solution_comment_id in (select c.id from public.community_comments c where c.author_id = m.id)))
  from public.community_members m
  where m.id = p_member and m.status = 'aktiv' and public.community_can_use();
$$;
