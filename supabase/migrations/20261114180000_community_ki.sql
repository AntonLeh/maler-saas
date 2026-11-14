-- MalerTreff: KI-Vorprüfung neuer Beiträge und Antworten – 14.11.2026
-- Neue Inhalte sind zuerst nur für den Autor sichtbar (status 'pruefung', hidden_reason 'ki', ai_status 'ausstehend').
-- Die Server-Funktion „community“ prüft sie und meldet das Ergebnis über community_ai_result (nur mit Server-Rechten).
-- Unauffällig oder KI nicht erreichbar -> sichtbar. Auffällig -> bleibt verborgen, die Moderation entscheidet.

alter table public.community_settings add column if not exists ai_check boolean not null default true;
alter table public.community_posts add column if not exists ai_status text;
alter table public.community_posts add column if not exists ai_reason text;
alter table public.community_posts add column if not exists ai_danger boolean not null default false;
alter table public.community_posts add column if not exists ai_checked_at timestamptz;
alter table public.community_posts add column if not exists people_consent boolean not null default false;
alter table public.community_comments add column if not exists ai_status text;
alter table public.community_comments add column if not exists ai_reason text;
alter table public.community_comments add column if not exists ai_danger boolean not null default false;
alter table public.community_comments add column if not exists ai_checked_at timestamptz;

-- Regeln enthalten jetzt den Hinweis auf die automatische Vorprüfung -> neue Fassung, alle bestätigen einmal neu
update public.community_settings set rules_version = 'entwurf-2026-11-14-ki', updated_at = now()
where id = 1 and rules_version = 'entwurf-2026-11-14';


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
    'ai_pending', p.author_id = p_me and p.ai_status = 'ausstehend', 'people_consent', p.people_consent,
    'helpful_by_me', exists (select 1 from public.community_reactions r where r.post_id = p.id and r.member_id = p_me),
    'author', public.community_author(p.author_id));
$$;

create or replace function public.community_post_create(p_kind text, p_topic text, p_body text, p_images text[], p_people_consent boolean)
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
  v_ai boolean;
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
  v_ai := coalesce((select ai_check from public.community_settings where id = 1), false);
  insert into public.community_posts (author_id, kind, topic, body, images, people_consent, status, hidden_reason, ai_status)
  values (m.id, p_kind, p_topic, v_body, v_images, coalesce(p_people_consent, false),
          case when v_ai then 'pruefung' else 'sichtbar' end, case when v_ai then 'ki' end, case when v_ai then 'ausstehend' else 'aus' end)
  returning id into v_id;
  return v_id;
end;
$$;

-- Alte Aufrufform (ohne Häkchen) bleibt nutzbar und läuft ebenfalls durch die Vorprüfung
create or replace function public.community_post_create(p_kind text, p_topic text, p_body text, p_images text[])
returns bigint
language sql
security definer
set search_path = public
as $$
  select public.community_post_create(p_kind, p_topic, p_body, p_images, false);
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
  update public.community_posts
  set topic = p_topic, body = v_body, edited_at = now(),
      ai_status = case when coalesce((select ai_check from public.community_settings where id = 1), false) then 'ausstehend' else ai_status end,
      status = case when status = 'sichtbar' and coalesce((select ai_check from public.community_settings where id = 1), false) then 'pruefung' else status end,
      hidden_reason = case when status = 'sichtbar' and coalesce((select ai_check from public.community_settings where id = 1), false) then 'ki' else hidden_reason end
  where id = p_id and author_id = public.community_my_id() and status in ('sichtbar', 'pruefung');
  if not found then raise exception 'Beitrag kann nicht bearbeitet werden.'; end if;
end;
$$;

-- Benachrichtigung „hat geantwortet“ (erst, wenn die Antwort sichtbar ist)
create or replace function public.community_notify_answer(p_comment bigint)
returns void
language sql
security definer
set search_path = public
as $$
  insert into public.community_notices (member_id, kind, post_id, text)
  select p.author_id, 'antwort', p.id, m.display_name || ' hat auf Ihren Beitrag geantwortet.'
  from public.community_comments c
  join public.community_posts p on p.id = c.post_id
  join public.community_members m on m.id = c.author_id
  where c.id = p_comment and c.status = 'sichtbar' and p.author_id <> c.author_id;
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
  v_ai boolean;
begin
  if not public.community_can_use() then raise exception 'Kein Zugriff auf die Community.'; end if;
  if char_length(v_body) < 2 then raise exception 'Bitte eine Antwort schreiben.'; end if;
  select * into p from public.community_posts where id = p_post and status = 'sichtbar';
  if p.id is null then raise exception 'Beitrag nicht gefunden.'; end if;
  if (select count(*) from public.community_comments where author_id = v_me and created_at > now() - interval '1 day') >= 60 then
    raise exception 'Heute wurden schon 60 Antworten geschrieben. Bitte morgen weiter.';
  end if;
  v_ai := coalesce((select ai_check from public.community_settings where id = 1), false);
  insert into public.community_comments (post_id, author_id, body, status, hidden_reason, ai_status)
  values (p.id, v_me, v_body, case when v_ai then 'pruefung' else 'sichtbar' end, case when v_ai then 'ki' end, case when v_ai then 'ausstehend' else 'aus' end)
  returning id into v_id;
  update public.community_posts set last_activity_at = now() where id = p.id;
  if not v_ai then perform public.community_notify_answer(v_id); end if;
  return v_id;
end;
$$;
