-- MalerTreff: Nachweise (Gewerbeschein usw.), Freigabe durch die Moderation, Zulieferer-Links – 14.11.2026

-- Nachweis wurde hochgeladen (Datei liegt im privaten Speicher „community-proofs“ unter <auth-id>/…)
create or replace function public.community_proof_submit(p_path text)
returns void
language plpgsql
security definer
set search_path = public
as $$
begin
  if p_path !~ ('^' || auth.uid()::text || '/[0-9a-f-]{36}\.(pdf|jpg|png|webp)$') then raise exception 'Ungültige Datei.'; end if;
  update public.community_members
  set proof_path = p_path, proof_status = 'eingereicht', proof_note = null, proof_decided_at = null
  where auth_user_id = auth.uid() and app_user_id is null and kind in ('betrieb', 'zulieferer') and status = 'wartet';
  if not found then raise exception 'Ein Nachweis ist für dieses Konto nicht nötig.'; end if;
end;
$$;

-- Moderation: offene Freigaben
create or replace function public.community_verify_list()
returns jsonb
language plpgsql
stable
security definer
set search_path = public
as $$
begin
  if not public.community_is_mod() then raise exception 'Nur für die Moderation.'; end if;
  return coalesce((
    select jsonb_agg(jsonb_build_object('id', m.id, 'kind', m.kind, 'display_name', m.display_name, 'company', m.company,
             'trade', m.trade, 'region', m.region, 'website', m.website, 'impressum_url', m.impressum_url,
             'proof_path', m.proof_path, 'proof_status', m.proof_status, 'proof_note', m.proof_note, 'created_at', m.created_at)
             order by (m.proof_status = 'eingereicht') desc, m.created_at)
    from public.community_members m
    where m.kind in ('betrieb', 'zulieferer') and m.app_user_id is null and m.status = 'wartet'), '[]'::jsonb);
end;
$$;

-- Moderation: freigeben oder ablehnen (mit Begründung). Gibt zurück, wem die App bzw. die Server-Funktion schreiben soll.
create or replace function public.community_verify_decide(p_member bigint, p_approve boolean, p_reason text)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  m public.community_members;
  v_reason text := nullif(left(trim(coalesce(p_reason, '')), 500), '');
begin
  if not public.community_is_mod() then raise exception 'Nur für die Moderation.'; end if;
  select * into m from public.community_members
  where id = p_member and kind in ('betrieb', 'zulieferer') and app_user_id is null and status = 'wartet';
  if m.id is null then raise exception 'Keine offene Freigabe für dieses Konto.'; end if;
  if coalesce(p_approve, false) then
    update public.community_members
    set status = 'aktiv', proof_status = 'geprueft', proof_note = null, proof_decided_at = now(),
        approved_at = now(), approved_by = public.community_my_id()
    where id = m.id;
    insert into public.community_notices (member_id, kind, text)
    values (m.id, 'freigabe', 'Ihr Nachweis wurde geprüft – willkommen im MalerTreff!');
  else
    if v_reason is null then raise exception 'Bitte einen Grund für die Ablehnung angeben.'; end if;
    update public.community_members
    set proof_status = 'abgelehnt', proof_note = v_reason, proof_decided_at = now()
    where id = m.id;
  end if;
  return jsonb_build_object('auth_user_id', m.auth_user_id, 'display_name', m.display_name, 'kind', m.kind,
                            'approved', coalesce(p_approve, false), 'reason', v_reason);
end;
$$;

-- Zulieferer: Website und Impressum ändern
create or replace function public.community_profile_links(p_website text, p_impressum text)
returns void
language plpgsql
security definer
set search_path = public
as $$
declare
  v_web text := nullif(left(trim(coalesce(p_website, '')), 200), '');
  v_imp text := nullif(left(trim(coalesce(p_impressum, '')), 200), '');
begin
  if v_web is not null and v_web !~* '^https?://' then v_web := 'https://' || v_web; end if;
  if v_imp is not null and v_imp !~* '^https?://' then v_imp := 'https://' || v_imp; end if;
  update public.community_members set website = v_web, impressum_url = v_imp
  where auth_user_id = auth.uid() and kind = 'zulieferer' and status <> 'gesperrt';
  if not found then raise exception 'Nur Zulieferer können Website und Impressum angeben.'; end if;
end;
$$;

-- Profil zeigt bei Zulieferern zusätzlich Website und Impressum
create or replace function public.community_profile(p_member bigint)
returns jsonb
language sql
stable
security definer
set search_path = public
as $$
  select jsonb_build_object('id', m.id, 'kind', m.kind, 'display_name', m.display_name, 'company', m.company, 'trade', m.trade,
           'region', m.region, 'bio', m.bio, 'since', m.created_at, 'is_mod', m.is_moderator or m.kind = 'team',
           'website', case when m.kind = 'zulieferer' then m.website end,
           'impressum_url', case when m.kind = 'zulieferer' then m.impressum_url end,
           'posts', (select count(*) from public.community_posts p where p.author_id = m.id and p.status = 'sichtbar'),
           'solutions', (select count(*) from public.community_posts p where p.status = 'sichtbar'
                           and p.solution_comment_id in (select c.id from public.community_comments c where c.author_id = m.id)))
  from public.community_members m
  where m.id = p_member and m.status = 'aktiv' and public.community_can_use();
$$;
