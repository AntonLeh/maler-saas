-- MalerTreff: Anzahl offener Moderationsfälle für die Anzeige am Reiter und auf dem Dashboard – 14.11.2026

-- Offene Fälle = gemeldete oder zurückgehaltene Inhalte (wie in der Moderationsliste) + offene Widersprüche
create or replace function public.community_mod_count()
returns int
language sql
stable
security definer
set search_path = public
as $$
  select case when not public.community_is_mod() then 0 else (
    (select count(*)::int from (
       select target_type, target_id from public.community_reports where status = 'offen'
       union select 'post', id from public.community_posts where status = 'pruefung'
         and not (ai_status = 'ausstehend' and coalesce(edited_at, created_at) > now() - interval '10 minutes')
       union select 'comment', id from public.community_comments where status = 'pruefung'
         and not (ai_status = 'ausstehend' and created_at > now() - interval '10 minutes')
     ) t)
    + (select count(*)::int from public.community_decisions where appeal_at is not null and appeal_result is null)
  ) end;
$$;

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
                        where x.kind in ('betrieb', 'zulieferer') and x.app_user_id is null and x.status = 'wartet' and x.proof_status = 'eingereicht') else 0 end,
    'mod_pending', case when v_mod then public.community_mod_count() else 0 end
  );
end;
$$;

revoke all on function public.community_mod_count() from public, anon;
grant execute on function public.community_mod_count() to authenticated;
revoke all on function public.community_access() from public, anon;
grant execute on function public.community_access() to authenticated;
