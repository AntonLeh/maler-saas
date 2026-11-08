-- =====================================================================
-- has_feature(): Testphase schaltet alle Funktionen frei (wie in der App),
-- gesperrte/beendete Abos haben keine Zusatzfunktionen mehr.
-- Betrifft u. a. das Kundenportal (Link öffnen, Angebot bestätigen).
-- Maßgeblich ist das neueste Abo der Firma. Kann mehrfach ausgeführt werden.
-- =====================================================================

create or replace function public.has_feature(p_tenant_id bigint, p_feature text)
returns boolean
language plpgsql
stable
security definer
set search_path = public, extensions
as $function$
declare
  v_status text;
  v_features jsonb;
begin
  select s.status, s.features
    into v_status, v_features
    from public.subscriptions s
   where s.tenant_id = p_tenant_id
   order by s.id desc
   limit 1;

  if v_status = 'trialing' then
    return true;
  end if;

  if v_status in ('active', 'past_due') then
    return coalesce((v_features -> p_feature ->> 'enabled')::boolean, false);
  end if;

  return false;
end;
$function$;
