-- MalerTreff: KI-Vorprüfung – Auftrag, Ergebnis, Moderation, Schalter – 14.11.2026

-- Auftrag für die Server-Funktion: nur der Autor selbst, nur solange die Prüfung aussteht
create or replace function public.community_ai_job(p_type text, p_id bigint)
returns jsonb
language sql
stable
security definer
set search_path = public
as $$
  select case p_type
    when 'post' then (select jsonb_build_object('type', 'post', 'id', p.id, 'kind', p.kind, 'topic', p.topic, 'body', p.body,
                        'images', to_jsonb(p.images), 'people_consent', p.people_consent, 'author_kind', m.kind)
                      from public.community_posts p join public.community_members m on m.id = p.author_id
                      where p.id = p_id and m.auth_user_id = auth.uid() and p.ai_status = 'ausstehend')
    when 'comment' then (select jsonb_build_object('type', 'comment', 'id', c.id, 'kind', 'antwort', 'body', c.body,
                        'images', '[]'::jsonb, 'people_consent', false, 'author_kind', m.kind)
                      from public.community_comments c join public.community_members m on m.id = c.author_id
                      where c.id = p_id and m.auth_user_id = auth.uid() and c.ai_status = 'ausstehend')
  end;
$$;

-- Ergebnis der Prüfung (nur Server-Funktion): ok/fehler -> sichtbar, auffaellig -> bleibt bei der Moderation
create or replace function public.community_ai_result(p_type text, p_id bigint, p_result text, p_reason text, p_danger boolean)
returns text
language plpgsql
security definer
set search_path = public
as $$
declare
  v_status text;
begin
  if p_result not in ('ok', 'auffaellig', 'fehler') then raise exception 'Unbekanntes Ergebnis.'; end if;
  if p_type = 'post' then
    update public.community_posts
    set ai_status = p_result, ai_reason = left(p_reason, 500), ai_danger = coalesce(p_danger, false), ai_checked_at = now(),
        status = case when p_result <> 'auffaellig' and status = 'pruefung' and hidden_reason = 'ki' then 'sichtbar' else status end,
        hidden_reason = case when p_result <> 'auffaellig' and status = 'pruefung' and hidden_reason = 'ki' then null else hidden_reason end
    where id = p_id and ai_status = 'ausstehend'
    returning status into v_status;
  elsif p_type = 'comment' then
    update public.community_comments
    set ai_status = p_result, ai_reason = left(p_reason, 500), ai_danger = coalesce(p_danger, false), ai_checked_at = now(),
        status = case when p_result <> 'auffaellig' and status = 'pruefung' and hidden_reason = 'ki' then 'sichtbar' else status end,
        hidden_reason = case when p_result <> 'auffaellig' and status = 'pruefung' and hidden_reason = 'ki' then null else hidden_reason end
    where id = p_id and ai_status = 'ausstehend'
    returning status into v_status;
    if v_status = 'sichtbar' then perform public.community_notify_answer(p_id); end if;
  end if;
  return coalesce(v_status, 'unveraendert');
end;
$$;

create or replace function public.community_ai_get()
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select coalesce((select ai_check from public.community_settings where id = 1), false);
$$;

