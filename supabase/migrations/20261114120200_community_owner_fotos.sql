-- Community Stufe 1: Owner-Einstellungen, Moderatoren, Foto-Speicher – 14.11.2026

-- Owner: Übersicht (Schalter, Beta-Betriebe, Mitglieder, Kennzahlen)
create or replace function public.community_owner_overview()
returns jsonb
language plpgsql
stable
security definer
set search_path = public
as $$
declare
  s public.community_settings;
begin
  if public.current_role_id() is distinct from 1 then raise exception 'Nur für den Plattform-Owner.'; end if;
  select * into s from public.community_settings where id = 1;
  return jsonb_build_object(
    'enabled', s.enabled,
    'beta_tenants', to_jsonb(s.beta_tenants),
    'rules_version', s.rules_version,
    'tenants', (select coalesce(jsonb_agg(jsonb_build_object('id', cs.tenant_id, 'name', coalesce(cs.company_name, 'Betrieb ' || cs.tenant_id))
                  order by cs.company_name), '[]'::jsonb) from public.company_settings cs),
    'members', (select coalesce(jsonb_agg(jsonb_build_object('id', m.id, 'display_name', m.display_name, 'company', m.company, 'kind', m.kind,
                  'status', m.status, 'is_moderator', m.is_moderator, 'warnings', m.warnings, 'created_at', m.created_at)
                  order by m.created_at desc), '[]'::jsonb) from public.community_members m),
    'stats', jsonb_build_object(
      'members_active', (select count(*) from public.community_members where status = 'aktiv'),
      'posts_7d', (select count(*) from public.community_posts where created_at > now() - interval '7 days'),
      'comments_7d', (select count(*) from public.community_comments where created_at > now() - interval '7 days'),
      'reports_open', (select count(*) from public.community_reports where status = 'offen'),
      'decisions_year', (select count(*) from public.community_decisions where created_at > date_trunc('year', now())))
  );
end;
$$;

create or replace function public.community_settings_set(p_enabled boolean, p_beta_tenants bigint[])
returns void
language plpgsql
security definer
set search_path = public
as $$
begin
  if public.current_role_id() is distinct from 1 then raise exception 'Nur für den Plattform-Owner.'; end if;
  update public.community_settings
  set enabled = coalesce(p_enabled, false),
      beta_tenants = coalesce((select array_agg(distinct t) from unnest(p_beta_tenants) t where t is not null), '{}'),
      updated_at = now()
  where id = 1;
end;
$$;

create or replace function public.community_set_moderator(p_member bigint, p_on boolean)
returns void
language plpgsql
security definer
set search_path = public
as $$
begin
  if public.current_role_id() is distinct from 1 then raise exception 'Nur der Owner ernennt Moderatoren.'; end if;
  update public.community_members set is_moderator = coalesce(p_on, false) where id = p_member and status = 'aktiv';
  if not found then raise exception 'Nur aktive Mitglieder können Moderator werden.'; end if;
end;
$$;

-- Fotos: privater Speicher, jeder lädt nur in seinen eigenen Ordner (<auth-id>/<datei>), lesen dürfen aktive Mitglieder
insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values ('community', 'community', false, 3145728, array['image/jpeg', 'image/webp'])
on conflict (id) do update set public = false, file_size_limit = 3145728, allowed_mime_types = array['image/jpeg', 'image/webp'];

drop policy if exists community_photo_insert on storage.objects;
create policy community_photo_insert on storage.objects for insert to authenticated
  with check (bucket_id = 'community' and (storage.foldername(name))[1] = auth.uid()::text and public.community_can_use());
drop policy if exists community_photo_select on storage.objects;
create policy community_photo_select on storage.objects for select to authenticated
  using (bucket_id = 'community' and public.community_can_use());
drop policy if exists community_photo_delete on storage.objects;
create policy community_photo_delete on storage.objects for delete to authenticated
  using (bucket_id = 'community' and ((storage.foldername(name))[1] = auth.uid()::text or public.community_is_mod()));

-- Berechtigungen: alle Funktionen nur für angemeldete Nutzer
do $$
declare f text;
begin
  foreach f in array array[
    'community_enabled_for_me()', 'community_is_mod()', 'community_can_use()', 'community_my_id()', 'community_access()',
    'community_join(text)', 'community_staff_list()', 'community_staff_decide(bigint, text, boolean)',
    'community_profile_update(text, text, text)', 'community_profile(bigint)', 'community_owner_overview()',
    'community_settings_set(boolean, bigint[])', 'community_set_moderator(bigint, boolean)']
  loop
    execute format('revoke all on function public.%s from public, anon', f);
    execute format('grant execute on function public.%s to authenticated', f);
  end loop;
end $$;
