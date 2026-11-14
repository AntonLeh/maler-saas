-- Community Stufe 1: Beiträge, Kommentare, „Hilfreich“, Lösung, Benachrichtigungen – 14.11.2026

create or replace function public.community_author(p_member bigint)
returns jsonb
language sql
stable
security definer
set search_path = public
as $$
  select jsonb_build_object('id', m.id, 'name', m.display_name, 'kind', m.kind, 'company', m.company, 'region', m.region,
                            'is_mod', m.is_moderator or m.kind = 'team')
  from public.community_members m where m.id = p_member;
$$;

create or replace function public.community_post_json(p public.community_posts, p_me bigint)
returns jsonb
language sql
stable
security definer
set search_path = public
as $$
  select jsonb_build_object(
    'id', p.id, 'kind', p.kind, 'topic', p.topic, 'body', p.body, 'images', to_jsonb(p.images), 'status', p.status,
    'solution_comment_id', p.solution_comment_id, 'comment_count', (select count(*) from public.community_comments c where c.post_id = p.id and c.status = 'sichtbar'), 'helpful_count', p.helpful_count,
    'created_at', p.created_at, 'edited_at', p.edited_at, 'mine', p.author_id = p_me,
    'helpful_by_me', exists (select 1 from public.community_reactions r where r.post_id = p.id and r.member_id = p_me),
    'author', public.community_author(p.author_id));
$$;

-- Feed: neueste zuerst, 20 je Seite; eigene Beiträge in Prüfung sieht nur der Autor
create or replace function public.community_feed(p_topic text, p_author bigint, p_before bigint, p_query text)
returns jsonb
language plpgsql
stable
security definer
set search_path = public
as $$
declare
  v_me bigint := public.community_my_id();
begin
  if not public.community_can_use() then raise exception 'Kein Zugriff auf die Community.'; end if;
  return coalesce((
    select jsonb_agg(public.community_post_json(p, v_me) order by p.id desc)
    from (
      select * from public.community_posts p
      where (p.status = 'sichtbar' or (p.author_id = v_me and p.status = 'pruefung'))
        and (p_topic is null or p.topic = p_topic)
        and (p_author is null or p.author_id = p_author)
        and (p_before is null or p.id < p_before)
        and (coalesce(trim(p_query), '') = '' or p.body ilike '%' || left(trim(p_query), 60) || '%')
      order by p.id desc
      limit 20
    ) p), '[]'::jsonb);
end;
$$;

-- Ein Beitrag mit Kommentaren
create or replace function public.community_post_get(p_id bigint)
returns jsonb
language plpgsql
stable
security definer
set search_path = public
as $$
declare
  v_me bigint := public.community_my_id();
  p public.community_posts;
begin
  if not public.community_can_use() then raise exception 'Kein Zugriff auf die Community.'; end if;
  select * into p from public.community_posts where id = p_id and (status = 'sichtbar' or (author_id = v_me and status = 'pruefung'));
  if p.id is null then return null; end if;
  return public.community_post_json(p, v_me) || jsonb_build_object('comments', coalesce((
    select jsonb_agg(jsonb_build_object('id', c.id, 'body', c.body, 'status', c.status, 'created_at', c.created_at,
             'helpful_count', c.helpful_count, 'mine', c.author_id = v_me,
             'helpful_by_me', exists (select 1 from public.community_reactions r where r.comment_id = c.id and r.member_id = v_me),
             'author', public.community_author(c.author_id)) order by c.id)
    from public.community_comments c
    where c.post_id = p.id and (c.status = 'sichtbar' or (c.author_id = v_me and c.status = 'pruefung'))), '[]'::jsonb));
end;
$$;

create or replace function public.community_post_create(p_kind text, p_topic text, p_body text, p_images text[])
returns bigint
language plpgsql
security definer
set search_path = public
as $$
declare
  m public.community_members;
  v_body text := left(trim(coalesce(p_body, '')), 5000);
  v_images text[] := coalesce(p_images, '{}');
  v_img text;
  v_id bigint;