create or replace function public.community_ai_set(p_on boolean)
returns void
language plpgsql
security definer
set search_path = public
as $$
begin
  if public.current_role_id() is distinct from 1 then raise exception 'Nur für den Plattform-Owner.'; end if;
  update public.community_settings set ai_check = coalesce(p_on, false), updated_at = now() where id = 1;
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
                        'kind', p.kind, 'created_at', p.created_at, 'author', public.community_author(p.author_id),
                        'hidden_reason', p.hidden_reason, 'ai_status', p.ai_status, 'ai_reason', p.ai_reason, 'people_consent', p.people_consent)
                      from public.community_posts p where p.id = p_id)
    when 'comment' then (select jsonb_build_object('body', c.body, 'status', c.status, 'post_id', c.post_id, 'created_at', c.created_at,
                        'author', public.community_author(c.author_id),
                        'hidden_reason', c.hidden_reason, 'ai_status', c.ai_status, 'ai_reason', c.ai_reason)
                      from public.community_comments c where c.id = p_id)
    else (select jsonb_build_object('body', coalesce(m.bio, ''), 'status', m.status, 'warnings', m.warnings, 'created_at', m.created_at,
                        'author', public.community_author(m.id))
          from public.community_members m where m.id = p_id)
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
              and not (ai_status = 'ausstehend' and coalesce(edited_at, created_at) > now() - interval '10 minutes')
            union all select 'comment', id, created_at from public.community_comments where status = 'pruefung'
              and not (ai_status = 'ausstehend' and created_at > now() - interval '10 minutes')
          ) u
          group by u.target_type, u.target_id
        ) t
        cross join lateral (
          select count(*) as cnt,
                 coalesce(bool_or(r.reason = 'gefahr'), false)
                   or coalesce((select x.ai_danger from public.community_posts x where t.target_type = 'post' and x.id = t.target_id), false)
                   or coalesce((select x.ai_danger from public.community_comments x where t.target_type = 'comment' and x.id = t.target_id), false) as danger,
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

create or replace function public.community_mod_decide(p_type text, p_id bigint, p_action text, p_rule text, p_note text)
returns bigint
language plpgsql
security definer
set search_path = public
as $$
declare
  v_mod bigint := public.community_my_id();
  v_rule text := left(trim(coalesce(p_rule, '')), 120);
  v_note text := nullif(left(trim(coalesce(p_note, '')), 1000), '');
  v_member bigint;
  v_excerpt text;
  v_old text;
  v_auto boolean := false;
  v_ai_held boolean := false;
  v_dec bigint;
  v_what text;
  v_text text;
  v_result text;
  v_kind text;
begin
  if not public.community_is_mod() then raise exception 'Nur für die Moderation.'; end if;
  if p_action <> 'freigeben' and p_action <> 'entsperren' and v_rule = '' then raise exception 'Bitte die verletzte Regel angeben.'; end if;
  if v_rule = '' then v_rule := 'kein Verstoß'; end if;

  if p_type in ('post', 'comment') then
    if p_action not in ('freigeben', 'ausblenden', 'loeschen') then raise exception 'Diese Aktion passt nicht zu einem Beitrag.'; end if;
    if p_type = 'post' then
      select author_id, left(body, 300), status, hidden_reason = 'meldungen', hidden_reason = 'ki' into v_member, v_excerpt, v_old, v_auto, v_ai_held from public.community_posts where id = p_id;
      update public.community_posts
      set status = case p_action when 'freigeben' then 'sichtbar' when 'ausblenden' then 'ausgeblendet' else 'geloescht' end,
          hidden_reason = case when p_action = 'freigeben' then null else v_rule end
      where id = p_id;
    else
      select author_id, left(body, 300), status, hidden_reason = 'meldungen', hidden_reason = 'ki' into v_member, v_excerpt, v_old, v_auto, v_ai_held from public.community_comments where id = p_id;
      update public.community_comments
      set status = case p_action when 'freigeben' then 'sichtbar' when 'ausblenden' then 'ausgeblendet' else 'geloescht' end,
          hidden_reason = case when p_action = 'freigeben' then null else v_rule end
      where id = p_id;
    end if;
    if v_member is null then raise exception 'Inhalt nicht gefunden.'; end if;
    v_what := case when p_type = 'post' then 'Ihr Beitrag' else 'Ihre Antwort' end || ' „' || left(regexp_replace(v_excerpt, '\s+', ' ', 'g'), 60)
              || case when char_length(v_excerpt) > 60 then '…' else '' end || '“';
  elsif p_type = 'member' then
    if p_action not in ('freigeben', 'verwarnen', 'sperren', 'entsperren') then raise exception 'Diese Aktion passt nicht zu einem Mitglied.'; end if;
    select id, display_name, status, kind into v_member, v_excerpt, v_old, v_kind from public.community_members where id = p_id;
    if v_member is null then raise exception 'Mitglied nicht gefunden.'; end if;
    if v_kind = 'team' then raise exception 'Das MalerSaaS-Team kann nicht gesperrt werden.'; end if;
    if v_member = v_mod then raise exception 'Eigene Konten können nicht moderiert werden.'; end if;
    update public.community_members
    set status = case p_action when 'sperren' then 'gesperrt' when 'entsperren' then 'aktiv' else status end,
        warnings = warnings + case when p_action = 'verwarnen' then 1 else 0 end,
        is_moderator = case when p_action = 'sperren' then false else is_moderator end
    where id = p_id;
  else
    raise exception 'Unbekanntes Ziel.';
  end if;

  insert into public.community_decisions (target_type, target_id, member_id, action, rule, note, excerpt, decided_by, automated)
  values (p_type, p_id, v_member, p_action, v_rule, v_note, v_excerpt, v_mod, coalesce(v_auto, false) or coalesce(v_ai_held, false))
  returning id into v_dec;

  -- Begründung an das betroffene Mitglied (DSA Art. 17)
  v_text := case p_action
    when 'freigeben' then case when p_type = 'member' or v_old = 'sichtbar' then null else v_what || ' wurde geprüft und ist wieder sichtbar.' end
    when 'ausblenden' then v_what || ' wurde ausgeblendet.'
    when 'loeschen' then v_what || ' wurde entfernt.'
    when 'verwarnen' then 'Sie haben eine Verwarnung der Moderation erhalten. Bei wiederholten Verstößen kann Ihr Zugang gesperrt werden.'
    when 'sperren' then 'Ihr Zugang zur Community wurde gesperrt.'
    when 'entsperren' then 'Ihr Zugang zur Community ist wieder freigeschaltet.'
  end;
  if v_text is not null then
    if p_action in ('ausblenden', 'loeschen', 'verwarnen', 'sperren') then
      v_text := v_text || ' Grund: Verstoß gegen die Community-Regel „' || v_rule || '“.'
        || coalesce(' Erläuterung: ' || v_note, '')
        || case when v_auto then ' Der Inhalt war nach Meldungen anderer Mitglieder automatisch vorläufig ausgeblendet.' else '' end
        || case when v_ai_held then ' Der Inhalt wurde von unserer automatischen Vorprüfung (KI) zurückgehalten.' else '' end
        || ' Entschieden hat ein Mensch aus der Moderation.'
        || ' Sie können innerhalb von 6 Monaten einmal widersprechen – direkt hier in den Benachrichtigungen.';
    end if;
    insert into public.community_notices (member_id, kind, decision_id, text) values (v_member, 'moderation', v_dec, v_text);
  end if;

  -- Ergebnis an alle, die gemeldet haben (DSA Art. 16 Abs. 5)
  v_result := case p_action
    when 'freigeben' then 'Kein Verstoß gegen die Community-Regeln festgestellt' || case when p_type = 'member' then '.' else ', der Inhalt bleibt sichtbar.' end
    when 'ausblenden' then 'Der Inhalt wurde ausgeblendet.'
    when 'loeschen' then 'Der Inhalt wurde entfernt.'
    when 'verwarnen' then 'Das Mitglied wurde verwarnt.'
    when 'sperren' then 'Das Mitglied wurde gesperrt.'
    else 'Die Meldung ist erledigt.' end;
  insert into public.community_notices (member_id, kind, decision_id, text)
  select distinct r.reporter_id, 'meldung', v_dec, 'Ihre Meldung wurde geprüft. Ergebnis: ' || v_result
  from public.community_reports r
  where r.target_type = p_type and r.target_id = p_id and r.status = 'offen' and r.reporter_id is not null;

  if p_type = 'comment' and p_action = 'freigeben' and coalesce(v_ai_held, false) then perform public.community_notify_answer(p_id); end if;

  update public.community_reports set status = 'erledigt', decision_id = v_dec
  where target_type = p_type and target_id = p_id and status = 'offen';
  return v_dec;
end;
$$;

do $$
declare f text;
begin
  execute 'revoke all on function public.community_ai_result(text, bigint, text, text, boolean) from public, anon, authenticated';
  execute 'grant execute on function public.community_ai_result(text, bigint, text, text, boolean) to service_role';
  execute 'revoke all on function public.community_notify_answer(bigint) from public, anon, authenticated';
  execute 'revoke all on function public.community_post_json(public.community_posts, bigint) from public, anon, authenticated';
  execute 'revoke all on function public.community_mod_target(text, bigint) from public, anon, authenticated';
  foreach f in array array[
    'community_post_create(text, text, text, text[], boolean)', 'community_post_create(text, text, text, text[])',
    'community_post_update(bigint, text, text)', 'community_comment_create(bigint, text)', 'community_ai_job(text, bigint)',
    'community_ai_get()', 'community_ai_set(boolean)', 'community_mod_queue()', 'community_mod_decide(text, bigint, text, text, text)']
  loop
    execute format('revoke all on function public.%s from public, anon', f);
    execute format('grant execute on function public.%s to authenticated', f);
  end loop;
end $$;
