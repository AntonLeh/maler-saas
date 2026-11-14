-- Community Stufe 1: Melden, Moderation mit Begründung, Widerspruch (DSA Art. 16, 17) – 14.11.2026

-- Melden: Eingangsbestätigung als Rückgabetext. Ab 3 Meldungen (oder sofort bei „Gefahr für Leib und Leben“) wird vorläufig ausgeblendet.
create or replace function public.community_report(p_type text, p_id bigint, p_reason text, p_note text)
returns text
language plpgsql
security definer
set search_path = public
as $$
declare
  v_me bigint := public.community_my_id();
  v_author bigint;
  v_status text;
  v_cnt int;
begin
  if not public.community_can_use() then raise exception 'Kein Zugriff auf die Community.'; end if;
  if p_reason not in ('beleidigung', 'spam', 'werbung', 'kundendaten', 'rechtswidrig', 'gefahr', 'sonstiges') then raise exception 'Bitte einen Grund wählen.'; end if;
  if p_type = 'post' then
    select author_id, status into v_author, v_status from public.community_posts where id = p_id;
  elsif p_type = 'comment' then
    select author_id, status into v_author, v_status from public.community_comments where id = p_id;
  elsif p_type = 'member' then
    select id, case when status = 'aktiv' then 'sichtbar' else status end into v_author, v_status from public.community_members where id = p_id;
  else
    raise exception 'Unbekannte Meldung.';
  end if;
  if v_author is null or v_status not in ('sichtbar', 'pruefung') then raise exception 'Nicht gefunden.'; end if;
  if v_author = v_me then raise exception 'Eigene Inhalte können nicht gemeldet werden.'; end if;

  insert into public.community_reports (reporter_id, target_type, target_id, reason, note)
  values (v_me, p_type, p_id, p_reason, nullif(left(trim(coalesce(p_note, '')), 1000), ''))
  on conflict (reporter_id, target_type, target_id) do nothing;
  if not found then return 'Sie haben das bereits gemeldet. Die Moderation prüft es.'; end if;

  select count(*) into v_cnt from public.community_reports where target_type = p_type and target_id = p_id and status = 'offen';
  if v_cnt >= 3 or p_reason = 'gefahr' then
    if p_type = 'post' then
      update public.community_posts set status = 'pruefung', hidden_reason = 'meldungen' where id = p_id and status = 'sichtbar';
    elsif p_type = 'comment' then
      update public.community_comments set status = 'pruefung', hidden_reason = 'meldungen' where id = p_id and status = 'sichtbar';
    end if;
  end if;
  return 'Danke für Ihre Meldung. Die Moderation prüft sie, und Sie bekommen eine Nachricht über das Ergebnis.';
end;
$$;

-- Moderations-Liste: gemeldete und vorläufig ausgeblendete Inhalte, offene Widersprüche, letzte Entscheidungen
create or replace function public.community_mod_queue()
returns jsonb
language plpgsql
stable
security definer
set search_path = public
as $$
begin
  if not public.community_is_mod() then raise exception 'Nur für die Moderation.'; end if;
  return jsonb_build_object(
    'items', coalesce((
      select jsonb_agg(x.obj order by x.danger desc, x.last_at desc)
      from (
        select rr.danger, t.since as last_at,
               jsonb_build_object('type', t.target_type, 'id', t.target_id, 'report_count', rr.cnt, 'reasons', rr.reasons,
                 'notes', rr.notes, 'danger', rr.danger, 'content', public.community_mod_target(t.target_type, t.target_id)) as obj
        from (
          select u.target_type, u.target_id, max(u.since) as since
          from (
            select target_type, target_id, created_at as since from public.community_reports where status = 'offen'
            union all select 'post', id, created_at from public.community_posts where status = 'pruefung'
            union all select 'comment', id, created_at from public.community_comments where status = 'pruefung'
          ) u
          group by u.target_type, u.target_id
        ) t
        cross join lateral (
          select count(*) as cnt,
                 coalesce(bool_or(r.reason = 'gefahr'), false) as danger,
                 coalesce((select jsonb_object_agg(q.reason, q.n) from (
                    select r2.reason, count(*) as n from public.community_reports r2
                    where r2.target_type = t.target_type and r2.target_id = t.target_id and r2.status = 'offen' group by r2.reason) q), '{}'::jsonb) as reasons,
                 coalesce(jsonb_agg(r.note) filter (where r.note is not null), '[]'::jsonb) as notes
          from public.community_reports r
          where r.target_type = t.target_type and r.target_id = t.target_id and r.status = 'offen'
        ) rr
      ) x), '[]'::jsonb),
    'appeals', coalesce((
      select jsonb_agg(jsonb_build_object('id', d.id, 'type', d.target_type, 'target_id', d.target_id, 'action', d.action, 'rule', d.rule,
               'note', d.note, 'excerpt', d.excerpt, 'appeal_text', d.appeal_text, 'appeal_at', d.appeal_at, 'created_at', d.created_at,
               'member', public.community_author(d.member_id)) order by d.appeal_at)
      from public.community_decisions d where d.appeal_at is not null and d.appeal_result is null), '[]'::jsonb),
    'recent', coalesce((
      select jsonb_agg(jsonb_build_object('id', d.id, 'type', d.target_type, 'action', d.action, 'rule', d.rule, 'excerpt', d.excerpt,
               'created_at', d.created_at, 'member', public.community_author(d.member_id), 'by', public.community_author(d.decided_by),
               'appeal_result', d.appeal_result) order by d.id desc)
      from (select * from public.community_decisions order by id desc limit 30) d), '[]'::jsonb));
end;
$$;

-- Inhalt eines gemeldeten Ziels für die Moderation (auch ausgeblendete Inhalte)
create or replace function public.community_mod_target(p_type text, p_id bigint)
returns jsonb
language sql
stable
security definer
set search_path = public
as $$
  select case p_type
    when 'post' then (select jsonb_build_object('body', p.body, 'images', to_jsonb(p.images), 'status', p.status, 'topic', p.topic,
                        'kind', p.kind, 'created_at', p.created_at, 'author', public.community_author(p.author_id))
                      from public.community_posts p where p.id = p_id)
    when 'comment' then (select jsonb_build_object('body', c.body, 'status', c.status, 'post_id', c.post_id, 'created_at', c.created_at,
                        'author', public.community_author(c.author_id))
                      from public.community_comments c where c.id = p_id)
    else (select jsonb_build_object('body', coalesce(m.bio, ''), 'status', m.status, 'warnings', m.warnings, 'created_at', m.created_at,
                        'author', public.community_author(m.id))
          from public.community_members m where m.id = p_id)
  end;
$$;