begin
  if not public.community_can_use() then raise exception 'Kein Zugriff auf die Community.'; end if;
  select * into m from public.community_members where auth_user_id = auth.uid();
  if p_kind not in ('frage', 'projekt', 'tipp', 'anzeige') then raise exception 'Unbekannte Beitragsart.'; end if;
  if p_kind = 'anzeige' and m.kind <> 'zulieferer' then raise exception 'Anzeigen können nur Zulieferer veröffentlichen.'; end if;
  if p_topic not in ('untergruende', 'fassade', 'lack', 'tapete', 'boden', 'kalkulation', 'personal', 'recht', 'werkzeug', 'heimwerker', 'sonstiges') then
    raise exception 'Bitte ein Thema wählen.';
  end if;
  if char_length(v_body) < 10 then raise exception 'Bitte mindestens 10 Zeichen schreiben.'; end if;
  if cardinality(v_images) > 4 then raise exception 'Höchstens 4 Fotos je Beitrag.'; end if;
  foreach v_img in array v_images loop
    if v_img !~ ('^' || auth.uid()::text || '/[0-9a-f-]{36}\.(jpg|webp)$') then raise exception 'Ungültiges Foto.'; end if;
  end loop;
  if (select count(*) from public.community_posts where author_id = m.id and created_at > now() - interval '1 day') >= 10 then
    raise exception 'Heute wurden schon 10 Beiträge geschrieben. Bitte morgen weiter.';
  end if;
  insert into public.community_posts (author_id, kind, topic, body, images)
  values (m.id, p_kind, p_topic, v_body, v_images) returning id into v_id;
  return v_id;
end;
$$;

create or replace function public.community_post_update(p_id bigint, p_topic text, p_body text)
returns void
language plpgsql
security definer
set search_path = public
as $$
declare
  v_body text := left(trim(coalesce(p_body, '')), 5000);
begin
  if not public.community_can_use() then raise exception 'Kein Zugriff auf die Community.'; end if;
  if p_topic not in ('untergruende', 'fassade', 'lack', 'tapete', 'boden', 'kalkulation', 'personal', 'recht', 'werkzeug', 'heimwerker', 'sonstiges') then
    raise exception 'Bitte ein Thema wählen.';
  end if;
  if char_length(v_body) < 10 then raise exception 'Bitte mindestens 10 Zeichen schreiben.'; end if;
  update public.community_posts set topic = p_topic, body = v_body, edited_at = now()
  where id = p_id and author_id = public.community_my_id() and status in ('sichtbar', 'pruefung');
  if not found then raise exception 'Beitrag kann nicht bearbeitet werden.'; end if;
end;
$$;

-- Eigenen Beitrag löschen (Fotos löscht die App im Speicher). Gibt die Fotopfade zurück.
create or replace function public.community_post_delete(p_id bigint)
returns text[]
language plpgsql
security definer
set search_path = public
as $$
declare
  v_images text[];
begin
  delete from public.community_posts where id = p_id and author_id = public.community_my_id() and status in ('sichtbar', 'pruefung')
  returning images into v_images;
  if not found then raise exception 'Beitrag kann nicht gelöscht werden.'; end if;
  return v_images;
end;
$$;

create or replace function public.community_comment_create(p_post bigint, p_body text)
returns bigint
language plpgsql
security definer
set search_path = public
as $$
declare
  v_me bigint := public.community_my_id();
  v_body text := left(trim(coalesce(p_body, '')), 2000);
  p public.community_posts;
  v_id bigint;
  v_name text;
begin
  if not public.community_can_use() then raise exception 'Kein Zugriff auf die Community.'; end if;
  if char_length(v_body) < 2 then raise exception 'Bitte eine Antwort schreiben.'; end if;
  select * into p from public.community_posts where id = p_post and status = 'sichtbar';
  if p.id is null then raise exception 'Beitrag nicht gefunden.'; end if;
  if (select count(*) from public.community_comments where author_id = v_me and created_at > now() - interval '1 day') >= 60 then
    raise exception 'Heute wurden schon 60 Antworten geschrieben. Bitte morgen weiter.';
  end if;
  insert into public.community_comments (post_id, author_id, body) values (p.id, v_me, v_body) returning id into v_id;
  update public.community_posts set last_activity_at = now() where id = p.id;
  if p.author_id <> v_me then
    select display_name into v_name from public.community_members where id = v_me;
    insert into public.community_notices (member_id, kind, post_id, text)
    values (p.author_id, 'antwort', p.id, v_name || ' hat auf Ihren Beitrag geantwortet.');
  end if;
  return v_id;
end;
$$;

create or replace function public.community_comment_delete(p_id bigint)
returns void
language plpgsql
security definer
set search_path = public
as $$
declare
  v_post bigint;
begin
  delete from public.community_comments where id = p_id and author_id = public.community_my_id() and status in ('sichtbar', 'pruefung')
  returning post_id into v_post;
  if not found then raise exception 'Antwort kann nicht gelöscht werden.'; end if;
  update public.community_posts set solution_comment_id = null where id = v_post and solution_comment_id = p_id;
end;
$$;

-- Autor markiert eine Antwort als Lösung (null = Markierung entfernen)
create or replace function public.community_mark_solution(p_post bigint, p_comment bigint)
returns void
language plpgsql
security definer
set search_path = public
as $$
declare
  v_me bigint := public.community_my_id();
  v_author bigint;
