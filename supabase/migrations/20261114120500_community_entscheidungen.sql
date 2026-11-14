-- Community Stufe 1: Entscheidung mit Begründung an Betroffene und Meldende, Widerspruch – 14.11.2026

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
      select author_id, left(body, 300), status, hidden_reason = 'meldungen' into v_member, v_excerpt, v_old, v_auto from public.community_posts where id = p_id;
      update public.community_posts
      set status = case p_action when 'freigeben' then 'sichtbar' when 'ausblenden' then 'ausgeblendet' else 'geloescht' end,
          hidden_reason = case when p_action = 'freigeben' then null else v_rule end
      where id = p_id;
    else
      select author_id, left(body, 300), status, hidden_reason = 'meldungen' into v_member, v_excerpt, v_old, v_auto from public.community_comments where id = p_id;
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

  insert into public.community_decisions (target_type, target_id, member_id, action, rule, note, excerpt, decided_by)
  values (p_type, p_id, v_member, p_action, v_rule, v_note, v_excerpt, v_mod)
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

  update public.community_reports set status = 'erledigt', decision_id = v_dec
  where target_type = p_type and target_id = p_id and status = 'offen';
  return v_dec;
end;
$$;

-- Widerspruch: einmal je Entscheidung, innerhalb von 6 Monaten (auch gesperrte Mitglieder)
create or replace function public.community_appeal(p_decision bigint, p_text text)
returns void
language plpgsql
security definer
set search_path = public
as $$
declare
  v_text text := left(trim(coalesce(p_text, '')), 1000);
begin
  if char_length(v_text) < 10 then raise exception 'Bitte den Widerspruch kurz begründen (mindestens 10 Zeichen).'; end if;
  update public.community_decisions set appeal_text = v_text, appeal_at = now()
  where id = p_decision and member_id = public.community_my_id() and action not in ('freigeben', 'entsperren')
    and appeal_at is null and created_at > now() - interval '6 months';
  if not found then raise exception 'Widerspruch ist hier nicht (mehr) möglich.'; end if;
end;
$$;

-- Moderation entscheidet über den Widerspruch: bestätigen oder aufheben (Aufheben macht die Maßnahme rückgängig)
create or replace function public.community_mod_appeal_decide(p_decision bigint, p_uphold boolean, p_note text)
returns void
language plpgsql
security definer
set search_path = public
as $$
declare
  d public.community_decisions;
  v_note text := nullif(left(trim(coalesce(p_note, '')), 1000), '');
begin
  if not public.community_is_mod() then raise exception 'Nur für die Moderation.'; end if;
  select * into d from public.community_decisions where id = p_decision and appeal_at is not null and appeal_result is null;
  if d.id is null then raise exception 'Kein offener Widerspruch.'; end if;
  if not coalesce(p_uphold, true) then
    if d.target_type = 'post' then
      update public.community_posts set status = 'sichtbar', hidden_reason = null where id = d.target_id;
    elsif d.target_type = 'comment' then
      update public.community_comments set status = 'sichtbar', hidden_reason = null where id = d.target_id;
    elsif d.action = 'sperren' then
      update public.community_members set status = 'aktiv' where id = d.target_id and status = 'gesperrt';
    elsif d.action = 'verwarnen' then
      update public.community_members set warnings = greatest(warnings - 1, 0) where id = d.target_id;
    end if;
  end if;
  update public.community_decisions
  set appeal_result = case when coalesce(p_uphold, true) then 'bestaetigt' else 'aufgehoben' end,
      appeal_note = v_note, appeal_decided_at = now()
  where id = d.id;
  if d.member_id is not null then
    insert into public.community_notices (member_id, kind, decision_id, text)
    values (d.member_id, 'moderation', d.id,
      case when coalesce(p_uphold, true)
        then 'Ihr Widerspruch wurde geprüft. Die Entscheidung bleibt bestehen.'
        else 'Ihr Widerspruch war erfolgreich. Die Maßnahme wurde aufgehoben.' end
      || coalesce(' Erläuterung: ' || v_note, ''));
  end if;
end;
$$;

do $$
declare f text;
begin
  execute 'revoke all on function public.community_mod_target(text, bigint) from public, anon, authenticated';
  foreach f in array array[
    'community_report(text, bigint, text, text)', 'community_mod_queue()', 'community_mod_decide(text, bigint, text, text, text)',
    'community_appeal(bigint, text)', 'community_mod_appeal_decide(bigint, boolean, text)']
  loop
    execute format('revoke all on function public.%s from public, anon', f);
    execute format('grant execute on function public.%s to authenticated', f);
  end loop;
end $$;