begin
  if not public.community_can_use() then raise exception 'Kein Zugriff auf die Community.'; end if;
  if p_comment is not null then
    select author_id into v_author from public.community_comments where id = p_comment and post_id = p_post and status = 'sichtbar';
    if v_author is null then raise exception 'Antwort nicht gefunden.'; end if;
  end if;
  update public.community_posts set solution_comment_id = p_comment where id = p_post and author_id = v_me and status = 'sichtbar';
  if not found then raise exception 'Nur der Autor kann eine Lösung markieren.'; end if;
  if v_author is not null and v_author <> v_me then
    insert into public.community_notices (member_id, kind, post_id, text)
    values (v_author, 'loesung', p_post, 'Ihre Antwort wurde als Lösung markiert. Danke für Ihre Hilfe!');
  end if;
end;
$$;

-- „Hilfreich“ umschalten (nicht für eigene Beiträge); gibt den neuen Zustand zurück
create or replace function public.community_helpful(p_post bigint, p_comment bigint)
returns boolean
language plpgsql
security definer
set search_path = public
as $$
declare
  v_me bigint := public.community_my_id();
  v_author bigint;
begin
  if not public.community_can_use() then raise exception 'Kein Zugriff auf die Community.'; end if;
  if p_comment is not null then
    select author_id into v_author from public.community_comments where id = p_comment and status = 'sichtbar';
  else
    select author_id into v_author from public.community_posts where id = p_post and status = 'sichtbar';
  end if;
  if v_author is null then raise exception 'Nicht gefunden.'; end if;
  if v_author = v_me then raise exception 'Eigene Beiträge können nicht als hilfreich markiert werden.'; end if;

  if p_comment is not null then
    delete from public.community_reactions where member_id = v_me and comment_id = p_comment;
    if found then update public.community_comments set helpful_count = greatest(helpful_count - 1, 0) where id = p_comment; return false; end if;
    insert into public.community_reactions (member_id, comment_id) values (v_me, p_comment);
    update public.community_comments set helpful_count = helpful_count + 1 where id = p_comment;
  else
    delete from public.community_reactions where member_id = v_me and post_id = p_post;
    if found then update public.community_posts set helpful_count = greatest(helpful_count - 1, 0) where id = p_post; return false; end if;
    insert into public.community_reactions (member_id, post_id) values (v_me, p_post);
    update public.community_posts set helpful_count = helpful_count + 1 where id = p_post;
  end if;
  return true;
end;
$$;

-- Benachrichtigungen (auch für gesperrte Mitglieder lesbar: Begründung und Widerspruch)
create or replace function public.community_notices_list()
returns jsonb
language sql
stable
security definer
set search_path = public
as $$
  select coalesce(jsonb_agg(jsonb_build_object('id', n.id, 'kind', n.kind, 'text', n.text, 'post_id', n.post_id, 'read', n.read_at is not null,
           'created_at', n.created_at, 'decision', case when d.id is null then null else jsonb_build_object(
             'id', d.id, 'action', d.action, 'can_appeal', d.member_id = n.member_id and d.action <> 'freigeben' and d.appeal_at is null
               and d.created_at > now() - interval '6 months', 'appeal_at', d.appeal_at, 'appeal_result', d.appeal_result) end)
           order by n.id desc), '[]'::jsonb)
  from (select * from public.community_notices where member_id = public.community_my_id() order by id desc limit 50) n
  left join public.community_decisions d on d.id = n.decision_id;
$$;

create or replace function public.community_notices_read()
returns void
language sql
security definer
set search_path = public
as $$
  update public.community_notices set read_at = now() where member_id = public.community_my_id() and read_at is null;
$$;

do $$
declare f text;
begin
  foreach f in array array[
    'community_author(bigint)', 'community_post_json(public.community_posts, bigint)']
  loop
    execute format('revoke all on function public.%s from public, anon, authenticated', f);
  end loop;
  foreach f in array array[
    'community_feed(text, bigint, bigint, text)', 'community_post_get(bigint)', 'community_post_create(text, text, text, text[])',
    'community_post_update(bigint, text, text)', 'community_post_delete(bigint)', 'community_comment_create(bigint, text)',
    'community_comment_delete(bigint)', 'community_mark_solution(bigint, bigint)', 'community_helpful(bigint, bigint)',
    'community_notices_list()', 'community_notices_read()']
  loop
    execute format('revoke all on function public.%s from public, anon', f);
    execute format('grant execute on function public.%s to authenticated', f);
  end loop;
end $$;
